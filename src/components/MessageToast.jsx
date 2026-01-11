import { useEffect, useState } from 'react';
import { X, MessageSquare, Lock } from 'lucide-react';

const MessageToast = ({ messages, currentUserId, onDismiss }) => {
  const [visibleToasts, setVisibleToasts] = useState([]);

  useEffect(() => {
    // Show only the last 3 messages from other users
    const recentMessages = messages
      .filter(msg => msg.senderId !== currentUserId)
      .slice(-3);
    
    setVisibleToasts(recentMessages);

    // Auto-dismiss after 5 seconds
    const timers = recentMessages.map((msg, index) => {
      return setTimeout(() => {
        setVisibleToasts(prev => prev.filter(m => m.id !== msg.id));
      }, 5000 + (index * 500));
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [messages, currentUserId]);

  const dismissToast = (id) => {
    setVisibleToasts(prev => prev.filter(m => m.id !== id));
    onDismiss?.(id);
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
      {visibleToasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-slide-up bg-[#111111]/95 backdrop-blur-lg border border-[#333333] rounded-xl shadow-2xl p-4 transition-all duration-300"
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              toast.isPrivate 
                ? 'bg-purple-500/20 border border-purple-500/30' 
                : 'bg-blue-500/20 border border-blue-500/30'
            }`}>
              {toast.isPrivate ? (
                <Lock className="w-4 h-4 text-purple-400" />
              ) : (
                <span className="text-lg font-semibold text-blue-400">
                  {(toast.senderName || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white text-sm truncate">
                  {toast.senderName || 'Unknown'}
                </span>
                {toast.isPrivate && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                    Private
                  </span>
                )}
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">
                {toast.text}
              </p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageToast;
