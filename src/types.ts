export interface PrivateRoomInfo {
  id: string;
  title: string;
  durationMinutes: number;
  createdAt: number;
  expiresAt: number;
  maxParticipants: number;
  adminKey: string;
  participantCount?: number;
  isExpired?: boolean;
  guestPath?: string;
  adminPath?: string;
  guestUrl?: string;
  adminUrl?: string;
}

export interface RoomParticipant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  isAudioMuted: boolean;
  isVideoOff: boolean;
  joinedAt: number;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  ip?: string;
}

export interface KycSnapshot {
  id: string;
  roomId: string;
  roomTitle: string;
  participantId: string;
  participantName: string;
  imageUrl: string;
  timestamp: number;
  notes?: string;
}

export interface BroadcastViewer {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  joinedAt: number;
  durationSeconds: number;
  ip: string;
  location?: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
    region?: string;
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
