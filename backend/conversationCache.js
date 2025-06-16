// conversationCache.js
const getQueryHistoryModel = require("./schemas/getQueryHistoryModel"); 
// const conversationHistoryLimit = parseInt(process.env.CONVERSATION_HISTORY_LIMIT, 10) || 5;
const conversationHistoryLimit = parseInt(process.env.CONVERSATION_HISTORY_LIMIT);



// or require("./models/QueryHistory") if you're using a single model

// A global in-memory cache
// Key: `${tenantId}-${userId}`, Value: array of { question, response }
const conversationCache = {};

/**
 * Gets the conversation array for (tenantId, userId) from memory.
 * If not in memory, loads from DB (last 5 messages), stores in memory, then returns.
 */
async function getConversationArray(tenantId, userId) {
  const key = `${tenantId}-${userId}`;

  // If we already have an array in memory, return it
  if (conversationCache[key]) {
    return conversationCache[key];
  }

  // Otherwise, load the last 5 messages from DB
  const QueryHistoryModel = getQueryHistoryModel(tenantId);
  const recentDocs = await QueryHistoryModel
    .find({ tenantId, userId })
    .sort({ createdAt: -1 })
    .limit(conversationHistoryLimit)
    .lean();

  // Reverse if you want oldest at the front
  const conversationArray = recentDocs.reverse().map(doc => ({
    question: doc.question,
    response: doc.response,
    category: doc.category,
    sqlQuery: doc.sqlQuery
  }));

  // Store in memory
  conversationCache[key] = conversationArray;

  return conversationCache[key];
}

/**
 * Adds a new { question, response } to the conversation array in memory,
 * ensuring the array doesn't exceed 5 items. Also returns the updated array.
 */
function addToConversationArray(tenantId, userId, question, response) {
  const key = `${tenantId}-${userId}`;
  if (!conversationCache[key]) {
    conversationCache[key] = [];
  }
  conversationCache[key].push({ question, response });
  if (conversationCache[key].length > conversationHistoryLimit) {
    conversationCache[key].shift(); // remove oldest
  }
  return conversationCache[key];
}

module.exports = {
  conversationCache,
  getConversationArray,
  addToConversationArray,
};
