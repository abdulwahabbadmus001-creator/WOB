import React, { useEffect, useState } from 'react';
import { formatShareRunText } from '../game/leaderboard';
import { computeChapterBossConfig } from '../game/rules';
import type {
  AltitudeKeyMode,
  FlightControlSettings,
  HudSnapshot,
  RunSummary,
  TouchControlMode,
} from '../game/types';

interface PauseModalProps {
  hud: HudSnapshot;
  flightSettings?: FlightControlSettings;
  onUpdateFlightSettings?: (next: FlightControlSettings) => void;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  flightSettings,
  onUpdateFlightSettings,
  onResume,
  onRestart,
  onTitle,
}) => {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/80 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="animate-modal-enter w-full max-w-md max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#1e293b] rounded-xl p-5 sm:p-7 [@media(max-height:500px)]:p-4 shadow-[0_0_40px_rgba(0,0,0,0.65)]">
        <p className="text-xs font-mono-num uppercase tracking-widest text-[#00f5d4]">
          WOB · Chapter {hud.chapter} · Episode {hud.episode}/{hud.episodesPerChapter} ·{' '}
          {hud.score.toLocaleString()} pts
        </p>
        <h2
          id="pause-title"
          className="font-display text-3xl font-bold text-slate-100 mt-1 mb-4"
        >
          Mission Paused
        </h2>

        {/* 6-DOF Manual Flight & Touch Control Settings */}
        {flightSettings && onUpdateFlightSettings && (
          <div className="mb-5 bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5 space-y-2.5 text-xs">
            <p className="text-[10px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
              6-Direction Manual Flight Settings
            </p>

            <label className="flex items-center justify-between gap-2 text-slate-300">
              <span>Mobile Touch Mode</span>
              <select
                aria-label="Mobile Touch Mode"
                value={flightSettings.touchMode}
                onChange={(e) =>
                  onUpdateFlightSettings({
                    ...flightSettings,
                    touchMode: e.target.value as TouchControlMode,
                  })
                }
                className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-slate-100"
              >
                <option value="dual_stick">Floating Stick + Altitude</option>
                <option value="direct_touch">1:1 Direct Finger Tracking</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-2 text-slate-300">
              <span>Up / Down Elevation Keys</span>
              <select
                aria-label="Up / Down Elevation Keys"
                value={flightSettings.altitudeKeys}
                onChange={(e) =>
                  onUpdateFlightSettings({
                    ...flightSettings,
                    altitudeKeys: e.target.value as AltitudeKeyMode,
                  })
                }
                className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-slate-100"
              >
                <option value="space_shift">Space (Up) / Shift (Down)</option>
                <option value="q_e">Q (Up) / E (Down)</option>
                <option value="r_f">R (Up) / F (Down)</option>
              </select>
            </label>

            <div className="flex items-center justify-between gap-2 text-slate-300 pt-1">
              <span>Weapon Trigger</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateFlightSettings({
                    ...flightSettings,
                    autoFire: !flightSettings.autoFire,
                  })
                }
                className="px-2.5 py-1 rounded bg-[#111827] border border-slate-700 font-mono-num text-[11px] font-bold text-[#00f5d4] cursor-pointer"
              >
                {flightSettings.autoFire ? 'Auto-Fire ON' : 'Manual Trigger [J]'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full py-3 px-5 rounded-lg bg-[#00f5d4] text-[#0b0f19] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#38ffe5] transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-full py-3 px-5 rounded-lg bg-[#111827] text-slate-200 border border-slate-700 font-display font-bold text-sm uppercase tracking-wider hover:border-[#ff007f] hover:text-[#ff007f] transition-colors cursor-pointer"
          >
            Restart Campaign
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="w-full py-2.5 px-5 rounded-lg text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChapterVictoryModalProps {
  hud: HudSnapshot;
  onAdvanceChapter: () => void;
  onTitle: () => void;
}

export const ChapterVictoryModal: React.FC<ChapterVictoryModalProps> = ({
  hud,
  onAdvanceChapter,
  onTitle,
}) => {
  const defeatedBoss = computeChapterBossConfig(hud.chapter);
  const nextBoss = computeChapterBossConfig(hud.chapter + 1);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/85 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-victory-title"
      data-testid="chapter-victory-modal"
    >
      <div className="animate-modal-enter w-full max-w-lg max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#a3ff12]/65 rounded-xl p-5 sm:p-8 [@media(max-height:500px)]:p-4 shadow-[0_0_50px_rgba(163,255,18,0.2)]">
        <p className="text-xs font-mono-num uppercase tracking-widest text-[#a3ff12]">
          WOB · Chapter {hud.chapter} Cleared (10/10 Episodes)
        </p>
        <h2
          id="chapter-victory-title"
          className="font-display text-3xl sm:text-4xl font-bold text-slate-100 mt-1"
        >
          Chapter {hud.chapter} Victory!
        </h2>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          Tommy &amp; Polly shattered <span className="text-[#ff007f] font-semibold">{defeatedBoss.title}</span>. Tommy&apos;s hull &amp; shield are fully restored for Chapter {hud.chapter + 1}.
        </p>

        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Current Score
            </span>
            <p className="font-mono-num text-2xl font-bold text-[#00f5d4] mt-1">
              {hud.score.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Next Apex Threat
            </span>
            <p className="font-display text-sm sm:text-base font-bold text-[#ff007f] mt-1.5">
              {nextBoss.title}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-testid="next-chapter-button"
            onClick={(e) => {
              e.currentTarget.blur();
              onAdvanceChapter();
            }}
            className="w-full py-3.5 px-6 rounded-lg bg-[#a3ff12] text-[#0b0f19] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#bfff55] active:scale-[0.98] transition-all cursor-pointer"
          >
            Proceed to Chapter {hud.chapter + 1} · Episode 1
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="w-full py-2.5 px-4 rounded-lg bg-[#111827] text-slate-300 border border-slate-700 font-display font-bold text-xs uppercase tracking-wider hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  summary: RunSummary;
  savedRank: number | null;
  onRetryChapter: (chapter: number) => void;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
  onTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  savedRank,
  onRetryChapter,
  onPlayAgain,
  onOpenLeaderboard,
  onTitle,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleShareRun = async () => {
    const shareText = formatShareRunText(summary);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareText);
      } else {
        const el = document.createElement('textarea');
        el.value = shareText;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/85 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      data-testid="gameover-modal"
    >
      <div className="animate-modal-enter w-full max-w-lg max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#ff2a5f]/50 rounded-xl p-5 sm:p-8 [@media(max-height:500px)]:p-4 shadow-[0_0_50px_rgba(255,42,95,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-mono-num uppercase tracking-widest text-[#ff2a5f]">
            WOB · Tommy Core Lost
          </p>
          <div className="flex items-center gap-2.5">
            {savedRank !== null && (
              <span className="text-xs font-mono-num font-bold uppercase tracking-wider text-[#00f5d4]">
                Saved Rank #{savedRank}
              </span>
            )}
            {summary.isNewHighScore && (
              <span className="text-xs font-mono-num font-bold uppercase tracking-wider text-[#a3ff12]">
                New High Score
              </span>
            )}
          </div>
        </div>

        <h2
          id="gameover-title"
          className="font-display text-3xl sm:text-4xl font-bold text-slate-100 mt-1 mb-3"
        >
          {summary.defeatedByBoss10 ? 'Boss 10 Defeat' : 'Game Over'}
        </h2>

        {summary.defeatedByBoss10 && (
          <div
            data-testid="boss10-penalty-banner"
            className="mb-5 bg-[#ff2a5f]/12 border border-[#ff2a5f]/60 rounded-lg px-3.5 py-2.5"
          >
            <p className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#ff2a5f]">
              Episode 10 Boss Penalty Applied
            </p>
            <p className="text-xs text-slate-200 mt-0.5">
              Tommy was destroyed by {summary.bossNameAtDefeat ?? 'the Chapter Boss'}. Progress resets to Chapter {summary.chapterReached} · Episode 1.
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Final Score
            </span>
            <p
              data-testid="gameover-score"
              className="font-mono-num text-2xl font-bold text-[#00f5d4] mt-1"
            >
              {summary.score.toLocaleString()}
            </p>
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              High Score
            </span>
            <p
              data-testid="gameover-best"
              className="font-mono-num text-2xl font-bold text-[#a3ff12] mt-1"
            >
              {summary.highScore.toLocaleString()}
            </p>
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Stage Reached
            </span>
            <p className="font-mono-num text-lg sm:text-xl font-bold text-[#ff007f] mt-1">
              Ch. {summary.chapterReached} · Ep. {summary.episodeReached}/10
            </p>
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Max Combo · Cleared
            </span>
            <p className="font-mono-num text-xl font-bold text-slate-100 mt-1">
              {summary.maxCombo}x · {summary.enemiesDefeated}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {summary.defeatedByBoss10 ? (
              <button
                type="button"
                data-start="true"
                data-testid="retry-chapter-button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRetryChapter(summary.chapterReached);
                }}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-lg bg-[#00f5d4] text-[#0b0f19] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#38ffe5] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                Retry Chapter {summary.chapterReached} · Ep. 1
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPlayAgain();
                }}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-lg bg-[#00f5d4] text-[#0b0f19] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#38ffe5] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                Play Again
              </button>
            )}

            <button
              type="button"
              data-testid="share-run-button"
              onClick={(e) => {
                e.currentTarget.blur();
                void handleShareRun();
              }}
              className={`w-full sm:w-auto py-3.5 px-5 rounded-lg border font-display font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                copied
                  ? 'bg-[#a3ff12]/15 border-[#a3ff12] text-[#a3ff12]'
                  : 'bg-[#111827] border-[#38bdf8]/60 text-[#38bdf8] hover:border-[#38bdf8] hover:bg-[#38bdf8]/10'
              }`}
            >
              {copied ? 'Copied!' : 'Share Run'}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenLeaderboard();
              }}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#111827] text-slate-200 border border-slate-700 font-display font-bold text-xs uppercase tracking-wider hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer whitespace-nowrap"
            >
              Leaderboard
            </button>
            {summary.defeatedByBoss10 && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPlayAgain();
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#111827] text-slate-300 border border-slate-700 font-display font-bold text-xs uppercase tracking-wider hover:border-[#ff007f] hover:text-[#ff007f] transition-colors cursor-pointer whitespace-nowrap"
              >
                New Ch. 1
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onTitle();
              }}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#111827] text-slate-300 border border-slate-700 font-display font-bold text-xs uppercase tracking-wider hover:border-slate-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
