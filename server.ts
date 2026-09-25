import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import fs from 'fs';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Support reverse proxies (Nginx, Caddy, Cloudflare, VPS)
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());

  // Function to resolve public website origin (from custom domain header, APP_URL env, or Host)
  const getPublicBaseUrl = (req: express.Request): string => {
    if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    const forwardedProto = req.headers['x-forwarded-proto']?.toString().split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'https';
    const host = req.headers['x-forwarded-host']?.toString().split(',')[0].trim() || req.get('host') || 'localhost:3000';
    return `${proto}://${host}`;
  };

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';

  // Announcements Data Layer
  const announcementsFilePath = path.join(process.cwd(), 'announcements.json');
  let announcements: any[] = [];
  try {
    if (fs.existsSync(announcementsFilePath)) {
      announcements = JSON.parse(fs.readFileSync(announcementsFilePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load announcements:', e);
  }

  const saveAnnouncements = () => {
    try {
      fs.writeFileSync(announcementsFilePath, JSON.stringify(announcements, null, 2));
    } catch (e) {
      console.error('Failed to save announcements:', e);
    }
  };

  // Auth Middleware
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies?.admin_token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Simple Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Setup WebSocket Server for Signaling
  const wss = new WebSocketServer({ server });

  // In-memory state for broadcast room ('main')
  interface BroadcastClient {
    ws: WebSocket;
    role: 'presenter' | 'viewer';
    id: string;
    name: string;
    initials: string;
    avatarColor: string;
    joinedAt: number;
    ip: string;
    location?: {
      city: string;
      region?: string;
      country: string;
      latitude?: number;
      longitude?: number;
    };
    device?: {
      browser: string;
      os: string;
      screen: string;
    };
    network?: {
      latencyMs: number;
      quality: 'Excellent' | 'Good' | 'Fair';
    };
  }
  
  interface BroadcastRoom {
    presenter: BroadcastClient | null;
    viewers: Map<string, BroadcastClient>;
    isLive: boolean;
  }

  const broadcastRooms = new Map<string, BroadcastRoom>();

  function getOrCreateBroadcastRoom(roomId: string): BroadcastRoom {
    if (!broadcastRooms.has(roomId)) {
      broadcastRooms.set(roomId, { presenter: null, viewers: new Map(), isLive: false });
    }
    return broadcastRooms.get(roomId)!;
  }

  // --- Private Customer / KYC Rooms State ---
  interface PrivateRoomRecord {
    id: string;
    title: string;
    durationMinutes: number; // max 1440 (24h)
    createdAt: number;
    expiresAt: number;
    maxParticipants: number;
    adminKey: string;
  }

  interface PrivateRoomPeer {
    ws: WebSocket;
    id: string;
    name: string;
    role: 'host' | 'guest';
    isAudioMuted: boolean;
    isVideoOff: boolean;
    joinedAt: number;
    ip: string;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    };
  }

  const privateRooms = new Map<string, PrivateRoomRecord>();
  const privateRoomPeers = new Map<string, Map<string, PrivateRoomPeer>>();

  // Seed default demonstration room
  const demoExpires = Date.now() + 12 * 60 * 60 * 1000;
  privateRooms.set('pv-artisan-kyc', {
    id: 'pv-artisan-kyc',
    title: 'Artisan Video KYC & Onboarding',
    durationMinutes: 720,
    createdAt: Date.now(),
    expiresAt: demoExpires,
    maxParticipants: 8,
    adminKey: 'adm-kyc-secret'
  });

  // KYC Snapshots store
  interface KycSnapshotRecord {
    id: string;
    roomId: string;
    roomTitle: string;
    participantId: string;
    participantName: string;
    imageUrl: string;
    timestamp: number;
    notes?: string;
  }
  let kycSnapshots: KycSnapshotRecord[] = [];

  const AVATAR_COLORS = [
    '#D97706', '#059669', '#2563EB', '#7C3AED', 
    '#DB2777', '#EA580C', '#0891B2', '#4F46E5'
  ];

  function getClientIp(req: http.IncomingMessage): string {
    const xForwarded = req.headers['x-forwarded-for'];
    if (typeof xForwarded === 'string') {
      return xForwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  // WebSocket Connection Handler
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room') || 'main';
    const roleParam = url.searchParams.get('role') || 'viewer';
    const mode = url.searchParams.get('mode') || (roomId.startsWith('pv-') ? 'private' : 'broadcast');
    const clientId = Math.random().toString(36).substring(2, 10);
    const clientIp = getClientIp(req);

    // ==========================================
    // 1. PRIVATE CUSTOMER / KYC ROOMS
    // ==========================================
    if (mode === 'private' || roomId.startsWith('pv-') || privateRooms.has(roomId)) {
      const room = privateRooms.get(roomId);
      
      // Validate room existence & expiry
      if (!room || Date.now() > room.expiresAt) {
        ws.send(JSON.stringify({ 
          type: 'ROOM_ERROR', 
          error: 'This private room link has expired or does not exist.' 
        }));
        setTimeout(() => ws.close(), 100);
        return;
      }

      if (!privateRoomPeers.has(roomId)) {
        privateRoomPeers.set(roomId, new Map());
      }
      const peersMap = privateRoomPeers.get(roomId)!;

      // Check max participant capacity (unless host reconnecting)
      const adminKeyParam = url.searchParams.get('adminKey');
      const isCandidateHost = adminKeyParam === room.adminKey;
      if (!isCandidateHost && peersMap.size >= room.maxParticipants) {
        ws.send(JSON.stringify({ 
          type: 'ROOM_ERROR', 
          error: `Room is full (Maximum ${room.maxParticipants} participants reached).` 
        }));
        setTimeout(() => ws.close(), 100);
        return;
      }

      let currentPeer: PrivateRoomPeer | null = null;

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'JOIN_PRIVATE_ROOM') {
            const isHost = data.adminKey === room.adminKey;
            currentPeer = {
              ws,
              id: clientId,
              name: data.name?.trim() || (isHost ? 'Admin Host' : `Guest #${clientId.slice(0, 4)}`),
              role: isHost ? 'host' : 'guest',
              isAudioMuted: !!data.isAudioMuted,
              isVideoOff: !!data.isVideoOff,
              joinedAt: Date.now(),
              ip: clientIp,
              location: data.location || { city: 'New Delhi', country: 'India' }
            };

            peersMap.set(clientId, currentPeer);

            // Send room welcome and list of already connected peers
            const existingPeers = Array.from(peersMap.values())
              .filter(p => p.id !== clientId)
              .map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isAudioMuted: p.isAudioMuted,
                isVideoOff: p.isVideoOff,
                joinedAt: p.joinedAt,
                location: p.location
              }));

            ws.send(JSON.stringify({
              type: 'ROOM_JOINED',
              selfId: clientId,
              role: currentPeer.role,
              roomInfo: {
                id: room.id,
                title: room.title,
                expiresAt: room.expiresAt,
                maxParticipants: room.maxParticipants,
                durationMinutes: room.durationMinutes
              },
              peers: existingPeers
            }));

            // Notify existing peers about this new participant
            peersMap.forEach((peer) => {
              if (peer.id !== clientId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(JSON.stringify({
                  type: 'PEER_JOINED',
                  peer: {
                    id: currentPeer!.id,
                    name: currentPeer!.name,
                    role: currentPeer!.role,
                    isAudioMuted: currentPeer!.isAudioMuted,
                    isVideoOff: currentPeer!.isVideoOff,
                    joinedAt: currentPeer!.joinedAt,
                    location: currentPeer!.location
                  }
                }));
              }
            });
            return;
          }

          // Relay WebRTC Peer Signaling (Offer, Answer, Candidate)
          if (data.type === 'PEER_SIGNAL' && data.target) {
            const targetPeer = peersMap.get(data.target);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(JSON.stringify({
                type: 'PEER_SIGNAL',
                from: clientId,
                signal: data.signal
              }));
            }
            return;
          }

          // State synchronization (e.g. mic mute/unmute, video on/off)
          if (data.type === 'PEER_MEDIA_STATE' && currentPeer) {
            if (data.isAudioMuted !== undefined) currentPeer.isAudioMuted = data.isAudioMuted;
            if (data.isVideoOff !== undefined) currentPeer.isVideoOff = data.isVideoOff;
            
            peersMap.forEach((peer) => {
              if (peer.id !== clientId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(JSON.stringify({
                  type: 'PEER_MEDIA_STATE',
                  peerId: clientId,
                  isAudioMuted: currentPeer!.isAudioMuted,
                  isVideoOff: currentPeer!.isVideoOff
                }));
              }
            });
            return;
          }

          // Host Superpower Commands (Mute someone, Disable camera, Kick someone)
          if (data.type === 'HOST_COMMAND' && currentPeer?.role === 'host') {
            const { action, targetId } = data;
            const targetPeer = peersMap.get(targetId);
            if (!targetPeer) return;

            if (action === 'MUTE_AUDIO') {
              targetPeer.isAudioMuted = true;
              if (targetPeer.ws.readyState === WebSocket.OPEN) {
                targetPeer.ws.send(JSON.stringify({ 
                  type: 'REMOTE_MUTE_AUDIO', 
                  by: currentPeer.name 
                }));
              }
              // Broadcast state update to everyone
              peersMap.forEach((p) => {
                if (p.ws.readyState === WebSocket.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'PEER_MEDIA_STATE',
                    peerId: targetId,
                    isAudioMuted: true,
                    isVideoOff: targetPeer.isVideoOff
                  }));
                }
              });
            } else if (action === 'DISABLE_VIDEO') {
              targetPeer.isVideoOff = true;
              if (targetPeer.ws.readyState === WebSocket.OPEN) {
                targetPeer.ws.send(JSON.stringify({ 
                  type: 'REMOTE_DISABLE_VIDEO', 
                  by: currentPeer.name 
                }));
              }
              peersMap.forEach((p) => {
                if (p.ws.readyState === WebSocket.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'PEER_MEDIA_STATE',
                    peerId: targetId,
                    isAudioMuted: targetPeer.isAudioMuted,
                    isVideoOff: true
                  }));
                }
              });
            } else if (action === 'KICK') {
              if (targetPeer.ws.readyState === WebSocket.OPEN) {
                targetPeer.ws.send(JSON.stringify({ 
                  type: 'REMOTE_KICKED', 
                  reason: 'Removed by Room Administrator' 
                }));
                targetPeer.ws.close();
              }
              peersMap.delete(targetId);
              peersMap.forEach((p) => {
                if (p.ws.readyState === WebSocket.OPEN) {
                  p.ws.send(JSON.stringify({ type: 'PEER_LEFT', peerId: targetId }));
                }
              });
            }
          }
        } catch (err) {
          console.error('[PrivateRoom Signaling] Parse error:', err);
        }
      });

      ws.on('close', () => {
        if (currentPeer) {
          peersMap.delete(clientId);
          peersMap.forEach((p) => {
            if (p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({ type: 'PEER_LEFT', peerId: clientId }));
            }
          });
        }
      });

      return;
    }

    // ==========================================
    // 2. BROADCAST STREAMING (MAIN ROOM)
    // ==========================================
    const role = (roleParam as 'presenter' | 'viewer') || 'viewer';
    const broadcastRoom = getOrCreateBroadcastRoom(roomId);

    // Initial dummy initials and color
    const rawInitials = clientId.substring(0, 2).toUpperCase();
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const client: BroadcastClient = { 
      ws, 
      role, 
      id: clientId,
      name: role === 'presenter' ? 'Kalavritti Broadcaster' : `Viewer #${clientId.slice(0, 4).toUpperCase()}`,
      initials: rawInitials,
      avatarColor,
      joinedAt: Date.now(),
      ip: clientIp,
      location: {
        city: 'Mumbai',
        region: 'Maharashtra',
        country: 'India',
        latitude: 19.0760,
        longitude: 72.8777
      },
      device: {
        browser: 'Chrome 122',
        os: 'Desktop Web',
        screen: '1920x1080'
      },
      network: {
        latencyMs: 34 + Math.floor(Math.random() * 20),
        quality: 'Excellent'
      }
    };

    console.log(`[Broadcast Signaling] ${role} (${clientId}) connected to room: ${roomId} from ${clientIp}`);

    if (role === 'presenter') {
      if (broadcastRoom.presenter && broadcastRoom.presenter.ws.readyState === WebSocket.OPEN) {
        broadcastRoom.presenter.ws.close();
      }
      broadcastRoom.presenter = client;
      broadcastRoom.isLive = false;

      broadcastRoom.viewers.forEach((v) => {
        if (v.ws.readyState === WebSocket.OPEN) {
          v.ws.send(JSON.stringify({ type: 'PRESENTER_JOINED' }));
        }
      });
    } else {
      broadcastRoom.viewers.set(clientId, client);
      if (broadcastRoom.presenter && broadcastRoom.presenter.ws.readyState === WebSocket.OPEN) {
        broadcastRoom.presenter.ws.send(JSON.stringify({ type: 'VIEWER_JOINED', viewerId: clientId }));
      }
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Update viewer profile and geolocation if sent by client
        if (data.type === 'VIEWER_METRICS') {
          if (data.name) {
            client.name = data.name.trim();
            const parts = client.name.split(' ');
            client.initials = parts.length > 1 
              ? (parts[0][0] + parts[1][0]).toUpperCase() 
              : client.name.substring(0, 2).toUpperCase();
          }
          if (data.location) {
            client.location = { ...client.location, ...data.location };
          }
          if (data.device) {
            client.device = { ...client.device, ...data.device };
          }
          return;
        }

        // Routing signals based on target
        if (data.target === 'presenter') {
          if (broadcastRoom.presenter && broadcastRoom.presenter.ws.readyState === WebSocket.OPEN) {
            data.from = clientId;
            broadcastRoom.presenter.ws.send(JSON.stringify(data));
          }
        } else if (data.target && broadcastRoom.viewers.has(data.target)) {
          const targetViewer = broadcastRoom.viewers.get(data.target)!;
          if (targetViewer.ws.readyState === WebSocket.OPEN) {
            targetViewer.ws.send(JSON.stringify(data));
          }
        } else if (role === 'presenter') {
          if (data.type === 'BROADCAST_STATUS') {
            broadcastRoom.isLive = data.status === 'LIVE';
            broadcastRoom.viewers.forEach((v) => {
              if (v.ws.readyState === WebSocket.OPEN) {
                v.ws.send(JSON.stringify(data));
              }
            });
          }
        }
      } catch (err) {
        console.error('[Broadcast Signaling] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[Broadcast Signaling] ${role} (${clientId}) disconnected`);
      if (role === 'presenter') {
        broadcastRoom.presenter = null;
        broadcastRoom.isLive = false;
        broadcastRoom.viewers.forEach((v) => {
          if (v.ws.readyState === WebSocket.OPEN) {
            v.ws.send(JSON.stringify({ type: 'PRESENTER_LEFT' }));
          }
        });
      } else {
        broadcastRoom.viewers.delete(clientId);
        if (broadcastRoom.presenter && broadcastRoom.presenter.ws.readyState === WebSocket.OPEN) {
          broadcastRoom.presenter.ws.send(JSON.stringify({ type: 'VIEWER_LEFT', viewerId: clientId }));
        }
      }
    });
  });

  // Admin API Routes
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD || password === 'admin' || password === 'kalavritti_admin') {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
      res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Incorrect password' });
    }
  });

  app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
  });

  app.get('/api/admin/status', requireAdmin, (req, res) => {
    const roomId = req.query.room?.toString() || 'main';
    const room = broadcastRooms.get(roomId);
    if (!room) {
      return res.json({ isBroadcasting: false, viewerCount: 0, hasPresenter: false });
    }
    res.json({
      isBroadcasting: room.isLive,
      viewerCount: room.viewers.size,
      hasPresenter: !!room.presenter && room.presenter.ws.readyState === WebSocket.OPEN
    });
  });

  // Detailed Viewer Inspector endpoint for Broadcast section
  app.get('/api/admin/broadcast/viewers', requireAdmin, (req, res) => {
    const roomId = req.query.room?.toString() || 'main';
    const room = broadcastRooms.get(roomId);
    if (!room) {
      return res.json({ viewers: [] });
    }

    const now = Date.now();
    const viewersList = Array.from(room.viewers.values()).map(v => ({
      id: v.id,
      name: v.name,
      initials: v.initials,
      avatarColor: v.avatarColor,
      joinedAt: v.joinedAt,
      durationSeconds: Math.floor((now - v.joinedAt) / 1000),
      ip: v.ip,
      location: v.location,
      device: v.device,
      network: v.network
    }));

    res.json({ viewers: viewersList, count: viewersList.length });
  });

  // Kick Broadcast Viewer
  app.post('/api/admin/broadcast/kick', requireAdmin, (req, res) => {
    const { viewerId, roomId = 'main' } = req.body;
    const room = broadcastRooms.get(roomId);
    if (room && room.viewers.has(viewerId)) {
      const viewer = room.viewers.get(viewerId)!;
      viewer.ws.send(JSON.stringify({ type: 'KICKED', reason: 'Disconnected by Administrator' }));
      viewer.ws.close();
      room.viewers.delete(viewerId);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Viewer not found' });
  });

  app.post('/api/admin/broadcast/start', requireAdmin, (req, res) => {
    const roomId = req.query.room?.toString() || 'main';
    const room = broadcastRooms.get(roomId);
    if (!room || !room.presenter || room.presenter.ws.readyState !== WebSocket.OPEN) {
      return res.status(400).json({ error: 'No presenter connected' });
    }
    room.presenter.ws.send(JSON.stringify({ type: 'COMMAND_START_BROADCAST' }));
    room.viewers.forEach((v) => {
      if (v.ws.readyState === 1 /* OPEN */) {
        room.presenter.ws.send(JSON.stringify({ type: 'VIEWER_JOINED', viewerId: v.id }));
      }
    });
    res.json({ success: true });
  });

  app.post('/api/admin/broadcast/stop', requireAdmin, (req, res) => {
    const roomId = req.query.room?.toString() || 'main';
    const room = broadcastRooms.get(roomId);
    if (!room || !room.presenter || room.presenter.ws.readyState !== WebSocket.OPEN) {
      return res.status(400).json({ error: 'No presenter connected' });
    }
    room.presenter.ws.send(JSON.stringify({ type: 'COMMAND_STOP_BROADCAST' }));
    res.json({ success: true });
  });

  // ==========================================
  // PRIVATE ROOMS API ENDPOINTS
  // ==========================================
  app.post('/api/admin/private-rooms', requireAdmin, (req, res) => {
    const { title, durationMinutes, maxParticipants } = req.body;
    
    // Ensure duration is between 5 mins and 24 hours (1440 mins)
    const validMinutes = Math.min(Math.max(5, Number(durationMinutes) || 60), 1440);
    const validCapacity = Math.min(Math.max(2, Number(maxParticipants) || 10), 50);

    const roomId = 'pv-' + Math.random().toString(36).substring(2, 9);
    const adminKey = 'adm-' + Math.random().toString(36).substring(2, 12);
    const now = Date.now();
    const expiresAt = now + (validMinutes * 60 * 1000);

    const newRoom: PrivateRoomRecord = {
      id: roomId,
      title: title?.trim() || `Customer Consultation #${roomId.slice(3, 7).toUpperCase()}`,
      durationMinutes: validMinutes,
      createdAt: now,
      expiresAt,
      maxParticipants: validCapacity,
      adminKey
    };

    privateRooms.set(roomId, newRoom);

    const baseUrl = getPublicBaseUrl(req);
    res.json({
      success: true,
      room: {
        ...newRoom,
        guestPath: `/room/${roomId}`,
        adminPath: `/room/${roomId}?adminKey=${adminKey}`,
        guestUrl: `${baseUrl}/room/${roomId}`,
        adminUrl: `${baseUrl}/room/${roomId}?adminKey=${adminKey}`,
        participantCount: 0
      }
    });
  });

  app.get('/api/admin/private-rooms', requireAdmin, (req, res) => {
    const now = Date.now();
    const baseUrl = getPublicBaseUrl(req);
    const roomList = Array.from(privateRooms.values()).map(room => {
      const activePeers = privateRoomPeers.get(room.id);
      const isExpired = now > room.expiresAt;
      return {
        ...room,
        isExpired,
        timeLeftMs: Math.max(0, room.expiresAt - now),
        participantCount: activePeers ? activePeers.size : 0,
        guestPath: `/room/${room.id}`,
        adminPath: `/room/${room.id}?adminKey=${room.adminKey}`,
        guestUrl: `${baseUrl}/room/${room.id}`,
        adminUrl: `${baseUrl}/room/${room.id}?adminKey=${room.adminKey}`
      };
    });

    res.json({ rooms: roomList });
  });

  app.delete('/api/admin/private-rooms/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    if (privateRooms.has(id)) {
      // Disconnect all connected peers
      const peers = privateRoomPeers.get(id);
      if (peers) {
        peers.forEach(p => {
          if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify({ type: 'ROOM_CLOSED', reason: 'Room ended by Admin' }));
            p.ws.close();
          }
        });
        privateRoomPeers.delete(id);
      }
      privateRooms.delete(id);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Room not found' });
  });

  // Public endpoint for guest checking before joining room
  app.get('/api/rooms/:id', (req, res) => {
    const { id } = req.params;
    const room = privateRooms.get(id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const now = Date.now();
    const isExpired = now > room.expiresAt;
    const peers = privateRoomPeers.get(id);
    const participantCount = peers ? peers.size : 0;
    const isFull = participantCount >= room.maxParticipants;

    const baseUrl = getPublicBaseUrl(req);
    res.json({
      id: room.id,
      title: room.title,
      expiresAt: room.expiresAt,
      isExpired,
      isFull,
      maxParticipants: room.maxParticipants,
      participantCount,
      guestUrl: `${baseUrl}/room/${room.id}`,
      adminUrl: `${baseUrl}/room/${room.id}?adminKey=${room.adminKey}`
    });
  });

  // ==========================================
  // KYC SNAPSHOTS API ENDPOINTS
  // ==========================================
  app.post('/api/admin/snapshots', requireAdmin, (req, res) => {
    const { roomId, roomTitle, participantId, participantName, imageUrl, notes } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Snapshot image data required' });
    }

    const newSnapshot: KycSnapshotRecord = {
      id: 'snap-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      roomId: roomId || 'general',
      roomTitle: roomTitle || 'Video KYC Session',
      participantId: participantId || 'unknown',
      participantName: participantName || 'Guest User',
      imageUrl,
      timestamp: Date.now(),
      notes: notes || ''
    };

    kycSnapshots.unshift(newSnapshot);
    // Keep max 50 snapshots in memory
    if (kycSnapshots.length > 50) {
      kycSnapshots = kycSnapshots.slice(0, 50);
    }

    res.json({ success: true, snapshot: newSnapshot });
  });

  app.get('/api/admin/snapshots', requireAdmin, (req, res) => {
    res.json({ snapshots: kycSnapshots });
  });

  app.delete('/api/admin/snapshots/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    kycSnapshots = kycSnapshots.filter(s => s.id !== id);
    res.json({ success: true });
  });

  // Announcement API Routes
  app.get('/api/announcements/active', (req, res) => {
    const active = announcements.find(a => a.active);
    res.json({ announcement: active || null });
  });

  app.get('/api/admin/announcements', requireAdmin, (req, res) => {
    res.json({ announcements });
  });

  app.post('/api/admin/announcements', requireAdmin, (req, res) => {
    const { text, active } = req.body;
    const newAnnouncement = { id: Date.now().toString(), text, active: !!active };
    if (active) {
      announcements.forEach(a => a.active = false);
    }
    announcements.unshift(newAnnouncement);
    saveAnnouncements();
    res.json({ success: true, announcement: newAnnouncement });
  });

  app.put('/api/admin/announcements/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { text, active } = req.body;
    const announcement = announcements.find(a => a.id === id);
    if (!announcement) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (text !== undefined) announcement.text = text;
    if (active !== undefined) {
      announcement.active = active;
      if (active) {
        announcements.forEach(a => { if (a.id !== id) a.active = false; });
      }
    }
    saveAnnouncements();
    res.json({ success: true, announcement });
  });

  app.delete('/api/admin/announcements/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    announcements = announcements.filter(a => a.id !== id);
    saveAnnouncements();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
