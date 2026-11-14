import { useEffect, useRef, useState } from 'react';
import { AchievementsModal } from './components/AchievementsModal';
import { AchievementToast } from './components/AchievementToast';
import { GameHud } from './components/GameHud';
import { InitialsModal } from './components/InitialsModal';
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
import { WobGameEngine } from './game/engine';
import {
  getProjectedRank,
  insertLeaderboardEntry,
  loadLeaderboard,
  saveLeaderboard,
} from './game/leaderboard';
import {
  BASE_EPISODE_DURATION_SECONDS,
  createInitialUpgrades,
  EMP_COOLDOWN_SECONDS,
  EPISODES_PER_CHAPTER,
  loadHighScore,
  POLLY_ASSIST_COOLDOWN,
  POLLY_ASSIST_DURATION,
  TACTICAL_SHIELD_COOLDOWN,
  TACTICAL_SHIELD_DURATION,
} from './game/rules';
import type {
  GameState,
  HudSnapshot,
  LeaderboardEntry,
  RunSummary,
  UpgradeId,
} from './game/types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INITIAL_HUD: HudSnapshot = {
  mode: 'campaign',
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard(),
  );
  const [toastQueue, setToastQueue] = useState<AchievementDefinition[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInitialsPrompt, setShowInitialsPrompt] = useState(false);
  const [savedRank, setSavedRank] = useState<number | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const activeToast = toastQueue[0] ?? null;
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOverlayOpen(
      showAchievements || showLeaderboard || showInitialsPrompt,
    );
  }, [showAchievements, showLeaderboard, showInitialsPrompt]);

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
        }
      },
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onGameOver: (summary) => {
        setRunSummary(summary);
        setSavedRank(null);
        setShowInitialsPrompt(summary.qualifiesForLeaderboard);
      },
      onAchievementUpdate: (nextAchievements, newlyUnlocked) => {
        setAchievementState(nextAchievements);
        if (newlyUnlocked.length > 0) {
          setToastQueue((prev) => [...prev, ...newlyUnlocked]);
        }
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewGame(false);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    const appRoot = document.documentElement;
    const requestLandscape = () => {
      if (typeof screen.orientation?.lock === 'function') {
        void screen.orientation.lock('landscape').catch((error: unknown) => {
          console.info('WOB landscape orientation lock is unavailable:', error);
        });
      }
    };

    if (!document.fullscreenElement && typeof appRoot.requestFullscreen === 'function') {
      void appRoot.requestFullscreen().then(requestLandscape).catch((error: unknown) => {
        console.info('WOB fullscreen mode is unavailable:', error);
        requestLandscape();
      });
    } else {
      requestLandscape();
    }

    setShowAchievements(false);
    setShowLeaderboard(false);
    setShowInitialsPrompt(false);
    engineRef.current?.startNewGame(true, 1, 1);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error('WOB installation prompt failed:', error);
    }
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
    });
    const persisted = saveLeaderboard(updated);
    setLeaderboard(persisted);
    setSavedRank(rank);
    setShowInitialsPrompt(false);
  };

  return (
    <main className="wob-viewport-shell">
      <div className="wob-stage" data-testid="wob-stage">
        {/* Isolated 60fps HTML5 Canvas container */}
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
          onStart={handleStart}
          onToggleMute={handleToggleMute}
          onInstall={installPrompt ? handleInstall : undefined}
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
          onRestart={handleStart}
          onActivateShield={handleActivateShield}
          onTriggerPolly={handleTriggerPolly}
          onTriggerEmp={handleTriggerEmp}
        />
      )}

      {gameState === 'paused' && (
        <PauseModal
          hud={hud}
          onResume={handleResume}
          onRestart={handleStart}
          onTitle={handleReturnTitle}
        />
      )}

      {gameState === 'episode_clear' && (
        <ShopModal
          hud={hud}
          onBuyUpgrade={handleBuyUpgrade}
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
          onPlayAgain={handleStart}
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

      {showLeaderboard && (
        <LeaderboardModal
          entries={leaderboard}
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
