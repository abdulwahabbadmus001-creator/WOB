import { useEffect, useRef, useState } from 'react';
import { AchievementsModal } from './components/AchievementsModal';
import { AchievementToast } from './components/AchievementToast';
import { CoopLobbyModal } from './components/CoopLobbyModal';
import { GameHud } from './components/GameHud';
import { HangarModal } from './components/HangarModal';
import { InitialsModal } from './components/InitialsModal';
import { InstallModal } from './components/InstallModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ShopModal } from './components/ShopModal';
import {
  ChapterVictoryModal,
  GameOverModal,
  PauseModal,
} from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import {
  ACHIEVEMENT_CATALOG,
  loadAchievementState,
  type AchievementDefinition,
  type AchievementStoreState,
} from './game/achievements';
import { type CoopStartOptions, WobGameEngine } from './game/engine';
import {
  getProjectedRank,
  insertLeaderboardEntry,
  loadLeaderboard,
  saveLeaderboard,
} from './game/leaderboard';
import {
  enqueueLeaderboardSync,
  flushLeaderboardSyncQueue,
  hydrateProgressFromIndexedDb,
  loadPendingSyncQueue,
  syncAllProgressToIndexedDb,
} from './game/persistence';
import {
  applyHangarUpgradePurchase,
  BASE_EPISODE_DURATION_SECONDS,
  createInitialUpgrades,
  EMP_COOLDOWN_SECONDS,
  EPISODES_PER_CHAPTER,
  type HangarStoreState,
  loadFlightControlSettings,
  loadHangarState,
  loadHighScore,
  POLLY_ASSIST_COOLDOWN,
  POLLY_ASSIST_DURATION,
  saveHangarState,
  TACTICAL_SHIELD_COOLDOWN,
  TACTICAL_SHIELD_DURATION,
} from './game/rules';
import type {
  FlightControlSettings,
  GameMode,
  GameState,
  HangarUpgradeId,
  HudSnapshot,
  LeaderboardEntry,
  RogueDraftId,
  RunSummary,
  ShipSkin,
  TacticalPingKind,
  UpgradeId,
  WeaponType,
} from './game/types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INITIAL_HUD: HudSnapshot = {
  mode: 'campaign',
  dailyChallengeTitle: '',
  dailyChallengeDescription: '',
  empDisabled: false,
  score: 0,
  highScore: loadHighScore(),
  hp: 100,
  maxHp: 100,
  shield: 0,
  maxShield: 0,
  chapter: 1,
  episode: 1,
  episodesPerChapter: EPISODES_PER_CHAPTER,
  episodeTimeRemaining: BASE_EPISODE_DURATION_SECONDS,
  episodeDuration: BASE_EPISODE_DURATION_SECONDS,
  isBossEpisode: false,
  shards: 0,
  totalShardsCollected: 0,
  enemiesDefeated: 0,
  dashReadyRatio: 1,
  comboCount: 0,
  comboMultiplier: 1,
  maxCombo: 1,
  comboTimeRatio: 0,
  empCooldownRemaining: 0,
  empCooldownTotal: EMP_COOLDOWN_SECONDS,
  tacticalShieldActive: false,
  tacticalShieldActiveRemaining: 0,
  tacticalShieldActiveTotal: TACTICAL_SHIELD_DURATION,
  tacticalShieldCooldownRemaining: 0,
  tacticalShieldCooldownTotal: TACTICAL_SHIELD_COOLDOWN,
  pollyStatus: 'ready',
  pollyActiveRemaining: 0,
  pollyActiveTotal: POLLY_ASSIST_DURATION,
  pollyCooldownRemaining: 0,
  pollyCooldownTotal: POLLY_ASSIST_COOLDOWN,
  bossActive: false,
  bossHp: 0,
  bossMaxHp: 1,
  bossName: 'CORE SENTINEL',
  upgrades: createInitialUpgrades(),
  muted: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WobGameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [achievementState, setAchievementState] = useState<AchievementStoreState>(
    () => loadAchievementState(),
  );
  const [hangarState, setHangarState] = useState<HangarStoreState>(() =>
    loadHangarState(),
  );
  const [flightSettings, setFlightSettings] = useState<FlightControlSettings>(() =>
    loadFlightControlSettings(),
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard(),
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(
    () => loadPendingSyncQueue().length,
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const [toastQueue, setToastQueue] = useState<AchievementDefinition[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInitialsPrompt, setShowInitialsPrompt] = useState(false);
  const [showHangar, setShowHangar] = useState(false);
  const [hangarPreviewSkin, setHangarPreviewSkin] = useState<ShipSkin>('cyan');
  const [showCoopLobby, setShowCoopLobby] = useState(false);
  const [coopDefaults, setCoopDefaults] = useState<{
    mode: GameMode;
    weapon: WeaponType;
    skin: ShipSkin;
    roomCode?: string;
  }>({
    mode: 'campaign',
    weapon: 'spread',
    skin: 'cyan',
  });
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [savedRank, setSavedRank] = useState<number | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });

  const activeToast = toastQueue[0] ?? null;
  const isIos =
    typeof navigator !== 'undefined' &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // Hydrate & sync offline progress with IndexedDB + handle background leaderboard sync
  useEffect(() => {
    void hydrateProgressFromIndexedDb({
      onHighScore: (score) =>
        setHud((prev) => ({ ...prev, highScore: Math.max(prev.highScore, score) })),
      onHangar: (state) => {
        setHangarState(state);
        engineRef.current?.setHangarUpgrades(state.levels);
      },
      onAchievements: (state) => setAchievementState(state),
      onLeaderboard: (entries) => setLeaderboard(entries),
    }).then(() => {
      void syncAllProgressToIndexedDb();
    });

    const handleOnline = () => {
      setIsOnline(true);
      setLeaderboard((prev) => {
        const res = flushLeaderboardSyncQueue(prev);
        setPendingSyncCount(0);
        return res.board;
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSwMessage = (ev: MessageEvent) => {
      if (ev.data && ev.data.type === 'FLUSH_OFFLINE_SYNC_QUEUE') {
        handleOnline();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // PWA beforeinstallprompt & display-mode: standalone tracking
  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setShowInstallModal(false);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOverlayOpen(
      showAchievements ||
        showLeaderboard ||
        showInitialsPrompt ||
        showHangar ||
        showCoopLobby ||
        showInstallModal,
    );
  }, [
    showAchievements,
    showLeaderboard,
    showInitialsPrompt,
    showHangar,
    showCoopLobby,
    showInstallModal,
  ]);

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      setToastQueue((prev) => prev.slice(1));
    }, 3400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeToast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new WobGameEngine(canvas, {
      onStateChange: (nextState) => {
        setGameState(nextState);
        if (nextState === 'playing') {
          setShowAchievements(false);
          setShowLeaderboard(false);
          setShowInitialsPrompt(false);
          setShowHangar(false);
          setShowCoopLobby(false);
          setShowInstallModal(false);
        }
      },
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onGameOver: (summary) => {
        setRunSummary(summary);
        setSavedRank(null);
        setHangarState(loadHangarState());
        setShowInitialsPrompt(summary.qualifiesForLeaderboard);
        void syncAllProgressToIndexedDb();
      },
      onAchievementUpdate: (nextAchievements, newlyUnlocked) => {
        setAchievementState(nextAchievements);
        if (newlyUnlocked.length > 0) {
          setToastQueue((prev) => [...prev, ...newlyUnlocked]);
        }
        void syncAllProgressToIndexedDb();
      },
      onHangarScrapEarned: () => {
        setHangarState(loadHangarState());
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    const params = new URLSearchParams(window.location.search);
    const coopInviteCode = params.get('coop');
    if (coopInviteCode) {
      setCoopDefaults((prev) => ({
        ...prev,
        roomCode: coopInviteCode.toUpperCase(),
      }));
      setShowCoopLobby(true);
    } else if (params.get('autostart') === '1') {
      engine.startNewGame(false);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const requestImmersiveDisplay = () => {
    const appRoot = document.documentElement;
    const requestLandscape = () => {
      if (typeof screen.orientation?.lock === 'function') {
        void screen.orientation.lock('landscape').catch((error: unknown) => {
          console.info('WOB landscape orientation lock is unavailable:', error);
        });
      }
    };

    if (!document.fullscreenElement && typeof appRoot.requestFullscreen === 'function') {
      void appRoot
        .requestFullscreen()
        .then(requestLandscape)
        .catch((error: unknown) => {
          console.info('WOB fullscreen mode is unavailable:', error);
          requestLandscape();
        });
    } else {
      requestLandscape();
    }
  };

  const handleStart = (
    mode: GameMode = 'campaign',
    weapon: WeaponType = 'spread',
    skin: ShipSkin = 'cyan',
    coopOptions?: CoopStartOptions,
  ) => {
    requestImmersiveDisplay();
    setShowAchievements(false);
    setShowLeaderboard(false);
    setShowInitialsPrompt(false);
    setShowHangar(false);
    setShowCoopLobby(false);
    setShowInstallModal(false);
    engineRef.current?.startNewGame(true, 1, 1, mode, weapon, skin, coopOptions);
  };

  const handleInstall = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
        }
        setInstallPrompt(null);
      } catch (error) {
        console.error('WOB installation prompt failed:', error);
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleBuyHangarUpgrade = (id: HangarUpgradeId) => {
    const res = applyHangarUpgradePurchase(id, hangarState);
    if (!res.purchased) return;
    saveHangarState(res.state);
    setHangarState(res.state);
    engineRef.current?.setHangarUpgrades(res.state.levels);
    void syncAllProgressToIndexedDb();
  };

  const handleRetryChapter = (chapter: number) => {
    setShowAchievements(false);
    setShowLeaderboard(false);
    setShowInitialsPrompt(false);
    engineRef.current?.retryChapterFromEpisode1(chapter);
  };

  const handleToggleMute = () => {
    engineRef.current?.toggleMute();
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleReturnTitle = () => {
    setShowInitialsPrompt(false);
    engineRef.current?.returnToTitle();
  };

  const handleBuyUpgrade = (id: UpgradeId) => {
    engineRef.current?.buyUpgrade(id);
  };

  const handleSelectRogueDraft = (id: RogueDraftId) => {
    engineRef.current?.selectRogueDraft(id);
  };

  const handleContinueEpisode = () => {
    engineRef.current?.continueNextEpisode();
  };

  const handleAdvanceChapter = () => {
    engineRef.current?.advanceToNextChapter();
  };

  const handleActivateShield = () => {
    engineRef.current?.activateTacticalShield();
  };

  const handleTriggerPolly = () => {
    engineRef.current?.triggerPollyAssist(false);
  };

  const handleTriggerEmp = () => {
    engineRef.current?.triggerEmp();
  };

  const handleTriggerDash = () => {
    engineRef.current?.triggerDash();
  };

  const handleTriggerSquadronLink = () => {
    engineRef.current?.triggerSquadronLink(true);
  };

  const handleSendTacticalPing = (kind: TacticalPingKind) => {
    engineRef.current?.sendTacticalPing(kind);
  };

  const handleVirtualJoystick = (dx: number, dy: number, active: boolean) => {
    engineRef.current?.setVirtualJoystick(dx, dy, active);
  };

  const handleAltitudeControl = (vzRatio: number) => {
    engineRef.current?.setAltitudeControl(vzRatio);
  };

  const handleManualFireHeld = (held: boolean) => {
    engineRef.current?.setManualFireHeld(held);
  };

  const handleToggleAutoFire = () => {
    const nextAuto = engineRef.current?.toggleAutoFire();
    if (typeof nextAuto === 'boolean') {
      setFlightSettings((prev) => ({ ...prev, autoFire: nextAuto }));
    }
  };

  const handleUpdateFlightSettings = (next: FlightControlSettings) => {
    setFlightSettings(next);
    engineRef.current?.setFlightSettings(next);
  };

  const handleSaveInitials = (initials: string) => {
    if (!runSummary) return;
    const rank = getProjectedRank(runSummary.score, leaderboard);
    const updated = insertLeaderboardEntry(leaderboard, {
      initials,
      score: runSummary.score,
      chapterReached: runSummary.chapterReached,
      episodeReached: runSummary.episodeReached,
      maxCombo: runSummary.maxCombo,
      mode: runSummary.mode,
      synced: isOnline,
      coop: runSummary.coopSquadron,
    });
    const persisted = saveLeaderboard(updated);
    setLeaderboard(persisted);

    if (!isOnline) {
      const addedEntry = persisted.find(
        (e) => e.score === runSummary.score && e.initials === initials,
      );
      if (addedEntry) {
        const q = enqueueLeaderboardSync(addedEntry);
        setPendingSyncCount(q.length);
      }
    }
    void syncAllProgressToIndexedDb();
    setSavedRank(rank);
    setShowInitialsPrompt(false);
  };

  return (
    <main className="wob-viewport-shell">
      <div className="wob-stage" data-testid="wob-stage">
        {/* Isolated 60fps HTML5 3D WebGL + Tactical Overlay Canvas container */}
        <div className="absolute inset-0 z-0">
          <canvas
            ref={canvasRef}
            data-testid="game-canvas"
            className="block w-full h-full cursor-crosshair touch-none"
          />
        </div>

        {gameState === 'title' && (
          <TitleOverlay
            highScore={hud.highScore}
            muted={hud.muted}
            unlockedCount={achievementState.unlockedIds.length}
            totalAchievements={ACHIEVEMENT_CATALOG.length}
            hangarScrap={hangarState.scrap}
            isStandalone={isStandalone}
            onStart={(mode, weapon, skin) => handleStart(mode, weapon, skin)}
            onOpenCoopLobby={(mode, weapon, skin) => {
              setCoopDefaults({ mode, weapon, skin });
              setShowCoopLobby(true);
            }}
            onOpenHangar={(skin) => {
              setHangarPreviewSkin(skin);
              setShowHangar(true);
            }}
            onToggleMute={handleToggleMute}
            onInstall={!isStandalone ? handleInstall : undefined}
            installHelp={isIos && !isStandalone}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onOpenAchievements={() => setShowAchievements(true)}
          />
        )}

        {gameState !== 'title' && (
          <GameHud
            hud={hud}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            onRestart={() => handleStart(hud.mode)}
            onActivateShield={handleActivateShield}
            onTriggerPolly={handleTriggerPolly}
            onTriggerEmp={handleTriggerEmp}
            onTriggerDash={handleTriggerDash}
            onTriggerSquadronLink={handleTriggerSquadronLink}
            onSendTacticalPing={handleSendTacticalPing}
            onVirtualJoystick={handleVirtualJoystick}
            onAltitudeControl={handleAltitudeControl}
            onManualFireHeld={handleManualFireHeld}
            onToggleAutoFire={handleToggleAutoFire}
          />
        )}

        {gameState === 'paused' && (
          <PauseModal
            hud={hud}
            flightSettings={flightSettings}
            onUpdateFlightSettings={handleUpdateFlightSettings}
            onResume={handleResume}
            onRestart={() => handleStart(hud.mode)}
            onTitle={handleReturnTitle}
          />
        )}

        {gameState === 'episode_clear' && (
          <ShopModal
            hud={hud}
            onBuyUpgrade={handleBuyUpgrade}
            onSelectRogueDraft={handleSelectRogueDraft}
            onContinue={handleContinueEpisode}
          />
        )}

        {gameState === 'chapter_victory' && (
          <ChapterVictoryModal
            hud={hud}
            onAdvanceChapter={handleAdvanceChapter}
            onTitle={handleReturnTitle}
          />
        )}

        {gameState === 'gameover' && runSummary && !showInitialsPrompt && (
          <GameOverModal
            summary={runSummary}
            savedRank={savedRank}
            onRetryChapter={handleRetryChapter}
            onPlayAgain={() => handleStart(runSummary.mode)}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onTitle={handleReturnTitle}
          />
        )}

        {gameState === 'gameover' && runSummary && showInitialsPrompt && (
          <InitialsModal
            summary={runSummary}
            projectedRank={getProjectedRank(runSummary.score, leaderboard)}
            onSubmit={handleSaveInitials}
            onSkip={() => setShowInitialsPrompt(false)}
          />
        )}

        {showCoopLobby && (
          <CoopLobbyModal
            highScore={hud.highScore}
            initialMode={coopDefaults.mode}
            initialSkin={coopDefaults.skin}
            initialWeapon={coopDefaults.weapon}
            initialRoomCode={coopDefaults.roomCode}
            onLaunchCoop={(mode, weapon, skin, coopOptions) =>
              handleStart(mode, weapon, skin, coopOptions)
            }
            onClose={() => setShowCoopLobby(false)}
          />
        )}

        {showHangar && (
          <HangarModal
            hangar={hangarState}
            skin={hangarPreviewSkin}
            onBuyHangarUpgrade={handleBuyHangarUpgrade}
            onClose={() => setShowHangar(false)}
          />
        )}

        {showInstallModal && (
          <InstallModal
            isIos={isIos}
            onClose={() => setShowInstallModal(false)}
          />
        )}

        {showLeaderboard && (
          <LeaderboardModal
            entries={leaderboard}
            pendingSyncCount={pendingSyncCount}
            isOnline={isOnline}
            onClose={() => setShowLeaderboard(false)}
          />
        )}

        {showAchievements && (
          <AchievementsModal
            state={achievementState}
            onClose={() => setShowAchievements(false)}
          />
        )}

        <AchievementToast achievement={activeToast} />
      </div>
    </main>
  );
}
