import {
  applyAchievementDelta,
  loadAchievementState,
  saveAchievementState,
  type AchievementDefinition,
  type AchievementDelta,
  type AchievementStoreState,
} from './achievements';
import { soundFX } from './audio';
import { coopSession, type CoopTelemetryPacket } from './coop';
import {
  loadLeaderboard,
  qualifiesForLeaderboard,
} from './leaderboard';
import {
  idbSet,
  recordDailyChallengeRun,
} from './persistence';
import { WobRenderer3D } from './renderer3d';
import {
  advanceCampaignProgress,
  advanceComboStreak,
  applyIncomingDamage,
  applyUpgradePurchase,
  ARENA_MAX_ALTITUDE,
  BASE_EPISODE_DURATION_SECONDS,
  buildRunSummary,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  circleIntersects,
  clampDeltaTime,
  COMBO_WINDOW_SECONDS,
  computeChapterBossConfig,
  computeComboRewards,
  computeCoopScaling,
  computeEpisodeConfig,
  computePlayerStats,
  createBossSubsystems,
  createChapterStarterUpgrades,
  createInitialHangarUpgrades,
  createInitialRoguePerks,
  createInitialUpgrades,
  EMP_BLAST_DAMAGE,
  EMP_BLAST_RADIUS,
  EMP_COOLDOWN_SECONDS,
  EMP_STUN_SECONDS,
  EPISODES_PER_CHAPTER,
  FLIGHT_SETTINGS_STORAGE_KEY,
  getDailyChallenge,
  getShipSkinConfig,
  HANGAR_STORAGE_KEY,
  loadFlightControlSettings,
  loadHangarState,
  loadHighScore,
  loadSavedCampaignProgress,
  pickEnemyKind,
  pickRogueDraftChoices,
  POLLY_ASSIST_COOLDOWN,
  POLLY_ASSIST_DURATION,
  POLLY_AUTO_ENEMY_THRESHOLD,
  resolveEpisodeDefeat,
  saveCampaignProgress,
  saveFlightControlSettings,
  saveHangarState,
  saveHighScore,
  SHIELD_REFLECT_BOLT_SPEED,
  SHIELD_REFLECT_DAMAGE,
  SQUADRON_LINK_COOLDOWN,
  SQUADRON_LINK_DURATION,
  SQUADRON_TETHER_MAX_DIST,
  TACTICAL_SHIELD_COOLDOWN,
  TACTICAL_SHIELD_DURATION,
} from './rules';
import type {
  BossArchetype,
  BossSubsystem,
  CoopPilotConfig,
  CoopRole,
  EnemyKind,
  FlightControlSettings,
  GameMode,
  GameState,
  HangarUpgradeLevels,
  HudSnapshot,
  PollyStatus,
  RadarBlip,
  RogueDraftId,
  RogueDraftOption,
  RoguePerkStacks,
  RunSummary,
  ShipSkin,
  TacticalPingKind,
  UpgradeId,
  UpgradeLevels,
  WeaponType,
} from './types';

interface Bullet {
  active: boolean;
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  radius: number;
  damage: number;
  life: number;
  fromEnemy: boolean;
  color: string;
  homing?: boolean;
  grazed?: boolean;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  shardValue: number;
  angle: number;
  hitFlash: number;
  dyingTimer: number;
  stunTimer: number;
  state: 'approach' | 'telegraph' | 'attack' | 'recover';
  stateTimer: number;
  aimAngle: number;
  glitchTimer: number;
  orbitDir: number;
  // Chapter Boss & Sub-Boss properties
  isChapterBoss?: boolean;
  bossArchetype?: BossArchetype;
  bossTitle?: string;
  attackPhase?: number;
  laserActiveTimer?: number;
  laserAngle?: number;
  laserSweepDir?: number;
  laserCount?: number;
  spiralTickTimer?: number;
  spiralTicksRemaining?: number;
  bulletSpeedMult?: number;
  spiralSpokes?: number;
  droneCount?: number;
  aggressionRate?: number;
  isBossMinion?: boolean;
  shielded?: boolean;
  shieldOpenTimer?: number;
  bossPhase?: number;
  subsystems?: BossSubsystem[];
  warpInTimer?: number;
}

interface EnergyOrb {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  life: number;
  pulse: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  square: boolean;
}

interface FloatingLabel {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Afterimage {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

interface AsteroidHazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  life: number;
}

interface LightningArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
}

export interface CoopStartOptions {
  enabled: boolean;
  role: CoopRole;
  roomCode: string;
  partner: CoopPilotConfig;
}

export interface EngineCallbacks {
  onStateChange: (state: GameState) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onGameOver: (summary: RunSummary) => void;
  onAchievementUpdate?: (
    state: AchievementStoreState,
    newlyUnlocked: AchievementDefinition[],
  ) => void;
  onHangarScrapEarned?: (addedScrap: number) => void;
}

const PARTICLE_POOL_SIZE = 440;
const BULLET_POOL_SIZE = 280;
const ORB_POOL_SIZE = 160;
const LABEL_POOL_SIZE = 36;
const AFTERIMAGE_POOL_SIZE = 18;
const MAX_CONCURRENT_TELEGRAPHS = 3;

export class WobGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer3d: WobRenderer3D;
  private callbacks: EngineCallbacks;

  private width = 1280;
  private height = 720;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  // Performance Auto-Scaler
  private fpsQuality: 'high' | 'medium' | 'performance' = 'high';
  private frameTimeAccumulator = 0;
  private frameSampleCount = 0;

  private gameState: GameState = 'title';
  private overlayOpen = false;
  private needsStaticRender = true;
  private hitstopTimer = 0;
  private trauma = 0;
  private hudSyncTimer = 0;
  private deathDelayTimer = 0;
  private isDyingSequence = false;
  private episodeDamaged = false;

  // Near-Miss Graze & Kinetic Slow-Mo Focus
  private grazeCount = 0;
  private grazeSlowMoTimer = 0;

  // Tommy (Player Core) 6-DOF 3D Flight state (Front, Back, Left, Right, Up, Down)
  private playerX = 640;
  private playerY = 360;
  private playerZ = 0; // Altitude (-140..+140)
  private playerVx = 0;
  private playerVy = 0;
  private playerVz = 0;
  private playerAngle = -Math.PI / 2;
  private playerRadius = 15;
  private playerHp = 100;
  private playerShield = 0;
  private shieldRegenTimer = 0;
  private playerInvuln = 0;
  private playerHitFlash = 0;
  private playerScaleX = 1;
  private playerScaleY = 1;
  private fireTimer = 0;
  private dashTimer = 0;
  private dashDuration = 0.22;
  private dashCooldownTimer = 0;
  private dashBufferTimer = 0;
  private dashDirX = 0;
  private dashDirY = -1;
  private dashDirZ = 0;
  private afterimageSpawnTimer = 0;
  private playerDowned = false;
  private playerReviveProgress = 0;

  // Tommy's Tactical Shield Button ability (S / Right-Click / HUD)
  private tacticalShieldActiveTimer = 0;
  private tacticalShieldCooldownTimer = 0;
  private tacticalShieldPulse = 0;

  // Polly combat partner state + Twin Polly Drone
  private pollyX = 720;
  private pollyY = 300;
  private pollyAngle = -Math.PI / 2;
  private pollyActiveTimer = 0;
  private pollyCooldownTimer = 0;
  private pollyFireTimer = 0;
  private pollyOrbitPhase = 0;
  private pollyBeamTargetX = 0;
  private pollyBeamTargetY = 0;
  private pollyBeamFlashTimer = 0;
  private pollyInterceptTimer = 0;
  private bossFightElapsed = 0;

  private twinPollyX = 560;
  private twinPollyY = 300;
  private twinPollyAngle = -Math.PI / 2;
  private twinPollyFireTimer = 0;

  // Co-op Squadron Teammate & Squadron Fusion Link state
  private coopActive = false;
  private coopRole: CoopRole = 'solo';
  private coopRoomCode = '';
  private teammateCallsign = 'NOVA-2';
  private teammateSkin: ShipSkin = 'violet';
  private teammateWeapon: WeaponType = 'homing';
  private teammateX = 580;
  private teammateY = 400;
  private teammateZ = 0;
  private teammateVx = 0;
  private teammateVy = 0;
  private teammateAngle = -Math.PI / 2;
  private teammateHp = 100;
  private teammateMaxHp = 100;
  private teammateShield = 30;
  private teammateMaxShield = 30;
  private teammateDowned = false;
  private teammateReviveProgress = 0;
  private teammateFireTimer = 0.15;
  private teammateNetSyncTimer = 0;

  // Squadron Link (Energy Tether & Twin-Core Heavy Gunship Fusion)
  private squadronLinkEnergy = 100;
  private squadronLinkActiveTimer = 0;
  private squadronFusionDocked = false;
  private squadronLinkCooldownTimer = 0;
  private tetherDamageTickTimer = 0;

  // Tactical Callout Pings
  private activePing: {
    sender: string;
    kind: TacticalPingKind;
    text: string;
    timer: number;
  } | null = null;
  private focusCoreBuffTimer = 0;

  // Endless Chapter & Episode Campaign Progression
  private mode: GameMode = 'campaign';
  private selectedWeapon: WeaponType = 'spread';
  private selectedShipSkin: ShipSkin = 'cyan';
  private dailyChallenge = getDailyChallenge();
  private survivalWaveTimer = 40;
  private score = 0;
  private highScore = 0;
  private initialHighScore = 0;
  private chapter = 1;
  private episode = 1;
  private chaptersCleared = 0;
  private configuredStartChapter = 1;
  private configuredStartEpisode = 1;
  private configuredEpisodeDuration: number | null = null;
  private configuredStartHp: number | null = null;
  private episodeTimeRemaining = BASE_EPISODE_DURATION_SECONDS;
  private episodeDuration = BASE_EPISODE_DURATION_SECONDS;
  private totalSurvivalSeconds = 0;
  private shards = 0;
  private totalShardsCollected = 0;
  private enemiesDefeated = 0;
  private bossesDefeated = 0;
  private upgrades: UpgradeLevels = createInitialUpgrades();
  private hangarLevels: HangarUpgradeLevels = createInitialHangarUpgrades();
  private roguePerks: RoguePerkStacks = createInitialRoguePerks();
  private draftPending = false;
  private draftChoices: RogueDraftOption[] = [];
  private achievementState: AchievementStoreState = loadAchievementState();
  private lastDefeatBossName: string | undefined = undefined;

  // Combo Multiplier Streak
  private comboCount = 0;
  private comboMultiplier = 1;
  private maxCombo = 1;
  private comboTimer = 0;

  // EMP Emergency Bomb
  private empCooldownTimer = 0;
  private empWaveActive = false;
  private empWaveX = 0;
  private empWaveY = 0;
  private empWaveRadius = 0;
  private empWaveMaxRadius = 900;
  private empWaveAlpha = 0;

  // Spawners & alerts
  private nextEnemyId = 1;
  private enemySpawnTimer = 1.5;
  private ambientOrbTimer = 4.0;
  private hazardTimer = 7;
  private bossBannerTimer = 0;
  private bossBannerText = '';
  private pollyBannerTimer = 0;
  private titleTime = 0;

  // Input state, 6-DOF Flight Settings, Mobile Dual-Stick & Gamepad
  private keysHeld = new Set<string>();
  private pointerActive = false;
  private activePointerId: number | null = null;
  private pointerWorldX = 640;
  private pointerWorldY = 360;
  private pointerHoverX = 520;
  private pointerHoverY = 220;
  private joystickActive = false;
  private joystickDx = 0;
  private joystickDy = 0;
  private altitudeTouchInput = 0; // -1 (Down) .. +1 (Up)
  private manualFireHeld = false;
  private flightSettings: FlightControlSettings = loadFlightControlSettings();
  private gamepadConnected = false;
  private gamepadPrevButtons: boolean[] = [];

  // Entity pools
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private orbs: EnergyOrb[] = [];
  private particles: Particle[] = [];
  private particleCursor = 0;
  private labels: FloatingLabel[] = [];
  private labelCursor = 0;
  private afterimages: Afterimage[] = [];
  private afterimageCursor = 0;
  private hazards: AsteroidHazard[] = [];
  private lightningArcs: LightningArc[] = [];

  private bgMotes: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
  }> = [];

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;
    this.renderer3d = new WobRenderer3D();
    this.highScore = loadHighScore();
    this.initialHighScore = this.highScore;
    this.hangarLevels = loadHangarState().levels;

    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const epSecParam = Number.parseFloat(
        searchParams.get('epSec') ?? searchParams.get('waveSec') ?? '',
      );
      if (Number.isFinite(epSecParam) && epSecParam >= 1.5 && epSecParam <= 300) {
        this.configuredEpisodeDuration = epSecParam;
      }
      const chParam = Number.parseInt(searchParams.get('chapter') ?? '', 10);
      if (Number.isFinite(chParam) && chParam >= 1 && chParam <= 99) {
        this.configuredStartChapter = chParam;
      }
      const epParam = Number.parseInt(searchParams.get('episode') ?? '', 10);
      if (Number.isFinite(epParam) && epParam >= 1 && epParam <= EPISODES_PER_CHAPTER) {
        this.configuredStartEpisode = epParam;
      }
      const hpParam = Number.parseInt(searchParams.get('hp') ?? '', 10);
      if (Number.isFinite(hpParam) && hpParam >= 1 && hpParam <= 500) {
        this.configuredStartHp = hpParam;
      }
    }

    coopSession.setCallbacks((packet) => this.handleCoopPacket(packet));

    this.initPools();
    this.setupResizeObserver();
    this.pointerHoverX = this.width * 0.42;
    this.pointerHoverY = this.height * 0.28;
    this.bindInputListeners();
    this.initAmbientMotes();
    this.syncBodyState('title');
    this.pushHudSnapshot();
    this.callbacks.onAchievementUpdate?.(this.achievementState, []);
  }

  public setHangarUpgrades(levels: HangarUpgradeLevels): void {
    this.hangarLevels = { ...levels };
    this.needsStaticRender = true;
    this.pushHudSnapshot();
  }

  public setVirtualJoystick(dx: number, dy: number, active: boolean): void {
    this.joystickActive = active;
    this.joystickDx = dx;
    this.joystickDy = dy;
    if (active) {
      soundFX.unlock();
    }
  }

  public setAltitudeControl(vzRatio: number): void {
    this.altitudeTouchInput = Math.max(-1, Math.min(1, vzRatio));
    if (Math.abs(vzRatio) > 0.05) {
      soundFX.unlock();
    }
  }

  public setManualFireHeld(held: boolean): void {
    this.manualFireHeld = held;
    if (held) {
      soundFX.unlock();
    }
  }

  public getFlightSettings(): FlightControlSettings {
    return { ...this.flightSettings };
  }

  public setFlightSettings(settings: FlightControlSettings): void {
    this.flightSettings = { ...settings };
    saveFlightControlSettings(this.flightSettings);
    void idbSet(FLIGHT_SETTINGS_STORAGE_KEY, this.flightSettings);
    this.pushHudSnapshot();
  }

  public toggleAutoFire(): boolean {
    this.flightSettings = {
      ...this.flightSettings,
      autoFire: !this.flightSettings.autoFire,
    };
    saveFlightControlSettings(this.flightSettings);
    void idbSet(FLIGHT_SETTINGS_STORAGE_KEY, this.flightSettings);
    this.pushHudSnapshot();
    return this.flightSettings.autoFire;
  }

  public triggerDash(): boolean {
    if (this.gameState !== 'playing' || this.isDyingSequence) return false;
    soundFX.unlock();
    this.dashBufferTimer = 0.18;
    return true;
  }

  public selectRogueDraft(perkId: RogueDraftId): void {
    this.roguePerks[perkId] = (this.roguePerks[perkId] ?? 0) + 1;
    this.draftPending = false;
    soundFX.playUpgradeBuy();
    this.spawnLabel(
      this.playerX,
      this.playerY - 28,
      `DRAFTED: ${perkId.replace('_', ' ').toUpperCase()}`,
      '#a3ff12',
    );
    this.pushHudSnapshot();
  }

  public triggerSquadronLink(dockGunship = true): boolean {
    if (
      this.gameState !== 'playing' ||
      this.isDyingSequence ||
      !this.coopActive ||
      this.teammateDowned ||
      this.playerDowned ||
      this.squadronLinkActiveTimer > 0 ||
      this.squadronLinkCooldownTimer > 0
    ) {
      return false;
    }

    soundFX.unlock();
    soundFX.playSquadronLink(dockGunship);
    const bonusDuration = this.roguePerks.tether_overdrive * 2.5;
    this.squadronLinkActiveTimer = SQUADRON_LINK_DURATION + bonusDuration;
    this.squadronFusionDocked = dockGunship;
    this.squadronLinkEnergy = 100;
    this.playerInvuln = Math.max(this.playerInvuln, 0.8);

    this.emitParticles(this.playerX, this.playerY, '#00f5d4', 24, 240, 0.42, false);
    this.emitParticles(this.teammateX, this.teammateY, '#c084fc', 24, 240, 0.42, true);
    this.spawnLabel(
      this.playerX,
      this.playerY - 36,
      dockGunship ? 'TWIN-CORE GUNSHIP FUSION!' : 'SQUADRON PLASMA TETHER!',
      '#00f5d4',
    );

    coopSession.sendPacket({
      type: 'trigger_link',
      roomCode: this.coopRoomCode,
      senderRole: this.coopRole,
      docked: dockGunship,
    });

    this.pushHudSnapshot();
    return true;
  }

  public sendTacticalPing(kind: TacticalPingKind, fromRemote = false): void {
    if (this.gameState !== 'playing') return;
    soundFX.unlock();
    soundFX.playTacticalPing(kind);

    const text =
      kind === 'focus_core'
        ? 'FOCUS CORE & WEAK POINTS!'
        : kind === 'link_up'
          ? 'SQUADRON LINK UP!'
          : 'NEED SHIELD ASSIST!';

    const sender = fromRemote ? this.teammateCallsign : 'TOMMY';
    this.activePing = {
      sender,
      kind,
      text,
      timer: 3.2,
    };

    this.spawnLabel(
      this.playerX,
      this.playerY - 40,
      `[${sender}] ${text}`,
      kind === 'focus_core' ? '#ff007f' : kind === 'link_up' ? '#00f5d4' : '#a3ff12',
    );

    if (kind === 'focus_core') {
      this.focusCoreBuffTimer = 5.5;
    } else if (kind === 'link_up' && this.coopActive) {
      if (this.squadronLinkCooldownTimer <= 0 && this.squadronLinkActiveTimer <= 0) {
        this.triggerSquadronLink(true);
      }
    } else if (kind === 'need_shield' && this.coopActive && !this.teammateDowned) {
      const stats = computePlayerStats(this.upgrades, this.hangarLevels);
      this.playerShield = Math.min(
        Math.max(30, stats.maxShield),
        this.playerShield + 25,
      );
      this.emitParticles(this.playerX, this.playerY, '#a3ff12', 14, 180, 0.3, false);
    }

    if (!fromRemote && this.coopActive) {
      coopSession.sendPacket({
        type: 'tactical_ping',
        roomCode: this.coopRoomCode,
        senderRole: this.coopRole,
        ping: { sender, kind, text },
      });
    }
    this.pushHudSnapshot();
  }

  private handleCoopPacket(packet: CoopTelemetryPacket): void {
    if (!this.coopActive) return;
    if (packet.type === 'pilot_state' && packet.state) {
      const s = packet.state;
      this.teammateX = s.x;
      this.teammateY = s.y;
      this.teammateVx = s.vx;
      this.teammateVy = s.vy;
      this.teammateAngle = s.angle;
      this.teammateHp = s.hp;
      this.teammateMaxHp = s.maxHp;
      this.teammateShield = s.shield;
      this.teammateMaxShield = s.maxShield;
      this.teammateDowned = s.downed;
      this.teammateSkin = s.skin;
      this.teammateWeapon = s.weapon;
      this.teammateCallsign = s.callsign;
    } else if (packet.type === 'tactical_ping' && packet.ping) {
      this.sendTacticalPing(packet.ping.kind, true);
    } else if (packet.type === 'trigger_link') {
      if (this.squadronLinkActiveTimer <= 0) {
        this.squadronLinkCooldownTimer = 0;
        this.triggerSquadronLink(Boolean(packet.docked));
      }
    }
  }

  private recordAchievementProgress(delta: AchievementDelta): void {
    const res = applyAchievementDelta(this.achievementState, delta);
    this.achievementState = res.nextState;
    saveAchievementState(this.achievementState);
    if (res.newlyUnlocked.length > 0) {
      soundFX.playAchievement();
    }
    this.callbacks.onAchievementUpdate?.(this.achievementState, res.newlyUnlocked);
  }

  private initPools(): void {
    this.bullets = Array.from({ length: BULLET_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 10,
      life: 0,
      fromEnemy: false,
      color: '#00f5d4',
      homing: false,
      grazed: false,
    }));

    this.orbs = Array.from({ length: ORB_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      value: 1,
      life: 0,
      pulse: 0,
    }));

    this.particles = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      life: 0,
      maxLife: 1,
      color: '#00f5d4',
      square: false,
    }));

    this.labels = Array.from({ length: LABEL_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: 0,
      text: '',
      color: '#ffffff',
      life: 0,
      maxLife: 0.7,
    }));

    this.afterimages = Array.from({ length: AFTERIMAGE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      life: 0,
      maxLife: 0.2,
    }));
  }

  private initAmbientMotes(): void {
    const palette = ['#00f5d4', '#ff007f', '#a3ff12', '#38bdf8'];
    this.bgMotes = Array.from({ length: 48 }, (_, i) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 26,
      vy: (Math.random() - 0.5) * 26,
      size: 1.4 + (i % 3) * 0.9,
      color: palette[i % palette.length],
      alpha: 0.16 + (i % 4) * 0.08,
    }));
  }

  private setupResizeObserver(): void {
    const updateSize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const nextW = Math.max(280, Math.round(rect.width || window.innerWidth));
      const nextH = Math.max(200, Math.round(rect.height || window.innerHeight));
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = nextW;
      this.height = nextH;
      this.canvas.width = Math.round(nextW * this.dpr);
      this.canvas.height = Math.round(nextH * this.dpr);
      this.renderer3d.resize(nextW, nextH, this.dpr);

      this.playerX = Math.max(
        this.playerRadius + 8,
        Math.min(this.width - this.playerRadius - 8, this.playerX),
      );
      this.playerY = Math.max(
        this.playerRadius + 8,
        Math.min(this.height - this.playerRadius - 8, this.playerY),
      );
      this.needsStaticRender = true;
    };

    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(updateSize);
      this.resizeObserver.observe(this.canvas);
    }
    window.addEventListener('resize', updateSize);
    this.cleanupResize = () => {
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }

  private cleanupResize: () => void = () => {};
  private cleanupInputs: () => void = () => {};

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: this.width / 2, y: this.height / 2 };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * this.width,
      y: ((clientY - rect.top) / rect.height) * this.height,
    };
  }

  private bindInputListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[data-block-hotkeys="true"]')) {
        return;
      }

      soundFX.unlock();
      const code = e.code;
      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        if (this.gameState === 'playing' || this.gameState === 'title') {
          e.preventDefault();
        }
      }

      if (this.gameState === 'playing') {
        this.keysHeld.add(code);
        if (e.repeat) return;

        if (code === 'KeyM') {
          soundFX.toggleMute();
          this.pushHudSnapshot();
          return;
        }
        if (code === 'Escape' || code === 'KeyP') {
          this.pauseGame();
          return;
        }
        // Tactical Shield: [C] or Right-Click or HUD button (leaving [S] free for 100% manual Back/Reverse movement!)
        if (code === 'KeyC') {
          this.activateTacticalShield();
          return;
        }
        // Barrel-Roll Dash: [X] or [V] (or Space/Shift when altitude keys are Q/E or R/F)
        if (
          code === 'KeyX' ||
          code === 'KeyV' ||
          (this.flightSettings.altitudeKeys !== 'space_shift' &&
            (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight'))
        ) {
          this.dashBufferTimer = 0.16;
          return;
        }
        // Polly Partner Assist: [Q] (when Q/E is not mapped to Up/Down altitude) or [Tab]
        if (
          code === 'Tab' ||
          (this.flightSettings.altitudeKeys !== 'q_e' && code === 'KeyQ')
        ) {
          e.preventDefault();
          this.triggerPollyAssist(false);
          return;
        }
        // EMP Emergency Bomb: [E] (when Q/E is not mapped to Up/Down altitude) or [KeyB]
        if (
          code === 'KeyB' ||
          (this.flightSettings.altitudeKeys !== 'q_e' && code === 'KeyE')
        ) {
          this.triggerEmp();
          return;
        }
        if (code === 'KeyG' || (this.coopRole !== 'dual_local' && code === 'KeyL')) {
          this.triggerSquadronLink(true);
          return;
        }
        if (code === 'Digit1') {
          this.sendTacticalPing('focus_core');
          return;
        }
        if (code === 'Digit2') {
          this.sendTacticalPing('link_up');
          return;
        }
        if (code === 'Digit3') {
          this.sendTacticalPing('need_shield');
          return;
        }
        return;
      }

      if (e.repeat) return;

      if (code === 'KeyM') {
        soundFX.toggleMute();
        this.pushHudSnapshot();
        return;
      }

      if (this.gameState === 'title') {
        if (document.querySelector('[role="dialog"]')) return;
        if (code === 'Enter' || code === 'Space') {
          this.startNewGame(true);
        }
        return;
      }

      if (this.gameState === 'paused') {
        if (code === 'Escape' || code === 'KeyP') {
          this.resumeGame();
        } else if (code === 'KeyR') {
          this.startNewGame(true);
        }
        return;
      }

      if (this.gameState === 'episode_clear') {
        if (code === 'Digit1') this.buyUpgrade('speed');
        else if (code === 'Digit2') this.buyUpgrade('multishot');
        else if (code === 'Digit3') this.buyUpgrade('shield');
        else if (code === 'Digit4') this.buyUpgrade('magnet');
        else if (code === 'Enter' || code === 'Space') this.continueNextEpisode();
        return;
      }

      if (this.gameState === 'chapter_victory') {
        if (code === 'Enter' || code === 'Space') this.advanceToNextChapter();
        return;
      }

      if (this.gameState === 'gameover') {
        if (code === 'Enter' || code === 'Space' || code === 'KeyR') {
          if (this.episode === EPISODES_PER_CHAPTER) {
            this.retryChapterFromEpisode1(this.chapter);
          } else {
            this.startNewGame(true);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.target !== this.canvas) return;
      soundFX.unlock();
      const pt = this.screenToWorld(e.clientX, e.clientY);
      this.pointerHoverX = pt.x;
      this.pointerHoverY = pt.y;
      if (e.button === 2) {
        if (this.gameState === 'playing') {
          this.activateTacticalShield();
        }
        return;
      }
      if (this.activePointerId === null || e.pointerType !== 'touch') {
        this.activePointerId = e.pointerId;
        this.pointerWorldX = pt.x;
        this.pointerWorldY = pt.y;
        this.pointerActive = true;
        try {
          this.canvas.setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore unsupported synthetic pointer capture
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const pt = this.screenToWorld(e.clientX, e.clientY);
      if (this.activePointerId === null) {
        this.pointerHoverX = pt.x;
        this.pointerHoverY = pt.y;
      }
      if (
        this.pointerActive &&
        (this.activePointerId === null || e.pointerId === this.activePointerId)
      ) {
        this.pointerWorldX = pt.x;
        this.pointerWorldY = pt.y;
        this.pointerHoverX = pt.x;
        this.pointerHoverY = pt.y;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.activePointerId === null || e.pointerId === this.activePointerId) {
        this.pointerActive = false;
        this.activePointerId = null;
        try {
          if (this.canvas.hasPointerCapture?.(e.pointerId)) {
            this.canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === this.canvas) {
        e.preventDefault();
      }
    };

    const clearInputs = () => {
      this.keysHeld.clear();
      this.pointerActive = false;
      this.activePointerId = null;
      this.joystickActive = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.canvas.addEventListener('contextmenu', onContextMenu);

    this.cleanupInputs = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = clampDeltaTime(rawDt);

      // Automatic FPS Quality Scaler
      this.frameTimeAccumulator += rawDt;
      this.frameSampleCount += 1;
      if (this.frameSampleCount >= 45) {
        const avgMs = (this.frameTimeAccumulator / this.frameSampleCount) * 1000;
        if (avgMs > 24 && this.fpsQuality === 'high') {
          this.fpsQuality = 'medium';
        } else if (avgMs > 28 && this.fpsQuality === 'medium') {
          this.fpsQuality = 'performance';
        } else if (avgMs < 17.5 && this.fpsQuality !== 'high') {
          this.fpsQuality = 'high';
        }
        this.frameTimeAccumulator = 0;
        this.frameSampleCount = 0;
      }

      if (!this.overlayOpen && (this.gameState === 'title' || this.gameState === 'playing')) {
        this.update(dt);
        this.render();
      } else if (this.needsStaticRender) {
        this.needsStaticRender = false;
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public setOverlayOpen(open: boolean): void {
    this.overlayOpen = open;
    if (!open) {
      this.needsStaticRender = true;
    }
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    soundFX.stopMusic();
    this.renderer3d.dispose();
    this.cleanupResize();
    this.cleanupInputs();
  }

  private syncBodyState(state: GameState): void {
    this.gameState = state;
    this.needsStaticRender = true;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = state;
    }
    if (state === 'title') {
      soundFX.setMusicIntensity('title');
    } else if (state === 'playing') {
      soundFX.setMusicIntensity('skirmish');
    }
    this.callbacks.onStateChange(state);
  }

  public startNewGame(
    fromUserGesture = false,
    startChapter = this.configuredStartChapter,
    startEpisode = this.configuredStartEpisode,
    mode: GameMode = 'campaign',
    weapon: WeaponType = 'spread',
    skin: ShipSkin = 'cyan',
    coopOptions?: CoopStartOptions,
  ): void {
    if (fromUserGesture) {
      soundFX.unlock();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.pointerActive = false;
    this.joystickActive = false;

    this.mode = mode;
    this.selectedWeapon = weapon;
    this.selectedShipSkin = skin;
    this.dailyChallenge = getDailyChallenge();
    this.survivalWaveTimer = 40;
    this.chapter = Math.max(1, startChapter);
    this.episode = Math.max(1, Math.min(EPISODES_PER_CHAPTER, startEpisode));
    this.chaptersCleared = Math.max(0, this.chapter - 1);
    this.upgrades =
      this.chapter > 1 || this.episode === EPISODES_PER_CHAPTER
        ? createChapterStarterUpgrades(this.chapter)
        : createInitialUpgrades();
    this.hangarLevels = loadHangarState().levels;
    this.roguePerks = createInitialRoguePerks();
    this.draftPending = false;
    this.draftChoices = [];

    const stats = computePlayerStats(this.upgrades, this.hangarLevels);

    this.playerX = this.width * 0.5;
    this.playerY = this.height * 0.5;
    this.playerZ = 0;
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerVz = 0;
    this.altitudeTouchInput = 0;
    this.manualFireHeld = false;
    this.playerAngle = -Math.PI / 2;
    this.playerHp =
      this.configuredStartHp !== null
        ? Math.min(stats.maxHp, this.configuredStartHp)
        : Math.max(
            1,
            Math.round(
              stats.maxHp *
                (mode === 'daily' ? this.dailyChallenge.healthMultiplier : 1),
            ),
          );
    this.playerShield = this.configuredStartHp !== null ? 0 : stats.maxShield;
    this.shieldRegenTimer = 0;
    this.playerInvuln = 1.2;
    this.playerHitFlash = 0;
    this.playerScaleX = 1;
    this.playerScaleY = 1;
    this.playerDowned = false;
    this.playerReviveProgress = 0;

    this.fireTimer = 0.1;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashBufferTimer = 0;

    this.tacticalShieldActiveTimer = 0;
    this.tacticalShieldCooldownTimer = 0;
    this.tacticalShieldPulse = 0;

    this.pollyX = this.playerX + 70;
    this.pollyY = this.playerY - 50;
    this.pollyActiveTimer = 0;
    this.pollyCooldownTimer = 0;
    this.pollyFireTimer = 0;
    this.pollyBeamFlashTimer = 0;
    this.pollyInterceptTimer = 0;
    this.bossFightElapsed = 0;
    this.episodeDamaged = false;

    this.twinPollyX = this.playerX - 70;
    this.twinPollyY = this.playerY - 50;
    this.twinPollyFireTimer = 0.25;

    // Co-op Squadron initialization
    if (coopOptions?.enabled) {
      this.coopActive = true;
      this.coopRole = coopOptions.role;
      this.coopRoomCode = coopOptions.roomCode;
      this.teammateCallsign = coopOptions.partner.callsign || 'NOVA-2';
      this.teammateSkin = coopOptions.partner.skin || 'violet';
      this.teammateWeapon = coopOptions.partner.weapon || 'homing';
      this.teammateX = this.playerX - 85;
      this.teammateY = this.playerY + 45;
      this.teammateVx = 0;
      this.teammateVy = 0;
      this.teammateMaxHp = stats.maxHp;
      this.teammateHp = stats.maxHp;
      this.teammateMaxShield = Math.max(30, stats.maxShield);
      this.teammateShield = this.teammateMaxShield;
      this.teammateDowned = false;
      this.teammateReviveProgress = 0;
    } else {
      this.coopActive = false;
      this.coopRole = 'solo';
    }

    this.squadronLinkEnergy = 100;
    this.squadronLinkActiveTimer = 0;
    this.squadronFusionDocked = false;
    this.squadronLinkCooldownTimer = 0;
    this.activePing = null;
    this.focusCoreBuffTimer = 0;
    this.grazeCount = 0;
    this.grazeSlowMoTimer = 0;
    this.lightningArcs = [];

    this.score = 0;
    this.highScore = loadHighScore();
    this.initialHighScore = this.highScore;
    this.totalSurvivalSeconds = 0;
    this.shards = 0;
    this.totalShardsCollected = 0;
    this.enemiesDefeated = 0;
    this.bossesDefeated = 0;
    this.lastDefeatBossName = undefined;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.empCooldownTimer = 0;
    this.empWaveActive = false;
    this.empWaveAlpha = 0;

    this.hitstopTimer = 0;
    this.trauma = 0;
    this.isDyingSequence = false;
    this.deathDelayTimer = 0;

    this.setupEpisode(this.chapter, this.episode, true);
    this.syncBodyState('playing');
    this.pushHudSnapshot();
  }

  public retryChapterFromEpisode1(targetChapter = this.chapter): void {
    soundFX.unlock();
    this.configuredStartHp = null;
    this.startNewGame(
      true,
      Math.max(1, targetChapter),
      1,
      this.mode,
      this.selectedWeapon,
      this.selectedShipSkin,
      this.coopActive
        ? {
            enabled: true,
            role: this.coopRole,
            roomCode: this.coopRoomCode,
            partner: {
              callsign: this.teammateCallsign,
              skin: this.teammateSkin,
              weapon: this.teammateWeapon,
              ready: true,
            },
          }
        : undefined,
    );
  }

  private setupEpisode(
    chapter: number,
    episode: number,
    seedOrbs: boolean,
  ): void {
    const epCfg = computeEpisodeConfig(
      chapter,
      episode,
      this.configuredEpisodeDuration,
    );
    this.chapter = epCfg.chapter;
    this.episode = epCfg.episode;
    this.episodeDuration = epCfg.durationSeconds;
    this.episodeTimeRemaining = epCfg.durationSeconds;
    this.enemySpawnTimer = 0.9;
    this.ambientOrbTimer = 2.6;
    this.hazardTimer = 7;
    this.hazards = [];
    this.lightningArcs = [];
    this.bossBannerTimer = 0;
    this.pollyBannerTimer = 0;
    this.bossFightElapsed = 0;
    this.episodeDamaged = false;

    this.enemies = [];
    for (const b of this.bullets) b.active = false;
    for (const o of this.orbs) o.active = false;
    for (const p of this.particles) p.active = false;
    for (const l of this.labels) l.active = false;
    for (const a of this.afterimages) a.active = false;

    if (seedOrbs) {
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + 0.4;
        this.spawnOrb(
          this.playerX + Math.cos(ang) * 145,
          this.playerY + Math.sin(ang) * 145,
          2,
        );
      }
    }

    this.recordAchievementProgress({ chapterReached: this.chapter });

    if (epCfg.isBossEpisode) {
      this.spawnChapterBoss(this.chapter);
      soundFX.setMusicIntensity('boss');
    } else if (epCfg.shouldSpawnSubBoss) {
      this.spawnSubBoss();
      soundFX.setMusicIntensity('boss');
    } else {
      this.bossBannerTimer = 2.0;
      this.bossBannerText = this.coopActive
        ? `CO-OP OVERDRIVE · CH ${this.chapter} · EP ${this.episode}/${EPISODES_PER_CHAPTER}`
        : `CHAPTER ${this.chapter} · EPISODE ${this.episode}/${EPISODES_PER_CHAPTER}`;
      soundFX.setMusicIntensity('skirmish');
    }
  }

  public pauseGame(): void {
    if (this.gameState !== 'playing' || this.isDyingSequence) return;
    this.keysHeld.clear();
    this.pointerActive = false;
    this.joystickActive = false;
    this.syncBodyState('paused');
    this.pushHudSnapshot();
  }

  public resumeGame(): void {
    if (this.gameState !== 'paused') return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.pointerActive = false;
    this.syncBodyState('playing');
    this.pushHudSnapshot();
  }

  public returnToTitle(): void {
    this.keysHeld.clear();
    this.pointerActive = false;
    this.joystickActive = false;
    this.enemies = [];
    for (const b of this.bullets) b.active = false;
    for (const o of this.orbs) o.active = false;
    this.syncBodyState('title');
    this.pushHudSnapshot();
  }

  public toggleMute(): boolean {
    const next = soundFX.toggleMute();
    this.pushHudSnapshot();
    return next;
  }

  public buyUpgrade(id: UpgradeId): boolean {
    if (this.gameState !== 'episode_clear') return false;
    const res = applyUpgradePurchase(id, this.upgrades, this.shards);
    if (!res.purchased) return false;

    this.upgrades = res.upgrades;
    this.shards = res.shards;
    const stats = computePlayerStats(this.upgrades, this.hangarLevels);

    if (id === 'shield') {
      this.playerHp = Math.min(stats.maxHp, this.playerHp + 35);
      this.playerShield = stats.maxShield;
    }

    soundFX.playUpgradeBuy();
    this.recordAchievementProgress({ upgradesBought: 1 });
    this.pushHudSnapshot();
    return true;
  }

  public continueNextEpisode(): void {
    if (this.gameState !== 'episode_clear') return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.pointerActive = false;
    this.draftPending = false;

    const next = advanceCampaignProgress(this.chapter, this.episode);
    this.chapter = next.nextChapter;
    this.episode = next.nextEpisode;
    this.playerInvuln = Math.max(this.playerInvuln, 1.4);

    this.setupEpisode(this.chapter, this.episode, false);
    this.syncBodyState('playing');
    this.pushHudSnapshot();
  }

  public advanceToNextChapter(): void {
    if (this.gameState !== 'chapter_victory') return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.pointerActive = false;
    this.draftPending = false;

    this.chapter += 1;
    this.episode = 1;
    const stats = computePlayerStats(this.upgrades, this.hangarLevels);
    this.playerHp = stats.maxHp;
    this.playerShield = stats.maxShield;
    this.playerInvuln = 1.6;
    this.tacticalShieldCooldownTimer = 0;
    this.pollyCooldownTimer = 0;
    if (this.coopActive) {
      this.teammateHp = this.teammateMaxHp;
      this.teammateShield = this.teammateMaxShield;
      this.teammateDowned = false;
    }

    this.setupEpisode(this.chapter, 1, true);
    this.syncBodyState('playing');
    this.pushHudSnapshot();
  }

  public activateTacticalShield(): boolean {
    if (
      this.gameState !== 'playing' ||
      this.isDyingSequence ||
      this.tacticalShieldActiveTimer > 0 ||
      this.tacticalShieldCooldownTimer > 0
    ) {
      return false;
    }

    soundFX.unlock();
    soundFX.playShieldActivate();
    this.tacticalShieldActiveTimer = TACTICAL_SHIELD_DURATION;
    this.tacticalShieldPulse = 1;
    this.emitParticles(this.playerX, this.playerY, '#00f5d4', 18, 200, 0.35, false);
    this.spawnLabel(this.playerX, this.playerY - 24, 'AEGIS SHIELD ON', '#00f5d4');
    this.pushHudSnapshot();
    return true;
  }

  public triggerPollyAssist(autoTriggered = false): boolean {
    if (
      this.gameState !== 'playing' ||
      this.isDyingSequence ||
      this.pollyActiveTimer > 0 ||
      this.pollyCooldownTimer > 0
    ) {
      return false;
    }

    if (!autoTriggered) {
      soundFX.unlock();
    }
    soundFX.playPollyAssist();
    this.pollyActiveTimer = POLLY_ASSIST_DURATION;
    this.pollyFireTimer = 0.08;
    this.pollyOrbitPhase = 0;
    this.pollyX = this.playerX - 180;
    this.pollyY = Math.max(40, this.playerY - 140);
    this.pollyBannerTimer = 2.4;

    this.emitParticles(this.pollyX, this.pollyY, '#a3ff12', 18, 220, 0.38, true);
    this.spawnLabel(
      this.playerX,
      this.playerY - 34,
      autoTriggered ? 'POLLY INTERCEPT!' : 'POLLY SALVO!',
      '#a3ff12',
    );
    this.pushHudSnapshot();
    return true;
  }

  private spawnSubBoss(): void {
    const edge = Math.floor(Math.random() * 4);
    const pad = 42;
    let x = this.width * 0.5;
    let y = -pad;
    if (edge === 1) {
      x = this.width + pad;
      y = this.height * 0.5;
    } else if (edge === 2) {
      x = this.width * 0.5;
      y = this.height + pad;
    } else if (edge === 3) {
      x = -pad;
      y = this.height * 0.5;
    }

    const epCfg = computeEpisodeConfig(this.chapter, this.episode);
    const coopScale = computeCoopScaling(this.coopActive);
    const dailyEnemyHealth =
      this.mode === 'daily' ? this.dailyChallenge.enemyHealthMultiplier : 1;
    const dailyEnemySpeed =
      this.mode === 'daily' ? this.dailyChallenge.speedMultiplier : 1;
    const bossHp = Math.round(
      (340 * epCfg.hpMultiplier + this.episode * 75) *
        dailyEnemyHealth *
        coopScale.bossHpMult,
    );

    const subBoss: Enemy = {
      id: this.nextEnemyId++,
      kind: 'boss',
      isChapterBoss: false,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 36,
      hp: bossHp,
      maxHp: bossHp,
      speed: 82 * (1 + (this.chapter - 1) * 0.14) * dailyEnemySpeed,
      damage: 24,
      scoreValue: 550 + this.chapter * 180,
      shardValue: 9 + this.chapter * 2,
      angle: 0,
      hitFlash: 0,
      dyingTimer: 0,
      stunTimer: 0,
      state: 'approach',
      stateTimer: 2.0,
      aimAngle: 0,
      glitchTimer: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      bossTitle: `CRUISER GATEKEEPER MK-${this.chapter}.${this.episode}`,
      subsystems: createBossSubsystems(bossHp, false),
      warpInTimer: 0.7,
    };
    this.updateBossSubsystemPositions(subBoss);
    this.enemies.push(subBoss);
    this.spawnBossDataDrones(subBoss, 2);

    this.bossBannerTimer = 2.6;
    this.bossBannerText = `CAPITAL CRUISER WARP-IN · EPISODE ${this.episode}`;
    soundFX.playBossAlert();
    this.addTrauma(0.35);
  }

  private spawnChapterBoss(chapter: number): void {
    const cfg = computeChapterBossConfig(chapter);
    const coopScale = computeCoopScaling(this.coopActive);
    const scaledHp = Math.round(cfg.hp * coopScale.bossHpMult);
    const x = this.width * 0.5;
    const y = -58;

    const boss: Enemy = {
      id: this.nextEnemyId++,
      kind: 'boss',
      isChapterBoss: true,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: cfg.radius + 6,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: cfg.speed,
      damage: cfg.damage,
      scoreValue: cfg.scoreValue,
      shardValue: cfg.shardValue,
      angle: 0,
      hitFlash: 0,
      dyingTimer: 0,
      stunTimer: 0,
      state: 'approach',
      stateTimer: 1.35,
      aimAngle: Math.PI / 2,
      glitchTimer: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      bossArchetype: cfg.archetype,
      bossTitle: this.coopActive ? `ELITE ${cfg.title}` : cfg.title,
      attackPhase: 0,
      laserActiveTimer: 0,
      laserAngle: 0,
      laserSweepDir: Math.random() < 0.5 ? 1 : -1,
      laserCount: cfg.laserBeamCount,
      spiralTickTimer: 0,
      spiralTicksRemaining: 0,
      bulletSpeedMult: cfg.bulletSpeedMult,
      spiralSpokes: cfg.spiralSpokes,
      droneCount: cfg.droneCount,
      aggressionRate: cfg.aggressionRate,
      bossPhase: 0,
      subsystems: createBossSubsystems(scaledHp, true),
      warpInTimer: 0.9,
    };
    this.updateBossSubsystemPositions(boss);
    this.enemies.push(boss);
    this.spawnBossDataDrones(boss, 3);

    this.bossBannerTimer = 3.2;
    this.bossBannerText = `DREADNOUGHT WARP-IN · ${boss.bossTitle}`;
    soundFX.playBossAlert();
    this.addTrauma(0.5);
  }

  private updateBossSubsystemPositions(boss: Enemy): void {
    if (!boss.subsystems) return;
    for (const sub of boss.subsystems) {
      sub.hitFlash = Math.max(0, sub.hitFlash - 0.016);
      const ang = boss.angle + sub.offsetAngle;
      const dist = boss.radius * sub.offsetRadiusRatio;
      sub.worldX = boss.x + Math.cos(ang) * dist;
      sub.worldY = boss.y + Math.sin(ang) * dist;
    }
  }

  private spawnBossDataDrones(boss: Enemy, count: number): void {
    const activeMinions = this.enemies.filter(
      (e) => e.dyingTimer <= 0 && e.isBossMinion,
    ).length;
    const allowed = Math.max(0, 6 - activeMinions);
    const toSpawn = Math.min(allowed, count);
    if (toSpawn <= 0) return;

    const speedMult = boss.bulletSpeedMult ?? 1;
    for (let i = 0; i < toSpawn; i++) {
      const ang = boss.aimAngle + (i / toSpawn) * Math.PI * 2;
      const sx = Math.max(
        24,
        Math.min(this.width - 24, boss.x + Math.cos(ang) * (boss.radius + 26)),
      );
      const sy = Math.max(
        24,
        Math.min(this.height - 24, boss.y + Math.sin(ang) * (boss.radius + 26)),
      );
      const isInterceptor = i % 2 === 1;
      const hp = Math.round((isInterceptor ? 38 : 30) * (1 + (this.chapter - 1) * 0.25));
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: isInterceptor ? 'interceptor' : 'block',
        x: sx,
        y: sy,
        vx: Math.cos(ang) * 90,
        vy: Math.sin(ang) * 90,
        radius: isInterceptor ? 13 : 14,
        hp,
        maxHp: hp,
        speed: (isInterceptor ? 142 : 120) * Math.min(1.65, speedMult),
        damage: 16,
        scoreValue: 95,
        shardValue: 2,
        angle: ang,
        hitFlash: 0,
        dyingTimer: 0,
        stunTimer: 0,
        state: 'approach',
        stateTimer: 1.0,
        aimAngle: ang,
        glitchTimer: 0.9,
        orbitDir: Math.random() < 0.5 ? 1 : -1,
        isBossMinion: true,
      });
      this.emitParticles(sx, sy, '#a3ff12', 8, 140, 0.25, true);
    }
  }

  private update(dt: number): void {
    this.titleTime += dt;

    for (const m of this.bgMotes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 0) m.x += this.width;
      if (m.x > this.width) m.x -= this.width;
      if (m.y < 0) m.y += this.height;
      if (m.y > this.height) m.y -= this.height;
    }

    if (this.gameState === 'title') {
      const targetX = this.width * 0.67 + Math.cos(this.titleTime * 0.7) * 26;
      const targetY = this.height * 0.48 + Math.sin(this.titleTime * 1.1) * 18;
      this.playerX += (targetX - this.playerX) * Math.min(1, dt * 4);
      this.playerY += (targetY - this.playerY) * Math.min(1, dt * 4);
      this.playerAngle =
        Math.atan2(
          this.pointerHoverY - this.playerY,
          this.pointerHoverX - this.playerX,
        ) || -Math.PI / 2;

      const pollyTargetX = this.playerX + Math.cos(this.titleTime * 1.35) * 86;
      const pollyTargetY = this.playerY + Math.sin(this.titleTime * 1.35) * 64;
      this.pollyX += (pollyTargetX - this.pollyX) * Math.min(1, dt * 5);
      this.pollyY += (pollyTargetY - this.pollyY) * Math.min(1, dt * 5);
      this.pollyAngle = this.playerAngle;
      return;
    }

    if (this.gameState !== 'playing') {
      return;
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.playerHitFlash = Math.max(0, this.playerHitFlash - dt);
    this.bossBannerTimer = Math.max(0, this.bossBannerTimer - dt);
    this.pollyBannerTimer = Math.max(0, this.pollyBannerTimer - dt);
    this.pollyBeamFlashTimer = Math.max(0, this.pollyBeamFlashTimer - dt);
    this.tacticalShieldPulse = Math.max(0, this.tacticalShieldPulse - dt * 2.5);
    this.focusCoreBuffTimer = Math.max(0, this.focusCoreBuffTimer - dt);
    this.grazeSlowMoTimer = Math.max(0, this.grazeSlowMoTimer - dt);

    if (this.activePing) {
      this.activePing.timer -= dt;
      if (this.activePing.timer <= 0) {
        this.activePing = null;
      }
    }

    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }

    this.updateParticles(dt);
    this.updateLabels(dt);
    this.updateAfterimages(dt);

    if (this.empWaveActive) {
      this.empWaveRadius += 1900 * dt;
      this.empWaveAlpha = Math.max(0, 1 - this.empWaveRadius / this.empWaveMaxRadius);
      if (this.empWaveRadius >= this.empWaveMaxRadius) {
        this.empWaveActive = false;
      }
    }

    if (this.isDyingSequence) {
      this.deathDelayTimer -= dt;
      if (this.deathDelayTimer <= 0) {
        this.finalizeGameOver();
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    const stats = computePlayerStats(this.upgrades, this.hangarLevels);
    const haste = stats.cooldownHaste ?? 1;

    // Kinetic Slow-Mo Focus factor for enemy bullets & enemies when Grazing
    const worldDt = this.grazeSlowMoTimer > 0 ? dt * 0.52 : dt;

    // Cooldowns & combo decay
    this.empCooldownTimer = Math.max(0, this.empCooldownTimer - dt * haste);
    if (this.tacticalShieldActiveTimer > 0) {
      this.tacticalShieldActiveTimer -= dt;
      if (this.tacticalShieldActiveTimer <= 0) {
        this.tacticalShieldActiveTimer = 0;
        this.tacticalShieldCooldownTimer = TACTICAL_SHIELD_COOLDOWN / haste;
      }
    } else {
      this.tacticalShieldCooldownTimer = Math.max(
        0,
        this.tacticalShieldCooldownTimer - dt * haste,
      );
    }

    // Squadron Link & Twin-Core Heavy Gunship Fusion Timer
    if (this.squadronLinkActiveTimer > 0) {
      this.squadronLinkActiveTimer -= dt;
      this.squadronLinkEnergy = Math.max(
        0,
        (this.squadronLinkActiveTimer /
          (SQUADRON_LINK_DURATION + this.roguePerks.tether_overdrive * 2.5)) *
          100,
      );
      soundFX.setMusicIntensity('fusion');
      if (this.squadronLinkActiveTimer <= 0) {
        this.squadronLinkActiveTimer = 0;
        this.squadronFusionDocked = false;
        this.squadronLinkCooldownTimer = SQUADRON_LINK_COOLDOWN / haste;
        const hasBoss = this.enemies.some((e) => e.kind === 'boss' && e.dyingTimer <= 0);
        soundFX.setMusicIntensity(hasBoss ? 'boss' : 'skirmish');
      }
    } else {
      this.squadronLinkCooldownTimer = Math.max(
        0,
        this.squadronLinkCooldownTimer - dt * haste,
      );
      this.squadronLinkEnergy =
        this.squadronLinkCooldownTimer <= 0
          ? 100
          : Math.round(
              (1 - this.squadronLinkCooldownTimer / (SQUADRON_LINK_COOLDOWN / haste)) *
                100,
            );
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }

    this.totalSurvivalSeconds += dt;
    const epCfg = computeEpisodeConfig(
      this.chapter,
      this.episode,
      this.configuredEpisodeDuration,
    );
    const coopScale = computeCoopScaling(this.coopActive);
    const endlessMode = this.mode !== 'campaign';

    if (endlessMode) {
      this.survivalWaveTimer -= dt;
      if (this.survivalWaveTimer <= 0) {
        this.survivalWaveTimer = 40;
        this.episode += 1;
        if (this.episode > EPISODES_PER_CHAPTER) {
          this.chapter += 1;
          this.episode = 1;
        }
        if (this.episode % 5 === 0) {
          this.spawnSubBoss();
          this.spawnLabel(this.width / 2, 60, `SURVIVAL WAVE ${this.episode}`, '#ff007f');
        }
      }
    } else if (!epCfg.isBossEpisode) {
      this.episodeTimeRemaining -= dt;
      if (this.episodeTimeRemaining <= 0) {
        this.episodeTimeRemaining = 0;
        this.triggerEpisodeClear();
        return;
      }
    } else if (!endlessMode) {
      this.bossFightElapsed += dt;
    }

    // Update Tommy & Co-op Teammate
    this.updatePlayer(dt, stats);
    this.updateCoopTeammate(dt, stats);
    this.updateHazards(worldDt);

    // Auto-fire or Manual-fire Tommy's lasers (and fused dual-core guns when docked!)
    const manualTrigger =
      this.manualFireHeld ||
      this.keysHeld.has('KeyJ') ||
      this.keysHeld.has('ControlLeft') ||
      this.keysHeld.has('ControlRight') ||
      this.keysHeld.has('Enter') ||
      (this.pointerActive && this.flightSettings.touchMode === 'dual_stick');

    if (!this.playerDowned && (this.flightSettings.autoFire || manualTrigger)) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.firePlayerLasers(stats, manualTrigger);
        this.fireTimer =
          stats.fireInterval *
          (this.selectedWeapon === 'plasma'
            ? 1.65
            : this.selectedWeapon === 'laser'
              ? 0.8
              : 1);
      }
    }

    // Spawn tactical skirmish enemies in Episodes 1-9
    if (endlessMode || !epCfg.isBossEpisode) {
      this.enemySpawnTimer -= worldDt;
      const maxActive = epCfg.maxActiveEnemies + coopScale.maxEnemiesBonus;
      if (this.enemySpawnTimer <= 0 && this.enemies.length < maxActive) {
        const spawnConfig = {
          ...epCfg,
          speedMultiplier:
            epCfg.speedMultiplier *
            (this.mode === 'daily' ? this.dailyChallenge.speedMultiplier : 1),
          hpMultiplier:
            epCfg.hpMultiplier *
            coopScale.enemyHpMult *
            (this.mode === 'daily' ? this.dailyChallenge.enemyHealthMultiplier : 1),
        };
        this.spawnEpisodeEnemy(spawnConfig);
        this.enemySpawnTimer =
          epCfg.spawnInterval *
          coopScale.spawnIntervalMult *
          (0.85 + Math.random() * 0.3);
      }
    }

    // Ambient Data Shards
    this.ambientOrbTimer -= dt;
    if (this.ambientOrbTimer <= 0) {
      this.ambientOrbTimer = !endlessMode && epCfg.isBossEpisode ? 6.0 : 5.0;
      const margin = 70;
      const ox = margin + Math.random() * Math.max(40, this.width - margin * 2);
      const oy = margin + Math.random() * Math.max(40, this.height - margin * 2);
      this.spawnOrb(ox, oy, 1 + Math.floor((this.chapter + this.episode) / 4));
    }

    // Polly Partner Assist + Twin Polly Drone update
    this.updatePollyPartner(dt, !endlessMode && epCfg.isBossEpisode);

    this.updateEnemies(
      worldDt,
      epCfg.speedMultiplier *
        (this.mode === 'daily' ? this.dailyChallenge.speedMultiplier : 1),
    );
    this.updateBullets(worldDt, dt);
    this.updateOrbs(dt, stats);

    // Throttled HUD update
    this.hudSyncTimer -= dt;
    if (this.hudSyncTimer <= 0) {
      this.hudSyncTimer = 0.08;
      this.pushHudSnapshot();
    }
  }

  private updateCoopTeammate(
    dt: number,
    stats: ReturnType<typeof computePlayerStats>,
  ): void {
    if (!this.coopActive) return;

    // Broadcast Tommy's telemetry to remote P2P partner
    this.teammateNetSyncTimer -= dt;
    if (this.teammateNetSyncTimer <= 0) {
      this.teammateNetSyncTimer = 0.05;
      coopSession.sendPacket({
        type: 'pilot_state',
        roomCode: this.coopRoomCode,
        senderRole: this.coopRole,
        state: {
          x: this.playerX,
          y: this.playerY,
          vx: this.playerVx,
          vy: this.playerVy,
          angle: this.playerAngle,
          hp: this.playerHp,
          maxHp: stats.maxHp,
          shield: this.playerShield,
          maxShield: stats.maxShield,
          downed: this.playerDowned,
          firing: true,
          skin: this.selectedShipSkin,
          weapon: this.selectedWeapon,
          callsign: 'TOMMY',
        },
      });
    }

    // Handle Revival Beacons between Tommy and Teammate
    if (this.teammateDowned && !this.playerDowned) {
      const dist = Math.hypot(this.playerX - this.teammateX, this.playerY - this.teammateY);
      if (dist <= 115) {
        this.teammateReviveProgress = Math.min(100, this.teammateReviveProgress + dt * 46);
        if (this.teammateReviveProgress >= 100) {
          this.teammateDowned = false;
          this.teammateReviveProgress = 0;
          this.teammateHp = Math.round(this.teammateMaxHp * 0.65);
          this.teammateShield = this.teammateMaxShield;
          soundFX.playReviveComplete();
          this.emitParticles(this.teammateX, this.teammateY, '#a3ff12', 24, 220, 0.4, false);
          this.spawnLabel(
            this.teammateX,
            this.teammateY - 28,
            `${this.teammateCallsign} REVIVED!`,
            '#a3ff12',
          );
        }
      }
      return;
    }

    if (this.playerDowned && !this.teammateDowned) {
      // Teammate rushes to revive Tommy!
      const dx = this.playerX - this.teammateX;
      const dy = this.playerY - this.teammateY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 45) {
        this.teammateVx = (dx / dist) * stats.moveSpeed * 1.1;
        this.teammateVy = (dy / dist) * stats.moveSpeed * 1.1;
        this.teammateX += this.teammateVx * dt;
        this.teammateY += this.teammateVy * dt;
      }
      if (dist <= 115) {
        this.playerReviveProgress = Math.min(100, this.playerReviveProgress + dt * 48);
        if (this.playerReviveProgress >= 100) {
          this.playerDowned = false;
          this.playerReviveProgress = 0;
          this.playerHp = Math.round(stats.maxHp * 0.65);
          this.playerShield = stats.maxShield;
          this.playerInvuln = 1.8;
          soundFX.playReviveComplete();
          this.emitParticles(this.playerX, this.playerY, '#00f5d4', 26, 240, 0.45, false);
          this.spawnLabel(this.playerX, this.playerY - 28, 'TOMMY REVIVED!', '#00f5d4');
        }
      }
    }

    // If docked into Twin-Core Heavy Gunship, teammate locks onto Tommy's wing
    if (this.squadronFusionDocked) {
      this.teammateX = this.playerX;
      this.teammateY = this.playerY + 18;
      this.teammateAngle = this.playerAngle;
    } else if (this.coopRole === 'dual_local') {
      // Same-Device Dual-Control Co-op: IJKL keys control Pilot 2
      let mx = 0;
      let my = 0;
      if (this.keysHeld.has('KeyI')) my -= 1;
      if (this.keysHeld.has('KeyK')) my += 1;
      if (this.keysHeld.has('KeyJ')) mx -= 1;
      if (this.keysHeld.has('KeyL')) mx += 1;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        this.teammateVx = (mx / len) * stats.moveSpeed;
        this.teammateVy = (my / len) * stats.moveSpeed;
      } else {
        this.teammateVx *= 0.88;
        this.teammateVy *= 0.88;
      }
      this.teammateX = Math.max(
        24,
        Math.min(this.width - 24, this.teammateX + this.teammateVx * dt),
      );
      this.teammateY = Math.max(
        24,
        Math.min(this.height - 24, this.teammateY + this.teammateVy * dt),
      );
    } else if (this.coopRole === 'ai_wingman' && !this.playerDowned) {
      // Autonomous AI Squadron Wingman Formation & Combat Dodging
      const orbitAng = this.titleTime * 1.1;
      const desiredX = Math.max(
        50,
        Math.min(this.width - 50, this.playerX + Math.cos(orbitAng) * 135),
      );
      const desiredY = Math.max(
        50,
        Math.min(this.height - 50, this.playerY + Math.sin(orbitAng) * 110),
      );
      this.teammateVx = (desiredX - this.teammateX) * 3.8;
      this.teammateVy = (desiredY - this.teammateY) * 3.8;
      this.teammateX += this.teammateVx * dt;
      this.teammateY += this.teammateVy * dt;
    }

    // Teammate weapon firing
    const target = this.findHighestPriorityEnemy();
    if (target) {
      this.teammateAngle = Math.atan2(
        target.y - this.teammateY,
        target.x - this.teammateX,
      );
      this.teammateFireTimer -= dt;
      if (this.teammateFireTimer <= 0 && !this.teammateDowned) {
        this.teammateFireTimer = stats.fireInterval * 1.15;
        this.fireTeammateWeapon(target);
      }
    }

    // Passive / Active Squadron Energy Tether slicing enemies between Tommy and Teammate
    const tetherDist = Math.hypot(
      this.playerX - this.teammateX,
      this.playerY - this.teammateY,
    );
    const tetherActive =
      !this.playerDowned &&
      !this.teammateDowned &&
      !this.squadronFusionDocked &&
      (this.squadronLinkActiveTimer > 0 || tetherDist <= SQUADRON_TETHER_MAX_DIST);

    if (tetherActive) {
      this.tetherDamageTickTimer -= dt;
      if (this.tetherDamageTickTimer <= 0) {
        this.tetherDamageTickTimer = 0.14;
        const tetherDmg = Math.round(
          (this.squadronLinkActiveTimer > 0 ? 26 : 14) *
            (1 + this.roguePerks.tether_overdrive * 0.65),
        );
        for (const e of this.enemies) {
          if (e.dyingTimer > 0) continue;
          const distToBeam = this.pointToSegmentDist(
            e.x,
            e.y,
            this.playerX,
            this.playerY,
            this.teammateX,
            this.teammateY,
          );
          if (distToBeam <= e.radius + 10) {
            e.hp -= tetherDmg;
            e.hitFlash = 0.08;
            this.emitParticles(e.x, e.y, '#00f5d4', 5, 150, 0.22, false);
            if (e.hp <= 0) {
              this.handleEnemyKilled(e);
            }
          }
        }
      }
    }
  }

  private fireTeammateWeapon(target: Enemy): void {
    const aimAngle = Math.atan2(target.y - this.teammateY, target.x - this.teammateX);
    const skinCfg = getShipSkinConfig(this.teammateSkin);
    const w = this.teammateWeapon;
    const speed = w === 'plasma' ? 520 : w === 'homing' ? 580 : 740;
    const dmg = w === 'plasma' ? 28 : w === 'laser' ? 20 : 15;
    this.spawnBullet(
      this.teammateX + Math.cos(aimAngle) * 16,
      this.teammateY + Math.sin(aimAngle) * 16,
      Math.cos(aimAngle) * speed,
      Math.sin(aimAngle) * speed,
      w === 'plasma' ? 5.5 : 4,
      dmg,
      1.5,
      false,
      skinCfg.hullColor,
      w === 'homing',
    );
  }

  private updatePollyPartner(dt: number, isBossEpisode: boolean): void {
    const activeThreatCount = this.enemies.filter((e) => e.dyingTimer <= 0).length;
    const haste = computePlayerStats(this.upgrades, this.hangarLevels).cooldownHaste ?? 1;

    // Twin Polly Drone (always active once drafted via Rogue-Lite Perk!)
    if (this.roguePerks.twin_polly > 0) {
      const twinPhase = -this.titleTime * 2.4;
      const tx = this.playerX + Math.cos(twinPhase) * 74;
      const ty = this.playerY + Math.sin(twinPhase) * 64;
      this.twinPollyX += (tx - this.twinPollyX) * Math.min(1, dt * 7);
      this.twinPollyY += (ty - this.twinPollyY) * Math.min(1, dt * 7);
      const twinTarget = this.findHighestPriorityEnemy();
      if (twinTarget) {
        this.twinPollyAngle = Math.atan2(
          twinTarget.y - this.twinPollyY,
          twinTarget.x - this.twinPollyX,
        );
        this.twinPollyFireTimer -= dt;
        if (this.twinPollyFireTimer <= 0) {
          this.twinPollyFireTimer = 0.34 / Math.max(1, this.roguePerks.twin_polly);
          this.spawnBullet(
            this.twinPollyX,
            this.twinPollyY,
            Math.cos(this.twinPollyAngle) * 780,
            Math.sin(this.twinPollyAngle) * 780,
            4.2,
            14,
            1.3,
            false,
            '#00f5d4',
            true,
          );
        }
      }
    }

    if (this.pollyActiveTimer > 0) {
      this.pollyActiveTimer -= dt;
      this.pollyOrbitPhase += dt * 3.2;

      // Polly Wingman Tactical AI: strafe boss weak points/subsystems during Starship Battles!
      const boss = this.enemies.find((e) => e.kind === 'boss' && e.dyingTimer <= 0);
      const activeSub = boss?.subsystems?.find((s) => !s.destroyed);

      const desiredX = activeSub
        ? activeSub.worldX + Math.cos(this.pollyOrbitPhase) * 88
        : this.playerX + Math.cos(this.pollyOrbitPhase) * 62;
      const desiredY = activeSub
        ? activeSub.worldY + Math.sin(this.pollyOrbitPhase) * 72
        : this.playerY + Math.sin(this.pollyOrbitPhase) * 52;

      this.pollyX += (desiredX - this.pollyX) * Math.min(1, dt * 7.5);
      this.pollyY += (desiredY - this.pollyY) * Math.min(1, dt * 7.5);

      // Point-Defense Enemy Missile Interception!
      this.pollyInterceptTimer -= dt;
      if (this.pollyInterceptTimer <= 0) {
        for (const b of this.bullets) {
          if (b.active && b.fromEnemy) {
            const d = Math.hypot(b.x - this.pollyX, b.y - this.pollyY);
            if (d <= 135) {
              b.active = false;
              this.pollyInterceptTimer = 0.32;
              this.pollyBeamTargetX = b.x;
              this.pollyBeamTargetY = b.y;
              this.pollyBeamFlashTimer = 0.08;
              this.emitParticles(b.x, b.y, '#a3ff12', 6, 130, 0.2, false);
              break;
            }
          }
        }
      }

      const target = this.findHighestPriorityEnemy();
      if (target) {
        const aimX = activeSub ? activeSub.worldX : target.x;
        const aimY = activeSub ? activeSub.worldY : target.y;
        this.pollyAngle = Math.atan2(aimY - this.pollyY, aimX - this.pollyX);
      } else {
        this.pollyAngle = this.playerAngle;
      }

      this.pollyFireTimer -= dt;
      if (this.pollyFireTimer <= 0 && target) {
        this.pollyFireTimer = 0.22;
        const perpX = -Math.sin(this.pollyAngle);
        const perpY = Math.cos(this.pollyAngle);
        for (const side of [-1, 1]) {
          this.spawnBullet(
            this.pollyX + perpX * 8 * side,
            this.pollyY + perpY * 8 * side,
            Math.cos(this.pollyAngle) * 820,
            Math.sin(this.pollyAngle) * 820,
            4.8,
            18,
            1.4,
            false,
            '#a3ff12',
            true,
          );
        }

        // Direct synchronized beam strike onto subsystem or enemy target
        this.pollyBeamTargetX = activeSub ? activeSub.worldX : target.x;
        this.pollyBeamTargetY = activeSub ? activeSub.worldY : target.y;
        this.pollyBeamFlashTimer = 0.09;

        if (activeSub && boss) {
          this.damageBossSubsystem(boss, activeSub, 14);
        } else {
          target.hp -= 10;
          target.hitFlash = 0.08;
        }

        if (target.shielded && (target.shieldOpenTimer ?? 0) <= 0) {
          target.shieldOpenTimer = 2.4;
          this.spawnLabel(target.x, target.y - target.radius, 'SHIELD BROKEN', '#38bdf8');
        }
        this.emitParticles(
          this.pollyBeamTargetX,
          this.pollyBeamTargetY,
          '#a3ff12',
          5,
          160,
          0.2,
          false,
        );
        if (target.hp <= 0) {
          this.handleEnemyKilled(target);
        }
        soundFX.playLaser(3);
      }

      if (this.pollyActiveTimer <= 0) {
        this.pollyActiveTimer = 0;
        this.pollyCooldownTimer = POLLY_ASSIST_COOLDOWN / haste;
        this.emitParticles(this.pollyX, this.pollyY, '#38bdf8', 12, 160, 0.3, false);
      }
      return;
    }

    this.pollyCooldownTimer = Math.max(0, this.pollyCooldownTimer - dt * haste);
    if (this.pollyCooldownTimer <= 0) {
      const peakDensity = activeThreatCount >= POLLY_AUTO_ENEMY_THRESHOLD;
      const bossAssistReady = isBossEpisode && this.bossFightElapsed >= 3.0;
      if (peakDensity || bossAssistReady) {
        this.triggerPollyAssist(true);
      }
    }
  }

  private damageBossSubsystem(boss: Enemy, sub: BossSubsystem, damage: number): void {
    if (sub.destroyed) return;
    sub.hp = Math.max(0, sub.hp - damage);
    sub.hitFlash = 0.12;
    boss.hp = Math.max(1, boss.hp - damage * 0.85);
    boss.hitFlash = 0.07;

    if (sub.hp <= 0) {
      sub.destroyed = true;
      soundFX.playSubsystemDestroyed();
      this.addTrauma(0.45);
      this.emitParticles(sub.worldX, sub.worldY, '#ff6b35', 28, 260, 0.55, true);
      this.spawnLabel(
        sub.worldX,
        sub.worldY - 18,
        `DESTROYED: ${sub.name.toUpperCase()}`,
        '#a3ff12',
      );
      this.spawnOrb(sub.worldX, sub.worldY, 6);

      // Destroying subsystems disables or weakens boss systems!
      if (sub.kind === 'shield_gen') {
        boss.shielded = false;
      } else if (sub.kind === 'laser_battery') {
        boss.laserCount = Math.max(1, (boss.laserCount ?? 2) - 1);
        boss.laserActiveTimer = 0;
      } else if (sub.kind === 'missile_pod') {
        boss.spiralSpokes = Math.max(5, Math.floor((boss.spiralSpokes ?? 12) * 0.55));
      } else if (sub.kind === 'central_core') {
        const coreBlast = Math.round(boss.maxHp * 0.18);
        boss.hp -= coreBlast;
        this.spawnLabel(boss.x, boss.y - boss.radius, `CORE OVERLOAD -${coreBlast}!`, '#ff007f');
      }

      if (boss.hp <= 0) {
        this.handleEnemyKilled(boss);
      }
    }
  }

  private findHighestPriorityEnemy(): Enemy | null {
    let bossCandidate: Enemy | null = null;
    let nearest: Enemy | null = null;
    let nearestDistSq = Infinity;
    for (const e of this.enemies) {
      if (e.dyingTimer > 0) continue;
      if (e.kind === 'boss') {
        bossCandidate = e;
      }
      const dx = e.x - this.pollyX;
      const dy = e.y - this.pollyY;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestDistSq) {
        nearestDistSq = d2;
        nearest = e;
      }
    }
    return bossCandidate ?? nearest;
  }

  private pollGamepad(): {
    gx: number;
    gy: number;
    gz: number;
    aimX: number;
    aimY: number;
    firing: boolean;
  } {
    const empty = { gx: 0, gy: 0, gz: 0, aimX: 0, aimY: 0, firing: false };
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return empty;
    }
    try {
      const pads = navigator.getGamepads();
      const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
      this.gamepadConnected = Boolean(gp);
      if (!gp) return empty;

      const deadzone = (val: number) => (Math.abs(val) < 0.16 ? 0 : val);
      let gx = deadzone(gp.axes[0] ?? 0);
      let gy = deadzone(gp.axes[1] ?? 0);
      const aimX = deadzone(gp.axes[2] ?? 0);
      const aimY = deadzone(gp.axes[3] ?? 0);

      // D-Pad fallback for Left/Right/Front/Back
      if (gp.buttons[14]?.pressed) gx = -1;
      if (gp.buttons[15]?.pressed) gx = 1;
      if (gp.buttons[12]?.pressed) gy = -1;
      if (gp.buttons[13]?.pressed) gy = 1;

      // Altitude Up/Down via Right Stick Y or Triggers LT (6) / RT (7)
      let gz = -aimY;
      if (gp.buttons[6]?.pressed && !gp.buttons[7]?.pressed) gz = -1;

      const pressed = gp.buttons.map((b) => Boolean(b?.pressed));
      const justPressed = (idx: number) =>
        Boolean(pressed[idx] && !this.gamepadPrevButtons[idx]);

      if (justPressed(1)) this.triggerDash(); // B / Circle
      if (justPressed(2)) this.activateTacticalShield(); // X / Square
      if (justPressed(3)) this.triggerPollyAssist(false); // Y / Triangle
      if (justPressed(4)) this.triggerEmp(); // LB / L1
      if (justPressed(5)) this.triggerSquadronLink(true); // RB / R1
      if (justPressed(9)) this.pauseGame(); // Start

      this.gamepadPrevButtons = pressed;
      const firing = Boolean(gp.buttons[0]?.pressed || gp.buttons[7]?.pressed);
      return { gx, gy, gz, aimX, aimY, firing };
    } catch {
      return empty;
    }
  }

  private updatePlayer(
    dt: number,
    stats: ReturnType<typeof computePlayerStats>,
  ): void {
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);

    if (this.playerDowned) {
      this.playerVx = 0;
      this.playerVy = 0;
      this.playerVz = 0;
      return;
    }

    if (stats.maxShield > 0 && this.playerShield < stats.maxShield) {
      this.shieldRegenTimer -= dt;
      if (this.shieldRegenTimer <= 0) {
        this.playerShield = Math.min(
          stats.maxShield,
          this.playerShield + 14 * dt,
        );
      }
    }

    this.playerScaleX += (1 - this.playerScaleX) * Math.min(1, dt * 14);
    this.playerScaleY += (1 - this.playerScaleY) * Math.min(1, dt * 14);

    const gp = this.pollGamepad();
    if (gp.firing) {
      this.manualFireHeld = true;
    }

    // 100% Full Manual 6-Direction Flight Input:
    // Front (-Y), Back (+Y), Left (-X), Right (+X), Up (+Z), Down (-Z)
    let ix = 0;
    let iy = 0;
    let iz = 0;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) iy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) iy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) ix -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) ix += 1;

    // 3D Elevation Up (+Z) / Down (-Z) keys
    const altMode = this.flightSettings.altitudeKeys;
    const upKeyHeld =
      this.keysHeld.has('PageUp') ||
      this.keysHeld.has('KeyR') ||
      (altMode === 'space_shift' && this.keysHeld.has('Space')) ||
      (altMode === 'q_e' && this.keysHeld.has('KeyQ'));
    const downKeyHeld =
      this.keysHeld.has('PageDown') ||
      this.keysHeld.has('KeyF') ||
      (altMode === 'space_shift' &&
        (this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight'))) ||
      (altMode === 'q_e' && this.keysHeld.has('KeyE'));

    if (upKeyHeld) iz += 1;
    if (downKeyHeld) iz -= 1;

    // Combine with Virtual Analog Thumbstick, Vertical Altitude Touch Slider, or Gamepad
    if (ix !== 0 || iy !== 0) {
      const len = Math.hypot(ix, iy);
      ix /= len;
      iy /= len;
    } else if (this.joystickActive) {
      ix = this.joystickDx;
      iy = this.joystickDy;
    } else if (Math.hypot(gp.gx, gp.gy) > 0.05) {
      ix = gp.gx;
      iy = gp.gy;
    } else if (
      this.pointerActive &&
      this.flightSettings.touchMode === 'direct_touch'
    ) {
      // 1:1 Direct Finger Tracking mode (with tight deadzone so ship holds position once reached)
      const dx = this.pointerWorldX - this.playerX;
      const dy = this.pointerWorldY - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const factor = Math.min(1, dist / 28);
        ix = (dx / dist) * factor;
        iy = (dy / dist) * factor;
      }
    }

    if (iz === 0) {
      if (Math.abs(this.altitudeTouchInput) > 0.05) {
        iz = this.altitudeTouchInput;
      } else if (Math.abs(gp.gz) > 0.1) {
        iz = gp.gz;
      }
    }

    if (this.dashBufferTimer > 0 && this.dashCooldownTimer <= 0 && this.dashTimer <= 0) {
      this.dashBufferTimer = 0;
      this.dashTimer = this.dashDuration;
      this.dashCooldownTimer = stats.dashCooldown;
      this.playerInvuln = Math.max(this.playerInvuln, 0.28);

      if (ix !== 0 || iy !== 0 || iz !== 0) {
        const len3 = Math.hypot(ix, iy) || 1;
        this.dashDirX = ix / len3;
        this.dashDirY = iy / len3;
        this.dashDirZ = iz;
      } else {
        this.dashDirX = Math.cos(this.playerAngle);
        this.dashDirY = Math.sin(this.playerAngle);
        this.dashDirZ = 0;
      }

      this.playerScaleX = 1.32;
      this.playerScaleY = 0.72;
      soundFX.playDash();
      this.emitParticles(this.playerX, this.playerY, '#00f5d4', 12, 220, 0.32, true);
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = stats.moveSpeed * 2.85;
      this.playerVx = this.dashDirX * dashSpeed;
      this.playerVy = this.dashDirY * dashSpeed;
      this.playerVz = this.dashDirZ * (stats.moveSpeed * 1.4);
      this.afterimageSpawnTimer -= dt;
      if (this.afterimageSpawnTimer <= 0) {
        this.afterimageSpawnTimer = 0.032;
        this.spawnAfterimage(this.playerX, this.playerY, this.playerAngle);
      }
    } else {
      const targetVx = ix * stats.moveSpeed;
      const targetVy = iy * stats.moveSpeed;
      const targetVz = iz * (stats.moveSpeed * 0.78);
      const dampRate = this.flightSettings.inertialDampening ? 26 : 12;

      const accelXY = ix !== 0 || iy !== 0 ? 22 : dampRate;
      const accelZ = iz !== 0 ? 20 : dampRate;

      this.playerVx += (targetVx - this.playerVx) * Math.min(1, accelXY * dt);
      this.playerVy += (targetVy - this.playerVy) * Math.min(1, accelXY * dt);
      this.playerVz += (targetVz - this.playerVz) * Math.min(1, accelZ * dt);

      // Crisp zero-drift lock when no directional input is held!
      if (ix === 0 && Math.abs(this.playerVx) < 3.5) this.playerVx = 0;
      if (iy === 0 && Math.abs(this.playerVy) < 3.5) this.playerVy = 0;
      if (iz === 0 && Math.abs(this.playerVz) < 3.5) this.playerVz = 0;
    }

    this.playerX += this.playerVx * dt;
    this.playerY += this.playerVy * dt;
    this.playerZ += this.playerVz * dt;

    const pad = this.playerRadius + 10;
    this.playerX = Math.max(pad, Math.min(this.width - pad, this.playerX));
    this.playerY = Math.max(pad, Math.min(this.height - pad, this.playerY));
    this.playerZ = Math.max(
      -ARENA_MAX_ALTITUDE,
      Math.min(ARENA_MAX_ALTITUDE, this.playerZ),
    );

    const nearest = this.findNearestEnemy(this.playerX, this.playerY);
    if (Math.hypot(gp.aimX, gp.aimY) > 0.25) {
      this.playerAngle = Math.atan2(gp.aimY, gp.aimX);
    } else if (this.pointerActive) {
      this.playerAngle = Math.atan2(
        this.pointerWorldY - this.playerY,
        this.pointerWorldX - this.playerX,
      );
    } else if (nearest) {
      this.playerAngle = Math.atan2(
        nearest.y - this.playerY,
        nearest.x - this.playerX,
      );
    } else if (Math.hypot(this.playerVx, this.playerVy) > 15) {
      this.playerAngle = Math.atan2(this.playerVy, this.playerVx);
    }
  }

  private findNearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDistSq = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dyingTimer > 0) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = enemy;
      }
    }
    return best;
  }

  private firePlayerLasers(
    stats: ReturnType<typeof computePlayerStats>,
    forceManualFire = false,
  ): void {
    const target = this.findNearestEnemy(this.playerX, this.playerY);
    let aimAngle = this.playerAngle;
    if (this.pointerActive && this.flightSettings.touchMode === 'dual_stick') {
      aimAngle = Math.atan2(
        this.pointerWorldY - this.playerY,
        this.pointerWorldX - this.playerX,
      );
    } else if (target) {
      aimAngle = Math.atan2(target.y - this.playerY, target.x - this.playerX);
    } else if (this.pointerActive) {
      aimAngle = Math.atan2(
        this.pointerWorldY - this.playerY,
        this.pointerWorldX - this.playerX,
      );
    } else {
      if (this.enemies.length === 0 && !forceManualFire) return;
    }

    const dmgMult =
      (stats.damageMultiplier ?? 1) *
      (this.squadronFusionDocked ? 1.45 : 1) *
      (this.focusCoreBuffTimer > 0 ? 1.25 : 1);

    const count = stats.shotCount + (this.squadronFusionDocked ? 1 : 0);
    const spreadStep = this.selectedWeapon === 'spread' ? 0.11 : 0.035;
    const speed =
      this.selectedWeapon === 'plasma'
        ? 520
        : this.selectedWeapon === 'homing'
          ? 560
          : 760;
    const baseDamage =
      this.selectedWeapon === 'plasma'
        ? 34
        : this.selectedWeapon === 'laser'
          ? 24
          : this.selectedWeapon === 'homing'
            ? 15
            : 18;
    const damage = Math.round(baseDamage * dmgMult);
    const radius =
      this.selectedWeapon === 'plasma' ? 6 : this.selectedWeapon === 'laser' ? 3 : 4.2;
    const life = this.selectedWeapon === 'plasma' ? 2 : 1.4;
    const perpX = -Math.sin(aimAngle);
    const perpY = Math.cos(aimAngle);

    for (let i = 0; i < count; i++) {
      const offsetIndex = i - (count - 1) / 2;
      const angle = aimAngle + offsetIndex * spreadStep * 0.65;
      const lateralOffset = offsetIndex * 7;
      const spawnX =
        this.playerX + Math.cos(aimAngle) * 18 + perpX * lateralOffset;
      const spawnY =
        this.playerY + Math.sin(aimAngle) * 18 + perpY * lateralOffset;

      this.spawnBullet(
        spawnX,
        spawnY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        radius,
        damage,
        life,
        false,
        this.selectedWeapon === 'plasma'
          ? '#ff6b35'
          : i % 2 === 1 && count > 2
            ? '#a3ff12'
            : '#00f5d4',
        this.selectedWeapon === 'homing',
      );
    }

    // Twin-Core Heavy Gunship Fusion simultaneously fires the Teammate's weapon!
    if (this.squadronFusionDocked && target) {
      this.fireTeammateWeapon(target);
    }

    this.playerScaleX = 0.92;
    this.playerScaleY = 1.08;
    soundFX.playLaser(count, this.selectedWeapon);
  }

  private spawnEpisodeEnemy(
    diff: ReturnType<typeof computeEpisodeConfig>,
  ): void {
    const kind = pickEnemyKind(Math.random(), diff.weights);
    const edge = Math.floor(Math.random() * 4);
    const margin = 32;
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Math.random() * this.width;
      y = -margin;
    } else if (edge === 1) {
      x = this.width + margin;
      y = Math.random() * this.height;
    } else if (edge === 2) {
      x = Math.random() * this.width;
      y = this.height + margin;
    } else {
      x = -margin;
      y = Math.random() * this.height;
    }

    if (kind === 'block') {
      const hp = Math.round(28 * diff.hpMultiplier);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'block',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 15,
        hp,
        maxHp: hp,
        speed: (118 + Math.random() * 26) * diff.speedMultiplier,
        damage: 16,
        scoreValue: 100,
        shardValue: 2,
        angle: Math.random() * Math.PI * 2,
        hitFlash: 0,
        dyingTimer: 0,
        stunTimer: 0,
        state: 'approach',
        stateTimer: 0.8 + Math.random() * 0.8,
        aimAngle: 0,
        glitchTimer: 0.9 + Math.random() * 1.1,
        orbitDir: Math.random() < 0.5 ? 1 : -1,
      });
    } else if (kind === 'firewall') {
      const hp = Math.round(52 * diff.hpMultiplier);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'firewall',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 19,
        hp,
        maxHp: hp,
        speed: 88 * diff.speedMultiplier,
        damage: 20,
        scoreValue: 180,
        shardValue: 3,
        angle: 0,
        hitFlash: 0,
        dyingTimer: 0,
        stunTimer: 0,
        state: 'approach',
        stateTimer: 1.5,
        aimAngle: 0,
        glitchTimer: 0,
        orbitDir: Math.random() < 0.5 ? 1 : -1,
        shielded:
          (diff.chapter > 1 || diff.episode >= 4) && Math.random() < 0.32,
        shieldOpenTimer: 0,
      });
    } else {
      const hp = Math.round(34 * diff.hpMultiplier);
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'interceptor',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 14,
        hp,
        maxHp: hp,
        speed: 132 * diff.speedMultiplier,
        damage: 22,
        scoreValue: 150,
        shardValue: 3,
        angle: 0,
        hitFlash: 0,
        dyingTimer: 0,
        stunTimer: 0,
        state: 'approach',
        stateTimer: 1.4,
        aimAngle: 0,
        glitchTimer: 0,
        orbitDir: Math.random() < 0.5 ? 1 : -1,
      });
    }
  }

  private updateHazards(dt: number): void {
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      this.hazardTimer = Math.max(5.5, 11 - Math.min(4, this.chapter * 0.35));
      if (this.hazards.length < 4) {
        const edge = Math.floor(Math.random() * 4);
        const pad = 30;
        const x =
          edge === 1
            ? this.width + pad
            : edge === 3
              ? -pad
              : Math.random() * this.width;
        const y =
          edge === 0
            ? -pad
            : edge === 2
              ? this.height + pad
              : Math.random() * this.height;
        const angle =
          Math.atan2(this.height / 2 - y, this.width / 2 - x) +
          (Math.random() - 0.5) * 0.9;
        const speed = 75 + Math.min(70, this.chapter * 8);
        this.hazards.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 22 + Math.random() * 15,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.5),
          life: 15,
        });
      }
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;
      hazard.angle += hazard.spin * dt;
      hazard.life -= dt;
      if (
        hazard.life <= 0 ||
        hazard.x < -hazard.radius - 40 ||
        hazard.x > this.width + hazard.radius + 40 ||
        hazard.y < -hazard.radius - 40 ||
        hazard.y > this.height + hazard.radius + 40
      ) {
        this.hazards.splice(i, 1);
        continue;
      }
      if (
        this.playerInvuln <= 0 &&
        !this.playerDowned &&
        circleIntersects(
          this.playerX,
          this.playerY,
          this.playerRadius,
          hazard.x,
          hazard.y,
          hazard.radius * 0.72,
        )
      ) {
        this.damagePlayer(18, hazard.x, hazard.y, 'ASTEROID IMPACT');
      }
    }
  }

  private countActiveTelegraphs(): number {
    let count = 0;
    for (const e of this.enemies) {
      if (e.dyingTimer <= 0 && e.state === 'telegraph') count++;
    }
    return count;
  }

  private updateEnemies(dt: number, speedMult: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.shieldOpenTimer = Math.max(0, (e.shieldOpenTimer ?? 0) - dt);
      if (e.warpInTimer && e.warpInTimer > 0) {
        e.warpInTimer = Math.max(0, e.warpInTimer - dt);
      }

      if (e.dyingTimer > 0) {
        e.dyingTimer -= dt;
        e.angle += dt * 11;
        if (e.dyingTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.kind === 'boss') {
        this.updateBossSubsystemPositions(e);
        // Emit sparks & smoke from destroyed subsystems!
        if (e.subsystems && Math.random() < 0.35) {
          for (const sub of e.subsystems) {
            if (sub.destroyed && Math.random() < 0.4) {
              this.emitParticles(sub.worldX, sub.worldY, '#ff6b35', 1, 55, 0.25, true);
            }
          }
        }
      }

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        e.vx *= 0.85;
        e.vy *= 0.85;
        continue;
      }

      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;

      if (e.kind === 'block') {
        e.angle += dt * 2.6;
        e.glitchTimer -= dt;
        if (e.glitchTimer <= 0) {
          e.glitchTimer = 1.1 + Math.random() * 0.9;
          const perpX = -dirY * e.orbitDir;
          const perpY = dirX * e.orbitDir;
          e.x += perpX * 18;
          e.y += perpY * 18;
          this.emitParticles(e.x, e.y, '#ff2a5f', 4, 90, 0.2, true);
        }
        e.vx = dirX * e.speed;
        e.vy = dirY * e.speed;
      } else if (e.kind === 'firewall') {
        e.angle += dt * 1.4;
        if (e.state === 'approach') {
          if (dist > 235) {
            e.vx = dirX * e.speed;
            e.vy = dirY * e.speed;
          } else {
            e.vx = (-dirY * e.orbitDir * 0.85 + dirX * 0.15) * e.speed;
            e.vy = (dirX * e.orbitDir * 0.85 + dirY * 0.15) * e.speed;
            e.stateTimer -= dt;
            if (
              e.stateTimer <= 0 &&
              this.countActiveTelegraphs() < MAX_CONCURRENT_TELEGRAPHS
            ) {
              e.state = 'telegraph';
              e.stateTimer = 0.55;
              e.vx *= 0.2;
              e.vy *= 0.2;
              soundFX.playTelegraph();
            }
          }
        } else if (e.state === 'telegraph') {
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            const bolts = 6;
            const baseAng = e.angle;
            for (let b = 0; b < bolts; b++) {
              const ang = baseAng + (b / bolts) * Math.PI * 2;
              this.spawnBullet(
                e.x + Math.cos(ang) * (e.radius + 4),
                e.y + Math.sin(ang) * (e.radius + 4),
                Math.cos(ang) * (215 * speedMult),
                Math.sin(ang) * (215 * speedMult),
                5.5,
                15,
                2.6,
                true,
                '#ff6b35',
              );
            }
            this.emitParticles(e.x, e.y, '#ff007f', 10, 150, 0.28, false);
            e.state = 'approach';
            e.stateTimer = 2.4;
          }
        }
      } else if (e.kind === 'interceptor') {
        if (e.state === 'approach') {
          e.angle = Math.atan2(dy, dx);
          e.vx = dirX * e.speed;
          e.vy = dirY * e.speed;
          e.stateTimer -= dt;
          if (
            dist < 340 &&
            e.stateTimer <= 0 &&
            this.countActiveTelegraphs() < MAX_CONCURRENT_TELEGRAPHS
          ) {
            e.state = 'telegraph';
            e.stateTimer = 0.48;
            e.aimAngle = Math.atan2(dy, dx);
            e.vx = 0;
            e.vy = 0;
            soundFX.playTelegraph();
          }
        } else if (e.state === 'telegraph') {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'attack';
            e.stateTimer = 0.42;
            const dashSpd = 460 * speedMult;
            e.vx = Math.cos(e.aimAngle) * dashSpd;
            e.vy = Math.sin(e.aimAngle) * dashSpd;
            e.angle = e.aimAngle;
          }
        } else if (e.state === 'attack') {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'recover';
            e.stateTimer = 0.55;
            e.vx *= 0.3;
            e.vy *= 0.3;
          }
        } else {
          e.vx *= 0.92;
          e.vy *= 0.92;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'approach';
            e.stateTimer = 1.4;
          }
        }
      } else if (e.kind === 'boss') {
        e.angle += dt * 0.95;
        const archetype = e.bossArchetype;
        const bossBulletMult = e.bulletSpeedMult ?? speedMult;
        const phase =
          e.hp <= e.maxHp / 3 ? 2 : e.hp <= (e.maxHp * 2) / 3 ? 1 : 0;
        const aggro = (e.aggressionRate ?? 1) * (1 + phase * 0.18);
        if (phase > (e.bossPhase ?? 0)) {
          e.bossPhase = phase;
          this.addTrauma(0.22);
          this.emitParticles(e.x, e.y, '#a3ff12', 20, 220, 0.4, true);
          this.spawnLabel(e.x, e.y - e.radius - 18, `PHASE ${phase + 1}`, '#a3ff12');
          soundFX.playBossAlert();
        }

        const laserDestroyed = e.subsystems?.some(
          (s) => s.kind === 'laser_battery' && s.destroyed,
        );
        const missileDestroyed = e.subsystems?.some(
          (s) => s.kind === 'missile_pod' && s.destroyed,
        );

        if (!archetype) {
          if (e.state === 'approach') {
            const desiredDist = 240;
            if (dist > desiredDist) {
              e.vx = dirX * e.speed;
              e.vy = dirY * e.speed;
            } else {
              e.vx = -dirY * e.orbitDir * e.speed * 0.9;
              e.vy = dirX * e.orbitDir * e.speed * 0.9;
            }
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = 'telegraph';
              e.stateTimer = 0.6;
              e.aimAngle = Math.atan2(dy, dx);
              soundFX.playTelegraph();
            }
          } else if (e.state === 'telegraph') {
            e.vx *= 0.92;
            e.vy *= 0.92;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              const spokes = missileDestroyed ? 5 : 10;
              for (let b = 0; b < spokes; b++) {
                const ang = e.aimAngle + (b / spokes) * Math.PI * 2;
                this.spawnBullet(
                  e.x + Math.cos(ang) * (e.radius + 6),
                  e.y + Math.sin(ang) * (e.radius + 6),
                  Math.cos(ang) * (240 * speedMult),
                  Math.sin(ang) * (240 * speedMult),
                  6.5,
                  18,
                  3.2,
                  true,
                  '#ff007f',
                );
              }
              this.emitParticles(e.x, e.y, '#ff007f', 18, 200, 0.35, true);
              e.state = 'approach';
              e.stateTimer = 1.9;
            }
          }
        } else if (archetype === 'sentinel' || archetype === 'leviathan') {
          if (e.state === 'approach') {
            const desiredDist = 245;
            if (dist > desiredDist) {
              e.vx = dirX * e.speed;
              e.vy = dirY * e.speed;
            } else {
              e.vx = -dirY * e.orbitDir * e.speed * 0.9;
              e.vy = dirX * e.orbitDir * e.speed * 0.9;
            }
            e.stateTimer -= dt * aggro;
            if (e.stateTimer <= 0) {
              e.state = 'telegraph';
              e.aimAngle = Math.atan2(dy, dx);
              e.laserAngle = e.aimAngle - 0.55 * (e.laserSweepDir ?? 1);
              e.stateTimer = Math.max(0.45, 0.68 / aggro);
              soundFX.playTelegraph();
            }
          } else if (e.state === 'telegraph') {
            e.vx *= 0.88;
            e.vy *= 0.88;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              const phaseNum = e.attackPhase ?? 0;
              if (phaseNum % 2 === 0 && !laserDestroyed) {
                e.state = 'attack';
                e.laserActiveTimer = 1.85;
                e.stateTimer = 1.85;
                soundFX.playBossAlert();
              } else {
                if (archetype === 'leviathan') {
                  this.spawnBossDataDrones(e, Math.max(2, e.droneCount ?? 2));
                }
                const spokes = missileDestroyed
                  ? Math.max(5, Math.floor((e.spiralSpokes ?? 12) * 0.5))
                  : (e.spiralSpokes ?? 12);
                for (let b = 0; b < spokes; b++) {
                  const ang = e.aimAngle + (b / spokes) * Math.PI * 2;
                  this.spawnBullet(
                    e.x + Math.cos(ang) * (e.radius + 6),
                    e.y + Math.sin(ang) * (e.radius + 6),
                    Math.cos(ang) * (255 * bossBulletMult),
                    Math.sin(ang) * (255 * bossBulletMult),
                    6.8,
                    20,
                    3.4,
                    true,
                    '#ff007f',
                  );
                }
                this.emitParticles(e.x, e.y, '#ff007f', 22, 230, 0.38, true);
                e.attackPhase = phaseNum + 1;
                e.state = 'approach';
                e.stateTimer = Math.max(0.85, 1.4 / aggro);
              }
            }
          } else if (e.state === 'attack') {
            e.vx *= 0.88;
            e.vy *= 0.88;
            const beams = e.laserCount ?? 2;
            const sweepDir = e.laserSweepDir ?? 1;
            e.laserAngle = (e.laserAngle ?? 0) + sweepDir * (1.22 * aggro) * dt;
            e.laserActiveTimer = Math.max(0, (e.laserActiveTimer ?? 0) - dt);
            e.stateTimer -= dt;

            if (this.playerInvuln <= 0 && !this.playerDowned && (e.laserActiveTimer ?? 0) > 0) {
              const beamLen = 820;
              for (let k = 0; k < beams; k++) {
                const ang = (e.laserAngle ?? 0) + (k / beams) * Math.PI * 2;
                const bx1 = e.x + Math.cos(ang) * (e.radius + 4);
                const by1 = e.y + Math.sin(ang) * (e.radius + 4);
                const bx2 = e.x + Math.cos(ang) * beamLen;
                const by2 = e.y + Math.sin(ang) * beamLen;
                if (
                  this.pointToSegmentDist(
                    this.playerX,
                    this.playerY,
                    bx1,
                    by1,
                    bx2,
                    by2,
                  ) <=
                  this.playerRadius + 6
                ) {
                  this.damagePlayer(24, e.x, e.y, e.bossTitle);
                  break;
                }
              }
            }

            if (e.stateTimer <= 0) {
              e.laserActiveTimer = 0;
              e.laserSweepDir = -sweepDir;
              e.attackPhase = (e.attackPhase ?? 0) + 1;
              e.state = 'approach';
              e.stateTimer = Math.max(0.8, 1.35 / aggro);
            }
          }
        } else if (archetype === 'helix') {
          if (e.state === 'approach') {
            const desiredDist = 230;
            if (dist > desiredDist) {
              e.vx = dirX * e.speed;
              e.vy = dirY * e.speed;
            } else {
              e.vx = -dirY * e.orbitDir * e.speed * 0.95;
              e.vy = dirX * e.orbitDir * e.speed * 0.95;
            }
            e.stateTimer -= dt * aggro;
            if (e.stateTimer <= 0) {
              e.state = 'telegraph';
              e.stateTimer = Math.max(0.4, 0.52 / aggro);
              e.aimAngle = Math.atan2(dy, dx);
              soundFX.playTelegraph();
            }
          } else if (e.state === 'telegraph') {
            e.vx *= 0.9;
            e.vy *= 0.9;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              if ((e.attackPhase ?? 0) % 2 === 1) {
                this.spawnBossDataDrones(e, Math.max(2, e.droneCount ?? 2));
              }
              e.state = 'attack';
              e.spiralTicksRemaining = missileDestroyed ? 5 : 10;
              e.spiralTickTimer = 0;
              e.stateTimer = 1.7;
            }
          } else if (e.state === 'attack') {
            e.vx = -dirY * e.orbitDir * e.speed * 0.45;
            e.vy = dirX * e.orbitDir * e.speed * 0.45;
            e.spiralTickTimer = (e.spiralTickTimer ?? 0) - dt;
            if ((e.spiralTickTimer ?? 0) <= 0 && (e.spiralTicksRemaining ?? 0) > 0) {
              e.spiralTickTimer = 0.15;
              e.spiralTicksRemaining = (e.spiralTicksRemaining ?? 1) - 1;
              const phaseNum = e.attackPhase ?? 0;
              const spinSign = phaseNum % 2 === 0 ? 1 : -1;
              e.aimAngle += spinSign * 0.28;
              const spokes = Math.max(6, Math.round((e.spiralSpokes ?? 10) * 0.8));
              for (let b = 0; b < spokes; b++) {
                const ang = e.aimAngle + (b / spokes) * Math.PI * 2;
                this.spawnBullet(
                  e.x + Math.cos(ang) * (e.radius + 6),
                  e.y + Math.sin(ang) * (e.radius + 6),
                  Math.cos(ang) * (230 * bossBulletMult),
                  Math.sin(ang) * (230 * bossBulletMult),
                  6,
                  18,
                  3.3,
                  true,
                  b % 2 === 0 ? '#ff007f' : '#ff6b35',
                );
              }
            }
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.attackPhase = (e.attackPhase ?? 0) + 1;
              e.state = 'approach';
              e.stateTimer = Math.max(0.85, 1.4 / aggro);
            }
          }
        } else {
          if (e.state === 'approach') {
            const desiredDist = 260;
            if (dist > desiredDist) {
              e.vx = dirX * e.speed;
              e.vy = dirY * e.speed;
            } else {
              e.vx = -dirY * e.orbitDir * e.speed * 0.92;
              e.vy = dirX * e.orbitDir * e.speed * 0.92;
            }
            e.stateTimer -= dt * aggro;
            if (e.stateTimer <= 0) {
              e.state = 'telegraph';
              e.stateTimer = Math.max(0.42, 0.55 / aggro);
              e.aimAngle = Math.atan2(dy, dx);
              soundFX.playTelegraph();
            }
          } else if (e.state === 'telegraph') {
            e.vx *= 0.9;
            e.vy *= 0.9;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              const phaseNum = e.attackPhase ?? 0;
              if (phaseNum % 2 === 0) {
                this.spawnBossDataDrones(e, e.droneCount ?? 3);
              }
              const spreadCount = missileDestroyed ? 5 : 9;
              for (let b = 0; b < spreadCount; b++) {
                const offset = (b - (spreadCount - 1) / 2) * 0.16;
                const ang = e.aimAngle + offset;
                this.spawnBullet(
                  e.x + Math.cos(ang) * (e.radius + 6),
                  e.y + Math.sin(ang) * (e.radius + 6),
                  Math.cos(ang) * (265 * bossBulletMult),
                  Math.sin(ang) * (265 * bossBulletMult),
                  6.2,
                  20,
                  3.2,
                  true,
                  '#ff6b35',
                );
              }
              this.emitParticles(e.x, e.y, '#ff6b35', 18, 210, 0.34, true);
              e.attackPhase = phaseNum + 1;
              e.state = 'approach';
              e.stateTimer = Math.max(0.95, 1.65 / aggro);
            }
          }
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Soft separation
      for (let j = i - 1; j >= 0; j--) {
        const other = this.enemies[j];
        if (other.dyingTimer > 0) continue;
        const sdx = e.x - other.x;
        const sdy = e.y - other.y;
        const minD = e.radius + other.radius + 4;
        const dSq = sdx * sdx + sdy * sdy;
        if (dSq > 0.01 && dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          const push = (minD - d) * 0.35;
          const nx = sdx / d;
          const ny = sdy / d;
          e.x += nx * push;
          e.y += ny * push;
          other.x -= nx * push;
          other.y -= ny * push;
        }
      }

      // Contact collision with Tommy (or active Tactical Shield / Twin-Core Gunship Shield)
      const hasBarrier = this.tacticalShieldActiveTimer > 0 || this.squadronFusionDocked;
      const activeShieldRadius = hasBarrier
        ? this.playerRadius + (this.squadronFusionDocked ? 24 : 16)
        : this.playerRadius;

      const altitudeClearOfEnemy = Math.abs(this.playerZ - (e.z ?? 0)) > 68;

      if (
        !this.playerDowned &&
        !altitudeClearOfEnemy &&
        circleIntersects(
          this.playerX,
          this.playerY,
          activeShieldRadius,
          e.x,
          e.y,
          e.radius,
        )
      ) {
        if (hasBarrier) {
          const awayX = e.x - this.playerX;
          const awayY = e.y - this.playerY;
          const awayLen = Math.hypot(awayX, awayY) || 1;
          e.x += (awayX / awayLen) * 28;
          e.y += (awayY / awayLen) * 28;
          if (e.hitFlash <= 0) {
            e.hp -= 22;
            e.hitFlash = 0.12;
            soundFX.playShieldReflect();
            this.emitParticles(e.x, e.y, '#00f5d4', 10, 190, 0.28, true);
            this.spawnLabel(this.playerX, this.playerY - 24, 'COUNTER!', '#a3ff12');
            if (e.hp <= 0) {
              this.handleEnemyKilled(e);
            }
          }
        } else if (this.playerInvuln <= 0) {
          this.damagePlayer(e.damage, e.x, e.y, e.bossTitle);
        }
      }
    }
  }

  private updateBullets(enemyDt: number, playerDt: number): void {
    const shieldRadius = this.playerRadius + (this.squadronFusionDocked ? 24 : 16);
    const hasBarrier = this.tacticalShieldActiveTimer > 0 || this.squadronFusionDocked;

    for (const b of this.bullets) {
      if (!b.active) continue;
      const stepDt = b.fromEnemy ? enemyDt : playerDt;

      if (!b.fromEnemy && b.homing) {
        const nearest = this.findNearestEnemy(b.x, b.y);
        if (nearest) {
          const desiredAngle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
          const speed = Math.hypot(b.vx, b.vy) || 800;
          const curAngle = Math.atan2(b.vy, b.vx);
          let diff = desiredAngle - curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAngle = curAngle + diff * Math.min(1, stepDt * 6);
          b.vx = Math.cos(nextAngle) * speed;
          b.vy = Math.sin(nextAngle) * speed;
        }
      }

      b.x += b.vx * stepDt;
      b.y += b.vy * stepDt;
      b.life -= stepDt;

      if (
        b.life <= 0 ||
        b.x < -60 ||
        b.x > this.width + 60 ||
        b.y < -60 ||
        b.y > this.height + 60
      ) {
        b.active = false;
        continue;
      }

      if (b.fromEnemy) {
        // Tactical Shield or Twin-Core Fusion dome reflects enemy bullets!
        if (
          hasBarrier &&
          circleIntersects(
            this.playerX,
            this.playerY,
            shieldRadius,
            b.x,
            b.y,
            b.radius,
          )
        ) {
          b.fromEnemy = false;
          b.color = '#a3ff12';
          b.damage = SHIELD_REFLECT_DAMAGE;
          b.life = 1.6;
          b.homing = true;
          const nearest = this.findNearestEnemy(b.x, b.y);
          const reflectAngle = nearest
            ? Math.atan2(nearest.y - b.y, nearest.x - b.x)
            : Math.atan2(-b.vy, -b.vx);
          b.vx = Math.cos(reflectAngle) * SHIELD_REFLECT_BOLT_SPEED;
          b.vy = Math.sin(reflectAngle) * SHIELD_REFLECT_BOLT_SPEED;
          this.tacticalShieldPulse = 1;
          soundFX.playShieldReflect();
          this.emitParticles(b.x, b.y, '#a3ff12', 6, 150, 0.22, false);
          continue;
        }

        // Direct Hit on Tommy (unless Tommy ascended/descended clear in 3D altitude Z!)
        const altDiff = Math.abs(this.playerZ - (b.z ?? 0));
        if (
          !this.playerDowned &&
          this.playerInvuln <= 0 &&
          altDiff <= 56 &&
          circleIntersects(
            this.playerX,
            this.playerY,
            this.playerRadius * 0.88,
            b.x,
            b.y,
            b.radius,
          )
        ) {
          b.active = false;
          this.damagePlayer(b.damage, b.x, b.y);
          continue;
        }

        // Near-Miss Graze Detection (in XY or 3D Altitude Z flyover/underpass)!
        if (
          !b.grazed &&
          !this.playerDowned &&
          altDiff <= 85 &&
          circleIntersects(
            this.playerX,
            this.playerY,
            this.playerRadius + 22,
            b.x,
            b.y,
            b.radius,
          )
        ) {
          b.grazed = true;
          this.grazeCount += 1;
          const hyper = 1 + this.roguePerks.hyper_graze;
          this.grazeSlowMoTimer = Math.max(this.grazeSlowMoTimer, 0.32 * hyper);
          this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - 0.45 * hyper);
          this.empCooldownTimer = Math.max(0, this.empCooldownTimer - 1.1 * hyper);
          const grazeBonus = 50 * this.comboMultiplier;
          this.score += grazeBonus;
          soundFX.playGraze();
          this.emitParticles(this.playerX, this.playerY, '#fbbf24', 5, 110, 0.2, false);
          this.spawnLabel(
            this.playerX,
            this.playerY - 26,
            `GRAZE +${grazeBonus}`,
            '#fbbf24',
          );
        }
      } else {
        for (const e of this.enemies) {
          if (e.dyingTimer > 0) continue;

          // First check if projectile hits any active Capital Starship Destructible Subsystem!
          let subsystemHit = false;
          if (e.kind === 'boss' && e.subsystems) {
            for (const sub of e.subsystems) {
              if (!sub.destroyed && circleIntersects(b.x, b.y, b.radius + 4, sub.worldX, sub.worldY, 16)) {
                b.active = false;
                subsystemHit = true;
                this.damageBossSubsystem(e, sub, b.damage * 1.25);
                this.emitParticles(b.x, b.y, '#a3ff12', 6, 160, 0.22, true);
                break;
              }
            }
          }
          if (subsystemHit) break;

          if (circleIntersects(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
            b.active = false;
            if (e.shielded && (e.shieldOpenTimer ?? 0) <= 0) {
              this.emitParticles(b.x, b.y, '#38bdf8', 3, 90, 0.16, false);
              break;
            }
            const damageAngle = Math.atan2(b.y - e.y, b.x - e.x) - e.angle;
            const weakPointDiff = Math.atan2(
              Math.sin(damageAngle + Math.PI / 2),
              Math.cos(damageAngle + Math.PI / 2),
            );
            const weakPointHit =
              e.isChapterBoss && Math.abs(weakPointDiff) <= 0.42;
            e.hp -= b.damage * (weakPointHit ? 2.5 : 1);
            e.hitFlash = 0.065;
            this.emitParticles(b.x, b.y, b.color, 4, 140, 0.22, false);
            if (weakPointHit) {
              this.emitParticles(b.x, b.y, '#a3ff12', 8, 180, 0.25, true);
              this.spawnLabel(e.x, e.y - e.radius - 8, 'WEAK POINT', '#a3ff12');
            }

            // Chain-Lightning Rogue-Lite Perk Arc
            if (this.roguePerks.chain_lightning > 0) {
              this.triggerChainLightning(e, b.damage);
            }

            if (e.hp <= 0) {
              this.handleEnemyKilled(e);
            } else {
              soundFX.playEnemyHit();
            }
            break;
          }
        }
      }
    }
  }

  private triggerChainLightning(sourceEnemy: Enemy, baseDamage: number): void {
    const stacks = this.roguePerks.chain_lightning;
    if (stacks <= 0) return;
    const arcDamage = Math.round(baseDamage * 0.45 * stacks);
    let arcsRemaining = Math.min(3, stacks + 1);
    for (const other of this.enemies) {
      if (other === sourceEnemy || other.dyingTimer > 0) continue;
      const dist = Math.hypot(other.x - sourceEnemy.x, other.y - sourceEnemy.y);
      if (dist <= 190) {
        other.hp -= arcDamage;
        other.hitFlash = 0.08;
        this.lightningArcs.push({
          x1: sourceEnemy.x,
          y1: sourceEnemy.y,
          x2: other.x,
          y2: other.y,
          color: '#38bdf8',
          life: 0.12,
        });
        if (other.hp <= 0) {
          this.handleEnemyKilled(other);
        }
        arcsRemaining--;
        if (arcsRemaining <= 0) break;
      }
    }
  }

  private handleEnemyKilled(enemy: Enemy): void {
    if (enemy.dyingTimer > 0) return;
    enemy.dyingTimer = 0.22;
    enemy.hitFlash = 0.22;
    this.enemiesDefeated += 1;

    // Vampiric Shield Recharge Rogue-Lite Perk
    if (this.roguePerks.vampiric_shield > 0 && this.enemiesDefeated % 3 === 0) {
      const stats = computePlayerStats(this.upgrades, this.hangarLevels);
      const stacks = this.roguePerks.vampiric_shield;
      this.playerShield = Math.min(
        Math.max(30, stats.maxShield),
        this.playerShield + 8 * stacks,
      );
      this.playerHp = Math.min(stats.maxHp, this.playerHp + 4 * stacks);
      this.spawnLabel(this.playerX, this.playerY - 22, '+SIPHON SHIELD', '#a3ff12');
    }

    const streakNext = advanceComboStreak(this.comboCount);
    this.comboCount = streakNext.streak;
    this.comboMultiplier = streakNext.multiplier;
    this.maxCombo = Math.max(this.maxCombo, this.comboMultiplier);
    this.recordAchievementProgress({ maxComboReached: this.maxCombo });
    this.comboTimer = streakNext.timer;

    const rewards = computeComboRewards(
      enemy.scoreValue,
      enemy.shardValue,
      this.comboMultiplier,
    );

    this.score += rewards.score;
    if (this.score > this.highScore) {
      this.highScore = saveHighScore(this.score);
    }

    const isBoss = enemy.kind === 'boss';
    if (isBoss) {
      this.bossesDefeated += 1;
      // Award Hangar Scrap for defeating bosses!
      this.awardHangarScrap(enemy.isChapterBoss ? 25 : 12);
    }
    soundFX.playExplosion(isBoss);
    this.hitstopTimer = isBoss ? 0.075 : 0.032;
    this.addTrauma(isBoss ? 0.65 : 0.22);

    this.emitParticles(
      enemy.x,
      enemy.y,
      isBoss ? '#ff007f' : '#ff2a5f',
      isBoss ? 42 : 16,
      isBoss ? 340 : 210,
      isBoss ? 0.7 : 0.4,
      true,
    );

    const scoreLabel =
      this.comboMultiplier > 1
        ? `+${rewards.score} (${this.comboMultiplier}x)`
        : `+${rewards.score}`;
    this.spawnLabel(
      enemy.x,
      enemy.y - 12,
      scoreLabel,
      isBoss ? '#a3ff12' : '#00f5d4',
    );

    const dropCount = isBoss
      ? Math.min(12, 6 + Math.floor(this.comboMultiplier / 2))
      : Math.max(1, Math.ceil(rewards.shards / 2));
    const perOrb = Math.max(1, Math.round(rewards.shards / dropCount));
    for (let i = 0; i < dropCount; i++) {
      const ang = (i / dropCount) * Math.PI * 2 + Math.random() * 0.5;
      const spread = 12 + Math.random() * (isBoss ? 40 : 18);
      this.spawnOrb(
        enemy.x + Math.cos(ang) * spread,
        enemy.y + Math.sin(ang) * spread,
        perOrb,
      );
    }

    // Defeating Episode 10 Gigantic Chapter Boss clears the Chapter!
    if (enemy.isChapterBoss && !this.isDyingSequence) {
      for (const b of this.bullets) {
        if (b.fromEnemy) b.active = false;
      }
      for (const other of this.enemies) {
        if (other !== enemy && other.dyingTimer <= 0) {
          other.dyingTimer = 0.2;
          this.emitParticles(other.x, other.y, '#00f5d4', 10, 140, 0.28, true);
        }
      }
      this.chaptersCleared += 1;
      this.shards += 12 + this.chapter * 4;
      this.totalShardsCollected += 12 + this.chapter * 4;
      this.prepareMidRunDraft();
      soundFX.playChapterVictory();
      this.recordAchievementProgress({
        enemiesDefeated: 1,
        bossesDefeated: 1,
        chapterReached: this.chapter + 1,
      });
      this.keysHeld.clear();
      this.pointerActive = false;
      this.syncBodyState('chapter_victory');
      this.pushHudSnapshot();
      return;
    }

    this.recordAchievementProgress({
      enemiesDefeated: 1,
      bossesDefeated: isBoss ? 1 : 0,
    });
    this.pushHudSnapshot();
  }

  private awardHangarScrap(amount: number): void {
    if (amount <= 0) return;
    const hangar = loadHangarState();
    const updated = {
      ...hangar,
      scrap: hangar.scrap + amount,
    };
    saveHangarState(updated);
    void idbSet(HANGAR_STORAGE_KEY, updated);

    const savedProg = loadSavedCampaignProgress();
    const nextProg = {
      highestChapter: Math.max(savedProg.highestChapter, this.chapter),
      lastChapter: this.chapter,
      lastEpisode: this.episode,
      bankedShards: updated.scrap,
    };
    saveCampaignProgress(nextProg);
    void idbSet(CAMPAIGN_PROGRESS_STORAGE_KEY, nextProg);

    this.callbacks.onHangarScrapEarned?.(amount);
  }

  private prepareMidRunDraft(): void {
    this.draftPending = true;
    this.draftChoices = pickRogueDraftChoices(
      (this.chapter * 31 + this.episode * 17 + this.score) / 1000,
    );
  }

  public triggerEmp(): boolean {
    if (
      this.gameState !== 'playing' ||
      this.isDyingSequence ||
      this.empCooldownTimer > 0 ||
      (this.mode === 'daily' && this.dailyChallenge.empDisabled)
    ) {
      return false;
    }

    soundFX.unlock();
    soundFX.playEmpBlast();
    const overchargeStacks = this.roguePerks.overcharged_emp;
    const haste = computePlayerStats(this.upgrades, this.hangarLevels).cooldownHaste ?? 1;
    this.empCooldownTimer = Math.max(
      10,
      (EMP_COOLDOWN_SECONDS - overchargeStacks * 4) / haste,
    );
    this.empWaveActive = true;
    this.empWaveX = this.playerX;
    this.empWaveY = this.playerY;
    this.empWaveRadius = 18;
    this.empWaveMaxRadius = Math.hypot(this.width, this.height) * 0.85;
    this.empWaveAlpha = 1;
    this.hitstopTimer = 0.055;
    this.addTrauma(0.5);

    this.emitParticles(this.playerX, this.playerY, '#38bdf8', 32, 340, 0.55, false);
    this.emitParticles(this.playerX, this.playerY, '#00f5d4', 20, 260, 0.45, true);
    this.spawnLabel(this.playerX, this.playerY - 26, 'EMP DISCHARGE', '#38bdf8');

    for (const b of this.bullets) {
      if (b.active && b.fromEnemy) {
        b.active = false;
        this.emitParticles(b.x, b.y, '#38bdf8', 4, 120, 0.25, false);
      }
    }

    const effectiveRadius = EMP_BLAST_RADIUS * (1 + overchargeStacks * 0.35);
    const effectiveDamage = Math.round(EMP_BLAST_DAMAGE * (1 + overchargeStacks * 0.55));

    for (const e of this.enemies) {
      if (e.dyingTimer > 0) continue;

      if (e.kind !== 'boss') {
        e.stunTimer = EMP_STUN_SECONDS;
        e.state = 'approach';
        e.stateTimer = 1.2;
      }
      if (e.shielded) {
        e.shieldOpenTimer = Math.max(e.shieldOpenTimer ?? 0, EMP_STUN_SECONDS + 1.2);
        this.spawnLabel(e.x, e.y - e.radius, 'SHIELD BROKEN', '#38bdf8');
      }

      const dist = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (dist <= effectiveRadius) {
        const dmg =
          e.kind === 'block' ? effectiveDamage : Math.round(effectiveDamage * 0.7);
        e.hp -= dmg;
        e.hitFlash = 0.14;
        this.emitParticles(e.x, e.y, '#38bdf8', 8, 170, 0.3, true);
        if (e.hp <= 0) {
          this.handleEnemyKilled(e);
        }
      }
    }

    this.pushHudSnapshot();
    return true;
  }

  private damagePlayer(
    amount: number,
    sourceX: number,
    sourceY: number,
    attackerTitle?: string,
  ): void {
    // Active Tactical Shield or Twin-Core Fusion Dome absorbs all damage cleanly!
    if (this.tacticalShieldActiveTimer > 0 || this.squadronFusionDocked) {
      this.tacticalShieldPulse = 1;
      soundFX.playShieldReflect();
      this.emitParticles(this.playerX, this.playerY, '#00f5d4', 10, 180, 0.28, false);
      this.spawnLabel(this.playerX, this.playerY - 22, 'SHIELDED', '#00f5d4');
      return;
    }

    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    const res = applyIncomingDamage(this.playerHp, this.playerShield, amount);
    this.episodeDamaged = true;
    this.playerHp = res.hp;
    this.playerShield = res.shield;
    this.shieldRegenTimer = computePlayerStats(
      this.upgrades,
      this.hangarLevels,
    ).shieldRegenDelay;
    this.playerInvuln = 0.85;
    this.playerHitFlash = 0.14;
    this.hitstopTimer = 0.055;
    this.addTrauma(0.55);

    const dx = this.playerX - sourceX;
    const dy = this.playerY - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    this.playerVx = (dx / len) * 260;
    this.playerVy = (dy / len) * 260;

    soundFX.playPlayerHurt();
    this.emitParticles(
      this.playerX,
      this.playerY,
      res.shieldBroken ? '#a3ff12' : '#ff2a5f',
      18,
      240,
      0.42,
      true,
    );
    this.spawnLabel(this.playerX, this.playerY - 18, `-${amount}`, '#ff2a5f');
    this.pushHudSnapshot();

    if (res.lethal) {
      // In Co-op mode, if Teammate is still alive, drop an emergency Revival Beacon!
      if (this.coopActive && !this.teammateDowned) {
        this.playerDowned = true;
        this.playerReviveProgress = 0;
        this.spawnLabel(
          this.playerX,
          this.playerY - 32,
          'EMERGENCY BEACON · AWAITING REVIVE!',
          '#ff2a5f',
        );
        return;
      }

      this.lastDefeatBossName =
        attackerTitle ??
        this.enemies.find((e) => e.isChapterBoss)?.bossTitle ??
        computeChapterBossConfig(this.chapter).title;
      this.isDyingSequence = true;
      this.deathDelayTimer = 0.5;
      soundFX.playExplosion(true);
      this.emitParticles(this.playerX, this.playerY, '#00f5d4', 34, 340, 0.7, true);
    }
  }

  private finalizeGameOver(): void {
    this.isDyingSequence = false;
    this.highScore = saveHighScore(this.score);
    const scrapEarned = Math.max(5, Math.round(this.totalShardsCollected * 0.4 + this.chapter * 6));
    this.awardHangarScrap(scrapEarned);

    if (this.mode === 'daily') {
      recordDailyChallengeRun(
        this.dailyChallenge.id,
        this.score,
        this.chapter,
        this.episode,
      );
    }

    soundFX.playGameOver();
    this.syncBodyState('gameover');
    this.pushHudSnapshot();
    const leaderboard = loadLeaderboard();
    const qualifies = qualifiesForLeaderboard(this.score, leaderboard);
    const defeatOutcome = resolveEpisodeDefeat(this.chapter, this.episode);

    const summary = buildRunSummary({
      mode: this.mode,
      score: this.score,
      previousHighScore: this.initialHighScore,
      qualifiesForLeaderboard: qualifies,
      chapterReached: this.chapter,
      episodeReached: this.episode,
      chaptersCleared: this.chaptersCleared,
      defeatedByBoss10: defeatOutcome.defeatedByBoss10,
      bossNameAtDefeat: defeatOutcome.defeatedByBoss10
        ? this.lastDefeatBossName ?? computeChapterBossConfig(this.chapter).title
        : undefined,
      enemiesDefeated: this.enemiesDefeated,
      bossesDefeated: this.bossesDefeated,
      shardsCollected: this.totalShardsCollected,
      maxCombo: this.maxCombo,
      survivalSeconds: this.totalSurvivalSeconds,
      coopSquadron: this.coopActive,
      scrapEarned,
      grazeTotal: this.grazeCount,
    });
    this.callbacks.onGameOver(summary);
  }

  private triggerEpisodeClear(): void {
    if (!this.episodeDamaged) {
      this.recordAchievementProgress({ perfectEpisodesCleared: 1 });
    }
    this.awardHangarScrap(4 + this.chapter * 2);
    this.prepareMidRunDraft();
    soundFX.playWaveClear();
    this.keysHeld.clear();
    this.pointerActive = false;
    this.joystickActive = false;
    const stats = computePlayerStats(this.upgrades, this.hangarLevels);
    this.playerHp = Math.min(stats.maxHp, this.playerHp + 18);
    this.playerShield = stats.maxShield;
    this.syncBodyState('episode_clear');
    this.pushHudSnapshot();
  }

  private updateOrbs(
    dt: number,
    stats: ReturnType<typeof computePlayerStats>,
  ): void {
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      orb.pulse += dt * 6;
      orb.life -= dt;
      if (orb.life <= 0) {
        orb.active = false;
        continue;
      }

      const dx = this.playerX - orb.x;
      const dy = this.playerY - orb.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist <= stats.magnetRadius) {
        const pull = stats.magnetPullSpeed * (1 + (1 - dist / stats.magnetRadius) * 0.6);
        orb.vx = (dx / dist) * pull;
        orb.vy = (dy / dist) * pull;
      } else {
        orb.vx *= 0.92;
        orb.vy *= 0.92;
      }

      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      if (dist <= this.playerRadius + 14) {
        orb.active = false;
        this.shards += orb.value;
        this.totalShardsCollected += orb.value;
        this.score += orb.value * 25;
        if (this.score > this.highScore) {
          this.highScore = saveHighScore(this.score);
        }
        soundFX.playPickup(this.comboMultiplier);
        this.emitParticles(orb.x, orb.y, '#38bdf8', 6, 130, 0.25, false);
        this.spawnLabel(orb.x, orb.y - 10, `+${orb.value} SHARD`, '#38bdf8');
        this.recordAchievementProgress({ shardsCollected: orb.value });
        this.pushHudSnapshot();
      }
    }
  }

  private spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    life: number,
    fromEnemy: boolean,
    color: string,
    homing = false,
  ): void {
    for (const b of this.bullets) {
      if (!b.active) {
        b.active = true;
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.radius = radius;
        b.damage = damage;
        b.life = life;
        b.fromEnemy = fromEnemy;
        b.color = color;
        b.homing = homing;
        b.grazed = false;
        return;
      }
    }
  }

  private spawnOrb(x: number, y: number, value: number): void {
    const cx = Math.max(24, Math.min(this.width - 24, x));
    const cy = Math.max(24, Math.min(this.height - 24, y));
    for (const orb of this.orbs) {
      if (!orb.active) {
        orb.active = true;
        orb.x = cx;
        orb.y = cy;
        orb.vx = (Math.random() - 0.5) * 40;
        orb.vy = (Math.random() - 0.5) * 40;
        orb.value = value;
        orb.life = 22;
        orb.pulse = Math.random() * Math.PI * 2;
        return;
      }
    }
  }

  private emitParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    maxSpeed: number,
    life: number,
    square: boolean,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const ang = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * maxSpeed;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.size = 2 + Math.random() * 3.5;
      p.life = life * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.color = color;
      p.square = square;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  private spawnLabel(x: number, y: number, text: string, color: string): void {
    const l = this.labels[this.labelCursor];
    this.labelCursor = (this.labelCursor + 1) % LABEL_POOL_SIZE;
    l.active = true;
    l.x = x;
    l.y = y;
    l.vy = -38;
    l.text = text;
    l.color = color;
    l.life = 0.65;
    l.maxLife = 0.65;
  }

  private updateLabels(dt: number): void {
    for (const l of this.labels) {
      if (!l.active) continue;
      l.y += l.vy * dt;
      l.life -= dt;
      if (l.life <= 0) l.active = false;
    }
  }

  private spawnAfterimage(x: number, y: number, angle: number): void {
    const a = this.afterimages[this.afterimageCursor];
    this.afterimageCursor = (this.afterimageCursor + 1) % AFTERIMAGE_POOL_SIZE;
    a.active = true;
    a.x = x;
    a.y = y;
    a.angle = angle;
    a.life = 0.18;
    a.maxLife = 0.18;
  }

  private updateAfterimages(dt: number): void {
    for (const a of this.afterimages) {
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0) a.active = false;
    }
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private buildRadarBlips(): RadarBlip[] {
    const blips: RadarBlip[] = [];
    const halfW = Math.max(1, this.width * 0.5);
    const halfH = Math.max(1, this.height * 0.5);
    const maxZ = Math.max(1, ARENA_MAX_ALTITUDE);

    if (this.coopActive) {
      blips.push({
        id: -1,
        x: Math.max(-1, Math.min(1, (this.teammateX - this.playerX) / halfW)),
        y: Math.max(-1, Math.min(1, (this.teammateY - this.playerY) / halfH)),
        z: Math.max(-1, Math.min(1, (this.teammateZ - this.playerZ) / maxZ)),
        kind: 'teammate',
        label: this.teammateCallsign,
      });
    }

    for (const e of this.enemies) {
      if (e.dyingTimer > 0) continue;
      blips.push({
        id: e.id,
        x: Math.max(-1, Math.min(1, (e.x - this.playerX) / halfW)),
        y: Math.max(-1, Math.min(1, (e.y - this.playerY) / halfH)),
        z: Math.max(-1, Math.min(1, ((e.z ?? 0) - this.playerZ) / maxZ)),
        kind: e.kind,
        isBoss: e.kind === 'boss',
      });
      if (e.kind === 'boss' && e.subsystems) {
        for (let i = 0; i < e.subsystems.length; i++) {
          const s = e.subsystems[i];
          if (!s.destroyed) {
            blips.push({
              id: e.id * 100 + i,
              x: Math.max(-1, Math.min(1, (s.worldX - this.playerX) / halfW)),
              y: Math.max(-1, Math.min(1, (s.worldY - this.playerY) / halfH)),
              z: Math.max(-1, Math.min(1, ((s.worldZ ?? 0) - this.playerZ) / maxZ)),
              kind: 'subsystem',
              label: s.name,
            });
          }
        }
      }
    }
    return blips.slice(0, 28);
  }

  private pushHudSnapshot(): void {
    const stats = computePlayerStats(this.upgrades, this.hangarLevels);
    const boss = this.enemies.find((e) => e.kind === 'boss' && e.dyingTimer <= 0);
    const dashReadyRatio =
      stats.dashCooldown > 0
        ? Math.max(0, Math.min(1, 1 - this.dashCooldownTimer / stats.dashCooldown))
        : 1;

    const pollyStatus: PollyStatus =
      this.pollyActiveTimer > 0
        ? 'assisting'
        : this.pollyCooldownTimer > 0
          ? 'cooldown'
          : 'ready';

    const tetherDist = Math.hypot(
      this.playerX - this.teammateX,
      this.playerY - this.teammateY,
    );
    const linkActive =
      this.coopActive &&
      !this.teammateDowned &&
      !this.playerDowned &&
      (this.squadronLinkActiveTimer > 0 || tetherDist <= SQUADRON_TETHER_MAX_DIST);

    this.callbacks.onHudUpdate({
      mode: this.mode,
      dailyChallengeTitle: this.mode === 'daily' ? this.dailyChallenge.title : '',
      dailyChallengeDescription:
        this.mode === 'daily' ? this.dailyChallenge.description : '',
      empDisabled: this.mode === 'daily' && this.dailyChallenge.empDisabled,
      score: Math.round(this.score),
      highScore: Math.round(this.highScore),
      hp: Math.round(this.playerHp),
      maxHp: Math.round(stats.maxHp),
      shield: Math.round(this.playerShield),
      maxShield: Math.round(stats.maxShield),
      chapter: this.chapter,
      episode: this.episode,
      episodesPerChapter: EPISODES_PER_CHAPTER,
      episodeTimeRemaining: Math.max(0, Math.ceil(this.episodeTimeRemaining)),
      episodeDuration: this.episodeDuration,
      isBossEpisode:
        this.mode === 'campaign' && this.episode === EPISODES_PER_CHAPTER,
      shards: this.shards,
      totalShardsCollected: this.totalShardsCollected,
      enemiesDefeated: this.enemiesDefeated,
      dashReadyRatio,
      comboCount: this.comboCount,
      comboMultiplier: this.comboMultiplier,
      maxCombo: this.maxCombo,
      comboTimeRatio:
        COMBO_WINDOW_SECONDS > 0
          ? Math.max(0, Math.min(1, this.comboTimer / COMBO_WINDOW_SECONDS))
          : 0,
      empCooldownRemaining: Math.max(0, Math.ceil(this.empCooldownTimer)),
      empCooldownTotal: EMP_COOLDOWN_SECONDS,
      tacticalShieldActive: this.tacticalShieldActiveTimer > 0,
      tacticalShieldActiveRemaining: Number(this.tacticalShieldActiveTimer.toFixed(1)),
      tacticalShieldActiveTotal: TACTICAL_SHIELD_DURATION,
      tacticalShieldCooldownRemaining: Math.max(
        0,
        Math.ceil(this.tacticalShieldCooldownTimer),
      ),
      tacticalShieldCooldownTotal: TACTICAL_SHIELD_COOLDOWN,
      pollyStatus,
      pollyActiveRemaining: Number(this.pollyActiveTimer.toFixed(1)),
      pollyActiveTotal: POLLY_ASSIST_DURATION,
      pollyCooldownRemaining: Math.max(0, Math.ceil(this.pollyCooldownTimer)),
      pollyCooldownTotal: POLLY_ASSIST_COOLDOWN,
      bossActive: Boolean(boss),
      bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
      bossMaxHp: boss ? Math.round(boss.maxHp) : 1,
      bossName: boss?.bossTitle ?? computeChapterBossConfig(this.chapter).title,
      bossSubsystems: boss?.subsystems ? [...boss.subsystems] : undefined,
      upgrades: { ...this.upgrades },
      muted: soundFX.isMuted(),
      playerX: Math.round(this.playerX),
      playerY: Math.round(this.playerY),
      playerZ: Math.round(this.playerZ),
      playerVx: Math.round(this.playerVx),
      playerVy: Math.round(this.playerVy),
      playerVz: Math.round(this.playerVz),
      autoFire: this.flightSettings.autoFire,
      touchMode: this.flightSettings.touchMode,
      altitudeKeys: this.flightSettings.altitudeKeys,
      gamepadConnected: this.gamepadConnected,
      coopActive: this.coopActive,
      coopRole: this.coopRole,
      coopRoomCode: this.coopRoomCode,
      teammate: this.coopActive
        ? {
            active: true,
            callsign: this.teammateCallsign,
            skin: this.teammateSkin,
            weapon: this.teammateWeapon,
            hp: Math.round(this.teammateHp),
            maxHp: Math.round(this.teammateMaxHp),
            shield: Math.round(this.teammateShield),
            maxShield: Math.round(this.teammateMaxShield),
            downed: this.teammateDowned,
            reviveProgress: Math.round(
              this.playerDowned ? this.playerReviveProgress : this.teammateReviveProgress,
            ),
            x: this.teammateX,
            y: this.teammateY,
            z: this.teammateZ,
            isAi: this.coopRole === 'ai_wingman',
          }
        : undefined,
      squadronLinkActive: linkActive,
      squadronFusionDocked: this.squadronFusionDocked,
      squadronLinkEnergy: Math.round(this.squadronLinkEnergy),
      squadronLinkCooldownRemaining: Math.max(
        0,
        Math.ceil(this.squadronLinkCooldownTimer),
      ),
      activePing: this.activePing ? { ...this.activePing } : null,
      roguePerks: { ...this.roguePerks },
      draftPending: this.draftPending,
      draftChoices: [...this.draftChoices],
      grazeCount: this.grazeCount,
      grazeSlowMoActive: this.grazeSlowMoTimer > 0,
      radarBlips: this.buildRadarBlips(),
      fpsQuality: this.fpsQuality,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const shakeMag = this.trauma * this.trauma * 14;
    const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

    const tetherDist = Math.hypot(
      this.playerX - this.teammateX,
      this.playerY - this.teammateY,
    );
    const linkActive =
      this.coopActive &&
      !this.teammateDowned &&
      !this.playerDowned &&
      (this.squadronLinkActiveTimer > 0 || tetherDist <= SQUADRON_TETHER_MAX_DIST);

    // Render 3D WebGL Scene (Three.js) first
    const rendered3D = this.renderer3d.render(
      {
        width: this.width,
        height: this.height,
        time: this.titleTime,
        isTitle: this.gameState === 'title',
        quality: this.fpsQuality,
        shakeX,
        shakeY,
        playerX: this.playerX,
        playerY: this.playerY,
        playerZ: this.playerZ,
        playerVx: this.playerVx,
        playerVy: this.playerVy,
        playerVz: this.playerVz,
        playerAngle: this.playerAngle,
        playerSkin: this.selectedShipSkin,
        playerWeapon: this.selectedWeapon,
        playerHitFlash: this.playerHitFlash,
        playerInvuln: this.playerInvuln,
        playerShield: this.playerShield,
        tacticalShieldActive: this.tacticalShieldActiveTimer > 0,
        tacticalShieldPulse: this.tacticalShieldPulse,
        dashRatio: this.dashTimer > 0 ? this.dashTimer / this.dashDuration : 0,
        hangarLevels: this.hangarLevels,
        isDying: this.isDyingSequence,
        pollyActive: this.pollyActiveTimer > 0,
        pollyX: this.pollyX,
        pollyY: this.pollyY,
        pollyAngle: this.pollyAngle,
        pollyBeamFlash: this.pollyBeamFlashTimer,
        pollyBeamTargetX: this.pollyBeamTargetX,
        pollyBeamTargetY: this.pollyBeamTargetY,
        twinPollyActive: this.roguePerks.twin_polly > 0,
        twinPollyX: this.twinPollyX,
        twinPollyY: this.twinPollyY,
        twinPollyAngle: this.twinPollyAngle,
        coopActive: this.coopActive,
        teammateX: this.teammateX,
        teammateY: this.teammateY,
        teammateVx: this.teammateVx,
        teammateVy: this.teammateVy,
        teammateAngle: this.teammateAngle,
        teammateSkin: this.teammateSkin,
        teammateDowned: this.teammateDowned,
        squadronLinkActive: linkActive,
        squadronFusionDocked: this.squadronFusionDocked,
        empActive: this.empWaveActive,
        empX: this.empWaveX,
        empY: this.empWaveY,
        empRadius: this.empWaveRadius,
        empAlpha: this.empWaveAlpha,
        enemies: this.enemies,
        bullets: this.bullets,
        orbs: this.orbs,
        particles: this.particles,
        hazards: this.hazards,
      },
      ctx,
    );

    if (!rendered3D) {
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (!rendered3D) {
      this.renderCyberGrid(ctx);
      this.renderAmbientMotes(ctx);
    }

    if (this.gameState === 'title') {
      this.renderTitleHeroCore(ctx);
      ctx.restore();
      ctx.restore();
      return;
    }

    if (this.empWaveActive) {
      ctx.save();
      ctx.globalAlpha = this.empWaveAlpha;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(this.empWaveX, this.empWaveY, this.empWaveRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(
        this.empWaveX,
        this.empWaveY,
        Math.max(4, this.empWaveRadius - 10),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }

    // High-voltage Co-op Squadron Energy Tether Overlay
    if (linkActive && !this.squadronFusionDocked) {
      this.renderSquadronTetherOverlay(ctx);
    }

    // Chain-Lightning Projectile Arcs
    for (const arc of this.lightningArcs) {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const midX = (arc.x1 + arc.x2) * 0.5 + (Math.random() - 0.5) * 24;
      const midY = (arc.y1 + arc.y2) * 0.5 + (Math.random() - 0.5) * 24;
      ctx.lineTo(midX, midY);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.restore();
    }

    if (!rendered3D) {
      this.renderOrbs(ctx);
      this.renderHazards(ctx);
    }
    this.renderAfterimages(ctx);
    this.renderEnemies(ctx);
    if (!rendered3D) {
      this.renderBullets(ctx);
    }

    if (!this.isDyingSequence) {
      this.renderPlayer(ctx);
      if (this.coopActive) {
        this.renderCoopTeammateOverlay(ctx);
      }
      if (this.pollyActiveTimer > 0) {
        this.renderPollyWingman(ctx);
      }
    }

    if (!rendered3D) {
      this.renderParticles(ctx);
    }
    this.renderLabels(ctx);

    if (this.pointerActive && this.gameState === 'playing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.playerX, this.playerY);
      ctx.lineTo(this.pointerWorldX, this.pointerWorldY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(this.pointerWorldX, this.pointerWorldY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
      ctx.stroke();
      ctx.restore();
    }

    const bannerBaseY =
      this.height < 460 ? 128 : this.width < 768 ? 224 : 172;

    if (this.bossBannerTimer > 0) {
      const alpha = Math.min(1, this.bossBannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 18px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.35)';
      ctx.lineWidth = 6;
      ctx.strokeText(this.bossBannerText, this.width * 0.5, bannerBaseY);
      ctx.fillStyle = '#ff007f';
      ctx.fillText(this.bossBannerText, this.width * 0.5, bannerBaseY);
      ctx.restore();
    }

    if (this.pollyBannerTimer > 0) {
      const alpha = Math.min(1, this.pollyBannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a3ff12';
      ctx.fillText('POLLY PARTNER ASSIST · SALVO ENGAGED', this.width * 0.5, bannerBaseY + 26);
      ctx.restore();
    }

    ctx.restore();

    if (this.gameState === 'playing' && this.playerHp <= 30 && !this.isDyingSequence) {
      const pulse = 0.14 + Math.sin(this.titleTime * 8) * 0.06;
      const grad = ctx.createRadialGradient(
        this.width * 0.5,
        this.height * 0.5,
        Math.min(this.width, this.height) * 0.35,
        this.width * 0.5,
        this.height * 0.5,
        Math.max(this.width, this.height) * 0.72,
      );
      grad.addColorStop(0, 'rgba(255, 42, 95, 0)');
      grad.addColorStop(1, `rgba(255, 42, 95, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private renderSquadronTetherOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle =
      this.squadronLinkActiveTimer > 0
        ? 'rgba(0, 245, 212, 0.95)'
        : 'rgba(192, 132, 252, 0.7)';
    ctx.lineWidth = this.squadronLinkActiveTimer > 0 ? 4.5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(this.playerX, this.playerY);
    const segments = 6;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const lx =
        this.playerX +
        (this.teammateX - this.playerX) * t +
        Math.sin(this.titleTime * 32 + i) * 7;
      const ly =
        this.playerY +
        (this.teammateY - this.playerY) * t +
        Math.cos(this.titleTime * 32 + i) * 7;
      ctx.lineTo(lx, ly);
    }
    ctx.lineTo(this.teammateX, this.teammateY);
    ctx.stroke();
    ctx.restore();
  }

  private renderCoopTeammateOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const mx = this.squadronFusionDocked ? this.playerX : this.teammateX;
    const my = this.squadronFusionDocked ? this.playerY + 18 : this.teammateY;

    if (this.teammateDowned || this.playerDowned) {
      const bx = this.teammateDowned ? this.teammateX : this.playerX;
      const by = this.teammateDowned ? this.teammateY : this.playerY;
      const prog =
        (this.teammateDowned
          ? this.teammateReviveProgress
          : this.playerReviveProgress) / 100;

      ctx.strokeStyle = 'rgba(255, 42, 95, 0.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(bx, by, 95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#a3ff12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(bx, by, 28, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff2a5f';
      ctx.fillText(
        `REVIVE BEACON · ${Math.round(prog * 100)}%`,
        bx,
        by - 36,
      );
      ctx.restore();
      return;
    }

    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = getShipSkinConfig(this.teammateSkin).hullColor;
    ctx.fillText(
      this.squadronFusionDocked
        ? `TWIN-CORE GUNSHIP [${this.teammateCallsign}]`
        : this.teammateCallsign,
      mx,
      my - 22,
    );
    ctx.restore();
  }

  private renderCyberGrid(ctx: CanvasRenderingContext2D): void {
    const gridSize = 56;
    const parallaxX =
      this.gameState === 'title'
        ? (this.pointerHoverX - this.width * 0.5) * -0.02 + this.titleTime * 10
        : (this.playerX - this.width * 0.5) * -0.04;
    const parallaxY =
      this.gameState === 'title'
        ? (this.pointerHoverY - this.height * 0.5) * -0.02 + this.titleTime * 6
        : (this.playerY - this.height * 0.5) * -0.04;

    const offsetX = ((parallaxX % gridSize) + gridSize) % gridSize;
    const offsetY = ((parallaxY % gridSize) + gridSize) % gridSize;

    ctx.save();
    const comboColor =
      this.comboMultiplier >= 8
        ? '255, 0, 127'
        : this.comboMultiplier >= 5
          ? '0, 245, 212'
          : this.comboMultiplier >= 2
            ? '163, 255, 18'
            : '30, 58, 95';
    const comboPulse =
      this.comboMultiplier > 1
        ? 0.28 + Math.sin(this.titleTime * (2 + this.comboMultiplier * 0.45)) * 0.08
        : 0.28;
    ctx.strokeStyle = `rgba(${comboColor}, ${comboPulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = offsetY; y < this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderAmbientMotes(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const m of this.bgMotes) {
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = m.color;
      ctx.fillRect(m.x, m.y, m.size, m.size);
    }
    ctx.restore();
  }

  private renderHazards(ctx: CanvasRenderingContext2D): void {
    for (const hazard of this.hazards) {
      ctx.save();
      ctx.translate(hazard.x, hazard.y);
      ctx.rotate(hazard.angle);
      ctx.fillStyle = 'rgba(255, 107, 53, 0.14)';
      ctx.strokeStyle = 'rgba(255, 107, 53, 0.82)';
      ctx.lineWidth = 2;
      this.drawPolygon(ctx, 0, 0, hazard.radius, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderTitleHeroCore(ctx: CanvasRenderingContext2D): void {
    const cx = this.playerX;
    const cy = this.playerY;

    ctx.save();
    for (let r = 0; r < 2; r++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.titleTime * (r === 0 ? 0.35 : -0.5));
      ctx.strokeStyle =
        r === 0 ? 'rgba(0, 245, 212, 0.24)' : 'rgba(255, 0, 127, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash(r === 0 ? [18, 12] : [8, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, 86 + r * 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 130);
    glow.addColorStop(0, 'rgba(0, 245, 212, 0.22)');
    glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.06)');
    glow.addColorStop(1, 'rgba(11, 15, 25, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.playerAngle);
    ctx.scale(1.65, 1.65);
    this.drawShipGeometry(ctx, false);
    ctx.restore();

    ctx.save();
    ctx.translate(this.pollyX, this.pollyY);
    ctx.rotate(this.pollyAngle);
    ctx.scale(1.2, 1.2);
    this.drawPollyGeometry(ctx);
    ctx.restore();

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (this.playerInvuln > 0 && Math.floor(this.playerInvuln * 18) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
    } else {
      ctx.save();
    }

    const stats = computePlayerStats(this.upgrades, this.hangarLevels);

    if (this.upgrades.magnet > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, stats.magnetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.playerShield > 0 && this.tacticalShieldActiveTimer <= 0) {
      const shieldAlpha = 0.28 + Math.sin(this.titleTime * 6) * 0.08;
      ctx.save();
      ctx.strokeStyle = `rgba(163, 255, 18, ${shieldAlpha + 0.3})`;
      ctx.fillStyle = `rgba(163, 255, 18, ${shieldAlpha * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, this.playerRadius + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.tacticalShieldActiveTimer > 0 || this.squadronFusionDocked) {
      const pulse =
        0.4 + Math.sin(this.titleTime * 16) * 0.12 + this.tacticalShieldPulse * 0.3;
      const barrierR = this.playerRadius + (this.squadronFusionDocked ? 24 : 16);
      ctx.save();
      ctx.translate(this.playerX, this.playerY);

      ctx.fillStyle = `rgba(0, 245, 212, ${0.14 + this.tacticalShieldPulse * 0.18})`;
      ctx.beginPath();
      ctx.arc(0, 0, barrierR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(0, 245, 212, ${Math.min(1, pulse + 0.35)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, barrierR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(this.titleTime * 2.8);
      ctx.strokeStyle = '#a3ff12';
      ctx.lineWidth = 1.8;
      this.drawPolygon(ctx, 0, 0, barrierR - 3, 6);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(this.playerX, this.playerY);
    ctx.rotate(this.playerAngle);
    ctx.scale(this.playerScaleX, this.playerScaleY);

    this.drawShipGeometry(ctx, this.playerHitFlash > 0);
    ctx.restore();
  }

  private renderPollyWingman(ctx: CanvasRenderingContext2D): void {
    if (this.pollyBeamFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.pollyBeamFlashTimer * 10);
      ctx.strokeStyle = 'rgba(163, 255, 18, 0.38)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.pollyX, this.pollyY);
      ctx.lineTo(this.pollyBeamTargetX, this.pollyBeamTargetY);
      ctx.stroke();

      ctx.strokeStyle = '#a3ff12';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.pollyX, this.pollyY);
      ctx.lineTo(this.pollyBeamTargetX, this.pollyBeamTargetY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.pollyX, this.pollyY);
    ctx.rotate(this.pollyAngle);
    this.drawPollyGeometry(ctx);
    ctx.restore();

    ctx.save();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a3ff12';
    ctx.fillText('POLLY', this.pollyX, this.pollyY - 18);
    ctx.restore();
  }

  private drawPollyGeometry(ctx: CanvasRenderingContext2D): void {
    const colors = getShipSkinConfig(this.selectedShipSkin);
    ctx.strokeStyle = `${colors.hullColor}59`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 11);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = colors.hullColor;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.trailColor;
    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawShipGeometry(
    ctx: CanvasRenderingContext2D,
    isHitFlash: boolean,
  ): void {
    const colors = getShipSkinConfig(this.selectedShipSkin);
    const flameLen = 10 + Math.sin(this.titleTime * 40) * 3;
    ctx.fillStyle = `${colors.trailColor}59`;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-14 - flameLen, 0);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.trailColor;
    ctx.beginPath();
    ctx.moveTo(-10, -3.5);
    ctx.lineTo(-10 - flameLen, 0);
    ctx.lineTo(-10, 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 13);
    ctx.closePath();

    ctx.strokeStyle = isHitFlash ? 'rgba(255,255,255,0.45)' : `${colors.hullColor}47`;
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#ffffff' : '#0f172a';
    ctx.strokeStyle = isHitFlash ? '#ffffff' : colors.hullColor;
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#ffffff' : colors.trailColor;
    ctx.beginPath();
    ctx.arc(2, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D): void {
    for (const a of this.afterimages) {
      if (!a.active) continue;
      const alpha = (a.life / a.maxLife) * 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -13);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 13);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      ctx.save();
      const isDying = e.dyingTimer > 0;
      const flash = e.hitFlash > 0;

      if (isDying) {
        const t = e.dyingTimer / 0.22;
        ctx.globalAlpha = t;
        ctx.translate(e.x, e.y);
        ctx.scale(1 + (1 - t) * 0.7, 1 + (1 - t) * 0.7);
      } else {
        ctx.translate(e.x, e.y);
      }

      if (!isDying && e.stunTimer > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (!isDying && e.shielded && (e.shieldOpenTimer ?? 0) <= 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (!isDying && e.state === 'telegraph') {
        if (e.kind === 'interceptor') {
          ctx.save();
          ctx.rotate(e.aimAngle);
          ctx.strokeStyle = 'rgba(255, 42, 95, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(360, 0);
          ctx.stroke();
          ctx.restore();
        } else if (
          e.kind === 'boss' &&
          (e.bossArchetype === 'sentinel' || e.bossArchetype === 'leviathan') &&
          (e.attackPhase ?? 0) % 2 === 0
        ) {
          const beams = e.laserCount ?? 2;
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.72)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          for (let k = 0; k < beams; k++) {
            const ang = (e.laserAngle ?? e.aimAngle) + (k / beams) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * e.radius, Math.sin(ang) * e.radius);
            ctx.lineTo(Math.cos(ang) * 820, Math.sin(ang) * 820);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          const progress = 1 - e.stateTimer / (e.kind === 'boss' ? 0.65 : 0.55);
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 8 + progress * 24, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (!isDying && e.kind === 'boss' && (e.laserActiveTimer ?? 0) > 0) {
        const beams = e.laserCount ?? 2;
        ctx.save();
        for (let k = 0; k < beams; k++) {
          const ang = (e.laserAngle ?? 0) + (k / beams) * Math.PI * 2;
          const sx = Math.cos(ang) * (e.radius + 4);
          const sy = Math.sin(ang) * (e.radius + 4);
          const ex = Math.cos(ang) * 820;
          const ey = Math.sin(ang) * 820;

          ctx.strokeStyle = 'rgba(255, 0, 127, 0.34)';
          ctx.lineWidth = 16;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = '#ff007f';
          ctx.lineWidth = 6.5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(e.angle);

      if (e.kind === 'boss') {
        const sides = e.isChapterBoss ? 8 : 6;
        this.drawPolygon(ctx, 0, 0, e.radius, sides);
        ctx.strokeStyle = flash ? 'rgba(255,255,255,0.45)' : 'rgba(255, 0, 127, 0.34)';
        ctx.lineWidth = e.isChapterBoss ? 12 : 10;
        ctx.stroke();

        ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 0, 127, 0.24)';
        ctx.strokeStyle = flash ? '#ffffff' : '#ff007f';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        if (e.isChapterBoss && !isDying) {
          ctx.save();
          ctx.rotate(e.angle * 2);
          ctx.translate(0, -e.radius * 0.68);
          const pulse = 0.78 + Math.sin(this.titleTime * 9) * 0.22;
          ctx.globalAlpha = pulse;
          ctx.fillStyle = '#a3ff12';
          this.drawPolygon(ctx, 0, 0, 6, 4);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // Render Capital Starship Destructible Subsystem Lock-On Brackets!
      if (!isDying && e.kind === 'boss' && e.subsystems) {
        for (const sub of e.subsystems) {
          const lx = sub.worldX - e.x;
          const ly = sub.worldY - e.y;
          ctx.save();
          ctx.translate(lx, ly);
          if (sub.destroyed) {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-6, -6);
            ctx.lineTo(6, 6);
            ctx.moveTo(6, -6);
            ctx.lineTo(-6, 6);
            ctx.stroke();
          } else {
            const bracketColor =
              sub.hitFlash > 0
                ? '#ffffff'
                : sub.kind === 'central_core'
                  ? '#a3ff12'
                  : sub.kind === 'shield_gen'
                    ? '#38bdf8'
                    : '#ff6b35';
            ctx.strokeStyle = bracketColor;
            ctx.lineWidth = 1.8;
            ctx.strokeRect(-10, -10, 20, 20);
            const pct = Math.max(0, sub.hp / Math.max(1, sub.maxHp));
            ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
            ctx.fillRect(-11, -16, 22, 3.5);
            ctx.fillStyle = bracketColor;
            ctx.fillRect(-11, -16, 22 * pct, 3.5);
          }
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  private drawPolygon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    sides: number,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      const px = cx + Math.cos(ang) * radius;
      const py = cy + Math.sin(ang) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const b of this.bullets) {
      if (!b.active) continue;

      if (b.fromEnemy) {
        ctx.fillStyle = 'rgba(255, 0, 127, 0.28)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const ang = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.fillStyle = b.color;
        ctx.fillRect(-9, -2, 18, 4);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private renderOrbs(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      const scale = 1 + Math.sin(orb.pulse) * 0.16;
      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(5.5, 0);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-5.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.square) {
        const s = p.size * alpha + 1;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderLabels(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const l of this.labels) {
      if (!l.active) continue;
      ctx.globalAlpha = Math.max(0, l.life / l.maxLife);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.x, l.y);
    }
    ctx.restore();
  }
}
