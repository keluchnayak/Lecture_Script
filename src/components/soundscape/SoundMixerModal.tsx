import React, { useState } from 'react';
import {
  X,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Music2,
  Sliders,
  Trash2,
  Check,
  Disc3,
  Flame,
  Info,
} from 'lucide-react';
import { useSoundscape } from '../../context/SoundscapeContext';
import { AMBIENT_SOUNDS, QUICK_MIX_PRESETS } from '../../data/soundscapePresets';
import { SoundCard } from './SoundCard';
import { SoundVolumeSlider } from './SoundVolumeSlider';

export const SoundMixerModal: React.FC = () => {
  const {
    isMixerOpen,
    closeMixer,
    isPlaying,
    isMuted,
    masterVolume,
    toneLoopEnabled,
    toneLoopVolume,
    ambientVolumes,
    activePreset,
    activeSoundsCount,
    error,
    togglePlay,
    stop,
    toggleMute,
    setMasterVolume,
    setToneLoopEnabled,
    setToneLoopVolume,
    setAmbientVolume,
    toggleAmbient,
    activatePreset,
    clearMix,
  } = useSoundscape();

  const [activeTab, setActiveTab] = useState<'sounds' | 'presets'>('sounds');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'nature' | 'environment' | 'focus'>('all');

  if (!isMixerOpen) return null;

  const filteredSounds = selectedCategory === 'all'
    ? AMBIENT_SOUNDS
    : AMBIENT_SOUNDS.filter((s) => s.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#242238]/50 backdrop-blur-md animate-fade-in"
      onClick={closeMixer}
    >
      <div
        className="glass-panel w-full max-w-2xl max-h-[90vh] rounded-3xl border border-violet-200/90 shadow-2xl flex flex-col overflow-hidden text-[#242238]"
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 60px -12px rgba(116, 86, 232, 0.25), 0 4px 16px rgba(36, 34, 56, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-[#242238]">
                  Sounds &amp; Music
                </h3>
                {isPlaying && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Playing
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B6888]">
                Synthesized 48 BPM tone loop &amp; open-source ambient soundscapes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                isPlaying
                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'btn-primary'
              }`}
              title={isPlaying ? 'Pause playback' : 'Start playback'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={closeMixer}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close modal (audio continues playing)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Error Banner if Autoplay is blocked */}
        {error && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Tabs (Sounds vs Playlists) ── */}
        <div className="px-6 pt-3 pb-2 border-b border-violet-100/70 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-violet-100/70 p-1 rounded-2xl border border-violet-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('sounds')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sounds'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-[#6B6888] hover:text-[#242238]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Sounds Library</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-[#6B6888] hover:text-[#242238]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Mixes</span>
              {activePreset === 'night-lofi' && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
              )}
            </button>
          </div>

          {activeTab === 'sounds' && (
            <div className="hidden sm:flex items-center gap-1 text-[11px]">
              {(['all', 'nature', 'environment', 'focus'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-semibold capitalize cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-violet-100 text-violet-800 font-bold'
                      : 'text-[#6B6888] hover:text-[#242238]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Modal Body Content ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'sounds' ? (
            <>
              {/* 1. Core Synthesized 48 BPM Tone Loop Card */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  toneLoopEnabled
                    ? 'bg-gradient-to-r from-violet-50/90 to-indigo-50/90 border-violet-400 ring-2 ring-violet-200 shadow-sm'
                    : 'bg-white/70 border-violet-100 hover:border-violet-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        toneLoopEnabled
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      <Music2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-[#242238]">
                          Synthesized Tone Loop (48 BPM)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                          Tone.js
                        </span>
                      </div>
                      <p className="text-xs text-[#6B6888] mt-0.5">
                        Gentle, warm chord progression designed for deep study focus (no drums or vocals).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setToneLoopEnabled(!toneLoopEnabled)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      toneLoopEnabled
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    }`}
                  >
                    {toneLoopEnabled ? 'Active' : '+ Add Tone Loop'}
                  </button>
                </div>

                {toneLoopEnabled && (
                  <div className="mt-3 pt-3 border-t border-violet-200/60">
                    <SoundVolumeSlider
                      label="Tone Volume"
                      value={toneLoopVolume}
                      onChange={setToneLoopVolume}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* 2. Ambient Sounds Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B6888]">
                    Ambient Audio Tracks (Open Source &amp; Verified)
                  </h4>
                  <span className="text-[11px] text-[#6B6888]">
                    {filteredSounds.length} sounds
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredSounds.map((sound) => (
                    <SoundCard
                      key={sound.id}
                      sound={sound}
                      volume={ambientVolumes[sound.id] ?? 0}
                      isPlaying={isPlaying}
                      onToggle={() => toggleAmbient(sound.id)}
                      onVolumeChange={(vol) => setAmbientVolume(sound.id, vol)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ── PRESETS TAB ── */
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B6888] mb-1">
                  Curated Quick Mixes
                </h4>
                <p className="text-xs text-[#6B6888]">
                  One-click study presets optimized for flow state and calm productivity.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {QUICK_MIX_PRESETS.map((preset) => {
                  const isCurrentActive = activePreset === preset.id;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => activatePreset(preset.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between gap-4 ${
                        isCurrentActive
                          ? 'bg-gradient-to-r from-violet-50 to-indigo-50/70 border-violet-400 ring-2 ring-violet-200/70 shadow-md'
                          : 'bg-white hover:bg-violet-50/40 border-violet-100 hover:border-violet-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-[#242238] group-hover:text-violet-700 transition-colors">
                            {preset.name}
                          </h4>
                          {preset.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              {preset.badge}
                            </span>
                          )}
                          {isCurrentActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white shadow-xs">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-medium text-violet-700">
                          {preset.tagline}
                        </p>

                        <p className="text-xs text-[#6B6888] leading-relaxed max-w-md">
                          {preset.description}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isCurrentActive && isPlaying
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white'
                          }`}
                        >
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Active Mix / Now Playing Bottom Bar ── */}
        <div
          className="p-4 sm:p-5 border-t border-violet-100 bg-[#FAF9FF] space-y-3.5 select-none"
        >
          {/* Active Sound Chips */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap flex-1 overflow-hidden">
              <span className="text-[11px] font-bold text-[#6B6888] uppercase tracking-wider mr-1">
                Active Mix:
              </span>

              {activeSoundsCount === 0 ? (
                <span className="text-xs text-[#6B6888] italic">
                  No sounds active. Click "+ Add to Mix" or select a Quick Mix.
                </span>
              ) : (
                <>
                  {toneLoopEnabled && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
                      <span>Tone 48BPM</span>
                      <button
                        type="button"
                        onClick={() => setToneLoopEnabled(false)}
                        className="hover:text-red-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {Object.entries(ambientVolumes)
                    .filter(([_, vol]) => vol > 0)
                    .map(([id]) => {
                      const sound = AMBIENT_SOUNDS.find((s) => s.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-[#242238] border border-violet-200 shadow-xs"
                        >
                          <span>{sound?.name || id}</span>
                          <button
                            type="button"
                            onClick={() => toggleAmbient(id)}
                            className="text-[#6B6888] hover:text-red-600 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                </>
              )}
            </div>

            {activeSoundsCount > 0 && (
              <button
                type="button"
                onClick={clearMix}
                className="text-[11px] font-semibold text-[#6B6888] hover:text-red-600 transition-colors cursor-pointer shrink-0"
              >
                Clear Mix
              </button>
            )}
          </div>

          {/* Master Volume & Playback Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="w-full sm:w-72">
              <SoundVolumeSlider
                label="Master"
                value={isMuted ? 0 : masterVolume}
                onChange={setMasterVolume}
                size="md"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={toggleMute}
                className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-white text-[#6B6888] hover:text-[#242238] border-violet-200'
                }`}
                title={isMuted ? 'Unmute master' : 'Mute master'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={stop}
                className="p-2 rounded-xl text-xs font-semibold bg-white text-[#6B6888] hover:text-rose-600 border border-violet-200 transition-all cursor-pointer"
                title="Stop playback"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  isPlaying
                    ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    : 'btn-primary'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>Play Mix</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
