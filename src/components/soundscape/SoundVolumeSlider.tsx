import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface SoundVolumeSliderProps {
  value: number; // 0 to 1
  onChange: (val: number) => void;
  label?: string;
  size?: 'sm' | 'md';
  showPercentage?: boolean;
}

export const SoundVolumeSlider: React.FC<SoundVolumeSliderProps> = ({
  value,
  onChange,
  label,
  size = 'md',
  showPercentage = true,
}) => {
  const percent = Math.round(value * 100);

  return (
    <div className="flex items-center gap-2.5 w-full select-none">
      {label && (
        <span className="text-xs font-semibold text-[#242238] min-w-16 truncate">
          {label}
        </span>
      )}

      <button
        type="button"
        onClick={() => onChange(value > 0 ? 0 : 0.3)}
        className="text-[#6B6888] hover:text-violet-700 transition-colors cursor-pointer shrink-0"
        title={value > 0 ? 'Mute' : 'Unmute'}
      >
        {value > 0 ? (
          <Volume2 className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        ) : (
          <VolumeX className={size === 'sm' ? 'w-3.5 h-3.5 text-gray-400' : 'w-4 h-4 text-gray-400'} />
        )}
      </button>

      <div className="relative flex-1 flex items-center">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-violet-100 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
          style={{
            background: `linear-gradient(to right, #7456E8 0%, #7456E8 ${percent}%, #E8E3FF ${percent}%, #E8E3FF 100%)`,
          }}
          aria-label={label || 'Volume'}
        />
      </div>

      {showPercentage && (
        <span className="text-[11px] font-mono font-medium text-[#6B6888] w-8 text-right shrink-0">
          {percent}%
        </span>
      )}
    </div>
  );
};
