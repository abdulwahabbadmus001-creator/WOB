import React, { useEffect, useRef, useState } from 'react';
import type { HudSnapshot, TacticalPingKind } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onActivateShield: () => void;
  onTriggerPolly: () => void;
  onTriggerEmp: () => void;
  onTriggerDash?: () => void;
  onTriggerSquadronLink?: () => void;
  onSendTacticalPing?: (kind: TacticalPingKind) => void;
  onVirtualJoystick?: (dx: number, dy: number, active: boolean) => void;
  onAltitudeControl?: (vzRatio: number) => void;
  onManualFireHeld?: (held: boolean) => void;
  onToggleAutoFire?: () => void;
}

const CooldownRing: React.FC<{ pct: number; color: string; size?: number }> = ({
  pct,
  color,
  size = 22,
}) => {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#1e293b"
        strokeWidth="2.4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onToggleMute,
  onPause,
  onRestart,
  onActivateShield,
  onTriggerPolly,
  onTriggerEmp,
  onTriggerDash,
  onTriggerSquadronLink,
  onSendTacticalPing,
  onVirtualJoystick,
  onAltitudeControl,
  onManualFireHeld,
  onToggleAutoFire,
}) => {
  const [ghostHpPct, setGhostHpPct] = useState(100);
  const ghostTimeoutRef = useRef<number | null>(null);

  // Floating Virtual Thumbstick state (Left 360° Front/Back/Left/Right)
  const [stickActive, setStickActive] = useState(false);
  const [stickOrigin, setStickOrigin] = useState({ x: 48, y: 48 });
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0 });
  const stickZoneRef = useRef<HTMLDivElement | null>(null);

  // Vertical Altitude Touch Control state (Right Up/Down Elevation)
  const [altTouchDir, setAltTouchDir] = useState<-1 | 0 | 1>(0);
  const [manualFireActive, setManualFireActive] = useState(false);

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
  const empAvailable = empReady && !hud.empDisabled;
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

  const dashPct = Math.round(hud.dashReadyRatio * 100);
  const dashReady = dashPct >= 99;

  const linkPct = hud.squadronLinkEnergy ?? 100;
  const linkReady =
    Boolean(hud.coopActive) &&
    !hud.squadronFusionDocked &&
    (hud.squadronLinkCooldownRemaining ?? 0) <= 0;

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

  // Virtual Thumbstick Handlers
  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    setStickOrigin({ x: ox, y: oy });
    setStickKnob({ x: 0, y: 0 });
    setStickActive(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    onVirtualJoystick?.(0, 0, true);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = cx - stickOrigin.x;
    const dy = cy - stickOrigin.y;
    const maxR = 38;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxR, dist);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clampedDist;
    const ky = Math.sin(ang) * clampedDist;
    setStickKnob({ x: kx, y: ky });
    if (dist > 4) {
      onVirtualJoystick?.(kx / maxR, ky / maxR, true);
    } else {
      onVirtualJoystick?.(0, 0, true);
    }
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickActive) return;
    setStickActive(false);
    setStickKnob({ x: 0, y: 0 });
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    onVirtualJoystick?.(0, 0, false);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-5 [@media(max-height:500px)]:p-2">
      {/* Top Perimeter Clusters */}
      <div className="flex flex-wrap md:flex-nowrap items-start justify-between gap-2 sm:gap-2.5">
        {/* Top-Left: Tommy Vitality, Armor Shield, Co-op Teammate & Tactical Pings */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-1 sm:gap-2 [@media(max-height:500px)]:gap-1 min-w-[132px] sm:min-w-[215px] [@media(max-height:500px)]:min-w-[144px] bg-[#0b0f19]/88 border border-[#1e293b] rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
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
                  {hud.squadronFusionDocked ? 'Twin-Core Gunship' : 'Tommy'}
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
              {(hud.grazeCount ?? 0) > 0 && (
                <span className="text-[#fbbf24] font-bold">
                  GRAZE x{hud.grazeCount}
                </span>
              )}
            </div>

            {/* Co-op Teammate Status Bar */}
            {hud.coopActive && hud.teammate && (
              <div
                data-testid="coop-teammate-panel"
                className="pt-1.5 mt-0.5 border-t border-slate-800/90 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-[10px] font-mono-num">
                  <span className="font-bold text-[#c084fc] uppercase">
                    {hud.teammate.callsign}{' '}
                    {hud.teammate.downed ? '· DOWNED!' : hud.squadronLinkActive ? '· LINKED' : ''}
                  </span>
                  <span className="text-slate-300">
                    {hud.teammate.downed
                      ? `REVIVE ${hud.teammate.reviveProgress}%`
                      : `${hud.teammate.hp}/${hud.teammate.maxHp}`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.teammate.downed ? 'bg-[#ff2a5f]' : 'bg-[#c084fc]'
                    }`}
                    style={{
                      width: `${
                        hud.teammate.downed
                          ? hud.teammate.reviveProgress
                          : Math.max(
                              0,
                              Math.min(
                                100,
                                (hud.teammate.hp / Math.max(1, hud.teammate.maxHp)) * 100,
                              ),
                            )
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* One-Tap Tactical Callout Pings */}
          {onSendTacticalPing && (
            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSendTacticalPing('focus_core');
                }}
                className="px-2 py-1 rounded bg-[#0b0f19]/90 border border-[#ff007f]/50 text-[9px] font-mono-num font-bold uppercase text-[#ff007f] hover:bg-[#ff007f]/15 cursor-pointer"
              >
                Focus Core!
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSendTacticalPing('link_up');
                }}
                className="px-2 py-1 rounded bg-[#0b0f19]/90 border border-[#00f5d4]/50 text-[9px] font-mono-num font-bold uppercase text-[#00f5d4] hover:bg-[#00f5d4]/15 cursor-pointer"
              >
                Link Up!
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSendTacticalPing('need_shield');
                }}
                className="px-2 py-1 rounded bg-[#0b0f19]/90 border border-[#a3ff12]/50 text-[9px] font-mono-num font-bold uppercase text-[#a3ff12] hover:bg-[#a3ff12]/15 cursor-pointer"
              >
                Need Shield!
              </button>
            </div>
          )}
        </div>

        {/* Top-Center: WOB Chapter · Episode X/10 & Capital Starship Boss Subsystem Bar */}
        <div className="order-3 md:order-2 w-full md:w-auto flex flex-col items-center gap-1.5 sm:gap-2 [@media(max-height:500px)]:gap-1">
          <div className="flex items-center gap-2.5 sm:gap-4 [@media(max-height:500px)]:gap-2 bg-[#0b0f19]/88 border border-[#1e293b] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 [@media(max-height:500px)]:px-2.5 [@media(max-height:500px)]:py-1 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] [@media(max-height:500px)]:text-[8px] uppercase tracking-widest text-slate-400">
                {hud.coopActive
                  ? 'Co-op Squadron · Overdrive'
                  : hud.mode === 'campaign'
                    ? 'WOB · Chapter'
                    : hud.mode === 'daily'
                      ? 'Daily Challenge'
                      : 'Endless Survival'}
              </span>
              <span
                data-testid="hud-chapter-episode"
                className="font-display text-sm sm:text-lg [@media(max-height:500px)]:text-xs font-bold leading-none text-[#00f5d4] mt-0.5 tabular-nums whitespace-nowrap"
              >
                Chapter {hud.chapter} · Episode {hud.episode}/{hud.episodesPerChapter}
              </span>
            </div>
            <div className="h-6 sm:h-7 [@media(max-height:500px)]:h-5 w-px bg-slate-800" />
            {hud.mode !== 'campaign' ? (
              <div className="flex flex-col items-center">
                <span className="text-[9px] sm:text-[10px] [@media(max-height:500px)]:text-[8px] uppercase tracking-widest text-[#a3ff12]">
                  {hud.mode === 'daily' ? hud.dailyChallengeTitle : 'No Timer'}
                </span>
                <span
                  data-testid="hud-timer"
                  title={hud.dailyChallengeDescription}
                  className="font-display text-xs sm:text-sm [@media(max-height:500px)]:text-[11px] font-bold leading-none text-[#a3ff12] tracking-wider uppercase mt-0.5 whitespace-nowrap"
                >
                  {hud.mode === 'daily' ? 'Daily Run' : 'Survive'}
                </span>
              </div>
            ) : hud.isBossEpisode ? (
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
              className="w-64 sm:w-92 [@media(max-height:500px)]:w-64 bg-[#0b0f19]/92 border border-[#ff007f]/70 rounded-lg px-3 py-1.5 [@media(max-height:500px)]:py-1 shadow-[0_0_20px_rgba(255,0,127,0.3)]"
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

              {/* Capital Starship Destructible Subsystems Status */}
              {hud.bossSubsystems && hud.bossSubsystems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-1.5">
                  {hud.bossSubsystems.map((sub) => (
                    <div
                      key={sub.id}
                      className={`px-1.5 py-0.5 rounded border text-[8px] font-mono-num truncate ${
                        sub.destroyed
                          ? 'border-slate-800 bg-slate-900/60 text-slate-500 line-through'
                          : 'border-[#a3ff12]/50 bg-[#0f172a] text-[#a3ff12]'
                      }`}
                    >
                      {sub.name.split(' ').slice(-2).join(' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: Score, Shards, Utility Controls, Threat Radar & Combo Streak */}
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

          {/* Holographic 3D Threat Radar & Combo Streak Row */}
          <div className="flex items-start gap-2">
            {hud.comboCount > 0 && (
              <div
                data-testid="hud-combo"
                className={`min-w-[130px] sm:min-w-[180px] bg-[#0b0f19]/90 border rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.5)] ${comboAccentClass}`}
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

            {/* Holographic 6-Direction Threat Radar */}
            <div
              data-testid="holographic-threat-radar"
              className="hidden sm:flex flex-col items-center bg-[#0b0f19]/90 border border-[#00f5d4]/45 rounded-lg p-1.5 shadow-[0_0_16px_rgba(0,245,212,0.18)]"
            >
              <svg viewBox="-32 -32 64 64" className="w-14 h-14">
                <circle
                  cx="0"
                  cy="0"
                  r="28"
                  fill="#070b14"
                  stroke="#00f5d4"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="14"
                  fill="none"
                  stroke="#1e293b"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <line x1="-28" y1="0" x2="28" y2="0" stroke="#1e293b" strokeWidth="0.8" />
                <line x1="0" y1="-28" x2="0" y2="28" stroke="#1e293b" strokeWidth="0.8" />
                {/* Tommy Center Point */}
                <circle cx="0" cy="0" r="2.3" fill="#00f5d4" />
                {/* Enemy, Teammate & Subsystem Blips across all 6 directions (X, Y, Z) */}
                {(hud.radarBlips ?? []).map((blip) => {
                  const bx = blip.x * 24;
                  const by = blip.y * 24;
                  if (blip.kind === 'teammate') {
                    return <circle key={blip.id} cx={bx} cy={by} r="2.4" fill="#c084fc" />;
                  }
                  if (blip.kind === 'subsystem') {
                    return (
                      <rect
                        key={blip.id}
                        x={bx - 2}
                        y={by - 2}
                        width="4"
                        height="4"
                        fill="none"
                        stroke="#a3ff12"
                        strokeWidth="1"
                      />
                    );
                  }
                  if (blip.isBoss) {
                    return <circle key={blip.id} cx={bx} cy={by} r="3.6" fill="#ff007f" />;
                  }
                  return <circle key={blip.id} cx={bx} cy={by} r="1.7" fill="#ff2a5f" />;
                })}
              </svg>
              <span className="text-[8px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
                ALT {hud.playerZ && hud.playerZ > 0 ? `+${hud.playerZ}` : hud.playerZ ?? 0}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter Safe-Margin Action Dock: Virtual Thumbstick + EMP + Squadron Link + Dash + Shield + Polly */}
      <div className="flex items-end justify-between gap-2 w-full">
        {/* Left Safe Margin: Responsive Floating Virtual Analog Joystick + EMP + Squadron Link */}
        <div className="pointer-events-auto flex items-end gap-2">
          {/* Precision Floating Virtual Analog Joystick (360° Front / Back / Left / Right) */}
          <div
            ref={stickZoneRef}
            data-testid="virtual-thumbstick"
            onPointerDown={handleStickPointerDown}
            onPointerMove={handleStickPointerMove}
            onPointerUp={handleStickPointerUp}
            onPointerCancel={handleStickPointerUp}
            title="360° Floating Virtual Analog Joystick (Front / Back / Left / Right)"
            className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#0b0f19]/80 border border-[#00f5d4]/55 flex items-center justify-center touch-none select-none shadow-[0_0_18px_rgba(0,245,212,0.2)] cursor-grab active:cursor-grabbing"
          >
            <div className="w-11 h-11 rounded-full border border-dashed border-slate-700" />
            <span className="absolute top-1 text-[7px] font-mono-num text-[#00f5d4]/70">
              FWD
            </span>
            <span className="absolute bottom-1 text-[7px] font-mono-num text-[#00f5d4]/70">
              REV
            </span>
            <span className="absolute left-1.5 text-[7px] font-mono-num text-[#00f5d4]/70">
              L
            </span>
            <span className="absolute right-1.5 text-[7px] font-mono-num text-[#00f5d4]/70">
              R
            </span>
            <div
              className="absolute w-8 h-8 rounded-full bg-[#00f5d4]/40 border-2 border-[#00f5d4] shadow-[0_0_12px_rgba(0,245,212,0.65)] transition-transform duration-75"
              style={{
                transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)`,
              }}
            />
          </div>

          {/* EMP Emergency Bomb Button */}
          <button
            type="button"
            tabIndex={-1}
            data-testid="emp-button"
            disabled={!empReady || hud.empDisabled}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerEmp();
            }}
            aria-label={
              hud.empDisabled
                ? 'EMP disabled for today’s challenge'
                : empReady
                  ? 'Activate EMP Emergency Bomb'
                  : `EMP recharging, ${hud.empCooldownRemaining} seconds remaining`
            }
            title="EMP Bomb [E]"
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[94px] sm:min-w-[132px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              empAvailable
                ? 'bg-[#0b0f19]/92 border-[#38bdf8]/85 text-[#38bdf8] shadow-[0_0_18px_rgba(56,189,248,0.24)] hover:bg-[#0f172a] hover:border-[#7dd3fc] active:scale-[0.98] cursor-pointer'
                : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CooldownRing pct={empChargePct} color="#38bdf8" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                  EMP
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5">
                  {hud.empDisabled
                    ? 'DISABLED'
                    : empReady
                      ? 'READY'
                      : `${hud.empCooldownRemaining}s`}
                </span>
              </div>
            </div>
            <span
              className={`hidden sm:inline font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                empAvailable
                  ? 'border-[#38bdf8]/60 bg-[#38bdf8]/15 text-[#38bdf8]'
                  : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              [E]
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/90">
              <div
                className={`h-full transition-[width] duration-150 ${
                  empAvailable ? 'bg-[#38bdf8]' : 'bg-[#38bdf8]/50'
                }`}
                style={{ width: `${Math.round(empChargePct)}%` }}
              />
            </div>
          </button>

          {/* Squadron Link / Twin-Core Gunship Fusion Button (when Co-op Active) */}
          {hud.coopActive && onTriggerSquadronLink && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="squadron-link-button"
              disabled={!linkReady}
              onClick={(e) => {
                e.currentTarget.blur();
                onTriggerSquadronLink();
              }}
              title="Squadron Link / Twin-Core Heavy Gunship Fusion [L]"
              className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[96px] sm:min-w-[138px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
                hud.squadronFusionDocked
                  ? 'bg-[#c084fc]/20 border-[#c084fc] text-[#c084fc] shadow-[0_0_22px_rgba(192,132,252,0.45)]'
                  : linkReady
                    ? 'bg-[#0b0f19]/92 border-[#c084fc]/85 text-[#c084fc] shadow-[0_0_18px_rgba(192,132,252,0.25)] hover:bg-[#0f172a] active:scale-[0.98] cursor-pointer'
                    : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CooldownRing pct={linkPct} color="#c084fc" />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                    Fusion
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5">
                    {hud.squadronFusionDocked
                      ? 'DOCKED'
                      : linkReady
                        ? 'LINK READY'
                        : `${hud.squadronLinkCooldownRemaining}s`}
                  </span>
                </div>
              </div>
              <span className="hidden sm:inline font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#c084fc]/50 bg-[#c084fc]/15 text-[#c084fc]">
                [L]
              </span>
            </button>
          )}
        </div>

        {/* Right Safe Margin: Vertical Altitude (Up/Down) Touch Control, Manual/Auto-Fire, Dash, Tactical Shield & Polly */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top-Right of Action Dock: Vertical Altitude (Up/Down) Touch Control + Auto/Manual Fire Toggle */}
          <div className="flex items-end gap-2">
            {/* Toggleable Auto-Fire / Manual Fire Trigger */}
            {onToggleAutoFire && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="toggle-autofire-button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleAutoFire();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border font-mono-num text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    hud.autoFire !== false
                      ? 'bg-[#0b0f19]/90 border-[#00f5d4]/60 text-[#00f5d4]'
                      : 'bg-[#ff007f]/18 border-[#ff007f] text-[#ff007f]'
                  }`}
                >
                  {hud.autoFire !== false ? 'Auto-Fire: ON' : 'Manual Fire'}
                </button>

                {hud.autoFire === false && onManualFireHeld && (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="manual-fire-button"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      setManualFireActive(true);
                      onManualFireHeld(true);
                    }}
                    onPointerUp={() => {
                      setManualFireActive(false);
                      onManualFireHeld(false);
                    }}
                    onPointerCancel={() => {
                      setManualFireActive(false);
                      onManualFireHeld(false);
                    }}
                    className={`px-4 py-2.5 rounded-lg border font-display text-xs font-bold uppercase tracking-wider select-none touch-none cursor-pointer ${
                      manualFireActive
                        ? 'bg-[#ff007f] border-white text-white shadow-[0_0_22px_rgba(255,0,127,0.65)] scale-95'
                        : 'bg-[#0b0f19]/92 border-[#ff007f] text-[#ff007f] shadow-[0_0_14px_rgba(255,0,127,0.3)]'
                    }`}
                  >
                    FIRE [J]
                  </button>
                )}
              </div>
            )}

            {/* Ergonomic Vertical Altitude (Up / Down) Touch Control */}
            {onAltitudeControl && (
              <div
                data-testid="altitude-touch-control"
                className="flex items-center gap-1 bg-[#0b0f19]/88 border border-[#00f5d4]/50 rounded-lg p-1 shadow-[0_0_16px_rgba(0,245,212,0.18)] select-none touch-none"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="altitude-up-button"
                  aria-label="Ascend Up (+Z)"
                  title="Ascend Up [Space / R]"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setAltTouchDir(1);
                    onAltitudeControl(1);
                  }}
                  onPointerUp={() => {
                    setAltTouchDir(0);
                    onAltitudeControl(0);
                  }}
                  onPointerCancel={() => {
                    setAltTouchDir(0);
                    onAltitudeControl(0);
                  }}
                  className={`px-2.5 py-1.5 rounded text-[10px] font-mono-num font-bold uppercase transition-colors cursor-pointer ${
                    altTouchDir === 1
                      ? 'bg-[#00f5d4] text-[#070b14]'
                      : 'bg-[#111827] text-[#00f5d4] hover:bg-[#00f5d4]/20'
                  }`}
                >
                  ▲ UP
                </button>
                <span className="px-1.5 text-[9px] font-mono-num text-slate-300 tabular-nums">
                  {hud.playerZ && hud.playerZ > 0
                    ? `+${hud.playerZ}m`
                    : `${hud.playerZ ?? 0}m`}
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="altitude-down-button"
                  aria-label="Descend Down (-Z)"
                  title="Descend Down [Shift / F]"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setAltTouchDir(-1);
                    onAltitudeControl(-1);
                  }}
                  onPointerUp={() => {
                    setAltTouchDir(0);
                    onAltitudeControl(0);
                  }}
                  onPointerCancel={() => {
                    setAltTouchDir(0);
                    onAltitudeControl(0);
                  }}
                  className={`px-2.5 py-1.5 rounded text-[10px] font-mono-num font-bold uppercase transition-colors cursor-pointer ${
                    altTouchDir === -1
                      ? 'bg-[#38bdf8] text-[#070b14]'
                      : 'bg-[#111827] text-[#38bdf8] hover:bg-[#38bdf8]/20'
                  }`}
                >
                  ▼ DN
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
          {/* Barrel-Roll Dash Button */}
          {onTriggerDash && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="dash-button"
              disabled={!dashReady}
              onClick={(e) => {
                e.currentTarget.blur();
                onTriggerDash();
              }}
              title="3D Barrel-Roll Dash [Space]"
              className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[86px] sm:min-w-[118px] flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border transition-all ${
                dashReady
                  ? 'bg-[#0b0f19]/92 border-[#fbbf24]/85 text-[#fbbf24] shadow-[0_0_16px_rgba(251,191,36,0.22)] hover:bg-[#0f172a] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CooldownRing pct={dashPct} color="#fbbf24" />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-display text-xs sm:text-sm font-bold tracking-wider uppercase">
                    Dash
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono-num uppercase tracking-wider opacity-85 mt-0.5">
                    {dashReady ? 'READY' : `${dashPct}%`}
                  </span>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-900/90">
                <div
                  className="h-full bg-[#fbbf24] transition-[width] duration-100"
                  style={{ width: `${dashPct}%` }}
                />
              </div>
            </button>
          )}

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
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[104px] sm:min-w-[148px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              hud.tacticalShieldActive
                ? 'bg-[#00f5d4]/18 border-[#00f5d4] text-[#00f5d4] shadow-[0_0_22px_rgba(0,245,212,0.45)]'
                : shieldReady
                  ? 'bg-[#0b0f19]/92 border-[#00f5d4]/85 text-[#00f5d4] shadow-[0_0_18px_rgba(0,245,212,0.24)] hover:bg-[#0f172a] hover:border-[#38ffe5] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CooldownRing pct={tacticalShieldBarPct} color="#00f5d4" />
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
            className={`relative overflow-hidden select-none touch-manipulation min-h-[48px] [@media(max-height:500px)]:min-h-[44px] min-w-[104px] sm:min-w-[148px] flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg border transition-all ${
              pollyAssisting
                ? 'bg-[#a3ff12]/18 border-[#a3ff12] text-[#a3ff12] shadow-[0_0_22px_rgba(163,255,18,0.42)]'
                : pollyReady
                  ? 'bg-[#0b0f19]/92 border-[#a3ff12]/85 text-[#a3ff12] shadow-[0_0_18px_rgba(163,255,18,0.22)] hover:bg-[#0f172a] hover:border-[#bfff55] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#0b0f19]/88 border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CooldownRing pct={pollyBarPct} color="#a3ff12" />
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
    </div>
  );
};
