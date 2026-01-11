import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  MoreVertical,
  Phone,
  Settings,
  CircleDot,
  StopCircle,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { useAuth } from '../context/AuthContext';

const MeetingControls = ({
  isMicOn,
  isCameraOn,
  isRecording,
  isAdmin,
  meetingSettings,
  onToggleMic,
  onToggleCamera,
  onStartRecording,
  onStopRecording,
  onToggleParticipants,
  onToggleChat,
  onToggleAdmin,
  onLeaveMeeting,
  activePanel,
}) => {
  const [showMore, setShowMore] = useState(false);
  const { startScreenShare, stopScreenShare, isScreenSharing } = useMeeting();
  const { user } = useAuth();

  const canUseMic = isAdmin || meetingSettings?.allowParticipantMic;
  const canShareScreen = isAdmin || meetingSettings?.allowParticipantScreen;

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare(user?.uid);
      } else {
        await startScreenShare(user?.uid);
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 py-3 px-6 bg-[#0a0a0a] border-t border-[#222222]">
      {/* Left Controls */}
      <div className="flex items-center gap-2">
        {/* Mic */}
        <button
          onClick={onToggleMic}
          disabled={!canUseMic}
          className={`p-3 rounded-lg transition-colors ${
            !canUseMic 
              ? 'bg-[#111111] opacity-50 cursor-not-allowed' 
              : isMicOn 
                ? 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]' 
                : 'bg-red-600 hover:bg-red-700'
          }`}
          title={!canUseMic ? 'Mic disabled by admin' : isMicOn ? 'Turn off mic' : 'Turn on mic'}
        >
          {isMicOn ? (
            <Mic className="w-5 h-5 text-white" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-lg transition-colors ${
            isCameraOn 
              ? 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? (
            <Video className="w-5 h-5 text-white" />
          ) : (
            <VideoOff className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={handleScreenShare}
          disabled={!canShareScreen}
          className={`p-3 rounded-lg transition-colors ${
            !canShareScreen 
              ? 'bg-[#111111] opacity-50 cursor-not-allowed' 
              : isScreenSharing 
                ? 'bg-white text-black' 
                : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]'
          }`}
          title={!canShareScreen ? 'Screen share disabled by admin' : isScreenSharing ? 'Stop presenting' : 'Present now'}
        >
          <MonitorUp className={`w-5 h-5 ${isScreenSharing ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Recording */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`p-3 rounded-lg transition-colors ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]'
          }`}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <StopCircle className="w-5 h-5 text-white" />
          ) : (
            <CircleDot className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Center - Leave Button */}
      <button
        onClick={onLeaveMeeting}
        className="mx-4 px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
        title="Leave meeting"
      >
        <Phone className="w-5 h-5 text-white rotate-[135deg]" />
        <span className="text-white font-medium">Leave</span>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Participants */}
        <button
          onClick={onToggleParticipants}
          className={`p-3 rounded-lg transition-colors ${
            activePanel === 'participants' 
              ? 'bg-white text-black' 
              : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]'
          }`}
          title="Participants"
        >
          <Users className={`w-5 h-5 ${activePanel === 'participants' ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Chat */}
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-lg transition-colors ${
            activePanel === 'chat' 
              ? 'bg-white text-black' 
              : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]'
          }`}
          title="Chat"
        >
          <MessageSquare className={`w-5 h-5 ${activePanel === 'chat' ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Admin Panel */}
        {isAdmin && (
          <button
            onClick={onToggleAdmin}
            className={`p-3 rounded-lg transition-colors ${
              activePanel === 'admin' 
                ? 'bg-white text-black' 
                : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]'
            }`}
            title="Admin controls"
          >
            <Shield className={`w-5 h-5 ${activePanel === 'admin' ? 'text-black' : 'text-white'}`} />
          </button>
        )}

        {/* More Options */}
        <div className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className="p-3 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222] transition-colors"
            title="More options"
          >
            <MoreVertical className="w-5 h-5 text-white" />
          </button>

          {showMore && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMore(false)}
              />
              <div className="absolute bottom-full right-0 mb-2 bg-[#111111] border border-[#222222] rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-white hover:bg-[#1a1a1a] transition-colors"
                  onClick={() => setShowMore(false)}
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Settings</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingControls;
