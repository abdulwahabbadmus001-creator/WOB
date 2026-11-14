import React, { useEffect, useRef, useState } from 'react';
import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onActivateShield: () => void;
  onTriggerPolly: () => void;
  onTriggerEmp: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onToggleMute,
  onPause,
  onRestart,
  onActivateShield,
  onTriggerPolly,
  onTriggerEmp,
}) => {
  const [ghostHpPct, setGhostHpPct] = useState(100);
  const ghostTimeoutRef = useRef<number | null>(null);
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const shieldPct =
    hud.maxShield > 0
      ? Math.max(0, Math.min(100, (hud.shield / hud.maxShield) * 100))
      : 0;

  useEffect(() => {
    if (hpPct >= ghostHpPct) {
      setGhostHpPct(hpPct);
      return;
    }
    if (ghostTimeoutRef.current !== null) {
      window.clearTimeout(ghostTimeoutRef.current);
    }
    ghostTimeoutRef.current = window.setTimeout(() => {
      setGhostHpPct(hpPct);
    }, 260);
    return () => {
      if (ghostTimeoutRef.current !== null) {
        window.clearTimeout(ghostTimeoutRef.current);
      }
    };
  }, [hpPct, ghostHpPct]);

  const mins = Math.floor(hud.episodeTimeRemaining / 60);
  const secs = hud.episodeTimeRemaining % 60;
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const empReady = hud.empCooldownRemaining <= 0;
  const empChargePct = empReady
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          ((hud.empCooldownTotal - hud.empCooldownRemaining) /
            Math.max(1, hud.empCooldownTotal)) *
            100,
        ),
      );

  const shieldReady = !hud.tacticalShieldActive && hud.tacticalShieldCooldownRemaining <= 0;
  const tacticalShieldBarPct = hud.tacticalShieldActive
    ? Math.max(
        0,
        Math.min(
          100,
          (hud.tacticalShieldActiveRemaining / Math.max(0.1, hud.tacticalShieldActiveTotal)) *
            100,
        ),
      )
    : shieldReady
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((hud.tacticalShieldCooldownTotal - hud.tacticalShieldCooldownRemaining) /
              Math.max(1, hud.tacticalShieldCooldownTotal)) *
              100,
          ),
        );

  const pollyReady = hud.pollyStatus === 'ready';
  const pollyAssisting = hud.pollyStatus === 'assisting';
  const pollyBarPct = pollyAssisting
    ? Math.max(
        0,
        Math.min(
          100,
          (hud.pollyActiveRemaining / Math.max(0.1, hud.pollyActiveTotal)) * 100,
        ),
      )
    : pollyReady
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((hud.pollyCooldownTotal - hud.pollyCooldownRemaining) /
              Math.max(1, hud.pollyCooldownTotal)) *
              100,
          ),
        );

  const comboAccentClass =
    hud.comboMultiplier >= 8
      ? 'text-[#ff007f] border-[#ff007f]/70'
      : hud.comboMultiplier >= 5
        ? 'text-[#00f5d4] border-[#00f5d4]/70'
        : hud.comboMultiplier >= 2
          ? 'text-[#a3ff12] border-[#a3ff12]/65'
          : 'text-slate-300 border-slate-700/80';

  const comboBarClass =
    hud.comboMultiplier >= 8
      ? 'bg-[#ff007f]'
      : hud.comboMultiplier >= 5
        ? 'bg-[#00f5d4]'
        : hud.comboMultiplier >= 2
          ? 'bg-[#a3ff12]'
          : 'bg-slate-400';

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-5 [@media(max-height:500px)]:p-2">
      {/* Top Perimeter Clusters */}
      <div className="flex flex-wrap md:flex-nowrap items-start justify-between gap-2 sm:gap-2.5">
        {/* Top-Left: Tommy Vitality, Armor Shield & Dash */}
        <div className="flex flex-col gap-1 sm:gap-2 [@media(max-height:500px)]:gap-1 min-w-[122px] sm:min-w-[210px] [@media(max-height:500px)]:min-w-[144px] bg-[#0b0f19]/88 border border-[#1e293b] rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                aria-hidden="true"
              >
                <polygon
                  points="12,2 21,7 21,15 12,22 3,15 3,7"
                  fill="#0f172a"
                  stroke="#00f5d4"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill={hud.hp <= 30 ? '#ff2a5f' : '#a3ff12'}
                />
              </svg>
              <span className="text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-widest text-[#00f5d4]">
                Tommy
              </span>
            </div>
            <span
              data-testid="hud-hp"
              className={`font-mono-num text-xs sm:text-sm font-bold ${
                hud.hp <= 30 ? 'text-[#ff2a5f]' : 'text-slate-100'
              }`}
            >
              {hud.hp}/{hud.maxHp}
            </span>
          </div>

          <div className="relative h-2 sm:h-2.5 w-full bg-slate-900 rounded-sm overflow-hidden border border-slate-800">
            <div
              className="absolute inset-y-0 left-0 bg-[#ff2a5f]/55 transition-all duration-300"
              style={{ width: `${ghostHpPct}%` }}
            />
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-100 ${
                hud.hp <= 30 ? 'bg-[#ff2a5f]' : 'bg-[#00f5d4]'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {hud.maxShield > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 flex-1 bg-slate-900 rounded-sm overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#a3ff12] transition-all duration-100"
                  style={{ width: `${shieldPct}%` }}
                />
              </div>
              <span className="font-mono-num text-[10px] sm:text-[11px] font-semibold text-[#a3ff12]">
                ARM {hud.shield}
              </span>
            </div>
          )}

          <div className="hidden sm:flex items-center justify-between gap-2 text-[10px] font-mono-num">
            <span className="uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Polly:{' '}
              <strong
                data-testid="hud-polly-status"
                className={
                  pollyAssisting
                    ? 'text-[#a3ff12]'
                    : pollyReady
                      ? 'text-[#00f5d4]'
                      : 'text-slate-300'
                }
              >
                {pollyAssisting
                  ? `ASSIST ${hud.pollyActiveRemaining.toFixed(1)}s`
                  : pollyReady
                    ? 'READY'
                    : `${hud.pollyCooldownRemaining}s`}
              </strong>
            </span>
            <div className="relative h-1 w-14 bg-slate-900 rounded-sm overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#38bdf8]"
                style={{ width: `${Math.round(hud.dashReadyRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Center: WOB Chapter · Episode X/10 & Timer/Boss Bar */}
        <div className="order-3 md:order-2 w-full md:w-auto flex flex-col items-center gap-1.5 sm:gap-2 [@media(max-height:500px)]:gap-1">
          <div className="flex items-center gap-2.5 sm:gap-4 [@media(max-height:500px)]:gap-2 bg-[#0b0f19]/88 border border-[#1e293b] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 [@media(max-height:500px)]:px-2.5 [@media(max-height:500px)]:py-1 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] [@media(max-height:500px)]:text-[8px] uppercase tracking-widest text-slate-400">
                WOB · Chapter
              </span>
              <span
                data-testid="hud-chapter-episode"
                className="font-display text-sm sm:text-lg [@media(max-height:500px)]:text-xs font-bold leading-none text-[#00f5d4] mt-0.5 tabular-nums whitespace-nowrap"
              >
                Chapter {hud.chapter} · Episode {hud.episode}/{hud.episodesPerChapter}
              </span>
            </div>
            <div className="h-6 sm:h-7 [@media(max-height:500px)]:h-5 w-px bg-slate-800" />
            {hud.isBossEpisode ? (
              <div className="flex flex-col items-center">
                <span className="text-[9px] sm:text-[10px] [@media(max-height:500px)]:text-[8px] uppercase tracking-widest text-[#ff007f]">
                  Episode 10
                </span>
                <span
                  data-testid="hud-timer"
                  className="font-display text-xs sm:text-sm [@media(max-height:500px)]:text-[11px] font-bold leading-none text-[#ff007f] tracking-wider uppercase mt-0.5 whitespace-nowrap"
                >
                  Boss Battle
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[9px] sm:text-[10px] [@media(max-height:500px)]:text-[8px] uppercase tracking-widest text-slate-400">
                  Clear In
                </span>
                <span
                  data-testid="hud-timer"
                  className="font-mono-num text-base sm:text-xl [@media(max-height:500px)]:text-xs font-bold leading-none text-slate-100"
                >
                  {formattedTimer}
                </span>
              </div>
            )}
          </div>

          {hud.bossActive && (
            <div
              data-testid="boss-hp-panel"
              className="w-60 sm:w-84 [@media(max-height:500px)]:w-64 bg-[#0b0f19]/92 border border-[#ff007f]/70 rounded-lg px-3 py-1.5 [@media(max-height:500px)]:py-1 shadow-[0_0_20px_rgba(255,0,127,0.3)]"
            >
              <div className="flex items-center justify-between text-[11px] font-display font-bold tracking-wider text-[#ff007f] mb-1">
                <span data-testid="boss-name">{hud.bossName}</span>
                <span className="font-mono-num">
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#ff007f] transition-all duration-100"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Score, Shards, Utility Controls & Combo Streak */}
        <div className="order-2 md:order-3 flex flex-col items-end gap-1.5">
          <div className="flex items-start gap-1 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3.5 [@media(max-height:500px)]:gap-2 bg-[#0b0f19]/88 border border-[#1e293b] rounded-lg px-2 py-1.5 sm:px-3.5 sm:py-2 [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:py-1 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
              <div className="flex flex-col items-end">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-0.5">
                  Score
                </span>
                <span
                  data-testid="hud-score"
                  className="font-mono-num text-xs sm:text-xl [@media(max-height:500px)]:text-sm font-bold leading-none text-slate-100 whitespace-nowrap"
                >
                  {hud.score.toLocaleString()}
                </span>
              </div>

              <div className="hidden sm:block [@media(max-height:500px)]:hidden h-7 w-px bg-slate-800" />

              <div className="hidden sm:flex [@media(max-height:500px)]:hidden flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 leading-none mb-0.5">
                  Best
                </span>
                <span className="font-mono-num text-sm font-semibold leading-none text-slate-300 mt-1 whitespace-nowrap">
                  {hud.highScore.toLocaleString()}
                </span>
              </div>

              <div className="h-5 sm:h-7 [@media(max-height:500px)]:h-5 w-px bg-slate-800" />

              <div className="flex items-center gap-1 sm:gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden="true">
                  <polygon
                    points="12,2 20,12 12,22 4,12"
                    fill="#38bdf8"
                    stroke="#e0f2fe"
                    strokeWidth="1.5"
                  />
                </svg>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#38bdf8] leading-none mb-0.5">
                    Shards
                  </span>
                  <span
                    data-testid="hud-shards"
                    className="font-mono-num text-xs sm:text-xl [@media(max-height:500px)]:text-sm font-bold leading-none text-[#38bdf8] whitespace-nowrap"
                  >
                    {hud.shards}
                  </span>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 [@media(max-height:500px)]:gap-1">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
                title="Mute [M]"
                className="w-7 h-7 sm:w-10 sm:h-10 [@media(max-height:500px)]:w-8 [@media(max-height:500px)]:h-8 flex items-center justify-center rounded-lg bg-[#0b0f19]/90 border border-[#1e293b] text-slate-300 hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {hud.muted ? (
                    <>
                      <line x1="22" y1="9" x2="16" y2="15" />
                      <line x1="16" y1="9" x2="22" y2="15" />
                    </>
                  ) : (
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                aria-label="Pause game"
                title="Pause [P]"
                className="w-7 h-7 sm:w-10 sm:h-10 [@media(max-height:500px)]:w-8 [@media(max-height:500px)]:h-8 flex items-center justify-center rounded-lg bg-[#0b0f19]/90 border border-[#1e293b] text-slate-300 hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                aria-label="Restart campaign"
                title="Restart [R]"
                className="w-7 h-7 sm:w-10 sm:h-10 [@media(max-height:500px)]:w-8 [@media(max-height:500px)]:h-8 flex items-center justify-center rounded-lg bg-[#0b0f19]/90 border border-[#1e293b] text-slate-300 hover:border-[#ff007f] hover:text-[#ff007f] transition-colors cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>

          {hud.comboCount > 0 && (
            <div
              data-testid="hud-combo"
              className={`min-w-[140px] sm:min-w-[196px] bg-[#0b0f19]/90 border rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.5)] ${comboAccentClass}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Combo · {hud.comboCount}
                </span>
                <span
                  data-testid="hud-combo-multiplier"
                  className="font-display text-sm sm:text-base font-bold leading-none tabular-nums"
                >
                  {hud.comboMultiplier}x
                </span>
              </div>
              <div className="relative h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden border border-slate-800/80">
                <div
                  className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${comboBarClass}`}
                  style={{ width: `${Math.round(hud.comboTimeRatio * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Perimeter Safe-Margin Action Dock: EMP [E] bottom-left, Shield [S] & Polly [Q] thumb-friendly bottom-right */}
      <div className="flex items-end justify-between gap-2 w-full">
        {/* Left Safe Margin: EMP Emergency Bomb */}
        <div className="pointer-events-auto flex items-center">
          <button
            type="button"
            tabIndex={-1}
            data-testid="emp-button"
            disabled={!empReady}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerEmp();
            }}
            aria-label={
              empReady
                ? 'Activate EMP Emergency Bomb'
                : `EMP recharging, ${hud.empCooldownRemaining} seconds remaining`
            }
            title="EMP Bomb [E]"
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[98px] sm:min-w-[136px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              empReady
                ? 'bg-[#0b0f19]/92 border-[#38bdf8]/85 text-[#38bdf8] shadow-[0_0_18px_rgba(56,189,248,0.24)] hover:bg-[#0f172a] hover:border-[#7dd3fc] active:scale-[0.98] cursor-pointer'
                : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <div className="flex flex-col items-start leading-none">
                <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                  EMP
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5">
                  {empReady ? 'READY' : `${hud.empCooldownRemaining}s`}
                </span>
              </div>
            </div>
            <span
              className={`hidden sm:inline font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                empReady
                  ? 'border-[#38bdf8]/60 bg-[#38bdf8]/15 text-[#38bdf8]'
                  : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              [E]
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/90">
              <div
                className={`h-full transition-[width] duration-150 ${
                  empReady ? 'bg-[#38bdf8]' : 'bg-[#38bdf8]/50'
                }`}
                style={{ width: `${Math.round(empChargePct)}%` }}
              />
            </div>
          </button>
        </div>

        {/* Right Safe Margin: Thumb-friendly Tactical Shield & Polly Partner Assist */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5">
          {/* Tactical Shield Button */}
          <button
            type="button"
            tabIndex={-1}
            data-testid="shield-button"
            disabled={!shieldReady}
            onClick={(e) => {
              e.currentTarget.blur();
              onActivateShield();
            }}
            aria-label={
              hud.tacticalShieldActive
                ? `Tactical Shield active, ${hud.tacticalShieldActiveRemaining} seconds remaining`
                : shieldReady
                  ? 'Activate Tactical Shield'
                  : `Tactical Shield recharging, ${hud.tacticalShieldCooldownRemaining} seconds remaining`
            }
            title="Tactical Shield [S or Right-Click]"
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[108px] sm:min-w-[152px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              hud.tacticalShieldActive
                ? 'bg-[#00f5d4]/18 border-[#00f5d4] text-[#00f5d4] shadow-[0_0_22px_rgba(0,245,212,0.45)]'
                : shieldReady
                  ? 'bg-[#0b0f19]/92 border-[#00f5d4]/85 text-[#00f5d4] shadow-[0_0_18px_rgba(0,245,212,0.24)] hover:bg-[#0f172a] hover:border-[#38ffe5] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div className="flex flex-col items-start leading-none">
                <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                  Shield
                </span>
                <span
                  data-testid="shield-status"
                  className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5"
                >
                  {hud.tacticalShieldActive
                    ? `ACTIVE ${hud.tacticalShieldActiveRemaining.toFixed(1)}s`
                    : shieldReady
                      ? 'READY'
                      : `${hud.tacticalShieldCooldownRemaining}s`}
                </span>
              </div>
            </div>
            <span
              className={`hidden sm:inline font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                shieldReady || hud.tacticalShieldActive
                  ? 'border-[#00f5d4]/60 bg-[#00f5d4]/15 text-[#00f5d4]'
                  : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              [S]
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/90">
              <div
                className={`h-full transition-[width] duration-150 ${
                  hud.tacticalShieldActive || shieldReady
                    ? 'bg-[#00f5d4]'
                    : 'bg-[#00f5d4]/50'
                }`}
                style={{ width: `${Math.round(tacticalShieldBarPct)}%` }}
              />
            </div>
          </button>

          {/* Polly Partner Assist Button */}
          <button
            type="button"
            tabIndex={-1}
            data-testid="polly-button"
            disabled={!pollyReady}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerPolly();
            }}
            aria-label={
              pollyAssisting
                ? `Polly assisting, ${hud.pollyActiveRemaining} seconds remaining`
                : pollyReady
                  ? 'Call Polly Partner Assist'
                  : `Polly recharging, ${hud.pollyCooldownRemaining} seconds remaining`
            }
            title="Polly Partner Salvo [Q]"
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[108px] sm:min-w-[152px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              pollyAssisting
                ? 'bg-[#a3ff12]/18 border-[#a3ff12] text-[#a3ff12] shadow-[0_0_22px_rgba(163,255,18,0.42)]'
                : pollyReady
                  ? 'bg-[#0b0f19]/92 border-[#a3ff12]/85 text-[#a3ff12] shadow-[0_0_18px_rgba(163,255,18,0.22)] hover:bg-[#0f172a] hover:border-[#bfff55] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
              <div className="flex flex-col items-start leading-none">
                <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                  Polly
                </span>
                <span
                  data-testid="polly-status"
                  className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5"
                >
                  {pollyAssisting
                    ? `SALVO ${hud.pollyActiveRemaining.toFixed(1)}s`
                    : pollyReady
                      ? 'READY'
                      : `${hud.pollyCooldownRemaining}s`}
                </span>
              </div>
            </div>
            <span
              className={`hidden sm:inline font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                pollyReady || pollyAssisting
                  ? 'border-[#a3ff12]/60 bg-[#a3ff12]/15 text-[#a3ff12]'
                  : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              [Q]
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/90">
              <div
                className={`h-full transition-[width] duration-150 ${
                  pollyAssisting || pollyReady ? 'bg-[#a3ff12]' : 'bg-[#a3ff12]/50'
                }`}
                style={{ width: `${Math.round(pollyBarPct)}%` }}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
