import React from 'react';
import type { AchievementDefinition } from '../game/achievements';

interface AchievementToastProps {
  achievement: AchievementDefinition | null;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
}) => {
  if (!achievement) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="achievement-toast"
      className="absolute bottom-[68px] left-2.5 sm:bottom-20 sm:left-5 z-20 pointer-events-none max-w-[calc(100%-1.25rem)] sm:max-w-sm animate-modal-enter"
    >
      <div
        className="flex items-center gap-3 bg-[#0e1424]/95 border rounded-lg px-4 py-3 shadow-[0_6px_28px_rgba(0,0,0,0.7)]"
        style={{ borderColor: achievement.accentColor }}
      >
        <div
          className="w-9 h-9 rounded-md bg-[#0b0f19] border flex items-center justify-center shrink-0"
          style={{ borderColor: `${achievement.accentColor}66` }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke={achievement.accentColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M7 6H4v2a3 3 0 0 0 3 3" />
            <path d="M17 6h3v2a3 3 0 0 1-3 3" />
          </svg>
        </div>

        <div className="min-w-0">
          <p
            className="text-[10px] font-mono-num uppercase tracking-widest font-bold"
            style={{ color: achievement.accentColor }}
          >
            Achievement Unlocked
          </p>
          <p className="font-display text-sm sm:text-base font-bold text-slate-100 truncate">
            {achievement.title}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
};
