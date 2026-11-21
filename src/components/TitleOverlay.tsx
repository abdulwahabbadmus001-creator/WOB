import React, { useState } from 'react';
import {
  getDailyChallenge,
  isShipSkinUnlocked,
  loadShipSkin,
  saveShipSkin,
  SHIP_SKINS,
} from '../game/rules';
import type { GameMode, ShipSkin, WeaponType } from '../game/types';

interface TitleOverlayProps {
  highScore: number;
  muted: boolean;
  unlockedCount: number;
  totalAchievements: number;
  hangarScrap?: number;
  isStandalone?: boolean;
  onStart: (mode: GameMode, weapon: WeaponType, skin: ShipSkin) => void;
  onOpenCoopLobby?: (mode: GameMode, weapon: WeaponType, skin: ShipSkin) => void;
  onOpenHangar?: (skin: ShipSkin) => void;
  onToggleMute: () => void;
  onInstall?: () => void;
  installHelp?: boolean;
  onOpenLeaderboard: () => void;
  onOpenAchievements: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  highScore,
  muted,
  unlockedCount,
  totalAchievements,
  hangarScrap = 0,
  isStandalone = false,
  onStart,
  onOpenCoopLobby,
  onOpenHangar,
  onToggleMute,
  onInstall,
  installHelp = false,
  onOpenLeaderboard,
  onOpenAchievements,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>('spread');
  const [selectedSkin, setSelectedSkin] = useState<ShipSkin>(() => loadShipSkin(highScore));
  const dailyChallenge = getDailyChallenge();

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 md:p-12 [@media(max-height:500px)]:p-3.5 pointer-events-none">
      {/* Top minimal utility corner */}
      <div className="flex items-center justify-end gap-2">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0f172a]/90 border border-[#00f5d4]/35 text-[10px] font-mono-num uppercase tracking-wider text-[#00f5d4]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a3ff12]" />
          {isStandalone ? 'PWA Standalone · 100% Offline' : '3D WebGL · 100% Offline Ready'}
        </span>

        {!isStandalone && onInstall && (
          <button
            type="button"
            data-testid="install-app-button"
            onClick={(e) => {
              e.currentTarget.blur();
              onInstall();
            }}
            aria-label="Install WOB"
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-xs font-medium tracking-wide text-[#070b14] bg-[#00f5d4] rounded-lg hover:bg-[#38ffe5] shadow-[0_0_16px_rgba(0,245,212,0.35)] transition-colors cursor-pointer"
          >
            Install App
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-xs font-medium tracking-wide text-slate-300 bg-[#0f172a]/90 border border-slate-700/80 rounded-lg hover:border-[#00f5d4]/70 hover:text-[#00f5d4] transition-colors cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {muted ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            )}
          </svg>
          <span>{muted ? 'Audio Muted' : 'Audio On'}</span>
        </button>
      </div>

      {/* Left-aligned WOB Title Lockup */}
      <div className="max-w-2xl my-auto">
        <div className="mb-4 [@media(max-height:500px)]:mb-1.5">
          <svg
            viewBox="0 0 420 132"
            className="w-full max-w-[380px] [@media(max-height:500px)]:max-w-[220px] h-auto overflow-visible"
            role="img"
            aria-label="WOB"
          >
            <defs>
              <filter id="wobGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#00f5d4" floodOpacity="0.65" />
              </filter>
              <filter id="wobGlowLime" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#a3ff12" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Emblem Frame */}
            <path
              d="M6 18 L24 6 L195 6 M6 18 L6 116 L24 128 L395 128"
              fill="none"
              stroke="#1e293b"
              strokeWidth="2"
            />
            <path
              d="M6 26 L6 62"
              fill="none"
              stroke="#00f5d4"
              strokeWidth="3.2"
              filter="url(#wobGlowCyan)"
            />
            <polygon
              points="30,20 46,30 30,40 18,30"
              fill="#0b0f19"
              stroke="#00f5d4"
              strokeWidth="2.2"
              filter="url(#wobGlowCyan)"
            />
            <circle cx="31" cy="30" r="3" fill="#a3ff12" />

            {/* Giant WOB Wordmark */}
            <text
              x="22"
              y="88"
              fill="#f8fafc"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="700"
              fontSize="66"
              letterSpacing="8"
            >
              W
              <tspan fill="#00f5d4" filter="url(#wobGlowCyan)">
                O
              </tspan>
              B
            </text>

            {/* Subtitle Lockup */}
            <text
              x="24"
              y="114"
              fill="#a3ff12"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="700"
              fontSize="12.5"
              letterSpacing="3.8"
              filter="url(#wobGlowLime)"
            >
              TOMMY &amp; POLLY · ENDLESS CAMPAIGN
            </text>
          </svg>
        </div>

        <p className="text-sm [@media(max-height:500px)]:text-xs text-slate-300 mb-4 [@media(max-height:500px)]:mb-2.5 max-w-md leading-relaxed [@media(max-height:500px)]:leading-snug">
          Pilot <span className="text-[#00f5d4] font-semibold">Tommy</span>{' '}
          alongside wingman{' '}
          <span className="text-[#a3ff12] font-semibold">Polly</span> or link up in{' '}
          <span className="text-[#c084fc] font-semibold">2-Player Co-op Squadron</span>{' '}
          to shatter 3D Capital Dreadnoughts.
        </p>

        {highScore > 0 && (
          <div className="mb-4 [@media(max-height:500px)]:mb-2 flex items-baseline gap-3 text-sm [@media(max-height:500px)]:text-xs text-slate-400">
            <span>High Score</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-lg [@media(max-height:500px)]:text-sm font-bold text-[#a3ff12]">
              {highScore.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-2">
          <label className="pointer-events-auto flex flex-col gap-1 text-[10px] uppercase tracking-wider text-slate-400">
            Run mode
            <select
              aria-label="Run mode"
              value={selectedMode}
              onChange={(event) => setSelectedMode(event.target.value as GameMode)}
              className="rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-[#00f5d4]"
            >
              <option value="campaign">Campaign</option>
              <option value="survival">Endless Survival</option>
              <option value="daily">Daily Challenge · {dailyChallenge.title}</option>
            </select>
          </label>
          <label className="pointer-events-auto flex flex-col gap-1 text-[10px] uppercase tracking-wider text-slate-400">
            Weapon loadout
            <select
              aria-label="Weapon loadout"
              value={selectedWeapon}
              onChange={(event) => setSelectedWeapon(event.target.value as WeaponType)}
              className="rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-[#00f5d4]"
            >
              <option value="spread">Spread Shot</option>
              <option value="laser">Laser Beam</option>
              <option value="homing">Homing Missiles</option>
              <option value="plasma">Plasma Burst</option>
            </select>
          </label>
          <label className="pointer-events-auto flex flex-col gap-1 text-[10px] uppercase tracking-wider text-slate-400">
            Ship skin
            <select
              aria-label="Ship skin"
              value={selectedSkin}
              onChange={(event) => {
                const skin = event.target.value as ShipSkin;
                setSelectedSkin(skin);
                saveShipSkin(skin);
              }}
              className="rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-[#00f5d4]"
            >
              {SHIP_SKINS.map((skin) => {
                const unlocked = isShipSkinUnlocked(skin.id, highScore);
                return (
                  <option key={skin.id} value={skin.id} disabled={!unlocked}>
                    {unlocked
                      ? skin.name
                      : `${skin.name} · ${skin.unlockScore.toLocaleString()} score`}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        {selectedMode === 'daily' && (
          <p className="mb-3 text-xs font-mono-num text-[#a3ff12]">
            Today: {dailyChallenge.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart(selectedMode, selectedWeapon, selectedSkin);
            }}
            className="pointer-events-auto px-6 py-3.5 [@media(max-height:500px)]:px-4 [@media(max-height:500px)]:py-2.5 text-base [@media(max-height:500px)]:text-sm font-display font-bold tracking-wider uppercase text-[#070b14] bg-[#00f5d4] rounded-lg shadow-[0_0_24px_rgba(0,245,212,0.4)] hover:bg-[#38ffe5] active:scale-[0.98] transition-all duration-150 cursor-pointer whitespace-nowrap"
          >
            Start {selectedMode === 'campaign' ? 'Campaign' : selectedMode === 'daily' ? 'Daily Run' : 'Survival'}
          </button>

          {onOpenCoopLobby && (
            <button
              type="button"
              data-testid="open-coop-button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCoopLobby(selectedMode, selectedWeapon, selectedSkin);
              }}
              className="pointer-events-auto px-5 py-3.5 [@media(max-height:500px)]:px-4 [@media(max-height:500px)]:py-2.5 text-sm [@media(max-height:500px)]:text-xs font-display font-bold tracking-wider uppercase text-[#070b14] bg-[#a3ff12] rounded-lg shadow-[0_0_20px_rgba(163,255,18,0.35)] hover:bg-[#bfff55] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              Co-op Squadron
            </button>
          )}

          {onOpenHangar && (
            <button
              type="button"
              data-testid="open-hangar-button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenHangar(selectedSkin);
              }}
              className="pointer-events-auto px-4 py-3.5 [@media(max-height:500px)]:px-3.5 [@media(max-height:500px)]:py-2.5 text-sm [@media(max-height:500px)]:text-xs font-display font-bold tracking-wider uppercase text-[#38bdf8] bg-[#0f172a]/92 border border-[#38bdf8]/60 rounded-lg hover:border-[#38bdf8] hover:bg-[#38bdf8]/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              3D Hangar · {hangarScrap} Shards
            </button>
          )}

          <button
            type="button"
            data-testid="open-leaderboard-button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenLeaderboard();
            }}
            className="pointer-events-auto px-4 py-3.5 [@media(max-height:500px)]:px-3.5 [@media(max-height:500px)]:py-2.5 text-sm [@media(max-height:500px)]:text-xs font-display font-bold tracking-wider uppercase text-slate-200 bg-[#0f172a]/92 border border-slate-700 rounded-lg hover:border-[#00f5d4] hover:text-[#00f5d4] transition-colors cursor-pointer whitespace-nowrap"
          >
            Leaderboard
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenAchievements();
            }}
            className="pointer-events-auto px-4 py-3.5 [@media(max-height:500px)]:px-3.5 [@media(max-height:500px)]:py-2.5 text-sm [@media(max-height:500px)]:text-xs font-display font-bold tracking-wider uppercase text-slate-200 bg-[#0f172a]/92 border border-slate-700 rounded-lg hover:border-[#a3ff12] hover:text-[#a3ff12] transition-colors cursor-pointer whitespace-nowrap"
          >
            Achievements · {unlockedCount}/{totalAchievements}
          </button>
        </div>
      </div>

      {/* Single flat control-hint line in bottom safe margin */}
      <div className="flex flex-col items-center sm:items-start gap-1">
        <p className="text-xs sm:text-sm [@media(max-height:500px)]:text-[11px] text-slate-400 tracking-wide font-mono-num">
          WASD / Arrows / Left Stick: Front·Back·Left·Right · Space / Shift / Right Pad: Up·Down · [C] Shield · [Q] Polly · [X] Dash · [E] EMP · [L] Fusion
        </p>
        {installHelp && (
          <p className="text-[11px] text-slate-500">
            To install on iPhone or iPad: tap Share, then Add to Home Screen.
          </p>
        )}
      </div>
    </div>
  );
};
