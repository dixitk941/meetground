import { useState, useEffect, useRef } from 'react';
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
import { Copy, Check, X, LayoutGrid, Presentation, Code } from 'lucide-react';

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

  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      if (localStream) {
        const localAudio = audioContext.createMediaStreamSource(localStream);
        localAudio.connect(destination);
      }

      if (displayStream.getAudioTracks().length > 0) {
        const displayAudio = audioContext.createMediaStreamSource(displayStream);
        displayAudio.connect(destination);
      }

      const mixedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-${meetingId}-${Date.now()}.webm`;
        a.click();
        recordedChunksRef.current = [];
        displayStream.getTracks().forEach(track => track.stop());
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
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#222222] bg-[#0a0a0a] z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowMeetingInfo(!showMeetingInfo)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#111111] transition-colors border border-transparent hover:border-[#222222]"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-black" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Meeting</p>
                <p className="text-gray-500 text-xs font-mono">{meetingId}</p>
              </div>
            </button>
            
            {showMeetingInfo && (
              <div className="absolute top-full left-0 mt-2 bg-[#111111] border border-[#222222] rounded-lg shadow-xl p-4 w-80 z-50">
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

        {/* View Switcher - Admin can switch, others see current view */}
        <div className="flex items-center bg-[#111111] rounded-lg p-1 border border-[#222222]">
          <button
            onClick={() => isAdmin && updateActiveView('video')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeView === 'video' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm font-medium">Video</span>
          </button>
          <button
            onClick={() => isAdmin && updateActiveView('whiteboard')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeView === 'whiteboard' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <Presentation className="w-4 h-4" />
            <span className="text-sm font-medium">Whiteboard</span>
          </button>
          <button
            onClick={() => isAdmin && updateActiveView('code')}
            disabled={!isAdmin}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeView === 'code' 
                ? 'bg-white text-black' 
                : isAdmin 
                  ? 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  : 'text-gray-500 cursor-default'
            }`}
          >
            <Code className="w-4 h-4" />
            <span className="text-sm font-medium">Code</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <span className="text-yellow-500 text-xs font-medium">Viewing: {activeView}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#111111] rounded-lg border border-[#222222]">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-300 text-sm">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
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

        {/* Sidebar */}
        {sidebarContent && (
          <Sidebar onClose={() => setSidebarContent(null)}>
            {sidebarContent === 'participants' && (
              <ParticipantsList participants={participants} isAdmin={isAdmin} />
            )}
            {sidebarContent === 'chat' && (
              <ChatPanel meetingId={meetingId} />
            )}
            {sidebarContent === 'admin' && isAdmin && (
              <AdminPanel />
            )}
          </Sidebar>
        )}
      </div>

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
