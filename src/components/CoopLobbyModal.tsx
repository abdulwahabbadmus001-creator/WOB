import React, { useEffect, useState } from 'react';
import { coopSession, generateRoomCode } from '../game/coop';
import type { CoopStartOptions } from '../game/engine';
import { isShipSkinUnlocked, SHIP_SKINS } from '../game/rules';
import type { CoopRole, GameMode, ShipSkin, WeaponType } from '../game/types';

interface CoopLobbyModalProps {
  highScore: number;
  initialMode: GameMode;
  initialSkin: ShipSkin;
  initialWeapon: WeaponType;
  initialRoomCode?: string;
  onLaunchCoop: (
    mode: GameMode,
    weapon: WeaponType,
    skin: ShipSkin,
    coopOptions: CoopStartOptions,
  ) => void;
  onClose: () => void;
}

export const CoopLobbyModal: React.FC<CoopLobbyModalProps> = ({
  highScore,
  initialMode,
  initialSkin,
  initialWeapon,
  initialRoomCode,
  onLaunchCoop,
  onClose,
}) => {
  const [roomCode, setRoomCode] = useState(
    () => initialRoomCode || coopSession.roomCode || generateRoomCode(),
  );
  const [role, setRole] = useState<CoopRole>(
    initialRoomCode ? 'guest' : 'ai_wingman',
  );
  const [mode, setMode] = useState<GameMode>(initialMode);

  // Pilot 1 (Tommy)
  const [p1Callsign, setP1Callsign] = useState('TOMMY');
  const [p1Skin, setP1Skin] = useState<ShipSkin>(initialSkin);
  const [p1Weapon, setP1Weapon] = useState<WeaponType>(initialWeapon);
  const [p1Ready, setP1Ready] = useState(true);

  // Pilot 2 (Teammate / Wingman)
  const [p2Callsign, setP2Callsign] = useState('NOVA-2');
  const [p2Skin, setP2Skin] = useState<ShipSkin>(
    initialSkin === 'cyan' ? 'violet' : 'cyan',
  );
  const [p2Weapon, setP2Weapon] = useState<WeaponType>('homing');
  const [p2Ready, setP2Ready] = useState(true);

  const [copiedLink, setCopiedLink] = useState(false);
  const [showWebRtcHandshake, setShowWebRtcHandshake] = useState(false);
  const [localToken, setLocalToken] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [p2pStatus, setP2pStatus] = useState('Ready to pair');

  useEffect(() => {
    coopSession.localPilot = {
      callsign: p1Callsign,
      skin: p1Skin,
      weapon: p1Weapon,
      ready: p1Ready,
    };
    coopSession.joinRoom(roomCode, role);
  }, [roomCode, role, p1Callsign, p1Skin, p1Weapon, p1Ready]);

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/?coop=${encodeURIComponent(roomCode)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
    } catch {
      setCopiedLink(true);
    }
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCreateOffer = async () => {
    setP2pStatus('Generating WebRTC Offer...');
    const token = await coopSession.createWebRtcOfferToken();
    setLocalToken(token);
    setP2pStatus('Offer ready — copy and send to wingman');
  };

  const handleAcceptRemoteToken = async () => {
    if (!remoteToken.trim()) return;
    if (!localToken) {
      setP2pStatus('Accepting Offer & generating Answer...');
      const answer = await coopSession.acceptWebRtcOfferAndCreateAnswer(remoteToken);
      setLocalToken(answer);
      setP2pStatus('Answer token generated — send back to host');
    } else {
      const ok = await coopSession.finalizeWebRtcAnswer(remoteToken);
      setP2pStatus(ok ? 'WebRTC DataChannel Linked!' : 'Invalid token');
    }
  };

  const handleJointLaunch = () => {
    const coopOpts: CoopStartOptions = {
      enabled: true,
      role,
      roomCode,
      partner: {
        callsign: p2Callsign.trim().toUpperCase() || 'NOVA-2',
        skin: p2Skin,
        weapon: p2Weapon,
        ready: p2Ready,
      },
    };
    coopSession.sendPacket({
      type: 'launch_campaign',
      roomCode,
      senderRole: role,
      mode,
      pilot: coopSession.localPilot,
    });
    onLaunchCoop(mode, p1Weapon, p1Skin, coopOpts);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070b14]/88 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coop-lobby-title"
      data-block-hotkeys="true"
      data-testid="coop-lobby-modal"
    >
      <div className="animate-modal-enter w-full max-w-3xl max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#00f5d4]/60 rounded-xl p-4 sm:p-6 shadow-[0_0_55px_rgba(0,245,212,0.18)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
          <div>
            <p className="text-[11px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
              2-Player Joint Campaign Launch · Elite Overdrive Scaling
            </p>
            <h2
              id="coop-lobby-title"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-0.5"
            >
              Squadron Co-op Hangar Lobby
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-display font-bold uppercase tracking-wider text-slate-200 hover:border-[#00f5d4] hover:text-[#00f5d4] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Room Code, Invite Link & Squadron Link Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5">
          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-slate-400 mb-1">
              Squadron Room Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={roomCode}
                maxLength={10}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full font-mono-num text-sm font-bold tracking-widest uppercase bg-[#111827] border border-[#00f5d4]/60 rounded-lg px-3 py-2 text-[#00f5d4]"
              />
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="px-3 py-2 rounded-lg bg-[#00f5d4]/15 border border-[#00f5d4]/60 text-xs font-mono-num font-bold text-[#00f5d4] hover:bg-[#00f5d4]/25 whitespace-nowrap cursor-pointer"
              >
                {copiedLink ? 'Invite Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-slate-400 mb-1">
              Co-op Connection Mode
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CoopRole)}
              className="w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-[#00f5d4]"
            >
              <option value="ai_wingman">
                AI Squadron Partner (100% Offline Ready)
              </option>
              <option value="dual_local">
                Same-Device Dual Control (WASD + IJKL)
              </option>
              <option value="host">P2P Room Host (WebRTC / Local Mesh)</option>
              <option value="guest">P2P Room Join (WebRTC / Local Mesh)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono-num uppercase tracking-wider text-slate-400 mb-1">
              Joint Mission Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GameMode)}
              className="w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-[#00f5d4]"
            >
              <option value="campaign">Co-op Campaign (Elite Dreadnoughts)</option>
              <option value="survival">Co-op Endless Survival</option>
              <option value="daily">Co-op Daily Challenge</option>
            </select>
          </div>
        </div>

        {/* Optional Serverless WebRTC Direct Handshake drawer */}
        {(role === 'host' || role === 'guest') && (
          <div className="mb-4 bg-[#0b0f19] border border-[#38bdf8]/40 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-num text-[#38bdf8]">
                P2P Room Mesh Active ({roomCode}) · {p2pStatus}
              </span>
              <button
                type="button"
                onClick={() => setShowWebRtcHandshake((prev) => !prev)}
                className="text-[11px] font-mono-num underline text-slate-300 hover:text-[#00f5d4] cursor-pointer"
              >
                {showWebRtcHandshake
                  ? 'Hide Cross-Device WebRTC Token'
                  : 'Cross-Device WebRTC SDP Token'}
              </button>
            </div>
            {showWebRtcHandshake && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCreateOffer()}
                    className="py-1.5 px-2.5 rounded bg-[#38bdf8]/20 border border-[#38bdf8] text-[#38bdf8] font-mono-num text-[11px] font-bold cursor-pointer"
                  >
                    1. Generate P2P Offer Token
                  </button>
                  <input
                    type="text"
                    readOnly
                    value={localToken}
                    placeholder="Your Offer/Answer token appears here"
                    className="bg-[#111827] border border-slate-700 rounded px-2 py-1 text-[11px] font-mono-num text-slate-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void handleAcceptRemoteToken()}
                    className="py-1.5 px-2.5 rounded bg-[#a3ff12]/20 border border-[#a3ff12] text-[#a3ff12] font-mono-num text-[11px] font-bold cursor-pointer"
                  >
                    2. Link Partner Offer/Answer Token
                  </button>
                  <input
                    type="text"
                    value={remoteToken}
                    onChange={(e) => setRemoteToken(e.target.value)}
                    placeholder="Paste partner token here"
                    className="bg-[#111827] border border-slate-700 rounded px-2 py-1 text-[11px] font-mono-num text-slate-300"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dual Pilot Hangar Customization Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
          {/* Pilot 1 Card */}
          <div className="bg-[#0b0f19] border border-[#00f5d4]/50 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
                  Pilot 1 · Lead Starfighter
                </span>
                <span className="text-[10px] font-mono-num font-bold px-2 py-0.5 rounded bg-[#00f5d4]/15 text-[#00f5d4]">
                  {p1Ready ? 'READY' : 'STANDBY'}
                </span>
              </div>

              <div className="mt-2.5 space-y-2.5">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Callsign
                  <input
                    type="text"
                    maxLength={10}
                    value={p1Callsign}
                    onChange={(e) => setP1Callsign(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-mono-num font-bold text-slate-100"
                  />
                </label>

                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Weapon Loadout
                  <select
                    value={p1Weapon}
                    onChange={(e) => setP1Weapon(e.target.value as WeaponType)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    <option value="spread">Spread Shot</option>
                    <option value="laser">Laser Beam</option>
                    <option value="homing">Homing Missiles</option>
                    <option value="plasma">Plasma Burst</option>
                  </select>
                </label>

                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  3D Ship Skin
                  <select
                    value={p1Skin}
                    onChange={(e) => setP1Skin(e.target.value as ShipSkin)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    {SHIP_SKINS.map((s) => {
                      const unlocked = isShipSkinUnlocked(s.id, highScore);
                      return (
                        <option key={s.id} value={s.id} disabled={!unlocked}>
                          {unlocked ? s.name : `${s.name} (${s.unlockScore} pts)`}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setP1Ready((prev) => !prev)}
              className={`w-full py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                p1Ready
                  ? 'bg-[#00f5d4] text-[#070b14]'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {p1Ready ? 'Pilot 1 Ready ✓' : 'Click to Ready Up'}
            </button>
          </div>

          {/* Pilot 2 Card */}
          <div className="bg-[#0b0f19] border border-[#c084fc]/50 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#c084fc]">
                  Pilot 2 · Wingman Starfighter
                </span>
                <span className="text-[10px] font-mono-num font-bold px-2 py-0.5 rounded bg-[#a3ff12]/15 text-[#a3ff12]">
                  {p2Ready ? 'READY' : 'STANDBY'}
                </span>
              </div>

              <div className="mt-2.5 space-y-2.5">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Wingman Callsign
                  <input
                    type="text"
                    maxLength={10}
                    value={p2Callsign}
                    onChange={(e) => setP2Callsign(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-mono-num font-bold text-slate-100"
                  />
                </label>

                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Wingman Weapon Loadout
                  <select
                    value={p2Weapon}
                    onChange={(e) => setP2Weapon(e.target.value as WeaponType)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    <option value="spread">Spread Shot</option>
                    <option value="laser">Laser Beam</option>
                    <option value="homing">Homing Missiles</option>
                    <option value="plasma">Plasma Burst</option>
                  </select>
                </label>

                <label className="block text-[10px] uppercase tracking-wider text-slate-400">
                  Wingman 3D Ship Skin
                  <select
                    value={p2Skin}
                    onChange={(e) => setP2Skin(e.target.value as ShipSkin)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    {SHIP_SKINS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setP2Ready((prev) => !prev)}
              className={`w-full py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                p2Ready
                  ? 'bg-[#a3ff12] text-[#070b14]'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {p2Ready ? 'Pilot 2 Ready ✓' : 'Click to Ready Up'}
            </button>
          </div>
        </div>

        {/* Squadron Fusion & Mechanics Summary */}
        <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-3 mb-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-[#00f5d4]">Squadron Fusion [L]:</strong> Fly close
            for an <span className="text-[#c084fc]">Energy Tether</span> that slices
            enemies, or activate <span className="text-[#a3ff12]">Squadron Link</span>{' '}
            to dock into a <strong>Twin-Core Heavy Gunship</strong> with combined
            dual-weapon fire!
          </div>
        </div>

        {/* Joint Launch CTA */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={!p1Ready || !p2Ready}
            data-testid="launch-coop-campaign-button"
            onClick={handleJointLaunch}
            className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-[#00f5d4] text-[#070b14] font-display font-bold text-sm sm:text-base uppercase tracking-wider shadow-[0_0_25px_rgba(0,245,212,0.45)] hover:bg-[#38ffe5] disabled:opacity-45 cursor-pointer"
          >
            Launch Joint Co-op Campaign
          </button>
        </div>
      </div>
    </div>
  );
};
