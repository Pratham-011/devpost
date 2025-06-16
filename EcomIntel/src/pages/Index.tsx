import React, { useState } from 'react';
import { useChat } from '@/hooks/useChat';
import ChatSidebar from '@/components/ChatSidebar';
import ChatHeader from '@/components/ChatHeader';
import ChatInput from '@/components/ChatInput';
import MessageBubble from '@/components/MessageBubble';
import EmptyState from '@/components/EmptyState';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isLoading,
    recentMessages,
    tokenUsage,
    messagesEndRef,
    sendMessage,
    updateFeedback
  } = useChat();

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        recentMessages={recentMessages}
        tokenUsage={tokenUsage}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0 min-h-0">
        {/* Header */}
        <ChatHeader
          onMenuClick={() => setSidebarOpen(true)}
          tokenUsage={tokenUsage}
        />

        {/* Messages - This will take remaining space and scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                index={index}
                onFeedback={updateFeedback}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - Fixed at bottom */}
        <div className="flex-shrink-0">
          <ChatInput
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSendMessage={sendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;