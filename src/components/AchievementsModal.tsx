import React, { useEffect } from 'react';
import {
  ACHIEVEMENT_CATALOG,
  type AchievementStoreState,
} from '../game/achievements';

interface AchievementsModalProps {
  state: AchievementStoreState;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  state,
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

  const unlockedSet = new Set(state.unlockedIds);
  const unlockedCount = state.unlockedIds.length;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/85 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-title"
    >
      <div className="animate-modal-enter w-full max-w-2xl max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 sm:p-7 [@media(max-height:500px)]:p-4 shadow-[0_0_50px_rgba(0,245,212,0.12)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <p className="text-xs font-mono-num uppercase tracking-widest text-[#00f5d4]">
              {unlockedCount} / {ACHIEVEMENT_CATALOG.length} Unlocked
            </p>
            <h2
              id="achievements-title"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-0.5"
            >
              Achievements
            </h2>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close achievements"
            className="px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-display font-bold uppercase tracking-wider text-slate-200 hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
          {ACHIEVEMENT_CATALOG.map((item) => {
            const isUnlocked = unlockedSet.has(item.id);
            const currentVal = Math.min(
              item.target,
              state.progress[item.metric],
            );
            const pct = Math.max(
              0,
              Math.min(100, (currentVal / item.target) * 100),
            );

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2.5 bg-[#0b0f19] border rounded-lg p-3.5"
                style={{
                  borderColor: isUnlocked ? `${item.accentColor}88` : '#1e293b',
                }}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-md bg-[#111827] border flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        borderColor: isUnlocked ? item.accentColor : '#1e293b',
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4"
                        fill="none"
                        stroke={isUnlocked ? item.accentColor : '#475569'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M8 21h8" />
                        <path d="M12 17v4" />
                        <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={`font-display font-bold text-sm truncate ${
                          isUnlocked ? 'text-slate-100' : 'text-slate-300'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono-num">
                    <span
                      style={{
                        color: isUnlocked ? item.accentColor : '#94a3b8',
                      }}
                    >
                      {isUnlocked ? 'Unlocked' : 'In Progress'}
                    </span>
                    <span className="text-slate-300">
                      {currentVal.toLocaleString()} / {item.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden">
                    <div
                      className="h-full transition-all duration-200"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isUnlocked
                          ? item.accentColor
                          : '#334155',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
