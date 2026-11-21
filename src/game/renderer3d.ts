import * as THREE from 'three';
import { getShipSkinConfig } from './rules';
import type {
  BossSubsystem,
  EnemyKind,
  HangarUpgradeLevels,
  ShipSkin,
  WeaponType,
} from './types';

export interface Render3DEntityEnemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  z?: number;
  radius: number;
  angle: number;
  hitFlash: number;
  dyingTimer: number;
  stunTimer: number;
  shielded?: boolean;
  shieldOpenTimer?: number;
  isChapterBoss?: boolean;
  laserActiveTimer?: number;
  laserAngle?: number;
  laserCount?: number;
  subsystems?: BossSubsystem[];
  warpInTimer?: number;
}

export interface Render3DEntityBullet {
  active: boolean;
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  radius: number;
  fromEnemy: boolean;
  color: string;
}

export interface Render3DEntityOrb {
  active: boolean;
  x: number;
  y: number;
  pulse: number;
}

export interface Render3DEntityParticle {
  active: boolean;
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Render3DEntityHazard {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface Render3DSceneState {
  width: number;
  height: number;
  time: number;
  isTitle: boolean;
  quality: 'high' | 'medium' | 'performance';
  shakeX: number;
  shakeY: number;
  // Tommy (6-DOF 3D Flight)
  playerX: number;
  playerY: number;
  playerZ: number;
  playerVx: number;
  playerVy: number;
  playerVz: number;
  playerAngle: number;
  playerSkin: ShipSkin;
  playerWeapon: WeaponType;
  playerHitFlash: number;
  playerInvuln: number;
  playerShield: number;
  tacticalShieldActive: boolean;
  tacticalShieldPulse: number;
  dashRatio: number; // > 0 during active dash for 360 barrel roll
  hangarLevels: HangarUpgradeLevels;
  isDying: boolean;
  // Polly & Twin Polly
  pollyActive: boolean;
  pollyX: number;
  pollyY: number;
  pollyAngle: number;
  pollyBeamFlash: number;
  pollyBeamTargetX: number;
  pollyBeamTargetY: number;
  twinPollyActive: boolean;
  twinPollyX: number;
  twinPollyY: number;
  twinPollyAngle: number;
  // Co-op Teammate & Squadron Fusion
  coopActive: boolean;
  teammateX: number;
  teammateY: number;
  teammateZ?: number;
  teammateVx: number;
  teammateVy: number;
  teammateAngle: number;
  teammateSkin: ShipSkin;
  teammateDowned: boolean;
  squadronLinkActive: boolean;
  squadronFusionDocked: boolean;
  // EMP 3D Shockwave
  empActive: boolean;
  empX: number;
  empY: number;
  empRadius: number;
  empAlpha: number;
  // Pools
  enemies: Render3DEntityEnemy[];
  bullets: Render3DEntityBullet[];
  orbs: Render3DEntityOrb[];
  particles: Render3DEntityParticle[];
  hazards: Render3DEntityHazard[];
}

const MAX_3D_BULLETS = 180;
const MAX_3D_ORBS = 90;
const MAX_3D_PARTICLES = 220;
const MAX_3D_HAZARDS = 8;
const MAX_3D_ENEMIES = 48;
const MAX_PROJECTILE_LIGHTS = 6;

export class WobRenderer3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private available = false;

  private width = 1280;
  private height = 720;

  // Environment
  private starLayers: THREE.Points[] = [];
  private nebulaClouds: THREE.Mesh[] = [];
  private gridHelper: THREE.GridHelper;

  // Ships
  private tommyGroup: THREE.Group;
  private tommyRollPivot: THREE.Group;
  private tommyShieldDome: THREE.Mesh;
  private tommyShieldWire: THREE.Mesh;
  private tommyAltitudeRing: THREE.Mesh;
  private tommyAltitudeLine: THREE.Line;
  private tommySkinApplied: ShipSkin | null = null;
  private tommyHangarHash = '';

  private teammateGroup: THREE.Group;
  private teammateRollPivot: THREE.Group;
  private teammateBeaconMesh: THREE.Mesh;
  private teammateSkinApplied: ShipSkin | null = null;

  private pollyGroup: THREE.Group;
  private twinPollyGroup: THREE.Group;
  private pollyBeamLine: THREE.Line;

  // Squadron Link Plasma Tether & EMP Shockwave Ring
  private tetherMesh: THREE.Mesh;
  private empRingMesh: THREE.Mesh;
  private empInnerRingMesh: THREE.Mesh;

  // Pooled 3D Entities
  private bulletMeshes: THREE.Mesh[] = [];
  private orbMeshes: THREE.Mesh[] = [];
  private particleMeshes: THREE.Mesh[] = [];
  private hazardMeshes: THREE.Mesh[] = [];
  private enemyGroups: THREE.Group[] = [];
  private bossCapitalGroup: THREE.Group;
  private bossSubsystemMeshes: THREE.Mesh[] = [];
  private bossLaserMeshes: THREE.Mesh[] = [];

  // Dynamic Lights
  private playerLight: THREE.PointLight;
  private bossLight: THREE.PointLight;
  private projectileLights: THREE.PointLight[] = [];

  // Smooth banking state
  private tommyBankRoll = 0;
  private tommyBankPitch = 0;
  private mateBankRoll = 0;
  private mateBankPitch = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070b14');
    this.scene.fog = new THREE.FogExp2('#070b14', 0.00055);

    this.camera = new THREE.PerspectiveCamera(46, 1280 / 720, 10, 3500);
    this.camera.position.set(0, -140, 880);
    this.camera.lookAt(0, 0, 0);

    // Ambient & Directional Rim Lighting
    const ambient = new THREE.AmbientLight('#1e293b', 2.4);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight('#f8fafc', 2.2);
    dirLight.position.set(220, -340, 620);
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight('#00f5d4', 1.35);
    rimLight.position.set(-300, 320, 280);
    this.scene.add(rimLight);

    this.playerLight = new THREE.PointLight('#00f5d4', 3.5, 360, 1.5);
    this.scene.add(this.playerLight);

    this.bossLight = new THREE.PointLight('#ff007f', 4.5, 520, 1.4);
    this.bossLight.visible = false;
    this.scene.add(this.bossLight);

    for (let i = 0; i < MAX_PROJECTILE_LIGHTS; i++) {
      const pl = new THREE.PointLight('#00f5d4', 2.2, 180, 1.8);
      pl.visible = false;
      this.scene.add(pl);
      this.projectileLights.push(pl);
    }

    // 3D Cyber Grid Floor
    this.gridHelper = new THREE.GridHelper(2400, 36, '#00f5d4', '#13233f');
    this.gridHelper.rotation.x = Math.PI / 2;
    this.gridHelper.position.z = -110;
    const gridMat = this.gridHelper.material as THREE.Material;
    if (gridMat) {
      gridMat.transparent = true;
      gridMat.opacity = 0.25;
    }
    this.scene.add(this.gridHelper);

    this.initStarfieldAndNebula();

    // Build Starfighter Groups
    this.tommyGroup = new THREE.Group();
    this.tommyRollPivot = new THREE.Group();
    this.tommyGroup.add(this.tommyRollPivot);
    this.scene.add(this.tommyGroup);

    // 3D Geodesic Energy Dome for Tactical Shield
    const shieldGeo = new THREE.IcosahedronGeometry(26, 1);
    this.tommyShieldDome = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshPhongMaterial({
        color: '#00f5d4',
        emissive: '#00f5d4',
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    this.tommyShieldWire = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshBasicMaterial({
        color: '#a3ff12',
        wireframe: true,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.tommyShieldDome.add(this.tommyShieldWire);
    this.tommyShieldDome.visible = false;
    this.tommyGroup.add(this.tommyShieldDome);

    // 3D Altitude Floor Projection Ring & Vertical Elevation Tether
    this.tommyAltitudeRing = new THREE.Mesh(
      new THREE.RingGeometry(10, 13.5, 24),
      new THREE.MeshBasicMaterial({
        color: '#00f5d4',
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    this.tommyAltitudeRing.visible = false;
    this.scene.add(this.tommyAltitudeRing);

    const altLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -35),
      new THREE.Vector3(0, 0, 12),
    ]);
    this.tommyAltitudeLine = new THREE.Line(
      altLineGeo,
      new THREE.LineBasicMaterial({
        color: '#00f5d4',
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.tommyAltitudeLine.visible = false;
    this.scene.add(this.tommyAltitudeLine);

    // Teammate Group
    this.teammateGroup = new THREE.Group();
    this.teammateRollPivot = new THREE.Group();
    this.teammateGroup.add(this.teammateRollPivot);
    this.teammateBeaconMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(14, 0),
      new THREE.MeshBasicMaterial({
        color: '#ff2a5f',
        wireframe: true,
      }),
    );
    this.teammateBeaconMesh.visible = false;
    this.teammateGroup.add(this.teammateBeaconMesh);
    this.teammateGroup.visible = false;
    this.scene.add(this.teammateGroup);

    // Polly & Twin Polly 3D Wingman Craft
    this.pollyGroup = this.buildPollyWingmanMesh('#a3ff12');
    this.pollyGroup.visible = false;
    this.scene.add(this.pollyGroup);

    this.twinPollyGroup = this.buildPollyWingmanMesh('#00f5d4');
    this.twinPollyGroup.visible = false;
    this.scene.add(this.twinPollyGroup);

    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(10, 10, 5),
    ]);
    this.pollyBeamLine = new THREE.Line(
      beamGeo,
      new THREE.LineBasicMaterial({ color: '#a3ff12', linewidth: 3 }),
    );
    this.pollyBeamLine.visible = false;
    this.scene.add(this.pollyBeamLine);

    // Squadron Link Plasma Tether Beam
    this.tetherMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 1, 8),
      new THREE.MeshBasicMaterial({
        color: '#00f5d4',
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.tetherMesh.visible = false;
    this.scene.add(this.tetherMesh);

    // 3D EMP Expanding Shockwave Torus Ring
    this.empRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.045, 12, 48),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.empInnerRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.02, 8, 48),
      new THREE.MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.75,
      }),
    );
    this.empRingMesh.add(this.empInnerRingMesh);
    this.empRingMesh.visible = false;
    this.scene.add(this.empRingMesh);

    // Capital Dreadnought Boss 3D Mesh
    this.bossCapitalGroup = this.buildCapitalStarshipMesh();
    this.bossCapitalGroup.visible = false;
    this.scene.add(this.bossCapitalGroup);

    this.initEntityPools();
    this.tryInitWebGL();
  }

  private tryInitWebGL(): void {
    if (typeof document === 'undefined') return;
    try {
      const offscreenCanvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({
        canvas: offscreenCanvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      this.renderer.setSize(this.width, this.height, false);
      this.available = true;
    } catch {
      this.available = false;
      this.renderer = null;
    }
  }

  public isAvailable(): boolean {
    return this.available && this.renderer !== null;
  }

  public getDomElement(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  public resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(280, width);
    this.height = Math.max(200, height);
    this.camera.aspect = this.width / this.height;
    // Dynamically adjust camera distance so the entire width x height arena fits accurately
    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const distForHeight = this.height / 2 / Math.tan(vFovRad / 2);
    this.camera.position.set(0, -this.height * 0.14, distForHeight * 0.98);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(dpr, 1.75));
      this.renderer.setSize(this.width, this.height, false);
    }
  }

  private worldTo3D(wx: number, wy: number, z = 0): THREE.Vector3 {
    return new THREE.Vector3(wx - this.width * 0.5, this.height * 0.5 - wy, z);
  }

  private initStarfieldAndNebula(): void {
    // 3 Depth layers of 3D parallax stars
    const layerConfigs = [
      { count: 280, zMin: -420, zMax: -220, size: 2.8, color: '#38bdf8' },
      { count: 180, zMin: -210, zMax: -80, size: 3.6, color: '#00f5d4' },
      { count: 95, zMin: -75, zMax: -20, size: 4.5, color: '#f8fafc' },
    ];

    for (const cfg of layerConfigs) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(cfg.count * 3);
      for (let i = 0; i < cfg.count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2400;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1600;
        positions[i * 3 + 2] = cfg.zMin + Math.random() * (cfg.zMax - cfg.zMin);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: cfg.color,
        size: cfg.size,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      this.scene.add(pts);
      this.starLayers.push(pts);
    }

    // Volumetric drifting nebula clouds
    const nebulaColors = ['#00f5d4', '#ff007f', '#7c3aed', '#0284c7'];
    const nebGeo = new THREE.IcosahedronGeometry(180, 2);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: nebulaColors[i % nebulaColors.length],
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(nebGeo, mat);
      cloud.position.set(
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 750,
        -190 - i * 30,
      );
      cloud.scale.set(1.6 + (i % 2) * 0.7, 1.1, 0.45);
      this.scene.add(cloud);
      this.nebulaClouds.push(cloud);
    }
  }

  public buildStarfighterMesh(
    targetPivot: THREE.Group,
    skin: ShipSkin,
    hangar: HangarUpgradeLevels,
  ): void {
    while (targetPivot.children.length > 0) {
      targetPivot.remove(targetPivot.children[0]);
    }

    const skinCfg = getShipSkinConfig(skin);

    const hullMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: skinCfg.hullColor,
      emissiveIntensity: 0.35,
      metalness: 0.75,
      roughness: 0.25,
    });

    const trimMat = new THREE.MeshBasicMaterial({
      color: skinCfg.hullColor,
    });

    const engineMat = new THREE.MeshBasicMaterial({
      color: skinCfg.trailColor,
    });

    // Main Sleek 3D Starfighter Fuselage (pointing along +X in local space)
    const fuselageGeo = new THREE.ConeGeometry(8.5, 36, 5);
    fuselageGeo.rotateZ(-Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    fuselage.scale.set(1, 0.75, 0.52);
    targetPivot.add(fuselage);

    // Glowing Wireframe Neon Edge Trim
    const trimWire = new THREE.Mesh(
      fuselageGeo,
      new THREE.MeshBasicMaterial({
        color: skinCfg.hullColor,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      }),
    );
    trimWire.scale.set(1.03, 0.78, 0.55);
    targetPivot.add(trimWire);

    // Swept Delta Wings
    const wingGeo = new THREE.BoxGeometry(16, 32, 2.2);
    const wingMesh = new THREE.Mesh(wingGeo, hullMat);
    wingMesh.position.set(-4, 0, -1);
    targetPivot.add(wingMesh);

    const wingTipsGeo = new THREE.BoxGeometry(12, 34, 1.2);
    const wingTips = new THREE.Mesh(wingTipsGeo, trimMat);
    wingTips.position.set(-5, 0, -1);
    targetPivot.add(wingTips);

    // Cockpit Canopy
    const canopyGeo = new THREE.OctahedronGeometry(4.8, 1);
    const canopy = new THREE.Mesh(
      canopyGeo,
      new THREE.MeshBasicMaterial({ color: skinCfg.trailColor }),
    );
    canopy.scale.set(1.45, 0.65, 0.75);
    canopy.position.set(3, 0, 3.8);
    targetPivot.add(canopy);

    // Primary Engine Thruster Flame Cone
    const flameGeo = new THREE.ConeGeometry(4.5, 16, 8);
    flameGeo.rotateZ(Math.PI / 2);
    const flame = new THREE.Mesh(flameGeo, engineMat);
    flame.position.set(-22, 0, 0);
    flame.name = 'thruster_flame';
    targetPivot.add(flame);

    // --- 3D Modular Hangar Upgrade Parts ---
    // 1. Thruster Speed -> Twin Afterburner Pods
    if (hangar.thruster > 0) {
      const podGeo = new THREE.CylinderGeometry(2.6, 3.2, 13, 8);
      podGeo.rotateZ(Math.PI / 2);
      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(podGeo, trimMat);
        pod.position.set(-12, side * 11, 0.5);
        targetPivot.add(pod);
      }
    }

    // 2. Hull Integrity -> Titanium Wing Armor Plates
    if (hangar.hull > 0) {
      const armorGeo = new THREE.BoxGeometry(14, 5.5, 4.2);
      const armorMat = new THREE.MeshBasicMaterial({ color: '#a3ff12' });
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(armorGeo, armorMat);
        plate.position.set(-2, side * 15.5, 0.5);
        targetPivot.add(plate);
      }
    }

    // 3. Weapon Overclock -> Dual Overclock Cannon Barrels
    if (hangar.overclock > 0) {
      const cannonGeo = new THREE.CylinderGeometry(1.1, 1.3, 18, 6);
      cannonGeo.rotateZ(-Math.PI / 2);
      const cannonMat = new THREE.MeshBasicMaterial({ color: '#ff007f' });
      for (const side of [-1, 1]) {
        const barrel = new THREE.Mesh(cannonGeo, cannonMat);
        barrel.position.set(8, side * 13, 0);
        targetPivot.add(barrel);
      }
    }

    // 4. Energy Regen -> Quantum Reactor Halo Core
    if (hangar.regen > 0) {
      const haloGeo = new THREE.TorusGeometry(7.2, 1.1, 8, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(-3, 0, 6.5);
      halo.name = 'reactor_halo';
      targetPivot.add(halo);
    }
  }

  private buildPollyWingmanMesh(accentColor: string): THREE.Group {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.OctahedronGeometry(10, 0),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        emissive: accentColor,
        emissiveIntensity: 0.5,
      }),
    );
    hull.scale.set(1.4, 0.9, 0.55);
    group.add(hull);

    const wire = new THREE.Mesh(
      new THREE.OctahedronGeometry(10.8, 0),
      new THREE.MeshBasicMaterial({
        color: accentColor,
        wireframe: true,
      }),
    );
    wire.scale.set(1.4, 0.9, 0.55);
    group.add(wire);
    return group;
  }

  private buildCapitalStarshipMesh(): THREE.Group {
    const group = new THREE.Group();

    // Central Armored Dreadnought Hull
    const hullGeo = new THREE.CylinderGeometry(52, 52, 24, 8);
    hullGeo.rotateX(Math.PI / 2);
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#140c1c',
      emissive: '#ff007f',
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.2,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    group.add(hull);

    const wireGeo = new THREE.CylinderGeometry(54, 54, 26, 8);
    wireGeo.rotateX(Math.PI / 2);
    const wire = new THREE.Mesh(
      wireGeo,
      new THREE.MeshBasicMaterial({
        color: '#ff007f',
        wireframe: true,
      }),
    );
    group.add(wire);

    // Bridge Superstructure & Rotating Reactor Ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(36, 3.2, 10, 32),
      new THREE.MeshBasicMaterial({ color: '#ff6b35' }),
    );
    ring.position.z = 14;
    ring.name = 'boss_ring';
    group.add(ring);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(16, 1),
      new THREE.MeshBasicMaterial({ color: '#a3ff12', wireframe: true }),
    );
    core.position.z = 18;
    core.name = 'boss_core';
    group.add(core);

    // 4 Destructible Subsystem 3D Turret Nodes
    for (let i = 0; i < 4; i++) {
      const subMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(11, 0),
        new THREE.MeshBasicMaterial({
          color: i === 3 ? '#a3ff12' : '#38bdf8',
          wireframe: false,
        }),
      );
      subMesh.visible = false;
      this.scene.add(subMesh);
      this.bossSubsystemMeshes.push(subMesh);
    }

    // 3 Sweeping Boss Laser Beam 3D Cylinders
    for (let i = 0; i < 3; i++) {
      const beamGeo = new THREE.CylinderGeometry(5, 5, 820, 8);
      beamGeo.translate(0, 410, 0);
      beamGeo.rotateZ(-Math.PI / 2);
      const beamMesh = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: '#ff007f',
          transparent: true,
          opacity: 0.78,
        }),
      );
      beamMesh.visible = false;
      this.scene.add(beamMesh);
      this.bossLaserMeshes.push(beamMesh);
    }

    return group;
  }

  private initEntityPools(): void {
    // Bullets
    const bulletGeo = new THREE.SphereGeometry(4.5, 8, 8);
    for (let i = 0; i < MAX_3D_BULLETS; i++) {
      const mesh = new THREE.Mesh(
        bulletGeo,
        new THREE.MeshBasicMaterial({ color: '#00f5d4' }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.bulletMeshes.push(mesh);
    }

    // Data Shards (Orbs)
    const orbGeo = new THREE.OctahedronGeometry(7.5, 0);
    const orbMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      wireframe: false,
    });
    for (let i = 0; i < MAX_3D_ORBS; i++) {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.orbMeshes.push(mesh);
    }

    // Particles
    const partGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    for (let i = 0; i < MAX_3D_PARTICLES; i++) {
      const mesh = new THREE.Mesh(
        partGeo,
        new THREE.MeshBasicMaterial({
          color: '#00f5d4',
          transparent: true,
          opacity: 0.9,
        }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.particleMeshes.push(mesh);
    }

    // Asteroid Hazards
    const hazGeo = new THREE.DodecahedronGeometry(24, 0);
    const hazMat = new THREE.MeshStandardMaterial({
      color: '#291d18',
      emissive: '#ff6b35',
      emissiveIntensity: 0.28,
      roughness: 0.7,
    });
    for (let i = 0; i < MAX_3D_HAZARDS; i++) {
      const mesh = new THREE.Mesh(hazGeo, hazMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.hazardMeshes.push(mesh);
    }

    // Enemies (Block, Firewall, Interceptor)
    const blockGeo = new THREE.BoxGeometry(22, 22, 22);
    for (let i = 0; i < MAX_3D_ENEMIES; i++) {
      const grp = new THREE.Group();
      const solid = new THREE.Mesh(
        blockGeo,
        new THREE.MeshStandardMaterial({
          color: '#1f0d1d',
          emissive: '#ff2a5f',
          emissiveIntensity: 0.45,
        }),
      );
      const wire = new THREE.Mesh(
        blockGeo,
        new THREE.MeshBasicMaterial({
          color: '#ff2a5f',
          wireframe: true,
        }),
      );
      wire.scale.setScalar(1.06);
      const shieldRing = new THREE.Mesh(
        new THREE.TorusGeometry(22, 1.8, 8, 24),
        new THREE.MeshBasicMaterial({ color: '#38bdf8' }),
      );
      shieldRing.visible = false;
      grp.add(solid, wire, shieldRing);
      grp.visible = false;
      this.scene.add(grp);
      this.enemyGroups.push(grp);
    }
  }

  public render(state: Render3DSceneState, targetCtx: CanvasRenderingContext2D): boolean {
    if (!this.available || !this.renderer) return false;

    const dt = 0.016;

    // 1. Animate 3D Parallax Starfield & Nebula Clouds
    for (let i = 0; i < this.starLayers.length; i++) {
      const stars = this.starLayers[i];
      stars.rotation.z = Math.sin(state.time * 0.05 + i) * 0.04;
      stars.position.x = (state.playerX - state.width * 0.5) * -0.06 * (i + 1);
      stars.position.y = (state.height * 0.5 - state.playerY) * -0.06 * (i + 1);
    }
    for (let i = 0; i < this.nebulaClouds.length; i++) {
      const cloud = this.nebulaClouds[i];
      cloud.rotation.z = state.time * (0.04 + i * 0.01);
    }

    // Camera Shake offset
    this.camera.position.x = state.shakeX * 0.85;
    this.camera.position.y = -this.height * 0.14 - state.shakeY * 0.85;

    // 2. Update Tommy's 3D Starfighter & Modular Hangar Parts
    const hangarHash = `${state.hangarLevels.thruster}-${state.hangarLevels.hull}-${state.hangarLevels.overclock}-${state.hangarLevels.regen}`;
    if (this.tommySkinApplied !== state.playerSkin || this.tommyHangarHash !== hangarHash) {
      this.buildStarfighterMesh(this.tommyRollPivot, state.playerSkin, state.hangarLevels);
      this.tommySkinApplied = state.playerSkin;
      this.tommyHangarHash = hangarHash;
    }

    if (state.isDying) {
      this.tommyGroup.visible = false;
      this.tommyAltitudeRing.visible = false;
      this.tommyAltitudeLine.visible = false;
    } else {
      this.tommyGroup.visible = true;
      const altZ = 14 + (state.playerZ || 0) * 0.65;
      const p3 = this.worldTo3D(state.playerX, state.playerY, altZ);
      this.tommyGroup.position.copy(p3);
      this.tommyGroup.rotation.z = -state.playerAngle;
      const altPerspectiveScale = 1 + (state.playerZ || 0) * 0.0018;
      const baseScale = state.isTitle ? 1.55 : state.squadronFusionDocked ? 1.28 : 1.0;
      this.tommyGroup.scale.setScalar(baseScale * altPerspectiveScale);

      // Dynamic 6-Axis Pitch/Roll/Yaw Banking & Dash 360 Barrel Roll
      const targetRoll = Math.max(-0.62, Math.min(0.62, (state.playerVy / 310) * 0.48));
      const targetPitch = Math.max(
        -0.52,
        Math.min(
          0.52,
          (state.playerVx / 320) * 0.22 - ((state.playerVz || 0) / 220) * 0.42,
        ),
      );
      this.tommyBankRoll += (targetRoll - this.tommyBankRoll) * Math.min(1, dt * 13);
      this.tommyBankPitch += (targetPitch - this.tommyBankPitch) * Math.min(1, dt * 13);

      const barrelRoll = state.dashRatio > 0 ? (1 - state.dashRatio) * Math.PI * 2 : 0;
      this.tommyRollPivot.rotation.x = this.tommyBankRoll + barrelRoll;
      this.tommyRollPivot.rotation.y = this.tommyBankPitch;

      // 3D Altitude Floor Ring & Vertical Elevation Line
      if (!state.isTitle && Math.abs(state.playerZ || 0) > 4) {
        const floorPos = this.worldTo3D(state.playerX, state.playerY, -24);
        this.tommyAltitudeRing.visible = true;
        this.tommyAltitudeRing.position.copy(floorPos);
        this.tommyAltitudeLine.visible = true;
        this.tommyAltitudeLine.geometry.setFromPoints([floorPos, p3]);
      } else {
        this.tommyAltitudeRing.visible = false;
        this.tommyAltitudeLine.visible = false;
      }

      const halo = this.tommyRollPivot.getObjectByName('reactor_halo');
      if (halo) {
        halo.rotation.z = state.time * 3.5;
      }

      // 3D Geodesic Energy Dome on Tactical Shield or Twin-Core Fusion
      this.tommyShieldDome.visible =
        state.tacticalShieldActive || state.squadronFusionDocked || state.playerShield > 0;
      if (this.tommyShieldDome.visible) {
        this.tommyShieldDome.rotation.y = state.time * 2.4;
        this.tommyShieldDome.rotation.z = state.time * 1.8;
        const domeScale = state.squadronFusionDocked
          ? 1.55
          : state.tacticalShieldActive
            ? 1.15 + state.tacticalShieldPulse * 0.15
            : 0.88;
        this.tommyShieldDome.scale.setScalar(domeScale);
      }

      this.playerLight.position.set(p3.x, p3.y, altZ + 38);
      this.playerLight.color.set(getShipSkinConfig(state.playerSkin).hullColor);
    }

    // 3. Update Co-op Teammate Starfighter & Squadron Link Plasma Tether
    if (state.coopActive && !state.isTitle) {
      if (this.teammateSkinApplied !== state.teammateSkin) {
        this.buildStarfighterMesh(
          this.teammateRollPivot,
          state.teammateSkin,
          state.hangarLevels,
        );
        this.teammateSkinApplied = state.teammateSkin;
      }
      this.teammateGroup.visible = true;
      const m3 = state.squadronFusionDocked
        ? this.worldTo3D(state.playerX, state.playerY + 18, 14)
        : this.worldTo3D(state.teammateX, state.teammateY, 12);
      this.teammateGroup.position.copy(m3);
      this.teammateGroup.rotation.z = state.squadronFusionDocked
        ? -state.playerAngle
        : -state.teammateAngle;

      const mateTargetRoll = Math.max(
        -0.55,
        Math.min(0.55, (state.teammateVy / 320) * 0.45),
      );
      this.mateBankRoll += (mateTargetRoll - this.mateBankRoll) * Math.min(1, dt * 10);
      this.teammateRollPivot.rotation.x = this.mateBankRoll;
      this.teammateRollPivot.visible = !state.teammateDowned;
      this.teammateBeaconMesh.visible = state.teammateDowned;
      if (state.teammateDowned) {
        this.teammateBeaconMesh.rotation.y = state.time * 4;
        this.teammateBeaconMesh.rotation.z = state.time * 3;
      }

      // Squadron Link Plasma Tether
      if (state.squadronLinkActive && !state.squadronFusionDocked && !state.teammateDowned) {
        const p3 = this.tommyGroup.position;
        const dist = p3.distanceTo(m3);
        this.tetherMesh.visible = dist > 8;
        this.tetherMesh.position.lerpVectors(p3, m3, 0.5);
        this.tetherMesh.scale.set(1 + Math.sin(state.time * 28) * 0.35, dist, 1);
        const angle = Math.atan2(m3.y - p3.y, m3.x - p3.x);
        this.tetherMesh.rotation.set(0, 0, angle - Math.PI / 2);
      } else {
        this.tetherMesh.visible = false;
      }
    } else {
      this.teammateGroup.visible = false;
      this.tetherMesh.visible = false;
    }

    // 4. Update Polly & Twin Polly 3D Wingman Craft
    if (state.isTitle || state.pollyActive) {
      this.pollyGroup.visible = true;
      const pollyPos = this.worldTo3D(state.pollyX, state.pollyY, 18);
      this.pollyGroup.position.copy(pollyPos);
      this.pollyGroup.rotation.z = -state.pollyAngle;
      this.pollyGroup.rotation.x = Math.sin(state.time * 5) * 0.25;

      if (state.pollyBeamFlash > 0 && !state.isTitle) {
        const targetPos = this.worldTo3D(
          state.pollyBeamTargetX,
          state.pollyBeamTargetY,
          12,
        );
        this.pollyBeamLine.geometry.setFromPoints([pollyPos, targetPos]);
        this.pollyBeamLine.visible = true;
      } else {
        this.pollyBeamLine.visible = false;
      }
    } else {
      this.pollyGroup.visible = false;
      this.pollyBeamLine.visible = false;
    }

    if (state.twinPollyActive && !state.isTitle) {
      this.twinPollyGroup.visible = true;
      const twinPos = this.worldTo3D(state.twinPollyX, state.twinPollyY, 18);
      this.twinPollyGroup.position.copy(twinPos);
      this.twinPollyGroup.rotation.z = -state.twinPollyAngle;
      this.twinPollyGroup.rotation.x = Math.cos(state.time * 5) * 0.25;
    } else {
      this.twinPollyGroup.visible = false;
    }

    // 5. Update 3D EMP Shockwave Torus Ring
    if (state.empActive) {
      this.empRingMesh.visible = true;
      const empPos = this.worldTo3D(state.empX, state.empY, 6);
      this.empRingMesh.position.copy(empPos);
      const r = Math.max(10, state.empRadius);
      this.empRingMesh.scale.set(r, r, 24);
      (this.empRingMesh.material as THREE.MeshBasicMaterial).opacity = state.empAlpha;
    } else {
      this.empRingMesh.visible = false;
    }

    // 6. Update Enemies & Capital Starship Boss
    let enemyPoolIdx = 0;
    let activeBoss: Render3DEntityEnemy | null = null;

    for (const e of state.enemies) {
      if (e.kind === 'boss') {
        activeBoss = e;
        continue;
      }
      if (enemyPoolIdx >= MAX_3D_ENEMIES) continue;
      const grp = this.enemyGroups[enemyPoolIdx++];
      grp.visible = true;
      const ePos = this.worldTo3D(e.x, e.y, 8);
      grp.position.copy(ePos);

      const scale =
        e.dyingTimer > 0
          ? (e.radius / 15) * (1 + (1 - e.dyingTimer / 0.22) * 0.5)
          : e.radius / 15;
      grp.scale.setScalar(scale);

      if (e.kind === 'block') {
        grp.rotation.x = state.time * 1.8 + e.id;
        grp.rotation.y = state.time * 2.2 + e.id;
      } else if (e.kind === 'firewall') {
        grp.rotation.z = -e.angle;
        grp.rotation.x = Math.PI / 4;
      } else {
        grp.rotation.z = -e.angle;
        grp.rotation.x = 0;
      }

      const shieldRing = grp.children[2] as THREE.Mesh;
      if (shieldRing) {
        shieldRing.visible = Boolean(e.shielded && (e.shieldOpenTimer ?? 0) <= 0);
      }
    }
    for (let i = enemyPoolIdx; i < MAX_3D_ENEMIES; i++) {
      this.enemyGroups[i].visible = false;
    }

    // Capital Dreadnought Boss & 3D Destructible Subsystems
    if (activeBoss && !state.isTitle) {
      this.bossCapitalGroup.visible = true;
      const bPos = this.worldTo3D(activeBoss.x, activeBoss.y, 16);
      this.bossCapitalGroup.position.copy(bPos);
      this.bossCapitalGroup.rotation.z = -activeBoss.angle;
      const bScale = (activeBoss.radius / 48) * (activeBoss.isChapterBoss ? 1.18 : 0.82);
      this.bossCapitalGroup.scale.setScalar(bScale);

      const ring = this.bossCapitalGroup.getObjectByName('boss_ring');
      if (ring) ring.rotation.z = state.time * -2.2;
      const core = this.bossCapitalGroup.getObjectByName('boss_core');
      if (core) {
        core.rotation.x = state.time * 3;
        core.rotation.y = state.time * 2.5;
      }

      this.bossLight.visible = true;
      this.bossLight.position.set(bPos.x, bPos.y, 70);

      // Update 4 Destructible Subsystem 3D Turrets (at dorsal/ventral 3D worldZ elevations)
      const subs = activeBoss.subsystems ?? [];
      for (let i = 0; i < this.bossSubsystemMeshes.length; i++) {
        const mesh = this.bossSubsystemMeshes[i];
        const sub = subs[i];
        if (sub && !sub.destroyed) {
          mesh.visible = true;
          const sPos = this.worldTo3D(
            sub.worldX,
            sub.worldY,
            22 + (sub.worldZ || 0) * 0.45,
          );
          mesh.position.copy(sPos);
          mesh.rotation.z = state.time * 3 + i;
          mesh.rotation.x = state.time * 2;
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.color.set(
            sub.hitFlash > 0
              ? '#ffffff'
              : sub.kind === 'central_core'
                ? '#a3ff12'
                : sub.kind === 'shield_gen'
                  ? '#38bdf8'
                  : '#ff6b35',
          );
        } else {
          mesh.visible = false;
        }
      }

      // Boss Sweeping Laser Beams in 3D
      const laserActive = (activeBoss.laserActiveTimer ?? 0) > 0;
      const laserCount = activeBoss.laserCount ?? 2;
      for (let i = 0; i < this.bossLaserMeshes.length; i++) {
        const beam = this.bossLaserMeshes[i];
        if (laserActive && i < laserCount) {
          beam.visible = true;
          beam.position.copy(bPos);
          const ang = (activeBoss.laserAngle ?? 0) + (i / laserCount) * Math.PI * 2;
          beam.rotation.z = -ang;
        } else {
          beam.visible = false;
        }
      }
    } else {
      this.bossCapitalGroup.visible = false;
      this.bossLight.visible = false;
      for (const m of this.bossSubsystemMeshes) m.visible = false;
      for (const b of this.bossLaserMeshes) b.visible = false;
    }

    // 7. Update Pooled 3D Projectiles & Dynamic Projectile Point Lights
    let bulletMeshIdx = 0;
    let lightIdx = 0;
    for (const b of state.bullets) {
      if (!b.active || bulletMeshIdx >= MAX_3D_BULLETS) continue;
      const mesh = this.bulletMeshes[bulletMeshIdx++];
      mesh.visible = true;
      const bPos = this.worldTo3D(b.x, b.y, 12);
      mesh.position.copy(bPos);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(b.color);
      if (b.fromEnemy) {
        mesh.scale.setScalar(b.radius / 4.2);
      } else {
        const ang = Math.atan2(b.vy, b.vx);
        mesh.rotation.z = -ang;
        mesh.scale.set(2.4, 0.75, 0.75);
      }

      if (!b.fromEnemy && lightIdx < MAX_PROJECTILE_LIGHTS && state.quality !== 'performance') {
        const pl = this.projectileLights[lightIdx++];
        pl.visible = true;
        pl.position.set(bPos.x, bPos.y, 28);
        pl.color.set(b.color);
      }
    }
    for (let i = bulletMeshIdx; i < MAX_3D_BULLETS; i++) {
      this.bulletMeshes[i].visible = false;
    }
    for (let i = lightIdx; i < MAX_PROJECTILE_LIGHTS; i++) {
      this.projectileLights[i].visible = false;
    }

    // 8. Update Pooled 3D Data Shards (Orbs)
    let orbIdx = 0;
    for (const o of state.orbs) {
      if (!o.active || orbIdx >= MAX_3D_ORBS) continue;
      const mesh = this.orbMeshes[orbIdx++];
      mesh.visible = true;
      mesh.position.copy(this.worldTo3D(o.x, o.y, 8));
      mesh.rotation.y = o.pulse;
      mesh.rotation.z = o.pulse * 0.7;
      mesh.scale.setScalar(1 + Math.sin(o.pulse) * 0.18);
    }
    for (let i = orbIdx; i < MAX_3D_ORBS; i++) {
      this.orbMeshes[i].visible = false;
    }

    // 9. Update Pooled 3D Asteroid Hazards
    let hazIdx = 0;
    for (const h of state.hazards) {
      if (hazIdx >= MAX_3D_HAZARDS) continue;
      const mesh = this.hazardMeshes[hazIdx++];
      mesh.visible = true;
      mesh.position.copy(this.worldTo3D(h.x, h.y, 10));
      mesh.rotation.x = h.angle;
      mesh.rotation.y = h.angle * 0.8;
      mesh.scale.setScalar(h.radius / 24);
    }
    for (let i = hazIdx; i < MAX_3D_HAZARDS; i++) {
      this.hazardMeshes[i].visible = false;
    }

    // 10. Update Pooled 3D Particles
    const maxParticles =
      state.quality === 'performance'
        ? 80
        : state.quality === 'medium'
          ? 140
          : MAX_3D_PARTICLES;
    let partIdx = 0;
    for (const p of state.particles) {
      if (!p.active || partIdx >= maxParticles) continue;
      const mesh = this.particleMeshes[partIdx++];
      mesh.visible = true;
      const alpha = Math.max(0.05, p.life / p.maxLife);
      mesh.position.copy(this.worldTo3D(p.x, p.y, 14));
      mesh.rotation.x += 0.12;
      mesh.rotation.y += 0.15;
      mesh.scale.setScalar((p.size / 3) * alpha + 0.3);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(p.color);
      mat.opacity = alpha;
    }
    for (let i = partIdx; i < MAX_3D_PARTICLES; i++) {
      this.particleMeshes[i].visible = false;
    }

    this.renderer.render(this.scene, this.camera);
    targetCtx.drawImage(this.renderer.domElement, 0, 0, this.width, this.height);
    return true;
  }

  public dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.available = false;
  }
}
