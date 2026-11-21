import type {
  AltitudeKeyMode,
  BossArchetype,
  BossSubsystem,
  EnemyKind,
  FlightControlSettings,
  GameMode,
  HangarUpgradeConfig,
  HangarUpgradeId,
  HangarUpgradeLevels,
  PlayerStats,
  RogueDraftId,
  RogueDraftOption,
  RoguePerkStacks,
  RunSummary,
  TouchControlMode,
  UpgradeConfig,
  UpgradeId,
  UpgradeLevels,
  DailyChallenge,
  ShipSkin,
} from './types';

export const FLIGHT_SETTINGS_STORAGE_KEY = 'wob_flight_settings_v1';
export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'wob_campaign_progress_v1';
export const ARENA_MAX_ALTITUDE = 140;

export interface SavedCampaignProgress {
  highestChapter: number;
  lastChapter: number;
  lastEpisode: number;
  bankedShards: number;
}

export function loadFlightControlSettings(
  storage?: Pick<Storage, 'getItem'> | null,
): FlightControlSettings {
  const fallback: FlightControlSettings = {
    touchMode: 'dual_stick',
    altitudeKeys: 'space_shift',
    autoFire: true,
    inertialDampening: true,
  };
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return fallback;
    const raw = target.getItem(FLIGHT_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<FlightControlSettings>;
    const touchMode: TouchControlMode =
      parsed.touchMode === 'direct_touch' ? 'direct_touch' : 'dual_stick';
    const altitudeKeys: AltitudeKeyMode =
      parsed.altitudeKeys === 'q_e' || parsed.altitudeKeys === 'r_f'
        ? parsed.altitudeKeys
        : 'space_shift';
    return {
      touchMode,
      altitudeKeys,
      autoFire: typeof parsed.autoFire === 'boolean' ? parsed.autoFire : true,
      inertialDampening:
        typeof parsed.inertialDampening === 'boolean'
          ? parsed.inertialDampening
          : true,
    };
  } catch {
    return fallback;
  }
}

export function saveFlightControlSettings(
  settings: FlightControlSettings,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    target?.setItem(FLIGHT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedCampaignProgress(
  storage?: Pick<Storage, 'getItem'> | null,
): SavedCampaignProgress {
  const fallback: SavedCampaignProgress = {
    highestChapter: 1,
    lastChapter: 1,
    lastEpisode: 1,
    bankedShards: 0,
  };
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return fallback;
    const raw = target.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedCampaignProgress>;
    return {
      highestChapter: Math.max(1, Math.round(Number(parsed.highestChapter) || 1)),
      lastChapter: Math.max(1, Math.round(Number(parsed.lastChapter) || 1)),
      lastEpisode: Math.max(
        1,
        Math.min(10, Math.round(Number(parsed.lastEpisode) || 1)),
      ),
      bankedShards: Math.max(0, Math.round(Number(parsed.bankedShards) || 0)),
    };
  } catch {
    return fallback;
  }
}

export function saveCampaignProgress(
  progress: SavedCampaignProgress,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    target?.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export const EPISODES_PER_CHAPTER = 10;
export const BASE_EPISODE_DURATION_SECONDS = 24;
export const HIGH_SCORE_STORAGE_KEY = 'wob_high_score_v1';
export const COMBO_WINDOW_SECONDS = 3.2;
export const MAX_COMBO_MULTIPLIER = 20;

const DAILY_CHALLENGES: readonly DailyChallenge[] = [
  {
    id: 'overclock',
    title: 'Overclock',
    description: 'Double-speed enemies · Half hull · EMP disabled',
    speedMultiplier: 2,
    healthMultiplier: 0.5,
    enemyHealthMultiplier: 1,
    empDisabled: true,
  },
  {
    id: 'redline',
    title: 'Redline',
    description: 'Fast enemies · Fragile hull · EMP ready',
    speedMultiplier: 1.6,
    healthMultiplier: 0.65,
    enemyHealthMultiplier: 1,
    empDisabled: false,
  },
  {
    id: 'iron-comet',
    title: 'Iron Comet',
    description: 'Heavy enemies · Normal speed · EMP disabled',
    speedMultiplier: 1,
    healthMultiplier: 1,
    enemyHealthMultiplier: 1.5,
    empDisabled: true,
  },
];

export function getDailyChallenge(date = new Date()): DailyChallenge {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayIndex = Math.floor(day / 86_400_000);
  const challengeIndex =
    ((dayIndex % DAILY_CHALLENGES.length) + DAILY_CHALLENGES.length) %
    DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[challengeIndex];
}

export const SHIP_SKINS: readonly {
  id: ShipSkin;
  name: string;
  hullColor: string;
  trailColor: string;
  unlockScore: number;
}[] = [
  {
    id: 'cyan',
    name: 'Neon Cyan',
    hullColor: '#00f5d4',
    trailColor: '#38bdf8',
    unlockScore: 0,
  },
  {
    id: 'violet',
    name: 'Ion Violet',
    hullColor: '#c084fc',
    trailColor: '#818cf8',
    unlockScore: 5000,
  },
  {
    id: 'gold',
    name: 'Solar Gold',
    hullColor: '#fbbf24',
    trailColor: '#fb7185',
    unlockScore: 20000,
  },
];

export const SHIP_SKIN_STORAGE_KEY = 'wob_ship_skin_v1';

export function getShipSkinConfig(skin: ShipSkin) {
  const config = SHIP_SKINS.find((item) => item.id === skin);
  if (!config) throw new Error(`Unknown ship skin: ${skin}`);
  return config;
}

export function isShipSkinUnlocked(skin: ShipSkin, highScore: number): boolean {
  const config = SHIP_SKINS.find((item) => item.id === skin);
  return Boolean(config && highScore >= config.unlockScore);
}

export function loadShipSkin(
  highScore: number,
  storage?: Pick<Storage, 'getItem'> | null,
): ShipSkin {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const saved = target?.getItem(SHIP_SKIN_STORAGE_KEY);
    const skin = SHIP_SKINS.find((item) => item.id === saved)?.id ?? 'cyan';
    return isShipSkinUnlocked(skin, highScore) ? skin : 'cyan';
  } catch {
    return 'cyan';
  }
}

export function saveShipSkin(
  skin: ShipSkin,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    target?.setItem(SHIP_SKIN_STORAGE_KEY, skin);
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

// 3D Ship Hangar Permanent Modular Upgrades
export const HANGAR_STORAGE_KEY = 'wob_hangar_v1';

export const HANGAR_UPGRADE_CATALOG: readonly HangarUpgradeConfig[] = [
  {
    id: 'thruster',
    name: 'Thruster Speed',
    partName: 'Twin Afterburner Pods',
    description: '+8% Base flight speed & barrel-roll dash recovery per rank',
    maxLevel: 5,
    baseCost: 15,
    costStep: 15,
    accentColor: '#00f5d4',
  },
  {
    id: 'hull',
    name: 'Hull Integrity',
    partName: 'Titanium Wing Armor Plates',
    description: '+20 Base Max HP & +15 Starting Aegis Shield per rank',
    maxLevel: 5,
    baseCost: 20,
    costStep: 18,
    accentColor: '#a3ff12',
  },
  {
    id: 'overclock',
    name: 'Weapon Overclock',
    partName: 'Dual Overclock Cannon Barrels',
    description: '+10% Weapon damage & +7% faster firing cycle per rank',
    maxLevel: 5,
    baseCost: 25,
    costStep: 20,
    accentColor: '#ff007f',
  },
  {
    id: 'regen',
    name: 'Energy Regen',
    partName: 'Quantum Reactor Halo Core',
    description: '+10% Faster Shield, EMP, Polly & Squadron Link recharge per rank',
    maxLevel: 5,
    baseCost: 18,
    costStep: 16,
    accentColor: '#38bdf8',
  },
] as const;

export function createInitialHangarUpgrades(): HangarUpgradeLevels {
  return {
    thruster: 0,
    hull: 0,
    overclock: 0,
    regen: 0,
  };
}

export interface HangarStoreState {
  scrap: number;
  levels: HangarUpgradeLevels;
}

export function getHangarUpgradeCost(id: HangarUpgradeId, currentLevel: number): number {
  const cfg = HANGAR_UPGRADE_CATALOG.find((item) => item.id === id);
  if (!cfg) return 9999;
  return cfg.baseCost + currentLevel * cfg.costStep;
}

export function canPurchaseHangarUpgrade(
  id: HangarUpgradeId,
  levels: HangarUpgradeLevels,
  scrap: number,
): boolean {
  const cfg = HANGAR_UPGRADE_CATALOG.find((item) => item.id === id);
  if (!cfg) return false;
  const level = levels[id];
  if (level >= cfg.maxLevel) return false;
  return scrap >= getHangarUpgradeCost(id, level);
}

export function applyHangarUpgradePurchase(
  id: HangarUpgradeId,
  state: HangarStoreState,
): { state: HangarStoreState; purchased: boolean } {
  if (!canPurchaseHangarUpgrade(id, state.levels, state.scrap)) {
    return { state, purchased: false };
  }
  const cost = getHangarUpgradeCost(id, state.levels[id]);
  return {
    state: {
      scrap: state.scrap - cost,
      levels: {
        ...state.levels,
        [id]: state.levels[id] + 1,
      },
    },
    purchased: true,
  };
}

export function loadHangarState(
  storage?: Pick<Storage, 'getItem'> | null,
): HangarStoreState {
  const fallback: HangarStoreState = {
    scrap: 40, // Starter scrap so players can immediately inspect and attach a 3D modular part!
    levels: createInitialHangarUpgrades(),
  };
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return fallback;
    const raw = target.getItem(HANGAR_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<HangarStoreState>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const lv = (parsed.levels ?? {}) as Partial<HangarUpgradeLevels>;
    return {
      scrap: Math.max(0, Math.round(Number(parsed.scrap) || 0)),
      levels: {
        thruster: Math.max(0, Math.min(5, Math.round(Number(lv.thruster) || 0))),
        hull: Math.max(0, Math.min(5, Math.round(Number(lv.hull) || 0))),
        overclock: Math.max(0, Math.min(5, Math.round(Number(lv.overclock) || 0))),
        regen: Math.max(0, Math.min(5, Math.round(Number(lv.regen) || 0))),
      },
    };
  } catch {
    return fallback;
  }
}

export function saveHangarState(
  state: HangarStoreState,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    target?.setItem(HANGAR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// Mid-Run Rogue-Lite Tactical Draft Catalog
export const ROGUE_DRAFT_CATALOG: readonly RogueDraftOption[] = [
  {
    id: 'chain_lightning',
    title: 'Chain-Lightning Projectiles',
    subtitle: 'Arc Discharge · Stackable',
    description:
      'Weapon impacts arc high-voltage lightning to nearby enemies for 45% bonus damage per stack.',
    accentColor: '#38bdf8',
  },
  {
    id: 'vampiric_shield',
    title: 'Vampiric Shield Recharge',
    subtitle: 'Siphon Matrix · Stackable',
    description:
      'Every 3 enemies neutralized restores +8 Aegis Shield and +4 Hull integrity per stack.',
    accentColor: '#a3ff12',
  },
  {
    id: 'twin_polly',
    title: 'Twin Polly Drones',
    subtitle: 'Autonomous Wingman Pair · Stackable',
    description:
      'Deploys a second synchronized Polly combat drone that strafes weak points and intercepts missiles.',
    accentColor: '#00f5d4',
  },
  {
    id: 'overcharged_emp',
    title: 'Overcharged EMP Radius',
    subtitle: 'Nova Capacitor · Stackable',
    description:
      '+55% EMP shockwave damage, +35% blast radius, and -4s EMP cooldown per stack.',
    accentColor: '#c084fc',
  },
  {
    id: 'hyper_graze',
    title: 'Hyper-Graze Focus',
    subtitle: 'Kinetic Reflex · Stackable',
    description:
      'Grazing enemy fire triggers brief kinetic slow-mo and recharges 1.8s of Dash & EMP cooldowns.',
    accentColor: '#fbbf24',
  },
  {
    id: 'tether_overdrive',
    title: 'Squadron Tether Overdrive',
    subtitle: 'Fusion Amplifier · Stackable',
    description:
      '+65% Squadron Link plasma tether damage and +2.5s Twin-Core Heavy Gunship fusion duration.',
    accentColor: '#ff007f',
  },
] as const;

export function createInitialRoguePerks(): RoguePerkStacks {
  return {
    chain_lightning: 0,
    vampiric_shield: 0,
    twin_polly: 0,
    overcharged_emp: 0,
    hyper_graze: 0,
    tether_overdrive: 0,
  };
}

export function pickRogueDraftChoices(seed = Math.random()): RogueDraftOption[] {
  const pool = [...ROGUE_DRAFT_CATALOG];
  // Deterministic or random shuffle of 3 distinct choices
  let s = Math.floor(seed * 100000) || 1337;
  for (let i = pool.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 3);
}

// Capital Starship Destructible Subsystems
export function createBossSubsystems(
  bossMaxHp: number,
  isChapterBoss: boolean,
): BossSubsystem[] {
  const subHp = Math.max(90, Math.round(bossMaxHp * (isChapterBoss ? 0.22 : 0.25)));
  const coreHp = Math.max(140, Math.round(bossMaxHp * 0.32));
  const specs: Array<{
    kind: BossSubsystem['kind'];
    name: string;
    offsetAngle: number;
    offsetRadiusRatio: number;
    offsetZ: number;
    hp: number;
  }> = isChapterBoss
    ? [
        {
          kind: 'shield_gen',
          name: 'Aegis Shield Generator',
          offsetAngle: -Math.PI / 2,
          offsetRadiusRatio: 0.85,
          offsetZ: 28,
          hp: subHp,
        },
        {
          kind: 'laser_battery',
          name: 'Broadside Laser Battery',
          offsetAngle: 0,
          offsetRadiusRatio: 0.9,
          offsetZ: -18,
          hp: subHp,
        },
        {
          kind: 'missile_pod',
          name: 'Salvo Missile Pods',
          offsetAngle: Math.PI,
          offsetRadiusRatio: 0.9,
          offsetZ: -18,
          hp: subHp,
        },
        {
          kind: 'central_core',
          name: 'Apex Reactor Core',
          offsetAngle: Math.PI / 2,
          offsetRadiusRatio: 0.55,
          offsetZ: 34,
          hp: coreHp,
        },
      ]
    : [
        {
          kind: 'laser_battery',
          name: 'Port Laser Turret',
          offsetAngle: -Math.PI / 3,
          offsetRadiusRatio: 0.85,
          offsetZ: 16,
          hp: subHp,
        },
        {
          kind: 'missile_pod',
          name: 'Starboard Missile Pod',
          offsetAngle: Math.PI / 3,
          offsetRadiusRatio: 0.85,
          offsetZ: -16,
          hp: subHp,
        },
      ];

  return specs.map((spec, idx) => ({
    id: `sub-${spec.kind}-${idx}`,
    kind: spec.kind,
    name: spec.name,
    offsetAngle: spec.offsetAngle,
    offsetRadiusRatio: spec.offsetRadiusRatio,
    offsetZ: spec.offsetZ,
    hp: spec.hp,
    maxHp: spec.hp,
    destroyed: false,
    hitFlash: 0,
    worldX: 0,
    worldY: 0,
    worldZ: spec.offsetZ,
  }));
}

// EMP Emergency Bomb
export const EMP_COOLDOWN_SECONDS = 30;
export const EMP_STUN_SECONDS = 2.5;
export const EMP_BLAST_RADIUS = 380;
export const EMP_BLAST_DAMAGE = 36;

// Tommy's Tactical Shield Button (S / Right-Click / HUD Button)
export const TACTICAL_SHIELD_DURATION = 3.2;
export const TACTICAL_SHIELD_COOLDOWN = 11;
export const SHIELD_REFLECT_BOLT_SPEED = 640;
export const SHIELD_REFLECT_DAMAGE = 28;

// Polly Combat Partner Assist (Q / Auto on peak density or Episode 10 Boss / HUD Button)
export const POLLY_ASSIST_DURATION = 4.8;
export const POLLY_ASSIST_COOLDOWN = 16;
export const POLLY_AUTO_ENEMY_THRESHOLD = 8;

// Co-op Squadron Link & Twin-Core Heavy Gunship Fusion
export const SQUADRON_LINK_DURATION = 6.5;
export const SQUADRON_LINK_COOLDOWN = 18;
export const SQUADRON_TETHER_MAX_DIST = 290;

export function advanceComboStreak(currentStreak: number): {
  streak: number;
  multiplier: number;
  timer: number;
} {
  const nextStreak = Math.max(1, currentStreak + 1);
  const multiplier = Math.min(MAX_COMBO_MULTIPLIER, nextStreak);
  return {
    streak: nextStreak,
    multiplier,
    timer: COMBO_WINDOW_SECONDS,
  };
}

export function computeComboRewards(
  baseScore: number,
  baseShards: number,
  multiplier: number,
): { score: number; shards: number } {
  const safeMult = Math.max(1, Math.min(MAX_COMBO_MULTIPLIER, multiplier));
  const score = Math.round(baseScore * safeMult);
  const shardFactor = safeMult <= 1 ? 1 : 1 + (safeMult - 1) * 0.35;
  const shards = Math.max(baseShards, Math.round(baseShards * shardFactor));
  return { score, shards };
}

export const UPGRADE_CATALOG: readonly UpgradeConfig[] = [
  {
    id: 'speed',
    name: 'Thruster Overdrive',
    role: '+18% Tommy flight speed & faster dash',
    maxLevel: 5,
    baseCost: 8,
    costStep: 8,
    accentColor: '#00f5d4',
    hotkey: '1',
  },
  {
    id: 'multishot',
    name: 'Multi-Shot Laser',
    role: '+1 Parallel plasma beam per volley',
    maxLevel: 4,
    baseCost: 12,
    costStep: 12,
    accentColor: '#ff007f',
    hotkey: '2',
  },
  {
    id: 'shield',
    name: 'Aegis Armor Plating',
    role: '+30 Passive shield, +20 Max HP & hull repair',
    maxLevel: 5,
    baseCost: 10,
    costStep: 10,
    accentColor: '#a3ff12',
    hotkey: '3',
  },
  {
    id: 'magnet',
    name: 'Auto-Magnet Core',
    role: '+85px Data Shard pull radius & speed',
    maxLevel: 5,
    baseCost: 6,
    costStep: 6,
    accentColor: '#38bdf8',
    hotkey: '4',
  },
] as const;

export function createInitialUpgrades(): UpgradeLevels {
  return {
    speed: 0,
    multishot: 0,
    shield: 0,
    magnet: 0,
  };
}

export function createChapterStarterUpgrades(chapter: number): UpgradeLevels {
  const bonus = Math.max(0, Math.min(2, Math.floor((chapter - 1) / 2)));
  return {
    speed: bonus,
    multishot: Math.min(2, Math.floor(chapter / 2)),
    shield: bonus,
    magnet: bonus,
  };
}

export interface EpisodeDifficultyConfig {
  chapter: number;
  episode: number;
  isBossEpisode: boolean;
  durationSeconds: number;
  spawnInterval: number;
  speedMultiplier: number;
  hpMultiplier: number;
  maxActiveEnemies: number;
  shouldSpawnSubBoss: boolean;
  weights: {
    block: number;
    firewall: number;
    interceptor: number;
  };
}

export function computeEpisodeConfig(
  chapter: number,
  episode: number,
  durationOverrideSeconds?: number | null,
): EpisodeDifficultyConfig {
  const ch = Math.max(1, Math.floor(chapter));
  const ep = Math.max(1, Math.min(EPISODES_PER_CHAPTER, Math.floor(episode)));
  const isBossEpisode = ep === EPISODES_PER_CHAPTER;

  const progressIndex = (ch - 1) * EPISODES_PER_CHAPTER + (ep - 1);
  const spawnInterval = Math.max(
    0.28,
    1.28 - (ep - 1) * 0.08 - (ch - 1) * 0.09,
  );
  const speedMultiplier = 1 + (ep - 1) * 0.08 + (ch - 1) * 0.22;
  const hpMultiplier = 1 + (ep - 1) * 0.16 + (ch - 1) * 0.45;
  const maxActiveEnemies = Math.min(44, 10 + (ep - 1) * 2 + (ch - 1) * 4);

  const weights =
    ep <= 2 && ch === 1
      ? { block: 0.62, firewall: 0.22, interceptor: 0.16 }
      : ep <= 5
        ? { block: 0.46, firewall: 0.3, interceptor: 0.24 }
        : { block: 0.34, firewall: 0.34, interceptor: 0.32 };

  const defaultDuration = isBossEpisode
    ? 0
    : Math.min(38, BASE_EPISODE_DURATION_SECONDS + Math.floor(ep / 2) * 2);
  const durationSeconds = isBossEpisode
    ? 0
    : durationOverrideSeconds && durationOverrideSeconds > 0
      ? durationOverrideSeconds
      : defaultDuration;

  return {
    chapter: ch,
    episode: ep,
    isBossEpisode,
    durationSeconds,
    spawnInterval,
    speedMultiplier,
    hpMultiplier,
    maxActiveEnemies,
    shouldSpawnSubBoss:
      !isBossEpisode && (ep === 5 || ep === 8 || (progressIndex > 12 && ep % 4 === 0)),
    weights,
  };
}

export function computeCoopScaling(coopActive: boolean): {
  enemyHpMult: number;
  bossHpMult: number;
  maxEnemiesBonus: number;
  spawnIntervalMult: number;
} {
  if (!coopActive) {
    return {
      enemyHpMult: 1,
      bossHpMult: 1,
      maxEnemiesBonus: 0,
      spawnIntervalMult: 1,
    };
  }
  return {
    enemyHpMult: 1.55,
    bossHpMult: 1.75,
    maxEnemiesBonus: 8,
    spawnIntervalMult: 0.78,
  };
}

export interface ChapterBossConfig {
  chapter: number;
  archetype: BossArchetype;
  title: string;
  subtitle: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  scoreValue: number;
  shardValue: number;
  bulletSpeedMult: number;
  spiralSpokes: number;
  laserBeamCount: number;
  droneCount: number;
  aggressionRate: number;
}

const CHAPTER_BOSS_SPECS: readonly {
  archetype: BossArchetype;
  title: string;
  subtitle: string;
}[] = [
  {
    archetype: 'sentinel',
    title: 'CORE SENTINEL',
    subtitle: 'Chapter 1 Apex Dreadnought · Sweeping Plasma Arrays',
  },
  {
    archetype: 'helix',
    title: 'VOID FIREWALL MATRIX',
    subtitle: 'Chapter 2 Apex Dreadnought · Counter-Rotating Bullet Hell',
  },
  {
    archetype: 'architect',
    title: 'OMEGA SWARM NEXUS',
    subtitle: 'Chapter 3 Apex Carrier · Drone Fabricator & Fan Volleys',
  },
  {
    archetype: 'leviathan',
    title: 'ABYSSAL BREACH CORE',
    subtitle: 'Chapter 4 Apex Titan · Dual-Phase Laser & Spiral Storm',
  },
];

export function computeChapterBossConfig(chapter: number): ChapterBossConfig {
  const ch = Math.max(1, Math.floor(chapter));
  const cycle = Math.floor((ch - 1) / CHAPTER_BOSS_SPECS.length) + 1;
  const spec = CHAPTER_BOSS_SPECS[(ch - 1) % CHAPTER_BOSS_SPECS.length];
  const suffix = cycle > 1 ? ` MK-${cycle}` : '';

  return {
    chapter: ch,
    archetype: spec.archetype,
    title: `${spec.title}${suffix}`,
    subtitle: spec.subtitle,
    hp: Math.round(2200 + (ch - 1) * 1000),
    speed: 96 + Math.min(95, (ch - 1) * 16),
    radius: 48 + Math.min(12, (ch - 1) * 2),
    damage: 26 + Math.min(18, (ch - 1) * 4),
    scoreValue: 1800 + (ch - 1) * 750,
    shardValue: 18 + (ch - 1) * 5,
    bulletSpeedMult: 1.05 + Math.min(1.1, (ch - 1) * 0.16),
    spiralSpokes: Math.min(20, 10 + (ch - 1) * 2),
    laserBeamCount: ch >= 3 ? 3 : 2,
    droneCount: Math.min(5, 2 + Math.floor(ch / 2)),
    aggressionRate: 1 + Math.min(0.85, (ch - 1) * 0.14),
  };
}

export function advanceCampaignProgress(
  chapter: number,
  episode: number,
): {
  nextChapter: number;
  nextEpisode: number;
  chapterCleared: boolean;
} {
  const ch = Math.max(1, Math.floor(chapter));
  const ep = Math.max(1, Math.floor(episode));
  if (ep >= EPISODES_PER_CHAPTER) {
    return {
      nextChapter: ch + 1,
      nextEpisode: 1,
      chapterCleared: true,
    };
  }
  return {
    nextChapter: ch,
    nextEpisode: ep + 1,
    chapterCleared: false,
  };
}

export function resolveEpisodeDefeat(
  chapter: number,
  episode: number,
): {
  defeatedByBoss10: boolean;
  resumeChapter: number;
  resumeEpisode: number;
} {
  const ch = Math.max(1, Math.floor(chapter));
  const ep = Math.max(1, Math.floor(episode));
  if (ep === EPISODES_PER_CHAPTER) {
    return {
      defeatedByBoss10: true,
      resumeChapter: ch,
      resumeEpisode: 1,
    };
  }
  return {
    defeatedByBoss10: false,
    resumeChapter: 1,
    resumeEpisode: 1,
  };
}

export function getUpgradeCost(id: UpgradeId, currentLevel: number): number {
  const cfg = UPGRADE_CATALOG.find((item) => item.id === id);
  if (!cfg) return 9999;
  return cfg.baseCost + currentLevel * cfg.costStep;
}

export function canPurchaseUpgrade(
  id: UpgradeId,
  upgrades: UpgradeLevels,
  shards: number,
): boolean {
  const cfg = UPGRADE_CATALOG.find((item) => item.id === id);
  if (!cfg) return false;
  const level = upgrades[id];
  if (level >= cfg.maxLevel) return false;
  return shards >= getUpgradeCost(id, level);
}

export function applyUpgradePurchase(
  id: UpgradeId,
  upgrades: UpgradeLevels,
  shards: number,
): { upgrades: UpgradeLevels; shards: number; purchased: boolean } {
  if (!canPurchaseUpgrade(id, upgrades, shards)) {
    return { upgrades, shards, purchased: false };
  }
  const cost = getUpgradeCost(id, upgrades[id]);
  return {
    upgrades: {
      ...upgrades,
      [id]: upgrades[id] + 1,
    },
    shards: shards - cost,
    purchased: true,
  };
}

export function computePlayerStats(
  upgrades: UpgradeLevels,
  hangar?: HangarUpgradeLevels,
): PlayerStats {
  const h = hangar ?? { thruster: 0, hull: 0, overclock: 0, regen: 0 };
  const thrusterBonus = 1 + h.thruster * 0.08;
  const overclockFireFactor = Math.max(0.65, 1 - h.overclock * 0.07);
  const damageMultiplier = 1 + h.overclock * 0.1;
  const cooldownHaste = 1 + h.regen * 0.1;

  return {
    moveSpeed: 285 * (1 + upgrades.speed * 0.18) * thrusterBonus,
    fireInterval: Math.max(0.08, (0.21 - upgrades.speed * 0.012) * overclockFireFactor),
    shotCount: 1 + upgrades.multishot,
    maxHp: 100 + upgrades.shield * 20 + h.hull * 20,
    maxShield: upgrades.shield * 30 + h.hull * 15,
    shieldRegenDelay: Math.max(1.6, (4.5 - upgrades.shield * 0.4) / cooldownHaste),
    magnetRadius: 95 + upgrades.magnet * 85,
    magnetPullSpeed: 320 + upgrades.magnet * 95,
    dashCooldown: Math.max(0.85, (2.2 - upgrades.speed * 0.18) / thrusterBonus),
    damageMultiplier,
    cooldownHaste,
  };
}

export function pickEnemyKind(
  roll: number,
  weights: EpisodeDifficultyConfig['weights'],
): Exclude<EnemyKind, 'boss'> {
  const r = Math.max(0, Math.min(0.9999, roll));
  if (r < weights.block) return 'block';
  if (r < weights.block + weights.firewall) return 'firewall';
  return 'interceptor';
}

export function applyIncomingDamage(
  hp: number,
  shield: number,
  rawDamage: number,
): { hp: number; shield: number; shieldBroken: boolean; lethal: boolean } {
  const dmg = Math.max(0, rawDamage);
  if (shield > 0) {
    if (shield >= dmg) {
      return {
        hp,
        shield: shield - dmg,
        shieldBroken: shield - dmg === 0,
        lethal: false,
      };
    }
    const overflow = dmg - shield;
    const nextHp = Math.max(0, hp - overflow);
    return {
      hp: nextHp,
      shield: 0,
      shieldBroken: true,
      lethal: nextHp <= 0,
    };
  }

  const nextHp = Math.max(0, hp - dmg);
  return {
    hp: nextHp,
    shield: 0,
    shieldBroken: false,
    lethal: nextHp <= 0,
  };
}

export function circleIntersects(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const radiusSum = ar + br;
  return dx * dx + dy * dy <= radiusSum * radiusSum;
}

export function clampDeltaTime(rawDtSeconds: number): number {
  if (!Number.isFinite(rawDtSeconds) || rawDtSeconds < 0) return 0;
  return Math.min(rawDtSeconds, 0.05);
}

export function loadHighScore(storage?: Pick<Storage, 'getItem'> | null): number {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return 0;
    const raw = target.getItem(HIGH_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(
  score: number,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): number {
  const cleanScore = Math.max(0, Math.round(score));
  const current = loadHighScore(storage);
  const nextBest = Math.max(current, cleanScore);
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (target && nextBest > current) {
      target.setItem(HIGH_SCORE_STORAGE_KEY, String(nextBest));
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
  return nextBest;
}

export function buildRunSummary(params: {
  mode?: GameMode;
  score: number;
  previousHighScore: number;
  qualifiesForLeaderboard?: boolean;
  chapterReached: number;
  episodeReached: number;
  chaptersCleared?: number;
  defeatedByBoss10?: boolean;
  bossNameAtDefeat?: string;
  enemiesDefeated: number;
  bossesDefeated?: number;
  shardsCollected: number;
  maxCombo?: number;
  survivalSeconds: number;
  coopSquadron?: boolean;
  scrapEarned?: number;
  grazeTotal?: number;
}): RunSummary {
  const finalScore = Math.max(0, Math.round(params.score));
  const best = Math.max(params.previousHighScore, finalScore);
  const chapterReached = Math.max(1, Math.floor(params.chapterReached));
  const episodeReached = Math.max(
    1,
    Math.min(EPISODES_PER_CHAPTER, Math.floor(params.episodeReached)),
  );
  return {
    mode: params.mode ?? 'campaign',
    score: finalScore,
    highScore: best,
    isNewHighScore: finalScore > params.previousHighScore && finalScore > 0,
    qualifiesForLeaderboard:
      params.qualifiesForLeaderboard ?? finalScore > 0,
    chapterReached,
    episodeReached,
    chaptersCleared: Math.max(0, params.chaptersCleared ?? chapterReached - 1),
    defeatedByBoss10: Boolean(params.defeatedByBoss10),
    bossNameAtDefeat: params.bossNameAtDefeat,
    enemiesDefeated: Math.max(0, params.enemiesDefeated),
    bossesDefeated: Math.max(0, params.bossesDefeated ?? 0),
    shardsCollected: Math.max(0, params.shardsCollected),
    maxCombo: Math.max(1, params.maxCombo ?? 1),
    survivalSeconds: Math.max(0, Math.round(params.survivalSeconds)),
    coopSquadron: params.coopSquadron,
    scrapEarned: params.scrapEarned,
    grazeTotal: params.grazeTotal,
  };
}
