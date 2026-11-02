import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  Copy,
  Printer,
  ArrowLeft,
  ArrowUp,
  AlertTriangle,
  Lightbulb,
  FileText,
  Download,
  HelpCircle,
  Eye,
  EyeOff,
  Scale,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  FileDown
} from 'lucide-react';
import { LectureNotes } from '../types';
import {
  renderInlineMarkdown,
  FormattedNoteItem,
} from './FormattedText';
import { downloadNotesAsPdf } from '../utils/pdfGenerator';

interface Props {
  notes: LectureNotes;
  onBack: () => void;
  onSendToFlashcards?: (lecture: LectureNotes) => void;
}

export const NotebookView: React.FC<Props> = ({ notes, onBack, onSendToFlashcards }) => {
  const [activeTab, setActiveTab] = useState<'study-guide' | 'active-recall' | 'cornell'>('study-guide');
  const [copiedAll, setCopiedAll] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');

  // ── Bring to Top State & Scroll Progress ──
  const [showBringToTop, setShowBringToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100))) : 0;

      setScrollProgress(progress);
      setShowBringToTop(scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleBringToTop = () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
    if (document.documentElement) {
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    }
    if (document.body) {
      document.body.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    }
  };

  const toggleReveal = (index: number) => {
    setRevealedAnswers((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleDirectPdfDownload = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadNotesAsPdf(notes);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('Direct PDF generation error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyMarkdown = () => {
    let md = `# ${notes.title}\n`;
    md += `**Subject / Course:** ${notes.subject} | **Date:** ${notes.lectureDate}\n\n`;
    md += `## Overview\n${notes.overview}\n\n`;

    if (notes.modules?.length) {
      md += `## Course Modules & Conceptual Analysis\n\n`;
      notes.modules.forEach((m, idx) => {
        md += `### Topic ${idx + 1}: ${m.topic}\n`;
        md += `*${m.subheading}* [${m.importance === 'High-Yield' ? 'Key Topic' : (m.importance || 'Key Topic')}]\n\n`;
        md += `${m.coreExplanation}\n\n`;
        m.keyPoints.forEach((p) => {
          md += `- ${p}\n`;
        });
        if (m.exampleOrCaseStudy) {
          md += `\n**Real-World Example:** ${m.exampleOrCaseStudy}\n`;
        }
        md += `\n`;
      });
    }

    if (notes.keyFormulasOrDefinitions?.length) {
      md += `## Key Formulas & Definitions\n\n`;
      notes.keyFormulasOrDefinitions.forEach((item) => {
        md += `### ${item.term}\n- **Formula or Definition:** ${item.formulaOrDefinition}\n- **How to use it:** ${item.context}\n`;
        if (item.examSignificance) {
          md += `- **Why it matters:** ${item.examSignificance}\n`;
        }
        md += `\n`;
      });
    }

    if (notes.examTrapsAndAlerts?.length) {
      md += `## ⚠️ Common Mistakes to Avoid\n\n`;
      notes.examTrapsAndAlerts.forEach((trap) => {
        md += `### ${trap.topic}\n- **Common mistake:** ${trap.trapDescription}\n- **How to get full points:** ${trap.howToAnswerInExam}\n\n`;
      });
    }

    if (notes.activeRecallQuestions?.length) {
      md += `## 🧠 Practice Questions\n\n`;
      notes.activeRecallQuestions.forEach((q, idx) => {
        md += `**Q${idx + 1}: ${q.question}**\n- *Correct Answer:* ${q.answerKey}\n\n`;
      });
    }

    md += `## Quick Summary\n${notes.bottomSummary}\n`;

    navigator.clipboard.writeText(md);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const fontClasses = {
    normal: 'text-sm sm:text-base leading-relaxed',
    large: 'text-base sm:text-lg leading-relaxed',
    xlarge: 'text-lg sm:text-xl leading-relaxed',
  }[fontSize];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* ── Floating Control Bar with Layered Glass Reflection ── */}
      <div
        className="print:hidden sticky top-4 z-20 p-3 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 transition-all"
        style={{
          background: 'rgba(36, 34, 56, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(220, 212, 255, 0.25)',
          boxShadow: '0 16px 40px -8px rgba(36, 34, 56, 0.35), 0 4px 12px -2px rgba(36, 34, 56, 0.15), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)',
          color: '#DCD4FF',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer hover:-translate-y-0.5"
            style={{
              background: 'rgba(116, 86, 232, 0.25)',
              color: '#FFFFFF',
              border: '1px solid rgba(220, 212, 255, 0.35)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(116, 86, 232, 0.45)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(116, 86, 232, 0.25)'; }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Transcript
          </button>
          <span className="hidden sm:inline-block w-px h-5" style={{ background: 'rgba(220, 212, 255, 0.25)' }} />
          <span className="text-xs hidden sm:inline font-medium" style={{ color: 'rgba(220, 212, 255, 0.75)' }}>
            {notes.stats ? `~${notes.stats.estimatedLectureMinutes} min class • ${notes.stats.wordCountOriginal} words analyzed` : 'Study Guide'}
          </span>
          {showBringToTop && (
            <button
              onClick={handleBringToTop}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer animate-fadeIn hover:-translate-y-0.5"
              style={{
                background: 'rgba(116, 86, 232, 0.35)',
                color: '#FFFFFF',
                border: '1px solid rgba(220, 212, 255, 0.4)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
              }}
              title="Bring to top of lecture notes"
            >
              <ArrowUp className="w-3.5 h-3.5 text-violet-300" />
              <span>Top ({scrollProgress}%)</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm">
          {/* Zoom */}
          <div
            className="flex items-center rounded-xl p-1 gap-1"
            style={{ background: 'rgba(116, 86, 232, 0.2)', border: '1px solid rgba(220, 212, 255, 0.25)' }}
          >
            <span className="text-[11px] font-semibold pl-1.5 pr-0.5" style={{ color: 'rgba(220, 212, 255, 0.8)' }}>Text Size:</span>
            {(['normal', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
                style={
                  fontSize === size
                    ? { background: 'var(--color-primary)', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(116, 86, 232, 0.5)' }
                    : { color: 'rgba(220, 212, 255, 0.7)' }
                }
                title={`Set text size to ${size === 'normal' ? 'Normal' : size === 'large' ? 'Large' : 'Extra Large'}`}
              >
                {size === 'normal' ? 'Normal' : size === 'large' ? 'Large' : 'Extra Large'}
              </button>
            ))}
          </div>

          {/* Copy Notes */}
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-semibold cursor-pointer hover:-translate-y-0.5"
            style={{ 
              background: 'rgba(116, 86, 232, 0.2)', 
              color: '#DCD4FF', 
              border: '1px solid rgba(220, 212, 255, 0.25)' 
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(116, 86, 232, 0.35)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(116, 86, 232, 0.2)'; }}
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied!' : 'Copy Notes'}</span>
          </button>

          {/* Create Flashcards Button */}
          {onSendToFlashcards && (
            <button
              onClick={() => onSendToFlashcards(notes)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all font-semibold cursor-pointer hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.35) 0%, rgba(124, 58, 237, 0.45) 100%)',
                color: '#FFFFFF',
                border: '1px solid rgba(220, 212, 255, 0.45)',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
              }}
              title="Turn this lecture into interactive flashcards"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>Make Flashcards</span>
            </button>
          )}

          {/* PDF Download */}
          <button
            onClick={handleDirectPdfDownload}
            disabled={isGeneratingPdf}
            className="btn-primary flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all font-semibold cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
            title="Download notes as a PDF file"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                <span>Creating PDF...</span>
              </>
            ) : pdfSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>PDF Downloaded!</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs (Translucent White Glass) ── */}
      <div
        className="print:hidden flex items-center justify-between rounded-2xl p-1.5 transition-all"
        style={{ 
          background: 'rgba(255, 255, 255, 0.82)', 
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 8px 24px -4px rgba(116, 86, 232, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)'
        }}
      >
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'study-guide', label: 'Study Guide', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'active-recall', label: `Practice Questions (${notes.activeRecallQuestions?.length || 0})`, icon: <HelpCircle className="w-4 h-4" /> },
            { id: 'cornell', label: 'Cornell Notes', icon: <Layers className="w-4 h-4" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                style={
                  isActive
                    ? { 
                        background: 'linear-gradient(135deg, #7456E8 0%, #8E70FA 100%)', 
                        color: '#FFFFFF',
                        boxShadow: '0 4px 14px 0 rgba(116, 86, 232, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                      }
                    : { color: 'var(--color-text-muted)' }
                }
                onMouseEnter={(e) => { 
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.95)';
                    (e.currentTarget as HTMLElement).style.color = '#7456E8';
                  } 
                }}
                onMouseLeave={(e) => { 
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                  } 
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Study Sheet with Note Sheet Styling ── */}
      <div
        style={{
          zoom: fontSize === 'xlarge' ? 1.25 : fontSize === 'large' ? 1.12 : 1,
        }}
        className={`note-sheet rounded-3xl overflow-hidden transition-all duration-200 origin-top ${
          fontSize === 'xlarge'
            ? 'text-base sm:text-lg'
            : fontSize === 'large'
            ? 'text-[15px] sm:text-[17px]'
            : 'text-sm sm:text-base'
        }`}
      >
        <div className="p-6 sm:p-10 space-y-8">
          {/* Header Block */}
          <div className="pb-6" style={{ borderBottom: '1px solid rgba(220, 212, 255, 0.7)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold tracking-wider uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                style={{
                  color: '#5E40D4',
                  background: 'rgba(220, 212, 255, 0.65)',
                  backdropFilter: 'blur(8px)',
                  borderColor: 'rgba(184, 168, 255, 0.7)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                {notes.courseCodeOrTopic || notes.subject}
              </span>
              <span className="font-semibold text-xs tracking-normal" style={{ color: 'var(--color-text-muted)' }}>
                {notes.lectureDate}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug" style={{ color: 'var(--color-text)' }}>
              {notes.title}
            </h1>
            <p
              className="mt-3.5 leading-relaxed italic text-sm sm:text-base pl-4 p-3.5 rounded-2xl border"
              style={{
                color: 'var(--color-text)',
                borderLeft: '4px solid var(--color-primary)',
                background: 'rgba(247, 245, 255, 0.7)',
                borderColor: 'rgba(220, 212, 255, 0.6)',
                boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)'
              }}
            >
              {renderInlineMarkdown(notes.overview)}
            </p>
          </div>

          {/* TAB 1: ACADEMIC EXAM MASTER NOTES */}
          {activeTab === 'study-guide' && (
            <div className="space-y-8">
              {/* Modules */}
              {notes.modules && notes.modules.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      <Sparkles className="w-5 h-5 text-[#7456E8]" />
                      Key Topics &amp; Explanations
                    </h2>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                      style={{
                        background: 'rgba(220, 212, 255, 0.5)',
                        color: 'var(--color-primary-dark)',
                        borderColor: 'rgba(184, 168, 255, 0.5)'
                      }}
                    >
                      {notes.modules.length} Topics
                    </span>
                  </div>

                  <div className="space-y-5">
                    {notes.modules.map((module, idx) => (
                      <div
                        key={idx}
                        className="p-5 sm:p-6 rounded-2xl space-y-3 transition-all"
                        style={{ 
                          background: 'rgba(247, 245, 255, 0.72)', 
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(220, 212, 255, 0.7)',
                          boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)'
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-xl font-extrabold text-xs flex items-center justify-center text-white shadow-sm"
                              style={{ background: 'linear-gradient(135deg, #7456E8 0%, #8E70FA 100%)' }}
                            >
                              {idx + 1}
                            </span>
                            <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--color-text)' }}>
                              {renderInlineMarkdown(module.topic)}
                            </h3>
                          </div>
                          {module.importance && (
                            <span
                              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                              style={
                                module.importance === 'High-Yield' || module.importance === 'Key Topic'
                                  ? { 
                                      background: 'rgba(220, 212, 255, 0.75)', 
                                      color: 'var(--color-primary-dark)', 
                                      borderColor: 'rgba(184, 168, 255, 0.8)',
                                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                                    }
                                  : { background: 'rgba(255, 255, 255, 0.8)', color: 'var(--color-text-muted)', borderColor: 'rgba(220, 212, 255, 0.5)' }
                              }
                            >
                              {module.importance === 'High-Yield' ? 'Key Topic' : module.importance}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                          {renderInlineMarkdown(module.subheading)}
                        </p>

                        <p className={fontClasses} style={{ color: 'var(--color-text)' }}>
                          {renderInlineMarkdown(module.coreExplanation)}
                        </p>

                        {module.keyPoints && module.keyPoints.length > 0 && (
                          <div className="pt-2">
                            <div className="space-y-2">
                              {module.keyPoints.map((point, pIdx) => (
                                <FormattedNoteItem key={pIdx} content={point} bulletColor="text-[#7456E8]" />
                              ))}
                            </div>
                          </div>
                        )}

                        {module.exampleOrCaseStudy && (
                          <div
                            className="p-3.5 rounded-xl text-xs mt-2 border shadow-xs"
                            style={{ 
                              background: '#FFFFFF', 
                              borderColor: 'rgba(220, 212, 255, 0.8)', 
                              color: 'var(--color-text)',
                              boxShadow: '0 2px 6px -1px rgba(116, 86, 232, 0.04)'
                            }}
                          >
                            <span className="font-bold block mb-1 text-[#7456E8]">
                              📌 Real-World Example:
                            </span>
                            {renderInlineMarkdown(module.exampleOrCaseStudy)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Key Formulas & Definitions */}
              {notes.keyFormulasOrDefinitions && notes.keyFormulasOrDefinitions.length > 0 && (
                <div className="space-y-4 pt-6" style={{ borderTop: '1px solid rgba(220, 212, 255, 0.7)' }}>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(220, 212, 255, 0.8) 0%, rgba(206, 192, 255, 0.8) 100%)', 
                        color: 'var(--color-primary-dark)',
                        border: '1px solid rgba(184, 168, 255, 0.6)'
                      }}
                    >
                      <Lightbulb className="w-4 h-4 text-[#7456E8]" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold" style={{ color: 'var(--color-text)' }}>
                        Key Formulas &amp; Definitions
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Important terms and formulas to remember
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {notes.keyFormulasOrDefinitions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl flex flex-col justify-between space-y-2 border transition-all hover:-translate-y-0.5 hover:shadow-md"
                        style={{ 
                          background: 'rgba(247, 245, 255, 0.72)', 
                          borderColor: 'rgba(206, 192, 255, 0.75)',
                          boxShadow: '0 2px 8px -1px rgba(116, 86, 232, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.9)'
                        }}
                      >
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary-dark)' }}>
                            {renderInlineMarkdown(item.term)}
                          </span>
                          <div
                            className="text-sm font-semibold mt-1 font-mono p-3 rounded-xl border shadow-xs"
                            style={{ 
                              background: '#FFFFFF', 
                              borderColor: 'rgba(220, 212, 255, 0.8)', 
                              color: 'var(--color-text)',
                              boxShadow: 'inset 0 1px 2px rgba(36, 34, 56, 0.02)'
                            }}
                          >
                            {item.formulaOrDefinition}
                          </div>
                        </div>
                        <div className="text-xs space-y-1 pt-1">
                          <p style={{ color: 'var(--color-text)' }}>
                            <strong>How to use it:</strong> {renderInlineMarkdown(item.context)}
                          </p>
                          {item.examSignificance && (
                            <p className="font-medium" style={{ color: 'var(--color-primary-dark)' }}>
                              <strong>Why it matters:</strong> {renderInlineMarkdown(item.examSignificance)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Analysis */}
              {notes.comparisonAnalysis && notes.comparisonAnalysis.length > 0 && (
                <div className="space-y-4 pt-6" style={{ borderTop: '1px solid rgba(220, 212, 255, 0.7)' }}>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(220, 212, 255, 0.8) 0%, rgba(206, 192, 255, 0.8) 100%)', 
                        color: 'var(--color-primary-dark)',
                        border: '1px solid rgba(184, 168, 255, 0.6)'
                      }}
                    >
                      <Scale className="w-4 h-4 text-[#7456E8]" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold" style={{ color: 'var(--color-text)' }}>Side-by-Side Comparison</h2>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Key differences between related concepts</p>
                    </div>
                  </div>

                  <div 
                    className="rounded-2xl overflow-hidden shadow-xs border"
                    style={{ 
                      background: '#FFFFFF',
                      borderColor: 'rgba(220, 212, 255, 0.75)',
                      boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.04)'
                    }}
                  >
                    <table className="w-full text-left text-xs sm:text-sm divide-y" style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}>
                      <thead style={{ background: 'rgba(247, 245, 255, 0.85)', color: 'var(--color-text)', fontSize: '11px' }}>
                        <tr>
                          <th className="p-3.5 font-bold uppercase tracking-wider">Topic</th>
                          <th className="p-3.5 font-bold uppercase tracking-wider">Idea A</th>
                          <th className="p-3.5 font-bold uppercase tracking-wider">Idea B</th>
                          <th className="p-3.5 font-bold uppercase tracking-wider">Main Difference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ background: '#FFFFFF', borderColor: 'rgba(220, 212, 255, 0.5)' }}>
                        {notes.comparisonAnalysis.map((comp, idx) => (
                          <tr key={idx} style={{ color: 'var(--color-text)' }} className="hover:bg-[#F9F7FF] transition-colors">
                            <td className="p-3.5 font-bold">{renderInlineMarkdown(comp.aspect)}</td>
                            <td className="p-3.5">{renderInlineMarkdown(comp.conceptA)}</td>
                            <td className="p-3.5">{renderInlineMarkdown(comp.conceptB)}</td>
                            <td className="p-3.5 font-semibold" style={{ color: 'var(--color-primary-dark)' }}>{renderInlineMarkdown(comp.keyDifference)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Exam Traps (Translucent amber glass warning) */}
              {notes.examTrapsAndAlerts && notes.examTrapsAndAlerts.length > 0 && (
                <div 
                  className="p-6 rounded-2xl space-y-3.5 border transition-all"
                  style={{ 
                    background: 'rgba(254, 243, 199, 0.45)', 
                    backdropFilter: 'blur(8px)',
                    borderColor: 'rgba(252, 211, 77, 0.65)',
                    boxShadow: '0 8px 24px -4px rgba(217, 119, 6, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)'
                  }}
                >
                  <div className="flex items-center gap-2 font-extrabold text-base" style={{ color: '#78350F' }}>
                    <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#D97706' }} />
                    <span>⚠️ Common Mistakes to Avoid</span>
                  </div>
                  <div className="space-y-3 mt-3">
                    {notes.examTrapsAndAlerts.map((trap, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl space-y-2 border shadow-xs" 
                        style={{ 
                          background: '#FFFFFF', 
                          borderColor: 'rgba(252, 211, 77, 0.55)',
                          boxShadow: '0 2px 6px rgba(120, 53, 15, 0.03)'
                        }}
                      >
                        <span className="font-bold text-xs uppercase tracking-wide block" style={{ color: '#92400E' }}>
                          Mistake #{idx + 1}: {renderInlineMarkdown(trap.topic)}
                        </span>
                        <p className="text-xs sm:text-sm" style={{ color: 'var(--color-text)' }}>
                          <strong>Common mistake:</strong> {renderInlineMarkdown(trap.trapDescription)}
                        </p>
                        <p 
                          className="text-xs sm:text-sm font-medium p-2.5 rounded-lg border" 
                          style={{ 
                            color: 'var(--color-primary-dark)', 
                            background: 'rgba(247, 245, 255, 0.75)', 
                            borderColor: 'rgba(220, 212, 255, 0.7)' 
                          }}
                        >
                          <strong>How to get full points:</strong> {renderInlineMarkdown(trap.howToAnswerInExam)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagrams */}
              {notes.diagramsToDraw && notes.diagramsToDraw.length > 0 && (
                <div className="space-y-4 pt-6" style={{ borderTop: '1px solid rgba(220, 212, 255, 0.7)' }}>
                  <h2 className="text-base sm:text-lg font-extrabold" style={{ color: 'var(--color-text)' }}>
                    Diagrams &amp; Sketches
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {notes.diagramsToDraw.map((diag, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl space-y-3 border"
                        style={{ 
                          background: 'rgba(247, 245, 255, 0.72)', 
                          backdropFilter: 'blur(8px)',
                          borderColor: 'rgba(220, 212, 255, 0.7)',
                          boxShadow: '0 4px 14px -2px rgba(116, 86, 232, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)'
                        }}
                      >
                        <span className="font-bold text-sm sm:text-base block" style={{ color: 'var(--color-text)' }}>
                          Diagram #{idx + 1}: {renderInlineMarkdown(diag.title)}
                        </span>
                        <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          <strong>How it works:</strong> {renderInlineMarkdown(diag.instruction)}
                        </p>
                        {diag.asciiSketch && (
                          <div 
                            className="p-3.5 rounded-xl overflow-x-auto border" 
                            style={{ 
                              background: '#FFFFFF', 
                              borderColor: 'rgba(220, 212, 255, 0.75)',
                              boxShadow: 'inset 0 1px 2px rgba(36, 34, 56, 0.03)'
                            }}
                          >
                            <pre className="font-mono text-xs sm:text-sm leading-relaxed whitespace-pre" style={{ color: 'var(--color-text)' }}>
                              {diag.asciiSketch}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Summary */}
              {notes.bottomSummary && (
                <div 
                  className="p-5 rounded-2xl space-y-2 border" 
                  style={{ 
                    background: 'rgba(247, 245, 255, 0.72)', 
                    backdropFilter: 'blur(8px)',
                    borderColor: 'rgba(220, 212, 255, 0.7)',
                    boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)'
                  }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base" style={{ color: 'var(--color-text)' }}>
                    <FileText className="w-4 h-4 text-[#7456E8]" />
                    <span>Quick Summary &amp; Main Takeaways</span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {renderInlineMarkdown(notes.bottomSummary)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE RECALL */}
          {activeTab === 'active-recall' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>Practice Questions</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Try answering each question before checking the answer.</p>
              </div>

              {notes.activeRecallQuestions && notes.activeRecallQuestions.length > 0 ? (
                <div className="space-y-4">
                  {notes.activeRecallQuestions.map((q, idx) => {
                    const isRevealed = Boolean(revealedAnswers[idx]);
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl space-y-3 border transition-all"
                        style={{ 
                          background: 'rgba(247, 245, 255, 0.72)', 
                          backdropFilter: 'blur(8px)',
                          borderColor: 'rgba(220, 212, 255, 0.7)',
                          boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)'
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-sm sm:text-base leading-snug" style={{ color: 'var(--color-text)' }}>
                            Q{idx + 1}: {renderInlineMarkdown(q.question)}
                          </span>
                          <button
                            onClick={() => toggleReveal(idx)}
                            className="glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 cursor-pointer"
                            style={{ 
                              background: 'rgba(220, 212, 255, 0.65)', 
                              color: 'var(--color-primary-dark)', 
                              border: '1px solid rgba(184, 168, 255, 0.7)' 
                            }}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isRevealed ? 'Hide Answer' : 'Show Answer'}</span>
                          </button>
                        </div>

                        {isRevealed && (
                          <div
                            className="p-4 rounded-xl text-xs sm:text-sm leading-relaxed border transition-all animate-fadeIn"
                            style={{ 
                              background: '#FFFFFF', 
                              borderColor: 'rgba(220, 212, 255, 0.8)', 
                              color: 'var(--color-text)',
                              boxShadow: '0 2px 8px rgba(116, 86, 232, 0.04)'
                            }}
                          >
                            <strong className="block mb-1 text-[#7456E8]">Correct Answer:</strong>
                            {renderInlineMarkdown(q.answerKey)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>No practice questions for this lecture.</p>
              )}
            </div>
          )}

          {/* TAB 3: CORNELL */}
          {activeTab === 'cornell' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>Cornell Notes</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Cover the right side to test yourself using the cue questions on the left.</p>
              </div>

              <div 
                className="rounded-2xl overflow-hidden divide-y border shadow-xs" 
                style={{ 
                  background: '#FFFFFF', 
                  borderColor: 'rgba(220, 212, 255, 0.75)',
                  boxShadow: '0 4px 16px -2px rgba(116, 86, 232, 0.04)'
                }}
              >
                <div
                  className="grid grid-cols-12 text-xs font-bold uppercase tracking-wider py-3 px-4"
                  style={{ background: 'rgba(247, 245, 255, 0.85)', color: 'var(--color-text)', borderBottom: '1px solid rgba(220, 212, 255, 0.7)' }}
                >
                  <div className="col-span-4">Questions &amp; Cues</div>
                  <div className="col-span-8">Notes &amp; Explanations</div>
                </div>

                {(notes.cornellSections || []).map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    className="grid grid-cols-12 transition-colors hover:bg-[#F9F7FF]"
                    style={{ borderColor: 'rgba(220, 212, 255, 0.5)' }}
                  >
                    <div
                      className="col-span-4 p-4"
                      style={{ background: 'rgba(247, 245, 255, 0.45)', borderRight: '1px solid rgba(220, 212, 255, 0.65)' }}
                    >
                      <span className="font-bold text-xs sm:text-sm block" style={{ color: 'var(--color-text)' }}>
                        {renderInlineMarkdown(sec.cue)}
                      </span>
                      {sec.tag && (
                        <span
                          className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{ 
                            background: 'rgba(220, 212, 255, 0.6)', 
                            color: 'var(--color-primary-dark)',
                            borderColor: 'rgba(184, 168, 255, 0.6)'
                          }}
                        >
                          {sec.tag}
                        </span>
                      )}
                    </div>
                    <div className="col-span-8 p-4 space-y-2">
                      {(sec.notes || []).map((note, nIdx) => (
                        <FormattedNoteItem key={nIdx} content={note} bulletColor="text-[#7456E8]" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* End of Notes Completion Card */}
          <div
            className="mt-10 pt-6 pb-2 print:hidden border-t flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderColor: 'rgba(220, 212, 255, 0.7)' }}
          >
            <div className="flex items-center gap-2.5 text-xs">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#242238] block text-xs sm:text-sm">You've reached the end of this study guide</span>
                <span className="text-[11px] text-[#8E8BA8]">Review active recall cues or test in Practice &amp; Flashcards</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {onSendToFlashcards && (
                <button
                  type="button"
                  onClick={() => onSendToFlashcards(notes)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all cursor-pointer shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Practice Flashcards</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleBringToTop}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm hover:-translate-y-0.5 transition-all"
                title="Bring back to the top of the study notebook"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Bring to Top</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bring to Top Floating Action Button (FAB) with Circular Progress Ring mounted directly to body ── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[9999] print:hidden transition-all duration-300 ${
              showBringToTop
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 translate-y-6 scale-90 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={handleBringToTop}
              className="group flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full text-white cursor-pointer shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(36, 34, 56, 0.95) 0%, rgba(116, 86, 232, 0.96) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(220, 212, 255, 0.5)',
                boxShadow: '0 12px 32px -4px rgba(116, 86, 232, 0.5), inset 0 1px 1.5px rgba(255, 255, 255, 0.35)',
              }}
              title="Bring to Top of Lecture Notes"
              aria-label="Bring to top"
            >
              {/* Circular Scroll Progress Ring */}
              <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 -rotate-90 transform" viewBox="0 0 36 36">
                  {/* Background circle track */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="3"
                  />
                  {/* Animated Progress stroke */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#DCD4FF"
                    strokeWidth="3"
                    strokeDasharray="94.25"
                    strokeDashoffset={94.25 - (scrollProgress / 100) * 94.25}
                    strokeLinecap="round"
                    className="transition-all duration-150"
                  />
                </svg>
                <ArrowUp className="w-3.5 h-3.5 text-white absolute inset-0 m-auto group-hover:-translate-y-0.5 transition-transform duration-200" />
              </div>

              <div className="flex flex-col text-left leading-none">
                <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1">
                  <span>Bring to Top</span>
                </span>
                <span className="text-[10px] font-medium text-violet-200/90 mt-0.5">
                  {scrollProgress}% read
                </span>
              </div>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
