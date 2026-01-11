import { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Pin, 
  PinOff, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2,
  MoreVertical,
  Volume2,
  Hand
} from 'lucide-react';
import { useMeeting } from '../context/MeetingContext';

// Separate audio player component to handle remote audio
const AudioPlayer = ({ stream }) => {
  const audioRef = useRef(null);
  
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(e => {
        console.log('Audio autoplay prevented:', e);
      });
    }
  }, [stream]);
  
  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{ display: 'none' }}
    />
  );
};

// Audio level indicator hook
const useAudioLevel = (stream, isLocal) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setAudioLevel(0);
      return;
    }

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();

      return () => {
        cancelAnimationFrame(animationRef.current);
        audioContext.close();
      };
    } catch (e) {
      console.log('Audio level detection not available:', e);
    }
  }, [stream]);

  return audioLevel;
};

const VideoGrid = ({ participants, localStream }) => {
  const { remoteStreams, pinnedParticipant, pinParticipant, currentUserId } = useMeeting();
  const [currentPage, setCurrentPage] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  
  // Separate local user and remote participants
  const localParticipant = participants.find(p => p.id === currentUserId);
  const remoteParticipants = participants.filter(p => p.id !== currentUserId);
  
  // Find pinned participant data
  const pinnedParticipantData = pinnedParticipant 
    ? participants.find(p => p.id === pinnedParticipant)
    : null;

  // Calculate grid layout based on participant count
  const totalCount = participants.length;
  const shouldUseFocusMode = totalCount > 6 || focusMode || pinnedParticipant;
  
  const tilesPerPage = 4;
  
  const getFocusedParticipant = () => {
    if (pinnedParticipant) {
      return pinnedParticipantData;
    }
    if (activeSpeaker) {
      return participants.find(p => p.id === activeSpeaker);
    }
    const admin = participants.find(p => p.isAdmin);
    return admin || participants[0];
  };

  const getOtherParticipants = () => {
    const focused = getFocusedParticipant();
    return participants.filter(p => p.id !== focused?.id);
  };

  const focusedParticipant = getFocusedParticipant();
  const otherParticipants = getOtherParticipants();
  const totalPages = Math.ceil(otherParticipants.length / tilesPerPage);
  const visibleParticipants = otherParticipants.slice(
    currentPage * tilesPerPage,
    (currentPage + 1) * tilesPerPage
  );

  // Grid layout for simple mode
  if (!shouldUseFocusMode && totalCount <= 6) {
    return (
      <div className="h-full w-full p-3 md:p-4">
        <div className={`h-full grid gap-2 md:gap-3 ${getGridClasses(totalCount)}`}>
          {/* Local video tile */}
          {localParticipant && (
            <VideoTile
              key="local"
              stream={localStream}
              participant={localParticipant}
              isLocal={true}
              onPin={() => pinParticipant(currentUserId)}
              isPinned={pinnedParticipant === currentUserId}
              isActiveSpeaker={activeSpeaker === currentUserId}
            />
          )}
          
          {/* Remote participant tiles */}
          {remoteParticipants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={remoteStreams[participant.id]}
              participant={participant}
              isLocal={false}
              onPin={() => pinParticipant(participant.id)}
              isPinned={pinnedParticipant === participant.id}
              isActiveSpeaker={activeSpeaker === participant.id}
              onSpeaking={(speaking) => speaking && setActiveSpeaker(participant.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Focus mode with main speaker and side tiles
  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-2 md:gap-3 p-3 md:p-4">
      {/* Main focused video */}
      <div className="flex-1 relative min-h-0 h-[60%] lg:h-full">
        {focusedParticipant && (
          <VideoTile
            key={focusedParticipant.id}
            stream={focusedParticipant.id === currentUserId ? localStream : remoteStreams[focusedParticipant.id]}
            participant={focusedParticipant}
            isLocal={focusedParticipant.id === currentUserId}
            isFocused={true}
            onPin={() => pinParticipant(focusedParticipant.id)}
            isPinned={pinnedParticipant === focusedParticipant.id}
            isActiveSpeaker={activeSpeaker === focusedParticipant.id}
          />
        )}
        
        {/* Toggle focus mode button */}
        <button
          onClick={() => setFocusMode(!focusMode)}
          className="absolute top-3 right-3 md:top-4 md:right-4 p-2 bg-black/70 hover:bg-black/90 rounded-xl transition-all z-10 backdrop-blur-sm"
          title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          {focusMode ? (
            <Minimize2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
          ) : (
            <Maximize2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
          )}
        </button>
      </div>

      {/* Side tiles with pagination */}
      {otherParticipants.length > 0 && (
        <div className="lg:w-64 xl:w-72 flex flex-col gap-2 h-[35%] lg:h-full">
          {/* Pagination header */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 shrink-0">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-gray-400 text-sm">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {/* Side video tiles */}
          <div className="flex-1 flex flex-row lg:flex-col gap-2 overflow-hidden min-h-0">
            {visibleParticipants.map((participant) => (
              <VideoTile
                key={participant.id}
                stream={participant.id === currentUserId ? localStream : remoteStreams[participant.id]}
                participant={participant}
                isLocal={participant.id === currentUserId}
                isSmall={true}
                onPin={() => pinParticipant(participant.id)}
                isPinned={pinnedParticipant === participant.id}
                isActiveSpeaker={activeSpeaker === participant.id}
                onSpeaking={(speaking) => speaking && setActiveSpeaker(participant.id)}
              />
            ))}
          </div>

          {/* Participant count indicator */}
          <div className="text-center text-gray-500 text-xs shrink-0">
            {otherParticipants.length + 1} participants
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get responsive grid classes
const getGridClasses = (count) => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 md:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-2 md:grid-cols-3';
};

const VideoTile = ({ 
  stream, 
  participant,
  isLocal = false,
  isFocused = false,
  isSmall = false,
  onPin,
  isPinned = false,
  isActiveSpeaker = false,
  onSpeaking,
}) => {
  const videoRef = useRef(null);
  const name = participant?.displayName || 'Guest';
  const isMicOn = participant?.isMicOn ?? false;
  const isCameraOn = participant?.isCameraOn ?? false;
  const isAdmin = participant?.isAdmin ?? false;
  const audioLevel = useAudioLevel(stream, isLocal);
  const [showMenu, setShowMenu] = useState(false);

  // Detect speaking
  useEffect(() => {
    if (audioLevel > 0.1 && isMicOn) {
      onSpeaking?.(true);
    }
  }, [audioLevel, isMicOn, onSpeaking]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.log('Video autoplay prevented:', e);
      });
    }
  }, [stream]);

  const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
  const shouldShowVideo = stream && hasVideoTracks;
  const hasAudioTracks = stream && stream.getAudioTracks().length > 0;
  const isSpeaking = audioLevel > 0.1 && isMicOn;

  // Dynamic border based on speaking
  const borderClass = isSpeaking || isActiveSpeaker
    ? 'ring-2 ring-green-500 ring-opacity-75'
    : isPinned
    ? 'ring-2 ring-white ring-opacity-50'
    : '';

  return (
    <div className={`relative rounded-xl md:rounded-2xl overflow-hidden bg-[#111111] transition-all duration-300 ${borderClass} ${
      isFocused ? 'h-full' : isSmall ? 'flex-1 min-h-[80px] lg:h-auto lg:flex-none' : 'aspect-video'
    } group`}>
      {/* Audio player for remote participants */}
      {!isLocal && hasAudioTracks && (
        <AudioPlayer stream={stream} />
      )}
      
      {shouldShowVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`absolute inset-0 w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : null}
      
      {/* Avatar when no video or camera off */}
      {(!shouldShowVideo || !isCameraOn) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#111111] to-[#0a0a0a]">
          <div className={`${
            isFocused ? 'w-24 h-24 md:w-32 md:h-32' : isSmall ? 'w-10 h-10 md:w-12 md:h-12' : 'w-16 h-16 md:w-20 md:h-20'
          } rounded-2xl bg-gradient-to-br from-[#222222] to-[#1a1a1a] border border-[#333333] flex items-center justify-center transition-transform ${
            isSpeaking ? 'scale-110' : ''
          }`}>
            <span className={`${
              isFocused ? 'text-4xl md:text-5xl' : isSmall ? 'text-base md:text-lg' : 'text-2xl md:text-3xl'
            } font-semibold text-white`}>
              {(name || 'U')[0].toUpperCase()}
            </span>
          </div>
          
          {/* Audio visualizer when speaking */}
          {isSpeaking && (
            <div className="absolute bottom-1/3 flex gap-1 items-end">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-green-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 20 + 10}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

      {/* Name badge */}
      <div className={`absolute ${isSmall ? 'bottom-1.5 left-1.5' : 'bottom-2 left-2 md:bottom-3 md:left-3'} flex items-center`}>
        <div className={`flex items-center gap-1.5 md:gap-2 ${isSmall ? 'px-2 py-1' : 'px-2.5 py-1.5 md:px-3 md:py-2'} bg-black/60 backdrop-blur-sm rounded-lg md:rounded-xl`}>
          {/* Mic indicator */}
          <div className={`${isMicOn ? 'text-green-500' : 'text-red-500'}`}>
            {isMicOn ? (
              <div className="relative">
                <Mic className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5 md:w-4 md:h-4'}`} />
                {isSpeaking && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                )}
              </div>
            ) : (
              <MicOff className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5 md:w-4 md:h-4'}`} />
            )}
          </div>
          
          {/* Name */}
          <span className={`text-white ${isSmall ? 'text-xs' : 'text-xs md:text-sm'} font-medium truncate ${isSmall ? 'max-w-[60px]' : 'max-w-[100px] md:max-w-[120px]'}`}>
            {name}
          </span>
          
          {/* Admin badge */}
          {isAdmin && (
            <span className="text-yellow-500 text-xs">★</span>
          )}
        </div>
      </div>

      {/* Pin button */}
      <button 
        onClick={onPin}
        className={`absolute ${isSmall ? 'top-1.5 right-1.5' : 'top-2 right-2 md:top-3 md:right-3'} p-1.5 md:p-2 bg-black/60 backdrop-blur-sm rounded-lg md:rounded-xl opacity-0 group-hover:opacity-100 transition-all ${isPinned ? '!opacity-100 bg-white' : ''}`}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? (
          <PinOff className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5 md:w-4 md:h-4'} text-black`} />
        ) : (
          <Pin className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5 md:w-4 md:h-4'} text-white`} />
        )}
      </button>

      {/* Local indicator */}
      {isLocal && (
        <div className={`absolute ${isSmall ? 'top-1.5 left-1.5' : 'top-2 left-2 md:top-3 md:left-3'} flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg md:rounded-xl`}>
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-white font-medium">YOU</span>
        </div>
      )}

      {/* Speaking indicator for focused view */}
      {isFocused && isSpeaking && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-green-500/20 backdrop-blur-sm rounded-full border border-green-500/30">
          <Volume2 className="w-4 h-4 text-green-500" />
          <span className="text-green-500 text-sm font-medium">Speaking</span>
        </div>
      )}
    </div>
  );
};

export default VideoGrid;
