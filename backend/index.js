require("dotenv").config();
const { App } = require("@slack/bolt");
const mysql = require("mysql2");
const OpenAI = require("openai");
const express = require("express");
const ExcelJS = require("exceljs");
const connectDB = require('./db/mongoose');
const QueryHistory = require('./models/QueryHistory');
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '30000', 10);

connectDB();
// --------------------- Slack Bot Setup --------------------- //
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// --------------------- OpenAI Client Setup --------------------- //
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL:
    "https://tanik-m6mb2wkt-eastus2.cognitiveservices.azure.com/openai/deployments/jwero-multitenant/chat/completions?api-version=2024-08-01-preview",
  defaultQuery: { "api-version": "2024-08-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
});


const createPoolForTenant = (tenantId) => {
  return mysql.createPool({
    host: process.env.DEFAULT_DB_HOST,
    user: process.env.DEFAULT_DB_USER,
    password: process.env.DEFAULT_DB_PASSWORD,
    database: tenantId, // Use tenant ID as the database name
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};



// --------------------- Schema Definitions --------------------- //

const engagementSchema = `
Customer Engagement and Communication Schema:
1. Table: chat_users
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), first_name (varchar(255)), last_name (varchar(255)), profile_pic (longtext), whatsapp (varchar(20)), dialcode_whatsapp (varchar(6)), status (varchar(255)), last_message (varchar(255)), last_message_sent (varchar(255)), last_message_received (varchar(255)), unread (int), platform (varchar(255)), platform_id (varchar(255)), dialcode_mobile (varchar(255)), contact_type (varchar(255)), email (varchar(255)), company_name (varchar(255)), number (varchar(255)), teamMember (varchar(255)), last_message_received_id (varchar(255)), last_message_sent_id (varchar(255))]
   - Relationships:
     * One-to-Many → chat_conversations (chat_users.id = chat_conversations.chat_user_id)
     * One-to-Many → chat_user_metadata (chat_users.id = chat_user_metadata.user_id)
     * One-to-Many → social_posts (chat_users.id = social_posts.user_id)   
     * One-to-Many → social_comments (chat_users.id = social_comments.user_id) 
2. Table: chat_conversations
   - Columns: [id (int, primary key, auto_increment), chat_user_id (int, foreign key referencing chat_users.id), platform_id (varchar(255)), platform (varchar(255)), conversations (json)]
   - Relationships:
     * Many-to-One → chat_users (chat_conversations.chat_user_id = chat_users.id)
     * One-to-Many → chat_messages (chat_conversations.id = chat_messages.conversation_id)
3. Table: chat_messages
   - Columns: [id (int, primary key, auto_increment), conversation_id (int, foreign key referencing chat_conversations.id), platform_message_id (varchar(255)), created_at (timestamp, default CURRENT_TIMESTAMP), message (json)]
   - Relationships:
     * Many-to-One → chat_conversations (chat_messages.conversation_id = chat_conversations.id)
4. Table: chat_user_metadata
   - Columns: [id (int, primary key, auto_increment), user_id (int, foreign key referencing chat_users.id), attribute_key (varchar(255)), attribute_value (longtext)]
   -attribute_key(anniversary
assigned_team_member
branch
broadcast
country
dialcode_whatsapp
dialcode_mobile
facebook_info
followers
gender
hostname
is_verified_user
ip
instagram_info
last_ads_response_received
lead_source
loc
number
opt_in
org
sub_category
used_meta_optin_titles
tags
timezone
store_db
state
undefined
phone
postal
profile_update_time
region)
   - Relationships:
     * Many-to-One → chat_users (chat_user_metadata.user_id = chat_users.id)
5. Table: chat_user_opt_in
   - Columns: [id (int, primary key, auto_increment), created_on (timestamp, default CURRENT_TIMESTAMP), updated_on (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), chat_user_id (int, foreign key referencing chat_users.id), is_opt_in (tinyint(1)), expiry (datetime), opt_referral (varchar(100)), meta_info (json)]
   - Relationships:
     * Many-to-One → chat_users (chat_user_opt_in.chat_user_id = chat_users.id)
6. Table: social_posts
   - Columns: [id (int, primary key, auto_increment), platform (varchar(100), nullable, MUL), post_id (varchar(255) NOT NULL), user_id (int NOT NULL, MUL), content (json, nullable), caption (longtext, nullable), post_url (varchar(1000), nullable), timestamp (datetime NOT NULL), permalink (longtext, nullable), thumbnail (json, nullable), meta_data (json, nullable), created_at (timestamp, nullable, DEFAULT CURRENT_TIMESTAMP), updated_at (timestamp, nullable, DEFAULT CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)]
   - Relationships:
     * Many-to-One → chat_users (social_posts.user_id = chat_users.id)
7. Table: social_comments
   - Columns: [id (int, primary key, auto_increment), post_id (varchar(255) NOT NULL, MUL), comment_post_id (varchar(255) NOT NULL, MUL), user_id (int, nullable, MUL), parent_id (varchar(255), nullable), platform (varchar(80) NOT NULL, MUL), comment_id (varchar(255) NOT NULL, UNI), comment_text (longtext, nullable), timestamp (datetime NOT NULL, MUL), is_author (tinyint(1), nullable), meta_data (json, nullable)]
   - Relationships:
     * Many-to-One → chat_users (social_comments.user_id = chat_users.id) 
8. Table: quick_reply
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), title (varchar(255)), content (json), created_by (json)]
9. Table: chat_messages_meta_data
     - Columns:
        id (int, primary key, auto_increment)
        message_id (int, foreign key referencing chat_messages.id)
        attribute_key (varchar(255))
        attribute_value (text)
     - Relationships:
        chat_messages.id => chat_messages_meta_data.message_id
        flows.id->chat_messages_meta_data.attribute value(flows.type=trigger),(attribute_value=trigger_id)
        flows.id->campaign.flow_id (flows.type=campaign)
        campaign.id->chat_messages_meta_data.attribute_value(attribute_key=campaign_id)
        flows.id->campaign.flow_id (flows.type=chatbot)
        campaign.id->chat_messages_meta_data.attribute_value(attribute_key=flow_id)(attribute_value=flow.id)
        campaign.id->chat_messages_meta_data.attribute_value(attribute_key=is_bot_first_response)(attribute_value=true/false)
10. Table: flows
   - Columns: [id (int, primary key, auto_increment), title (varchar(255)), status (varchar(255)), event_name (varchar(150)), nodes (json), edges (json), channels (json), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), meta_data (json), type (varchar(255))(trigger)(campaigns)(chatbot), keywords (json), keyword_match_method (varchar(100))]
   - Relationships:
   flows.id->chat_messages_meta_data.attribute value(flows.type=trigger),(attribute_value=trigger_id)
   flows.id->campaign.flow_id (flows.type=campaign)
   campaign.id->chat_messages_meta_data.attribute_value(attribute_key=campaign_id)
   flows.id->campaign.flow_id (flows.type=chatbot)
   campaign.id->chat_messages_meta_data.attribute_value(attribute_key=flow_id)(attribute_value=flow.id)
   campaign.id->chat_messages_meta_data.attribute_value(attribute_key=is_bot_first_response)(attribute_value=true/false)
   chat_messages_meta_data.message_id->chat_messages.id
   chat_messages.conversation_id->chat_conversations.id
   chat_conversation.chat_user_id->chat_user.id
`;

const contactDataSchema = `
Customer and Contact Data Schema:
8. Table: contacts
   - Columns:
     - id (int, primary key, auto_increment)
     - first_name (varchar(255))
     - last_name (varchar(255))
     - company_name (varchar(255))
     - whatsapp (varchar(255))
     - email (varchar(255), unique)
     - mobile_number (varchar(255))
     - contact_type (enum('customer','lead'))
     - birthday (date)
     - gender (enum('male','female','other'))
     - anniversary (date)
     - profession (varchar(255))
     - branch_id (int)
     - first_purchase_date (date)
     - mobile_dial_code (varchar(10))
     - whatsapp_dial_code (int)
     - is_same_whatsapp_number (tinyint(1))
     - profile_url (varchar(2083))
     - created_on (datetime, default CURRENT_TIMESTAMP)
     - updated_at (datetime, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
   - Relationships:
       One-to-Many → crm_chats_link (contacts.id = crm_chats_link.crm_id)
       One-to-Many → metadata (contacts.id = metadata.contact_id)
9. Table: address_info
   - Columns:
     - id (int, primary key, auto_increment)
     - contact_id (int, nullable)
     - address_line1 (varchar(255), nullable)
     - address_line2 (varchar(255), nullable)
     - city (varchar(100), nullable)
     - post_code (varchar(20), nullable)
     - country (varchar(100), nullable)
     - state (varchar(100), nullable)
     - state_code (varchar(100), nullable)
     - country_code (varchar(100), nullable)
     - address_type (varchar(100), nullable)
     - district (varchar(255), nullable)
10. Table: chat_users
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), username (varchar(255)), first_name (varchar(255)), last_name (varchar(255)), profile_pic (longtext), whatsapp (varchar(20)), dialcode_whatsapp (varchar(6)), status (varchar(255)), last_message (varchar(255)), last_message_sent (varchar(255)), last_message_received (varchar(255)), unread (int), platform (varchar(255)), platform_id (varchar(255)), dialcode_mobile (varchar(255)), contact_type (varchar(255)), email (varchar(255)), company_name (varchar(255)), number (varchar(255)), teamMember (varchar(255)), last_message_received_id (varchar(255)), last_message_sent_id (varchar(255))]
    - Relationships:
       One-to-Many → contacts_merge (chat_users.id = contacts_merge.chat_id)
       One-to-Many → chat_user_metadata (chat_users.id = chat_user_metadata.user_id)
11. Table: crm_chats_link
    - Columns:
      - id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      - created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      - updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      - crm_id INT NOT NULL,
      - merge_id VARCHAR(50) NOT NULL,
      - meta_data JSON DEFAULT NULL,
      - KEY crm_id_idx (crm_id),
      - KEY merge_id_idx (merge_id)
    - Relationships:
       Many-to-One → contacts (crm_chats_link.crm_id = contacts.id)
       One-to-Many → contacts_merge (crm_chats_link.merge_id = contacts_merge.merge_id)
12. Table: contacts_merge
    - Columns:
      - id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      - merge_id VARCHAR(20) NOT NULL,
      - chat_id INT NOT NULL,
      - platform VARCHAR(50) NOT NULL
    - Relationships:
       Many-to-One → crm_chats_link (contacts_merge.merge_id = crm_chats_link.merge_id)
       Many-to-One → chat_users (contacts_merge.chat_id = chat_users.id) 
13. Table: metadata
    - Columns:
      - metadata_id (int, primary key, auto_increment)
      - contact_id (int, not null, foreign key to contacts.id)
      - attribute_key (varchar(255), not null)
      - attribute_value (text, nullable)
      - value_type (varchar(255), nullable)
      - created_at (timestamp, default CURRENT_TIMESTAMP)
      - updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
    - Relationships:
       Many-to-One → contacts (metadata.contact_id = contacts.id)
14. Table: chat_user_metadata
   - Columns: [id (int, primary key, auto_increment), user_id (int, foreign key referencing chat_users.id), attribute_key (varchar(255)), attribute_value (longtext)]
   - Relationships:
     * Many-to-One → chat_users (chat_user_metadata.user_id = chat_users.id)
       `;

const marketingSchema = `
Marketing and Campaign Data Schema:
1. Table: segments
   - Columns: [id (int, primary key, auto_increment), title (varchar(255)), segment_conditions (json), main_operator  (enum('and', 'or')), created_on (timestamp, default CURRENT_TIMESTAMP), last_activity (timestamp)]
   - Description: Categorizes and groups contacts for marketing, outreach, or analysis. The JSON fields store filtering rules and contact inclusions/exclusions.   
2. Table: flows
   - Columns: [id (int, primary key, auto_increment), title (varchar(255) NOT NULL), status (varchar(255)), nodes (json NOT NULL), edges (json NOT NULL), channels (json), created_at (timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP), updated_at (timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP), meta_data (json), type (varchar(255)), event_name (varchar(255)), keywords (json), keyword_match_method (varchar(50))]
   - Description: Defines flows used for campaigns, including the nodes, edges, channels, and related metadata.   
3. Table: campaigns
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), status (varchar(30)), flow_id (int), target_group (json)]
   - Relationships:
       * Foreign Key: flow_id references flows(id)
   - Description: Manages and tracks marketing or communication campaigns targeted toward specific groups of contacts.   
4. Table: ad_metadata
   - Columns: [id (int, primary key, auto_increment), title (varchar(255)), channel_type (varchar(255)), campaign_id (varchar(255)), set_id (varchar(255)), creative_id (varchar(255)), ad_id (varchar(255)), created_by (int), meta_data (json), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)]
   - Description: Stores metadata related to advertisements, including linking ad creatives and campaign details.   
5. Table: chat_users
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), username (varchar(255)), first_name (varchar(255)), last_name (varchar(255)), profile_pic (longtext), whatsapp (varchar(20)), dialcode_whatsapp (varchar(6)), status (varchar(255)), last_message (varchar(255)), last_message_sent (varchar(255)), last_message_received (varchar(255)), last_message_mau (datetime), last_message_sent_mau (datetime), last_message_received_mau (datetime), unread (int), platform (varchar(255)), platform_id (varchar(255)), dialcode_mobile (varchar(255)), contact_type (varchar(255)), email (varchar(255)), company_name (varchar(255)), number (varchar(255)), teamMember (varchar(255)), last_message_received_id (varchar(255)), last_message_sent_id (varchar(255))]
   - Relationships:
     * One-to-Many → chat_conversations (chat_users.id = chat_conversations.chat_user_id)
     * One-to-Many → chat_user_metadata (chat_users.id = chat_user_metadata.user_id)
6. Table: chat_conversations
   - Columns: [id (int, primary key, auto_increment), chat_user_id (int, foreign key referencing chat_users.id), platform_id (varchar(255)), platform (varchar(255)), conversations (json)]
   - Relationships:
     * Many-to-One → chat_users (chat_conversations.chat_user_id = chat_users.id)
     * One-to-Many → chat_messages (chat_conversations.id = chat_messages.conversation_id)
7. Table: chat_messages
   - Columns: [id (int, primary key, auto_increment), conversation_id (int, foreign key referencing chat_conversations.id), platform_message_id (varchar(255)), created_at (timestamp, default CURRENT_TIMESTAMP), message (json)]
   - Relationships:
     * Many-to-One → chat_conversations (chat_messages.conversation_id = chat_conversations.id)
8. Table: contacts
   - Columns:
     - id (int, primary key, auto_increment)
     - first_name (varchar(255))
     - last_name (varchar(255))
     - company_name (varchar(255))
     - whatsapp (varchar(255))
     - email (varchar(255), unique)
     - mobile_number (varchar(255))
     - contact_type (enum('customer','lead'))
     - birthday (date)
     - gender (enum('male','female','other'))
     - anniversary (date)
     - profession (varchar(255))
     - branch_id (int)
     - first_purchase_date (date)
     - mobile_dial_code (varchar(10))
     - whatsapp_dial_code (int)
     - is_same_whatsapp_number (tinyint(1))
     - profile_url (varchar(2083))
     - created_on (datetime, default CURRENT_TIMESTAMP)
     - updated_at (datetime, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP) 
9. Table: chat_messages_meta_data
     - Columns:
        id (int, primary key, auto_increment)
        message_id (int, foreign key referencing chat_messages.id)
        attribute_key (varchar(255))
        attribute_value (text)
     - Relationships:
        chat_messages.id => chat_messages_meta_data.message_id
        template_analytics_history.id => chat_messages_meta_data.attribute_key = "broadcast_id" AND chat_messages_meta_data.attribute_value = template_analytics_history.id
      Description:
      Stores additional metadata for messages, such as broadcast_id, enabling custom analytics or tracking tied to specific messages.           
10. Table: chat_messages_status_events
      - Columns: [id (int, primary key, auto_increment), message_id (int, foreign key referencing chat_messages.id), status (varchar(50)), created_at (datetime), errors (json)]
        Relationships:
        Foreign Key: message_id references chat_messages(id)
        Description: Tracks status events for messages, including the message's current status, timestamp, and any associated errors in JSON format.      
11. Table: template_analytics_history
      - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), type (varchar(100)), channel (varchar(100)), template (json), meta_data (json), target_group (json), sent_info (json), status (varchar(100)), created_by (varchar(100)), reference_type (varchar(100)), reference_id (varchar(100)), title (varchar(255)), scheduled_on (datetime), user_type (enum('chats','contacts'), default 'chats')]
        Relationships:
        template_analytics_history.id => chat_messages_meta_data.attribute_key = "broadcast_id" AND chat_messages_meta_data.attribute_value = template_analytics_history.id
        Description:
        Stores analytics history for templates, tracking metadata, targeting details, and sending information for various marketing campaigns. It also associates broadcast information with chat message metadata.      
12. Table: settings
      Columns:
      id (int, primary key, auto_increment): The unique identifier for each setting.
      name (varchar(255)): A human-readable name for the setting.
      data (longtext): The actual data associated with the setting, which could store any relevant information in a flexible format.
      Description: This table stores various settings, configurations, or parameters related to the marketing and campaign system. Each setting is identified by an id and associated with a name, while the data field allows for flexible storage of various configurations        
`;
const crmTaskSchema = `
CRM and Task Management Schema:
1. Table: crm_chats_link
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, NOT NULL DEFAULT CURRENT_TIMESTAMP), updated_at (timestamp, NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP), crm_id (int, NOT NULL), merge_id (varchar(50) NOT NULL), meta_data (json, nullable)]
2. Table: tasks
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, NOT NULL DEFAULT CURRENT_TIMESTAMP), updated_at (timestamp, NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP), title (varchar(255) NOT NULL), contributors (json, nullable), due_date (datetime, nullable), completed_on (datetime, nullable), contacts (json, nullable), reminder (datetime, nullable), description (json, nullable), status (varchar(100) NOT NULL), created_by (json, nullable), activities (json, nullable), notes (json, nullable), meta_data (json, nullable), type (varchar(255), nullable, default 'chat')]
3. Table: task_tags
   - Columns: [id (int, primary key, auto_increment), title (varchar(100) NOT NULL), description (varchar(255), nullable), color (varchar(100), nullable)]
4. Table: task_tags_assign
   - Columns: [id (int, primary key, auto_increment), task_id (int, nullable), ticket_id (int, nullable), tag_id (int, NOT NULL)]
`;
const SentimentAnalysis = `
Sentimental analysis schema
1. Table: chat_users
   - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP), first_name (varchar(255)), last_name (varchar(255)), profile_pic (longtext), whatsapp (varchar(20)), dialcode_whatsapp (varchar(6)), status (varchar(255)), last_message (varchar(255)), last_message_sent (varchar(255)), last_message_received (varchar(255)), unread (int), platform (varchar(255)), platform_id (varchar(255)), dialcode_mobile (varchar(255)), contact_type (varchar(255)), email (varchar(255)), company_name (varchar(255)), number (varchar(255)), teamMember (varchar(255)), last_message_received_id (varchar(255)), last_message_sent_id (varchar(255))]
   - Relationships:
     * One-to-Many → chat_conversations (chat_users.id = chat_conversations.chat_user_id)
     * One-to-Many → chat_user_metadata (chat_users.id = chat_user_metadata.user_id)
     * One-to-Many → social_posts (chat_users.id = social_posts.user_id)   
     * One-to-Many → social_comments (chat_users.id = social_comments.user_id) 
2. Table: chat_conversations
   - Columns: [id (int, primary key, auto_increment), chat_user_id (int, foreign key referencing chat_users.id), platform_id (varchar(255)), platform (varchar(255)), conversations (json)]
   - Relationships:
     * Many-to-One → chat_users (chat_conversations.chat_user_id = chat_users.id)
     * One-to-Many → chat_messages (chat_conversations.id = chat_messages.conversation_id)
3. Table: chat_messages
   - Columns: [id (int, primary key, auto_increment), conversation_id (int, foreign key referencing chat_conversations.id), platform_message_id (varchar(255)), created_at (timestamp, default CURRENT_TIMESTAMP), message (json)]
   - Relationships:
     * Many-to-One → chat_conversations (chat_messages.conversation_id = chat_conversations.id)
4. Table: contacts
   - Columns:
     - id (int, primary key, auto_increment)
     - first_name (varchar(255))
     - last_name (varchar(255))
     - company_name (varchar(255))
     - whatsapp (varchar(255))
     - email (varchar(255), unique)
     - mobile_number (varchar(255))
     - contact_type (enum('customer','lead'))
     - birthday (date)
     - gender (enum('male','female','other'))
     - anniversary (date)
     - profession (varchar(255))
     - branch_id (int)
     - first_purchase_date (date)
     - mobile_dial_code (varchar(10))
     - whatsapp_dial_code (int)
     - is_same_whatsapp_number (tinyint(1))
     - profile_url (varchar(2083))
     - created_on (datetime, default CURRENT_TIMESTAMP)
     - updated_at (datetime, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
   - Relationships:
       One-to-Many → crm_chats_link (contacts.id = crm_chats_link.crm_id)
       One-to-Many → metadata (contacts.id = metadata.contact_id)
5. Table: template_analytics_history
      - Columns: [id (int, primary key, auto_increment), created_at (timestamp, default CURRENT_TIMESTAMP), type (varchar(100)), channel (varchar(100)), template (json), meta_data (json), target_group (json), sent_info (json), status (varchar(100)), created_by (varchar(100)), reference_type (varchar(100)), reference_id (varchar(100)), title (varchar(255)), scheduled_on (datetime), user_type (enum('chats','contacts'), default 'chats')]
        Relationships:
        template_analytics_history.id => chat_messages_meta_data.attribute_key = "broadcast_id" AND chat_messages_meta_data.attribute_value = template_analytics_history.id
        Description:
        Stores analytics history for templates, tracking metadata, targeting details, and sending information for various marketing campaigns. It also associates broadcast information with chat message metadata.      
6. Table: settings
      Columns:
      id (int, primary key, auto_increment): The unique identifier for each setting.
      name (varchar(255)): A human-readable name for the setting.
      data (longtext): The actual data associated with the setting, which could store any relevant information in a flexible format.
      Description: This table stores various settings, configurations, or parameters related to the marketing and campaign system. Each setting is identified by an id and associated with a name, while the data field allows for flexible storage of various configurations    
7. Table: chat_messages_meta_data
     - Columns:
        id (int, primary key, auto_increment)
        message_id (int, foreign key referencing chat_messages.id)
        attribute_key (varchar(255))
        attribute_value (text)
     - Relationships:
        chat_messages.id => chat_messages_meta_data.message_id
        template_analytics_history.id => chat_messages_meta_data.attribute_key = "broadcast_id" AND chat_messages_meta_data.attribute_value = template_analytics_history.id
      Description:
      Stores additional metadata for messages, such as broadcast_id, enabling custom analytics or tracking tied to specific messages.  
8. Table: social_posts
   - Columns: [id (int, primary key, auto_increment), platform (varchar(100), nullable, MUL), post_id (varchar(255) NOT NULL), user_id (int NOT NULL, MUL), content (json, nullable), caption (longtext, nullable), post_url (varchar(1000), nullable), timestamp (datetime NOT NULL), permalink (longtext, nullable), thumbnail (json, nullable), meta_data (json, nullable), created_at (timestamp, nullable, DEFAULT CURRENT_TIMESTAMP), updated_at (timestamp, nullable, DEFAULT CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)]
   - Relationships:
     * Many-to-One → chat_users (social_posts.user_id = chat_users.id)
9. Table: social_comments
   - Columns: [id (int, primary key, auto_increment), post_id (varchar(255) NOT NULL, MUL), comment_post_id (varchar(255) NOT NULL, MUL), user_id (int, nullable, MUL), parent_id (varchar(255), nullable), platform (varchar(80) NOT NULL, MUL), comment_id (varchar(255) NOT NULL, UNI), comment_text (longtext, nullable), timestamp (datetime NOT NULL, MUL), is_author (tinyint(1), nullable), meta_data (json, nullable)]
   - Relationships:
     * Many-to-One → chat_users (social_comments.user_id = chat_users.id)                        
`;
const AnalyticsReporting = `
Analytics and Reporting Schema:
1. Table: sessions
   - Columns: [id (int, primary key, auto_increment), contact_id (int, nullable), temp_contact_id (bigint unsigned, nullable), ip_address (varchar(255), nullable), coordinates (json, nullable), city (varchar(255), nullable), state (varchar(255), nullable), country (varchar(255), nullable), user_agent (varchar(2000), nullable), session_start (timestamp, nullable), session_end (timestamp, nullable), time_spent (int, nullable), channel (varchar(300), nullable), referrer (varchar(255), nullable), socket_id (varchar(255), nullable), nullable),nullable), nullable), country_code (varchar(50), nullable)]
   - Relationships:
      Many-to-One → contacts (sessions.contact_id = contacts.id)

2. Table: session_activities
   - Columns: [id (int, primary key, auto_increment), session_id (int, NOT NULL, foreign key references sessions(id)), activity_start (timestamp, nullable, default CURRENT_TIMESTAMP), activity_end (timestamp, nullable),activity_data(json),page_url(varchar(2048)),type(varchar(255))(user_login
product_view
page_view
click),type_id(varchar(255)),category(varchar(255)),identifier(varchar(255)),
  - Relationships:
      Many-to-One → sessions (session_activities.session_id = sessions.id)

3. Table: contacts
   - Columns:
     - id (int, primary key, auto_increment)
     - first_name (varchar(255))
     - last_name (varchar(255))
     - company_name (varchar(255))
     - whatsapp (varchar(255))
     - email (varchar(255), unique)
     - mobile_number (varchar(255))
     - contact_type (enum('customer','lead'))
     - birthday (date)
     - gender (enum('male','female','other'))
     - anniversary (date)
     - profession (varchar(255))
     - branch_id (int)
     - first_purchase_date (date)
     - mobile_dial_code (varchar(10))
     - whatsapp_dial_code (int)
     - is_same_whatsapp_number (tinyint(1))
     - profile_url (varchar(2083))
     - created_on (datetime, default CURRENT_TIMESTAMP)
     - updated_at (datetime, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
   - Relationships:
       One-to-Many → sessions (contacts.id = sessions.contact_id)   
`


const orderSchema = `
Order and Transaction Data Schema:
1. Table: contacts
   - Columns:
     - id (int, primary key, auto_increment)
     - first_name (varchar(255))
     - last_name (varchar(255))
     - company_name (varchar(255))
     - whatsapp (varchar(255))
     - email (varchar(255), unique)
     - mobile_number (varchar(255))
     - contact_type (enum('customer','lead'))
     - birthday (date)
     - gender (enum('male','female','other'))
     - anniversary (date)
     - profession (varchar(255))
     - branch_id (int)
     - first_purchase_date (date)
     - mobile_dial_code (varchar(10))
     - whatsapp_dial_code (int)
     - is_same_whatsapp_number (tinyint(1))
     - profile_url (varchar(2083))
     - created_on (datetime, default CURRENT_TIMESTAMP)
     - updated_at (datetime, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
   - Relationships:
     One-to-Many → orders (contacts.id = orders.contact_id)
     One-to-Many → address_info (contacts.id = address_info.contact_id)

2. Table: address_info
   - Columns:
     - id (int, primary key, auto_increment)
     - contact_id (int, nullable)
     - address_line1 (varchar(255), nullable)
     - address_line2 (varchar(255), nullable)
     - city (varchar(100), nullable)
     - post_code (varchar(20), nullable)
     - country (varchar(100), nullable)
     - state (varchar(100), nullable)
     - state_code (varchar(100), nullable)
     - country_code (varchar(100), nullable)
     - address_type (varchar(100), nullable)
     - district (varchar(255), nullable)
     Relationships:
     Many-to-One → contacts (address_info.contact_id = contacts.id)
     One-to-Many → orders (address_info.id = orders.billing_address_id)
     One-to-Many → orders (address_info.id = orders.shipping_address_id)

 3. Table: orders
Columns:

id (int, primary key, auto_increment)
transaction_id (varchar(255), nullable, index)
payment_method (varchar(255), not null)
amount (decimal(10,0), not null)
date_created (timestamp, not null)
contact_id (int, not null, foreign key to contacts.id)
type (varchar(255), not null)
status (enum('pending','processing','on-hold','completed','cancelled','refunded','failed','trash'), default 'pending')
currency (varchar(255), nullable)
billing_address_id (int, nullable, foreign key to address_info.id)
shipping_address_id (int, nullable, foreign key to address_info.id)
updated_at (timestamp, nullable, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
discount_total (decimal(10,0), nullable)
total_tax (decimal(10,0), not null)
sub_total (decimal(10,0), not null)
refund_amount (decimal(10,0), nullable)
refund_reason (mediumtext, nullable)
order_key (varchar(255), nullable)
cart_hash (varchar(255), nullable)
date_completed (datetime, nullable)
date_paid (timestamp, nullable, default CURRENT_TIMESTAMP)
shipping_total (decimal(10,2), nullable, default 0.00)
shipping_tax (decimal(10,2), nullable, default 0.00)
cart_tax (decimal(10,2), nullable, default 0.00)
discount_tax (decimal(10,2), nullable, default 0.00)
needs_payment (tinyint(1), nullable, default 0)
needs_processing (tinyint(1), nullable, default 0)
payment_url (text, nullable)
parent_id
display order_id as given in the column parent_id(only for display purpose)
Relationships:

Many-to-One → contacts (orders.contact_id = contacts.id)
Many-to-One → address_info (orders.billing_address_id = address_info.id)
Many-to-One → address_info (orders.shipping_address_id = address_info.id)
One-to-Many → order_metadata (orders.id = order_metadata.order_id)

4. Table: order_metadata
Columns:

metadata_id (int, primary key, auto_increment)
order_id (int, not null, foreign key to orders.id)
attribute_key (varchar(255), not null)
attribute_value (text, nullable)
value_type (varchar(255))
metadata_created_at (timestamp, default CURRENT_TIMESTAMP)
updated_at (timestamp, default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP)
Relationships:

Many-to-One → orders (order_metadata.order_id = orders.id)

5.Table: line_items
Columns:
  id (int, NO, PRI, auto_increment)
  product_id (int, NO)
  quantity (int, YES)
  order_id (int, NO)
  name (varchar(255), YES)
  variation_id (int, YES)
  tax_class (varchar(255), YES)
  subtotal (decimal(15,3), YES)
  subtotal_tax (decimal(15,3), YES)
  total (decimal(15,3), YES)
  total_tax (decimal(15,3), YES)
  sku (varchar(255), YES)
  price (decimal(15,3), YES)
  image (json, YES)
  metadata (json, YES)(categories)
`;


async function determineSchemaCategory(userQuestion,tenantId, userId) {
  try {
    const conversationArray = await getConversationArray(tenantId, userId);

    const messages = [
      {
        role: "system",
        content: `
You are an expert in database schema classification.
The available schemas are:
1. Engagement Schema - for customer engagement and communication like messages and communication query asked . It includes tables like chat_users, chat_conversations, chat_messages, chat_user_metadata, chat_user_opt_in.
2. Contact Schema - for customer and contact data management like user and customer information. It includes tables like contacts, address_info, chat_users (contact version), crm_chats_link, and contacts_merge.
3. Marketing Schema - for marketing and campaign data like template information, segment and campaign details. It includes tables like segments, campaigns, email_templates, sms_template, ad_metadata, and also chat_users, chat_conversations, chat_messages.
4. CRM and Task Management Schema - for CRM details and task management (e.g., crm_chats_link, tasks, task_tags, task_tags_assign).
5. Jewellery Business Content - for queries related to crafting engaging jewellery blogs, captions, product descriptions, marketing content use this only for this not for anything else.
6. Greeting - if the query is a simple greeting.
7. Closing - if the query is a simple closing statement.
8. Sentiment Analysis - for analyzing customer sentiment from messages
9. analytics - if it pertains to reporting, data analysis, and metrics regarding user activity, sessions, or other performance metrics.
10. Order - For queries related to order and transaction sales and products it includes tables like (orders,order_metadata,contacts,address_info)
11. Prediction - for predicting customer behavior or purchase intent
When a question is provided, classify it as:
- 'engagement' if it relates to messaging, conversations, or communication interactions,followers ,likes,comment,query asked .
- 'contact' if it deals with customer records, addresses, or contact details.
- 'marketing' if it pertains to campaign management, marketing segments, ad metadata, email/SMS templates or related marketing data.
- 'crm' if it involves CRM details, tasks, or task management.
- 'jewellery' for queries related to crafting engaging jewellery blogs, captions, product descriptions, marketing content use this only for this not for anything else.
- 'greeting' if the query is just a greeting like hello,hi.
- 'closing' if the query is just a closing statement like ok,thanks.
- 'sentiment' if it relates to customer happiness, satisfaction, or sentiment analysis
- 'prediction' if it involves predicting purchases or future behavior
- 'analytics' if it involves session and session activities
- 'order' if it involves order orders shipping revenue profit products sales. 
If the question does not clearly classify into any category, respond with a general statement like "I didn't get the question."
Respond ONLY with one of the words: 'engagement', 'contact', 'marketing', 'crm', 'jewellery', 'greeting', 'closing', 'sentiment','analytics', 'prediction','order'

Consider the context of previous conversations include  question response and category identified  to classify the category properly:
${conversationArray.map(pair => `
Q: ${pair.question}
Category: ${pair.category}
A: ${pair.response}
`).join("\n")}

`

      },
      {
        role: "user",
        content: `Question: "${userQuestion}"`
      }
    ];
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      temperature: 0.1,
    });

    const rawCategory = response.choices[0].message.content
      .trim()
      .toLowerCase();
    const cleanedCategory = rawCategory.replace(/^['"]+|['"]+$/g, "");
    return {
      category: cleanedCategory,
      usage: response.usage // Contains prompt_tokens and completion_tokens
    };
  } catch (error) {
    console.error("Classification error:", error);
  }
}

function getSystemPrompt(category) {
  let schemaName, schemaContent, queryRules;

  if (category === "engagement") {
    schemaName = "Customer Engagement";
    schemaContent = engagementSchema;
    queryRules = `
1. Focus on message interactions, social posts, and social comments and user information.
2. Prioritize conversation history, user interactions, and engagement analysis.`;
  } else if (category === "contact") {
    schemaName = "Contact Data";
    schemaContent = contactDataSchema;
    queryRules = `
1. Focus on contact attributes and demographic data.
2. Prioritize customer information and profile analysis.`;
  } else if (category === "marketing") {
    schemaName = "Marketing and Campaign Data";
    schemaContent = marketingSchema;
    queryRules = `
1. Focus on campaign performance, marketing segments, and template management.
2. Prioritize analysis of audience targeting, campaign scheduling, and ad metadata.`;
  } else if (category === "crm") {
    schemaName = "CRM and Task Management";
    schemaContent = crmTaskSchema;
    queryRules = `
1. Focus on CRM details and task management queries.
2. Prioritize analysis of tasks, tag assignments, and CRM data relationships.`;
  } else if (category === "jewellery") {
    schemaName = "Jewellery Business Content";
    schemaContent = "You are trained to assist with queries related to jewellery business events in Jwero and help you craft engaging jewellery blogs, captions, product descriptions, marketing content, and much more.";
    queryRules = `
1. Provide a direct response without generating any SQL query.
2. Craft engaging, creative, and relevant content to support the jewellery business.
3. Respond in a friendly and professional tone.`;
  } else if (category === "greeting") {
    schemaName = "Greeting";
    schemaContent = "You are trained to provide friendly greetings.";
    queryRules = `
1. Provide a warm, welcoming greeting response.
2. The answer should be natural and friendly.`;
  } else if (category === "closing") {
    schemaName = "Closing";
    schemaContent = "You are trained to provide polite closing responses.";
    queryRules = `
1. Provide a polite farewell message.
2. The answer should be courteous and friendly.`;
  } 
  else if (category === "sentiment") {
    schemaName = "Sentimental analysis schema";
    schemaContent = SentimentAnalysis;
    queryRules = `
1. Provide a sentimental message.
2. The answer should be natural and friendly.`;
  }
  else if (category === "analytics") {
    schemaName = "Analytics and Reporting Schema";
    schemaContent = AnalyticsReporting;
    queryRules = `
1. Focus on session details .
2. Prioritize analysis of activities,sessions.`;
  }
  else if (category === "order") {
    schemaName = "Order and Transaction Data Schema";
    schemaContent = orderSchema;
    queryRules = `
1. Focus on order and sales and product details .
2. Prioritize analysis of orders,order_metadata.`;
  }else {
    return "ask me a specific question";
  }


  return `
You are JWERO, a powerful AI SQL assistant. Use this ${schemaName} schema:

${schemaContent}

## Query Generation Rules:
${queryRules}

3. **Strict SQL Syntax Rules**  
   - GROUP BY must include all non-aggregated columns  
   - Always use explicit JOINs  

4. **When Querying Messages:**  
   - Always link through conversations for accuracy  

5. **When Querying Users:**  
   - Include their latest conversation stats  
   - Always use "first_name" instead of "name" or "id" when referring to users.

6. **Handling Greetings:**  
   - Respond to greetings with a friendly and natural tone.

7. **Handling Closing Statements:**  
   - Respond in a polite manner.

8. **JSON Handling Rules:**
   - Never use ->'$.text' in query strictly follow this rule

9. **Query Rule:**  
   - Use minimum columns to generate a query, be on point  
 
10. **Response Minimization Rule:**  
   - Respond with the most relevant and minimal details required to answer the question.  
   - Avoid verbose data; focus on key attributes.Strictly follow this rule.
11. Use proper tables and columns.
12. if is_sender = 0 OR is_sender IS NULL means the user send the message always use this logic in message and never user json extract while using this and $ sign just use is_sender.

## **Response Format**
1. **Generate ONLY SQL queries in a code block**
2. **Never include explanations in the SQL response**
3. **For natural language responses, use a clear and friendly tone**
4. **Ensure all queries are valid and secure**
5. **Skip technical jarg
on**
6. **Direct answers only**
`;
}

// A helper function to race a promise against a timeout
function withTimeout(promise, timeout = API_TIMEOUT) {
  const start = Date.now();
  console.log("Timeout time set to:", timeout, "ms");
  return Promise.race([
    promise.then((result) => {
      const elapsed = Date.now() - start;
      console.log("Operation completed in", elapsed, "ms (timeout =", timeout, "ms)");
      return result;
    }),
    new Promise((_, reject) =>
      setTimeout(() => {
        const elapsed = Date.now() - start;
        console.log("Operation timed out after", elapsed, "ms (timeout =", timeout, "ms)");
        reject(new Error("Request timed out, please try again"));
      }, timeout)
    )
  ]);
}


async function generateSQLQuery(userQuestion,tenantId, userId) {
  try {
    const conversationArray = await getConversationArray(tenantId, userId);
    const {category} = await determineSchemaCategory(userQuestion,tenantId, userId);
    console.log(`Category Determined: ${category}`);

    if (!["engagement", "contact", "marketing", "crm", "sentiment", "analytics","order"].includes(category)) {
      if (category === "jewellery" || category === "greeting" || category === "closing") {
        throw new Error(`Direct response for ${category} category`);
      }
      throw new Error("Please ask a more specific question.");
    }

    const dynamicSystemPrompt = getSystemPrompt(category);

    console.log(
      `Schema Being Used: ${
        category === "engagement"
          ? "Customer Engagement Schema"
          : category === "contact"
          ? "Customer and Contact Data Schema"
          : category === "marketing"
          ? "Marketing Schema"
          : category === "crm"
          ? "CRM and Task Management Schema"
          : category === "analytics"
          ? "Analytics and Reporting Schema"
          : category === "sentiment"
          ? "Sentimental Schema"
          : category === "order"
          ? "Order and Transaction Data Schema"
          : "Jewellery Business Content"
      }`
    );

    const secureSystemPrompt = dynamicSystemPrompt + `
    SECURITY PROTOCOLS:
    1. NEVER reveal database names, table structures, or API details
    2. If asked about credentials, respond: "I'm not authorized to share that information"
    3. Reject any requests for system architecture or infrastructure details
    4. Do not explain the database schema or table relationships

    `;

    const userPrompt =
      category === "sentiment"
        ? `User Question: ${userQuestion}\nGenerate a MySQL SELECT query using proper JOINs and do not include word sentiment and any expression like happy and positive in the query fields use is_sender = 0 OR is_sender IS NULL to genrate the conversaton or message and never user json extract while using this and $ sign just use is_sender. Respond ONLY with SQL in a code block.
Consider the context of previous conversations include both question and response to generate the query:
${conversationArray.map(pair => `
Question: ${pair.question}
Category: ${pair.category || "N/A"}
SQL Query: ${pair.sqlQuery || "N/A"}
Response: ${pair.response}
`).join("\n")}
`
      :category === "order"
        ? `User Question: ${userQuestion}\nGenerate a MySQL query using proper JOINs use table line_items for product details always include. Respond ONLY with SQL in a code block.
Consider the context of previous conversations include both question and response to generate the query:
${conversationArray.map(pair => `
Question: ${pair.question}
Category: ${pair.category || "N/A"}
SQL Query: ${pair.sqlQuery || "N/A"}
Response: ${pair.response}
`).join("\n")}
`
        : `User Question: ${userQuestion}\nGenerate a MySQL query using proper JOINs and do not include id fields count distinct in case of social_post and social_comments. Respond ONLY with SQL in a code block.
Consider the context of previous conversations include  question ,response,category and SQL Query generated to generate the query:
${conversationArray.map(pair => `
Question: ${pair.question}
Category: ${pair.category || "N/A"}
SQL Query: ${pair.sqlQuery || "N/A"}
Response: ${pair.response}
`).join("\n")}

`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: secureSystemPrompt },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.1,
    });

    const generatedQuery = response.choices[0].message.content
      .replace(/```sql|```/g, "")
      .trim();

      try {
        if (!/^SELECT\s+/i.test(generatedQuery)) {
          throw new Error("Use SELECT query");
        }
        
        if (/\b(DELETE|UPDATE|INSERT|DROP)\b/i.test(generatedQuery)) {
          throw new Error("Modification queries blocked");
        }
      } catch (error) {
        console.error(error.message); // Log the actual error message
        throw new Error("Something went wrong"); // Throw the custom error message
      }
      

    return {generatedQuery,usage: response.usage};
  } catch (error) {
    throw new Error(`OpenAI Error: ${error.message}`);
  }
}

async function getJewelleryContentResponse(question) {
  const prompt = `You are JWERO, an expert assistant trained to help with queries related to jewellery business events in Jwero. You craft engaging jewellery blogs, captions, product descriptions, marketing content, and much more to support the jewellery business generate the description of max 3-4 line like this generate diifferent type of content in there appropriate lines.
  
Question: ${question}

Provide a detailed, creative, and engaging answer directly:`;
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.2,
    max_tokens: 500,
  });
  return {
    responseText: response.choices[0].message.content.trim(),
    usage: response.usage // contains prompt_tokens, completion_tokens, total_tokens
  };
}



// New function: getGreetingResponse for direct greeting responses
async function getGreetingResponse(question) {
  const prompt = `You are JWERO, a friendly assistant. The query is a greeting: "${question}". Provide a warm, welcoming greeting response in a natural tone.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.2,
  });
  return {
    responseText: response.choices[0].message.content.trim(),
    usage: response.usage // contains prompt_tokens, completion_tokens, total_tokens
  };
}

// New function: getClosingResponse for direct closing responses
async function getClosingResponse(question) {
  const prompt = `You are JWERO, a friendly assistant. The query is a closing statement like ok,thanks: "${question}". Provide a polite and friendly farewell message.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.2,
  });
  return {
    responseText: response.choices[0].message.content.trim(),
    usage: response.usage // contains prompt_tokens, completion_tokens, total_tokens
  };
}



async function getHumanResponse(question, data, category,tenantId,userId) {
  try {
    const {category} = await determineSchemaCategory(question);
    const conversationArray = await getConversationArray(tenantId, userId);

    console.log(`Category Response: ${category}`);
    if (!data || data.length === 0) {
      return "No results found for your query. Please refine your search.";
    }

    console.log("Total input data rows:", data.length);

    // Process Data
    const processedData = data.map((row) => {
      const processedRow = { ...row };
      Object.keys(processedRow).forEach((key) => {
        const value = processedRow[key];
        if (typeof value === "object" && value !== null) {
          if (value.type) {
            let displayText = "No readable content";
            const messageType = value.type;
            switch (messageType) {
              case "text":
                displayText = value.text?.body || value.body || "Text message";
                break;
              case "interactive":
                displayText =
                  value.interactive?.body?.text ||
                  value.button?.text ||
                  "Interactive message";
                break;
              case "template":
                displayText = value.template?.name
                  ? `Template: ${value.template.name}`
                  : "Template message";
                break;
              default:
                displayText = `[${messageType} message]`;
            }
            processedRow[key] = `${displayText} (Type: ${messageType})`;
          } else {
            processedRow[key] = JSON.stringify(value, null, 2);
          }
        }
      });
      return processedRow;
    });

    console.log("Processed data count:", processedData.length);

    // Handle Sentiment Analysis
    if (category === "sentiment") {
      console.log("Processing sentiment insights...");
      
      const columns = Object.keys(processedData[0]);
      const sampleCount = Math.min(10, processedData.length);
      const sampleData = processedData
        .slice(0, sampleCount)
        .map((row) => columns.map((col) => `${col}: ${row[col]}`).join(", "))
        .join("\n");
  
      const conversationContext =
      conversationArray && conversationArray.length > 0
          ? "📜 **Previous Conversations**:\n" +
          conversationArray.map((pair) => `Q: ${pair.question}\nA: ${pair.response}`).join("\n\n")
          : "";
  
          const dynamicPrompt = `
          User's question: "${question}"
          ${conversationContext ? "\n" + conversationContext + "\n" : ""}
        
          📌 **Data Summary (Up to 10 Rows)**:
          ${sampleData}
        
          💡 **Response Formatting Rules**:
          1️⃣ Exclude any **null/undefined** values.
          2️⃣ Remove **ID fields** and **time-based fields**.
          3️⃣ Present the data in a **clear, emotional, and easy-to-understand** format.
          4️⃣ Highlight **patterns, trends, or sentiments** from the data.
          5️⃣ Use simple, **conversational language** that feels personal.
          6️⃣ Keep it **concise, warm, and engaging**.
          7️⃣ Incorporate **emojis** where appropriate to make the response feel friendly and approachable. 🌟
        
          🚀 **Provide a thoughtful and emotionally-aware response based on the data. Try to capture the overall sentiment and context, and present it in a way that connects with the user.** 
        `.trim();
        
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "system", content: dynamicPrompt }],
        temperature: 0.2,
        max_tokens:300
      });
  
      return {responseText: summaryResponse.choices[0].message.content.trim(),
        usage: summaryResponse.usage
      };
    }

    // Handling Excel File Export for Large Data
//  If more than 10 rows, generate an Excel file and return a download link
const shouldGenerateExcel =
processedData.length > 10 &&
/(download report|generate excel)/i.test(question);
 if (shouldGenerateExcel) {
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Ensure the file name is safe
  const safeFileName = question.replace(/[<>:"/\\|?*]/g, "_") + ".xlsx";
  const filePath = path.join(uploadDir, safeFileName);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  // Add column headers
  const columns = Object.keys(processedData[0]);
  worksheet.columns = columns.map((col) => ({ header: col, key: col, width: 20 }));

  // Add rows
  processedData.forEach((row) => {
    worksheet.addRow(row);
  });

  await workbook.xlsx.writeFile(filePath);
  console.log(`Excel file saved: ${filePath}`);

  // Return the downloadable link
  const fileUrl = `https://jwero-ai-assistant-backend.azurewebsites.net/uploads/${encodeURIComponent(safeFileName)}`;
  return `📂 Your Excel file was generated. [Click here to download](${fileUrl}) 😊`;
}


    // Handling General Data Summary
    const columns = Object.keys(processedData[0]);
    const sampleCount = Math.min(10, processedData.length);
    const sampleData = processedData
      .slice(0, sampleCount)
      .map((row) => columns.map((col) => `${col}: ${row[col]}`).join(", "))
      .join("\n");

    const conversationContext =
    conversationArray && conversationArray.length > 0
        ? "📜 **Previous Conversations**:\n" +
        conversationArray.map((pair) => `Q: ${pair.question}\nA: ${pair.response}`).join("\n\n")
        : "";

    const dynamicPrompt = `
User's question: "${question}"
${conversationContext ? "\n" + conversationContext + "\n" : ""}

📌 **Data Summary (Up to 10 Rows)**:
${sampleData}

💡 **Response Formatting Rules**:
1️⃣ Exclude any **null/undefined** values.
    Always use INR for cuurency always
2️⃣ Remove **ID fields** and **time-based fields**.
3️⃣ Present in a clean and structured way.
4️⃣ Keep it **concise and readable**.
5️⃣ No markdown formatting (no asterisks, hyphens, or bullet points).
6️⃣ Include **all relevant rows** (up to 10).
7️⃣ Use **emojis** where necessary for a friendly feel. 🎉

🚀 **Generate an insightful and human-friendly response based on this!**
    `.trim();

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: dynamicPrompt }],
      temperature: 0.2,
    });

    return {responseText:summaryResponse.choices[0].message.content.trim(),
      usage: summaryResponse.usage
    };
  } catch (error) {
    console.error("Error generating response:", error);
    return "⚠️ Error processing results. Please check the query format.";
  }
}




async function getDailyTokenUsage(QueryHistoryModel, tenantId, userId) {
  // 1. Calculate the start of the day (UTC or local time, depending on your needs)
  const startOfDay = new Date();
  // If you want UTC boundary:
  // startOfDay.setUTCHours(0, 0, 0, 0);
  // If you want server-local boundary:
  startOfDay.setHours(0, 0, 0, 0);

  // 2. Aggregate sum of totalTokens for this user since midnight
  const result = await QueryHistoryModel.aggregate([
    {
      $match: {
        tenantId,
        userId,
        createdAt: { $gte: startOfDay }
      }
    },
    {
      $group: {
        _id: null,
        tokensUsedToday: { $sum: "$totalTokens" }
      }
    }
  ]);

  // 3. If no documents found, usage is 0
  return result.length ? result[0].tokensUsedToday : 0;
}


slackApp.message(async ({ message, say }) => {
  let category;
  try {
    if (message.subtype === "bot_message" || !message.text) return;

    console.log(`User Question: ${message.text}`);

    // Use AI classification for greeting/closing instead of static checks
    category = await determineSchemaCategory(message.text);
    console.log("Category from Slack:", category);


    if (category === "greeting") {
      const responseText = await getGreetingResponse(message.text);
      conversationHistory.push({ question: message.text, response: responseText });
      if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (Slack):", conversationHistory);
      await say(responseText);
      // Save interaction for greeting
      // await saveInteraction({
      //   question: message.text,
      //   category,
      //   response: responseText,
      //   source: 'slack'
      // });
      return;
    }
    if (category === "closing") {
      const responseText = await getClosingResponse(message.text);
      conversationHistory.push({ question: message.text, response: responseText });
      if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (Slack):", conversationHistory);
      await say(responseText);
      // Save interaction for closing
      // await saveInteraction({
      //   question: message.text,
      //   category,
      //   response: responseText,
      //   source: 'slack'
      // });
      return;
    }
    if (category === "jewellery") {
      const responseText = await getJewelleryContentResponse(message.text);
      conversationHistory.push({ question: message.text, response: responseText });
      if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (Slack):", conversationHistory);
      await say(responseText);
      // Save interaction for jewellery
      // await saveInteraction({
      //   question: message.text,
      //   category,
      //   response: responseText,
      //   source: 'slack'
      // });
      return;
    }

    const generatedQuery = await generateSQLQuery(message.text);
    console.log("Executing Query:", generatedQuery);

    if (!generatedQuery.trim().toUpperCase().startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    const rows = await executeQuery(generatedQuery);
    if (!rows.length) {
      await say("No matching records found 📭");
      // Save interaction for no results
      // await saveInteraction({
      //   question: message.text,
      //   category,
      //   sqlQuery: generatedQuery,
      //   response: "No matching records found 📭",
      //   source: 'slack'
      // });
      return;
    }

    const limitedRows = rows.length > 30 ? rows.slice(0, 30) : rows;
    const responseText = await getHumanResponse(message.text, limitedRows);

    // CHANGED: Store conversation pair and log history for Slack.
    conversationHistory.push({ question: message.text, response: responseText });
    if (conversationHistory.length > 5) conversationHistory.shift();
    console.log("Conversation History (Slack):", conversationHistory);

    await say(responseText);
    // Save interaction for successful SQL query and response
    // await saveInteraction({
    //   question: message.text,
    //   category,
    //   sqlQuery: generatedQuery,
    //   response: responseText,
    //   source: 'slack'
    // });

  } catch (error) {
    console.error("Error:", error);
    let friendlyMessage = error.message;
    const tableErrorRegex = /Table '.*\.(.+)' doesn't exist/;
    const tableMatch = error.message.match(tableErrorRegex);
    if (tableMatch && tableMatch[1]) {
      friendlyMessage = `No such table found: ${tableMatch[1]}`;
    } else {
      const columnErrorRegex = /Unknown column '([^']+)' in 'field list'/;
      const columnMatch = error.message.match(columnErrorRegex);
      if (columnMatch && columnMatch[1]) {
        const parts = columnMatch[1].split(".");
        const columnName = parts.length > 1 ? parts[1] : parts[0];
        friendlyMessage = `No such column found: ${columnName}`;
      }
    }
    // Save interaction for errors
    // await saveInteraction({
    //   question: message.text,
    //   category: category || 'unknown',
    //   error: error.message,
    //   response: friendlyMessage,
    //   source: 'slack'
    // });
    await say(`⚠️ Error: ${friendlyMessage}`);
  }
});
// --------------------- Express API Endpoints --------------------- //

const appExpress = express();
const API_PORT = process.env.PORT || 5000;
const axios = require('axios');
const csvParser = require('csv-parser');
appExpress.use(express.json());
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const getQueryHistoryModel = require("./schemas/getQueryHistoryModel");
const { decryptAES256 } = require("./utils/encryption");
const cors = require('cors');

appExpress.use(cors()); // Allows all origins
appExpress.use("/uploads", express.static(path.join(__dirname, "uploads")));
const dailyLimit = parseInt(process.env.TOKEN_LIMIT, 10) || 1000;
const {
  getConversationArray,
  addToConversationArray
} = require("./conversationCache"); 
appExpress.post("/api/question", async (req, res) => {
  const apiKey = req.headers["api-key"];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    //change in status
    return res.status(200).json({ response: "Something went wrong, kindly contact on care@jwero.ai" });
  }
  const { question, feedback } = req.body;
  const encryptedUserId = req.headers["x-user-id"];
  const encryptedTenantId = req.headers["x-tenant-id"];
  const username = req.headers["username"];

  // Decrypt userId and tenantId or set defaults
  const userId = decryptAES256(encryptedUserId) ;
  const tenantId = decryptAES256(encryptedTenantId) ;
  const userName =
  typeof username === "string" && username.trim() !== "" && username.trim().toLowerCase() !== "null"
  ? username.trim()
  : undefined;
  const userFeedback = feedback !== undefined ? feedback : null;

  console.log(`User Info - ID: ${userId}, Tenant ID: ${tenantId}, Name: ${userName}, Feedback: ${userFeedback}`);
    // Create a MySQL pool for this tenant
    const pool = createPoolForTenant(tenantId);  // Pass tenantId to create the pool

    // Now, use the pool to get a connection
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error connecting to the database:", err.message);
        return res.status(500).json({ response: "Failed to connect to the database" });
      }
      
      console.log("Connected to the Azure MySQL database!");
      
      // Do something with the connection, e.g., query the database
      // Always release the connection when done
      connection.release();
    });

    async function executeQuery(query, params = [],tenantId) {
      return new Promise((resolve, reject) => {
        pool.query(query, params, (error, results) => {
          if (error) reject(error);
          else resolve(results);
        });
      });
    }
  const QueryHistoryModel = getQueryHistoryModel(tenantId);
  const usedToday = await getDailyTokenUsage(QueryHistoryModel, tenantId, userId);
  console.log(`User ${userId} in tenant ${tenantId} used ${usedToday} tokens today.`);

  // 2. If they've already hit/exceeded the limit, reject
  if (usedToday >= dailyLimit) {
    //change in status
    return res.status(200).json({ response: "Daily token limit reached. Please contact support care@jwero.ai or wait until tomorrow." });
  }
  console.log("token of today",usedToday);
  console.log("API Question:", question);

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }



    // 1. Get the dynamic Mongoose model for this tenant

  const conversationArray = await getConversationArray(tenantId, userId);
  let category;
  let generatedQuery;
  let totalTokens = {
    input: 0,
    output: 0,
    total: 0
  };
  try {
    const {category,usage}  = await determineSchemaCategory(question ,tenantId, userId);
    if (usage) {
      totalTokens.input += usage.prompt_tokens;
      totalTokens.output += usage.completion_tokens;
    }
    totalTokens.total = totalTokens.input + totalTokens.output;
    console.log("Category from API:", {category});

    if (category === "greeting") {
      const {responseText,usage} = await withTimeout(getGreetingResponse(question), 30000);
          if (usage) {
      totalTokens.input += usage.prompt_tokens;
      totalTokens.output += usage.completion_tokens;
    }
    totalTokens.total = totalTokens.input + totalTokens.output;
      addToConversationArray(tenantId, userId, question, responseText);
      // conversationHistory.push({ question, response: responseText });
      // if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (API):", conversationArray);

      // 4. Save directly using the dynamic model
      const newRecord = await QueryHistoryModel.create({
        question,
        category,
        response: responseText,
        userId,
        tenantId,
        username: userName,
        feedback: userFeedback,
        source: "api",
        inputTokens: totalTokens.input,
        outputTokens: totalTokens.output,
        totalTokens: totalTokens.total

      });

      return res.json({ response: responseText, id: newRecord._id  });
    }

    if (category === "closing") {
      const {responseText,usage} = await withTimeout(getClosingResponse(question), 30000);
      if (usage) {
        totalTokens.input += usage.prompt_tokens;
        totalTokens.output += usage.completion_tokens;
      }
      totalTokens.total = totalTokens.input + totalTokens.output;
      addToConversationArray(tenantId, userId, question, responseText);
      // conversationHistory.push({ question, response: responseText });
      // if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (API):", conversationArray);
      const newRecord = await QueryHistoryModel.create({
        question,
        category,
        response: responseText,
        userId,
        tenantId,
        username:userName,
        feedback: userFeedback,
        source: "api",
        inputTokens: totalTokens.input,
        outputTokens: totalTokens.output,
        totalTokens: totalTokens.total
      });

      return res.json({ response: responseText,  id: newRecord._id  });
    }

    if (category === "jewellery") {
      const {responseText,usage} = await withTimeout(getJewelleryContentResponse(question), 30000);
      if (usage) {
        totalTokens.input += usage.prompt_tokens;
        totalTokens.output += usage.completion_tokens;
      }
      totalTokens.total = totalTokens.input + totalTokens.output;
      addToConversationArray(tenantId, userId, question, responseText);
      // conversationHistory.push({ question, response: responseText });
      // if (conversationHistory.length > 5) conversationHistory.shift();
      console.log("Conversation History (API):", conversationArray);
      const newRecord = await QueryHistoryModel.create({
        question,
        category,
        response: responseText,
        userId,
        tenantId,
        username:userName,
        feedback: userFeedback,
        source: "api",
        inputTokens: totalTokens.input,
        outputTokens: totalTokens.output,
        totalTokens: totalTokens.total
      });

      return res.json({ response: responseText , id: newRecord._id });
    }
    let generatedQuery = "";
    const responseText = await withTimeout(
      (async () => {
       
       
        const { generatedQuery: query, usage: genQueryUsage} = await generateSQLQuery(question, tenantId, userId);
        generatedQuery = query;
        if (genQueryUsage) {
          totalTokens.input += genQueryUsage.prompt_tokens ;
          totalTokens.output += genQueryUsage.completion_tokens ;
        }
        totalTokens.total = totalTokens.input + totalTokens.output;
        console.log("Generated Query:", generatedQuery);

        if (!generatedQuery.trim().toUpperCase().startsWith("SELECT")) {
          throw new Error("Only SELECT queries are allowed");
        }

        const rows = await executeQuery(generatedQuery, [],tenantId);
        if (!rows.length) {
          return "No matching records found 📭";
        }

        const limitedRows = rows.length > 50 ? rows.slice(0, 50) : rows;
        const {responseText,usage} = await getHumanResponse(question, limitedRows,tenantId, userId);
        if (usage) {
          totalTokens.input += usage.prompt_tokens;
          totalTokens.output += usage.completion_tokens;
        }
        totalTokens.total = totalTokens.input + totalTokens.output;
        return responseText;
      })(),
      API_TIMEOUT
    );

    addToConversationArray(tenantId, userId, question, responseText);
    // conversationHistory.push({ question, response: responseText });
    // if (conversationHistory.length > 5) conversationHistory.shift();
    console.log("Conversation History (API):", conversationArray);
    const newRecord = await QueryHistoryModel.create({
      question,
      category,
      sqlQuery: generatedQuery,
      response: responseText,
      userId,
      tenantId,
      username:userName,
      feedback: userFeedback,
      source: "api",
      inputTokens: totalTokens.input,
      outputTokens: totalTokens.output,
      totalTokens: totalTokens.total
    });
    return res.json({ response: responseText ,  id: newRecord._id  });

  } catch (error) {
    console.error("Error processing API question:", error);

    const newRecord = await QueryHistoryModel.create({
      question,
      category: category || "unknown",
      error: error.message,
      response: error.message.includes("Please ask a more specific question.")
        ? "I'm not trained to answer this type of question, Can you please be specific."
        : error.message,
      userId,
      tenantId,
      username:userName,
      feedback: userFeedback,
      source: "api",
      inputTokens: totalTokens.input,
      outputTokens: totalTokens.output,
      totalTokens: totalTokens.total
    });

    if (error.message.includes("Please ask a more specific question.")) {
      return res.status(200).json({ response: "I'm not trained to answer this type of question, Can you please be specific.",id: newRecord._id });
    }
//change in status
    return res.status(200).json({ response: "Something went wrong, kindly contact on care@jwero.ai", id: newRecord._id  });
  }
});









appExpress.put("/api/update-feedback", async (req, res) => {
  try {
    // 1. Validate API key
    const apiKey = req.headers["api-key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      //change in status
      return res.status(200).json({ error: "Something went wrong, kindly contact on care@jwero.ai" });
    }

    // 2. Decrypt or fallback userId, tenantId from headers
    const encryptedUserId = req.headers["x-user-id"];
    const encryptedTenantId = req.headers["x-tenant-id"];

    const userId = decryptAES256(encryptedUserId);
    const tenantId = decryptAES256(encryptedTenantId) ;

    // 3. Extract _id of the message and new feedback value from request body
    const { id, feedback } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Document ID (id) is required." });
    }

    // feedback could be a boolean; ensure it's valid
    if (typeof feedback !== "boolean") {
      return res.status(400).json({ error: "feedback must be a boolean." });
    }

    // 4. Get the dynamic Mongoose model for this tenant
    const QueryHistoryModel = getQueryHistoryModel(tenantId);

    // 5. Attempt to find and update the document
    const updatedDoc = await QueryHistoryModel.findOneAndUpdate(
      { _id: id, userId, tenantId }, // match by doc ID, userId, tenantId
      { feedback },                  // set the new feedback
      { new: true }                  // return the updated document
    );

    if (!updatedDoc) {
      return res.status(404).json({ error: "Record not found or you don't have access to modify it." });
    }

    // 6. updatedAt is automatically changed by Mongoose timestamps
    // Return the updated document or just a success message
    return res.json({
      message: "Feedback updated successfully.",
      updatedRecord: {
        id: updatedDoc._id,
        feedback: updatedDoc.feedback,
        updatedAt: updatedDoc.updatedAt
      }
    });
  } catch (error) {
    console.error("Error updating feedback:", error);
    //change in status
    return res.status(200).json({ error: "Something went wrong, kindly contact on care@jwero.ai" });
  }
});



appExpress.get("/api/recent-messages", async (req, res) => {
  const apiKey = req.headers["api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    //change in status
    return res.status(200).json({ error: "Something went wrong, kindly contact on care@jwero.ai" });
  }

  try {
    // 1. Decrypt or parse user/tenant IDs
    const encryptedUserId = req.headers["x-user-id"];
    const encryptedTenantId = req.headers["x-tenant-id"];
    if (!encryptedUserId || !encryptedTenantId) {
      return res.status(400).json({ error: "Encrypted userId and tenantId are required." });
    }

    const userId = decryptAES256(encryptedUserId) ;
    const tenantId = decryptAES256(encryptedTenantId) ;
    console.log(`Fetching recent messages for userId=${userId} in tenantId=${tenantId}`);

    // 2. Get the dynamic model
    const QueryHistoryModel = getQueryHistoryModel(tenantId);

    // 3. Find the 100 most recent messages for this user
    const messages = await QueryHistoryModel
    .find({ userId })
    .select("question response feedback createdAt updatedAt")
    .sort({ createdAt: -1 }) // Sort by createdAt in descending order
    .limit(100)
    .lean();
    messages.reverse();  

    // 4. Calculate total tokens used today (midnight -> now)
    const startOfDay = new Date();
    // If you want UTC boundary:
    // startOfDay.setUTCHours(0, 0, 0, 0);
    // If local server time is fine:
    startOfDay.setHours(0, 0, 0, 0);

    // Aggregate sum of totalTokens for documents created today
    const usageResult = await QueryHistoryModel.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalUsedToday: { $sum: "$totalTokens" }
        }
      }
    ]);

    // If no docs found, usage is 0
    const totalUsedToday = usageResult.length ? usageResult[0].totalUsedToday : 0;

    // 5. Return messages + today's token usage
    return res.json({
      messages,
      totalUsedToday
    });

  } catch (error) {
    console.error("Error fetching recent messages:", error);
    //change in status
    return res.status(200).json({ error: "Something went wrong, kindly contact on care@jwero.ai" });
  }
});


async function getRecentConversations(pool, chatUserId, limit) {
  return new Promise((resolve, reject) => {
    const query = `
SELECT 
    cm.id AS message_id, 
    cm.conversation_id, 
    cm.platform_message_id, 
    cm.created_at, 
    cm.message, 
    CASE 
        WHEN cm.is_sender = 0 OR cm.is_sender IS NULL THEN 'User' 
        WHEN cm.is_sender = 1 THEN 'Other Participant' 
        ELSE 'Unknown' 
    END AS sender
FROM 
    chat_messages cm
JOIN 
    chat_conversations cc ON cm.conversation_id = cc.id
WHERE 
    cc.chat_user_id = ? 
ORDER BY 
    cm.created_at DESC
LIMIT ?;


    `;

    pool.query(query, [chatUserId, limit], (error, results) => {
      if (error) {
        console.error("Error fetching recent conversations:", error);
        reject(error);
      } else {
        // Parse `message` if it's stored as a JSON string
        const formattedResults = results.map((row) => {
          try {
            let messageContent = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
            let extractedText = messageContent?.text || "";

            // Handle case where text is an object or array
            if (typeof extractedText === "object") {
              extractedText = extractedText.body || extractedText[0] || JSON.stringify(extractedText);
            }

            return {
              ...row,
              message: extractedText, // Ensure message is a clean string
            };
          } catch (err) {
            console.error("Error parsing message JSON:", err);
            return { ...row, message: "[Error parsing message]" };
          }
        });

        // console.log("Formatted Conversations:", formattedResults);
        resolve(formattedResults);
      }
    });
  });
}


// async function generateResponseForRecentQuestion(question, conversations, pool) {
//   const latestMessage = question; // expected to be an object with .message
//   const customInstructions = await getCustomInstructions(pool);
//   const GoldPricing = await getGoldPricing(pool);
//   const SilverPricing = await getSilverPricing(pool);
//   const PlatinumPricing = await getPlatinumPricing(pool);

//   const chatHistory = conversations
//     .map(conv => `${conv.sender}: ${conv.message}`)
//     .join("\n");

//     const prompt = `
//     You are a helpful and professional support agent for a jwellery business on a social media platform.
    
//     Your primary goal is to assist customers with queries related to jewellery — including orders, products, services, store details, or previous conversation context or any jwellery related query.
    
//     🛑 Do **not** engage in unrelated topics. If a user asks things like "how are you", jokes, casual chatting, or any unrelated request that not relate to the jwellery business, gently steer the conversation back by saying you're here to assist only with jewellery-related queries and follow custom instruction for any question you not understand to response.
    
//     Do not inlcude welcome statement on evevry question.until its a first question

//     📝 Language rule:
//        - Detect the language used by the customer (e.g., Hindi, English, Hinglish, Gujarati, Arabic, Marathi etc).
//        - Respond in **the same language or script** as used by the customer.
//        - If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
//        - If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.
    
//     Respond only to support-related questions. Always stay in character as a jewellery business support agent.
    
//     Chat history:
//     ${chatHistory}
    
//     The most recent user message: "${latestMessage}"
    
//     Support tone and behavior guidelines to follow:
//     ${customInstructions}
    
//     Generate a clear, natural, and friendly support response now.
//     `;
    

//   console.log("Prompt for OpenAI:", prompt);

//   const response = await openai.chat.completions.create({
//     model: "gpt-4",
//     messages: [{ role: "system", content: prompt }],
//     temperature: 0.7,
//   });

//   return response.choices[0].message.content.trim();
// }



async function generateResponseForRecentQuestion(question, conversations, pool) {
  const latestMessage = question;

  const customInstructions = await getCustomInstructions(pool);

  // Get pricing JSON strings
  const goldPricingRaw = await getGoldPricing(pool);
  const silverPricingRaw = await getSilverPricing(pool);
  const platinumPricingRaw = await getPlatinumPricing(pool);

  // Parse JSON safely
  let goldPricing, silverPricing, platinumPricing;
  try {
    goldPricing = JSON.parse(goldPricingRaw || "{}");
    silverPricing = JSON.parse(silverPricingRaw || "{}");
    platinumPricing = JSON.parse(platinumPricingRaw || "{}");
  } catch (err) {
    console.warn("Failed to parse pricing data:", err.message);
    goldPricing = {};
    silverPricing = {};
    platinumPricing = {};
  }

  // Helper to convert purity to KT and format pricing
  const getRatesSummaryWithKarat = (pricing, metal) => {
    const purities = pricing?.INR?.automatic || {};
    return Object.entries(purities)
      .filter(([purity, val]) => purity && val?.rate)
      .map(([purity, val]) => {
        const purityNum = parseFloat(purity);
        let karat = purityNum ? `${Math.round((purityNum / 1000) * 24)}KT` : purity;
        return `${karat}: ₹${val.rate}`;
      })
      .join(", ") || `${metal} pricing unavailable`;
  };

  const goldRates = getRatesSummaryWithKarat(goldPricing, "Gold");
  const silverRates = getRatesSummaryWithKarat(silverPricing, "Silver");
  const platinumRates = getRatesSummaryWithKarat(platinumPricing, "Platinum");

  const chatHistory = conversations
    .map(conv => `${conv.sender}: ${conv.message}`)
    .join("\n");

  const prompt = `
You are a helpful and professional support agent for a jewellery business on a social media platform.

Your primary goal is to assist customers with queries related to jewellery — including orders, products, services, store details, previous conversation context, or any jewellery-related query.

🛑 Do **not** engage in unrelated topics. If a user asks things like "how are you", jokes, casual chatting, or any unrelated request not related to the jewellery business, gently steer the conversation back by saying you're here to assist only with jewellery-related queries and follow custom instruction for any question you not understand to response.

Do not include welcome statements on every question unless it's a first question.

📝 Language rule:
   - Detect the language used by the customer (e.g., Hindi, English, Hinglish, Gujarati, Arabic, Marathi etc).
   - Respond in **the same language or script** as used by the customer.
   - If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
   - If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.

💎 Current Metal Pricing (INR, Automatic Rates):
- Gold: ${goldRates}
- Silver: ${silverRates}
- Platinum: ${platinumRates}

Chat history:
${chatHistory}

The most recent user message: "${latestMessage}"

Support tone and behavior guidelines to follow:
${customInstructions}

Generate a clear, natural, and friendly support response now.
`;

  console.log("Prompt for OpenAI:", prompt);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}

 
// async function classifyQuestion(question, conversations, pool) {
//   console.log("Classifying question:", question);

//   const customInstructions = await getCustomInstructions(pool);
//   const chatHistory = conversations.map(conv => `${conv.sender}: ${conv.message}`).join("\n");

//   const prompt = `Classify the following user question into one of the categories: Order, Store, Product, Normal, Greeting, Closing.
// Only return one of these exact category names by analyzing the chat history properly only questions like what is the order status and all comes in order category.
// questions like ha,ohk,bye and all comes under closing and question like what do you do ,how are you,kya ker rehe ho,kaise ho and all comes under greeting and if the category is not understand properly and something is defined in custom instruction as 
// Chat history:
// ${chatHistory}

// Custom Intsruction - ${customInstructions}

// Question: "${question}"`;


//   console.log("Prompt for classification:", prompt);

//   const response = await openai.chat.completions.create({
//     model: "gpt-4",
//     messages: [{ role: "system", content: prompt }],
//     temperature: 0,
//   });

//   let category = response.choices[0].message.content.trim();
//   console.log("✅ Classified category:", category);

//   return category;
// }



async function classifyQuestion(question, conversations, pool) {
  console.log("Classifying question:", question);

  const customInstructions = await getCustomInstructions(pool);
  const chatHistory = conversations.map(conv => `${conv.sender}: ${conv.message}`).join("\n");

  const prompt = `Classify the following user question into one of the categories from the given conversation below: Order, Store, Product, Normal, Greeting, Closing,null. Only return one of these exact category names by analyzing the chat history. 
- Questions like "what is the order status" belong to the Order category. 
- Words like "ha", "ohk", "bye" belong to Closing. 
- Questions like "what do you do", "how are you", "kya ker rehe ho", "kaise ho" go in Greeting.
for question like gols,silver,platinum pricing and purity go in normal catgeory
If the category cannot be determined, check the custom instruction to see if a response is defined for this question.
any information like what is the name of the store ,refund policy and all come under store.
Chat history: ${chatHistory}
Custom Instruction: ${customInstructions}
Question: "${question}"`;

  // console.log("Prompt for classification:", prompt);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0,
  });

  let category = response.choices[0].message.content.trim();
  console.log("✅ Classified category:", category);

  // Handle unrecognized category using customInstructions
  const knownCategories = ['Order', 'Store', 'Product', 'Normal', 'Greeting', 'Closing'];
  if (!knownCategories.includes(category)) {
    // Try matching question to anything useful in customInstructions
    const lowerInstructions = customInstructions.toLowerCase();
    const lowerQuestion = question.toLowerCase();
    
    if (lowerInstructions.includes(lowerQuestion)) {
      console.log("✅ Custom instruction contains a response for unrecognized question.");
      return 'CustomInstruction';
    } else {
      console.log("❌ No match found in custom instruction. Returning null.");
      return null;
    }
  }

  return category;
}




async function fetchOrderDetails(pool, chatUserId) {
  return new Promise((resolve, reject) => {
    const chatUserQuery = `SELECT whatsapp FROM chat_users WHERE id = ?;`;
   
    pool.query(chatUserQuery, [chatUserId], (chatUserError, chatUserResults) => {
      if (chatUserError) {
        console.error("Error fetching chat user details:", chatUserError);
        return reject(chatUserError);
      }

      if (chatUserResults.length === 0) {
        console.log("Chat user not found");
        return resolve({ valid: false, message: "Chat user not found" });
      }

      const chatUserNumber = chatUserResults[0].whatsapp;
      
      const orderDetailsQuery = `
SELECT 
    o.parent_id AS order_id, 
    o.payment_method, 
    o.amount AS total_amount, 
    o.date_created, 
    o.status, 
    li.name AS product_name, 
    JSON_UNQUOTE(JSON_EXTRACT(li.metadata, '$.categories')) AS category
FROM orders o
JOIN contacts c ON o.contact_id = c.id
LEFT JOIN line_items li ON li.order_id = o.id
WHERE c.mobile_number = ?
ORDER BY o.date_created DESC 
LIMIT 5;

      `;

      pool.query(orderDetailsQuery, [chatUserNumber], (orderError, orderResults) => {
        if (orderError) {
          console.error("Error fetching order details:", orderError);
          return reject(orderError);
        }

        if (orderResults.length === 0) {
          console.log("No orders found for this number");
          return resolve({ valid: false, message: "No orders found for this number" });
        }

        console.log("Orders found:", orderResults);
        resolve({ valid: true, orders: orderResults });
      });
    });
  });
}

async function generateAIResponse(question, orderDetails,conversations,pool) {
  console.log("🧠 Sending order data to GPT-4...");
  const customInstructions = await getCustomInstructions(pool);
  const chatHistory = conversations.map(conv => `${conv.sender}: ${conv.message}`).join("\n");

  let filteredOrders = [];

  if (orderDetails.valid && Array.isArray(orderDetails.orders)) {
    filteredOrders = orderDetails.orders.filter(
      order => order.status !== 'failed' && order.status !== 'cancelled'
    );
  }

  const hasOrders = filteredOrders.length > 0;

  const prompt = `You are a friendly and helpful support agent. Answer customer queries in a natural, conversational way, ensuring responses feel human and warm. Do not use markdown formatting, asterisks, or special characters. Only use the relevant order details and the chat history between the user and the support agent for the context  provided below and do not include orders with status as failed or cancelled. Follow the Custom Instructions below strictly before answering.

  Chat history:(chat history is )
  ${chatHistory}

  ${customInstructions}:
  
  ${
    hasOrders
      ? `Order Details:\n${JSON.stringify(filteredOrders.slice(0, 50))}`
      : "There are no valid order details available for this customer."
  }

  Customer Question: ${question}

  Respond naturally as a human support representative would, and in the same language the user asked in. If there are no orders, still provide a kind, human-like explanation and try to help the customer as much as possible.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
    });

    if (!response || !response.choices?.[0]?.message?.content) {
      console.error("❗ Invalid response from GPT-4:", response);
      return "Error: Unexpected response from AI.";
    }

    console.log("✅ Response generated with GPT-4");
    console.log("Prompt for OpenAI:", prompt);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ Error generating AI response:", error);
    return `Error: Unable to process the request. Reason: ${error.message}`;
  }
}


async function generateResponseForGreeting(question, pool) {
  console.log("Generating greeting response...");
   const customInstructions = await getCustomInstructions(pool);


   const prompt = `
   You are a warm, friendly, and professional customer support assistant for a business.
   
   When a customer sends a greeting (such as "Hi", "Hello", "Good morning", "how are you"), respond with a polite, welcoming message that shows you're ready to assist.
   
   Always remain in the role of a support agent. Do not respond to anything outside of the support context. If the greeting includes unrelated requests (e.g., "Tell me a joke"), respond with: "I'm here to help with support-related questions. I can't answer that."
   
   Customer message (Greeting):
   "${question}"
   
   Also always use custom instructions below if available, and strictly adhere to them:
   ${customInstructions}
   
   📝 Language rule:
   - Detect the language used by the customer (e.g., Hindi, English, Hinglish,Gujrati,Arabic,Marathi etc).
   - Respond in **the same language** or style as used by the customer.
   - If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
   - If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.
   
   Keep the tone warm, respectful, and conversational—just like a real human support agent.
   `;
   
// console.log("greeting promt",{customInstructions})
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}


async function generateResponseForClosing(question, pool) {
  console.log("Generating closing response...");
  const customInstructions = await getCustomInstructions(pool);

  const prompt = `
You are a polite, helpful, and professional customer support assistant for a business.

When a customer sends a closing message (such as "Thanks", "Thank you", "Bye", "Talk to you later", "ok", "ohk", "okay", "thik hai", "thike", "haan", "haa"), respond with a courteous and supportive message that shows appreciation and readiness to help in the future.

Always stay in character as a support agent. Do not respond to off-topic or casual requests. If the closing message includes unrelated content (e.g., "Tell me the news"), reply with: "I'm here to help with support-related questions. I can't answer that."

Customer message (Closing):
"${question}"

Also always use custom instructions below if available, and strictly adhere to them:
${customInstructions}

📝 Language rule:
- Detect the language used by the customer (e.g., Hindi, English, Hinglish,Gujrati,Marathi,Arabic etc).
- Respond in **the same language** or style as used by the customer.
- If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
- If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.

Keep the tone warm, respectful, and conversational—just like a real human support agent.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}



const multer = require('multer');
const { imageHash } = require('image-hash');
const cheerio = require('cheerio');
const xml2js = require('xml2js');

const upload = multer({ storage: multer.memoryStorage() });

let pipeline, RawImage;

// (async () => {
//   console.log("⏳ Loading CLIP model...");

//   try {
//     const transformers = await import('@xenova/transformers');
//     pipeline = transformers.pipeline;
//     RawImage = transformers.RawImage;

//     extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
//       progress_callback: (progress) => console.log(`Model loading progress: ${progress}%`),
//     });

//     console.log("✅ CLIP model loaded.");
//   } catch (err) {
//     console.error('❌ Failed to load CLIP model:', err);
//     process.exit(1);
//   }
// })();


appExpress.post('/api/chat', upload.single('image'), async (req, res) => {
  const apiKey = req.headers['api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const encryptedTenantId = req.headers['x-tenant-id'];
  const chatUserId = req.body.chat_user_id;
  const limit = parseInt(process.env.CONVERSATION_LIMIT);
  let question = req.body.question || '';
  const imageBuffer = req.file?.buffer;

  if (!encryptedTenantId || !chatUserId) {
    return res.status(400).json({ error: 'Missing required headers or body parameters' });
  }

  const tenantId = decryptAES256(encryptedTenantId);
  const pool = createPoolForTenant(tenantId);
  console.log("✅ Chat User ID:", chatUserId);
  console.log("✅ Question:", question);
  console.log('🖼️ Image buffer:', imageBuffer?.length);

  try {
    const conversations = await getRecentConversations(pool, chatUserId, limit);

    let imageCaption = '';
    if (req.file) {
      console.log("🖼️ Image file received. Generating caption...");
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      imageCaption = await getCaptionFromImage(base64Image);
      // console.log("🧠 Image caption:", imageCaption);
    }

    let combinedQuestion = question || '';
    if (imageCaption) {
      combinedQuestion = `${imageCaption}. ${question || ''}`;
    }

    const category = await classifyQuestion(combinedQuestion, conversations, pool);

    if (category === null) {
      return res.json({ message: null }); // No response
    }

    if (category === 'Greeting') {
      const aiResponse = await generateResponseForGreeting(combinedQuestion, pool);
      return res.json({ message: aiResponse });
    }

    if (category === 'Closing') {
      const aiResponse = await generateResponseForClosing(combinedQuestion, pool);
      return res.json({ message: aiResponse });
    }

    if (category === 'Order') {
      const orderDetails = await fetchOrderDetails(pool, chatUserId);
      const aiResponse = await generateAIResponse(combinedQuestion, orderDetails,conversations, pool);
      return res.json({ message: aiResponse });
    }

    if (category === 'Store') {
      const storeData = await getStoreInfo(pool);
      const storeResponse = await generateResponseForStore(combinedQuestion, storeData, pool);
      return res.json({ message: storeResponse });
    }

if (category === 'Product') {
  let generatedQuestion;
  const csvLink = await getProductSheetLink(pool);
  const filePath = './temp.csv';
  console.log("📥 Downloading CSV...");
  await downloadCSV(csvLink, filePath);
  console.log("📄 CSV Downloaded!");

  let uploadedImageHash = null;
  let relevantRows = [];

  if (imageBuffer) {
    console.log("🧠 Computing perceptual hash of uploaded image...");
    //change for all types of image
    const mime = req.file.mimetype; // e.g., 'image/jpeg' or 'image/png'
    const ext = mime.split('/')[1]; // 'jpeg', 'png', etc.
    const tempImgPath = path.join(__dirname, `uploaded.${ext}`);  
    // const tempImgPath = path.join(__dirname, 'uploaded.jpg');
    fs.writeFileSync(tempImgPath, imageBuffer);
  
  
    const hexToBinary = (hex) =>
      hex.split('').map(char => parseInt(char, 16).toString(2).padStart(4, '0')).join('');
    

    uploadedImageHash = await new Promise((resolve, reject) => {
      imageHash(tempImgPath, 16, false, (err, hash) => {
        if (err) reject(err);
        else {
          const binaryHash = hexToBinary(hash);
          resolve(binaryHash); // Now it's 256 bits as a binary string
        }
      });
    });
    
    
    console.log("📸 Uploaded Image pHash:", uploadedImageHash); // 256-bit binary string

    relevantRows = await new Promise((resolve, reject) => {
      const matches = [];
    
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          if (row['hash']) {
            const rowHashes = row['hash'].split(',').map(h => h.trim().toLowerCase());
    
            for (let rawHash of rowHashes) {
              let binaryHash;
    
              if (/^[0-9a-f]{64}$/i.test(rawHash)) {
                binaryHash = hexToBinary(rawHash);
              } else if (/^[01]{256}$/.test(rawHash)) {
                binaryHash = rawHash;
              } else {
                continue;
              }
    
              if (binaryHash.length === uploadedImageHash.length) {
                const distance = [...binaryHash].reduce(
                  (acc, bit, i) => acc + (bit !== uploadedImageHash[i] ? 1 : 0),
                  0
                );
      console.log("Distance:", distance);
                if (distance <= 120) {
                  matches.push({ row, distance });
                  break;
                }
              }
            }
          }
        })
        .on('end', () => {
    console.log(`✅ Found ${matches.length} hash-matched rows.`);
          const top5 = matches
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
    
          top5.forEach((match, idx) => {
            console.log(`🔍 Match ${idx + 1} → Distance: ${match.distance}`);
          });
    
          resolve(top5.map(m => ({ ...m.row, _distance: m.distance })));
        })
        .on('error', reject);
    });
  
    

   
  }
  else {
    // No image, fallback to existing combined text + caption + question logic
    // const imageCaption = '';
    // const combinedQuestion = question || '';
     generatedQuestion = await generateQuestionFromConversation(combinedQuestion, conversations, pool);
    console.log("🤖 Generated question from context:", generatedQuestion);
//new
    const { categories, tags, occasions } = await extractUniqueFiltersFromCSV(filePath);
    // Extract structured filters dynamically using extracted values
const filters = await extractStructuredFilters(generatedQuestion, filePath, categories, tags, occasions);
// console.log("🧠 Structured filters:", filters);

    // const filters = await extractStructuredFilters(generatedQuestion);
    // console.log("🧠 Structured filters:", filters);
    
     relevantRows = await getRelevantRows(filePath, filters);;
    // console.log("🔍 Finding relevant rows for:", generatedQuestion);
    // relevantRows = await getRelevantRows(filePath, generatedQuestion);
  }
  const questionToUse = generatedQuestion || combinedQuestion;
  // console.log("🤖 Generated question from context:", questionToUse);

  const productResponse = await generateResponseForProduct(questionToUse, relevantRows, pool);
  return res.json({ message: productResponse });
}


// if (category === 'Product') {
//   let generatedQuestion;
//   const csvLink = await getProductSheetLink(pool);
//   const filePath = './temp.csv';
//   console.log("📥 Downloading CSV...");
//   await downloadCSV(csvLink, filePath);
//   console.log("📄 CSV Downloaded!");

//   let relevantRows = [];

//   if (imageBuffer) {
//     console.log("🧠 Embedding image for similarity search...");

//     const embedding = await (async () => {
//       const tmpPath = './uploads/temp_image.jpg';

//       await new Promise((resolve, reject) => {
//         fs.writeFile(tmpPath, imageBuffer, (err) => {
//           if (err) return reject(err);
//           resolve();
//         });
//       });
      
//       const image = await RawImage.read(tmpPath);
      
//       // Clean up
//       await new Promise((resolve, reject) => {
//         fs.unlink(tmpPath, (err) => {
//           if (err) console.warn('⚠️ Failed to delete file:', err);
//           resolve();
//         });
//       });
//       // ✅ fixed method
//       if (!image) throw new Error('Failed to decode image buffer');
//       const result = await extractor(image, {
//         pooling: 'mean',
//         normalize: true,
//       });
//       return Array.from(result.data);
//     })();

//     const raw = fs.readFileSync('jewelry_embeddings.json');
//     const jewelryEmbeddings = JSON.parse(raw);

//     const cosineSimilarity = (a, b) => {
//       const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
//       const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
//       const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
//       return dot / (magA * magB);
//     };

//     const matches = jewelryEmbeddings.map(item => ({
//       item,
//       score: cosineSimilarity(embedding, item.embedding)
//     }));

//     const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, 1);
//     console.log(`✅ Found ${topMatches.length} matching rows.`);

//     relevantRows = topMatches.map(({ item, score }) => ({
//       ...item.data,
//       _score: score.toFixed(4)
//     }));
//   } else {
//     generatedQuestion = await generateQuestionFromConversation(question || '', conversations, pool);
//     console.log("🤖 Generated question from context:", generatedQuestion);

//     const { categories, tags, occasions } = await extractUniqueFiltersFromCSV(filePath);
//     const filters = await extractStructuredFilters(generatedQuestion, filePath, categories, tags, occasions);
//     relevantRows = await getRelevantRows(filePath, filters);
//   }

//   const questionToUse = generatedQuestion || question || '';
//   const productResponse = await generateResponseForProduct(questionToUse, relevantRows, pool);
//   return res.json({ message: productResponse });
// }


// if (category === 'Product') {
//   let generatedQuestion;
//   const csvLink = await getProductSheetLink(pool);
//   const filePath = './temp.csv';
//   console.log("📥 Downloading CSV...");
//   await downloadCSV(csvLink, filePath);
//   console.log("📄 CSV Downloaded!");

//   let relevantRows = [];

//   if (imageBuffer) {
//     console.log("🧠 Embedding image for similarity search...");

//     const embedding = await (async () => {
//       const tmpPath = './uploads/temp_image.jpg';

//       await new Promise((resolve, reject) => {
//         fs.writeFile(tmpPath, imageBuffer, (err) => {
//           if (err) return reject(err);
//           resolve();
//         });
//       });
      
//       const image = await RawImage.read(tmpPath);
      
//       await new Promise((resolve, reject) => {
//         fs.unlink(tmpPath, (err) => {
//           if (err) console.warn('⚠️ Failed to delete file:', err);
//           resolve();
//         });
//       });
//       if (!image) throw new Error('Failed to decode image buffer');
//       const result = await extractor(image, {
//         pooling: 'mean',
//         normalize: true,
//       });
//       return Array.from(result.data);
//     })();

//     try {
//       // Read and parse JSON Lines file
//       const jewelryEmbeddings = [];
//       const raw = fs.readFileSync('jewelry_embeddings.jsonl', 'utf8');
//       const lines = raw.split('\n').filter(line => line.trim() !== '');
      
//       for (const line of lines) {
//         try {
//           const embeddingObj = JSON.parse(line);
//           if (!embeddingObj.embedding || !embeddingObj.data) {
//             console.warn('⚠️ Skipping invalid embedding object:', line);
//             continue;
//           }
//           jewelryEmbeddings.push(embeddingObj);
//         } catch (err) {
//           console.error('❌ Error parsing JSON line:', err.message);
//         }
//       }

//       if (jewelryEmbeddings.length === 0) {
//         console.warn('⚠️ No valid embeddings found in file.');
//         return res.json({ message: "No matching products found." });
//       }

//       const cosineSimilarity = (a, b) => {
//         const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
//         const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
//         const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
//         return dot / (magA * magB);
//       };

//       const matches = jewelryEmbeddings.map(item => ({
//         item,
//         score: cosineSimilarity(embedding, item.embedding)
//       }));

//       const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, 1);
//       console.log(`✅ Found ${topMatches.length} matching rows.`);

//       relevantRows = topMatches.map(({ item, score }) => ({
//         ...item.data,
//         _score: score.toFixed(4)
//       }));

//     } catch (err) {
//       console.error('❌ Error processing embeddings file:', err.message);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }
//   } else {
//     generatedQuestion = await generateQuestionFromConversation(question || '', conversations, pool);
//     console.log("🤖 Generated question from context:", generatedQuestion);

//     const { categories, tags, occasions } = await extractUniqueFiltersFromCSV(filePath);
//     const filters = await extractStructuredFilters(generatedQuestion, filePath, categories, tags, occasions);
//     relevantRows = await getRelevantRows(filePath, filters);
//   }

//   const questionToUse = generatedQuestion || question || '';
//   const productResponse = await generateResponseForProduct(questionToUse, relevantRows, pool);
//   return res.json({ message: productResponse });
// }
    const responseMessage = await generateResponseForRecentQuestion(combinedQuestion, conversations, pool);
    return res.json({ message: responseMessage });

  } catch (error) {
    console.error('Error processing chat request:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



const selectedFields = [
  'SKU', 'Title', 'Product Description', 'Stock Status', 'Quantity', 'Collections',
  'Category', 'Gold Net', 'Silver Net', 'Platinum Net', 'Diamond Weight', 'Tags',
  'Gender', 'Ocassions', 'Automatic Price', 'Images Links', 'Video URL', 'Product Link'
];




function extractPrice(row) {
  const price = parseFloat(row['Automatic Price']);
  return isNaN(price) ? null : price;
}

function extractWeight(row, column) {
  const weight = parseFloat(row[column]);
  return isNaN(weight) ? null : weight;
}


//new
async function extractUniqueFiltersFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const categories = new Set();
    const tags = new Set();
    const occasions = new Set();

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (row['Category']) row['Category'].split(',').forEach(c => categories.add(c.trim()));
        if (row['Tags']) row['Tags'].split(',').forEach(t => tags.add(t.trim()));
        if (row['Ocassions']) row['Ocassions'].split(',').forEach(o => occasions.add(o.trim()));
      })
      .on('end', () => {
        const result = {
          categories: Array.from(categories),
          tags: Array.from(tags),
          occasions: Array.from(occasions)
        };

        // console.log('📂 Extracted Categories:', result.categories);
        // console.log('🏷️ Extracted Tags:', result.tags);
        // console.log('🎉 Extracted Occasions:', result.occasions);

        resolve(result);
      })
      .on('error', reject);
  });
};



async function extractStructuredFilters(userQuestion, filePath) {
  const { categories, tags, occasions } = await extractUniqueFiltersFromCSV(filePath);

  const prompt = `
You are an intelligent product search assistant.

Analyze the following question and extract the search filters:

Question: "${userQuestion}"

Respond in this JSON format ONLY (no explanation):
{
  "category": "<product type (e.g. ${categories.join(', ')})>",
  "collection": "<Jwellery type (leave null if not mentioned)>",
  "min_price": <numeric price if mentioned, else null>,
  "max_price": <numeric price if mentioned, else null>,
  "max_weight": <weight in grams if mentioned, else null>,
  "min_weight": <weight in grams if mentioned, else null>,
  "weight_column": "<Gold Net | Silver Net | Platinum Net | Diamond Weight | null>",
  "intent": "<gift, personal use, etc., or null>",
  "occasion_keywords": [${occasions.map(o => `"${o}"`).join(', ')}] or null,
  "title": "<title of the product>",
  "Tags": "<Designs (e.g. ${tags.join(', ')})>"
  "sortBy"  cheap or expensive
  "Status" publish
 }
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.3
  });

  try {
    let content = response.choices[0].message.content.trim();

    if (content.startsWith("```")) {
      content = content.replace(/```(?:json)?/g, "").trim();
    }

    return JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse filters:", err);
    return {};
  }
}


//new 21 
const stringSimilarity = require('string-similarity');
const he = require('he'); // npm install he

function normalizeText(str) {
  return he.decode((str || '')
    .toLowerCase()
    .normalize('NFKD') // Normalize unicode (accents, etc.)
    .replace(/[^\w\s]/gi, '') // Remove special characters
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim());
}

async function getRelevantRows(csvPath, filters, maxResults = 10, debug = true) {
  return new Promise((resolve, reject) => {
    const titleMatches = [];
    const categoryMatches = [];
    const allRows = [];
    let rowCount = 0;

    const titleFilter = normalizeText(filters.title);
    const categoryFilter = normalizeText(filters.category);

    fs.createReadStream(csvPath)
      .pipe(csvParser())
      .on('data', (row) => {
        rowCount++;

                // ✅ Only process rows with Status === 'publish'
                const status = (row['Status'] || '').toLowerCase();
                if (status !== 'publish') return;
        allRows.push(row); // store everything for potential second pass

        const rawTitle = row['Title'] || '';
        const title = normalizeText(rawTitle);
        const category = normalizeText(row['Category']);
        const tags = normalizeText(row['Tags']);
        const occasions = normalizeText(row['Ocassions']);

        const price = extractPrice(row);
        const weight = extractWeight(row, filters.weight_column);

        let passesAllFilters = true;

        if (filters.min_price != null && price < filters.min_price) passesAllFilters = false;
        if (filters.max_price != null && price > filters.max_price) passesAllFilters = false;
        if (filters.min_weight != null && weight < filters.min_weight) passesAllFilters = false;
        if (filters.max_weight != null && weight > filters.max_weight) passesAllFilters = false;

        if (filters.Tags || filters.occasion_keywords) {
          const tagArr = Array.isArray(filters.Tags) ? filters.Tags : [filters.Tags].filter(Boolean);
          const occArr = Array.isArray(filters.occasion_keywords) ? filters.occasion_keywords : [filters.occasion_keywords].filter(Boolean);
          const allKeywords = [...tagArr, ...occArr].map(normalizeText);
          const matchFound = allKeywords.some(keyword =>
            keyword && (tags.includes(keyword) || occasions.includes(keyword))
          );
          if (!matchFound) passesAllFilters = false;
        }

        let isTitleMatch = false;
        let titleSimilarityScore = 0;
        if (titleFilter && title === titleFilter) {
          isTitleMatch = true;
          if (debug) console.log(`✅ EXACT MATCH: "${rawTitle}" ↔ "${filters.Title}"`);
        }

        if (!isTitleMatch && titleFilter) {
          titleSimilarityScore = stringSimilarity.compareTwoStrings(title, titleFilter);
          if (titleSimilarityScore >= 0.6) {
            isTitleMatch = true;
            if (debug) console.log(`🤖 SIMILAR MATCH: "${rawTitle}" ~ "${filters.Title}" (score: ${titleSimilarityScore.toFixed(2)})`);
          }
        }

        const isCategoryMatch = categoryFilter && category.includes(categoryFilter);

        if (isTitleMatch && passesAllFilters) {
          titleMatches.push({ row, price });
        } else if (!isTitleMatch && isCategoryMatch && passesAllFilters) {
          categoryMatches.push({ row, price });
        }
      })
      .on('end', () => {
//         let matches = titleMatches.length > 0 ? titleMatches : categoryMatches;

//         // Retry without tags/occasions if no match
//         if (matches.length === 0) {
//           if (debug) console.log('🔁 No matches found. Retrying without tags/occasion keywords...');

//           allRows.forEach((row) => {
//             const rawTitle = row['Title'] || '';
//             const title = normalizeText(rawTitle);
//             const category = normalizeText(row['Category']);
//             const price = extractPrice(row);
//             const weight = extractWeight(row, filters.weight_column);

//             let passesAllFilters = true;
//             if (filters.min_price != null && price < filters.min_price) passesAllFilters = false;
//             if (filters.max_price != null && price > filters.max_price) passesAllFilters = false;
//             if (filters.min_weight != null && weight < filters.min_weight) passesAllFilters = false;
//             if (filters.max_weight != null && weight > filters.max_weight) passesAllFilters = false;

//             let isTitleMatch = false;
//             let titleSimilarityScore = 0;
//             if (titleFilter && title === titleFilter) {
//               isTitleMatch = true;
//               if (debug) console.log(`✅ [FALLBACK] EXACT MATCH: "${rawTitle}" ↔ "${filters.Title}"`);
//             }

//             if (!isTitleMatch && titleFilter) {
//               titleSimilarityScore = stringSimilarity.compareTwoStrings(title, titleFilter);
//               if (titleSimilarityScore >= 0.6) {
//                 isTitleMatch = true;
//                 if (debug) console.log(`🤖 [FALLBACK] SIMILAR MATCH: "${rawTitle}" ~ "${filters.title}" (score: ${titleSimilarityScore.toFixed(2)})`);
//               }
//             }

//             const isCategoryMatch = categoryFilter && category.includes(categoryFilter);

//             if (isTitleMatch && passesAllFilters) {
//               titleMatches.push({ row, price });
//             } else if (!isTitleMatch && isCategoryMatch && passesAllFilters) {
//               categoryMatches.push({ row, price });
//             }
//           });

//           matches = titleMatches.length > 0 ? titleMatches : categoryMatches;
//         }

//         // Final sorting
//         // if (filters.sortByPrice === 'expensive') {
//         //   matches.sort((a, b) => b.price - a.price);
//         // } else if (filters.sortByPrice === 'cheap') {
//         //   matches.sort((a, b) => a.price - b.price);
//         // }


//         let finalMatches = matches;

// // If no filters applied and sortBy is specified, sort all rows
// const noFiltersApplied =
//   !filters.title &&
//   !filters.category &&
//   filters.min_price == null &&
//   filters.max_price == null &&
//   filters.min_weight == null &&
//   filters.max_weight == null &&
//   !filters.Tags &&
//   !filters.occasion_keywords;

// if (noFiltersApplied && (filters.sortBy === 'expensive' || filters.sortBy === 'cheap')) {
//   if (debug) console.log(`⚙️ No filters applied. Returning all rows sorted by price: ${filters.sortBy}`);
//   finalMatches = allRows
//     .map(row => ({ row, price: extractPrice(row) }))
//     .sort((a, b) =>
//       filters.sortBy === 'expensive' ? b.price - a.price : a.price - b.price
//     );
// } else {
//   if (filters.sortBy === 'expensive') {
//     finalMatches = matches.sort((a, b) => b.price - a.price);
//   } else if (filters.sortBy === 'cheap') {
//     finalMatches = matches.sort((a, b) => a.price - b.price);
//   }
// }




//         const result = matches.slice(0, maxResults).map(m => m.row);

//         if (debug) {
//           console.log('🧠 Structured filters:', filters);
//           console.log(`📊 Parsed rows: ${rowCount}`);
//           console.log(`🎯 Title matches: ${titleMatches.length}`);
//           console.log(`📂 Category fallback matches: ${categoryMatches.length}`);
//           console.log(`📤 Final returned rows: ${result.length}`);
//           console.dir(result, { depth: null });
//         }

//         resolve(result);



let matches = titleMatches.length > 0 ? titleMatches : categoryMatches;

// If nothing matched and no filters exist, treat it as "show all sorted"
const noFiltersApplied =
  !filters.title &&
  !filters.category &&
  filters.min_price == null &&
  filters.max_price == null &&
  filters.min_weight == null &&
  filters.max_weight == null &&
  !filters.Tags &&
  !filters.occasion_keywords;

if ((matches.length === 0 && noFiltersApplied) || noFiltersApplied) {
  if (debug) console.log('🆕 No filters applied. Returning all rows sorted by price.');

  matches = allRows
    .map(row => ({ row, price: extractPrice(row) }))
    .sort((a, b) =>
      filters.sortBy === 'expensive' ? b.price - a.price : a.price - b.price
    );
} else {
  // Retry without tag/occasion filters if still no matches
  if (matches.length === 0) {
    if (debug) console.log('🔁 No matches found. Retrying without tags/occasion keywords...');

    allRows.forEach((row) => {
      const rawTitle = row['Title'] || '';
      const title = normalizeText(rawTitle);
      const category = normalizeText(row['Category']);
      const price = extractPrice(row);
      const weight = extractWeight(row, filters.weight_column);

      let passesAllFilters = true;
      if (filters.min_price != null && price < filters.min_price) passesAllFilters = false;
      if (filters.max_price != null && price > filters.max_price) passesAllFilters = false;
      if (filters.min_weight != null && weight < filters.min_weight) passesAllFilters = false;
      if (filters.max_weight != null && weight > filters.max_weight) passesAllFilters = false;

      const titleFilter = normalizeText(filters.title);
      const categoryFilter = normalizeText(filters.category);
      let isTitleMatch = false;
      if (titleFilter && (title === titleFilter || stringSimilarity.compareTwoStrings(title, titleFilter) >= 0.6)) {
        isTitleMatch = true;
      }

      const isCategoryMatch = categoryFilter && category.includes(categoryFilter);

      if (isTitleMatch && passesAllFilters) {
        titleMatches.push({ row, price });
      } else if (!isTitleMatch && isCategoryMatch && passesAllFilters) {
        categoryMatches.push({ row, price });
      }
    });

    matches = titleMatches.length > 0 ? titleMatches : categoryMatches;
    if (filters.sortBy === 'expensive') {
      matches.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === 'cheap') {
      matches.sort((a, b) => a.price - b.price);
    }
  } else {
    // Final sort if match was found
    if (filters.sortBy === 'expensive') {
      matches.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === 'cheap') {
      matches.sort((a, b) => a.price - b.price);
    }
  }
}

// const result = matches.slice(0, maxResults).map(m => m.row);
const result = matches.slice(0, maxResults).map(m => {
  const filteredRow = {};
  selectedFields.forEach(field => {
    filteredRow[field] = m.row[field] ?? '';
  });
  return filteredRow;
});

if (debug) {
  console.log('🧠 Structured filters:', filters);
  console.log(`📊 Parsed rows: ${rowCount}`);
  console.log(`🎯 Title matches: ${titleMatches.length}`);
  console.log(`📂 Category fallback matches: ${categoryMatches.length}`);
  console.log(`📤 Final returned rows: ${result.length}`);
  console.dir(result, { depth: null });
}

resolve(result);

      })
      .on('error', reject);
  });
}


async function getCaptionFromImage(dataUrl) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant who describes images clearly for retail product support.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: dataUrl, // ✅ already includes data:image/... prefix
              },
            },
            {
              type: "text",
              text: "Describe this product clearly with its type, material, style, and use if visible. Be short and to the point.",
            },
          ],
        },
      ],
      max_tokens: 30,
    });

    const caption = response.choices[0].message.content.trim();
    console.log("🧠 Image caption:", caption);
    return caption;
  } catch (error) {
    console.error("❌ Error generating caption from image:", error);
    return "";
  }
}



// Fetch store information
// async function getStoreInfo(pool) {
//   return new Promise((resolve, reject) => {
//     const query = `SELECT data AS store_info FROM settings WHERE name = 'store_info';`;
//     pool.query(query, (error, results) => {
//       if (error) return reject(error);
//       resolve(JSON.parse(results[0].store_info));
//     });
//   });
// }
async function getStoreInfo(pool) {
  return new Promise((resolve) => {
    const query = `
      SELECT data AS store_info 
      FROM settings 
      WHERE name = 'store_info';
    `;
    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching store info:", error.message);
        return resolve(null);
      }

      const rawData = results[0]?.store_info;
      if (!rawData) {
        console.warn("Store info not found or is empty.");
        return resolve(null);
      }

      try {
        const parsed = JSON.parse(rawData);
        resolve(parsed);
      } catch (parseError) {
        console.warn("Failed to parse store info JSON:", parseError.message);
        resolve(null); // Return null or fallback object
      }
    });
  });
}




// Fetch product sheet link
// Corrected product sheet link extraction
// async function getProductSheetLink(pool) {
//   return new Promise((resolve, reject) => {
//     const query = `SELECT data AS latest_product_export_sheet FROM settings WHERE name = 'latest_product_export_sheet';`;
//     pool.query(query, (error, results) => {
//       if (error) return reject(error);
//       resolve(results[0].latest_product_export_sheet);
//       console.log("Get the link") // Directly return as a string (not JSON)
//     });
//   });
// }

async function getProductSheetLink(pool) {
  return new Promise((resolve) => {
    const query = `
      SELECT data AS latest_product_export_sheet 
      FROM settings 
      WHERE name = 'latest_product_export_sheet';
    `;
    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching product sheet link:", error.message);
        return resolve(null); // fallback to null or a default URL
      }

      const link = results[0]?.latest_product_export_sheet?.trim();
      if (!link) {
        console.warn("Product sheet link not found or is empty.");
        return resolve(null); // or return a default value if desired
      }

      console.log("Product sheet link retrieved");
      resolve(link);
    });
  });
}


async function downloadCSV(csvLink, filePath) {
  const writer = fs.createWriteStream(filePath);
  const response = await axios({ url: csvLink, method: 'GET', responseType: 'stream' });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function generateQuestionFromConversation(recentInput, conversationHistory, pool) {
  const customInstructions = await getCustomInstructions(pool);

  const chatHistory = conversationHistory
    .map(conv => `${conv.sender}: ${conv.message}`)
    .join("\n");

  const prompt = `
  You are a smart assistant that analyzes chat conversations between a user and a support agent.

  Based on the chat history and the latest user message, infer and rewrite the latest user message (or question) in a clear, direct, and context-aware way.

  Only return the reformulated question that best represents what the user wants, including any necessary context from previous conversation reconstruct the question only if its necessary.

  Chat History:
  ${chatHistory}

  Latest User Message: "${recentInput}"

  Reformulate the user message as a clear, standalone question from the chat history given where the latest message is at the top like the conversaion goes from top the latest one to the bottom older ones that will help retrieve product information from a CSV file generate the question in english only not in other language.
  `;

  // console.log("🧠 Reformulation prompt:", recentInput);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: prompt }
    ],
    temperature: 0.4
  });

  const refinedQuestion = response.choices[0].message.content.trim();
  // console.log("🔍 Refined question:", refinedQuestion);

  return refinedQuestion;
}



// async function getCustomInstructions(pool) {
//   return new Promise((resolve, reject) => {
//     const query = `
//       SELECT data AS custom_instructions 
//       FROM settings 
//       WHERE name = 'custom_instructions_jwero_ai';
//     `;
//     pool.query(query, (error, results) => {
//       if (error) return reject(error);
//       resolve(results[0].custom_instructions);
//     });
//   });
// }

async function getGoldPricing(pool) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.gold_pricing')) AS gold_pricing
      FROM settings
      WHERE name = 'master_pricing';
    `;

    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching gold pricing:", error.message);
        return resolve(null);
      }

      const pricing = results[0]?.gold_pricing?.trim();
      if (!pricing) {
        console.warn("Gold pricing not found or empty.");
        return resolve(null);
      }

      resolve(pricing);
    });
  });
}

async function getSilverPricing(pool) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.silver_pricing')) AS silver_pricing
      FROM settings
      WHERE name = 'master_pricing';
    `;

    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching silver pricing:", error.message);
        return resolve(null);
      }

      const pricing = results[0]?.silver_pricing?.trim();
      if (!pricing) {
        console.warn("Silver pricing not found or empty.");
        return resolve(null);
      }

      resolve(pricing);
    });
  });
}

async function getPlatinumPricing(pool) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.platinum_pricing')) AS platinum_pricing
      FROM settings
      WHERE name = 'master_pricing';
    `;

    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching platinum pricing:", error.message);
        return resolve(null);
      }

      const pricing = results[0]?.platinum_pricing?.trim();
      if (!pricing) {
        console.warn("Platinum pricing not found or empty.");
        return resolve(null);
      }

      resolve(pricing);
    });
  });
}



async function getCustomInstructions(pool) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.custom_instructions_jwero_ai')) AS custom_instruction
      FROM settings
      WHERE name = 'jwero_ai_settings';
    `;

    pool.query(query, (error, results) => {
      if (error) {
        console.warn("Error fetching custom instructions:", error.message);
        // Resolve with fallback instead of rejecting
        return resolve(null);
      }

      const instructions = results[0]?.custom_instruction?.trim(); // updated key
      if (!instructions) {
        console.warn("Custom instructions not found or empty.");
        return resolve(null);
      }

      resolve(instructions);
    });
  });
}


// async function generateResponseForStore(question, storeData, pool) {
//   console.log("Generating response for store...");

//   const customInstructions = await getCustomInstructions(pool);
// console.log(customInstructions)
// const structuredInfo = `
//   Store Name: ${storeData.store_name || 'N/A'}
//   Store ID: ${storeData.store_id || 'N/A'}
//   Description: ${storeData.business_description || 'N/A'}
//   About: ${storeData.business_about || 'N/A'}
//   Employees: ${storeData.employees || 'N/A'}
//   Member Associations: ${Array.isArray(storeData.member_of_association) ? storeData.member_of_association.map(assoc => assoc.label).join(', ') : 'N/A'}
//   Store Logo: ${storeData.store_logo || 'N/A'}
//   Store URL: ${storeData.store_url || 'N/A'}

//   Social Media:
//   - Facebook: ${storeData.store_socials?.facebook || 'N/A'}
//   - Instagram: ${storeData.store_socials?.instagram || 'N/A'}
//   - Twitter: ${storeData.store_socials?.twitter || 'N/A'}
//   - LinkedIn: ${storeData.store_socials?.linkedin || 'N/A'}
//   - YouTube: ${storeData.store_socials?.youtube || 'N/A'}
//   - Pinterest: ${storeData.store_socials?.pinterest || 'N/A'}
// `;


//   const prompt = `
// You are a friendly and helpful support agent for a store. Follow the instructions given below strictly when answering the customer.

// Custom Instructions:
// ${customInstructions}

// Store Information:
// ${structuredInfo}

//    📝 Language rule:
//    - Detect the language used by the customer (e.g., Hindi, English, Hinglish,Gujrati,Arabic,Marathi etc).
//    - Respond in **the same language** or style as used by the customer.
//    - If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
//    - If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.

// Customer Question: ${question}

// Respond naturally as a human support representative would. Do not format text in Markdown or use asterisks and generate answer in the same language ask by the user.
// `;

//   const response = await openai.chat.completions.create({
//     model: 'gpt-4',
//     messages: [{ role: 'system', content: prompt }],
//     temperature: 0.7,
//   });

//   console.log("Response ready");
//   return response.choices[0].message.content.trim();
// }


async function generateResponseForStore(question, storeData, pool) {
  console.log("Generating response for store...");

  const customInstructions = await getCustomInstructions(pool);
  console.log("Custom Instructions loaded.");

  // Load sitemap URL from storeData, then .env, then fallback
  const sitemapUrl = storeData.store_sitemap_url || process.env.STORE_SITEMAP_URL || 'https://tiarabytj.com/page-sitemap1.xml';

  // Fetch all URLs from the sitemap
  let pageUrls = [];
  try {
    const sitemapRes = await axios.get(sitemapUrl);
    const sitemapXml = sitemapRes.data;
    const parsed = await xml2js.parseStringPromise(sitemapXml);
    pageUrls = parsed.urlset.url.map(entry => entry.loc[0]);
    console.log("✅ Sitemap URLs loaded:");
    console.log(pageUrls.slice(0, 10));
  } catch (error) {
    console.warn("Failed to fetch or parse sitemap:", error.message);
  }

  // Limit pages to avoid token overflow (adjust as needed)
  const limitedUrls = pageUrls.slice(0, 2);

  let crawledContent = '';
  for (const url of limitedUrls) {
    try {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      // crawledContent += `\n\n--- Page: ${url} ---\n${text}`;
      crawledContent += `\n\n--- Page: ${url} ---\n${text.slice(0, 1000)}...`; // show only first 1000 chars

      console.log(`✅ Crawled content from ${url}:`);
      console.log(text.slice(0, 300)); // preview first 300 chars
    } catch (err) {
      console.warn(`Failed to fetch page ${url}:`, err.message);
    }
  }

  const structuredInfo = `
Store Name: ${storeData.store_name || 'N/A'}
Store ID: ${storeData.store_id || 'N/A'}
Description: ${storeData.business_description || 'N/A'}
About: ${storeData.business_about || 'N/A'}
Employees: ${storeData.employees || 'N/A'}
Member Associations: ${Array.isArray(storeData.member_of_association) ? storeData.member_of_association.map(assoc => assoc.label).join(', ') : 'N/A'}
Store Logo: ${storeData.store_logo || 'N/A'}
Store URL: ${storeData.store_url || 'N/A'}

Social Media:
- Facebook: ${storeData.store_socials?.facebook || 'N/A'}
- Instagram: ${storeData.store_socials?.instagram || 'N/A'}
- Twitter: ${storeData.store_socials?.twitter || 'N/A'}
- LinkedIn: ${storeData.store_socials?.linkedin || 'N/A'}
- YouTube: ${storeData.store_socials?.youtube || 'N/A'}
- Pinterest: ${storeData.store_socials?.pinterest || 'N/A'}
`;

  const prompt = `
You are a friendly and helpful support agent for a jewellery store. Follow the instructions strictly.

Custom Instructions:
${customInstructions}

Store Information:
${structuredInfo}

🧠 Website Content (Crawled from Sitemap):
${crawledContent}

📝 Language rule:
- Detect the language used by the customer (e.g., Hindi, English, Hinglish, Gujarati, Arabic, Marathi).
- Respond in the **same language or script** as the customer.
- If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
- If the language is unknown or unclear, politely ask the user to continue in English.

Customer Question: ${question}

Respond naturally like a human support rep. Do not use markdown or asterisks. Answer in the same language asked by the customer.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}



async function generateResponseForProduct(question, productData,pool) {
  console.log("Generating response...");
  const customInstructions = await getCustomInstructions(pool);
  const prompt = `You are a friendly and helpful product support agent. Answer customer questions in a natural, conversational tone and not in a contiues way like if u want then type yes and all. Do not use markdown formatting, asterisks, or any special characters Avoid using [text](link) format. 
Just include plain text with full URLs and  show product link everytime even if its is out of stock follow the Custom Instructions given below strictly before answering:
  ${customInstructions}.

  Here is the product catalog:
  ${JSON.stringify(productData)}

  Customer Question: ${question}

   📝 Language rule:
   - Detect the language used by the customer (e.g., Hindi, English, Hinglish,Gujrati,Arabic,Marathi etc).
   - Respond in **the same language** or style as used by the customer.
   - If the message is in Hinglish (Hindi in Latin script), respond in Hinglish.
   - If the language is unknown or not understood, politely ask the user to continue in English, and respond in English.

  Respond naturally as a human support representative would and in the same language ask by the user in the recent question follow the language rule strictly while generating response.
 `;

    // console.log("🧠 product prompt:", question);
    // console.log("Product Data being passed:", JSON.stringify(productData));
    try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.7,
  });

  // return response.choices[0].message.content.trim();

      // Safety check before accessing the response
      if (
        response &&
        response.choices &&
        response.choices.length > 0 &&
        response.choices[0].message &&
        response.choices[0].message.content
      ) {
        return response.choices[0].message.content.trim();
      } else {
        console.error("No valid message returned from OpenAI.");
        return "Sorry, I couldn't generate a response at the moment. Please try again later.";
      }
    } catch (error) {
      console.error("Error generating response:", error);
      return "Sorry, there was an error processing your request.";
    }
  
}


//crm api

// const fetchUserData = async (pool, chatUserId) => {
//   if (!pool) {
//     throw new Error("MySQL pool is undefined. Ensure pool is created with createPoolForTenant.");
//   }

//   let connection;
//   try {
//     // Promisify pool.getConnection
//     const getConnection = util.promisify(pool.getConnection).bind(pool);
//     connection = await getConnection();

//     if (!connection) {
//       throw new Error("Failed to get DB connection from pool.");
//     }

//     // Promisify connection.query
//     const query = util.promisify(connection.query).bind(connection);

//     const userResult = await query("SELECT whatsapp FROM chat_users WHERE id = ?", [chatUserId]);
//     if (!userResult || userResult.length === 0) {
//       throw new Error(`Chat user not found for ID: ${chatUserId}`);
//     }

//     const mobileNumber = userResult[0].whatsapp;

//     const contactResult = await query(
//       "SELECT * FROM contacts WHERE mobile_number = ? OR whatsapp = ?",
//       [mobileNumber, mobileNumber]
//     );

//     if (!contactResult || contactResult.length === 0) {
//       throw new Error(`Contact not found for mobile number: ${mobileNumber}`);
//     }

//     const contact = contactResult[0];

//     const orders = await query("SELECT * FROM orders WHERE contact_id = ?", [contact.id]);
//     const sessions = await query("SELECT * FROM sessions WHERE contact_id = ?", [contact.id]);

//     const messages = await query(
//       `SELECT cm.* FROM chat_messages cm 
//        JOIN chat_conversations cc ON cm.conversation_id = cc.id 
//        JOIN chat_users cu ON cc.chat_user_id = cu.id 
//        WHERE cu.whatsapp = ? 
//        ORDER BY cm.created_at DESC 
//        LIMIT 10`,
//       [mobileNumber]
//     );

//     return { contact, orders, sessions, messages };
//   } catch (err) {
//     console.error(`Error in fetchUserData for chat user ${chatUserId}:`, err.message);
//     throw err;
//   } finally {
//     if (connection) connection.release();
//   }
// };


// const fetchUserData = async (pool, chatUserId) => {
//   if (!pool) throw new Error("MySQL pool is undefined. Ensure pool is created with createPoolForTenant.");

//   let connection;
//   try {
//     const getConnection = util.promisify(pool.getConnection).bind(pool);
//     connection = await getConnection();

//     if (!connection) throw new Error("Failed to get DB connection from pool.");

//     const query = util.promisify(connection.query).bind(connection);

//     let mobileNumber;
//     try {
//       const userResult = await query("SELECT whatsapp FROM chat_users WHERE id = ?", [chatUserId]);
//       if (!userResult || userResult.length === 0) {
//         console.warn(`⚠️ [User Missing] No chat_user found for ID: ${chatUserId}`);
//       } else {
//         mobileNumber = userResult[0].whatsapp;
//       }
//     } catch (err) {
//       console.warn(`⚠️ [DB Error] While querying chat_users: ${err.message}`);
//     }

//     let contact = null;
//     if (mobileNumber) {
//       try {
//         const contactResult = await query(
//           "SELECT * FROM contacts WHERE mobile_number = ? OR whatsapp = ?",
//           [mobileNumber, mobileNumber]
//         );
//         if (contactResult && contactResult.length > 0) {
//           contact = contactResult[0];
//         } else {
//           console.warn(`⚠️ [Contact Missing] No contact found for mobile number: ${mobileNumber}`);
//         }
//       } catch (err) {
//         console.warn(`⚠️ [DB Error] While querying contacts: ${err.message}`);
//       }
//     } else {
//       console.warn(`⚠️ [Mobile Number Missing] No mobile number found for chat user ID: ${chatUserId}`);
//     }

//     let orders = [];
//     let sessions = [];
//     let messages = [];

//     if (contact) {
//       try {
//         orders = await query("SELECT * FROM orders WHERE contact_id = ?", [contact.id]);
//         if (orders.length === 0) console.info(`ℹ️ [No Orders] No orders found for contact_id: ${contact.id}`);
//       } catch (err) {
//         console.warn(`⚠️ [DB Error] While fetching orders: ${err.message}`);
//       }

//       try {
//         sessions = await query("SELECT * FROM sessions WHERE contact_id = ?", [contact.id]);
//         if (sessions.length === 0) console.info(`ℹ️ [No Sessions] No sessions found for contact_id: ${contact.id}`);
//       } catch (err) {
//         console.warn(`⚠️ [DB Error] While fetching sessions: ${err.message}`);
//       }
//     }

//     if (mobileNumber) {
//       try {
//         messages = await query(
//           `SELECT cm.* FROM chat_messages cm 
//            JOIN chat_conversations cc ON cm.conversation_id = cc.id 
//            JOIN chat_users cu ON cc.chat_user_id = cu.id 
//            WHERE cu.whatsapp = ? 
//            ORDER BY cm.created_at DESC 
//            LIMIT 10`,
//           [mobileNumber]
//         );
//         if (messages.length === 0) console.info(`ℹ️ [No Messages] No chat messages found for mobile number: ${mobileNumber}`);
//       } catch (err) {
//         console.warn(`⚠️ [DB Error] While fetching messages: ${err.message}`);
//       }
//     }

//     return { contact, orders, sessions, messages };
//   } catch (err) {
//     console.error(`❌ [Fatal] Error in fetchUserData for chat user ${chatUserId}:`, err.message);
//     throw err;
//   } finally {
//     if (connection) connection.release();
//   }
// };



//mew
const fetchUserData = async (pool, contactId) => {
  if (!pool) throw new Error("MySQL pool is undefined. Ensure pool is created with createPoolForTenant.");

  let connection;
  try {
    const getConnection = util.promisify(pool.getConnection).bind(pool);
    connection = await getConnection();

    if (!connection) throw new Error("Failed to get DB connection from pool.");

    const query = util.promisify(connection.query).bind(connection);

    let contact = null;
    let orders = [];
    let sessions = [];
    let messages = [];

    // 🔍 Try to fetch contact
    try {
      console.log(`🧾 Running: SELECT * FROM contacts WHERE id = ${contactId}`);
      const contactResult = await query("SELECT * FROM contacts WHERE id = ?", [contactId]);
      if (contactResult && contactResult.length > 0) {
        contact = contactResult[0];
      } else {
        console.warn(`⚠️ [Contact Missing] No contact found for ID: ${contactId}`);
      }
    } catch (err) {
      console.warn(`⚠️ [DB Error] While querying contacts: ${err.message}`);
    }

    // 📦 Fetch orders regardless of whether contact was found
    try {
      console.log(`🧾 Running: SELECT * FROM orders WHERE contact_id = ${contactId}`);
      orders = await query("SELECT * FROM orders WHERE contact_id = ?", [contactId]);
      if (orders.length === 0) console.info(`ℹ️ [No Orders] No orders found for contact_id: ${contactId}`);
    } catch (err) {
      console.warn(`⚠️ [DB Error] While fetching orders: ${err.message}`);
    }

    // 🧭 Fetch sessions regardless of whether contact was found
    try {
      console.log(`🧾 Running: SELECT * FROM sessions WHERE contact_id = ${contactId}`);
      sessions = await query("SELECT * FROM sessions WHERE contact_id = ?", [contactId]);
      if (sessions.length === 0) console.info(`ℹ️ [No Sessions] No sessions found for contact_id: ${contactId}`);
    } catch (err) {
      console.warn(`⚠️ [DB Error] While fetching sessions: ${err.message}`);
    }

    // 💬 Fetch messages only if contact and whatsapp exist
    if (contact?.whatsapp) {
      try {
        console.log(`🧾 Running: SELECT cm.* FROM chat_messages ... WHERE cu.whatsapp = '${contact.whatsapp}' LIMIT 10`);
        messages = await query(`
          SELECT cm.* FROM chat_messages cm 
          JOIN chat_conversations cc ON cm.conversation_id = cc.id 
          JOIN chat_users cu ON cc.chat_user_id = cu.id 
          WHERE cu.whatsapp = ? 
          ORDER BY cm.created_at DESC 
          LIMIT 10
        `, [contact.whatsapp]);

        if (messages.length === 0) console.info(`ℹ️ [No Messages] No messages found for whatsapp: ${contact.whatsapp}`);
      } catch (err) {
        console.warn(`⚠️ [DB Error] While fetching messages: ${err.message}`);
      }
    } else {
      console.warn(`⚠️ [Message Skipped] No whatsapp found for contact, skipping messages query.`);
    }

    return { contact, orders, sessions, messages };
  } catch (err) {
    console.error(`❌ [Fatal] Error in fetchUserData for contact_id ${contactId}:`, err.message);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};



// Helper: Generate summary
// const generateSummary = async (userData) => {
//   const prompt = `You are a CRM assistant. Analyze this user:\n\nContact Info:\n${JSON.stringify(userData.contact, null, 2)}\n\nOrders:\n${JSON.stringify(userData.orders, null, 2)}\n\nSessions:\n${JSON.stringify(userData.sessions, null, 2)}\n\nMessages:\n${JSON.stringify(userData.messages, null, 2)}\n\nGenerate a summary like:\n1. Gold Collection Browsing: ...\n2. Diamond Plan Purchase: ...\n3. Cart Abandonment: ...\n\nThen write a conclusion paragraph and 2 recommendation actions.`;

//   const completion = await openai.chat.completions.create({
//     messages: [
//       {
//         role: "system",
//         content: "You are a helpful CRM assistant that creates insightful summaries and personalized recommendations.",
//       },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     temperature: 0.7,
//     max_tokens: 700,
//   });

//   return completion.choices[0].message.content;
// };



//new
// const generateSummary = async (userData, crmId) => {
//   console.log("📥 Data received in generateSummary:", JSON.stringify(userData, null, 2));

//   const hasContact = !!userData.contact;
//   const hasOrders = Array.isArray(userData.orders) && userData.orders.length > 0;
//   const hasSessions = Array.isArray(userData.sessions) && userData.sessions.length > 0;
//   const hasMessages = Array.isArray(userData.messages) && userData.messages.length > 0;

//   if (!hasContact && !hasOrders && !hasSessions && !hasMessages) {
//     return `❌ Not enough data to generate insights for CRM ID: ${crmId}`;
//   }

//   const prompt = `You are a CRM assistant. Analyze this user (CRM ID: ${crmId}). Provide a very short and interactive summary with fun emojis and clear bold headings. Mention missing data if any. Keep it friendly but professional.

// ### 📇 Contact Info:
// ${hasContact ? JSON.stringify(userData.contact, null, 2) : "No contact info available."}

// ### 📦 Orders:
// ${hasOrders ? JSON.stringify(userData.orders, null, 2) : "No orders available."}

// ### 🧭 Sessions:
// ${hasSessions ? JSON.stringify(userData.sessions, null, 2) : "No sessions available."}

// ### 💬 Messages:
// ${hasMessages ? JSON.stringify(userData.messages, null, 2) : "No recent messages available."}

// ---

// ### ✨ Insight Summary:
// - 🔍 **Browsing/Order Patterns**: ${hasOrders ? "Summarize order activity or browsing behaviors." : "No orders found."}
// - 📢 **Communication Behavior**: ${hasMessages ? "Summarize trends from messages or interactions." : "No communication data found."}
// - 🎯 **Interest Signals**: ${hasOrders || hasSessions ? "Mention any signs of purchase intent or product interest." : "No strong interest signals."}

// ---

// ### 🚀 Quick Recommendations:
// - Bullet out exactly 3 recommendations, each within one line, starting with an emoji.
// - Focus on practical CRM actions based on the available data.
// `;

//   const completion = await openai.chat.completions.create({
//     messages: [
//       {
//         role: "system",
//         content: "You are a helpful CRM assistant that creates super concise, emoji-rich, and insightful summaries with actionable one-line recommendations.",
//       },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     temperature: 0.7,
//     max_tokens: 400, // reduced a little since the output is short
//   });

//   return completion.choices[0].message.content;
// };
const generateInsightSummary = async (userData, crmId) => {
  console.log("📥 Data for Insight Summary (raw):", JSON.stringify(userData, null, 2));

  const prompt = `
You are a CRM assistant analyzing user data for CRM ID: ${crmId}.

⚠️ Very Important:
- Ignore fields like: id, crm_id, tenant_id, created_at, updated_at, deleted_at, session_id, order_id, and similar technical fields.
- Only use meaningful information like names, emails, products, browsing history, sessions, messages, etc.

🎯 Task:
Generate a short, friendly, emoji-rich **Insight Summary** with 3 points:
- 🔍 **Browsing/Order Patterns** (1 line)
- 📢 **Communication Behavior** (1 line)
- 🎯 **Interest Signals** (1 line)

Keep it very short (max 5-6 lines total).
Be interactive, clear, and easy to read.`;

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a CRM assistant creating very short, friendly, emoji-based insights for user analysis." },
      { role: "user", content: prompt + "\n\nHere is the user's data:\n" + JSON.stringify(userData, null, 2) }
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  return completion.choices[0].message.content;
};


const generateRecommendations = async (userData, crmId) => {
  console.log("📥 Data for Recommendations (raw):", JSON.stringify(userData, null, 2));

  const prompt = `
You are a CRM assistant helping improve user engagement for CRM ID: ${crmId}.

⚠️ Very Important:
- Ignore technical fields like: id, crm_id, tenant_id, created_at, updated_at, deleted_at, session_id, order_id, etc.
- Focus only on meaningful data like orders, browsing behavior, communication history, interests, etc.

🎯 Task:
Give exactly 3 one-line actionable recommendations, each starting with an emoji like ✅ 📈 🔥.
Keep them short, friendly, and easy to implement.`;

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a CRM assistant suggesting short, emoji-based recommendations to boost user engagement." },
      { role: "user", content: prompt + "\n\nHere is the user's data:\n" + JSON.stringify(userData, null, 2) }
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return completion.choices[0].message.content;
};



// API Endpoint
const util = require("util");
appExpress.post("/api/user-insights", async (req, res) => {
  const apiKey = req.headers["api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(200).json({ response: "Something went wrong, kindly contact on care@jwero.ai" });
  }

  const encryptedTenantId = req.headers["x-tenant-id"];
  const tenantId = decryptAES256(encryptedTenantId);
  console.log("🔐 Decrypted Tenant ID:", tenantId);
  const { crm_ids } = req.body;
  if (!Array.isArray(crm_ids) || crm_ids.length === 0) {
    return res.status(400).json({ error: "crm_ids array is required." });
  }

  const pool = createPoolForTenant(tenantId);

  try {
    const insights = await Promise.all(
      crm_ids.map(async (crm_id) => {
        try {
          const userData = await fetchUserData(pool, crm_id);
          const summary = await generateInsightSummary(userData, crm_id);
          const recommendations = await generateRecommendations(userData, crm_id);

          return { crm_id, summary, recommendations };
        } catch (err) {
          console.error("Error generating insights for CRM ID:", crm_id, err);
          return { crm_id, error: "Failed to generate insight." };
        }
      })
    );

    res.json({ insights });
  } catch (e) {
    console.error("Error processing request:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --------------------- Start Both Servers --------------------- //

(async () => {
  try {
    await slackApp.start(8080);
    console.log("✅ Slack bot is running on port 8080!");
  } catch (error) {
    console.error("❌ Failed to start Slack bot:", error.message);
  }
})();

appExpress.listen(API_PORT, () => {
  console.log(`✅ Express API server is running on port ${API_PORT}`);
});
