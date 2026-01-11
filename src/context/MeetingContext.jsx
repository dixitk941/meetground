import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
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
  getDocs,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const MeetingContext = createContext();

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};

// ICE servers configuration for WebRTC
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export const MeetingProvider = ({ children }) => {
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

  const peerConnections = useRef({});
  const localStreamRef = useRef(null);
  const unsubscribesRef = useRef([]);
  const pendingCandidates = useRef({});
  const isSubscribed = useRef(false);
  const meetingIdRef = useRef(null);

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

  // Create peer connection for a specific participant
  const createPeerConnection = async (participantId, meetingIdParam, userIdParam, streamParam) => {
    if (!meetingIdParam || !userIdParam) {
      console.log('Missing meeting or user ID for peer connection');
      return null;
    }
    if (participantId === userIdParam) {
      console.log('Cannot create peer connection with self');
      return null;
    }

    // Close existing connection if any
    if (peerConnections.current[participantId]) {
      try {
        peerConnections.current[participantId].close();
      } catch (e) {
        console.log('Error closing existing connection:', e);
      }
      delete peerConnections.current[participantId];
    }

    console.log('Creating peer connection with:', participantId, 'stream available:', !!streamParam);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[participantId] = pc;

    // Add local tracks to the connection if stream is available
    if (streamParam) {
      const tracks = streamParam.getTracks();
      console.log('Adding', tracks.length, 'tracks to peer connection');
      tracks.forEach(track => {
        try {
          pc.addTrack(track, streamParam);
        } catch (e) {
          console.error('Error adding track:', e);
        }
      });
    } else {
      console.log('No stream available, creating transceiver for receiving');
      // Add transceivers to receive audio/video even without local stream
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (e) {
        console.log('Error adding transceivers:', e);
      }
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from:', participantId, 'kind:', event.track.kind, 'readyState:', event.track.readyState);
      
      // Get the stream from the event
      let remoteStream;
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
      } else {
        // Create a new stream if none exists
        remoteStream = new MediaStream();
        remoteStream.addTrack(event.track);
      }
      
      console.log('Remote stream tracks:', {
        id: remoteStream.id,
        audioTracks: remoteStream.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })),
        videoTracks: remoteStream.getVideoTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })),
      });
      
      setRemoteStreams(prev => {
        const existing = prev[participantId];
        if (existing) {
          // If we already have a stream, add the new track to it if not already present
          const trackIds = existing.getTracks().map(t => t.id);
          if (!trackIds.includes(event.track.id)) {
            existing.addTrack(event.track);
            console.log('Added track to existing stream:', event.track.kind);
          }
          return { ...prev, [participantId]: existing };
        }
        return {
          ...prev,
          [participantId]: remoteStream,
        };
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await addDoc(
            collection(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`, 'candidates'),
            {
              candidate: event.candidate.toJSON(),
              from: userIdParam,
              timestamp: serverTimestamp(),
            }
          );
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('Successfully connected to:', participantId);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[participantId];
          return newStreams;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${participantId}:`, pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with ${participantId}:`, pc.iceGatheringState);
    };

    pc.onnegotiationneeded = () => {
      console.log('Negotiation needed for:', participantId);
    };

    return pc;
  };

  // Start a call with a participant
  const startCall = async (participantId, meetingIdParam, userIdParam, streamParam) => {
    console.log('startCall called:', { participantId, meetingIdParam, userIdParam, hasStream: !!streamParam });
    
    const pc = await createPeerConnection(participantId, meetingIdParam, userIdParam, streamParam);
    if (!pc) {
      console.log('Failed to create peer connection for startCall');
      return;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      console.log('Created and set local offer for:', participantId);

      // Store the offer
      await setDoc(doc(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`), {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        from: userIdParam,
        to: participantId,
        timestamp: serverTimestamp(),
      });
      console.log('Stored offer in Firebase for:', participantId);

      // Listen for answer
      const unsubAnswer = onSnapshot(
        doc(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`),
        async (snapshot) => {
          const data = snapshot.data();
          if (data?.answer && pc.signalingState === 'have-local-offer') {
            try {
              console.log('Received answer from:', participantId);
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              
              // Add any pending candidates
              if (pendingCandidates.current[participantId]) {
                console.log('Adding', pendingCandidates.current[participantId].length, 'pending candidates');
                for (const candidate of pendingCandidates.current[participantId]) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
                delete pendingCandidates.current[participantId];
              }
            } catch (error) {
              console.error('Error setting remote description:', error);
            }
          }
        }
      );
      unsubscribesRef.current.push(unsubAnswer);

      // Listen for ICE candidates from remote peer
      const unsubCandidates = onSnapshot(
        collection(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`, 'candidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from === participantId) {
                try {
                  if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  } else {
                    // Queue candidate if remote description not set yet
                    if (!pendingCandidates.current[participantId]) {
                      pendingCandidates.current[participantId] = [];
                    }
                    pendingCandidates.current[participantId].push(data.candidate);
                  }
                } catch (error) {
                  console.error('Error adding ICE candidate:', error);
                }
              }
            }
          });
        }
      );
      unsubscribesRef.current.push(unsubCandidates);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  // Answer a call from a participant
  const answerCall = async (participantId, offer, meetingIdParam, userIdParam, streamParam) => {
    console.log('answerCall called:', { participantId, meetingIdParam, userIdParam, hasStream: !!streamParam });
    
    const pc = await createPeerConnection(participantId, meetingIdParam, userIdParam, streamParam);
    if (!pc) {
      console.log('Failed to create peer connection for answerCall');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description for:', participantId);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Created and set local answer for:', participantId);

      // Store the answer
      await setDoc(doc(db, 'meetings', meetingIdParam, 'calls', `${userIdParam}_${participantId}`), {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        from: userIdParam,
        to: participantId,
        timestamp: serverTimestamp(),
      });
      console.log('Stored answer in Firebase for:', participantId);

      // Listen for ICE candidates
      const unsubCandidates = onSnapshot(
        collection(db, 'meetings', meetingIdParam, 'calls', `${participantId}_${userIdParam}`, 'candidates'),
        (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from === participantId) {
                try {
                  if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  }
                } catch (error) {
                  console.error('Error adding ICE candidate:', error);
                }
              }
            }
          });
        }
      );
      unsubscribesRef.current.push(unsubCandidates);
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  // Effect to re-establish connections when stream becomes available
  useEffect(() => {
    const reconnectPeers = async () => {
      if (!localStreamRef.current || !meetingIdRef.current || !currentUserId) return;
      
      console.log('Reconnecting peers, stream available');
      
      // Get current participants
      const participantsSnapshot = await getDocs(
        collection(db, 'meetings', meetingIdRef.current, 'participants')
      );
      
      const otherParticipants = [];
      participantsSnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUserId) {
          otherParticipants.push(docSnap.id);
        }
      });

      console.log('Other participants to connect:', otherParticipants);

      // Initiate calls to participants we should connect to
      for (const participantId of otherParticipants) {
        const existingPc = peerConnections.current[participantId];
        const needsReconnect = !existingPc || 
            existingPc.connectionState === 'failed' ||
            existingPc.connectionState === 'disconnected' ||
            existingPc.connectionState === 'closed';
            
        if (needsReconnect) {
          const shouldInitiate = currentUserId < participantId;
          if (shouldInitiate) {
            console.log('Re-initiating call to:', participantId);
            await startCall(participantId, meetingIdRef.current, currentUserId, localStreamRef.current);
          }
        }
      }
    };

    if (localStream && meetingId && currentUserId) {
      // Delay slightly to ensure refs are updated
      const timer = setTimeout(reconnectPeers, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, meetingId, currentUserId]);

  // Leave meeting
  const leaveMeeting = async (userId) => {
    if (meetingId && userId) {
      // Unsubscribe from all listeners
      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      unsubscribesRef.current = [];

      // Close all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        try {
          pc.close();
        } catch (e) {
          console.log('Error closing peer connection:', e);
        }
      });
      peerConnections.current = {};
      pendingCandidates.current = {};

      // Stop all streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }

      // Remove participant from Firestore
      try {
        await deleteDoc(doc(db, 'meetings', meetingId, 'participants', userId));
      } catch (error) {
        console.error('Error removing participant:', error);
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
    }
  };

  // Toggle microphone
  const toggleMic = async (userId) => {
    console.log('toggleMic called, localStreamRef:', !!localStreamRef.current);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      console.log('Audio track:', audioTrack, 'enabled:', audioTrack?.enabled);
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
        console.log('Mic toggled to:', audioTrack.enabled);
        
        if (meetingId && userId) {
          await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
            isMicOn: audioTrack.enabled,
          });
        }
      }
    }
  };

  // Toggle camera
  const toggleCamera = async (userId) => {
    console.log('toggleCamera called, localStreamRef:', !!localStreamRef.current);
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      console.log('Video track:', videoTrack, 'enabled:', videoTrack?.enabled);
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        console.log('Camera toggled to:', videoTrack.enabled);
        
        if (meetingId && userId) {
          await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
            isCameraOn: videoTrack.enabled,
          });
        }
      }
    }
  };

  // Start screen sharing
  const startScreenShare = async (userId) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true,
      });
      
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace video track in all peer connections
      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      if (meetingId && userId) {
        await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
          isScreenSharing: true,
        });
      }

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare(userId);
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  };

  // Stop screen sharing
  const stopScreenShare = async (userId) => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      
      // Restore original video track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          Object.values(peerConnections.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }
      }

      setScreenStream(null);
      setIsScreenSharing(false);

      if (meetingId && userId) {
        await updateDoc(doc(db, 'meetings', meetingId, 'participants', userId), {
          isScreenSharing: false,
        });
      }
    }
  };

  // Initialize local media
  const initializeMedia = async () => {
    try {
      console.log('Initializing media...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');

      console.log('Media devices:', { hasVideo, hasAudio });

      if (!hasVideo && !hasAudio) {
        console.log('No media devices found');
        setLocalStream(null);
        localStreamRef.current = null;
        return null;
      }

      const constraints = {
        video: hasVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: hasAudio ? { echoCancellation: true, noiseSuppression: true } : false,
      };

      console.log('Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Got stream:', {
        id: stream.id,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // Start with muted state
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
        console.log('Audio track disabled:', track.label);
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
        console.log('Video track disabled:', track.label);
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      console.log('Local stream set and stored in ref');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
        setLocalStream(null);
        localStreamRef.current = null;
        return null;
      }
      
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        audioStream.getAudioTracks().forEach(track => track.enabled = false);
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

  // Set individual participant permissions (admin only)
  const setParticipantPermissions = async (participantId, permissions) => {
    if (meetingId && isAdmin) {
      const updates = {};
      if (permissions.micAllowed !== undefined) {
        updates.micAllowed = permissions.micAllowed;
        if (!permissions.micAllowed) {
          updates.isMicOn = false;
        }
      }
      if (permissions.videoAllowed !== undefined) {
        updates.videoAllowed = permissions.videoAllowed;
        if (!permissions.videoAllowed) {
          updates.isCameraOn = false;
        }
      }
      if (permissions.screenShareAllowed !== undefined) {
        updates.screenShareAllowed = permissions.screenShareAllowed;
      }
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', participantId), updates);
    }
  };

  // Remove a participant from the meeting (admin only)
  const removeParticipant = async (participantId) => {
    if (meetingId && isAdmin && participantId !== currentUserId) {
      // Mark participant as removed
      await updateDoc(doc(db, 'meetings', meetingId, 'participants', participantId), {
        removed: true,
        removedAt: serverTimestamp(),
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

  // Update active view
  const updateActiveView = async (view) => {
    if (meetingId && isAdmin) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        activeView: view,
      });
    }
    setActiveView(view);
  };

  // Pin a participant
  const pinParticipant = (participantId) => {
    setPinnedParticipant(prev => prev === participantId ? null : participantId);
  };

  // Subscribe to meeting updates
  const subscribeToMeeting = useCallback((meetingIdToSubscribe) => {
    if (!meetingIdToSubscribe || !currentUserId) {
      console.log('Cannot subscribe: missing meeting ID or user ID');
      return;
    }

    // Prevent double subscription
    if (isSubscribed.current && meetingIdRef.current === meetingIdToSubscribe) {
      console.log('Already subscribed to this meeting');
      return;
    }

    console.log('Subscribing to meeting:', meetingIdToSubscribe, 'user:', currentUserId);
    isSubscribed.current = true;
    meetingIdRef.current = meetingIdToSubscribe;

    const userIdLocal = currentUserId;
    const meetingIdLocal = meetingIdToSubscribe;

    // Subscribe to meeting document
    const meetingUnsubscribe = onSnapshot(
      doc(db, 'meetings', meetingIdToSubscribe),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setMeetingSettings(data.settings || meetingSettings);
          setWhiteboardData(data.whiteboardData);
          setCodeData(data.codeData || { language: 'javascript', code: '' });
          setActiveView(data.activeView || 'video');
        }
      }
    );
    unsubscribesRef.current.push(meetingUnsubscribe);

    // Subscribe to participants
    const participantsUnsubscribe = onSnapshot(
      collection(db, 'meetings', meetingIdToSubscribe, 'participants'),
      async (snapshot) => {
        const participantsList = [];
        snapshot.forEach((docSnap) => {
          participantsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setParticipants(participantsList);

        // Handle participant changes for WebRTC
        for (const change of snapshot.docChanges()) {
          const participantId = change.doc.id;
          if (participantId === userIdLocal) continue;

          if (change.type === 'added') {
            // New participant joined - initiate call if we have lower ID and have a stream
            const shouldInitiate = userIdLocal && userIdLocal < participantId;
            if (shouldInitiate) {
              console.log('New participant joined, initiating call to:', participantId);
              // Use the current stream from ref
              await startCall(participantId, meetingIdLocal, userIdLocal, localStreamRef.current);
            }
          } else if (change.type === 'removed') {
            // Participant left - close connection
            if (peerConnections.current[participantId]) {
              try {
                peerConnections.current[participantId].close();
              } catch (e) {
                console.log('Error closing peer connection:', e);
              }
              delete peerConnections.current[participantId];
            }
            setRemoteStreams(prev => {
              const newStreams = { ...prev };
              delete newStreams[participantId];
              return newStreams;
            });
          }
        }
      }
    );
    unsubscribesRef.current.push(participantsUnsubscribe);

    // Subscribe to incoming calls
    const callsUnsubscribe = onSnapshot(
      collection(db, 'meetings', meetingIdToSubscribe, 'calls'),
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            // Check if this call is for us and has an offer
            if (data.to === userIdLocal && data.offer && !peerConnections.current[data.from]) {
              console.log('Received call offer from:', data.from);
              // Use the current stream from ref
              await answerCall(data.from, data.offer, meetingIdLocal, userIdLocal, localStreamRef.current);
            }
          }
        }
      }
    );
    unsubscribesRef.current.push(callsUnsubscribe);

    return () => {
      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      unsubscribesRef.current = [];
      isSubscribed.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, meetingSettings]);

  const value = {
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
    setParticipantPermissions,
    removeParticipant,
    updateWhiteboard,
    updateCode,
    updateActiveView,
    subscribeToMeeting,
    pinParticipant,
    setRemoteStreams,
    peerConnections,
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
};
