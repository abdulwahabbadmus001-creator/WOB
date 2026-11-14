export type GameState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'episode_clear'
  | 'chapter_victory'
  | 'gameover';

export type GameMode = 'campaign' | 'classic' | 'boss_rush';

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
}

export type EnemyKind = 'block' | 'firewall' | 'interceptor' | 'boss';

export interface HudSnapshot {
  mode: GameMode;
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
  // Boss readout
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  upgrades: UpgradeLevels;
  muted: boolean;
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
}
