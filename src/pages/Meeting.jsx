import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeeting } from '../context/MeetingContext';
import VideoGrid from '../components/VideoGrid';
import MeetingControls from '../components/MeetingControls';
import Sidebar from '../components/Sidebar';
import Whiteboard from '../components/Whiteboard';
import CodePlayground from '../components/CodePlayground';
import ParticipantsList from '../components/ParticipantsList';
import ChatPanel from '../components/ChatPanel';
import AdminPanel from '../components/AdminPanel';
import RecordingIndicator from '../components/RecordingIndicator';
import MessageToast from '../components/MessageToast';
import { Copy, Check, X, LayoutGrid, Presentation, Code, Menu, Download } from 'lucide-react';

const Meeting = () => {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const { user, getDisplayName } = useAuth();
  const { 
    joinMeeting, 
    leaveMeeting, 
    subscribeToMeeting,
    participants,
    isAdmin,
    activeView,
    updateActiveView,
    initializeMedia,
    localStream,
    isMicOn,
    isCameraOn,
    toggleMic,
    toggleCamera,
    meetingSettings,
  } = useMeeting();

  const [sidebarContent, setSidebarContent] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showMeetingInfo, setShowMeetingInfo] = useState(false);
  const [newMessages, setNewMessages] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioContextRef = useRef(null);

  // Handle new messages for toast notifications
  const handleNewMessage = useCallback((message) => {
    setNewMessages(prev => [...prev, message]);
    // Auto-remove after 6 seconds
    setTimeout(() => {
      setNewMessages(prev => prev.filter(m => m.id !== message.id));
    }, 6000);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    let isMounted = true;

    const initMeeting = async () => {
      try {
        // First initialize media to get the stream
        const stream = await initializeMedia();
        console.log('Media initialized, stream:', !!stream);
        
        if (!isMounted) return;
        
        // Then join the meeting
        await joinMeeting(meetingId, user.uid, getDisplayName());
        console.log('Joined meeting:', meetingId);
        
        if (!isMounted) return;
        
        // Give React time to update state before subscribing
        setTimeout(() => {
          if (isMounted) {
            subscribeToMeeting(meetingId);
            console.log('Subscribed to meeting');
          }
        }, 500);
      } catch (error) {
        console.error('Error joining meeting:', error);
        if (isMounted) {
          navigate('/');
        }
      }
    };

    initMeeting();

    return () => {
      isMounted = false;
      leaveMeeting(user?.uid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, user]);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleLeaveMeeting = async () => {
    if (isRecording) {
      await stopRecording();
    }
    await leaveMeeting(user?.uid);
    navigate('/');
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/lobby/${meetingId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startRecording = async () => {
    try {
      // Get screen with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true,
      });

      // Create audio context for mixing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      
      // Add local audio
      if (localStream && localStream.getAudioTracks().length > 0) {
        try {
          const localAudio = audioContext.createMediaStreamSource(localStream);
          localAudio.connect(destination);
        } catch (e) {
          console.log('Could not add local audio:', e);
        }
      }

      // Add display audio
      if (displayStream.getAudioTracks().length > 0) {
        try {
          const displayAudio = audioContext.createMediaStreamSource(displayStream);
          displayAudio.connect(destination);
        } catch (e) {
          console.log('Could not add display audio:', e);
        }
      }

      // Create mixed stream
      const mixedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      // Use optimal codec
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 3000000, // 3 Mbps
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Save recording to local system
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date();
        const filename = `MeetGround-Recording-${date.toISOString().split('T')[0]}-${date.getHours()}${date.getMinutes()}.webm`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        recordedChunksRef.current = [];
        displayStream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);

      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const toggleSidebar = (content) => {
    setSidebarContent(prev => prev === content ? null : content);
  };

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-[#222222] bg-[#0a0a0a] z-10">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button
              onClick={() => setShowMeetingInfo(!showMeetingInfo)}
              className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-[#111111] transition-colors border border-transparent hover:border-[#222222]"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white flex items-center justify-center">
                <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4 text-black" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-white font-medium text-sm">Meeting</p>
                <p className="text-gray-500 text-xs font-mono">{meetingId}</p>
              </div>
            </button>
            
            {showMeetingInfo && (
              <div className="absolute top-full left-0 mt-2 bg-[#111111] border border-[#222222] rounded-xl shadow-xl p-4 w-72 md:w-80 z-50">
                <h3 className="text-white font-medium mb-3 text-sm">Meeting details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Meeting ID</p>
                    <p className="text-white font-mono">{meetingId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Invite link</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/lobby/${meetingId}`}
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#222222] rounded-lg text-white text-xs font-mono"
                      />
                      <button
                        onClick={copyMeetingLink}
                        className="p-2 bg-[#1a1a1a] hover:bg-[#222222] rounded-lg transition-colors border border-[#222222]"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowMeetingInfo(false)}
                  className="absolute top-3 right-3 p-1.5 hover:bg-[#222222] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
          </div>

          {isRecording && <RecordingIndicator time={recordingTime} />}
        </div>

        {/* View Switcher - Hidden on mobile, show toggle */}
        <div className="hidden md:flex items-center bg-[#111111] rounded-xl p-1 border border-[#222222]">
          <button
            onClick={() => isAdmin && updateActiveView('video')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors ${
              activeView === 'video' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm font-medium hidden lg:inline">Video</span>
          </button>
          <button
            onClick={() => isAdmin && updateActiveView('whiteboard')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors ${
              activeView === 'whiteboard' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <Presentation className="w-4 h-4" />
            <span className="text-sm font-medium hidden lg:inline">Whiteboard</span>
          </button>
          <button
            onClick={() => isAdmin && updateActiveView('code')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors ${
              activeView === 'code' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <Code className="w-4 h-4" />
            <span className="text-sm font-medium hidden lg:inline">Code</span>
          </button>
        </div>

        {/* Mobile view switcher */}
        <div className="flex md:hidden items-center gap-2">
          <div className="flex items-center bg-[#111111] rounded-lg p-0.5 border border-[#222222]">
            <button
              onClick={() => isAdmin && updateActiveView('video')}
              disabled={!isAdmin}
              className={`p-2 rounded-md transition-colors ${
                activeView === 'video' ? 'bg-white text-black' : 'text-gray-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => isAdmin && updateActiveView('whiteboard')}
              disabled={!isAdmin}
              className={`p-2 rounded-md transition-colors ${
                activeView === 'whiteboard' ? 'bg-white text-black' : 'text-gray-400'
              }`}
            >
              <Presentation className="w-4 h-4" />
            </button>
            <button
              onClick={() => isAdmin && updateActiveView('code')}
              disabled={!isAdmin}
              className={`p-2 rounded-md transition-colors ${
                activeView === 'code' ? 'bg-white text-black' : 'text-gray-400'
              }`}
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {!isAdmin && (
            <div className="hidden sm:flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <span className="text-yellow-500 text-xs font-medium">Viewing: {activeView}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-[#111111] rounded-lg border border-[#222222]">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300 text-xs md:text-sm">
              {participants.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main View */}
        <div className="flex-1 relative">
          {activeView === 'video' && (
            <VideoGrid participants={participants} localStream={localStream} />
          )}
          {activeView === 'whiteboard' && (
            <Whiteboard />
          )}
          {activeView === 'code' && (
            <CodePlayground />
          )}
        </div>

        {/* Sidebar - Full screen on mobile */}
        {sidebarContent && (
          <div className="fixed md:relative inset-0 md:inset-auto z-40 md:z-0">
            <div 
              className="absolute inset-0 bg-black/50 md:hidden" 
              onClick={() => setSidebarContent(null)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm md:relative md:w-auto">
              <Sidebar onClose={() => setSidebarContent(null)}>
                {sidebarContent === 'participants' && (
                  <ParticipantsList participants={participants} isAdmin={isAdmin} />
                )}
                {sidebarContent === 'chat' && (
                  <ChatPanel meetingId={meetingId} onNewMessage={handleNewMessage} />
                )}
                {sidebarContent === 'admin' && isAdmin && (
                  <AdminPanel />
                )}
              </Sidebar>
            </div>
          </div>
        )}
      </div>

      {/* Message Toast Notifications */}
      <MessageToast 
        messages={newMessages} 
        currentUserId={user?.uid}
        onDismiss={(id) => setNewMessages(prev => prev.filter(m => m.id !== id))}
      />

      {/* Controls */}
      <MeetingControls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isRecording={isRecording}
        isAdmin={isAdmin}
        meetingSettings={meetingSettings}
        onToggleMic={() => toggleMic(user?.uid)}
        onToggleCamera={() => toggleCamera(user?.uid)}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onToggleParticipants={() => toggleSidebar('participants')}
        onToggleChat={() => toggleSidebar('chat')}
        onToggleAdmin={() => toggleSidebar('admin')}
        onLeaveMeeting={handleLeaveMeeting}
        activePanel={sidebarContent}
      />
    </div>
  );
};

export default Meeting;
