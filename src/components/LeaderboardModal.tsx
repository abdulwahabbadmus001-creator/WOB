import React, { useEffect } from 'react';
import { formatLeaderboardDate } from '../game/leaderboard';
import { EPISODES_PER_CHAPTER } from '../game/rules';
import type { LeaderboardEntry } from '../game/types';

interface LeaderboardModalProps {
  entries: readonly LeaderboardEntry[];
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  entries,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/85 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
      data-testid="leaderboard-modal"
    >
      <div className="animate-modal-enter w-full max-w-2xl max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 sm:p-7 [@media(max-height:500px)]:p-4 shadow-[0_0_50px_rgba(0,245,212,0.14)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <p className="text-xs font-mono-num uppercase tracking-widest text-[#a3ff12]">
              WOB · Top 10 Campaign Records
            </p>
            <h2
              id="leaderboard-title"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-0.5"
            >
              Leaderboard
            </h2>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close leaderboard"
            className="px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-display font-bold uppercase tracking-wider text-slate-200 hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-8 text-center my-4">
            <p className="font-display text-base font-semibold text-slate-300">
              No high scores recorded yet
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              Complete a WOB Campaign run with Tommy &amp; Polly to claim Rank #1.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 my-4">
            {entries.map((entry, idx) => {
              const isTopThree = idx < 3;
              const rankColor =
                idx === 0
                  ? '#a3ff12'
                  : idx === 1
                    ? '#00f5d4'
                    : idx === 2
                      ? '#ff007f'
                      : '#94a3b8';

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 bg-[#0b0f19] border border-slate-800/90 rounded-lg px-3.5 py-2.5"
                  style={{
                    borderColor: isTopThree ? `${rankColor}55` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="font-mono-num text-sm font-bold w-7 shrink-0"
                      style={{ color: rankColor }}
                    >
                      #{idx + 1}
                    </span>
                    <span className="font-mono-num text-sm sm:text-base font-bold tracking-widest text-slate-100 bg-[#111827] border border-slate-700/80 rounded px-2 py-0.5">
                      {entry.initials}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono-num font-semibold text-[#00f5d4]">
                          Ch. {entry.chapterReached} · Ep. {entry.episodeReached}/
                          {EPISODES_PER_CHAPTER}
                        </span>
                        <span className="hidden sm:inline text-slate-600">·</span>
                        <span className="hidden sm:inline font-mono-num text-slate-400">
                          {entry.maxCombo}x Max
                        </span>
                      </div>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {formatLeaderboardDate(entry.dateIso)}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono-num text-base sm:text-lg font-bold text-slate-100 shrink-0">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
