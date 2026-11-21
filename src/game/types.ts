export type GameState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'episode_clear'
  | 'chapter_victory'
  | 'gameover';

export type GameMode = 'campaign' | 'survival' | 'daily';
export type WeaponType = 'spread' | 'laser' | 'homing' | 'plasma';
export type ShipSkin = 'cyan' | 'violet' | 'gold';

export type TouchControlMode = 'dual_stick' | 'direct_touch';
export type AltitudeKeyMode = 'space_shift' | 'q_e' | 'r_f';

export interface FlightControlSettings {
  touchMode: TouchControlMode;
  altitudeKeys: AltitudeKeyMode;
  autoFire: boolean;
  inertialDampening: boolean;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  speedMultiplier: number;
  healthMultiplier: number;
  enemyHealthMultiplier: number;
  empDisabled: boolean;
}

export type BossArchetype = 'sentinel' | 'helix' | 'architect' | 'leviathan';

export type UpgradeId = 'speed' | 'multishot' | 'shield' | 'magnet';

export type PollyStatus = 'ready' | 'assisting' | 'cooldown';

export interface UpgradeLevels {
  speed: number;
  multishot: number;
  shield: number;
  magnet: number;
}

export interface UpgradeConfig {
  id: UpgradeId;
  name: string;
  role: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  accentColor: string;
  hotkey: string;
}

// 3D Hangar Permanent Modular Upgrades (between runs)
export type HangarUpgradeId = 'thruster' | 'hull' | 'overclock' | 'regen';

export interface HangarUpgradeLevels {
  thruster: number;
  hull: number;
  overclock: number;
  regen: number;
}

export interface HangarUpgradeConfig {
  id: HangarUpgradeId;
  name: string;
  partName: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  accentColor: string;
}

// Mid-Run Rogue-Lite Tactical Draft Perks
export type RogueDraftId =
  | 'chain_lightning'
  | 'vampiric_shield'
  | 'twin_polly'
  | 'overcharged_emp'
  | 'hyper_graze'
  | 'tether_overdrive';

export interface RogueDraftOption {
  id: RogueDraftId;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
}

export type RoguePerkStacks = Record<RogueDraftId, number>;

// Capital Starship Destructible Subsystems
export type BossSubsystemKind =
  | 'shield_gen'
  | 'laser_battery'
  | 'missile_pod'
  | 'central_core';

export interface BossSubsystem {
  id: string;
  kind: BossSubsystemKind;
  name: string;
  offsetAngle: number;
  offsetRadiusRatio: number;
  offsetZ: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  hitFlash: number;
  worldX: number;
  worldY: number;
  worldZ: number;
}

// Co-op Squadron & Teammate System
export type CoopRole = 'solo' | 'host' | 'guest' | 'ai_wingman' | 'dual_local';
export type TacticalPingKind = 'focus_core' | 'link_up' | 'need_shield';

export interface CoopPilotConfig {
  callsign: string;
  skin: ShipSkin;
  weapon: WeaponType;
  ready: boolean;
}

export interface TeammateHudState {
  active: boolean;
  callsign: string;
  skin: ShipSkin;
  weapon: WeaponType;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  downed: boolean;
  reviveProgress: number;
  x: number;
  y: number;
  z: number;
  isAi: boolean;
}

export interface RadarBlip {
  id: number;
  x: number; // normalized -1..1 (Left/Right)
  y: number; // normalized -1..1 (Front/Back)
  z: number; // normalized -1..1 (Down/Up altitude difference)
  kind: EnemyKind | 'teammate' | 'subsystem';
  isBoss?: boolean;
  label?: string;
}

export interface PlayerStats {
  moveSpeed: number;
  fireInterval: number;
  shotCount: number;
  maxHp: number;
  maxShield: number;
  shieldRegenDelay: number;
  magnetRadius: number;
  magnetPullSpeed: number;
  dashCooldown: number;
  damageMultiplier?: number;
  cooldownHaste?: number;
}

export type EnemyKind = 'block' | 'firewall' | 'interceptor' | 'boss';

export interface HudSnapshot {
  mode: GameMode;
  dailyChallengeTitle: string;
  dailyChallengeDescription: string;
  empDisabled: boolean;
  score: number;
  highScore: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  chapter: number;
  episode: number;
  episodesPerChapter: number;
  episodeTimeRemaining: number;
  episodeDuration: number;
  isBossEpisode: boolean;
  shards: number;
  totalShardsCollected: number;
  enemiesDefeated: number;
  dashReadyRatio: number;
  comboCount: number;
  comboMultiplier: number;
  maxCombo: number;
  comboTimeRatio: number;
  empCooldownRemaining: number;
  empCooldownTotal: number;
  // Tactical Shield ability
  tacticalShieldActive: boolean;
  tacticalShieldActiveRemaining: number;
  tacticalShieldActiveTotal: number;
  tacticalShieldCooldownRemaining: number;
  tacticalShieldCooldownTotal: number;
  // Polly Partner Assist ability
  pollyStatus: PollyStatus;
  pollyActiveRemaining: number;
  pollyActiveTotal: number;
  pollyCooldownRemaining: number;
  pollyCooldownTotal: number;
  // Boss readout & destructible subsystems
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossSubsystems?: BossSubsystem[];
  upgrades: UpgradeLevels;
  muted: boolean;
  // 6-DOF Full Manual Flight Telemetry & Controls
  playerX?: number;
  playerY?: number;
  playerZ?: number; // Altitude (-140..+140)
  playerVx?: number;
  playerVy?: number;
  playerVz?: number;
  autoFire?: boolean;
  touchMode?: TouchControlMode;
  altitudeKeys?: AltitudeKeyMode;
  gamepadConnected?: boolean;
  // Co-op Squadron & Fusion Link state
  coopActive?: boolean;
  coopRole?: CoopRole;
  coopRoomCode?: string;
  teammate?: TeammateHudState;
  squadronLinkActive?: boolean;
  squadronFusionDocked?: boolean;
  squadronLinkEnergy?: number; // 0..100
  squadronLinkCooldownRemaining?: number;
  activePing?: {
    sender: string;
    kind: TacticalPingKind;
    text: string;
    timer: number;
  } | null;
  // Rogue-lite perks & Mid-run Draft
  roguePerks?: RoguePerkStacks;
  draftPending?: boolean;
  draftChoices?: RogueDraftOption[];
  // Graze & Threat Radar
  grazeCount?: number;
  grazeSlowMoActive?: boolean;
  radarBlips?: RadarBlip[];
  fpsQuality?: 'high' | 'medium' | 'performance';
}

export interface RunSummary {
  mode: GameMode;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  qualifiesForLeaderboard: boolean;
  chapterReached: number;
  episodeReached: number;
  chaptersCleared: number;
  defeatedByBoss10: boolean;
  bossNameAtDefeat?: string;
  enemiesDefeated: number;
  bossesDefeated: number;
  shardsCollected: number;
  maxCombo: number;
  survivalSeconds: number;
  coopSquadron?: boolean;
  scrapEarned?: number;
  grazeTotal?: number;
}

export interface LeaderboardEntry {
  id: string;
  initials: string;
  score: number;
  chapterReached: number;
  episodeReached: number;
  maxCombo: number;
  mode: GameMode;
  dateIso: string;
  synced?: boolean;
  coop?: boolean;
}
