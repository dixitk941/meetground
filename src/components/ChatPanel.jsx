import { useState, useEffect, useRef } from 'react';
import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare } from 'lucide-react';

const ChatPanel = ({ meetingId }) => {
  const { user, getDisplayName } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!meetingId) return;

    const messagesRef = collection(db, 'meetings', meetingId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = [];
      snapshot.forEach((doc) => {
        messagesList.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messagesList);
    });

    return () => unsubscribe();
  }, [meetingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !meetingId || !user) return;

    try {
      await addDoc(collection(db, 'meetings', meetingId, 'messages'), {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: getDisplayName(),
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Chat</h2>
            <p className="text-xs text-gray-500">Visible to all</p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-[#111111] border border-[#222222] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">Be the first to send a message</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id}
              className={`flex flex-col ${
                message.senderId === user?.uid ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">
                  {message.senderId === user?.uid ? 'You' : message.senderName}
                </span>
                <span className="text-xs text-gray-600">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg ${
                  message.senderId === user?.uid
                    ? 'bg-white text-black'
                    : 'bg-[#1a1a1a] text-white border border-[#222222]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-[#222222]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-[#111111] border border-[#222222] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#333333] text-sm"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
