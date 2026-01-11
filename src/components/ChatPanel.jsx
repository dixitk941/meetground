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
import { useMeeting } from '../context/MeetingContext';
import { Send, MessageSquare, Lock, Users, ChevronDown, Search } from 'lucide-react';

const ChatPanel = ({ meetingId, onNewMessage }) => {
  const { user, getDisplayName } = useAuth();
  const { participants } = useMeeting();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatMode, setChatMode] = useState('everyone'); // 'everyone' or participant id
  const [showRecipientMenu, setShowRecipientMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    if (!meetingId) return;

    const messagesRef = collection(db, 'meetings', meetingId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Show message if:
        // 1. It's a public message (no recipientId)
        // 2. User sent it
        // 3. User is the recipient
        if (!data.recipientId || data.senderId === user?.uid || data.recipientId === user?.uid) {
          messagesList.push({ id: doc.id, ...data });
        }
      });
      setMessages(messagesList);
      
      // Notify about new messages
      if (messagesList.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
        const newMessages = messagesList.slice(lastMessageCountRef.current);
        newMessages.forEach(msg => {
          if (msg.senderId !== user?.uid) {
            onNewMessage?.(msg);
          }
        });
      }
      lastMessageCountRef.current = messagesList.length;
    });

    return () => unsubscribe();
  }, [meetingId, user, onNewMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !meetingId || !user) return;

    const messageData = {
      text: newMessage.trim(),
      senderId: user.uid,
      senderName: getDisplayName(),
      timestamp: serverTimestamp(),
    };

    // Add recipient for private messages
    if (chatMode !== 'everyone') {
      const recipient = participants.find(p => p.id === chatMode);
      messageData.recipientId = chatMode;
      messageData.recipientName = recipient?.displayName || 'Unknown';
      messageData.isPrivate = true;
    }

    try {
      await addDoc(collection(db, 'meetings', meetingId, 'messages'), messageData);
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

  const getRecipientName = () => {
    if (chatMode === 'everyone') return 'Everyone';
    const recipient = participants.find(p => p.id === chatMode);
    return recipient?.displayName || 'Unknown';
  };

  const filteredParticipants = participants.filter(p => 
    p.id !== user?.uid && 
    p.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-white">Messages</h2>
            <p className="text-xs text-gray-500">{messages.length} messages</p>
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
            <p className="text-xs text-gray-600 mt-1">Start the conversation!</p>
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
                {message.isPrivate && (
                  <span className="flex items-center gap-1 text-xs text-purple-400">
                    <Lock className="w-3 h-3" />
                    {message.senderId === user?.uid 
                      ? `to ${message.recipientName}` 
                      : 'Private'}
                  </span>
                )}
                <span className="text-xs text-gray-600">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl ${
                  message.senderId === user?.uid
                    ? message.isPrivate 
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-black'
                    : message.isPrivate
                      ? 'bg-purple-900/50 text-white border border-purple-700/50'
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

      {/* Recipient Selector */}
      <div className="px-3 pt-2">
        <div className="relative">
          <button
            onClick={() => setShowRecipientMenu(!showRecipientMenu)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors ${
              chatMode === 'everyone' 
                ? 'bg-[#111111] border-[#222222] text-gray-300' 
                : 'bg-purple-900/30 border-purple-700/50 text-purple-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {chatMode === 'everyone' ? (
                <Users className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span className="text-sm">
                {chatMode === 'everyone' ? 'Send to Everyone' : `Private: ${getRecipientName()}`}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showRecipientMenu ? 'rotate-180' : ''}`} />
          </button>

          {showRecipientMenu && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowRecipientMenu(false)}
              />
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#111111] border border-[#222222] rounded-xl shadow-xl overflow-hidden z-50">
                {/* Search */}
                <div className="p-2 border-b border-[#222222]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search participants..."
                      className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#222222] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#333333]"
                    />
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {/* Everyone option */}
                  <button
                    onClick={() => {
                      setChatMode('everyone');
                      setShowRecipientMenu(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors ${
                      chatMode === 'everyone' ? 'bg-[#1a1a1a]' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">Everyone</p>
                      <p className="text-gray-500 text-xs">Visible to all participants</p>
                    </div>
                  </button>

                  {/* Participants */}
                  {filteredParticipants.map((participant) => (
                    <button
                      key={participant.id}
                      onClick={() => {
                        setChatMode(participant.id);
                        setShowRecipientMenu(false);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors ${
                        chatMode === participant.id ? 'bg-purple-900/30' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#222222] flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {(participant.displayName || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-white text-sm">{participant.displayName}</p>
                        {participant.isAdmin && (
                          <span className="text-xs text-yellow-500">Host</span>
                        )}
                      </div>
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  ))}

                  {filteredParticipants.length === 0 && searchQuery && (
                    <p className="px-3 py-4 text-gray-500 text-sm text-center">
                      No participants found
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={chatMode === 'everyone' ? 'Message everyone...' : `Private message to ${getRecipientName()}...`}
            className={`flex-1 px-4 py-2.5 border rounded-xl text-white placeholder-gray-500 focus:outline-none text-sm transition-colors ${
              chatMode === 'everyone'
                ? 'bg-[#111111] border-[#222222] focus:border-[#333333]'
                : 'bg-purple-900/20 border-purple-700/50 focus:border-purple-600'
            }`}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              chatMode === 'everyone'
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-purple-600 text-white hover:bg-purple-500'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
