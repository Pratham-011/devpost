
import React from 'react';
import { X, MessageCircle, Clock } from 'lucide-react';

interface Message {
  _id?: string;
  question: string;
  response: string;
  feedback?: boolean;
  createdAt?: string;
  isLoading?: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  recentMessages: Message[];
  tokenUsage: number;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  isOpen, 
  onClose, 
  recentMessages, 
  tokenUsage 
}) => {
  const usagePercentage = Math.min((tokenUsage / 100000) * 100, 100);

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-gray-50 border-r border-gray-200 transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Chat History</h1>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-lg transition-all duration-200 hover:shadow-md">
            <div className="text-sm text-gray-600">Today's Usage</div>
            <div className="text-lg font-semibold text-gray-900">{tokenUsage} / 100000 tokens</div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-black h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {recentMessages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8 animate-fade-in">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet</p>
            </div>
          ) : (
            recentMessages.slice(-20).reverse().map((msg, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer transform hover:scale-[1.02] animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <p className="text-sm text-gray-900 line-clamp-2 mb-2">{msg.question}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{msg.response}</p>
                {msg.createdAt && (
                  <div className="flex items-center mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
