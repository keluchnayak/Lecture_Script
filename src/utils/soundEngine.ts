import * as Tone from 'tone';
import { AMBIENT_SOUNDS } from '../data/soundscapePresets';

function linearToDb(gain: number): number {
  if (gain <= 0.0001) return -Infinity;
  return 20 * Math.log10(gain);
}

class SoundEngine {
  private static instance: SoundEngine;
  private isInitialized = false;

  // Tone.js nodes
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;
  private toneVolumeNode: Tone.Volume | null = null;
  private masterToneGain: Tone.Gain | null = null;
  private transportEventId: number | null = null;

  // Ambient sound HTML5 Audio elements
  private ambientAudioMap: Map<string, HTMLAudioElement> = new Map();

  // Engine state values
  private masterVolume = 0.5;
  private toneVolume = 0.3;
  private isMuted = false;
  private isToneLoopRunning = false;
  private isEnginePlaying = false;
  private ambientVolumes: Map<string, number> = new Map();

  private constructor() {
    // Singleton
  }

  public static getInstance(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  /**
   * Initializes the Tone.js audio graph.
   * Safe to call repeatedly; initializes only once.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      if (Tone.context.state !== 'running') {
        try {
          await Tone.start();
        } catch {}
      }
      return;
    }

    try {
      await Tone.start();
    } catch {
      // AudioContext may be locked until user interaction
    }

    // Master Tone volume node connected to Destination
    this.masterToneGain = new Tone.Gain(this.isMuted ? 0 : this.masterVolume).toDestination();

    // Soft lowpass filter to produce warm, tranquil study chords
    this.filter = new Tone.Filter({
      frequency: 650,
      type: 'lowpass',
      rolloff: -24,
    });

    // Dedicated gain node for the synthesized chord loop
    this.toneVolumeNode = new Tone.Volume(
      linearToDb(this.isMuted ? 0 : this.toneVolume)
    );

    // Warm, gentle PolySynth
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.9,
        decay: 1.8,
        sustain: 0.65,
        release: 2.8,
      },
    });

    // Chain: Synth -> Filter -> ToneVolume -> MasterToneGain -> Destination
    this.synth.chain(this.filter, this.toneVolumeNode, this.masterToneGain);

    // Set gentle, meditative tempo (48 BPM)
    Tone.getTransport().bpm.value = 48;
    Tone.getTransport().timeSignature = 4;

    // Repeating 4-bar peaceful progression (Dm9 -> G13 -> Cmaj9 -> Am9)
    const chords = [
      { time: '0:0', notes: ['D3', 'F3', 'A3', 'C4', 'E4'], duration: '1m' },
      { time: '1:0', notes: ['G2', 'F3', 'B3', 'E4'], duration: '1m' },
      { time: '2:0', notes: ['C3', 'E3', 'G3', 'B3', 'D4'], duration: '1m' },
      { time: '3:0', notes: ['A2', 'E3', 'G3', 'C4'], duration: '1m' },
    ];

    const part = new Tone.Part((time, value) => {
      if (this.synth && this.isToneLoopRunning) {
        this.synth.triggerAttackRelease(value.notes, value.duration, time, 0.45);
      }
    }, chords);

    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = '4m';
    part.start(0);

    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = '4m';

    this.isInitialized = true;
  }

  /**
   * Starts or resumes playback of both active tone loop and ambient tracks.
   */
  public async play(): Promise<void> {
    await this.init();

    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }

    this.isEnginePlaying = true;

    // Start tone loop if enabled
    if (this.isToneLoopRunning) {
      if (Tone.getTransport().state !== 'started') {
        Tone.getTransport().start();
      }
    }

    // Play active ambient sounds
    this.ambientAudioMap.forEach((audio, soundId) => {
      const vol = this.ambientVolumes.get(soundId) ?? 0;
      if (vol > 0) {
        audio.volume = this.calculateEffectiveVolume(vol);
        audio.play().catch((err) => {
          console.warn(`[SoundEngine] Could not play ambient track ${soundId}:`, err);
        });
      }
    });
  }

  /**
   * Pauses all audio without resetting positions.
   */
  public pause(): void {
    this.isEnginePlaying = false;

    if (Tone.getTransport().state === 'started') {
      Tone.getTransport().pause();
    }

    if (this.synth) {
      this.synth.releaseAll();
    }

    this.ambientAudioMap.forEach((audio) => {
      audio.pause();
    });
  }

  /**
   * Stops all audio and rewinds transport and ambient tracks.
   */
  public stop(): void {
    this.isEnginePlaying = false;

    if (Tone.getTransport().state !== 'stopped') {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
    }

    if (this.synth) {
      this.synth.releaseAll();
    }

    this.ambientAudioMap.forEach((audio) => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {}
    });
  }

  /**
   * Enables or disables the 48 BPM synthesized tone loop.
   */
  public setToneLoopEnabled(enabled: boolean): void {
    this.isToneLoopRunning = enabled;

    if (enabled) {
      if (this.isEnginePlaying && Tone.getTransport().state !== 'started') {
        Tone.getTransport().start();
      }
    } else {
      if (this.synth) {
        this.synth.releaseAll();
      }
      if (Tone.getTransport().state === 'started') {
        Tone.getTransport().stop();
      }
    }
  }

  /**
   * Sets the volume for the synthesized tone loop (0 to 1).
   */
  public setToneLoopVolume(volume: number): void {
    this.toneVolume = Math.max(0, Math.min(1, volume));
    if (this.toneVolumeNode) {
      const effectiveDb = this.isMuted
        ? -Infinity
        : linearToDb(this.toneVolume);
      this.toneVolumeNode.volume.rampTo(effectiveDb, 0.1);
    }
  }

  /**
   * Sets master volume across all audio sources (0 to 1).
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));

    if (this.masterToneGain) {
      const eff = this.isMuted ? 0 : this.masterVolume;
      this.masterToneGain.gain.rampTo(eff, 0.1);
    }

    // Update all ambient audio element volumes
    this.ambientAudioMap.forEach((audio, soundId) => {
      const soundVol = this.ambientVolumes.get(soundId) ?? 0;
      audio.volume = this.calculateEffectiveVolume(soundVol);
    });
  }

  /**
   * Toggles mute on/off while preserving user volume settings.
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;

    if (this.masterToneGain) {
      const eff = muted ? 0 : this.masterVolume;
      this.masterToneGain.gain.rampTo(eff, 0.1);
    }

    this.ambientAudioMap.forEach((audio, soundId) => {
      const soundVol = this.ambientVolumes.get(soundId) ?? 0;
      audio.volume = this.calculateEffectiveVolume(soundVol);
    });
  }

  /**
   * Sets the individual volume of a specific ambient sound track.
   */
  public setAmbientSoundVolume(soundId: string, volume: number): void {
    const clampedVol = Math.max(0, Math.min(1, volume));
    this.ambientVolumes.set(soundId, clampedVol);

    let audio = this.ambientAudioMap.get(soundId);

    // If volume > 0 and audio element doesn't exist yet, lazily create it on demand
    if (clampedVol > 0 && !audio) {
      audio = this.createAmbientAudioElement(soundId);
    }

    if (audio) {
      audio.volume = this.calculateEffectiveVolume(clampedVol);

      if (clampedVol > 0 && this.isEnginePlaying) {
        if (audio.paused) {
          audio.play().catch((err) => {
            console.warn(`[SoundEngine] Failed to play ${soundId}:`, err);
          });
        }
      } else if (clampedVol === 0) {
        audio.pause();
      }
    }
  }

  /**
   * Toggles an ambient sound on or off.
   */
  public toggleAmbientSound(soundId: string, defaultVolume = 0.25): boolean {
    const current = this.ambientVolumes.get(soundId) ?? 0;
    const newVol = current > 0 ? 0 : defaultVolume;
    this.setAmbientSoundVolume(soundId, newVol);
    return newVol > 0;
  }

  /**
   * Helper to lazily create and configure an HTMLAudioElement.
   */
  private createAmbientAudioElement(soundId: string): HTMLAudioElement | undefined {
    const meta = AMBIENT_SOUNDS.find((s) => s.id === soundId);
    if (!meta) return undefined;

    const audio = new Audio();
    audio.src = meta.url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    this.ambientAudioMap.set(soundId, audio);
    return audio;
  }

  /**
   * Computes the final output volume: Individual Volume × Master Volume.
   */
  private calculateEffectiveVolume(individualVolume: number): number {
    if (this.isMuted) return 0;
    return Math.max(0, Math.min(1, individualVolume * this.masterVolume));
  }

  /**
   * Cleanly disposes of all audio nodes, tracks, and listeners.
   */
  public dispose(): void {
    this.stop();

    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }

    if (this.filter) {
      this.filter.dispose();
      this.filter = null;
    }

    if (this.toneVolumeNode) {
      this.toneVolumeNode.dispose();
      this.toneVolumeNode = null;
    }

    if (this.masterToneGain) {
      this.masterToneGain.dispose();
      this.masterToneGain = null;
    }

    this.ambientAudioMap.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.ambientAudioMap.clear();
    this.isInitialized = false;
  }
}

export const soundEngine = SoundEngine.getInstance();
