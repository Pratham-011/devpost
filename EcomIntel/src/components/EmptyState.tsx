
import React from 'react';
import { MessageCircle } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <div className="text-center mt-20">
      <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
        <MessageCircle className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to AI Assistant</h2>
      <p className="text-gray-600">Ask me anything to get started</p>
    </div>
  );
};

export default EmptyState;
