import React, { useEffect, useRef, useState } from 'react';
import { sanitizeInitials } from '../game/leaderboard';
import { EPISODES_PER_CHAPTER } from '../game/rules';
import type { RunSummary } from '../game/types';

interface InitialsModalProps {
  summary: RunSummary;
  projectedRank: number;
  onSubmit: (initials: string) => void;
  onSkip: () => void;
}

export const InitialsModal: React.FC<InitialsModalProps> = ({
  summary,
  projectedRank,
  onSubmit,
  onSkip,
}) => {
  const [initials, setInitials] = useState('TMY');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(sanitizeInitials(initials));
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/88 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initials-title"
      data-block-hotkeys="true"
      data-testid="initials-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="animate-modal-enter w-full max-w-md max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#a3ff12]/60 rounded-xl p-5 sm:p-7 [@media(max-height:500px)]:p-4 shadow-[0_0_50px_rgba(163,255,18,0.18)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-mono-num uppercase tracking-widest text-[#a3ff12]">
            WOB Top 10 · Rank #{projectedRank}
          </p>
          <span className="text-xs font-mono-num uppercase text-[#00f5d4]">
            Ch. {summary.chapterReached} · Ep. {summary.episodeReached}/{EPISODES_PER_CHAPTER}
          </span>
        </div>

        <h2
          id="initials-title"
          className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-1"
        >
          New Leaderboard Record
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
          Score{' '}
          <span className="font-mono-num font-bold text-slate-100">
            {summary.score.toLocaleString()}
          </span>{' '}
          qualifies for the WOB hall of fame. Enter your 3-letter callsign.
        </p>

        <div className="my-5">
          <label
            htmlFor="player-initials"
            className="block text-[11px] font-mono-num uppercase tracking-widest text-slate-400 mb-2"
          >
            3-Letter Initials
          </label>
          <input
            ref={inputRef}
            id="player-initials"
            data-testid="initials-input"
            type="text"
            maxLength={3}
            value={initials}
            onChange={(e) => {
              const next = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 3);
              setInitials(next);
            }}
            placeholder="TMY"
            className="w-full text-center font-mono-num text-3xl font-bold tracking-[0.55em] uppercase bg-[#0b0f19] border border-[#00f5d4]/70 rounded-lg py-3 px-4 text-[#00f5d4] focus:outline-none focus:border-[#a3ff12]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            data-testid="save-initials-button"
            className="w-full sm:flex-1 py-3 px-5 rounded-lg bg-[#a3ff12] text-[#0b0f19] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#b8ff47] active:scale-[0.98] transition-all cursor-pointer"
          >
            Save Score
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full sm:w-auto py-3 px-5 rounded-lg bg-[#111827] text-slate-300 border border-slate-700 font-display font-bold text-sm uppercase tracking-wider hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
};
