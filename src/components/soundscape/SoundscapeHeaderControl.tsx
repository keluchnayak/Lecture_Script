import React from 'react';
import { Headphones, Volume2, Sparkles } from 'lucide-react';
import { useSoundscape } from '../../context/SoundscapeContext';

export const SoundscapeHeaderControl: React.FC = () => {
  const { isPlaying, activeSoundsCount, openMixer, activePreset } = useSoundscape();

  return (
    <button
      type="button"
      onClick={openMixer}
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
        isPlaying
          ? 'bg-violet-50/90 text-violet-700 border-violet-300 ring-2 ring-violet-200/50 shadow-sm'
          : 'bg-white/70 text-[#6B6888] hover:text-[#242238] hover:bg-white border-violet-200/80'
      }`}
      title="Sounds & Music — Synthesized 48 BPM Tone Loop & Ambient Sounds"
      aria-label="Open Sounds & Music Mixer"
    >
      {/* Equalizer Wave Bars or Headphones Icon */}
      {isPlaying ? (
        <div className="flex items-end gap-0.5 h-3.5 w-3.5 justify-center py-0.5">
          <span
            className="w-0.5 bg-violet-600 rounded-full animate-bounce"
            style={{ animationDuration: '0.8s', height: '100%' }}
          />
          <span
            className="w-0.5 bg-violet-600 rounded-full animate-bounce"
            style={{ animationDuration: '0.5s', height: '60%' }}
          />
          <span
            className="w-0.5 bg-violet-600 rounded-full animate-bounce"
            style={{ animationDuration: '0.9s', height: '80%' }}
          />
        </div>
      ) : (
        <Headphones className="w-3.5 h-3.5 text-violet-500 group-hover:text-violet-700 transition-colors" />
      )}

      <span className="hidden sm:inline">
        {isPlaying ? (activePreset ? 'Night Lo-Fi' : 'Soundscape Playing') : 'Sounds & Music'}
      </span>

      {/* Active sounds badge */}
      {activeSoundsCount > 0 && (
        <span
          className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
          style={{
            background: isPlaying ? '#7456E8' : '#DCD4FF',
            color: isPlaying ? '#FFFFFF' : '#5E40D4',
          }}
        >
          {activeSoundsCount}
        </span>
      )}
    </button>
  );
};
