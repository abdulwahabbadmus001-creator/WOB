import type {
  CoopPilotConfig,
  CoopRole,
  GameMode,
  ShipSkin,
  TacticalPingKind,
  WeaponType,
} from './types';

export interface CoopTelemetryPacket {
  type:
    | 'lobby_sync'
    | 'launch_campaign'
    | 'pilot_state'
    | 'tactical_ping'
    | 'trigger_link'
    | 'revive_tick';
  roomCode: string;
  senderRole: CoopRole;
  pilot?: CoopPilotConfig;
  mode?: GameMode;
  state?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    downed: boolean;
    firing: boolean;
    skin: ShipSkin;
    weapon: WeaponType;
    callsign: string;
  };
  ping?: {
    sender: string;
    kind: TacticalPingKind;
    text: string;
  };
  docked?: boolean;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `WOB-${suffix}`;
}

export class CoopSquadronSession {
  public roomCode: string = generateRoomCode();
  public role: CoopRole = 'ai_wingman';
  public connected = false;
  public localPilot: CoopPilotConfig = {
    callsign: 'TOMMY',
    skin: 'cyan',
    weapon: 'spread',
    ready: true,
  };
  public partnerPilot: CoopPilotConfig = {
    callsign: 'NOVA-2',
    skin: 'violet',
    weapon: 'homing',
    ready: true,
  };

  private bc: BroadcastChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private onPacketCallback: ((packet: CoopTelemetryPacket) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  public setCallbacks(
    onPacket: (packet: CoopTelemetryPacket) => void,
    onConnChange?: (connected: boolean) => void,
  ): void {
    this.onPacketCallback = onPacket;
    this.onConnectionChange = onConnChange ?? null;
  }

  public joinRoom(roomCode: string, role: CoopRole): void {
    this.cleanupChannels();
    this.roomCode = roomCode.trim().toUpperCase() || generateRoomCode();
    this.role = role;

    if (role === 'ai_wingman' || role === 'dual_local') {
      this.connected = true;
      this.partnerPilot = {
        callsign: role === 'dual_local' ? 'PILOT-2' : 'NOVA-2',
        skin: this.localPilot.skin === 'cyan' ? 'violet' : 'cyan',
        weapon: this.localPilot.weapon === 'spread' ? 'homing' : 'plasma',
        ready: true,
      };
      this.onConnectionChange?.(true);
      return;
    }

    // Set up local & same-origin BroadcastChannel room discovery
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel(`wob-coop-${this.roomCode}`);
        this.bc.onmessage = (ev: MessageEvent<CoopTelemetryPacket>) => {
          this.handleIncomingPacket(ev.data);
        };
        this.connected = true;
        this.onConnectionChange?.(true);
        this.broadcastLobbySync();
      } catch {
        // Fallback if BroadcastChannel is restricted
      }
    }
  }

  // Optional direct WebRTC Offer creation for cross-device P2P room pairing
  public async createWebRtcOfferToken(): Promise<string> {
    if (typeof RTCPeerConnection === 'undefined') {
      return '';
    }
    this.closeWebRtc();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc = pc;
    const dc = pc.createDataChannel('wob-squadron', { ordered: false, maxRetransmits: 0 });
    this.bindDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);

    return btoa(JSON.stringify(pc.localDescription));
  }

  public async acceptWebRtcOfferAndCreateAnswer(offerToken: string): Promise<string> {
    if (typeof RTCPeerConnection === 'undefined') {
      return '';
    }
    this.closeWebRtc();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc = pc;
    pc.ondatachannel = (event) => {
      this.bindDataChannel(event.channel);
    };

    const desc = JSON.parse(atob(offerToken.trim())) as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.waitForIceGathering(pc);

    return btoa(JSON.stringify(pc.localDescription));
  }

  public async finalizeWebRtcAnswer(answerToken: string): Promise<boolean> {
    if (!this.pc) return false;
    try {
      const desc = JSON.parse(atob(answerToken.trim())) as RTCSessionDescriptionInit;
      await this.pc.setRemoteDescription(desc);
      return true;
    } catch {
      return false;
    }
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1400);
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  private bindDataChannel(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.onopen = () => {
      this.connected = true;
      this.onConnectionChange?.(true);
      this.broadcastLobbySync();
    };
    dc.onclose = () => {
      if (!this.bc) {
        this.connected = false;
        this.onConnectionChange?.(false);
      }
    };
    dc.onmessage = (ev) => {
      try {
        const packet = JSON.parse(String(ev.data)) as CoopTelemetryPacket;
        this.handleIncomingPacket(packet);
      } catch {
        // Ignore malformed packets
      }
    };
  }

  private handleIncomingPacket(packet: CoopTelemetryPacket): void {
    if (!packet || packet.roomCode !== this.roomCode) return;
    if (packet.type === 'lobby_sync' && packet.pilot) {
      this.partnerPilot = packet.pilot;
      this.connected = true;
      this.onConnectionChange?.(true);
    }
    this.onPacketCallback?.(packet);
  }

  public broadcastLobbySync(): void {
    this.sendPacket({
      type: 'lobby_sync',
      roomCode: this.roomCode,
      senderRole: this.role,
      pilot: this.localPilot,
    });
  }

  public sendPacket(packet: CoopTelemetryPacket): void {
    if (this.dc && this.dc.readyState === 'open') {
      try {
        this.dc.send(JSON.stringify(packet));
      } catch {
        // Ignore data channel send errors
      }
    }
    if (this.bc) {
      try {
        this.bc.postMessage(packet);
      } catch {
        // Ignore broadcast channel errors
      }
    }
  }

  private closeWebRtc(): void {
    try {
      this.dc?.close();
    } catch {
      // Ignore
    }
    try {
      this.pc?.close();
    } catch {
      // Ignore
    }
    this.dc = null;
    this.pc = null;
  }

  public cleanupChannels(): void {
    this.closeWebRtc();
    if (this.bc) {
      try {
        this.bc.close();
      } catch {
        // Ignore
      }
      this.bc = null;
    }
    this.connected = false;
  }
}

export const coopSession = new CoopSquadronSession();
