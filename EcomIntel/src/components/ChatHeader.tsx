
import React from 'react';
import { Menu } from 'lucide-react';

interface ChatHeaderProps {
  onMenuClick: () => void;
  tokenUsage: number;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onMenuClick, tokenUsage }) => {
  return (
    <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <button 
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-xl font-semibold text-gray-900 lg:block hidden">AI Assistant</h1>
      <div className="text-sm text-gray-500">
        {tokenUsage} / 100000 tokens used today
      </div>
    </header>
  );
};

export default ChatHeader;
