import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Maximize, Wifi, WifiOff, Tv, MonitorOff, Minimize, Radio } from 'lucide-react';
import { LotusLogo } from '../components/LotusLogo';
import { useLocation } from 'react-router-dom';

export default function User() {
  const [isMuted, setIsMuted] = useState(true);
  const [status, setStatus] = useState<'WAITING' | 'CONNECTING' | 'LIVE' | 'ENDED' | 'ERROR'>('WAITING');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomId = params.get('room') || 'main';
    
    setStatus('CONNECTING');

    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?room=${roomId}&role=viewer`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('WAITING');
        reconnectAttempts = 0;

        // Collect browser environment
        const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                        navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                        navigator.userAgent.includes('Safari') ? 'Safari' : 'Web Browser';

        // Request client geolocation if user allows
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'VIEWER_METRICS',
                  location: {
                    city: 'Bengaluru',
                    region: 'Karnataka',
                    country: 'India',
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                  },
                  device: {
                    browser,
                    os: navigator.platform || 'Desktop',
                    screen: `${window.screen.width}x${window.screen.height}`
                  }
                }));
              }
            },
            () => {
              // Permission not granted - send device only without coordinates
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'VIEWER_METRICS',
                  device: {
                    browser,
                    os: navigator.platform || 'Desktop',
                    screen: `${window.screen.width}x${window.screen.height}`
                  }
                }));
              }
            },
            { timeout: 5000 }
          );
        }
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'OFFER' && msg.from) {
          setStatus('LIVE');
          handleOffer(msg.sdp, msg.from);
        } else if (msg.type === 'ICE_CANDIDATE') {
          if (pcRef.current && msg.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        } else if (msg.type === 'KICKED') {
          setStatus('ENDED');
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          alert(msg.reason || 'You have been disconnected from the broadcast.');
        } else if (msg.type === 'PRESENTER_LEFT' || (msg.type === 'BROADCAST_STATUS' && msg.status === 'ENDED')) {
          setStatus('ENDED');
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        } else if (msg.type === 'PRESENTER_JOINED') {
           setStatus('WAITING');
        }
      };

      ws.onclose = () => {
        if (status !== 'ENDED') {
          setStatus('ERROR');
          if (pcRef.current) pcRef.current.close();
          
          if (reconnectAttempts < maxReconnectAttempts) {
            const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            reconnectAttempts++;
            reconnectTimeout = setTimeout(connectWebSocket, timeout);
          }
        }
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [location]);

  const handleOffer = async (sdp: RTCSessionDescriptionInit, presenterId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ]
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ICE_CANDIDATE',
          target: 'presenter',
          candidate: event.candidate
        }));
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ANSWER',
        target: 'presenter',
        sdp: pc.localDescription
      }));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const params = new URLSearchParams(location.search);
  const roomId = params.get('room') || 'main';

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col font-body bg-background text-on-surface relative overflow-hidden">
      
      {/* MAIN CONTENT AREA */}
      <main className="flex-grow flex flex-col justify-center items-center w-full h-full p-4 md:p-8">
        
        <div ref={containerRef} className="w-full h-full max-w-[1600px] mx-auto relative flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl border border-border-subtle group">
          
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className={`w-full h-full object-contain bg-black transition-opacity duration-700 ${status === 'LIVE' ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* OVERLAY STATES */}
          {status !== 'LIVE' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface text-center p-8 z-20">
              
              <div className="absolute inset-0 pointer-events-none opacity-20">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-accent/20 rounded-full blur-[100px]"></div>
              </div>

              {status === 'WAITING' && (
                <div className="relative max-w-lg mx-auto space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center border border-border-subtle shadow-lg">
                    <LotusLogo className="w-10 h-10 text-accent animate-pulse" />
                  </div>
                  <h2 className="font-headline text-3xl md:text-4xl text-primary font-semibold tracking-tight">Waiting for broadcast</h2>
                  <p className="text-on-surface-variant text-lg">The presenter hasn't gone live yet.</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full border border-border-subtle">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                    <span className="text-xs font-medium text-primary uppercase tracking-wider">Room: {roomId}</span>
                  </div>
                </div>
              )}

              {status === 'CONNECTING' && (
                <div className="relative max-w-lg mx-auto space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center border border-border-subtle shadow-lg">
                    <Wifi className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <h2 className="font-headline text-3xl text-primary font-semibold tracking-tight">Connecting...</h2>
                  <p className="text-on-surface-variant">Establishing secure connection</p>
                </div>
              )}

              {status === 'ENDED' && (
                <div className="relative max-w-lg mx-auto space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center border border-border-subtle shadow-lg">
                    <MonitorOff className="w-8 h-8 text-on-surface-variant" />
                  </div>
                  <h2 className="font-headline text-3xl text-primary font-semibold tracking-tight">Broadcast ended</h2>
                  <p className="text-on-surface-variant text-lg">The live session has concluded.</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full border border-border-subtle mt-4">
                     <span className="text-xs font-medium text-primary uppercase tracking-wider">Room: {roomId}</span>
                  </div>
                </div>
              )}

              {status === 'ERROR' && (
                <div className="relative max-w-lg mx-auto space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-error/10 flex items-center justify-center border border-error/20 shadow-lg">
                    <WifiOff className="w-8 h-8 text-error" />
                  </div>
                  <h2 className="font-headline text-3xl text-error font-semibold tracking-tight">Connection lost</h2>
                  <p className="text-on-surface-variant text-lg">Attempting to reconnect...</p>
                  <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2.5 bg-surface-container hover:bg-surface-container-high border border-border-subtle rounded-lg text-sm font-medium transition-colors text-primary shadow-sm">
                    Reload Page
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TOP INFO BAR (LIVE) */}
          {status === 'LIVE' && (
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                   <div className="w-2 h-2 rounded-full bg-live-indicator animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                   <span className="text-xs font-bold tracking-widest text-white uppercase">Live</span>
                 </div>
                 <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                   <span className="text-xs font-medium text-white/80 uppercase tracking-widest">Room: {roomId}</span>
                 </div>
              </div>
            </div>
          )}

          {/* FLOATING CONTROLS (Only visible when LIVE or CONNECTED) */}
          {status === 'LIVE' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                <button 
                  onClick={toggleAudio}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white outline-none"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  <span className="text-sm font-medium hidden sm:inline">
                    {isMuted ? 'Muted' : 'Audio'}
                  </span>
                </button>
                
                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>

                <button 
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white outline-none"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
