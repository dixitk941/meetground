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
  Hand,
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
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3 py-2 md:py-3 px-2 sm:px-4 md:px-6 bg-[#0a0a0a] border-t border-[#222222]">
      {/* Left Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
        {/* Mic */}
        <button
          onClick={onToggleMic}
          disabled={!canUseMic}
          className={`p-2.5 md:p-3 rounded-xl transition-all ${
            !canUseMic 
              ? 'bg-[#111111] opacity-50 cursor-not-allowed' 
              : isMicOn 
                ? 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]' 
                : 'bg-red-600 hover:bg-red-700'
          }`}
          title={!canUseMic ? 'Mic disabled by admin' : isMicOn ? 'Turn off mic' : 'Turn on mic'}
        >
          {isMicOn ? (
            <Mic className="w-4 h-4 md:w-5 md:h-5 text-white" />
          ) : (
            <MicOff className="w-4 h-4 md:w-5 md:h-5 text-white" />
          )}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          className={`p-2.5 md:p-3 rounded-xl transition-all ${
            isCameraOn 
              ? 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? (
            <Video className="w-4 h-4 md:w-5 md:h-5 text-white" />
          ) : (
            <VideoOff className="w-4 h-4 md:w-5 md:h-5 text-white" />
          )}
        </button>

        {/* Screen Share - Hidden on mobile */}
        <button
          onClick={handleScreenShare}
          disabled={!canShareScreen}
          className={`hidden sm:block p-2.5 md:p-3 rounded-xl transition-all ${
            !canShareScreen 
              ? 'bg-[#111111] opacity-50 cursor-not-allowed' 
              : isScreenSharing 
                ? 'bg-white text-black' 
                : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]'
          }`}
          title={!canShareScreen ? 'Screen share disabled by admin' : isScreenSharing ? 'Stop presenting' : 'Present now'}
        >
          <MonitorUp className={`w-4 h-4 md:w-5 md:h-5 ${isScreenSharing ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Recording - Admin only, hidden on mobile */}
        {isAdmin && (
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`hidden md:block p-2.5 md:p-3 rounded-xl transition-all ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]'
            }`}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <StopCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
            ) : (
              <CircleDot className="w-4 h-4 md:w-5 md:h-5 text-white" />
            )}
          </button>
        )}
      </div>

      {/* Center - Leave Button */}
      <button
        onClick={onLeaveMeeting}
        className="mx-1 sm:mx-2 md:mx-4 px-4 sm:px-5 md:px-6 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center gap-1.5 md:gap-2"
        title="Leave meeting"
      >
        <Phone className="w-4 h-4 md:w-5 md:h-5 text-white rotate-[135deg]" />
        <span className="text-white font-medium text-sm hidden sm:inline">Leave</span>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
        {/* Participants */}
        <button
          onClick={onToggleParticipants}
          className={`p-2.5 md:p-3 rounded-xl transition-all ${
            activePanel === 'participants' 
              ? 'bg-white text-black' 
              : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]'
          }`}
          title="Participants"
        >
          <Users className={`w-4 h-4 md:w-5 md:h-5 ${activePanel === 'participants' ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Chat */}
        <button
          onClick={onToggleChat}
          className={`p-2.5 md:p-3 rounded-xl transition-all ${
            activePanel === 'chat' 
              ? 'bg-white text-black' 
              : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]'
          }`}
          title="Chat"
        >
          <MessageSquare className={`w-4 h-4 md:w-5 md:h-5 ${activePanel === 'chat' ? 'text-black' : 'text-white'}`} />
        </button>

        {/* Admin Panel - Hidden on small screens */}
        {isAdmin && (
          <button
            onClick={onToggleAdmin}
            className={`hidden sm:block p-2.5 md:p-3 rounded-xl transition-all ${
              activePanel === 'admin' 
                ? 'bg-white text-black' 
                : 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333]'
            }`}
            title="Admin controls"
          >
            <Shield className={`w-4 h-4 md:w-5 md:h-5 ${activePanel === 'admin' ? 'text-black' : 'text-white'}`} />
          </button>
        )}

        {/* More Options */}
        <div className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className="p-2.5 md:p-3 rounded-xl bg-[#1a1a1a] hover:bg-[#222222] border border-[#333333] transition-all"
            title="More options"
          >
            <MoreVertical className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </button>

          {showMore && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMore(false)}
              />
              <div className="absolute bottom-full right-0 mb-2 bg-[#111111] border border-[#222222] rounded-xl shadow-xl py-1 min-w-[180px] z-50">
                {/* Mobile-only options */}
                <div className="sm:hidden">
                  <button
                    onClick={() => {
                      handleScreenShare();
                      setShowMore(false);
                    }}
                    disabled={!canShareScreen}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-white hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
                  >
                    <MonitorUp className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          isRecording ? onStopRecording() : onStartRecording();
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-white hover:bg-[#1a1a1a] transition-colors"
                      >
                        {isRecording ? (
                          <StopCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CircleDot className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm">{isRecording ? 'Stop Recording' : 'Record'}</span>
                      </button>
                      <button
                        onClick={() => {
                          onToggleAdmin();
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-white hover:bg-[#1a1a1a] transition-colors"
                      >
                        <Shield className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm">Host Controls</span>
                      </button>
                    </>
                  )}
                  <div className="border-t border-[#222222] my-1" />
                </div>
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
