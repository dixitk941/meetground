import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Video, 
  Keyboard, 
  Plus,
  LogIn,
  User,
  Users,
  MonitorPlay,
  Code2,
  Presentation
} from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signInAsGuest } = useAuth();
  const [meetingLink, setMeetingLink] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName] = useState('');

  const handleNewMeeting = async () => {
    if (!user) {
      setShowGuestInput(true);
      return;
    }
    navigate('/lobby');
  };

  const handleJoinMeeting = () => {
    if (meetingLink) {
      const meetingId = meetingLink.includes('/') 
        ? meetingLink.split('/').pop() 
        : meetingLink;
      navigate(`/lobby/${meetingId}`);
    }
  };

  const handleGuestJoin = async () => {
    if (guestName.trim()) {
      await signInAsGuest(guestName.trim());
      navigate('/lobby');
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <Video className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-semibold text-white">MeetGround</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[#111111] border border-[#222222]">
              <span className="text-gray-400 text-sm">{user.displayName || 'Guest'}</span>
              <div className="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Video meetings for everyone
            </h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Connect, collaborate, and create with built-in whiteboard, code editor, and recording.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-12">
            {/* New Meeting Card */}
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
              <h3 className="text-white font-medium mb-2">Start a new meeting</h3>
              <p className="text-gray-500 text-sm mb-4">Create a meeting and invite others</p>
              <button
                onClick={handleNewMeeting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                New meeting
              </button>
            </div>

            {/* Join Meeting Card */}
            <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
              <h3 className="text-white font-medium mb-2">Join a meeting</h3>
              <p className="text-gray-500 text-sm mb-4">Enter a code to join an existing meeting</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                    className="w-full pl-10 pr-3 py-3 bg-[#0a0a0a] border border-[#222222] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#444444] text-sm"
                  />
                </div>
                <button
                  onClick={handleJoinMeeting}
                  disabled={!meetingLink}
                  className="px-5 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#222222] transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed border border-[#222222]"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FeatureCard icon={<Video className="w-5 h-5" />} title="HD Video" />
            <FeatureCard icon={<Presentation className="w-5 h-5" />} title="Whiteboard" />
            <FeatureCard icon={<Code2 className="w-5 h-5" />} title="Code Editor" />
            <FeatureCard icon={<MonitorPlay className="w-5 h-5" />} title="Recording" />
          </div>
        </div>
      </main>

      {/* Guest Input Modal */}
      {showGuestInput && !user && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Enter your name</h3>
              <p className="text-gray-500 text-sm mt-1">This will be visible to others</p>
            </div>
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#222222] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#444444] mb-4 text-center"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowGuestInput(false)}
                className="flex-1 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors border border-[#222222]"
              >
                Cancel
              </button>
              <button
                onClick={handleGuestJoin}
                disabled={!guestName.trim()}
                className="flex-1 px-4 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
              >
                Continue
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-[#222222]">
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1a1a1a] border border-[#222222] rounded-lg text-white hover:bg-[#222222] transition-colors text-sm"
              >
                <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" />
                Continue with Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-[#222222]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center text-gray-600 text-sm gap-2">
          <p>© 2024 MeetGround</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title }) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-[#111111] border border-[#222222] rounded-lg">
    <div className="text-gray-400">{icon}</div>
    <span className="text-gray-400 text-sm">{title}</span>
  </div>
);

export default Home;
