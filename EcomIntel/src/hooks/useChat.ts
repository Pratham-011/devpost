
// import { useState, useEffect, useRef } from 'react';
// import { toast } from '@/hooks/use-toast';

// interface Message {
//   _id?: string;
//   question: string;
//   response: string;
//   feedback?: boolean;
//   createdAt?: string;
//   isLoading?: boolean;
// }

// interface ApiResponse {
//   response: string;
//   id: string;
// }


// const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
// const API_KEY = import.meta.env.VITE_API_KEY;
// const USER_ID = import.meta.env.VITE_USER_ID;
// const TENANT_ID = import.meta.env.VITE_TENANT_ID;
// const USERNAME = import.meta.env.VITE_USERNAME;

// export const useChat = () => {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [currentMessage, setCurrentMessage] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [recentMessages, setRecentMessages] = useState<Message[]>([]);
//   const [tokenUsage, setTokenUsage] = useState(0);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   useEffect(() => {
//     fetchRecentMessages();
//   }, []);

//   const fetchRecentMessages = async () => {
//     try {
//       const response = await fetch(`${API_BASE}/api/recent-messages`, {
//         headers: {
//           'api-key': API_KEY,
//           'x-user-id': USER_ID,
//           'x-tenant-id': TENANT_ID,
//         },
//       });
      
//       if (response.ok) {
//         const data = await response.json();
//         setRecentMessages(data.messages || []);
//         setTokenUsage(data.totalUsedToday || 0);
//       }
//     } catch (error) {
//       console.error('Failed to fetch recent messages:', error);
//     }
//   };

//   const sendMessage = async () => {
//     if (!currentMessage.trim() || isLoading) return;

//     const userMessage = currentMessage;
//     setCurrentMessage('');
//     setIsLoading(true);
    
//     // Add user message immediately
//     const userMsg: Message = { question: userMessage, response: '', isLoading: false };
//     setMessages(prev => [...prev, userMsg]);
    
//     // Add loading message
//     const loadingMsg: Message = { question: '', response: '', isLoading: true };
//     setMessages(prev => [...prev, loadingMsg]);

//     try {
//       const response = await fetch(`${API_BASE}/api/question`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'api-key': API_KEY,
//           'x-user-id': USER_ID,
//           'x-tenant-id': TENANT_ID,
//           'username': USERNAME,
//         },
//         body: JSON.stringify({ question: userMessage }),
//       });

//       const data: ApiResponse = await response.json();
      
//       // Remove loading message and update with actual response
//       setMessages(prev => {
//         const messagesWithoutLoading = prev.slice(0, -1);
//         return [
//           ...messagesWithoutLoading.slice(0, -1),
//           {
//             _id: data.id,
//             question: userMessage,
//             response: data.response,
//             isLoading: false
//           }
//         ];
//       });
      
//       // Refresh recent messages and token usage
//       fetchRecentMessages();
      
//     } catch (error) {
//       console.error('Error sending message:', error);
//       setMessages(prev => {
//         const messagesWithoutLoading = prev.slice(0, -1);
//         return [
//           ...messagesWithoutLoading.slice(0, -1),
//           {
//             question: userMessage,
//             response: 'Sorry, something went wrong. Please try again.',
//             isLoading: false
//           }
//         ];
//       });
//       toast({
//         title: "Error",
//         description: "Failed to send message. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const updateFeedback = async (messageId: string, feedback: boolean) => {
//     try {
//       const response = await fetch(`${API_BASE}/api/update-feedback`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           'api-key': API_KEY,
//           'x-user-id': USER_ID,
//           'x-tenant-id': TENANT_ID,
//         },
//         body: JSON.stringify({ id: messageId, feedback }),
//       });

//       if (response.ok) {
//         setMessages(prev => 
//           prev.map(msg => 
//             msg._id === messageId ? { ...msg, feedback } : msg
//           )
//         );
//         setRecentMessages(prev => 
//           prev.map(msg => 
//             msg._id === messageId ? { ...msg, feedback } : msg
//           )
//         );
//         toast({
//           title: "Feedback Updated",
//           description: "Thank you for your feedback!",
//         });
//       }
//     } catch (error) {
//       console.error('Error updating feedback:', error);
//       toast({
//         title: "Error",
//         description: "Failed to update feedback.",
//         variant: "destructive",
//       });
//     }
//   };

//   return {
//     messages,
//     currentMessage,
//     setCurrentMessage,
//     isLoading,
//     recentMessages,
//     tokenUsage,
//     messagesEndRef,
//     sendMessage,
//     updateFeedback
//   };
// };





import { useState, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

interface Message {
  _id?: string;
  question: string;
  response: string;
  feedback?: boolean;
  createdAt?: string;
  isLoading?: boolean;
  contentType?: string;
}

interface ApiResponse {
  response: string;
  id: string;
  contentType: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'https://bot-kkha.onrender.com';
const API_KEY = import.meta.env.VITE_API_KEY;
const USER_ID = import.meta.env.VITE_USER_ID;
const TENANT_ID = import.meta.env.VITE_TENANT_ID;
const USERNAME = import.meta.env.VITE_USERNAME;

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [tokenUsage, setTokenUsage] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchRecentMessages();
  }, []);

  const fetchRecentMessages = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/recent-messages`, {
        headers: {
          'api-key': API_KEY,
          'x-user-id': USER_ID,
          'x-tenant-id': TENANT_ID,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const updatedMessages = (data.messages || []).map((msg: Message) => ({
          ...msg,
          contentType: msg.contentType || 'text/plain',
        }));
        setRecentMessages(updatedMessages);
        setTokenUsage(data.totalUsedToday || 0);
      }
    } catch (error) {
      console.error('Failed to fetch recent messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);
    
    // Add user message
    const userMsg: Message = { question: userMessage, response: '', isLoading: false, contentType: 'text/plain' };
    setMessages(prev => [...prev, userMsg]);
    
    // Add loading message
    const loadingMsg: Message = { question: '', response: '', isLoading: true, contentType: 'text/plain' };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const response = await fetch(`${API_BASE}/api/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': API_KEY,
          'x-user-id': USER_ID,
          'x-tenant-id': TENANT_ID,
          'username': USERNAME,
        },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      
      // Sanitize HTML response
      const sanitizedResponse = data.contentType === 'text/html' 
        ? DOMPurify.sanitize(data.response, { ADD_TAGS: ['canvas', 'script', 'src'], ADD_ATTR: ['id', 'style', 'src'] })
        : data.response;

      // Replace loading message with API response
      setMessages(prev => {
        const messagesWithoutLoading = prev.slice(0, -1); // Remove loading message
        return [
          ...messagesWithoutLoading,
          {
            _id: data.id,
            question: '',
            response: sanitizedResponse,
            isLoading: false,
            contentType: data.contentType
          }
        ];
      });
      
      // Refresh recent messages and token usage
      fetchRecentMessages();
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse = '<div style="font-family: Arial, sans-serif; padding: 20px; color: #d32f2f;">Sorry, something went wrong. Please try again.</div>';
      setMessages(prev => {
        const messagesWithoutLoading = prev.slice(0, -1); // Remove loading message
        return [
          ...messagesWithoutLoading,
          {
            question: '',
            response: errorResponse,
            isLoading: false,
            contentType: 'text/html'
          }
        ];
      });
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFeedback = async (messageId: string, feedback: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/update-feedback`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': API_KEY,
          'x-user-id': USER_ID,
          'x-tenant-id': TENANT_ID,
        },
        body: JSON.stringify({ id: messageId, feedback }),
      });

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === messageId ? { ...msg, feedback } : msg
          )
        );
        setRecentMessages(prev => 
          prev.map(msg => 
            msg._id === messageId ? { ...msg, feedback } : msg
          )
        );
        toast({
          title: "Feedback Updated",
          description: "Thank you for your feedback!",
        });
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        title: "Error",
        description: "Failed to update feedback.",
        variant: "destructive",
      });
    }
  };

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    recentMessages,
    tokenUsage,
    messagesEndRef,
    sendMessage,
    updateFeedback
  };
};