import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { 
  Room, 
  RoomEvent, 
  Track,
  VideoPresets,
  createLocalTracks,
  LocalParticipant,
  RemoteParticipant,
  ConnectionState,
} from 'livekit-client';
import { db } from '../config/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const LiveKitContext = createContext();

export const useLiveKit = () => {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within a LiveKitProvider');
  }
  return context;
};

// LiveKit Cloud or self-hosted server URL
// For development, you can use LiveKit Cloud's free tier
// Sign up at https://cloud.livekit.io and get your URL
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud';

export const LiveKitProvider = ({ children }) => {
  const [meetingId, setMeetingId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    allowParticipantMic: true,
    allowParticipantScreen: true,
    allowParticipantChat: true,
  });
  const [remoteStreams, setRemoteStreams] = useState({});
  const [whiteboardData, setWhiteboardData] = useState(null);
  const [codeData, setCodeData] = useState({ language: 'javascript', code: '' });
  const [activeView, setActiveView] = useState('video');
  const [pinnedParticipant, setPinnedParticipant] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);

  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const unsubscribesRef = useRef([]);

  // Generate a token for LiveKit connection
  // In production, this should be done on your backend server
  const generateToken = async (roomName, participantName, isAdmin = false) => {
    // For development/demo purposes, we'll use Firebase to store and retrieve tokens
    // In production, you should have a backend endpoint that generates tokens using LiveKit SDK
    
    // Option 1: Use LiveKit Cloud API (requires API key/secret - should be server-side)
    // Option 2: Use a Firebase Cloud Function to generate tokens
    // Option 3: For demo, use a static token from LiveKit dashboard
    
    // For now, we'll store the token generation info in Firebase
    // and use the LiveKit CLI or dashboard to generate tokens
    
    const tokenDoc = await getDoc(doc(db, 'livekit_tokens', `${roomName}_${participantName}`));
    if (tokenDoc.exists()) {
      return tokenDoc.data().token;
    }
    
    // If no token exists, you need to generate one
    // This is a placeholder - in production, call your backend
    console.warn('No LiveKit token found. You need to generate a token.');
    console.warn('For development, use: livekit-cli token create --room', roomName, '--identity', participantName);
    
    return null;
  };

  // Initialize the LiveKit Room
  const initRoom = useCallback(() => {
    if (roomRef.current) return roomRef.current;
    
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    // Set up event listeners
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('Connection state changed:', state);
      setConnectionState(state);
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
      handleParticipantConnected(participant);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
      handleParticipantDisconnected(participant);
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);
      handleTrackSubscribed(track, publication, participant);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
      handleTrackUnsubscribed(track, publication, participant);
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      console.log('Local track published:', publication.kind);
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      console.log('Local track unpublished:', publication.kind);
    });

    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      console.log('Track muted:', publication.kind, 'from', participant.identity);
      updateParticipantTrackState(participant);
    });

    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('Track unmuted:', publication.kind, 'from', participant.identity);
      updateParticipantTrackState(participant);
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      console.log('Disconnected from room:', reason);
      setConnectionState('disconnected');
    });

    room.on(RoomEvent.Reconnecting, () => {
      console.log('Reconnecting...');
      setConnectionState('reconnecting');
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('Reconnected');
      setConnectionState('connected');
    });

    roomRef.current = room;
    return room;
  }, []);

  // Handle participant connected
  const handleParticipantConnected = (participant) => {
    setParticipants(prev => {
      const exists = prev.some(p => p.id === participant.identity);
      if (exists) return prev;
      
      return [...prev, {
        id: participant.identity,
        displayName: participant.identity,
        isAdmin: false,
        isMicOn: !participant.isMicrophoneEnabled ? false : participant.isMicrophoneEnabled,
        isCameraOn: !participant.isCameraEnabled ? false : participant.isCameraEnabled,
        isScreenSharing: false,
      }];
    });
  };

  // Handle participant disconnected
  const handleParticipantDisconnected = (participant) => {
    setParticipants(prev => prev.filter(p => p.id !== participant.identity));
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[participant.identity];
      return newStreams;
    });
  };

  // Handle track subscribed
  const handleTrackSubscribed = (track, publication, participant) => {
    if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
      setRemoteStreams(prev => {
        const existingStream = prev[participant.identity];
        let stream;
        
        if (existingStream) {
          // Add track to existing stream
          const mediaStreamTrack = track.mediaStreamTrack;
          if (mediaStreamTrack && !existingStream.getTracks().find(t => t.id === mediaStreamTrack.id)) {
            existingStream.addTrack(mediaStreamTrack);
          }
          stream = existingStream;
        } else {
          // Create new MediaStream
          stream = new MediaStream();
          if (track.mediaStreamTrack) {
            stream.addTrack(track.mediaStreamTrack);
          }
        }
        
        return {
          ...prev,
          [participant.identity]: stream,
        };
      });
    }
    
    updateParticipantTrackState(participant);
  };

  // Handle track unsubscribed
  const handleTrackUnsubscribed = (track, publication, participant) => {
    setRemoteStreams(prev => {
      const existingStream = prev[participant.identity];
      if (existingStream && track.mediaStreamTrack) {
        existingStream.removeTrack(track.mediaStreamTrack);
        // If no tracks left, remove the stream
        if (existingStream.getTracks().length === 0) {
          const newStreams = { ...prev };
          delete newStreams[participant.identity];
          return newStreams;
        }
      }
      return prev;
    });
    
    updateParticipantTrackState(participant);
  };

  // Update participant track state
  const updateParticipantTrackState = (participant) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participant.identity) {
        return {
          ...p,
          isMicOn: participant.isMicrophoneEnabled || false,
          isCameraOn: participant.isCameraEnabled || false,
        };
      }
      return p;
    }));
  };

  // Create a new meeting
  const createMeeting = async (userId, displayName) => {
    const newMeetingId = uuidv4().substring(0, 10);
    setCurrentUserId(userId);
    
    await setDoc(doc(db, 'meetings', newMeetingId), {
      createdAt: serverTimestamp(),
      adminId: userId,
      settings: meetingSettings,
      activeView: 'video',
      whiteboardData: null,
      codeData: { language: 'javascript', code: '// Start coding here...' },
      useSFU: true, // Flag to indicate SFU mode
    });

    await setDoc(doc(db, 'meetings', newMeetingId, 'participants', userId), {
      id: userId,
      displayName,
      isAdmin: true,
      isMicOn: false,
      isCameraOn: false,
      isScreenSharing: false,
      joinedAt: serverTimestamp(),
    });

    setMeetingId(newMeetingId);
    setIsAdmin(true);
    
    // Add local participant to the list
    setParticipants([{
      id: userId,
      displayName,
      isAdmin: true,
      isMicOn: false,
      isCameraOn: false,
      isScreenSharing: false,
    }]);
    
    return newMeetingId;
  };

  // Join an existing meeting
  const joinMeeting = async (meetingIdToJoin, userId, displayName) => {
    const meetingRef = doc(db, 'meetings', meetingIdToJoin);
    const meetingSnap = await getDoc(meetingRef);

    if (!meetingSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const meetingData = meetingSnap.data();
    const isUserAdmin = meetingData.adminId === userId;
    setCurrentUserId(userId);

    await setDoc(doc(db, 'meetings', meetingIdToJoin, 'participants', userId), {
      id: userId,
      displayName,
      isAdmin: isUserAdmin,
      isMicOn: false,
      isCameraOn: false,
      isScreenSharing: false,
      joinedAt: serverTimestamp(),
    });

    setMeetingId(meetingIdToJoin);
    setIsAdmin(isUserAdmin);
    setMeetingSettings(meetingData.settings || meetingSettings);

    return meetingIdToJoin;
  };

  // Connect to LiveKit room
  const connectToRoom = async (token, userId, displayName) => {
    if (!token) {
      console.error('No token provided for LiveKit connection');
      return false;
    }

    setIsConnecting(true);
    
    try {
      const room = initRoom();
      
      // Connect to the room
      await room.connect(LIVEKIT_URL, token);
      console.log('Connected to LiveKit room');
      
      // Add existing remote participants
      room.remoteParticipants.forEach((participant) => {
        handleParticipantConnected(participant);
        
        // Subscribe to existing tracks
        participant.trackPublications.forEach((publication) => {
          if (publication.track) {
            handleTrackSubscribed(publication.track, publication, participant);
          }
        });
      });
      
      setIsConnecting(false);
      return true;
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error);
      setIsConnecting(false);
      return false;
    }
  };

  // Initialize local media
  const initializeMedia = async () => {
    try {
      console.log('Initializing media...');
      
      const tracks = await createLocalTracks({
        audio: true,
        video: {
          resolution: VideoPresets.h720.resolution,
        },
      });
      
      localTracksRef.current = tracks;
      
      // Create MediaStream from tracks
      const stream = new MediaStream();
      tracks.forEach(track => {
        if (track.mediaStreamTrack) {
          stream.addTrack(track.mediaStreamTrack);
          // Start with muted
          track.mute();
        }
      });
      
      setLocalStream(stream);
      console.log('Local tracks created:', tracks.map(t => t.kind));
      
      return stream;
    } catch (error) {
      console.error('Error creating local tracks:', error);
      
      // Try audio only
      try {
        const audioTracks = await createLocalTracks({
          audio: true,
          video: false,
        });
        
        localTracksRef.current = audioTracks;
        
        const stream = new MediaStream();
        audioTracks.forEach(track => {
          if (track.mediaStreamTrack) {
            stream.addTrack(track.mediaStreamTrack);
            track.mute();
          }
        });
        
        setLocalStream(stream);
        return stream;
      } catch {
        setLocalStream(null);
        return null;
      }
    }
  };

  // Publish local tracks to the room
  const publishTracks = async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      console.log('Room not connected, cannot publish tracks');
      return;
    }

    try {
      for (const track of localTracksRef.current) {
        await room.localParticipant.publishTrack(track);
        console.log('Published track:', track.kind);
      }
    } catch (error) {
      console.error('Error publishing tracks:', error);
    }
  };

  // Toggle microphone
  const toggleMic = async (userId) => {
    const room = roomRef.current;
    
    if (room && room.state === ConnectionState.Connected) {
      const audioTrack = localTracksRef.current.find(t => t.kind === Track.Kind.Audio);
      
      if (audioTrack) {
        if (audioTrack.isMuted) {
          await audioTrack.unmute();
          setIsMicOn(true);
        } else {
          await audioTrack.mute();
          setIsMicOn(false);
        }
      }
    } else if (localStream) {
      // Fallback for non-LiveKit mode
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
    
    // Update Firestore
    if (meetingId && userId) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
        isMicOn: isMicOn ? false : true,
      });
    }
  };

  // Toggle camera
  const toggleCamera = async (userId) => {
    const room = roomRef.current;
    
    if (room && room.state === ConnectionState.Connected) {
      const videoTrack = localTracksRef.current.find(t => t.kind === Track.Kind.Video);
      
      if (videoTrack) {
        if (videoTrack.isMuted) {
          await videoTrack.unmute();
          setIsCameraOn(true);
        } else {
          await videoTrack.mute();
          setIsCameraOn(false);
        }
      }
    } else if (localStream) {
      // Fallback for non-LiveKit mode
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
    
    // Update Firestore
    if (meetingId && userId) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
        isCameraOn: isCameraOn ? false : true,
      });
    }
  };

  // Start screen sharing
  const startScreenShare = async (userId) => {
    const room = roomRef.current;
    
    try {
      if (room && room.state === ConnectionState.Connected) {
        await room.localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
      } else {
        // Fallback
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare(userId);
        };
      }
      
      if (meetingId && userId) {
        await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
          isScreenSharing: true,
        });
      }
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  // Stop screen sharing
  const stopScreenShare = async (userId) => {
    const room = roomRef.current;
    
    try {
      if (room && room.state === ConnectionState.Connected) {
        await room.localParticipant.setScreenShareEnabled(false);
      }
      
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      setIsScreenSharing(false);
      
      if (meetingId && userId) {
        await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
          isScreenSharing: false,
        });
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  // Subscribe to meeting updates
  const subscribeToMeeting = async (meetingIdToSubscribe, userId) => {
    if (!meetingIdToSubscribe) return;

    // Subscribe to participants
    const unsubParticipants = onSnapshot(
      collection(db, 'meetings', meetingIdToSubscribe, 'participants'),
      (snapshot) => {
        const participantList = [];
        snapshot.forEach((doc) => {
          participantList.push(doc.data());
        });
        setParticipants(participantList);
      }
    );
    unsubscribesRef.current.push(unsubParticipants);

    // Subscribe to meeting settings
    const unsubMeeting = onSnapshot(
      doc(db, 'meetings', meetingIdToSubscribe),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.settings) setMeetingSettings(data.settings);
          if (data.activeView) setActiveView(data.activeView);
          if (data.whiteboardData !== undefined) setWhiteboardData(data.whiteboardData);
          if (data.codeData) setCodeData(data.codeData);
        }
      }
    );
    unsubscribesRef.current.push(unsubMeeting);
  };

  // Leave meeting
  const leaveMeeting = async (userId) => {
    // Disconnect from LiveKit room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Stop local tracks
    localTracksRef.current.forEach(track => {
      track.stop();
    });
    localTracksRef.current = [];

    // Unsubscribe from all listeners
    unsubscribesRef.current.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    unsubscribesRef.current = [];

    // Stop all streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }

    // Remove participant from Firestore
    if (meetingId && userId) {
      try {
        await deleteDoc(doc(db, 'meetings', meetingId, 'participants', userId));
      } catch (error) {
        console.error('Error removing participant:', error);
      }
    }

    // Reset state
    setMeetingId(null);
    setParticipants([]);
    setIsAdmin(false);
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams({});
    setIsMicOn(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setCurrentUserId(null);
    setPinnedParticipant(null);
    setConnectionState('disconnected');
  };

  // Update meeting settings (admin only)
  const updateMeetingSettings = async (newSettings) => {
    if (meetingId && isAdmin) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        settings: newSettings,
      });
      setMeetingSettings(newSettings);
    }
  };

  // Mute a participant (admin only)
  const muteParticipant = async (participantId) => {
    if (meetingId && isAdmin) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', participantId), {
        isMicOn: false,
        forceMuted: true,
      });
    }
  };

  // Update whiteboard data
  const updateWhiteboard = async (data) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        whiteboardData: data,
      });
    }
  };

  // Update code data
  const updateCode = async (data) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        codeData: data,
      });
    }
  };

  // Change active view
  const changeActiveView = async (view) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        activeView: view,
      });
    }
    setActiveView(view);
  };

  // Pin participant
  const pinParticipant = (participantId) => {
    setPinnedParticipant(prev => prev === participantId ? null : participantId);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      localTracksRef.current.forEach(track => track.stop());
      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  const value = {
    // State
    meetingId,
    participants,
    isAdmin,
    localStream,
    screenStream,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    meetingSettings,
    remoteStreams,
    whiteboardData,
    codeData,
    activeView,
    pinnedParticipant,
    currentUserId,
    connectionState,
    isConnecting,
    
    // Actions
    createMeeting,
    joinMeeting,
    connectToRoom,
    leaveMeeting,
    initializeMedia,
    publishTracks,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    subscribeToMeeting,
    updateMeetingSettings,
    muteParticipant,
    updateWhiteboard,
    updateCode,
    changeActiveView,
    pinParticipant,
    generateToken,
  };

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  );
};

export default LiveKitContext;
