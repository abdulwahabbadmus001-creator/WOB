import React from 'react';
import {
  canPurchaseUpgrade,
  computeChapterBossConfig,
  EPISODES_PER_CHAPTER,
  getUpgradeCost,
  UPGRADE_CATALOG,
} from '../game/rules';
import type { HudSnapshot, RogueDraftId, UpgradeId } from '../game/types';

interface ShopModalProps {
  hud: HudSnapshot;
  onBuyUpgrade: (id: UpgradeId) => void;
  onSelectRogueDraft?: (id: RogueDraftId) => void;
  onContinue: () => void;
}

const UpgradeIcon: React.FC<{ id: UpgradeId; color: string }> = ({ id, color }) => {
  if (id === 'speed') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  if (id === 'multishot') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="2">
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="18" x2="4" y2="6" />
        <line x1="18" y1="18" x2="20" y2="6" />
      </svg>
    );
  }
  if (id === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={color} strokeWidth="2">
      <path d="M6 15a6 6 0 1 0 12 0V5h-4v10a2 2 0 1 1-4 0V5H6v10z" />
    </svg>
  );
};

export const ShopModal: React.FC<ShopModalProps> = ({
  hud,
  onBuyUpgrade,
  onSelectRogueDraft,
  onContinue,
}) => {
  const nextEpisode = Math.min(EPISODES_PER_CHAPTER, hud.episode + 1);
  const nextIsBoss10 = nextEpisode === EPISODES_PER_CHAPTER;
  const chapterBoss = computeChapterBossConfig(hud.chapter);
  const draftPending = Boolean(hud.draftPending && hud.draftChoices && hud.draftChoices.length > 0);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#070a12]/80 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="episode-clear-title"
      data-testid="episode-transition-modal"
    >
      <div className="animate-modal-enter w-full max-w-2xl max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 sm:p-6 [@media(max-height:500px)]:p-3.5 shadow-[0_0_50px_rgba(0,245,212,0.14)]">
        {/* Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 [@media(max-height:500px)]:pb-2 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs [@media(max-height:500px)]:text-[10px] font-mono-num uppercase tracking-widest text-[#a3ff12]">
              Chapter {hud.chapter} · Episode {hud.episode}/{hud.episodesPerChapter}
            </p>
            <h2
              id="episode-clear-title"
              className="font-display text-xl sm:text-2xl [@media(max-height:500px)]:text-lg font-bold text-slate-100 mt-0.5"
            >
              Episode {hud.episode} Cleared · Tactical Bay
            </h2>
          </div>

          <div className="shrink-0 flex items-center gap-2 bg-[#0b0f19] border border-[#38bdf8]/40 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 [@media(max-height:500px)]:px-2.5 [@media(max-height:500px)]:py-1">
            <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true">
              <polygon
                points="12,2 20,12 12,22 4,12"
                fill="#38bdf8"
                stroke="#e0f2fe"
                strokeWidth="1.5"
              />
            </svg>
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400">
                Available Shards
              </span>
              <span
                data-testid="shop-shards"
                className="font-mono-num text-lg sm:text-xl [@media(max-height:500px)]:text-base font-bold leading-none text-[#38bdf8]"
              >
                {hud.shards}
              </span>
            </div>
          </div>
        </div>

        {/* Mid-Run Rogue-Lite Tactical Draft (Pick 1 of 3 stackable perks) */}
        {draftPending && hud.draftChoices && onSelectRogueDraft && (
          <div
            data-testid="tactical-draft-section"
            className="mt-3.5 bg-[#0b0f19] border border-[#00f5d4]/60 rounded-xl p-3 sm:p-4"
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-mono-num font-bold uppercase tracking-widest text-[#00f5d4]">
                Mid-Run Tactical Draft · Pick 1 of 3 Free Stackable Perks
              </span>
              <span className="text-[10px] font-mono-num text-[#a3ff12]">
                Rogue-Lite Overdrive
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {hud.draftChoices.map((choice) => {
                const stacks = hud.roguePerks?.[choice.id] ?? 0;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`draft-option-${choice.id}`}
                    onClick={() => onSelectRogueDraft(choice.id)}
                    className="text-left flex flex-col justify-between gap-2 bg-[#111827] border border-slate-700 hover:border-[#00f5d4] rounded-lg p-2.5 transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-display font-bold text-xs sm:text-sm"
                          style={{ color: choice.accentColor }}
                        >
                          {choice.title}
                        </span>
                        {stacks > 0 && (
                          <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                            x{stacks}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                        {choice.description}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono-num font-bold uppercase tracking-wider text-[#00f5d4] group-hover:underline">
                      Draft Module →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {nextIsBoss10 && (
          <div className="mt-3 [@media(max-height:500px)]:mt-2 bg-[#ff007f]/10 border border-[#ff007f]/60 rounded-lg px-3.5 py-2 [@media(max-height:500px)]:py-1.5">
            <p className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#ff007f]">
              Episode 10 Capital Dreadnought Warning · {chapterBoss.title}
            </p>
            <p className="text-xs text-slate-300 mt-0.5 [@media(max-height:500px)]:hidden">
              {chapterBoss.subtitle}. Target its destructible subsystems to disable weapons!
            </p>
          </div>
        )}

        {/* 4 Tactical Upgrades for Tommy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 [@media(max-height:500px)]:gap-2 my-3.5 sm:my-4 [@media(max-height:500px)]:my-2">
          {UPGRADE_CATALOG.map((cfg) => {
            const level = hud.upgrades[cfg.id];
            const isMaxed = level >= cfg.maxLevel;
            const cost = getUpgradeCost(cfg.id, level);
            const affordable = canPurchaseUpgrade(cfg.id, hud.upgrades, hud.shards);

            return (
              <div
                key={cfg.id}
                className="flex flex-col justify-between gap-2.5 sm:gap-4 [@media(max-height:500px)]:gap-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg p-3 sm:p-4 [@media(max-height:500px)]:p-2.5"
              >
                <div className="flex items-start gap-3 [@media(max-height:500px)]:gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 [@media(max-height:500px)]:w-7 [@media(max-height:500px)]:h-7 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-center shrink-0">
                    <UpgradeIcon id={cfg.id} color={cfg.accentColor} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm sm:text-base [@media(max-height:500px)]:text-xs text-slate-100">
                        {cfg.name}
                      </h3>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        [{cfg.hotkey}]
                      </span>
                    </div>
                    <p className="text-xs [@media(max-height:500px)]:text-[10px] text-slate-400 mt-0.5 leading-snug">
                      {cfg.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div className="flex items-center gap-1.5" aria-label={`Rank ${level} of ${cfg.maxLevel}`}>
                    {Array.from({ length: cfg.maxLevel }).map((_, idx) => (
                      <span
                        key={idx}
                        className="w-3.5 h-1.5 rounded-xs"
                        style={{
                          backgroundColor:
                            idx < level ? cfg.accentColor : '#1e293b',
                        }}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={!affordable || isMaxed}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onBuyUpgrade(cfg.id);
                    }}
                    className={`px-3.5 py-2 [@media(max-height:500px)]:px-2.5 [@media(max-height:500px)]:py-1 rounded-md text-xs font-mono-num font-bold transition-colors whitespace-nowrap ${
                      isMaxed
                        ? 'bg-slate-800/70 text-slate-500 cursor-default'
                        : affordable
                          ? 'bg-[#00f5d4] text-[#0b0f19] hover:bg-[#38ffe5] cursor-pointer'
                          : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {isMaxed ? 'Max Rank' : `Buy · ${cost}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Smooth Transition Prompt: Tap to Proceed / Continue */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 sm:pt-4 [@media(max-height:500px)]:pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-400 font-mono-num">
            {nextIsBoss10
              ? `Polly standby ready for Episode 10 Dreadnought Encounter`
              : `Next: Chapter ${hud.chapter} · Episode ${nextEpisode}/${hud.episodesPerChapter}`}
          </p>
          <button
            type="button"
            data-testid="continue-episode-button"
            onClick={(e) => {
              e.currentTarget.blur();
              onContinue();
            }}
            className={`w-full sm:w-auto px-6 py-3.5 [@media(max-height:500px)]:py-2 rounded-lg font-display font-bold text-sm [@media(max-height:500px)]:text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap ${
              nextIsBoss10
                ? 'bg-[#ff007f] text-white hover:bg-[#ff2693] shadow-[0_0_24px_rgba(255,0,127,0.35)]'
                : 'bg-[#00f5d4] text-[#0b0f19] hover:bg-[#38ffe5] shadow-[0_0_20px_rgba(0,245,212,0.3)]'
            }`}
          >
            {nextIsBoss10
              ? `Tap to Proceed · Episode 10 Boss`
              : `Tap to Proceed · Episode ${nextEpisode}`}
          </button>
        </div>
      </div>
    </div>
  );
};
