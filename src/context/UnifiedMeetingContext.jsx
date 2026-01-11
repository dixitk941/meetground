import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { 
  Room, 
  RoomEvent, 
  Track,
  VideoPresets,
  createLocalTracks,
  ConnectionState,
} from 'livekit-client';
import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const UnifiedMeetingContext = createContext();

export const useUnifiedMeeting = () => {
  const context = useContext(UnifiedMeetingContext);
  if (!context) {
    throw new Error('useUnifiedMeeting must be used within a UnifiedMeetingProvider');
  }
  return context;
};

// Configuration
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || '';
const DEFAULT_MODE = import.meta.env.VITE_MEETING_MODE || 'p2p';

// ICE servers for P2P mode
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export const UnifiedMeetingProvider = ({ children }) => {
  // Mode state
  const [mode, setMode] = useState(DEFAULT_MODE);
  const isLiveKitAvailable = !!LIVEKIT_URL;

  // Common state
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

  // Refs
  const localStreamRef = useRef(null);
  const unsubscribesRef = useRef([]);
  const meetingIdRef = useRef(null);
  const isSubscribed = useRef(false);
  
  // P2P refs
  const peerConnections = useRef({});
  const pendingCandidates = useRef({});
  
  // SFU refs (LiveKit)
  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const isAdminRef = useRef(false);

  // Keep isAdmin ref in sync
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // =====================
  // LIVEKIT (SFU) HELPER FUNCTIONS (defined first)
  // =====================

  const handleLiveKitTrack = useCallback((track, participant, action) => {
    setRemoteStreams(prev => {
      let stream = prev[participant.identity] || new MediaStream();
      
      if (action === 'add' && track.mediaStreamTrack) {
        const exists = stream.getTracks().find(t => t.id === track.mediaStreamTrack.id);
        if (!exists) {
          stream.addTrack(track.mediaStreamTrack);
        }
      } else if (action === 'remove' && track.mediaStreamTrack) {
        stream.removeTrack(track.mediaStreamTrack);
      }
      
      if (stream.getTracks().length === 0 && action === 'remove') {
        const newStreams = { ...prev };
        delete newStreams[participant.identity];
        return newStreams;
      }
      
      return { ...prev, [participant.identity]: stream };
    });
  }, []);

  const updateParticipantsList = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const participantList = [];
    
    // Add local participant
    if (room.localParticipant) {
      participantList.push({
        id: room.localParticipant.identity,
        displayName: room.localParticipant.identity,
        isAdmin: isAdminRef.current,
        isMicOn: room.localParticipant.isMicrophoneEnabled,
        isCameraOn: room.localParticipant.isCameraEnabled,
        isScreenSharing: room.localParticipant.isScreenShareEnabled,
      });
    }
    
    // Add remote participants
    room.remoteParticipants.forEach(p => {
      participantList.push({
        id: p.identity,
        displayName: p.identity,
        isAdmin: false,
        isMicOn: p.isMicrophoneEnabled,
        isCameraOn: p.isCameraEnabled,
        isScreenSharing: p.isScreenShareEnabled,
      });
    });

    setParticipants(participantList);
  }, []);

  // =====================
  // LIVEKIT (SFU) ROOM INIT
  // =====================

  const initLiveKitRoom = useCallback(() => {
    if (roomRef.current) return roomRef.current;
    
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[LiveKit] Connection state:', state);
      setConnectionState(state);
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveKit] Participant connected:', participant.identity);
      updateParticipantsList();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[LiveKit] Participant disconnected:', participant.identity);
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[participant.identity];
        return newStreams;
      });
      updateParticipantsList();
    });

    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity);
      handleLiveKitTrack(track, participant, 'add');
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      console.log('[LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity);
      handleLiveKitTrack(track, participant, 'remove');
    });

    room.on(RoomEvent.TrackMuted, () => updateParticipantsList());
    room.on(RoomEvent.TrackUnmuted, () => updateParticipantsList());

    roomRef.current = room;
    return room;
  }, [handleLiveKitTrack, updateParticipantsList]);

  const connectToLiveKit = useCallback(async (token) => {
    if (!token || !LIVEKIT_URL) {
      console.error('[LiveKit] Missing token or URL');
      return false;
    }

    try {
      const room = initLiveKitRoom();
      await room.connect(LIVEKIT_URL, token);
      console.log('[LiveKit] Connected to room');
      
      // Publish local tracks
      for (const track of localTracksRef.current) {
        await room.localParticipant.publishTrack(track);
      }
      
      // Process existing participants
      room.remoteParticipants.forEach(p => {
        p.trackPublications.forEach(pub => {
          if (pub.track) {
            handleLiveKitTrack(pub.track, p, 'add');
          }
        });
      });
      
      updateParticipantsList();
      return true;
    } catch (error) {
      console.error('[LiveKit] Connection failed:', error);
      return false;
    }
  }, [initLiveKitRoom, handleLiveKitTrack, updateParticipantsList]);

  // ==================
  // P2P WEBRTC METHODS
  // ==================

  const createPeerConnection = useCallback(async (participantId, meetingIdParam, userIdParam, streamParam) => {
    if (!meetingIdParam || !userIdParam || participantId === userIdParam) return null;

    if (peerConnections.current[participantId]) {
      try { 
        peerConnections.current[participantId].close(); 
      } catch {
        // Ignore close errors
      }
      delete peerConnections.current[participantId];
    }

    console.log('[P2P] Creating connection with:', participantId);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[participantId] = pc;

    if (streamParam) {
      streamParam.getTracks().forEach(track => {
        try { 
          pc.addTrack(track, streamParam); 
        } catch {
          // Ignore add track errors
        }
      });
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch {
        // Ignore transceiver errors
      }
    }

    pc.ontrack = (event) => {
      console.log('[P2P] Track received from:', participantId, event.track.kind);
      setRemoteStreams(prev => {
        let stream = prev[participantId];
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else {
          stream = stream || new MediaStream();
          stream.addTrack(event.track);
        }
        return { ...prev, [participantId]: stream };
      });
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(
          collection(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`, 'candidates'),
          { candidate: event.candidate.toJSON(), from: userIdParam, timestamp: serverTimestamp() }
        );
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[P2P] Connection state with ${participantId}:`, pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[participantId];
          return newStreams;
        });
      }
    };

    return pc;
  }, []);

  const startCall = useCallback(async (participantId, meetingIdParam, userIdParam, streamParam) => {
    const pc = await createPeerConnection(participantId, meetingIdParam, userIdParam, streamParam);
    if (!pc) return;

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      await setDoc(doc(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`), {
        offer: { type: offer.type, sdp: offer.sdp },
        from: userIdParam,
        to: participantId,
        timestamp: serverTimestamp(),
      });

      // Listen for answer
      const unsubAnswer = onSnapshot(
        doc(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`),
        async (snapshot) => {
          const data = snapshot.data();
          if (data?.answer && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            if (pendingCandidates.current[participantId]) {
              for (const c of pendingCandidates.current[participantId]) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              delete pendingCandidates.current[participantId];
            }
          }
        }
      );
      unsubscribesRef.current.push(unsubAnswer);

      // Listen for ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`, 'candidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from === participantId) {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                  pendingCandidates.current[participantId] = pendingCandidates.current[participantId] || [];
                  pendingCandidates.current[participantId].push(data.candidate);
                }
              }
            }
          });
        }
      );
      unsubscribesRef.current.push(unsubCandidates);
    } catch (error) {
      console.error('[P2P] Error starting call:', error);
    }
  }, [createPeerConnection]);

  const answerCall = useCallback(async (participantId, offer, meetingIdParam, userIdParam, streamParam) => {
    const pc = await createPeerConnection(participantId, meetingIdParam, userIdParam, streamParam);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setDoc(doc(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`), {
        answer: { type: answer.type, sdp: answer.sdp },
        from: userIdParam,
        to: participantId,
        timestamp: serverTimestamp(),
      });

      // Listen for ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`, 'candidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from === participantId && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              }
            }
          });
        }
      );
      unsubscribesRef.current.push(unsubCandidates);
    } catch (error) {
      console.error('[P2P] Error answering call:', error);
    }
  }, [createPeerConnection]);

  // ===============
  // COMMON METHODS
  // ===============

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
      mode: mode,
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
    meetingIdRef.current = newMeetingId;
    setIsAdmin(true);
    return newMeetingId;
  };

  const joinMeeting = async (meetingIdToJoin, userId, displayName) => {
    const meetingRef = doc(db, 'meetings', meetingIdToJoin);
    const meetingSnap = await getDoc(meetingRef);

    if (!meetingSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const meetingData = meetingSnap.data();
    const isUserAdmin = meetingData.adminId === userId;
    
    if (meetingData.mode) {
      setMode(meetingData.mode);
    }

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
    meetingIdRef.current = meetingIdToJoin;
    setIsAdmin(isUserAdmin);
    setMeetingSettings(meetingData.settings || meetingSettings);

    return meetingIdToJoin;
  };

  const initializeMedia = async () => {
    try {
      console.log('[Media] Initializing...');
      
      if (mode === 'sfu' && isLiveKitAvailable) {
        // LiveKit mode
        const tracks = await createLocalTracks({
          audio: true,
          video: { resolution: VideoPresets.h720.resolution },
        });
        
        localTracksRef.current = tracks;
        
        const stream = new MediaStream();
        tracks.forEach(track => {
          if (track.mediaStreamTrack) {
            stream.addTrack(track.mediaStreamTrack);
            track.mute();
          }
        });
        
        setLocalStream(stream);
        localStreamRef.current = stream;
        return stream;
      } else {
        // P2P mode
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(d => d.kind === 'videoinput');
        const hasAudio = devices.some(d => d.kind === 'audioinput');

        if (!hasVideo && !hasAudio) {
          setLocalStream(null);
          localStreamRef.current = null;
          return null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: hasVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: hasAudio ? { echoCancellation: true, noiseSuppression: true } : false,
        });

        stream.getTracks().forEach(track => { track.enabled = false; });
        setLocalStream(stream);
        localStreamRef.current = stream;
        return stream;
      }
    } catch (error) {
      console.error('[Media] Error:', error);
      
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        audioStream.getAudioTracks().forEach(t => { t.enabled = false; });
        setLocalStream(audioStream);
        localStreamRef.current = audioStream;
        return audioStream;
      } catch {
        setLocalStream(null);
        localStreamRef.current = null;
        return null;
      }
    }
  };

  const toggleMic = async (userId) => {
    if (mode === 'sfu' && roomRef.current?.state === ConnectionState.Connected) {
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
    } else if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }

    if (meetingId && userId) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
        isMicOn: !isMicOn,
      });
    }
  };

  const toggleCamera = async (userId) => {
    if (mode === 'sfu' && roomRef.current?.state === ConnectionState.Connected) {
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
    } else if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }

    if (meetingId && userId) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
        isCameraOn: !isCameraOn,
      });
    }
  };

  const startScreenShare = async (userId) => {
    try {
      if (mode === 'sfu' && roomRef.current?.state === ConnectionState.Connected) {
        await roomRef.current.localParticipant.setScreenShareEnabled(true);
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        
        setScreenStream(stream);
        stream.getVideoTracks()[0].onended = () => stopScreenShare(userId);
        
        // Share to peers
        Object.values(peerConnections.current).forEach((pc) => {
          stream.getTracks().forEach(track => {
            try { 
              pc.addTrack(track, stream); 
            } catch {
              // Ignore errors
            }
          });
        });
      }
      
      setIsScreenSharing(true);
      if (meetingId && userId) {
        await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
          isScreenSharing: true,
        });
      }
    } catch (error) {
      console.error('[ScreenShare] Error:', error);
    }
  };

  const stopScreenShare = async (userId) => {
    try {
      if (mode === 'sfu' && roomRef.current?.state === ConnectionState.Connected) {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
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
      console.error('[ScreenShare] Stop error:', error);
    }
  };

  const subscribeToMeeting = useCallback(async (meetingIdToSubscribe, userId) => {
    if (isSubscribed.current || !meetingIdToSubscribe) return;
    isSubscribed.current = true;

    const meetingIdLocal = meetingIdToSubscribe;
    const userIdLocal = userId;

    // Subscribe to meeting data
    const unsubMeeting = onSnapshot(doc(db, 'meetings', meetingIdLocal), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.settings) setMeetingSettings(data.settings);
        if (data.activeView) setActiveView(data.activeView);
        if (data.whiteboardData !== undefined) setWhiteboardData(data.whiteboardData);
        if (data.codeData) setCodeData(data.codeData);
      }
    });
    unsubscribesRef.current.push(unsubMeeting);

    // Subscribe to participants
    const unsubParticipants = onSnapshot(
      collection(db, 'meetings', meetingIdLocal, 'participants'),
      async (snapshot) => {
        const participantList = [];
        const currentParticipantIds = new Set();
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          participantList.push(data);
          currentParticipantIds.add(data.id);
        });
        
        setParticipants(participantList);

        // P2P mode: handle connections
        if (mode === 'p2p') {
          for (const participant of participantList) {
            if (participant.id !== userIdLocal && !peerConnections.current[participant.id]) {
              if (participant.id > userIdLocal) {
                setTimeout(() => {
                  startCall(participant.id, meetingIdLocal, userIdLocal, localStreamRef.current);
                }, 500);
              }
            }
          }
          
          // Cleanup disconnected
          Object.keys(peerConnections.current).forEach(peerId => {
            if (!currentParticipantIds.has(peerId)) {
              try { 
                peerConnections.current[peerId].close(); 
              } catch {
                // Ignore close errors
              }
              delete peerConnections.current[peerId];
              setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[peerId];
                return newStreams;
              });
            }
          });
        }
      }
    );
    unsubscribesRef.current.push(unsubParticipants);

    // P2P mode: listen for incoming calls
    if (mode === 'p2p') {
      const unsubCalls = onSnapshot(
        collection(db, 'meetings', meetingIdLocal, 'calls'),
        async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data();
              if (data.to === userIdLocal && data.offer && !peerConnections.current[data.from]) {
                await answerCall(data.from, data.offer, meetingIdLocal, userIdLocal, localStreamRef.current);
              }
            }
          }
        }
      );
      unsubscribesRef.current.push(unsubCalls);
    }

    return () => {
      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      unsubscribesRef.current = [];
      isSubscribed.current = false;
    };
  }, [mode, startCall, answerCall]);

  const leaveMeeting = async (userId) => {
    // Cleanup
    unsubscribesRef.current.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    unsubscribesRef.current = [];

    // Mode-specific cleanup
    if (mode === 'sfu' && roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      localTracksRef.current.forEach(t => t.stop());
      localTracksRef.current = [];
    } else {
      Object.values(peerConnections.current).forEach(pc => {
        try { 
          pc.close(); 
        } catch {
          // Ignore close errors
        }
      });
      peerConnections.current = {};
      pendingCandidates.current = {};
    }

    // Stop streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }

    // Remove from Firestore
    if (meetingId && userId) {
      try {
        await deleteDoc(doc(db, 'meetings', meetingId, 'participants', userId));
      } catch (error) {
        console.error('Error removing participant:', error);
      }
    }

    // Reset state
    setMeetingId(null);
    meetingIdRef.current = null;
    isSubscribed.current = false;
    setParticipants([]);
    setIsAdmin(false);
    setLocalStream(null);
    localStreamRef.current = null;
    setScreenStream(null);
    setRemoteStreams({});
    setIsMicOn(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setCurrentUserId(null);
    setPinnedParticipant(null);
    setConnectionState('disconnected');
  };

  const updateMeetingSettings = async (newSettings) => {
    if (meetingId && isAdmin) {
      await updateDoc(doc(db, 'meetings', meetingId), { settings: newSettings });
      setMeetingSettings(newSettings);
    }
  };

  const muteParticipant = async (participantId) => {
    if (meetingId && isAdmin) {
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', participantId), {
        isMicOn: false,
        forceMuted: true,
      });
    }
  };

  const updateWhiteboard = async (data) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), { whiteboardData: data });
    }
  };

  const updateCode = async (data) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), { codeData: data });
    }
  };

  const updateActiveView = async (view) => {
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), { activeView: view });
    }
    setActiveView(view);
  };

  const pinParticipant = (participantId) => {
    setPinnedParticipant(prev => prev === participantId ? null : participantId);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      localTracksRef.current.forEach(t => t.stop());
      Object.values(peerConnections.current).forEach(pc => {
        try { 
          pc.close(); 
        } catch {
          // Ignore close errors
        }
      });
      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  const value = {
    // Mode
    mode,
    setMode,
    isLiveKitAvailable,
    connectionState,
    
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
    
    // Actions
    createMeeting,
    joinMeeting,
    leaveMeeting,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    initializeMedia,
    updateMeetingSettings,
    muteParticipant,
    updateWhiteboard,
    updateCode,
    updateActiveView,
    subscribeToMeeting,
    pinParticipant,
    setRemoteStreams,
    peerConnections,
    
    // LiveKit specific
    connectToLiveKit,
  };

  return (
    <UnifiedMeetingContext.Provider value={value}>
      {children}
    </UnifiedMeetingContext.Provider>
  );
};

export default UnifiedMeetingContext;
