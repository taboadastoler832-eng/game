/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AudioStats } from './types';

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private isMuted = false;
  
  // Timing variables
  private bpm = 125;
  private beatDuration = 60 / 125; // 0.48s
  private nextNoteTime = 0;
  private scheduleAheadTime = 0.1; // 100ms
  private lookahead = 25.0; // 25ms timer interval
  private timerId: number | null = null;
  
  // Music state
  private beatCounter = 0;
  private currentChordIndex = 0;
  private progression = [
    [57, 60, 64], // Am (A3, C4, E4)
    [53, 57, 60], // F (F3, A3, C4)
    [48, 52, 55], // C (C3, E3, G3)
    [55, 59, 62], // G (G3, B3, D4)
  ];
  private chordNames = ['Am', 'F', 'C', 'G'];
  
  // Stats updated live
  private audioStats: AudioStats = {
    bpm: 125,
    beatIndex: 0,
    isBeatKick: false,
    isBeatSnare: false,
    currentFreqAmplitude: 0.1,
    chordName: 'Am'
  };

  // Boss phase multiplier
  private phase = 1;

  constructor() {
    this.audioStats.bpm = this.bpm;
  }

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isInitialized = true;
      this.resume();
    } catch (e) {
      console.warn('Web Audio API not supported in this browser', e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.startSequencer();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public setBossPhase(phase: number) {
    this.phase = phase;
    // Increase intensity
    if (phase === 1) {
      this.bpm = 125;
    } else if (phase === 2) {
      this.bpm = 135;
    } else {
      this.bpm = 150;
    }
    this.beatDuration = 60 / this.bpm;
    this.audioStats.bpm = this.bpm;
  }

  public getStats(): AudioStats {
    // Smoothly decay peak-indicator for visual beats
    this.audioStats.isBeatKick = false;
    this.audioStats.isBeatSnare = false;
    this.audioStats.currentFreqAmplitude *= 0.92; // smooth decay
    return this.audioStats;
  }

  private startSequencer() {
    if (!this.ctx) return;
    if (this.timerId) return;
    
    this.nextNoteTime = this.ctx.currentTime;
    const run = () => {
      this.scheduler();
      this.timerId = window.setTimeout(run, this.lookahead);
    };
    run();
  }

  public stopSequencer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduler() {
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.schedulePattern(this.beatCounter, this.nextNoteTime);
      this.nextNoteTime += this.beatDuration / 4; // 16th notes resolution!
      this.beatCounter = (this.beatCounter + 1) % 16;
    }
  }

  private mtof(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private schedulePattern(step: number, time: number) {
    if (this.isMuted || !this.ctx) return;

    const bar = Math.floor(step / 4); // 0, 1, 2, 3 beats
    const isMainBeat = (step % 4) === 0; // Quarter notes
    const isSnareBeat = (step % 8) === 4; // Snare on 2 and 4 of 4/4 beats (8th-level steps)

    // Manage Chord Progressions every 16 steps (once per bar)
    if (step === 0) {
      this.currentChordIndex = (this.currentChordIndex + 1) % this.progression.length;
      this.audioStats.chordName = this.chordNames[this.currentChordIndex];
    }

    const currentChord = this.progression[this.currentChordIndex];

    // Play Kick Drum
    if (isMainBeat) {
      this.playKickProcedural(time);
      this.audioStats.isBeatKick = true;
      this.audioStats.beatIndex = bar;
      this.audioStats.currentFreqAmplitude = 1.0;
    }

    // Play Snare
    if (isSnareBeat) {
      this.playSnareProcedural(time);
      this.audioStats.isBeatSnare = true;
      this.audioStats.currentFreqAmplitude = 0.9;
    }

    // Hi-hats on off-beat 16th notes
    if (step % 2 === 1 && Math.random() > 0.3) {
      this.playHiHatProcedural(time);
    }

    // Synth Bass Arpeggiator (driving 8th notes pattern)
    if (step % 2 === 0) {
      const bassRoots = [currentChord[0] - 24, currentChord[0] - 12, currentChord[1] - 24, currentChord[2] - 12];
      const bassNote = bassRoots[Math.floor(step / 2) % bassRoots.length];
      this.playBasslineProcedural(bassNote, time);
    }

    // Synth Chord Pad or Arpeggiator Lead
    // Increases intensity as boss phases change
    if (this.phase === 1) {
      // Atmospheric pads periodically
      if (step === 0 || step === 8) {
        currentChord.forEach((note, index) => {
          this.playLeadPadProcedural(note + 12, time, 1.2, 0.05);
        });
      }
    } else if (this.phase === 2) {
      // Faster syncopated arpeggios
      if (step % 4 === 2 || step % 4 === 0) {
        const leadNoteIndex = (step) % currentChord.length;
        this.playLeadPadProcedural(currentChord[leadNoteIndex] + 12, time, 0.25, 0.08);
      }
    } else {
      // Intense Phase 3 solo arps
      if (step % 2 === 0) {
        const arpPattern = [0, 1, 2, 1, 2, 0, 1, 2];
        const leadNoteIndex = arpPattern[(step) % arpPattern.length];
        this.playLeadPadProcedural(currentChord[leadNoteIndex] + 24, time, 0.15, 0.09, true);
      }
    }
  }

  // SOUND ENGINES
  private playKickProcedural(time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';

    // Bass frequency sweep: high drop to low
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.18);

    // Dynamic volume shape
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSnareProcedural(time: number) {
    if (!this.ctx) return;
    try {
      // White noise buffer for snare snap
      const bufferSize = this.ctx.sampleRate * 0.15; // 0.15s
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // Add a small mid-frequency snap
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      oscGain.gain.setValueAtTime(0.2, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noiseNode.start(time);
      noiseNode.stop(time + 0.16);

      osc.start(time);
      osc.stop(time + 0.08);
    } catch (e) {
      // Fallback if buffer creation fails
    }
  }

  private playHiHatProcedural(time: number) {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.04; // Very short
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7500;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start(time);
      noiseNode.stop(time + 0.05);
    } catch {}
  }

  private playBasslineProcedural(note: number, time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.mtof(note), time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, time);
    filter.frequency.exponentialRampToValueAtTime(450, time + 0.1);

    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playLeadPadProcedural(note: number, time: number, duration: number, volume: number, highResonance = false) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = highResonance ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(this.mtof(note), time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(highResonance ? 1800 : 900, time);
    filter.Q.value = highResonance ? 8 : 1;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.03); // tiny fade-in
    gain.gain.setValueAtTime(volume, time + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // --- INTERACTIVE SFX ENGINES ---
  public playShoot() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.07);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 400;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {}
  }

  public playLaser() {
    if (this.isMuted || !this.ctx) return;
    // Rhythmic laser buzzing sound (throttled inside App/Game loop)
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = 50 + Math.random() * 10;
      
      const tremolo = this.ctx.createOscillator();
      const tremoloGain = this.ctx.createGain();
      tremolo.frequency.value = 35; // fast pulse
      tremoloGain.gain.value = 10;

      tremolo.connect(tremoloGain);
      tremoloGain.connect(osc.frequency);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      tremolo.start();
      osc.start();
      
      tremolo.stop(this.ctx.currentTime + 0.07);
      osc.stop(this.ctx.currentTime + 0.07);
    } catch {}
  }

  public playMissile() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.17);
    } catch {}
  }

  public playWaveSlash() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.12);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.13);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.14);
    } catch {}
  }

  public playGraze() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(2200, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch {}
  }

  public playBossHurt() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    } catch {}
  }

  public playPlayerHurt() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + 0.3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }

  public playBomb() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const rumble = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.8);

      rumble.type = 'sine';
      rumble.frequency.setValueAtTime(30, this.ctx.currentTime);
      rumble.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 1.2);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;

      osc.connect(filter);
      rumble.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.start();
      rumble.start();
      osc.stop(this.ctx.currentTime + 1.3);
      rumble.stop(this.ctx.currentTime + 1.3);
    } catch {}
  }

  public playPhaseTransition() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.6);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.7);
    } catch {}
  }

  public playDefeat() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.6);
    } catch {}
  }

  public playVictory() {
    if (this.isMuted || !this.ctx) return;
    try {
      const time = this.ctx.currentTime;
      // Synthesize a victory melody chord progression
      const notes = [60, 64, 67, 72, 76, 79]; // C major notes ascending fast
      notes.forEach((note, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.mtof(note), time + i * 0.12);
        gain.gain.setValueAtTime(0.001, time + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.12, time + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + i * 0.12 + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(time + i * 0.12);
        osc.stop(time + i * 0.12 + 0.9);
      });
    } catch {}
  }
}

export const MusicAudio = new ProceduralAudioEngine();
