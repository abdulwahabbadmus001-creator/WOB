import type { TacticalPingKind, WeaponType } from './types';

export type MusicIntensity = 'title' | 'skirmish' | 'boss' | 'fusion';

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;
  private lastLaserTime = 0;
  private lastHitTime = 0;
  private lastGrazeTime = 0;
  private pickupCombo = 0;
  private lastPickupTime = 0;

  // Adaptive Procedural Synthwave Music Sequencer
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicIntensity: MusicIntensity = 'title';
  private musicPlaying = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
    if (this.muted) {
      this.stopMusic();
    } else if (this.unlocked) {
      this.startMusic();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    this.unlocked = true;
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (!this.musicPlaying) {
      this.startMusic();
    }
  }

  public vibrate(pattern: number | number[]): void {
    if (this.muted || typeof navigator === 'undefined') return;
    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore unsupported devices
    }
  }

  public setMusicIntensity(intensity: MusicIntensity): void {
    this.musicIntensity = intensity;
  }

  public startMusic(): void {
    if (typeof window === 'undefined' || this.muted || this.musicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.musicPlaying = true;
    const scheduleNextStep = () => {
      if (!this.musicPlaying || this.muted) return;
      this.playSynthwaveStep();
      const stepMs =
        this.musicIntensity === 'fusion'
          ? 112
          : this.musicIntensity === 'boss'
            ? 122
            : this.musicIntensity === 'skirmish'
              ? 138
              : 165;
      this.musicTimer = window.setTimeout(scheduleNextStep, stepMs);
    };
    scheduleNextStep();
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playSynthwaveStep(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const step = this.musicStep % 16;
    this.musicStep = (this.musicStep + 1) % 64;

    // D minor / F major cyberpunk arpeggio progression across 4 bars
    const bar = Math.floor(this.musicStep / 16) % 4;
    const bassRoots = [73.42, 58.27, 65.41, 82.41]; // D2, Bb1, C2, E2
    const arpScales = [
      [146.83, 174.61, 220.0, 293.66], // Dm
      [116.54, 146.83, 174.61, 233.08], // Bb
      [130.81, 164.81, 196.0, 261.63], // C
      [164.81, 196.0, 246.94, 329.63], // Em/A
    ];

    const rootFreq = bassRoots[bar];
    const arpNotes = arpScales[bar];
    const masterGain =
      this.musicIntensity === 'title'
        ? 0.024
        : this.musicIntensity === 'skirmish'
          ? 0.035
          : 0.046;

    // Driving 16th-note Synthwave Bassline
    if (this.musicIntensity !== 'title' || step % 2 === 0) {
      const bass = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      bass.type = 'sawtooth';
      const octaveMult = step % 4 === 2 ? 2 : 1;
      bass.frequency.setValueAtTime(rootFreq * octaveMult, now);

      filter.type = 'lowpass';
      const cutoff =
        this.musicIntensity === 'fusion'
          ? 920
          : this.musicIntensity === 'boss'
            ? 740
            : 480;
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.11);

      gain.gain.setValueAtTime(masterGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);

      bass.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      bass.start(now);
      bass.stop(now + 0.125);
    }

    // Synth Arpeggio Lead (intensifies during combat, boss, and fusion)
    if (this.musicIntensity !== 'title' || step % 4 === 0) {
      const arpFreq =
        arpNotes[step % arpNotes.length] *
        (this.musicIntensity === 'fusion' && step % 2 === 1 ? 2 : 1);
      const lead = ctx.createOscillator();
      const leadGain = ctx.createGain();
      lead.type =
        this.musicIntensity === 'boss' || this.musicIntensity === 'fusion'
          ? 'square'
          : 'triangle';
      lead.frequency.setValueAtTime(arpFreq, now);

      leadGain.gain.setValueAtTime(masterGain * 0.55, now);
      leadGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.11);

      lead.connect(leadGain);
      leadGain.connect(ctx.destination);
      lead.start(now);
      lead.stop(now + 0.12);
    }

    // Cyber Kick on beats 0, 4, 8, 12 during active combat
    if (this.musicIntensity !== 'title' && step % 4 === 0) {
      const kick = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(125, now);
      kick.frequency.exponentialRampToValueAtTime(34, now + 0.09);

      kickGain.gain.setValueAtTime(masterGain * 1.45, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

      kick.connect(kickGain);
      kickGain.connect(ctx.destination);
      kick.start(now);
      kick.stop(now + 0.1);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || !this.unlocked) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private pitchJitter(base: number, spread = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * spread);
  }

  public playLaser(multishotCount = 1, weapon: WeaponType = 'spread'): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastLaserTime < 0.05) return;
    this.lastLaserTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (weapon === 'plasma') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.pitchJitter(420), now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
      gain.gain.setValueAtTime(0.095, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    if (weapon === 'homing') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.pitchJitter(520), now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.11);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    osc.type = weapon === 'laser' ? 'sawtooth' : 'triangle';
    const startFreq = this.pitchJitter(
      (weapon === 'laser' ? 1040 : 820) + Math.min(multishotCount - 1, 4) * 55,
    );
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playEnemyHit(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastHitTime < 0.04) return;
    this.lastHitTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(this.pitchJitter(320), now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playExplosion(heavy = false): void {
    if (this.muted) return;
    this.vibrate(heavy ? [35, 30, 65] : 18);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = heavy ? 0.34 : 0.16;

    // Noise burst for retro crunch
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(heavy ? 680 : 1100, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.18 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Sub punch
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(heavy ? 130 : 180, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + duration);
    subGain.gain.setValueAtTime(heavy ? 0.14 : 0.07, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + duration);
  }

  public playSubsystemDestroyed(): void {
    if (this.muted) return;
    this.vibrate([25, 20, 45]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [880, 620, 310, 140];
    freqs.forEach((f, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, start + 0.14);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  public playGraze(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastGrazeTime < 0.12) return;
    this.lastGrazeTime = now;

    this.vibrate(10);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.075);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playSquadronLink(docked = false): void {
    if (this.muted) return;
    this.vibrate(docked ? [30, 20, 50] : [20, 15, 25]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = docked ? [440, 554.37, 659.25, 880, 1108.73] : [440, 659.25, 880];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.085, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  public playTacticalPing(kind: TacticalPingKind): void {
    if (this.muted) return;
    this.vibrate(14);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const pattern =
      kind === 'focus_core'
        ? [784, 1046.5]
        : kind === 'link_up'
          ? [659.25, 880]
          : [523.25, 392];
    const now = ctx.currentTime;
    pattern.forEach((freq, idx) => {
      const start = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  public playReviveComplete(): void {
    if (this.muted) return;
    this.vibrate([20, 20, 40]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  public playPickup(comboMultiplier = 1): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastPickupTime < 0.45) {
      this.pickupCombo = Math.min(8, this.pickupCombo + 1);
    } else {
      this.pickupCombo = 0;
    }
    this.lastPickupTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 560 + this.pickupCombo * 35 + Math.max(0, comboMultiplier - 1) * 28;
    osc.frequency.setValueAtTime(this.pitchJitter(base, 0.03), now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.09);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playDash(): void {
    if (this.muted) return;
    this.vibrate(12);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.11);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playTelegraph(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.18);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playPlayerHurt(): void {
    if (this.muted) return;
    this.vibrate([40, 25, 40]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.linearRampToValueAtTime(62, now + 0.22);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playWaveClear(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  public playBossAlert(): void {
    if (this.muted) return;
    this.vibrate([45, 30, 45]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, start);
      osc.frequency.linearRampToValueAtTime(140, start + 0.18);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  public playUpgradeBuy(): void {
    if (this.muted) return;
    this.vibrate(15);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [660, 990];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  public playGameOver(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [392, 349.23, 293.66, 196];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playAchievement(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [587.33, 739.99, 880, 1174.66];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playEmpBlast(): void {
    if (this.muted) return;
    this.vibrate([50, 25, 80]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep sub-bass discharge drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(190, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.65);

    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    sub.connect(filter);
    filter.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.7);

    // High-voltage electromagnetic pulse shimmer
    const zap = ctx.createOscillator();
    const zapGain = ctx.createGain();
    zap.type = 'triangle';
    zap.frequency.setValueAtTime(980, now);
    zap.frequency.exponentialRampToValueAtTime(140, now + 0.32);

    zapGain.gain.setValueAtTime(0.14, now);
    zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    zap.connect(zapGain);
    zapGain.connect(ctx.destination);
    zap.start(now);
    zap.stop(now + 0.36);
  }

  public playShieldActivate(): void {
    if (this.muted) return;
    this.vibrate(20);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playShieldReflect(): void {
    if (this.muted) return;
    this.vibrate(14);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(920, 0.08), now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playPollyAssist(): void {
    if (this.muted) return;
    this.vibrate([18, 12, 24]);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [440, 659.25, 880, 1318.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.19);
    });
  }

  public playChapterVictory(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }
}

export const soundFX = new RetroAudioEngine();
