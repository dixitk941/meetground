import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeeting } from '../context/MeetingContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  User,
} from 'lucide-react';

const Lobby = () => {
  const navigate = useNavigate();
  const { meetingId: urlMeetingId } = useParams();
  const { user, getDisplayName, signInAsGuest } = useAuth();
  const { createMeeting, joinMeeting, initializeMedia } = useMeeting();

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [stream, setStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const videoRef = useRef(null);

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        setHasVideo(videoDevices.length > 0);
        setHasAudio(audioDevices.length > 0);

        if (videoDevices.length === 0 && audioDevices.length === 0) {
          setMediaError('No camera or microphone found');
          return;
        }

        const constraints = {
          video: videoDevices.length > 0,
          audio: audioDevices.length > 0,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStream.getAudioTracks().forEach(track => track.enabled = false);
        mediaStream.getVideoTracks().forEach(track => track.enabled = false);
        setStream(mediaStream);
        setMediaError(null);
      } catch (error) {
        console.error('Error accessing media:', error);
        if (error.name === 'NotAllowedError') {
          setMediaError('Camera/microphone access denied');
        } else if (error.name === 'NotFoundError') {
          setMediaError('No camera or microphone found');
        } else {
          setMediaError('Could not access media devices');
        }
      }
    };

    setupMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraOn]);

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const handleJoinMeeting = async () => {
    if (!user) {
      setShowGuestInput(true);
      return;
    }

    setIsLoading(true);
    try {
      await initializeMedia();
      
      let finalMeetingId;
      if (urlMeetingId) {
        finalMeetingId = await joinMeeting(urlMeetingId, user.uid, getDisplayName());
      } else {
        finalMeetingId = await createMeeting(user.uid, getDisplayName());
      }
      
      navigate(`/meeting/${finalMeetingId}`);
    } catch (error) {
      console.error('Error joining meeting:', error);
      if (error.message === 'Meeting not found') {
        alert('Meeting not found. Please check the meeting code.');
      } else {
        alert(error.message || 'Failed to join meeting. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestJoin = async () => {
    if (!guestName.trim()) return;
    
    await signInAsGuest(guestName.trim());
    setShowGuestInput(false);
    setTimeout(() => handleJoinMeeting(), 500);
  };

  const displayName = user?.displayName || guestName || 'Guest';

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#222222]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-[#111111]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <Video className="w-4 h-4 text-black" />
          </div>
          <span className="text-lg font-semibold text-white">MeetGround</span>
        </div>
        <div className="w-24" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-8 items-start">
          {/* Video Preview Card */}
          <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-hidden">
            <div className="relative aspect-video bg-[#0a0a0a]">
              {isCameraOn && stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#222222] flex items-center justify-center">
                    <span className="text-3xl text-white font-medium">
                      {displayName[0].toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 p-4 border-t border-[#222222]">
              <button
                onClick={toggleMic}
                disabled={!hasAudio && !stream?.getAudioTracks().length}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  !hasAudio || !stream?.getAudioTracks().length
                    ? 'bg-[#1a1a1a] cursor-not-allowed opacity-50'
                    : isMicOn 
                      ? 'bg-[#1a1a1a] hover:bg-[#222222]' 
                      : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isMicOn ? (
                  <Mic className="w-5 h-5 text-white" />
                ) : (
                  <MicOff className="w-5 h-5 text-white" />
                )}
              </button>
              <button
                onClick={toggleCamera}
                disabled={!hasVideo && !stream?.getVideoTracks().length}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  !hasVideo || !stream?.getVideoTracks().length
                    ? 'bg-[#1a1a1a] cursor-not-allowed opacity-50'
                    : isCameraOn 
                      ? 'bg-[#1a1a1a] hover:bg-[#222222]' 
                      : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isCameraOn ? (
                  <Video className="w-5 h-5 text-white" />
                ) : (
                  <VideoOff className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Join Panel Card */}
          <div className="bg-[#111111] border border-[#222222] rounded-lg p-6">
            <h1 className="text-2xl font-semibold text-white mb-2">
              {urlMeetingId ? 'Ready to join?' : 'Start a meeting'}
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              {urlMeetingId 
                ? 'Check your video and audio before joining.' 
                : 'Create a new meeting and invite others.'}
            </p>

            {urlMeetingId && (
              <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-1">Meeting code</p>
                <p className="text-white font-mono">{urlMeetingId}</p>
              </div>
            )}

            {/* Device Status */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                {hasAudio || stream?.getAudioTracks().length ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className="text-gray-400 text-sm">
                  {hasAudio || stream?.getAudioTracks().length ? 'Microphone ready' : 'No microphone'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {hasVideo || stream?.getVideoTracks().length ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className="text-gray-400 text-sm">
                  {hasVideo || stream?.getVideoTracks().length ? 'Camera ready' : 'No camera'}
                </span>
              </div>
            </div>

            {mediaError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <p className="text-yellow-500 text-xs">{mediaError}</p>
              </div>
            )}

            <button
              onClick={handleJoinMeeting}
              disabled={isLoading}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {urlMeetingId ? 'Joining...' : 'Creating...'}
                </span>
              ) : (
                urlMeetingId ? 'Join now' : 'Start meeting'
              )}
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>

      {/* Guest Name Modal */}
      {showGuestInput && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Enter your name</h3>
              <p className="text-gray-500 text-sm mt-1">This will be shown to others</p>
            </div>
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#222222] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#444444] mb-4 text-center"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
