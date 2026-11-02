export interface AmbientSound {
  id: string;
  name: string;
  category: 'nature' | 'environment' | 'focus';
  icon: string;
  url: string;
  author: string;
  editor?: string;
  license: string;
  sourceUrl: string;
}

export interface SoundscapePreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  toneLoop: boolean;
  toneLoopVolume: number; // 0 to 1
  bpm: number;
  ambientVolumes: Record<string, number>; // soundId -> volume (0 to 1)
  masterVolume: number; // 0 to 1
  badge?: string;
}

// Individually verified open-source ambient sound library (from Blanket & Moodist open projects)
export const AMBIENT_SOUNDS: AmbientSound[] = [
  {
    id: 'rain',
    name: 'Gentle Rain',
    category: 'nature',
    icon: 'CloudRain',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/rain.ogg',
    author: 'alex36917',
    editor: 'Porrumentzio',
    license: 'CC BY 3.0',
    sourceUrl: 'https://freesound.org/people/alex36917/sounds/524605/',
  },
  {
    id: 'birds',
    name: 'Morning Forest Birds',
    category: 'nature',
    icon: 'Bird',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/birds.ogg',
    author: 'kvgarlic',
    editor: 'Porrumentzio',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://freesound.org/people/kvgarlic/sounds/156826/',
  },
  {
    id: 'stream',
    name: 'Mountain Stream',
    category: 'nature',
    icon: 'Droplets',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/stream.ogg',
    author: 'gluckose',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://freesound.org/people/gluckose/sounds/333987/',
  },
  {
    id: 'wind',
    name: 'Calm Breeze',
    category: 'nature',
    icon: 'Wind',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/wind.ogg',
    author: 'felix.blume',
    editor: 'Porrumentzio',
    license: 'CC0 1.0 Universal',
    sourceUrl: 'https://freesound.org/people/felix.blume/sounds/217506/',
  },
  {
    id: 'fireplace',
    name: 'Warm Fireplace',
    category: 'environment',
    icon: 'Flame',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/fireplace.ogg',
    author: 'ezwa',
    license: 'Public Domain',
    sourceUrl: 'https://soundbible.com/1543-Fireplace.html',
  },
  {
    id: 'summer-night',
    name: 'Summer Night Crickets',
    category: 'environment',
    icon: 'Moon',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/summer-night.ogg',
    author: 'Lisa Redfern',
    license: 'Public Domain',
    sourceUrl: 'https://soundbible.com/2083-Crickets-Chirping-At-Night.html',
  },
  {
    id: 'coffee-shop',
    name: 'Quiet Coffee Ambiance',
    category: 'environment',
    icon: 'Coffee',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/coffee-shop.ogg',
    author: 'stephan',
    license: 'Public Domain',
    sourceUrl: 'https://soundbible.com/1664-Restaurant-Ambiance.html',
  },
  {
    id: 'white-noise',
    name: 'Pure White Noise',
    category: 'focus',
    icon: 'Radio',
    url: 'https://raw.githubusercontent.com/rafaelmardojai/blanket/master/data/resources/sounds/white-noise.ogg',
    author: 'Jorge Stolfi',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:White-noise-sound-20sec-mono-44100Hz.ogg',
  },
];

// Predefined Quick Mixes including the mandatory Night Lo-Fi
export const QUICK_MIX_PRESETS: SoundscapePreset[] = [
  {
    id: 'night-lofi',
    name: 'Night Lo-Fi',
    tagline: '48 BPM Tone Loop + Soft Rain',
    description: 'Soft synthesized 48 BPM study progression blended with gentle rain drops for deep nighttime focus.',
    toneLoop: true,
    toneLoopVolume: 0.3,
    bpm: 48,
    ambientVolumes: {
      rain: 0.2,
    },
    masterVolume: 0.5,
    badge: 'Popular for Focus',
  },
  {
    id: 'quiet-library',
    name: 'Quiet Library Study',
    tagline: 'Tone Loop + Summer Night',
    description: 'Subtle warm tones paired with peaceful nocturnal crickets for deep reading and revision.',
    toneLoop: true,
    toneLoopVolume: 0.25,
    bpm: 48,
    ambientVolumes: {
      'summer-night': 0.18,
    },
    masterVolume: 0.5,
  },
  {
    id: 'rainy-cabin',
    name: 'Rainy Fireplace',
    tagline: 'Gentle Rain + Fireplace Glow',
    description: 'A cozy combination of crackling fire embers and rainfall without synthesized tones.',
    toneLoop: false,
    toneLoopVolume: 0,
    bpm: 48,
    ambientVolumes: {
      rain: 0.25,
      fireplace: 0.2,
    },
    masterVolume: 0.55,
  },
  {
    id: 'forest-creek',
    name: 'Morning Forest Creek',
    tagline: 'Stream + Forest Birds',
    description: 'Fresh running water stream and morning forest birds to energize daytime study sessions.',
    toneLoop: false,
    toneLoopVolume: 0,
    bpm: 48,
    ambientVolumes: {
      stream: 0.25,
      birds: 0.15,
    },
    masterVolume: 0.5,
  },
  {
    id: 'pure-tone',
    name: 'Pure 48 BPM Tone Loop',
    tagline: 'Synthesized Chords Only',
    description: 'Just the calm, minimalist repeating chord progression without any ambient noise layers.',
    toneLoop: true,
    toneLoopVolume: 0.35,
    bpm: 48,
    ambientVolumes: {},
    masterVolume: 0.5,
  },
];
