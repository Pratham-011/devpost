
import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface Message {
  _id?: string;
  question: string;
  response: string;
  feedback?: boolean;
  createdAt?: string;
  isLoading?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  index: number;
  onFeedback: (messageId: string, feedback: boolean) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, index, onFeedback }) => {
  return (
    <div key={index} className="space-y-4 animate-fade-in">
      {/* User Message */}
      {message.question && (
        <div className="flex justify-end">
          <div className="max-w-3xl bg-black text-white rounded-2xl px-6 py-4 shadow-lg transform hover:scale-[1.02] transition-all duration-200">
            <p className="whitespace-pre-wrap">{message.question}</p>
          </div>
        </div>
      )}
      
      {/* AI Response */}
      {(message.response || message.isLoading) && (
        <div className="flex justify-start">
          <div className="max-w-3xl">
            <div className="bg-gray-100 text-gray-900 rounded-2xl px-6 py-4 shadow-lg transform hover:scale-[1.02] transition-all duration-200">
              {message.isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-gray-500">Thinking...</span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.response}</p>
              )}
            </div>
            
            {/* Feedback Buttons */}
            {message._id && !message.isLoading && (
              <div className="flex items-center space-x-2 mt-3 ml-2 opacity-0 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                <button
                  onClick={() => onFeedback(message._id!, true)}
                  className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                    message.feedback === true 
                      ? 'bg-green-100 text-green-600 scale-110' 
                      : 'hover:bg-gray-100 text-gray-400'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onFeedback(message._id!, false)}
                  className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                    message.feedback === false 
                      ? 'bg-red-100 text-red-600 scale-110' 
                      : 'hover:bg-gray-100 text-gray-400'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
