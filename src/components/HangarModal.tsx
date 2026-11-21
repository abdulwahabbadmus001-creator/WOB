import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { soundFX } from '../game/audio';
import {
  canPurchaseHangarUpgrade,
  getHangarUpgradeCost,
  getShipSkinConfig,
  HANGAR_UPGRADE_CATALOG,
  type HangarStoreState,
} from '../game/rules';
import type { HangarUpgradeId, ShipSkin } from '../game/types';

interface HangarModalProps {
  hangar: HangarStoreState;
  skin: ShipSkin;
  onBuyHangarUpgrade: (id: HangarUpgradeId) => void;
  onClose: () => void;
}

export const HangarModal: React.FC<HangarModalProps> = ({
  hangar,
  skin,
  onBuyHangarUpgrade,
  onClose,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let rafId: number | null = null;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(320, 170, false);
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 320 / 170, 1, 500);
    camera.position.set(0, -52, 42);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight('#334155', 2.5));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
    keyLight.position.set(35, -45, 65);
    scene.add(keyLight);

    const skinCfg = getShipSkinConfig(skin);
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);

    const hullMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: skinCfg.hullColor,
      emissiveIntensity: 0.4,
      metalness: 0.75,
      roughness: 0.25,
    });
    const trimMat = new THREE.MeshBasicMaterial({ color: skinCfg.hullColor });

    // Fuselage
    const fuselageGeo = new THREE.ConeGeometry(8.5, 36, 5);
    fuselageGeo.rotateZ(-Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    fuselage.scale.set(1, 0.75, 0.52);
    shipGroup.add(fuselage);

    const wire = new THREE.Mesh(
      fuselageGeo,
      new THREE.MeshBasicMaterial({
        color: skinCfg.hullColor,
        wireframe: true,
      }),
    );
    wire.scale.set(1.03, 0.78, 0.55);
    shipGroup.add(wire);

    // Wings
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 32, 2.2), hullMat);
    wing.position.set(-4, 0, -1);
    shipGroup.add(wing);

    // Modular Part 1: Thruster Speed -> Twin Afterburner Pods
    if (hangar.levels.thruster > 0) {
      const podGeo = new THREE.CylinderGeometry(2.6, 3.2, 13, 8);
      podGeo.rotateZ(Math.PI / 2);
      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(podGeo, trimMat);
        pod.position.set(-12, side * 11, 0.5);
        shipGroup.add(pod);
      }
    }

    // Modular Part 2: Hull Integrity -> Titanium Wing Armor Plates
    if (hangar.levels.hull > 0) {
      const armorGeo = new THREE.BoxGeometry(14, 5.5, 4.2);
      const armorMat = new THREE.MeshBasicMaterial({ color: '#a3ff12' });
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(armorGeo, armorMat);
        plate.position.set(-2, side * 15.5, 0.5);
        shipGroup.add(plate);
      }
    }

    // Modular Part 3: Weapon Overclock -> Dual Overclock Cannon Barrels
    if (hangar.levels.overclock > 0) {
      const cannonGeo = new THREE.CylinderGeometry(1.1, 1.3, 18, 6);
      cannonGeo.rotateZ(-Math.PI / 2);
      const cannonMat = new THREE.MeshBasicMaterial({ color: '#ff007f' });
      for (const side of [-1, 1]) {
        const barrel = new THREE.Mesh(cannonGeo, cannonMat);
        barrel.position.set(8, side * 13, 0);
        shipGroup.add(barrel);
      }
    }

    // Modular Part 4: Energy Regen -> Quantum Reactor Halo Core
    let haloMesh: THREE.Mesh | null = null;
    if (hangar.levels.regen > 0) {
      haloMesh = new THREE.Mesh(
        new THREE.TorusGeometry(7.2, 1.1, 8, 24),
        new THREE.MeshBasicMaterial({ color: '#38bdf8' }),
      );
      haloMesh.position.set(-3, 0, 6.5);
      shipGroup.add(haloMesh);
    }

    let angle = 0;
    const animate = () => {
      angle += 0.022;
      shipGroup.rotation.z = angle;
      shipGroup.rotation.x = Math.sin(angle * 0.7) * 0.25;
      if (haloMesh) {
        haloMesh.rotation.z = -angle * 2.5;
      }
      renderer?.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      renderer?.dispose();
    };
  }, [hangar.levels, skin]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070b14]/88 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hangar-modal-title"
      data-testid="hangar-modal"
    >
      <div className="animate-modal-enter w-full max-w-2xl max-h-[calc(100%-1rem)] overflow-y-auto bg-[#0e1424] border border-[#1e293b] rounded-xl p-4 sm:p-6 shadow-[0_0_55px_rgba(0,245,212,0.16)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
          <div>
            <p className="text-[11px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
              Permanent 3D Modular Starfighter Engineering
            </p>
            <h2
              id="hangar-modal-title"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mt-0.5"
            >
              3D Ship Hangar
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#0b0f19] border border-[#a3ff12]/50 rounded-lg px-3.5 py-1.5 flex flex-col items-end">
              <span className="text-[9px] font-mono-num uppercase tracking-wider text-slate-400">
                Available Scrap
              </span>
              <span
                data-testid="hangar-scrap"
                className="font-mono-num text-lg font-bold text-[#a3ff12] leading-none mt-0.5"
              >
                {hangar.scrap}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-display font-bold uppercase tracking-wider text-slate-200 hover:border-[#00f5d4] hover:text-[#00f5d4] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Live 3D Rotating Starfighter Modular Preview */}
        <div className="my-3.5 bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <canvas
            ref={previewCanvasRef}
            width={320}
            height={170}
            className="w-[260px] h-[140px] sm:w-[300px] sm:h-[160px] rounded-lg bg-[#0b0f19] border border-slate-800/80 shrink-0"
          />
          <div className="flex flex-col gap-1.5 text-xs text-slate-300">
            <span className="text-[10px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
              Active 3D Modular Attachments
            </span>
            <p className="text-slate-400 leading-relaxed">
              Upgrading systems permanently attaches 3D hardware modules onto Tommy&apos;s
              starfighter hull and persists offline across all Campaign, Co-op, and
              Survival runs.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1 font-mono-num text-[10px]">
              {HANGAR_UPGRADE_CATALOG.map((cfg) => {
                const lv = hangar.levels[cfg.id];
                return (
                  <span
                    key={cfg.id}
                    className="px-2 py-0.5 rounded border"
                    style={{
                      borderColor: lv > 0 ? cfg.accentColor : '#334155',
                      color: lv > 0 ? cfg.accentColor : '#64748b',
                    }}
                  >
                    {cfg.partName}: {lv > 0 ? `MK-${lv}` : 'NONE'}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4 Permanent Hangar Upgrades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          {HANGAR_UPGRADE_CATALOG.map((cfg) => {
            const level = hangar.levels[cfg.id];
            const isMaxed = level >= cfg.maxLevel;
            const cost = getHangarUpgradeCost(cfg.id, level);
            const affordable = canPurchaseHangarUpgrade(
              cfg.id,
              hangar.levels,
              hangar.scrap,
            );

            return (
              <div
                key={cfg.id}
                className="flex flex-col justify-between gap-3 bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className="font-display font-bold text-sm sm:text-base"
                      style={{ color: cfg.accentColor }}
                    >
                      {cfg.name}
                    </h3>
                    <span className="text-[10px] font-mono-num text-slate-400">
                      3D Part: {cfg.partName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">
                    {cfg.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
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
                    onClick={() => {
                      soundFX.unlock();
                      onBuyHangarUpgrade(cfg.id);
                    }}
                    className={`px-3.5 py-2 rounded-md text-xs font-mono-num font-bold transition-colors whitespace-nowrap ${
                      isMaxed
                        ? 'bg-slate-800/70 text-slate-500 cursor-default'
                        : affordable
                          ? 'bg-[#00f5d4] text-[#070b14] hover:bg-[#38ffe5] cursor-pointer'
                          : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {isMaxed ? 'Max MK-5' : `Attach · ${cost} Scrap`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
