import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, Camera, UserX, VolumeX, Shield, 
  Users, Clock, Copy, Check, LogOut, AlertCircle, Sparkles, Download, 
  Eye, RefreshCw, X, MapPin, ChevronRight
} from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';
import { KycSnapshot } from '../types';

interface ParticipantPeer {
  id: string;
  name: string;
  role: 'host' | 'guest';
  isAudioMuted: boolean;
  isVideoOff: boolean;
  stream?: MediaStream;
  location?: { city?: string; country?: string };
}

export default function PrivateRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const adminKey = searchParams.get('adminKey') || '';

  // Room status & validation
  const [roomInfo, setRoomInfo] = useState<{
    id: string;
    title: string;
    expiresAt: number;
    maxParticipants: number;
    durationMinutes?: number;
    isExpired?: boolean;
    isFull?: boolean;
    participantCount?: number;
  } | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Pre-join state
  const [hasJoined, setHasJoined] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [myRole, setMyRole] = useState<'host' | 'guest'>(adminKey ? 'host' : 'guest');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [userLocation, setUserLocation] = useState<{ city: string; country: string; latitude?: number; longitude?: number }>({
    city: 'New Delhi',
    country: 'India'
  });

  // Active in-room state
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [participants, setParticipants] = useState<Map<string, ParticipantPeer>>(new Map());
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isCopiedGuest, setIsCopiedGuest] = useState(false);
  const [isCopiedAdmin, setIsCopiedAdmin] = useState(false);
  const [hostAlert, setHostAlert] = useState<string | null>(null);

  // KYC Snapshot feature
  const [capturedSnapshots, setCapturedSnapshots] = useState<KycSnapshot[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<KycSnapshot | null>(null);
  const [flashTileId, setFlashTileId] = useState<string | null>(null);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // 1. Fetch room details on mount
  useEffect(() => {
    if (!roomId) return;

    // Check if user has admin token in localStorage
    const savedAdminToken = localStorage.getItem('admin_token');

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) {
          setRoomError('Private room not found or link has expired.');
          setIsLoadingRoom(false);
          return;
        }
        const data = await res.json();
        setRoomInfo(data);

        if (data.isExpired) {
          setRoomError('This private room link has expired (maximum validity reached).');
        } else if (data.isFull && !adminKey) {
          setRoomError(`This room is at maximum capacity (${data.maxParticipants} participants).`);
        } else {
          // If adminKey is provided or admin is logged in, default role is host
          if (adminKey) {
            setMyRole('host');
            setGuestName('Kalavritti Administrator');
          } else if (savedAdminToken) {
            setMyRole('host');
            setGuestName('Admin Host');
          } else {
            setMyRole('guest');
            // Try to suggest a guest name
            setGuestName(`Artisan Guest #${Math.floor(100 + Math.random() * 900)}`);
          }
        }
      } catch (err) {
        setRoomError('Unable to connect to room service.');
      } finally {
        setIsLoadingRoom(false);
      }
    };

    fetchRoom();
  }, [roomId, adminKey]);

  // Request user preview camera before entering
  useEffect(() => {
    let localPreviewStream: MediaStream | null = null;
    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localPreviewStream = stream;
        setPreviewStream(stream);
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera preview not available yet:', err);
      }
    };

    if (!hasJoined && !roomError && !isLoadingRoom) {
      startPreview();
    }

    // Try geolocation detection if allowed
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            city: 'Assam, India',
            country: 'India',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => {
          // Fallback location
          setUserLocation({ city: 'Kolkata', country: 'India' });
        },
        { timeout: 5000 }
      );
    }

    return () => {
      if (localPreviewStream) {
        localPreviewStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [hasJoined, roomError, isLoadingRoom]);

  // Expiration countdown
  useEffect(() => {
    if (!roomInfo?.expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = roomInfo.expiresAt - now;
      if (diff <= 0) {
        setTimeLeftStr('Expired');
        setRoomError('Room session duration has expired.');
        if (wsRef.current) wsRef.current.close();
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(`${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [roomInfo]);

  // Synchronize local audio/video tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !isAudioMuted));
      localStreamRef.current.getVideoTracks().forEach(t => (t.enabled = !isVideoOff));
    }
    // Also notify WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PEER_MEDIA_STATE',
        isAudioMuted,
        isVideoOff
      }));
    }
  }, [isAudioMuted, isVideoOff]);

  // Join Room Handler
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      // Use preview stream or obtain fresh user stream
      let stream = previewStream;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setHasJoined(true);
      connectSignaling(stream);
    } catch (err) {
      alert('Camera & microphone permissions are required to enter the room.');
    }
  };

  // Connect WebSocket Signaling for Multi-party Private Room
  const connectSignaling = (localStream: MediaStream) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${roomId}&mode=private&adminKey=${adminKey}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'JOIN_PRIVATE_ROOM',
        name: guestName.trim(),
        adminKey,
        isAudioMuted,
        isVideoOff,
        location: shareLocation ? userLocation : undefined
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'ROOM_ERROR') {
          setRoomError(msg.error || 'Unable to join room');
          ws.close();
          return;
        }

        if (msg.type === 'ROOM_JOINED') {
          setMyPeerId(msg.selfId);
          setMyRole(msg.role);

          // Populate existing peers
          const newMap = new Map<string, ParticipantPeer>();
          msg.peers.forEach((p: any) => {
            newMap.set(p.id, {
              id: p.id,
              name: p.name,
              role: p.role,
              isAudioMuted: p.isAudioMuted,
              isVideoOff: p.isVideoOff,
              location: p.location
            });
            // As the newly joined participant, initiate peer connection with existing peers
            createPeerConnection(p.id, localStream, true);
          });
          setParticipants(newMap);
          return;
        }

        if (msg.type === 'PEER_JOINED') {
          const peer = msg.peer;
          setParticipants(prev => {
            const next = new Map(prev);
            next.set(peer.id, {
              id: peer.id,
              name: peer.name,
              role: peer.role,
              isAudioMuted: peer.isAudioMuted,
              isVideoOff: peer.isVideoOff,
              location: peer.location
            });
            return next;
          });
          // Existing peer creates connection waiting for offer (or initiates)
          createPeerConnection(peer.id, localStream, false);
          return;
        }

        if (msg.type === 'PEER_SIGNAL' && msg.from) {
          const senderId = msg.from;
          let pc = peerConnectionsRef.current.get(senderId);
          if (!pc) {
            pc = createPeerConnection(senderId, localStream, false);
          }

          const signal = msg.signal;
          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({
              type: 'PEER_SIGNAL',
              target: senderId,
              signal: pc.localDescription
            }));
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              console.warn('ICE Candidate error', err);
            }
          }
          return;
        }

        if (msg.type === 'PEER_MEDIA_STATE') {
          setParticipants(prev => {
            const next = new Map<string, ParticipantPeer>(prev);
            const target = next.get(msg.peerId);
            if (target) {
              next.set(msg.peerId, {
                ...target,
                isAudioMuted: msg.isAudioMuted,
                isVideoOff: msg.isVideoOff
              });
            }
            return next;
          });
          return;
        }

        // Host Superpower Signals received on client
        if (msg.type === 'REMOTE_MUTE_AUDIO') {
          setIsAudioMuted(true);
          setHostAlert(`Your microphone was muted by the meeting administrator (${msg.by || 'Host'}).`);
          setTimeout(() => setHostAlert(null), 5000);
          return;
        }

        if (msg.type === 'REMOTE_DISABLE_VIDEO') {
          setIsVideoOff(true);
          setHostAlert(`Your camera was turned off by the meeting administrator (${msg.by || 'Host'}).`);
          setTimeout(() => setHostAlert(null), 5000);
          return;
        }

        if (msg.type === 'REMOTE_KICKED') {
          setRoomError(msg.reason || 'You have been removed from this room by the host.');
          cleanupAndExit();
          return;
        }

        if (msg.type === 'PEER_LEFT') {
          const pc = peerConnectionsRef.current.get(msg.peerId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(msg.peerId);
          }
          setParticipants(prev => {
            const next = new Map(prev);
            next.delete(msg.peerId);
            return next;
          });
          return;
        }

        if (msg.type === 'ROOM_CLOSED') {
          setRoomError('This private room has been concluded by the administrator.');
          cleanupAndExit();
        }
      } catch (err) {
        console.error('Signaling message handling error', err);
      }
    };

    ws.onclose = () => {
      console.log('Private room signaling disconnected');
    };
  };

  // Helper to establish Peer Connection
  const createPeerConnection = (targetPeerId: string, localStream: MediaStream, isInitiator: boolean) => {
    let pc = peerConnectionsRef.current.get(targetPeerId);
    if (pc) {
      pc.close();
    }

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });
    peerConnectionsRef.current.set(targetPeerId, pc);

    // Add local tracks
    localStream.getTracks().forEach(track => {
      pc!.addTrack(track, localStream);
    });

    // Handle incoming stream tracks
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      setParticipants(prev => {
        const next = new Map<string, ParticipantPeer>(prev);
        const existing = next.get(targetPeerId);
        if (existing) {
          next.set(targetPeerId, {
            ...existing,
            stream: incomingStream
          });
        }
        return next;
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'PEER_SIGNAL',
          target: targetPeerId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'PEER_SIGNAL',
              target: targetPeerId,
              signal: pc!.localDescription
            }));
          }
        } catch (err) {
          console.error('Negotiation error', err);
        }
      };
    }

    return pc;
  };

  // Cleanup helper
  const cleanupAndExit = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    if (wsRef.current) wsRef.current.close();
  };

  const handleLeaveRoom = () => {
    cleanupAndExit();
    navigate('/join');
  };

  // ==========================================
  // HOST SUPERPOWERS ACTIONS
  // ==========================================
  const handleHostMuteAudio = (targetPeerId: string) => {
    if (myRole !== 'host' || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'HOST_COMMAND',
      action: 'MUTE_AUDIO',
      targetId: targetPeerId
    }));
  };

  const handleHostDisableVideo = (targetPeerId: string) => {
    if (myRole !== 'host' || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'HOST_COMMAND',
      action: 'DISABLE_VIDEO',
      targetId: targetPeerId
    }));
  };

  const handleHostKick = (targetPeerId: string) => {
    if (myRole !== 'host' || !wsRef.current) return;
    if (confirm('Are you sure you want to remove this participant from the room?')) {
      wsRef.current.send(JSON.stringify({
        type: 'HOST_COMMAND',
        action: 'KICK',
        targetId: targetPeerId
      }));
    }
  };

  // PHOTO / SNAPSHOT CAPTURE (KYC PHOTO)
  const handleCaptureSnapshot = async (targetPeerId: string, participantName: string) => {
    // Locate the video element for this participant
    const videoEl = document.getElementById(`video-${targetPeerId}`) as HTMLVideoElement;
    if (!videoEl) {
      alert('Unable to capture camera stream: Video feed not ready.');
      return;
    }

    // Trigger visual shutter flash
    setFlashTileId(targetPeerId);
    setTimeout(() => setFlashTileId(null), 300);

    // Audio click effect (subtle synthetic shutter chirp)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}

    // Draw video frame to full-resolution offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    // Stamp watermark header onto snapshot
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvas.height - 38, canvas.width, 38);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Kalavritti KYC • ${participantName} • ${new Date().toLocaleString()}`, 14, canvas.height - 14);

    const imageUrl = canvas.toDataURL('image/jpeg', 0.92);

    const newSnapshot: KycSnapshot = {
      id: 'snap-' + Date.now(),
      roomId: roomId || 'private-room',
      roomTitle: roomInfo?.title || 'Private Session',
      participantId: targetPeerId,
      participantName,
      imageUrl,
      timestamp: Date.now()
    };

    setCapturedSnapshots(prev => [newSnapshot, ...prev]);
    setPreviewSnapshot(newSnapshot);

    // Save snapshot to server KYC archive
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/admin/snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newSnapshot)
      });
    } catch (err) {
      console.warn('Failed to upload snapshot to server archive:', err);
    }
  };

  const copyGuestLink = () => {
    const url = roomInfo?.guestUrl || `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url);
    setIsCopiedGuest(true);
    setTimeout(() => setIsCopiedGuest(false), 2000);
  };

  const copyAdminLink = () => {
    const key = adminKey || (roomInfo as any)?.adminKey;
    const url = roomInfo?.adminUrl || `${window.location.origin}/room/${roomId}?adminKey=${key}`;
    navigator.clipboard.writeText(url);
    setIsCopiedAdmin(true);
    setTimeout(() => setIsCopiedAdmin(false), 2000);
  };

  // -------------------------------------------------------------
  // RENDER: LOADING & ERROR STATES
  // -------------------------------------------------------------
  if (isLoadingRoom) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center p-6 bg-background text-on-surface">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="text-base font-semibold text-primary">Connecting to private room...</p>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center p-6 bg-background text-on-surface">
        <div className="max-w-md w-full bg-surface-container rounded-2xl border border-border-subtle p-8 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4 border border-error/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="font-headline text-2xl font-bold text-primary mb-2">Room Unavailable</h2>
          <p className="text-sm font-medium text-on-surface-variant mb-6 leading-relaxed">
            {roomError}
          </p>
          <div className="flex flex-col gap-3">
            <Link 
              to="/join"
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary-container transition-colors shadow-sm"
            >
              Return to Home
            </Link>
            <Link 
              to="/admin"
              className="w-full py-2.5 bg-surface border border-border-subtle text-primary font-semibold text-xs rounded-xl hover:bg-surface-container transition-colors"
            >
              Go to Admin Console &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PRE-JOIN MODAL (NAME & CAMERA CHECK)
  // -------------------------------------------------------------
  if (!hasJoined) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-on-surface">
        <div className="max-w-lg w-full bg-surface-container rounded-3xl border border-border-subtle shadow-xl overflow-hidden">
          
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border-subtle/70 bg-surface/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LotusLogo className="w-8 h-8 text-accent" />
              <div>
                <h1 className="font-headline text-lg sm:text-xl font-bold text-primary leading-tight">
                  {roomInfo?.title || 'Private Customer Room'}
                </h1>
                <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>Valid for: {timeLeftStr || '24 Hours'}</span>
                  <span>•</span>
                  <span>Max: {roomInfo?.maxParticipants || 8} people</span>
                </p>
              </div>
            </div>
            {myRole === 'host' && (
              <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold tracking-wider uppercase">
                Host / Admin
              </span>
            )}
          </div>

          <form onSubmit={handleJoinRoom} className="p-6 space-y-6">
            
            {/* Camera Preview */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-border-subtle shadow-inner flex items-center justify-center">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container">
                  <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-2 shadow-inner">
                    <LotusLogo className="w-7 h-7 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant">Camera Disabled</span>
                </div>
              )}

              {/* In-preview quick controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-surface/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border-subtle shadow-lg">
                <button
                  type="button"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                    isAudioMuted 
                      ? 'bg-error/20 border-error/30 text-error' 
                      : 'bg-surface-container border-border-subtle text-primary hover:bg-surface-container-high'
                  }`}
                  title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                    isVideoOff 
                      ? 'bg-error/20 border-error/30 text-error' 
                      : 'bg-surface-container border-border-subtle text-primary hover:bg-surface-container-high'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-primary">
                Enter Your Full Name *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Ramesh Kumar (Artisan) or Customer Name"
                className="w-full bg-surface border border-border-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl px-4 py-3 text-sm font-semibold text-on-surface focus:outline-none transition-all shadow-inner"
              />
              <p className="text-[11px] text-on-surface-variant font-medium">
                This display name will be visible to everyone inside the video meeting.
              </p>
            </div>

            {/* Location sharing toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border-subtle text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                <span className="font-semibold text-primary">Share Location for KYC verification</span>
              </div>
              <input 
                type="checkbox"
                checked={shareLocation}
                onChange={(e) => setShareLocation(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-sm tracking-wide hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
            >
              <span>Enter Room Now</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: ACTIVE MULTI-PARTY PRIVATE ROOM (BIG VIDEO GRID)
  // -------------------------------------------------------------
  const allPeers: ParticipantPeer[] = Array.from(participants.values());
  const totalInRoom = allPeers.length + 1; // peers + self

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col bg-background font-body text-on-surface relative overflow-hidden">
      
      {/* Toast Alert for Host Action */}
      {hostAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-error text-on-error rounded-xl font-semibold text-xs shadow-xl border border-error/30 animate-bounce">
          {hostAlert}
        </div>
      )}

      {/* TOP ROOM BAR */}
      <header className="w-full bg-surface border-b border-border-subtle px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <LotusLogo className="w-7 h-7 text-accent shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-base sm:text-lg font-bold text-primary leading-none">
                {roomInfo?.title || 'Private Session'}
              </h1>
              {myRole === 'host' ? (
                <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold tracking-wider uppercase">
                  Admin Host
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surface-container border border-border-subtle text-primary text-[10px] font-bold tracking-wider uppercase">
                  Participant
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-on-surface-variant font-medium mt-1">
              <span className="flex items-center gap-1 text-accent font-bold">
                <Clock className="w-3.5 h-3.5" />
                {timeLeftStr}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {totalInRoom} / {roomInfo?.maxParticipants || 8} connected
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links & Snapshot Drawer Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyGuestLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-lg text-xs font-semibold text-primary transition-all shadow-sm"
            title="Copy guest link to invite others"
          >
            {isCopiedGuest ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopiedGuest ? 'Copied Guest Link!' : 'Invite Link'}</span>
          </button>

          {myRole === 'host' && (
            <button
              onClick={copyAdminLink}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-bold text-primary transition-all shadow-sm"
              title="Copy host link with admin key"
            >
              {isCopiedAdmin ? <Check className="w-3.5 h-3.5 text-accent" /> : <Shield className="w-3.5 h-3.5" />}
              <span>{isCopiedAdmin ? 'Copied Host Key!' : 'Host Link'}</span>
            </button>
          )}

          {myRole === 'host' && capturedSnapshots.length > 0 && (
            <button
              onClick={() => setPreviewSnapshot(capturedSnapshots[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-xs font-bold text-accent transition-all shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshots ({capturedSnapshots.length})</span>
            </button>
          )}

          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-error/10 hover:bg-error/20 border border-error/30 text-error rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* BIG VIDEO GRID WINDOW */}
      <main className="flex-grow p-3 sm:p-6 flex items-center justify-center overflow-y-auto">
        <div className={`w-full max-w-7xl mx-auto grid gap-4 ${
          totalInRoom === 1 ? 'grid-cols-1 max-w-3xl' :
          totalInRoom === 2 ? 'grid-cols-1 md:grid-cols-2' :
          totalInRoom <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          
          {/* 1. SELF VIDEO CARD */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border-subtle shadow-md group flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container">
                <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-2 shadow-inner">
                  <LotusLogo className="w-7 h-7 text-primary" />
                </div>
                <span className="text-xs font-semibold text-on-surface-variant">Your camera is off</span>
              </div>
            )}

            {/* Bottom identity tag */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs font-bold">
              <span>{guestName} (You)</span>
              {myRole === 'host' && (
                <span className="px-1.5 py-0.5 rounded bg-primary text-[10px] text-on-primary uppercase font-bold">Host</span>
              )}
              {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-error" />}
            </div>
          </div>

          {/* 2. REMOTE PEERS VIDEO CARDS */}
          {allPeers.map((peer) => (
            <div 
              key={peer.id}
              className={`relative aspect-video bg-black rounded-2xl overflow-hidden border border-border-subtle shadow-md group flex items-center justify-center transition-all ${
                flashTileId === peer.id ? 'ring-8 ring-accent brightness-125' : ''
              }`}
            >
              {peer.stream ? (
                <VideoRenderer stream={peer.stream} id={`video-${peer.id}`} isVideoOff={peer.isVideoOff} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container">
                  <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-2 shadow-inner font-headline text-lg font-bold">
                    {peer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant">Connecting camera...</span>
                </div>
              )}

              {/* Shutter flash overlay */}
              {flashTileId === peer.id && (
                <div className="absolute inset-0 bg-white pointer-events-none animate-ping opacity-75 z-40" />
              )}

              {/* Bottom identity badge */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs font-bold z-20">
                <span>{peer.name}</span>
                {peer.role === 'host' && (
                  <span className="px-1.5 py-0.5 rounded bg-primary text-[10px] text-on-primary uppercase font-bold">Host</span>
                )}
                {peer.isAudioMuted && <MicOff className="w-3.5 h-3.5 text-error" />}
              </div>

              {/* ========================================================= */}
              {/* ADMIN / HOST SUPERPOWER CONTROLS ON GUEST CARD            */}
              {/* ========================================================= */}
              {myRole === 'host' && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1.5 rounded-xl border border-white/10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                  
                  {/* Photo / Snapshot KYC Button */}
                  <button
                    onClick={() => handleCaptureSnapshot(peer.id, peer.name)}
                    className="p-2 rounded-lg bg-accent/20 hover:bg-accent text-accent hover:text-on-accent transition-colors"
                    title="Click Photo / KYC Snapshot"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Remote Mute Button */}
                  <button
                    onClick={() => handleHostMuteAudio(peer.id)}
                    className="p-2 rounded-lg bg-surface-container/80 hover:bg-error/30 text-white hover:text-error transition-colors"
                    title="Mute Guest's Microphone"
                  >
                    <VolumeX className="w-4 h-4" />
                  </button>

                  {/* Remote Disable Video Button */}
                  <button
                    onClick={() => handleHostDisableVideo(peer.id)}
                    className="p-2 rounded-lg bg-surface-container/80 hover:bg-error/30 text-white hover:text-error transition-colors"
                    title="Turn Off Guest's Camera"
                  >
                    <VideoOff className="w-4 h-4" />
                  </button>

                  {/* Kick Participant Button */}
                  <button
                    onClick={() => handleHostKick(peer.id)}
                    className="p-2 rounded-lg bg-error/20 hover:bg-error text-error hover:text-on-error transition-colors"
                    title="Kick / Remove Participant"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Waiting for other participants state */}
          {allPeers.length === 0 && (
            <div className="aspect-video bg-surface-container/50 border-2 border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-accent mb-3 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-headline text-base font-bold text-primary mb-1">Waiting for others to join</h3>
              <p className="text-xs text-on-surface-variant max-w-xs mb-4">
                Share the guest invite link with your customer, artisan, or team member.
              </p>
              <button
                onClick={copyGuestLink}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container transition-all shadow-md"
              >
                {isCopiedGuest ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedGuest ? 'Link Copied!' : 'Copy Guest Link'}</span>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* BOTTOM CONTROL TOOLBAR */}
      <footer className="w-full bg-surface/90 backdrop-blur-md border-t border-border-subtle py-3 px-6 flex items-center justify-center gap-4 z-30">
        <button
          onClick={() => setIsAudioMuted(!isAudioMuted)}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
            isAudioMuted 
              ? 'bg-error text-on-error border-error' 
              : 'bg-surface-container hover:bg-surface-container-high border-border-subtle text-primary'
          }`}
          title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
            isVideoOff 
              ? 'bg-error text-on-error border-error' 
              : 'bg-surface-container hover:bg-surface-container-high border-border-subtle text-primary'
          }`}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={handleLeaveRoom}
          className="px-6 h-12 rounded-full bg-error text-on-error hover:bg-error/90 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-error/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Leave Room</span>
        </button>
      </footer>

      {/* ========================================================= */}
      {/* KYC SNAPSHOT PREVIEW MODAL                                */}
      {/* ========================================================= */}
      {previewSnapshot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface-container max-w-xl w-full rounded-3xl border border-border-subtle overflow-hidden shadow-2xl">
            <div className="p-4 px-6 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-accent" />
                <h3 className="font-headline text-base font-bold text-primary">
                  KYC Photo Verification Snapshot
                </h3>
              </div>
              <button 
                onClick={() => setPreviewSnapshot(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="w-full aspect-video rounded-xl overflow-hidden border border-border-subtle bg-black shadow-inner">
                <img 
                  src={previewSnapshot.imageUrl} 
                  alt={previewSnapshot.participantName}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <div>
                  <span className="font-bold text-primary">{previewSnapshot.participantName}</span>
                  <p className="text-[11px] mt-0.5">{new Date(previewSnapshot.timestamp).toLocaleString()}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-bold">
                  Archived to Admin
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <a
                  href={previewSnapshot.imageUrl}
                  download={`KYC-${previewSnapshot.participantName.replace(/\s+/g, '_')}-${previewSnapshot.timestamp}.jpg`}
                  className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Photo</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewSnapshot(null)}
                  className="px-6 py-3 bg-surface border border-border-subtle text-on-surface font-semibold text-xs rounded-xl hover:bg-surface-container transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Small helper component to attach remote media stream to video element
function VideoRenderer({ stream, id, isVideoOff }: { stream: MediaStream; id: string; isVideoOff?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      id={id}
      ref={videoRef}
      autoPlay
      playsInline
      className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
    />
  );
}
