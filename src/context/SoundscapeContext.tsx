import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { soundEngine } from '../utils/soundEngine';
import { QUICK_MIX_PRESETS, AMBIENT_SOUNDS, SoundscapePreset } from '../data/soundscapePresets';

interface SoundscapeContextType {
  isPlaying: boolean;
  isMuted: boolean;
  masterVolume: number;
  toneLoopEnabled: boolean;
  toneLoopVolume: number;
  ambientVolumes: Record<string, number>;
  activePreset: string | null;
  isMixerOpen: boolean;
  error: string | null;
  activeSoundsCount: number;

  // Actions
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  togglePlay: () => Promise<void>;
  toggleMute: () => void;
  setMasterVolume: (volume: number) => void;
  setToneLoopEnabled: (enabled: boolean) => void;
  setToneLoopVolume: (volume: number) => void;
  setAmbientVolume: (soundId: string, volume: number) => void;
  toggleAmbient: (soundId: string, defaultVolume?: number) => void;
  activatePreset: (presetId: string, autoPlay?: boolean) => Promise<void>;
  openMixer: () => void;
  closeMixer: () => void;
  toggleMixer: () => void;
  clearMix: () => void;
}

const SoundscapeContext = createContext<SoundscapeContextType | null>(null);

export const SoundscapeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [masterVolume, setMasterVolState] = useState<number>(0.5);
  const [toneLoopEnabled, setToneLoopState] = useState<boolean>(false);
  const [toneLoopVolume, setToneLoopVolState] = useState<number>(0.3);
  const [ambientVolumes, setAmbientVolumes] = useState<Record<string, number>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial master and tone volumes to soundEngine
  useEffect(() => {
    soundEngine.setMasterVolume(0.5);
    soundEngine.setToneLoopVolume(0.3);
    soundEngine.setToneLoopEnabled(false);

    return () => {
      soundEngine.dispose();
    };
  }, []);

  const play = useCallback(async () => {
    setError(null);
    try {
      await soundEngine.play();
      setIsPlaying(true);
    } catch (err: any) {
      console.error('[SoundscapeContext] Playback error:', err);
      setError('Audio was blocked or could not start. Click anywhere to enable sound.');
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    soundEngine.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    soundEngine.stop();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setMasterVolState(clamped);
    soundEngine.setMasterVolume(clamped);
  }, []);

  const setToneLoopEnabled = useCallback((enabled: boolean) => {
    setToneLoopState(enabled);
    soundEngine.setToneLoopEnabled(enabled);
    setActivePreset(null);
  }, []);

  const setToneLoopVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setToneLoopVolState(clamped);
    soundEngine.setToneLoopVolume(clamped);
  }, []);

  const setAmbientVolume = useCallback((soundId: string, vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setAmbientVolumes((prev) => ({
      ...prev,
      [soundId]: clamped,
    }));
    soundEngine.setAmbientSoundVolume(soundId, clamped);
    setActivePreset(null);
  }, []);

  const toggleAmbient = useCallback((soundId: string, defaultVolume = 0.25) => {
    setAmbientVolumes((prev) => {
      const current = prev[soundId] ?? 0;
      const nextVol = current > 0 ? 0 : defaultVolume;
      soundEngine.setAmbientSoundVolume(soundId, nextVol);
      return {
        ...prev,
        [soundId]: nextVol,
      };
    });
    setActivePreset(null);
  }, []);

  /**
   * Activates a predefined quick mix preset (e.g. 'night-lofi').
   */
  const activatePreset = useCallback(async (presetId: string, autoPlay = true) => {
    setError(null);
    const preset = QUICK_MIX_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setActivePreset(preset.id);

    // Stop current active ambients that are not in the new preset
    AMBIENT_SOUNDS.forEach((sound) => {
      const targetVol = preset.ambientVolumes[sound.id] ?? 0;
      soundEngine.setAmbientSoundVolume(sound.id, targetVol);
    });

    // Update ambient volumes state
    setAmbientVolumes(preset.ambientVolumes);

    // Apply tone loop settings
    setToneLoopState(preset.toneLoop);
    soundEngine.setToneLoopEnabled(preset.toneLoop);

    setToneLoopVolState(preset.toneLoopVolume);
    soundEngine.setToneLoopVolume(preset.toneLoopVolume);

    // Apply master volume
    setMasterVolState(preset.masterVolume);
    soundEngine.setMasterVolume(preset.masterVolume);

    if (autoPlay) {
      try {
        await soundEngine.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.error('[SoundscapeContext] AutoPlay error:', err);
        setError('Click Play to allow audio in your browser.');
      }
    }
  }, []);

  const openMixer = useCallback(() => {
    setIsMixerOpen(true);
  }, []);

  const closeMixer = useCallback(() => {
    setIsMixerOpen(false);
  }, []);

  const toggleMixer = useCallback(() => {
    setIsMixerOpen((prev) => !prev);
  }, []);

  const clearMix = useCallback(() => {
    setToneLoopState(false);
    soundEngine.setToneLoopEnabled(false);

    AMBIENT_SOUNDS.forEach((sound) => {
      soundEngine.setAmbientSoundVolume(sound.id, 0);
    });
    setAmbientVolumes({});
    setActivePreset(null);
    soundEngine.stop();
    setIsPlaying(false);
  }, []);

  // Compute number of active sound channels
  const activeSoundsCount = (toneLoopEnabled ? 1 : 0) +
    Object.values(ambientVolumes).filter((v) => v > 0).length;

  return (
    <SoundscapeContext.Provider
      value={{
        isPlaying,
        isMuted,
        masterVolume,
        toneLoopEnabled,
        toneLoopVolume,
        ambientVolumes,
        activePreset,
        isMixerOpen,
        error,
        activeSoundsCount,
        play,
        pause,
        stop,
        togglePlay,
        toggleMute,
        setMasterVolume,
        setToneLoopEnabled,
        setToneLoopVolume,
        setAmbientVolume,
        toggleAmbient,
        activatePreset,
        openMixer,
        closeMixer,
        toggleMixer,
        clearMix,
      }}
    >
      {children}
    </SoundscapeContext.Provider>
  );
};

export const useSoundscape = (): SoundscapeContextType => {
  const context = useContext(SoundscapeContext);
  if (!context) {
    throw new Error('useSoundscape must be used within a SoundscapeProvider');
  }
  return context;
};
