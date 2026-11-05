import React, { useState, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Clock,
  Sliders,
  CheckCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  GraduationCap
} from 'lucide-react';
import { SAMPLE_TRANSCRIPTS, SampleTranscript } from '../data/sampleTranscripts';
import { NoteDensity, NoteStyle } from '../types';

interface Props {
  onGenerate: (data: {
    transcript: string;
    subject: string;
    noteStyle: NoteStyle;
    density: NoteDensity;
    includeDiagramPrompts: boolean;
    includeExamCues: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

export const TranscriptInput: React.FC<Props> = ({
  onGenerate,
  isLoading,
}) => {
  const [transcript, setTranscript] = useState('');
  const [subject, setSubject] = useState('');
  const [noteStyle, setNoteStyle] = useState<NoteStyle>('detailed');
  const [density, setDensity] = useState<NoteDensity>('comprehensive');
  const [includeDiagramPrompts, setIncludeDiagramPrompts] = useState(true);
  const [includeExamCues, setIncludeExamCues] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    'Reading your class transcript...',
    'Cleaning up small talk and pauses...',
    'Finding the main topics and key points...',
    'Pulling out important terms and formulas...',
    'Highlighting common exam mistakes...',
    'Creating practice questions...',
    'Putting together your study notes...',
  ];

  React.useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Stats calculation
  const trimmed = transcript.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = transcript.length;
  const estimatedMinutes = Math.round(wordCount / 140);
  const estimatedHours = (estimatedMinutes / 60).toFixed(1);

  const handleSelectSample = (sample: SampleTranscript) => {
    setTranscript(sample.transcript);
    setSubject(sample.title);
    setFileName(`Sample: ${sample.title} (${sample.duration})`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!subject) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setSubject(cleanName);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const cleaned = cleanSubtitleTimestamps(content);
        setTranscript(cleaned);
      }
    };
    reader.readAsText(file);
    // Reset file input value so selecting the same file triggers onChange
    e.target.value = '';
  };

  const cleanSubtitleTimestamps = (text: string) => {
    return text
      .replace(/^\uFEFF/, '') // Strip UTF-8 BOM if present
      .replace(/\r\n/g, '\n') // Normalize Windows line breaks
      .replace(/^WEBVTT.*$/gm, '')
      .replace(/^\d+\s*$/gm, '')
      .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || isLoading) return;

    onGenerate({
      transcript,
      subject: subject.trim() || 'College Lecture',
      noteStyle,
      density,
      includeDiagramPrompts,
      includeExamCues,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Hero ── */}
      <div className="text-center space-y-3 pt-2 pb-1">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-[1.02]"
          style={{
            background: 'rgba(220, 212, 255, 0.65)',
            backdropFilter: 'blur(10px)',
            color: '#5E40D4',
            borderColor: 'rgba(184, 168, 255, 0.7)',
            boxShadow: '0 2px 8px -1px rgba(116, 86, 232, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
          }}
        >
          <GraduationCap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span>Clear Study Notes for Your Classes &amp; Exams</span>
        </div>
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Turn Class Transcripts into Clear Study Notes
        </h1>
        <p className="text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Turn long class recordings into organized topics, clear explanations, key terms, formulas, and test tips.
        </p>
      </div>

      {/* ── Main Form Card with Glass Elevation ── */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-6"
      >
        {/* Course Name */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="subject-input"
              className="block text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text)' }}
            >
              Course Name or Topic
            </label>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              e.g., Computer Science, Biology, or History
            </span>
          </div>
          <input
            id="subject-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Biology 101 or World History"
            className="glass-input w-full px-4 py-3 rounded-xl text-sm transition-all"
            style={{
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* 1-Click Sample Transcripts (Layered Glass Box) */}
        <div
          className="p-4 rounded-2xl space-y-2.5"
          style={{ 
            background: 'rgba(247, 245, 255, 0.72)', 
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(220, 212, 255, 0.65)',
            boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)'
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              Try a Sample Lecture:
            </span>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Click any lecture to test it out</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SAMPLE_TRANSCRIPTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="glass-pill text-left p-3 rounded-xl transition-all group hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(220, 212, 255, 0.7)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold truncate group-hover:text-[#7456E8] transition-colors"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {sample.title}
                  </span>
                  <span
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 border"
                    style={{
                      background: 'rgba(220, 212, 255, 0.6)',
                      color: 'var(--color-primary-dark)',
                      borderColor: 'rgba(184, 168, 255, 0.5)'
                    }}
                  >
                    {sample.duration}
                  </span>
                </div>
                <p className="text-[11px] line-clamp-1 mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {sample.preview}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Transcript Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="transcript-area"
              className="block text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text)' }}
            >
              Class Transcript
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.vtt,.srt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                <span>Upload File (.txt, .vtt, .srt)</span>
              </button>
              {transcript && (
                <button
                  type="button"
                  onClick={() => { setTranscript(''); setFileName(null); }}
                  className="p-1.5 transition-colors rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                  title="Clear text"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {fileName && (
            <div
              className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all"
              style={{
                background: 'rgba(220, 212, 255, 0.65)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(184, 168, 255, 0.7)',
                color: '#5E40D4',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)'
              }}
            >
              <CheckCircle className="w-4 h-4 shrink-0 text-[#7456E8]" />
              <span className="truncate">Current file: <strong>{fileName}</strong></span>
            </div>
          )}

          <div className="relative">
            <textarea
              id="transcript-area"
              rows={11}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your class transcript from Zoom, Google Meet, YouTube, or Teams here... Works great with transcripts up to 2 hours long."
              className="glass-input w-full px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-mono leading-relaxed resize-y transition-all"
              style={{
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Stats Bar */}
          <div
            className="flex flex-wrap items-center justify-between text-xs pt-1 px-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <div className="flex items-center gap-4">
              <span><strong style={{ color: 'var(--color-text)' }}>{wordCount.toLocaleString()}</strong> words</span>
              <span><strong style={{ color: 'var(--color-text)' }}>{charCount.toLocaleString()}</strong> characters</span>
              <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-text)' }}>
                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                <span>~{estimatedMinutes} min ({estimatedHours} hr) class</span>
              </span>
            </div>
            {wordCount > 3000 && (
              <span
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                style={{
                  background: 'rgba(220, 212, 255, 0.6)',
                  color: 'var(--color-primary-dark)',
                  borderColor: 'rgba(184, 168, 255, 0.6)',
                }}
              >
                Ready for full lecture
              </span>
            )}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="border-t pt-4" style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-semibold transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#7456E8]" />
              Customize Your Notes (Format &amp; Detail Level)
            </span>
            {showAdvanced
              ? <ChevronUp className="w-4 h-4 text-[#7456E8]" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>

          {showAdvanced && (
            <div
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl text-xs transition-all"
              style={{ 
                background: 'rgba(247, 245, 255, 0.72)', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(220, 212, 255, 0.7)',
                boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)'
              }}
            >
              {/* Note Style */}
              <div className="space-y-1.5">
                <label className="font-semibold block" style={{ color: 'var(--color-text)' }}>Note Format</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'detailed', label: 'Complete Study Guide' },
                    { id: 'cornell',  label: 'Cornell Notes' },
                    { id: 'cheatsheet', label: 'Key Terms & Formulas' },
                    { id: 'bullet',  label: 'Quick Summary' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setNoteStyle(style.id as NoteStyle)}
                      className="px-2.5 py-2 rounded-xl border text-left transition-all font-medium cursor-pointer"
                      style={
                        noteStyle === style.id
                          ? {
                              background: 'var(--color-primary)',
                              color: '#FFFFFF',
                              borderColor: 'var(--color-primary)',
                              boxShadow: '0 2px 8px rgba(116, 86, 232, 0.3)'
                            }
                          : {
                              background: 'rgba(255, 255, 255, 0.9)',
                              color: 'var(--color-text)',
                              borderColor: 'rgba(220, 212, 255, 0.8)',
                            }
                      }
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Density */}
              <div className="space-y-1.5">
                <label className="font-semibold block" style={{ color: 'var(--color-text)' }}>Detail Level</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'comprehensive', label: 'Detailed (Best)' },
                    { id: 'balanced',      label: 'Standard' },
                    { id: 'concise',       label: 'Quick Review' },
                  ].map((dens) => (
                    <button
                      key={dens.id}
                      type="button"
                      onClick={() => setDensity(dens.id as NoteDensity)}
                      className="px-2.5 py-2 rounded-xl border text-center transition-all font-medium cursor-pointer"
                      style={
                        density === dens.id
                          ? {
                              background: 'var(--color-primary)',
                              color: '#FFFFFF',
                              borderColor: 'var(--color-primary)',
                              boxShadow: '0 2px 8px rgba(116, 86, 232, 0.3)'
                            }
                          : {
                              background: 'rgba(255, 255, 255, 0.9)',
                              color: 'var(--color-text)',
                              borderColor: 'rgba(220, 212, 255, 0.8)',
                            }
                      }
                    >
                      {dens.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes */}
              <div
                className="sm:col-span-2 pt-2 border-t flex flex-wrap gap-4"
                style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
              >
                <label className="flex items-center gap-2 cursor-pointer font-medium" style={{ color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    checked={includeDiagramPrompts}
                    onChange={(e) => setIncludeDiagramPrompts(e.target.checked)}
                    className="rounded text-[#7456E8] focus:ring-[#7456E8]"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span>Include visual diagrams &amp; sketches</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium" style={{ color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    checked={includeExamCues}
                    onChange={(e) => setIncludeExamCues(e.target.checked)}
                    className="rounded text-[#7456E8] focus:ring-[#7456E8]"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span>Include common mistakes to avoid in tests</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={!trimmed || isLoading}
            className="btn-primary w-full py-4 px-6 rounded-2xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isLoading ? (
              <div className="flex items-center gap-2.5" style={{ color: '#DCD4FF' }}>
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin shrink-0"
                  style={{ borderColor: 'rgba(220,212,255,0.3)', borderTopColor: '#DCD4FF' }}
                />
                <span className="animate-pulse">{loadingMessages[loadingStep]}</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-[#DCD4FF] group-hover:rotate-12 transition-transform" />
                <span>Create Study Notes</span>
              </>
            )}
          </button>
          {!trimmed && (
            <p className="text-center text-xs mt-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Paste your transcript above or try a sample lecture to get started.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

