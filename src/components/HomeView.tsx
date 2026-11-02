import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Brain,
  Clock,
  Compass,
  CheckCircle2,
  Calendar,
  Coffee,
  Quote,
  RefreshCw,
  User,
  Layers
} from 'lucide-react';
import { SAMPLE_TRANSCRIPTS, SampleTranscript } from '../data/sampleTranscripts';
import { NavRoute } from './Sidebar';
import { useSoundscape } from '../context/SoundscapeContext';
import { useAuth } from '../context/AuthContext';

interface HomeViewProps {
  onNavigate: (route: NavRoute) => void;
  onSelectSample?: (sample: SampleTranscript) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectSample }) => {
  const { user } = useAuth();
  const { activatePreset, openMixer, isPlaying, activePreset } = useSoundscape();

  const handleLofiBeatsClick = async () => {
    await activatePreset('night-lofi', true);
    openMixer();
  };

  const { characterPreference, updateCharacterPreference } = useAuth();
  const character = (characterPreference === 'boy' ? 'boy' : 'girl') as 'girl' | 'boy';
  const [hasSwitched, setHasSwitched] = useState(false);

  const handleSelectCharacter = (selected: 'girl' | 'boy') => {
    updateCharacterPreference(selected);
    try {
      localStorage.setItem('lecturescript_lofi_character', selected);
    } catch {}
    // Instantly hide converter after user changes to desired image
    setHasSwitched(true);
  };
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* ── Top Welcome & Daily Inspiration Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2.5"
            style={{
              background: 'rgba(220, 212, 255, 0.7)',
              color: 'var(--color-primary-dark)',
              border: '1px solid rgba(184, 168, 255, 0.6)'
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Study Space • Autumn Semester</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#242238]">
            Hi, {user ? user.nickname : 'Learner'}! 👋 <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              What are you studying today?
            </span>
          </h1>
          <p className="text-sm sm:text-base mt-2 text-[#6B6888] max-w-xl">
            Transform any class recording or transcript into clean, organized study notes, practice questions, and Cornell summaries in seconds.
          </p>
        </div>

        {/* Quick Start Studio Button */}
        <button
          onClick={() => onNavigate('studio')}
          className="btn-primary flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-violet-500/25 cursor-pointer hover:scale-105 transition-all group shrink-0"
        >
          <Sparkles className="w-4 h-4 text-violet-200" />
          <span>Open Study Studio</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* ── Aesthetic Hero Showcase with Cartoon Lofi Study Character ── */}
      <div
        className="glass-panel-elevated rounded-3xl p-6 sm:p-8 relative overflow-hidden border"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(247, 245, 255, 0.9) 100%)',
          borderColor: 'rgba(220, 212, 255, 0.8)',
          boxShadow: '0 20px 40px -10px rgba(116, 86, 232, 0.12), inset 0 1px 2px rgba(255, 255, 255, 1)'
        }}
      >
        {/* Soft Background Lavender Blobs */}
        <div
          className="absolute -right-16 -top-16 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle, #DCD4FF 0%, #B8A8FF 50%, transparent 70%)' }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          {/* Left Text / Daily Quote */}
          <div className="lg:col-span-7 space-y-5">
            <div
              className="p-4 sm:p-5 rounded-2xl border"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(220, 212, 255, 0.7)',
                boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.05)'
              }}
            >
              <div className="flex items-start gap-3">
                <Quote className="w-6 h-6 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm sm:text-base italic font-medium text-[#242238] leading-relaxed">
                    &ldquo;Focus is a muscle. The more you practice quiet learning, the clearer and simpler everything becomes.&rdquo;
                  </p>
                  <p className="text-xs font-semibold text-violet-600 mt-2 tracking-wide uppercase">
                    — Daily Study Mindfulness
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-[#6B6888]">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-violet-100">
                <Coffee className="w-3.5 h-3.5 text-violet-500" />
                Lofi Calm Flow
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-violet-100">
                <Clock className="w-3.5 h-3.5 text-violet-500" />
                2 Hour Lecture Support
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-violet-100">
                <Brain className="w-3.5 h-3.5 text-violet-500" />
                Cornell &amp; Practice Qs
              </span>
            </div>

            <div className="pt-1 flex items-center gap-3">
              <button
                onClick={() => onNavigate('studio')}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <span>Paste Lecture Transcript</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate('practice')}
                className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 text-violet-600" />
                <span>Practice Mode</span>
              </button>
            </div>
          </div>

          {/* Right: Gorgeous Anime Cartoon Lofi Study Illustration with Invisible-on-Select Converter */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div
              id="lofi-study-card"
              onMouseLeave={() => setHasSwitched(false)}
              className="lofi-card relative w-full max-w-[340px] aspect-square rounded-3xl overflow-hidden p-2 flex items-center justify-center shadow-xl border transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, #F5F1FF 0%, #EAE2FF 100%)',
                borderColor: 'rgba(255, 255, 255, 0.95)',
                boxShadow: '0 20px 40px -10px rgba(116, 86, 232, 0.22), inset 0 1px 2px rgba(255, 255, 255, 1)',
              }}
            >
              {/* Dynamic Image (Girl or Boy) */}
              <img
                key={character}
                src={character === 'girl' ? '/lofi-study-girl.jpg' : '/lofi-study-boy.jpg'}
                alt={
                  character === 'girl'
                    ? 'Cartoon lofi girl with oversized lavender hoodie and headphones studying at desk'
                    : 'Cartoon lofi boy with oversized lavender hoodie and headphones studying at desk'
                }
                className="w-full h-full object-cover rounded-2xl transition-all duration-500"
                loading="eager"
              />

              {/* Converter (User Preference Switcher):
                  - Completely invisible by default
                  - Appears gently when hovering over the card
                  - Disappears / becomes completely invisible immediately once user chooses their desired image
              */}
              <div
                id="lofi-converter-container"
                className={`lofi-converter-box absolute top-3.5 right-3.5 z-20 ${
                  hasSwitched ? 'lofi-chosen' : ''
                }`}
              >
                <div
                  className="p-1 rounded-full flex items-center gap-1 shadow-xl border border-white/90"
                  style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 24px -2px rgba(116, 86, 232, 0.3)',
                  }}
                >
                  <button
                    id="lofi-switch-girl"
                    onClick={() => handleSelectCharacter('girl')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                      character === 'girl'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-violet-900/80 hover:text-violet-900 hover:bg-violet-100/60'
                    }`}
                    title="Choose Female Lofi Character"
                  >
                    <span>👧</span>
                    <span>Girl</span>
                  </button>
                  <button
                    id="lofi-switch-boy"
                    onClick={() => handleSelectCharacter('boy')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                      character === 'boy'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-violet-900/80 hover:text-violet-900 hover:bg-violet-100/60'
                    }`}
                    title="Choose Male Lofi Character"
                  >
                    <span>👦</span>
                    <span>Boy</span>
                  </button>
                </div>
              </div>

              {/* Interactive Lofi Music Button */}
              <button
                type="button"
                id="lofi-beats-button"
                onClick={handleLofiBeatsClick}
                className={`absolute bottom-4 right-4 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-[11px] font-bold shadow-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                  isPlaying && activePreset === 'night-lofi'
                    ? 'bg-violet-600 text-white border-violet-400 ring-2 ring-violet-300/60 shadow-violet-500/30'
                    : 'bg-white/95 text-violet-900 border-white/80 hover:bg-white'
                }`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="Play Night Lo-Fi 48 BPM soundscape & open mixer"
              >
                <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-violet-500'}`} />
                <span>lofi beats 48bpm</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Feature Cards (Dashboard Hub) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => onNavigate('studio')}
          className="glass-panel p-5 rounded-2xl cursor-pointer hover:-translate-y-1 transition-all group border"
          style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3 group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[#242238] group-hover:text-violet-700 transition-colors">
            Study Studio
          </h3>
          <p className="text-xs text-[#6B6888] mt-1 leading-relaxed">
            Paste Zoom, YouTube, or audio transcripts to create clean study guides and Cornell summaries.
          </p>
        </div>

        {/* Card 2: Flashcards Hub */}
        <div
          onClick={() => onNavigate('flashcards')}
          className="glass-panel p-5 rounded-2xl cursor-pointer hover:-translate-y-1 transition-all group border"
          style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3 group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="font-bold text-base text-[#242238] group-hover:text-violet-700 transition-colors">
            Flashcards Hub
          </h3>
          <p className="text-xs text-[#6B6888] mt-1 leading-relaxed">
            GenZ active recall decks with 3D flip study, mastery streaks, and smart deck builder.
          </p>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => onNavigate('practice')}
          className="glass-panel p-5 rounded-2xl cursor-pointer hover:-translate-y-1 transition-all group border"
          style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3 group-hover:scale-110 transition-transform">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[#242238] group-hover:text-violet-700 transition-colors">
            Practice &amp; Recall
          </h3>
          <p className="text-xs text-[#6B6888] mt-1 leading-relaxed">
            Test yourself with practice questions and check answers before your midterms or quizzes.
          </p>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => onNavigate('library')}
          className="glass-panel p-5 rounded-2xl cursor-pointer hover:-translate-y-1 transition-all group border"
          style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3 group-hover:scale-110 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-[#242238] group-hover:text-violet-700 transition-colors">
            Saved Notes Library
          </h3>
          <p className="text-xs text-[#6B6888] mt-1 leading-relaxed">
            Access your previously generated lectures anytime with full search and offline support.
          </p>
        </div>
      </div>

      {/* ── Sample Lectures Quick Jump ── */}
      <div
        className="glass-panel rounded-2xl p-5 border"
        style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
              Quick Test Drive
            </span>
            <span className="text-xs text-[#6B6888]">• Click any lecture to test Study Studio</span>
          </div>
          <span className="text-xs font-semibold text-violet-600">
            {SAMPLE_TRANSCRIPTS.length} Sample Lectures Ready
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_TRANSCRIPTS.map((sample) => {
            return (
              <button
                key={sample.id}
                onClick={() => {
                  if (onSelectSample) onSelectSample(sample);
                  onNavigate('studio');
                }}
                className="text-left p-3.5 rounded-xl border bg-white/70 hover:bg-white hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer group"
                style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
              >
                <div className="font-bold text-xs text-[#242238] group-hover:text-violet-700 transition-colors line-clamp-1">
                  {sample.subject}
                </div>
                <div className="text-[11px] text-[#6B6888] mt-0.5 line-clamp-1">
                  {sample.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
