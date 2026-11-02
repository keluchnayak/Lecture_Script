import React from 'react';
import {
  CloudRain,
  Bird,
  Droplets,
  Wind,
  Flame,
  Moon,
  Coffee,
  Radio,
  Music,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { AmbientSound } from '../../data/soundscapePresets';
import { SoundVolumeSlider } from './SoundVolumeSlider';

interface SoundCardProps {
  sound: AmbientSound;
  volume: number; // 0 to 1
  isPlaying: boolean;
  onToggle: () => void;
  onVolumeChange: (vol: number) => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  CloudRain,
  Bird,
  Droplets,
  Wind,
  Flame,
  Moon,
  Coffee,
  Radio,
  Music,
};

export const SoundCard: React.FC<SoundCardProps> = ({
  sound,
  volume,
  isPlaying,
  onToggle,
  onVolumeChange,
}) => {
  const IconComponent = ICON_MAP[sound.icon] || Music;
  const isActive = volume > 0;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
        isActive
          ? 'bg-white shadow-md border-violet-400 ring-2 ring-violet-200/60'
          : 'bg-white/65 hover:bg-white border-violet-100 hover:border-violet-200'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <button
            type="button"
            onClick={onToggle}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isActive
                ? 'bg-violet-600 text-white shadow-sm scale-105'
                : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            }`}
            title={isActive ? 'Turn off sound' : 'Turn on sound'}
          >
            <IconComponent className="w-4 h-4" />
          </button>

          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              background: sound.license.includes('CC0') || sound.license.includes('Public Domain')
                ? 'rgba(236, 253, 245, 0.9)'
                : 'rgba(243, 232, 255, 0.9)',
              color: sound.license.includes('CC0') || sound.license.includes('Public Domain')
                ? '#065F46'
                : '#6B21A8',
              borderColor: sound.license.includes('CC0') || sound.license.includes('Public Domain')
                ? '#A7F3D0'
                : '#E9D5FF',
            }}
            title={`Licensed under ${sound.license} by ${sound.author}`}
          >
            {sound.license}
          </span>
        </div>

        <h4 className="font-bold text-xs sm:text-sm text-[#242238] tracking-tight">
          {sound.name}
        </h4>

        <p className="text-[10.5px] text-[#6B6888] mt-0.5 truncate" title={`By ${sound.author}`}>
          By {sound.author} {sound.editor ? `• Edit: ${sound.editor}` : ''}
        </p>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-violet-100/70">
        {isActive ? (
          <div className="space-y-1">
            <SoundVolumeSlider
              value={volume}
              onChange={onVolumeChange}
              size="sm"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="w-full py-1 text-center text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors cursor-pointer"
          >
            + Add to Mix
          </button>
        )}
      </div>
    </div>
  );
};
