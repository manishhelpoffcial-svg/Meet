import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LotusLogo } from "../components/LotusLogo";
import { 
  Lock, LogOut, Radio, Play, Square, Users, MessageSquare, Trash2, 
  CheckCircle2, Plus, RefreshCw, Mic, MicOff, Video as VideoIcon, VideoOff, 
  MonitorPlay, Wifi, Copy, Check, ExternalLink, Clock, Shield, Camera, 
  MapPin, Globe, Laptop, ChevronRight, UserX, AlertCircle, X, Download, 
  Eye, Sparkles, Filter
} from 'lucide-react';
import { KycSnapshot, BroadcastViewer, PrivateRoomInfo } from '../types';

type AdminTab = 'broadcast' | 'rooms' | 'announcements' | 'snapshots';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('broadcast');

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);

  // Broadcast / Presenter state
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [wsStatus, setWsStatus] = useState<'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [viewerCount, setViewerCount] = useState(0);

  // Broadcast Viewers metadata state
  const [viewersList, setViewersList] = useState<BroadcastViewer[]>([]);
  const [selectedViewer, setSelectedViewer] = useState<BroadcastViewer | null>(null);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);

  // Private Customer Rooms state
  const [privateRooms, setPrivateRooms] = useState<PrivateRoomInfo[]>([]);
  const [roomTitle, setRoomTitle] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createdRoomResult, setCreatedRoomResult] = useState<PrivateRoomInfo | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // KYC Snapshots state
  const [snapshots, setSnapshots] = useState<KycSnapshot[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<KycSnapshot | null>(null);

  // Presenter WebRTC Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const roomId = 'main';

  // 1. Initial auth token verification
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      verifyToken(token);
    } else {
      setIsLoading(false);
    }
    return () => {
      cleanupWebRTC();
    };
  }, []);

  // Sync mic/camera track status
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => (track.enabled = isMicOn));
      streamRef.current.getVideoTracks().forEach((track) => (track.enabled = isVideoOn));
    }
  }, [isMicOn, isVideoOn]);

  // Periodic polling for broadcast viewers & private rooms
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchViewers();
    fetchPrivateRooms();
    fetchSnapshots();

    const interval = setInterval(() => {
      fetchViewers();
      fetchPrivateRooms();
    }, 4000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const cleanupWebRTC = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
  };

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch('/api/admin/announcements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchAnnouncements();
        fetchPrivateRooms();
        fetchSnapshots();
        setTimeout(initCameraAndWS, 500);
      } else {
        localStorage.removeItem('admin_token');
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const initCameraAndWS = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      connectWebSocket();
    } catch (err) {
      console.error('Camera access denied:', err);
      setWsStatus('ERROR');
      setErrorMsg('Camera & microphone access required');
    }
  };

  const connectWebSocket = () => {
    setWsStatus('CONNECTING');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${roomId}&role=presenter`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('IDLE');
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'VIEWER_JOINED') {
        const viewerId = msg.viewerId;
        createPeerConnection(viewerId);
        setViewerCount(prev => prev + 1);
        fetchViewers();
      } else if (msg.type === 'ANSWER' && msg.from) {
        const pc = peersRef.current.get(msg.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      } else if (msg.type === 'CANDIDATE' && msg.from) {
        const pc = peersRef.current.get(msg.from);
        if (pc && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.error('Error adding ICE candidate', e);
          }
        }
      } else if (msg.type === 'VIEWER_LEFT') {
        const pc = peersRef.current.get(msg.viewerId);
        if (pc) {
          pc.close();
          peersRef.current.delete(msg.viewerId);
        }
        setViewerCount(prev => Math.max(0, prev - 1));
        fetchViewers();
      } else if (msg.type === 'COMMAND_START_BROADCAST') {
        setIsBroadcasting(true);
        setWsStatus('LIVE');
      } else if (msg.type === 'COMMAND_STOP_BROADCAST') {
        setIsBroadcasting(false);
        setWsStatus('IDLE');
      }
    };

    ws.onclose = () => {
      setWsStatus('IDLE');
      setIsBroadcasting(false);
    };

    ws.onerror = () => {
      setWsStatus('ERROR');
      setErrorMsg('Signaling connection error');
    };
  };

  const createPeerConnection = (viewerId: string) => {
    let pc = peersRef.current.get(viewerId);
    if (pc) pc.close();

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });
    peersRef.current.set(viewerId, pc);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        pc!.addTrack(track, streamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'CANDIDATE',
          target: viewerId,
          candidate: event.candidate
        }));
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc!.createOffer();
        await pc!.setLocalDescription(offer);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'OFFER',
            target: viewerId,
            sdp: pc!.localDescription
          }));
        }
      } catch (err) {
        console.error('Error in negotiation:', err);
      }
    };
  };

  const startBroadcast = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      const res = await fetch('/api/admin/broadcast/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        setIsBroadcasting(true);
        setWsStatus('LIVE');
        wsRef.current.send(JSON.stringify({
          type: 'BROADCAST_STATUS',
          status: 'LIVE'
        }));
      }
    } catch (e) {
      console.error('Failed to start broadcast');
    }
  };

  const stopBroadcast = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      const res = await fetch('/api/admin/broadcast/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        setIsBroadcasting(false);
        setWsStatus('IDLE');
        wsRef.current.send(JSON.stringify({
          type: 'BROADCAST_STATUS',
          status: 'OFFLINE'
        }));
      }
    } catch (e) {
      console.error('Failed to stop broadcast');
    }
  };

  // -------------------------------------------------------------
  // DATA FETCHING HELPERS
  // -------------------------------------------------------------
  const fetchViewers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await fetch('/api/admin/broadcast/viewers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewersList(data.viewers || []);
        if (data.count !== undefined) {
          setViewerCount(data.count);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch viewers list:', e);
    }
  };

  const fetchPrivateRooms = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await fetch('/api/admin/private-rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrivateRooms(data.rooms || []);
      }
    } catch (e) {
      console.warn('Failed to fetch private rooms:', e);
    }
  };

  const fetchSnapshots = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await fetch('/api/admin/snapshots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (e) {
      console.warn('Failed to fetch snapshots:', e);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/announcements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (e) {
      console.error('Failed to fetch announcements');
    }
  };

  // -------------------------------------------------------------
  // PRIVATE ROOM CREATION HANDLER
  // -------------------------------------------------------------
  const handleCreatePrivateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRoom(true);

    try {
      const token = localStorage.getItem('admin_token');
      const minutes = Math.min(Math.max(5, parseFloat(durationHours) * 60), 1440); // max 24h
      const capacity = parseInt(maxParticipants) || 8;

      const res = await fetch('/api/admin/private-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: roomTitle.trim() || undefined,
          durationMinutes: minutes,
          maxParticipants: capacity
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedRoomResult(data.room);
        setRoomTitle('');
        fetchPrivateRooms();
      }
    } catch (err) {
      alert('Failed to generate private room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to end and delete this private room? All active participants will be disconnected.')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/private-rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPrivateRooms();
        if (createdRoomResult?.id === id) {
          setCreatedRoomResult(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete room', err);
    }
  };

  const handleKickBroadcastViewer = async (viewerId: string) => {
    if (!confirm('Kick this viewer from the broadcast?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/broadcast/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ viewerId })
      });
      if (res.ok) {
        setSelectedViewer(null);
        fetchViewers();
      }
    } catch (err) {
      console.error('Failed to kick viewer', err);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Delete this KYC snapshot from records?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/snapshots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSnapshots(prev => prev.filter(s => s.id !== id));
        if (previewSnapshot?.id === id) setPreviewSnapshot(null);
      }
    } catch (err) {
      console.error('Failed to delete snapshot', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------
  // ANNOUNCEMENTS HANDLERS
  // -------------------------------------------------------------
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}` 
        },
        body: JSON.stringify({ text: newAnnouncement, active: true })
      });
      if (res.ok) {
        setNewAnnouncement('');
        setIsAddingAnnouncement(false);
        fetchAnnouncements();
      }
    } catch (e) {
      console.error('Failed to add announcement');
    }
  };

  const toggleAnnouncement = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}` 
        },
        body: JSON.stringify({ active: !currentActive })
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (e) {
      console.error('Failed to toggle announcement');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (e) {
      console.error('Failed to delete announcement');
    }
  };

  // -------------------------------------------------------------
  // AUTH LOGIN / LOGOUT
  // -------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        fetchAnnouncements();
        fetchPrivateRooms();
        fetchSnapshots();
        setTimeout(initCameraAndWS, 500);
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (e) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    cleanupWebRTC();
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-background text-on-surface">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LOGIN FORM
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface relative">
        <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-5 flex items-center justify-center">
             <LotusLogo className="w-[120vw] h-[120vw] max-w-[1500px] max-h-[1500px] text-accent animate-pulse" style={{ animationDuration: '10s' }} />
          </div>
          
          <div className="relative z-10 w-full max-w-md bg-surface-container border border-border-subtle p-8 md:p-10 rounded-3xl shadow-xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 border border-border-subtle shadow-inner">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-headline text-3xl font-bold text-primary mb-2">Admin Portal</h2>
              <p className="text-xs text-on-surface-variant font-medium text-center">
                Kalavritti Broadcast & Private Customer Rooms Management
              </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-primary uppercase tracking-widest">
                  Administrator Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface border border-border-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl px-4 py-3.5 text-on-surface focus:outline-none transition-all shadow-inner font-medium text-sm"
                />
              </div>
              {loginError && <p className="text-error text-sm font-medium">{loginError}</p>}
              <button 
                type="submit" 
                className="w-full bg-primary text-on-primary py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container transition-colors font-bold text-sm shadow-md shadow-primary/20 cursor-pointer"
              >
                Sign In to Console
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN ADMIN CONSOLE WITH SEPARATE PAGES / TABS
  // -------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface">
      <div className="flex-grow p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-6">
        
        {/* TOP CONSOLE HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <LotusLogo className="w-9 h-9 text-accent shrink-0" />
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl font-bold text-primary leading-tight">
                Admin Console
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Live Broadcast Studio • Customer Private Rooms • Announcements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/join"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-xl text-primary text-xs font-semibold transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Website</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-border-subtle rounded-xl text-error text-xs font-bold hover:bg-error/10 hover:border-error/30 transition-colors shadow-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* ADMIN NAVIGATION MENU (TABS SECTIONS)                      */}
        {/* ========================================================= */}
        <nav className="flex items-center gap-2 border-b border-border-subtle overflow-x-auto pb-1 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'border-primary text-primary bg-surface-container font-bold shadow-sm'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50'
            }`}
          >
            <MonitorPlay className="w-4 h-4 text-accent" />
            <span>Broadcast Studio</span>
            {viewerCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-live-indicator text-white text-[10px] font-bold animate-pulse">
                {viewerCount} Live
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'border-primary text-primary bg-surface-container font-bold shadow-sm'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50'
            }`}
          >
            <Shield className="w-4 h-4 text-accent" />
            <span>Customer Rooms</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary text-[10px] font-bold">
              {privateRooms.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'announcements'
                ? 'border-primary text-primary bg-surface-container font-bold shadow-sm'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-accent" />
            <span>Announcements</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary text-[10px] font-bold">
              {announcements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'border-primary text-primary bg-surface-container font-bold shadow-sm'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50'
            }`}
          >
            <Camera className="w-4 h-4 text-accent" />
            <span>KYC Snapshots</span>
            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
              {snapshots.length}
            </span>
          </button>
        </nav>

        {/* ========================================================= */}
        {/* TAB 1: BROADCAST STUDIO & LIVE WATCHING AUDIENCE SECTION   */}
        {/* ========================================================= */}
        {activeTab === 'broadcast' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* PRESENTER VIDEO CONSOLE (7 cols) */}
              <div className="lg:col-span-7 bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4 text-accent" />
                    Presenter Live Console
                  </h2>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isBroadcasting ? 'bg-live-indicator/10 text-live-indicator border border-live-indicator/30' : 'bg-surface text-on-surface-variant border border-border-subtle'
                  }`}>
                    {isBroadcasting ? '● STREAM IS LIVE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Video Container */}
                <div className="relative w-full aspect-video border border-border-subtle bg-black overflow-hidden rounded-2xl shadow-inner flex items-center justify-center mb-6">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted 
                    className={`w-full h-full object-cover transition-opacity duration-700 ${isVideoOn ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!isVideoOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container">
                      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary shadow-inner border border-border-subtle mb-3">
                        <LotusLogo className="w-8 h-8 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-on-surface-variant">Camera Disabled</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="absolute top-4 left-4 right-4 p-2 bg-error/90 backdrop-blur-md rounded-xl text-on-error text-center font-medium text-xs shadow-lg border border-error">
                      {errorMsg}
                    </div>
                  )}

                  {/* Camera & Mic floating toggles */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface/80 backdrop-blur-xl px-4 py-2 border border-border-subtle rounded-full shadow-lg">
                    <button
                      onClick={() => setIsMicOn(!isMicOn)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                        isMicOn 
                          ? 'border-border-subtle bg-surface-container hover:bg-surface-container-high text-primary' 
                          : 'border-error/30 bg-error/20 text-error hover:bg-error/30'
                      }`}
                      title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                    >
                      {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setIsVideoOn(!isVideoOn)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                        isVideoOn 
                          ? 'border-border-subtle bg-surface-container hover:bg-surface-container-high text-primary' 
                          : 'border-error/30 bg-error/20 text-error hover:bg-error/30'
                      }`}
                      title={isVideoOn ? "Turn Camera Off" : "Turn Camera On"}
                    >
                      {isVideoOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Quick Info & Action buttons */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-border-subtle/50 text-xs font-semibold">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-accent" /> Signaling Status
                    </span>
                    <span className="text-primary font-bold">{wsStatus}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-subtle/50 text-xs font-semibold">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-accent" /> Real-time Audience
                    </span>
                    <span className="text-primary font-bold text-sm">{viewerCount} Watching</span>
                  </div>
                </div>

                <div className="pt-2">
                  {isBroadcasting ? (
                    <button
                      onClick={stopBroadcast}
                      className="w-full bg-error text-on-error py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-error/90 transition-colors font-bold text-sm shadow-md shadow-error/20 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop Broadcast
                    </button>
                  ) : (
                    <button
                      onClick={startBroadcast}
                      className="w-full bg-primary text-on-primary py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container transition-colors font-bold text-sm shadow-md shadow-primary/20 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Go Live (Start Stream)
                    </button>
                  )}
                </div>
              </div>

              {/* AUDIENCE WATCHING SECTION WITH VIEWER METADATA (5 cols) */}
              <div className="lg:col-span-5 bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      Audience Watching Now ({viewerCount})
                    </h2>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Click on any viewer's avatar logo to view IP, location & tech details
                    </p>
                  </div>
                  <button
                    onClick={fetchViewers}
                    className="p-1.5 rounded-lg bg-surface border border-border-subtle text-primary hover:bg-surface-container transition-colors"
                    title="Refresh Audience"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Viewers Cards Grid */}
                <div className="flex-grow overflow-y-auto max-h-[460px] space-y-3 pr-1">
                  {viewersList.length === 0 ? (
                    <div className="h-64 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-2 shadow-inner">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-primary">No Active Viewers Yet</h4>
                      <p className="text-[11px] text-on-surface-variant max-w-xs mt-1">
                        When users open the live stream on the website, they will appear here with IP and geolocation metrics.
                      </p>
                    </div>
                  ) : (
                    viewersList.map((viewer) => (
                      <div
                        key={viewer.id}
                        onClick={() => setSelectedViewer(viewer)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          selectedViewer?.id === viewer.id
                            ? 'bg-surface border-accent shadow-md ring-2 ring-accent/20'
                            : 'bg-surface/70 hover:bg-surface border-border-subtle shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Viewer Logo with Letter / Initials */}
                          <div 
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 transition-transform hover:scale-105"
                            style={{ backgroundColor: viewer.avatarColor || '#2563EB' }}
                          >
                            {viewer.initials || viewer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <span>{viewer.name}</span>
                              <span className="w-2 h-2 rounded-full bg-live-indicator inline-block animate-ping" />
                            </h4>
                            <p className="text-[11px] text-on-surface-variant flex items-center gap-2 mt-0.5">
                              <span>Watching: {Math.floor((viewer.durationSeconds || 0) / 60)}m {(viewer.durationSeconds || 0) % 60}s</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-primary">{viewer.ip}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md bg-surface-container border border-border-subtle text-[10px] font-bold text-accent">
                            {viewer.location?.city ? `${viewer.location.city}` : 'Details &rarr;'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Live Public Link to share */}
                <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">Public Stream Link:</span>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/join`, 'public-broadcast')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-border-subtle rounded-lg font-bold text-primary hover:bg-surface-container transition-all"
                  >
                    {copiedId === 'public-broadcast' ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'public-broadcast' ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* ========================================================= */}
            {/* VIEWER DETAILS MODAL (POPUP ON LOGO CLICK)               */}
            {/* ========================================================= */}
            {selectedViewer && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                <div className="bg-surface-container max-w-md w-full rounded-3xl border border-border-subtle shadow-2xl overflow-hidden">
                  
                  {/* Modal Header */}
                  <div className="p-6 pb-4 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-md shrink-0"
                        style={{ backgroundColor: selectedViewer.avatarColor || '#2563EB' }}
                      >
                        {selectedViewer.initials}
                      </div>
                      <div>
                        <h3 className="font-headline text-base font-bold text-primary">
                          {selectedViewer.name}
                        </h3>
                        <p className="text-[11px] text-on-surface-variant">
                          Viewer ID: <span className="font-mono text-primary font-bold">{selectedViewer.id}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedViewer(null)}
                      className="p-1 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body: IP and Geo Details */}
                  <div className="p-6 space-y-4">
                    
                    {/* IP Address Card */}
                    <div className="p-3.5 rounded-2xl bg-surface border border-border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-accent" />
                        <div>
                          <span className="text-[11px] font-bold uppercase text-on-surface-variant block">IP Address</span>
                          <span className="font-mono font-bold text-sm text-primary">{selectedViewer.ip}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        IPv4/v6 Verified
                      </span>
                    </div>

                    {/* Geolocation Card */}
                    <div className="p-3.5 rounded-2xl bg-surface border border-border-subtle space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-on-surface-variant flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-accent" /> Geographic Location
                        </span>
                        {selectedViewer.location?.city ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                            Permission Granted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-medium">
                            Permission Not Granted
                          </span>
                        )}
                      </div>

                      {selectedViewer.location?.city ? (
                        <div className="pt-1">
                          <p className="text-sm font-bold text-primary">
                            {selectedViewer.location.city}, {selectedViewer.location.region || selectedViewer.location.country}
                          </p>
                          {selectedViewer.location.latitude && (
                            <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                              Coords: {selectedViewer.location.latitude.toFixed(4)}° N, {selectedViewer.location.longitude?.toFixed(4)}° E
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-variant font-medium pt-1">
                          Location permission was not provided by this viewer's browser. Approximate region inferred from server network.
                        </p>
                      )}
                    </div>

                    {/* Device & Watching Time */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-surface border border-border-subtle">
                        <span className="text-[10px] font-bold uppercase text-on-surface-variant block">Duration</span>
                        <span className="font-bold text-primary mt-1 block">
                          {Math.floor((selectedViewer.durationSeconds || 0) / 60)}m {(selectedViewer.durationSeconds || 0) % 60}s
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-surface border border-border-subtle">
                        <span className="text-[10px] font-bold uppercase text-on-surface-variant block">Network</span>
                        <span className="font-bold text-accent mt-1 block">
                          {selectedViewer.network?.quality || 'Good'} ({selectedViewer.network?.latencyMs || 42}ms)
                        </span>
                      </div>
                    </div>

                    {/* Kick Viewer Action */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleKickBroadcastViewer(selectedViewer.id)}
                        className="w-full py-3 bg-error/10 hover:bg-error/20 border border-error/30 text-error rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <UserX className="w-4 h-4" />
                        <span>Disconnect / Kick Viewer</span>
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CUSTOMER ROOMS (PRIVATE ROOMS MANAGER)             */}
        {/* ========================================================= */}
        {activeTab === 'rooms' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Create Room Box */}
            <div className="bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-accent" />
                  <h2 className="font-headline text-xl font-bold text-primary">
                    Create New Customer / KYC Private Room
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
                  Generate secure, temporary private rooms for video KYC, artisan onboarding, or 1-on-1 customer consultations.
                  Configurable validity link up to 24 hours with strict participant capacity.
                </p>

                <form onSubmit={handleCreatePrivateRoom} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Room Title */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-primary tracking-wider">
                        Session Title
                      </label>
                      <input
                        type="text"
                        value={roomTitle}
                        onChange={(e) => setRoomTitle(e.target.value)}
                        placeholder="e.g. Sari KYC Verification"
                        className="w-full bg-surface border border-border-subtle focus:border-accent rounded-xl px-3.5 py-2.5 text-xs font-semibold text-on-surface focus:outline-none transition-all shadow-inner"
                      />
                    </div>

                    {/* Duration (hours, max 24h) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-primary tracking-wider">
                        Link Validity (Max 24h)
                      </label>
                      <select
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                        className="w-full bg-surface border border-border-subtle focus:border-accent rounded-xl px-3.5 py-2.5 text-xs font-semibold text-on-surface focus:outline-none transition-all shadow-inner cursor-pointer"
                      >
                        <option value="0.5">30 Minutes</option>
                        <option value="1">1 Hour</option>
                        <option value="2">2 Hours</option>
                        <option value="4">4 Hours</option>
                        <option value="8">8 Hours</option>
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours (Maximum)</option>
                      </select>
                    </div>

                    {/* Max Participants */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-primary tracking-wider">
                        Participant Limit
                      </label>
                      <select
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                        className="w-full bg-surface border border-border-subtle focus:border-accent rounded-xl px-3.5 py-2.5 text-xs font-semibold text-on-surface focus:outline-none transition-all shadow-inner cursor-pointer"
                      >
                        <option value="2">2 Persons (1-on-1 KYC)</option>
                        <option value="4">4 Persons</option>
                        <option value="8">8 Persons</option>
                        <option value="15">15 Persons</option>
                        <option value="30">30 Persons</option>
                      </select>
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingRoom}
                    className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-container transition-all flex items-center gap-2 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isCreatingRoom ? 'Generating Private Link...' : 'Generate Private Room Link'}</span>
                  </button>
                </form>

                {/* Just Created Room Result Alert */}
                {createdRoomResult && (
                  <div className="mt-6 p-4 rounded-2xl bg-accent/10 border border-accent/30 space-y-3">
                    <div className="flex items-center gap-2 text-accent font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Private Room Generated Successfully!</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Guest Link */}
                      <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-1.5">
                        <span className="font-bold text-primary block">1. Guest / Customer Link</span>
                        <p className="text-[11px] text-on-surface-variant font-mono truncate" title={createdRoomResult.guestUrl || `${window.location.origin}/room/${createdRoomResult.id}`}>
                          {createdRoomResult.guestUrl || `${window.location.origin}/room/${createdRoomResult.id}`}
                        </p>
                        <button
                          onClick={() => copyToClipboard(createdRoomResult.guestUrl || `${window.location.origin}/room/${createdRoomResult.id}`, 'new-guest')}
                          className="px-3 py-1 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-lg font-bold text-primary text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === 'new-guest' ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === 'new-guest' ? 'Copied Guest Link!' : 'Copy Guest Link'}</span>
                        </button>
                      </div>

                      {/* Admin Host Link */}
                      <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-1.5">
                        <span className="font-bold text-accent block">2. Admin Host Link (Superpowers)</span>
                        <p className="text-[11px] text-on-surface-variant font-mono truncate" title={createdRoomResult.adminUrl || `${window.location.origin}/room/${createdRoomResult.id}?adminKey=${createdRoomResult.adminKey}`}>
                          {createdRoomResult.adminUrl || `${window.location.origin}/room/${createdRoomResult.id}?adminKey=${createdRoomResult.adminKey}`}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(createdRoomResult.adminUrl || `${window.location.origin}/room/${createdRoomResult.id}?adminKey=${createdRoomResult.adminKey}`, 'new-admin')}
                            className="px-3 py-1 bg-primary text-on-primary rounded-lg font-bold text-[11px] hover:bg-primary-container transition-all flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === 'new-admin' ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === 'new-admin' ? 'Copied Host Link!' : 'Copy Host Link'}</span>
                          </button>
                          <Link
                            to={`/room/${createdRoomResult.id}?adminKey=${createdRoomResult.adminKey}`}
                            className="px-3 py-1 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-lg font-bold text-primary text-[11px] transition-all flex items-center gap-1"
                          >
                            <span>Open as Admin &rarr;</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* List of Active Private Rooms */}
            <div className="bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline text-lg font-bold text-primary">
                    Active & Scheduled Customer Rooms
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Manage session links, participants, and host credentials
                  </p>
                </div>
                <button
                  onClick={fetchPrivateRooms}
                  className="p-2 rounded-xl bg-surface border border-border-subtle text-primary hover:bg-surface-container transition-colors shadow-sm"
                  title="Refresh Rooms"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {privateRooms.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border-subtle rounded-2xl">
                  <p className="text-xs font-semibold text-on-surface-variant">
                    No private rooms generated yet. Use the form above to create your first room.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {privateRooms.map((room) => {
                    const isExpired = room.isExpired || Date.now() > room.expiresAt;
                    const guestUrl = room.guestUrl || `${window.location.origin}/room/${room.id}`;
                    const adminUrl = room.adminUrl || `${window.location.origin}/room/${room.id}?adminKey=${room.adminKey}`;

                    return (
                      <div
                        key={room.id}
                        className={`p-5 rounded-2xl border transition-all space-y-4 ${
                          isExpired 
                            ? 'bg-surface/40 border-border-subtle opacity-75' 
                            : 'bg-surface border-border-subtle shadow-sm hover:border-accent/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-accent font-bold uppercase">{room.id}</span>
                            <h4 className="font-headline text-base font-bold text-primary leading-tight mt-0.5">
                              {room.title}
                            </h4>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isExpired ? 'bg-error/10 text-error' : 'bg-accent/15 text-accent'
                          }`}>
                            {isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>

                        {/* Room stats */}
                        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border-subtle/50">
                          <div>
                            <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Capacity</span>
                            <span className="font-bold text-primary flex items-center gap-1 mt-0.5">
                              <Users className="w-3.5 h-3.5 text-accent" />
                              {room.participantCount || 0} / {room.maxParticipants} joined
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Validity</span>
                            <span className="font-bold text-primary flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-accent" />
                              {room.durationMinutes ? `${Math.round(room.durationMinutes / 60)}h validity` : '24h max'}
                            </span>
                          </div>
                        </div>

                        {/* Quick Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => copyToClipboard(guestUrl, `g-${room.id}`)}
                            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-lg text-xs font-semibold text-primary transition-all flex items-center gap-1"
                          >
                            {copiedId === `g-${room.id}` ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === `g-${room.id}` ? 'Copied Guest Link' : 'Guest Link'}</span>
                          </button>

                          <Link
                            to={`/room/${room.id}?adminKey=${room.adminKey}`}
                            className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Join as Admin</span>
                          </Link>

                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1.5 ml-auto text-on-surface-variant hover:text-error transition-colors rounded-lg"
                            title="End & Delete Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ANNOUNCEMENTS MANAGER                              */}
        {/* ========================================================= */}
        {activeTab === 'announcements' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline text-lg font-bold text-primary">
                    Announcements Manager
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Push ticker messages and notifications to all live visitors across the platform
                  </p>
                </div>
                {!isAddingAnnouncement && (
                  <button
                    onClick={() => setIsAddingAnnouncement(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Announcement</span>
                  </button>
                )}
              </div>

              {isAddingAnnouncement && (
                <form onSubmit={handleAddAnnouncement} className="mb-6 p-4 bg-surface rounded-2xl border border-border-subtle space-y-3">
                  <label className="block text-xs font-bold uppercase text-primary">
                    Announcement Banner Text
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="e.g. Live Artisan Handloom demonstration starting in 15 minutes! Join the main stream."
                    className="w-full bg-surface-container border border-border-subtle focus:border-accent rounded-xl p-3 text-xs font-semibold text-on-surface focus:outline-none transition-all shadow-inner"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container transition-all cursor-pointer"
                    >
                      Publish Announcement
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingAnnouncement(false)}
                      className="px-4 py-2 bg-surface-container border border-border-subtle text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-high transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {announcements.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-4 text-center">No announcements recorded yet.</p>
                ) : (
                  announcements.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-surface border border-border-subtle flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${item.active ? 'bg-live-indicator animate-pulse' : 'bg-on-surface-variant/30'}`} />
                        <p className="text-xs font-semibold text-primary">{item.text}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleAnnouncement(item.id, item.active)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            item.active ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {item.active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(item.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: KYC SNAPSHOT ARCHIVES                              */}
        {/* ========================================================= */}
        {activeTab === 'snapshots' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-surface-container rounded-3xl border border-border-subtle p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
                    <Camera className="w-5 h-5 text-accent" />
                    KYC Photo Snapshots Archive ({snapshots.length})
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Photos captured by administrator during private customer onboarding and video verification sessions
                  </p>
                </div>
                <button
                  onClick={fetchSnapshots}
                  className="p-2 rounded-xl bg-surface border border-border-subtle text-primary hover:bg-surface-container transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border-subtle rounded-2xl">
                  <Camera className="w-8 h-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-on-surface-variant">
                    No KYC photos taken yet. Enter a customer room as Admin and click the camera icon on any participant's video to capture photos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
                    >
                      <div 
                        onClick={() => setPreviewSnapshot(snap)}
                        className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                      >
                        <img 
                          src={snap.imageUrl} 
                          alt={snap.participantName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      <div className="p-3.5 flex-grow flex flex-col justify-between space-y-2">
                        <div>
                          <h4 className="text-xs font-bold text-primary truncate">{snap.participantName}</h4>
                          <p className="text-[10px] text-on-surface-variant truncate">{snap.roomTitle}</p>
                          <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                            {new Date(snap.timestamp).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
                          <a
                            href={snap.imageUrl}
                            download={`KYC-${snap.participantName}-${snap.timestamp}.jpg`}
                            className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </a>
                          <button
                            onClick={() => handleDeleteSnapshot(snap.id)}
                            className="p-1 text-on-surface-variant hover:text-error transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Snapshot Zoom Modal */}
            {previewSnapshot && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
                <div className="bg-surface-container max-w-xl w-full rounded-3xl border border-border-subtle overflow-hidden shadow-2xl">
                  <div className="p-4 px-6 border-b border-border-subtle flex items-center justify-between">
                    <div>
                      <h3 className="font-headline text-base font-bold text-primary">
                        {previewSnapshot.participantName}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        {previewSnapshot.roomTitle} • {new Date(previewSnapshot.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewSnapshot(null)}
                      className="p-1 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-border-subtle bg-black">
                      <img 
                        src={previewSnapshot.imageUrl} 
                        alt={previewSnapshot.participantName}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={previewSnapshot.imageUrl}
                        download={`KYC-${previewSnapshot.participantName}-${previewSnapshot.timestamp}.jpg`}
                        className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download High-Res Snapshot</span>
                      </a>
                      <button
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
        )}

      </div>
    </div>
  );
}
