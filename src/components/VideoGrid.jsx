import { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Pin, PinOff, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
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
      
      const audioTracks = stream.getAudioTracks();
      console.log('AudioPlayer: Playing audio from stream', {
        streamId: stream.id,
        audioTracks: audioTracks.length,
        trackStates: audioTracks.map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })),
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

const VideoGrid = ({ participants, localStream }) => {
  const { remoteStreams, pinnedParticipant, pinParticipant, currentUserId } = useMeeting();
  const [currentPage, setCurrentPage] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  
  // Separate local user and remote participants
  const localParticipant = participants.find(p => p.id === currentUserId);
  const remoteParticipants = participants.filter(p => p.id !== currentUserId);
  
  // Find pinned participant data
  const pinnedParticipantData = pinnedParticipant 
    ? participants.find(p => p.id === pinnedParticipant)
    : null;

  // If more than 6 participants, show focus mode with pagination
  const totalCount = participants.length;
  const maxVisibleInGrid = 6;
  const shouldUseFocusMode = totalCount > maxVisibleInGrid || focusMode || pinnedParticipant;
  
  // In focus mode: 1 main + 4 small tiles per page
  const tilesPerPage = 4;
  
  // Get participants for current page (excluding the focused one)
  const getFocusedParticipant = () => {
    if (pinnedParticipant) {
      return pinnedParticipantData;
    }
    // Default to admin or first participant
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

  // Simple grid mode (6 or fewer participants)
  if (!shouldUseFocusMode && totalCount <= maxVisibleInGrid) {
    const gridClass = getGridClass(totalCount);
    
    return (
      <div className={`video-grid-container ${gridClass}`}>
        {/* Local video tile */}
        {localParticipant && (
          <VideoTile
            key="local"
            stream={localStream}
            participant={localParticipant}
            isLocal={true}
            onPin={() => pinParticipant(currentUserId)}
            isPinned={pinnedParticipant === currentUserId}
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
          />
        ))}
      </div>
    );
  }

  // Focus mode with main speaker and side tiles
  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-3 p-4">
      {/* Main focused video */}
      <div className="flex-1 relative min-h-0">
        {focusedParticipant && (
          <VideoTile
            key={focusedParticipant.id}
            stream={focusedParticipant.id === currentUserId ? localStream : remoteStreams[focusedParticipant.id]}
            participant={focusedParticipant}
            isLocal={focusedParticipant.id === currentUserId}
            isFocused={true}
            onPin={() => pinParticipant(focusedParticipant.id)}
            isPinned={pinnedParticipant === focusedParticipant.id}
          />
        )}
        
        {/* Toggle focus mode button */}
        <button
          onClick={() => setFocusMode(!focusMode)}
          className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black/90 rounded-lg transition-colors z-10"
          title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          {focusMode ? (
            <Minimize2 className="w-5 h-5 text-white" />
          ) : (
            <Maximize2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Side tiles with pagination */}
      {otherParticipants.length > 0 && (
        <div className="lg:w-72 flex flex-col gap-3">
          {/* Pagination header */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
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
          <div className="flex-1 flex flex-row lg:flex-col gap-2 overflow-hidden">
            {visibleParticipants.map((participant) => (
              <VideoTile
                key={participant.id}
                stream={participant.id === currentUserId ? localStream : remoteStreams[participant.id]}
                participant={participant}
                isLocal={participant.id === currentUserId}
                isSmall={true}
                onPin={() => pinParticipant(participant.id)}
                isPinned={pinnedParticipant === participant.id}
              />
            ))}
          </div>

          {/* Participant count indicator */}
          <div className="text-center text-gray-500 text-xs">
            {otherParticipants.length + 1} participants
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get grid class based on participant count
const getGridClass = (count) => {
  if (count === 1) return 'grid-1';
  if (count === 2) return 'grid-2';
  if (count <= 4) return 'grid-4';
  return 'grid-6';
};

const VideoTile = ({ 
  stream, 
  participant,
  isLocal = false,
  isFocused = false,
  isSmall = false,
  onPin,
  isPinned = false,
}) => {
  const videoRef = useRef(null);
  const name = participant?.displayName || 'Guest';
  const isMicOn = participant?.isMicOn ?? false;
  const isCameraOn = participant?.isCameraOn ?? false;
  const isAdmin = participant?.isAdmin ?? false;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure video plays
      videoRef.current.play().catch(e => {
        console.log('Video autoplay prevented:', e);
      });
      
      console.log(`Stream for ${name}:`, {
        id: stream.id,
        active: stream.active,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });
    }
  }, [stream, name]);

  const tileClasses = isFocused
    ? 'video-tile-focused'
    : isSmall
    ? 'video-tile-small'
    : 'video-tile';

  // Check if stream has video tracks
  const hasVideoTracks = stream && stream.getVideoTracks().length > 0;
  
  // Show video element if we have a stream (will show black if camera is off, video if on)
  const shouldShowVideo = stream && hasVideoTracks;
  const hasAudioTracks = stream && stream.getAudioTracks().length > 0;

  return (
    <div className={`${tileClasses} group`}>
      {/* Always render AudioPlayer for remote participants with audio (even if no video) */}
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
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className={`${isFocused ? 'w-28 h-28' : isSmall ? 'w-12 h-12' : 'w-20 h-20'} rounded-xl bg-[#1a1a1a] border border-[#333333] flex items-center justify-center`}>
            <span className={`${isFocused ? 'text-5xl' : isSmall ? 'text-lg' : 'text-3xl'} font-semibold text-white`}>
              {(name || 'U')[0].toUpperCase()}
            </span>
          </div>
        </div>
      )}
      
      {/* Show avatar overlay when video element exists but camera is off */}
      {shouldShowVideo && !isCameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className={`${isFocused ? 'w-28 h-28' : isSmall ? 'w-12 h-12' : 'w-20 h-20'} rounded-xl bg-[#1a1a1a] border border-[#333333] flex items-center justify-center`}>
            <span className={`${isFocused ? 'text-5xl' : isSmall ? 'text-lg' : 'text-3xl'} font-semibold text-white`}>
              {(name || 'U')[0].toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Name badge */}
      <div className={`absolute ${isSmall ? 'bottom-2 left-2' : 'bottom-3 left-3'} flex items-center`}>
        <div className={`flex items-center gap-2 ${isSmall ? 'px-2 py-1' : 'px-3 py-1.5'} bg-black/80 backdrop-blur-sm rounded-lg`}>
          {!isMicOn ? (
            <MicOff className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-red-500`} />
          ) : (
            <Mic className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-green-500`} />
          )}
          <span className={`text-white ${isSmall ? 'text-xs' : 'text-sm'} font-medium truncate max-w-[120px]`}>
            {name}
            {isAdmin && <span className="text-yellow-500 ml-1">★</span>}
          </span>
        </div>
      </div>

      {/* Pin button */}
      <button 
        onClick={onPin}
        className={`absolute ${isSmall ? 'top-2 right-2' : 'top-3 right-3'} p-2 bg-black/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${isPinned ? '!opacity-100 bg-white' : ''}`}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? (
          <PinOff className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} text-black`} />
        ) : (
          <Pin className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
        )}
      </button>

      {/* Local indicator */}
      {isLocal && (
        <div className={`absolute ${isSmall ? 'top-2 left-2' : 'top-3 left-3'} flex items-center gap-1.5 px-2 py-1 bg-black/80 backdrop-blur-sm rounded-lg`}>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-white font-medium">YOU</span>
        </div>
      )}
    </div>
  );
};

export default VideoGrid;
