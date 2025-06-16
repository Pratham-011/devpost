
import React from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  onSendMessage: () => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  currentMessage,
  setCurrentMessage,
  onSendMessage,
  isLoading
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="border-t border-gray-200 p-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-4 bg-gray-50 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg focus-within:shadow-lg focus-within:ring-2 focus-within:ring-black/10">
          <div className="flex-1">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full bg-transparent border-none outline-none resize-none placeholder-gray-500 text-gray-900 transition-all duration-200"
              rows={1}
              style={{ minHeight: '24px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={onSendMessage}
            disabled={!currentMessage.trim() || isLoading}
            className="bg-black text-white p-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <Send className={`w-5 h-5 ${isLoading ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
