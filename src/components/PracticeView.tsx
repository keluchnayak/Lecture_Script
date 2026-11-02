import React, { useState, useMemo } from 'react';
import {
  Brain,
  CheckCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Award,
  Sliders,
  Target
} from 'lucide-react';
import { LectureNotes, ActiveRecallQuestion, ExamTrapItem, FormulaItem } from '../types';
import { NavRoute } from './Sidebar';
import { renderInlineMarkdown } from './FormattedText';
import { useAuth } from '../context/AuthContext';
import { syncManager } from '../utils/syncManager';

export interface PracticeQuestionItem {
  id: string;
  category: 'recall' | 'trap' | 'formula';
  badge: string;
  question: string;
  answerKey: string;
}

interface PracticeViewProps {
  notes: LectureNotes | null;
  savedNotes?: LectureNotes[];
  onSelectLecture?: (lecture: LectureNotes) => void;
  onNavigate: (route: NavRoute) => void;
}

// Built-in starter questions if no lecture has been generated yet
const DEFAULT_PRACTICE_ITEMS: PracticeQuestionItem[] = [
  {
    id: 'starter-1',
    category: 'recall',
    badge: 'Active Recall',
    question: 'What is the fundamental difference between Concurrency and Parallelism in computer systems?',
    answerKey:
      'Concurrency is about dealing with lots of things at once (structure, time-slicing on a single CPU core). Parallelism is about doing lots of things simultaneously (multi-core physical execution).',
  },
  {
    id: 'starter-2',
    category: 'trap',
    badge: 'Exam Trap',
    question:
      'Common Exam Trap: Amdahl’s Law Limits\n\nWhy does Amdahl’s Law state that adding infinite CPU cores cannot produce infinite speedup? How should you answer on an exam for full credit?',
    answerKey:
      '**Common Mistake:** Assuming performance scales linearly with infinite cores.\n\n**Full Credit Answer:** The strictly sequential fraction of the program `(1 - p)` cannot be parallelized and sets an absolute upper limit on maximum theoretical speedup: `S_max = 1 / (1 - p)`.',
  },
  {
    id: 'starter-3',
    category: 'formula',
    badge: 'Key Definition',
    question:
      'Define HTTP Idempotency:\n\nWhy are HTTP PUT and DELETE requests idempotent while POST requests are non-idempotent?',
    answerKey:
      '**Idempotency Invariant:** `f(f(x)) = f(x)`. PUT replaces the target resource state, producing the exact same state upon repeated requests. POST creates new subordinate resources each time, risking duplicate entries upon network retry.',
  },
  {
    id: 'starter-4',
    category: 'recall',
    badge: 'Active Recall',
    question: 'How does Node.js handle high-concurrency I/O despite being single-threaded?',
    answerKey:
      'Through the libuv event loop. Synchronous code executes on the single main thread, while non-blocking I/O operations are offloaded to OS kernel polling and background worker pools.',
  },
];

export const PracticeView: React.FC<PracticeViewProps> = ({
  notes,
  savedNotes = [],
  onSelectLecture,
  onNavigate,
}) => {
  const { user } = useAuth();
  // Determine active lecture: Current studio note, or first saved library note
  const [selectedSavedIndex, setSelectedSavedIndex] = useState<number>(0);

  const activeLecture = useMemo<LectureNotes | null>(() => {
    if (notes) return notes;
    if (savedNotes.length > 0) return savedNotes[selectedSavedIndex] || savedNotes[0];
    return null;
  }, [notes, savedNotes, selectedSavedIndex]);

  // Aggregate questions across activeRecallQuestions, examTrapsAndAlerts, and keyFormulasOrDefinitions
  const allQuestions: PracticeQuestionItem[] = useMemo(() => {
    if (!activeLecture) return DEFAULT_PRACTICE_ITEMS;

    const items: PracticeQuestionItem[] = [];

    // 1. Active Recall Questions (3-5 items)
    if (activeLecture.activeRecallQuestions?.length) {
      activeLecture.activeRecallQuestions.forEach((q, idx) => {
        items.push({
          id: `recall-${idx}`,
          category: 'recall',
          badge: 'Active Recall',
          question: q.question,
          answerKey: q.answerKey,
        });
      });
    }

    // 2. Exam Traps & Pitfalls (3-5 items)
    if (activeLecture.examTrapsAndAlerts?.length) {
      activeLecture.examTrapsAndAlerts.forEach((trap, idx) => {
        items.push({
          id: `trap-${idx}`,
          category: 'trap',
          badge: 'Exam Trap',
          question: `Common Exam Trap: ${trap.topic}\n\nWhat mistake do students commonly make when answering this concept, and what is the full-credit approach?`,
          answerKey: `**Common Student Trap:**\n${trap.trapDescription}\n\n**How to Answer for Full Credit:**\n${trap.howToAnswerInExam}`,
        });
      });
    }

    // 3. Key Formulas & Definitions (3-6 items)
    if (activeLecture.keyFormulasOrDefinitions?.length) {
      activeLecture.keyFormulasOrDefinitions.forEach((f, idx) => {
        items.push({
          id: `formula-${idx}`,
          category: 'formula',
          badge: 'Formula & Term',
          question: `Define and state the formula or significance of: **${f.term}**\n\nHow is it applied in exams?`,
          answerKey: `**Definition / Formula:**\n${f.formulaOrDefinition}\n\n**Application Context:**\n${f.context}${
            f.examSignificance ? `\n\n**Why it Matters on Tests:**\n${f.examSignificance}` : ''
          }`,
        });
      });
    }

    return items.length > 0 ? items : DEFAULT_PRACTICE_ITEMS;
  }, [activeLecture]);

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'recall' | 'trap' | 'formula'>('all');
  const [reviewOnlyMissed, setReviewOnlyMissed] = useState(false);

  // Question mastery tracking: cardId -> 'mastered' | 'missed'
  const [questionScores, setQuestionScores] = useState<Record<string, 'mastered' | 'missed'>>({});

  // Filtered questions based on category & review-only mode
  const activeQuestionsList = useMemo(() => {
    let list = allQuestions;

    if (reviewOnlyMissed) {
      list = list.filter((q) => questionScores[q.id] === 'missed');
    } else if (selectedCategory !== 'all') {
      list = list.filter((q) => q.category === selectedCategory);
    }

    return list.length > 0 ? list : allQuestions;
  }, [allQuestions, selectedCategory, reviewOnlyMissed, questionScores]);

  // Practice navigation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Safe current question reference
  const currentQ = activeQuestionsList[currentIndex] || activeQuestionsList[0];
  const currentStatus = currentQ ? questionScores[currentQ.id] : undefined;

  // Counts for scoring summary
  const masteredCount = useMemo(() => {
    return allQuestions.filter((q) => questionScores[q.id] === 'mastered').length;
  }, [allQuestions, questionScores]);

  const missedCount = useMemo(() => {
    return allQuestions.filter((q) => questionScores[q.id] === 'missed').length;
  }, [allQuestions, questionScores]);

  const handleNext = () => {
    if (currentIndex + 1 < activeQuestionsList.length) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowAnswer(false);
    }
  };

  // Active Assessment Handlers: Missed vs Mastered
  const handleMarkQuestion = (status: 'mastered' | 'missed') => {
    if (!currentQ) return;
    setQuestionScores((prev) => ({
      ...prev,
      [currentQ.id]: status,
    }));
    if (user?.id) {
      syncManager.savePracticeProgress(
        user.id,
        activeLecture?.id || activeLecture?.clientId || null,
        currentQ.id,
        status
      );
      syncManager.logStudyActivity(user.id, 45);
    }
    handleNext();
  };

  const handleRestart = (onlyMissed = false) => {
    if (onlyMissed) {
      setReviewOnlyMissed(true);
    } else {
      setReviewOnlyMissed(false);
      setQuestionScores({});
    }
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsFinished(false);
  };

  // Badge styles helper
  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'trap':
        return {
          bg: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #FCD34D',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'formula':
        return {
          bg: '#E0E7FF',
          color: '#3730A3',
          border: '1px solid #C7D2FE',
          icon: <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />,
        };
      default:
        return {
          bg: 'rgba(220, 212, 255, 0.7)',
          color: 'var(--color-primary-dark)',
          border: '1px solid rgba(184, 168, 255, 0.6)',
          icon: <Brain className="w-3.5 h-3.5 text-violet-600" />,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16 animate-fadeIn">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2"
            style={{
              background: 'rgba(220, 212, 255, 0.7)',
              color: 'var(--color-primary-dark)',
              border: '1px solid rgba(184, 168, 255, 0.6)',
            }}
          >
            <Brain className="w-3.5 h-3.5 text-violet-600" />
            <span>Active Recall Practice &amp; Self-Test</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242238]">
            Practice Questions
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6888] mt-1">
            {activeLecture
              ? `Testing from "${activeLecture.title}" (${activeQuestionsList.length} total questions)`
              : 'Showing sample questions. Create notes in Study Studio to practice your own class material!'}
          </p>
        </div>

        {/* Quick action button */}
        {!notes && (
          <button
            onClick={() => onNavigate('studio')}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Study Studio</span>
          </button>
        )}
      </div>

      {/* ── Optional simple lecture selector if user has saved notes in library ── */}
      {!notes && savedNotes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#6B6888] font-semibold shrink-0">Practice from:</span>
          {savedNotes.map((sn, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedSavedIndex(idx);
                setCurrentIndex(0);
                setShowAnswer(false);
                setIsFinished(false);
                setQuestionScores({});
                setReviewOnlyMissed(false);
                if (onSelectLecture) onSelectLecture(sn);
              }}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                selectedSavedIndex === idx
                  ? 'bg-violet-600 text-white font-bold shadow-xs'
                  : 'bg-white text-[#242238] border border-violet-200 hover:bg-violet-50'
              }`}
            >
              {sn.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Category Filter Pills & Mode ── */}
      {!isFinished && allQuestions.length > 4 && (
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedCategory('all');
                setReviewOnlyMissed(false);
                setCurrentIndex(0);
                setShowAnswer(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedCategory === 'all' && !reviewOnlyMissed
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white/80 text-[#6B6888] border border-violet-100 hover:bg-violet-50'
              }`}
            >
              All Questions ({allQuestions.length})
            </button>
            <button
              onClick={() => {
                setSelectedCategory('recall');
                setReviewOnlyMissed(false);
                setCurrentIndex(0);
                setShowAnswer(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedCategory === 'recall' && !reviewOnlyMissed
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white/80 text-[#6B6888] border border-violet-100 hover:bg-violet-50'
              }`}
            >
              Recall ({allQuestions.filter((q) => q.category === 'recall').length})
            </button>
            <button
              onClick={() => {
                setSelectedCategory('trap');
                setReviewOnlyMissed(false);
                setCurrentIndex(0);
                setShowAnswer(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedCategory === 'trap' && !reviewOnlyMissed
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white/80 text-[#6B6888] border border-violet-100 hover:bg-amber-50'
              }`}
            >
              Exam Traps ({allQuestions.filter((q) => q.category === 'trap').length})
            </button>
            <button
              onClick={() => {
                setSelectedCategory('formula');
                setReviewOnlyMissed(false);
                setCurrentIndex(0);
                setShowAnswer(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedCategory === 'formula' && !reviewOnlyMissed
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white/80 text-[#6B6888] border border-violet-100 hover:bg-indigo-50'
              }`}
            >
              Formulas ({allQuestions.filter((q) => q.category === 'formula').length})
            </button>
          </div>

          {/* Quick Score Tally Pill */}
          <div className="flex items-center gap-2 text-[11px] shrink-0 font-medium text-[#6B6888]">
            <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {masteredCount}
            </span>
            <span className="flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              <XCircle className="w-3 h-3 text-amber-600" />
              {missedCount}
            </span>
          </div>
        </div>
      )}

      {/* ── Progress Counter ── */}
      {!isFinished && (
        <div className="flex items-center justify-between text-xs font-semibold text-[#6B6888] px-1">
          <span>
            Question {currentIndex + 1} of {activeQuestionsList.length}
          </span>
          <div className="w-48 h-2 bg-violet-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300 rounded-full"
              style={{ width: `${((currentIndex + 1) / activeQuestionsList.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Main Practice Card ── */}
      {isFinished ? (
        /* Finished State / Scorecard */
        <div
          className="glass-panel-elevated rounded-3xl p-8 sm:p-10 border text-center space-y-6 animate-fadeIn"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8F6FF 100%)',
            borderColor: 'rgba(220, 212, 255, 0.85)',
            boxShadow: '0 20px 40px -10px rgba(116, 86, 232, 0.12)',
          }}
        >
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
            <Award className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#242238]">
              Practice Session Completed!
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6888] mt-1.5 max-w-md mx-auto leading-relaxed">
              You reviewed {activeQuestionsList.length} exam-grade practice questions from this lecture.
            </p>
          </div>

          {/* Scorecard Metrics */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
            <div className="p-4 rounded-2xl bg-white border border-violet-100 shadow-xs text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6888] block">
                Reviewed
              </span>
              <span className="text-2xl font-black text-[#242238] mt-1 block">
                {activeQuestionsList.length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                Mastered
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {masteredCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                Review Needed
              </span>
              <span className="text-2xl font-black text-amber-800 mt-1 block">
                {missedCount}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            {missedCount > 0 && (
              <button
                onClick={() => handleRestart(true)}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer shadow-md"
              >
                <Target className="w-4 h-4" />
                <span>Drill Missed Questions ({missedCount})</span>
              </button>
            )}

            <button
              onClick={() => handleRestart(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Practice All Again</span>
            </button>

            <button
              onClick={() => onNavigate('studio')}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#6B6888] hover:text-[#242238] bg-white border border-violet-200 cursor-pointer"
            >
              Back to Studio
            </button>
          </div>
        </div>
      ) : (
        /* Active Question Card */
        <div
          className="glass-panel-elevated rounded-3xl p-6 sm:p-8 border min-h-[340px] flex flex-col justify-between transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 246, 255, 0.95) 100%)',
            borderColor: 'rgba(220, 212, 255, 0.8)',
            boxShadow: '0 16px 36px -6px rgba(116, 86, 232, 0.1)',
          }}
        >
          <div>
            {/* Top Category Badge & Current Status */}
            <div className="flex items-center justify-between gap-2 mb-3">
              {currentQ && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{
                    background: getBadgeStyle(currentQ.category).bg,
                    color: getBadgeStyle(currentQ.category).color,
                    border: getBadgeStyle(currentQ.category).border,
                  }}
                >
                  {getBadgeStyle(currentQ.category).icon}
                  <span>{currentQ.badge}</span>
                </div>
              )}

              {currentStatus && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    currentStatus === 'mastered'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {currentStatus === 'mastered' ? '✓ Mastered' : '⚠ Review Again'}
                </span>
              )}
            </div>

            {/* Question Text */}
            <h2 className="text-lg sm:text-xl font-bold text-[#242238] leading-snug whitespace-pre-line">
              {currentQ ? renderInlineMarkdown(currentQ.question) : ''}
            </h2>

            {/* Answer Box */}
            {showAnswer ? (
              <div
                className="mt-6 p-5 rounded-2xl border text-sm sm:text-base leading-relaxed animate-fadeIn"
                style={{
                  background: 'rgba(240, 253, 244, 0.9)',
                  borderColor: '#A7F3D0',
                  color: '#166534',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Answer Key &amp; Core Mechanism</span>
                </div>
                <div className="font-medium text-[#1c1917] leading-relaxed whitespace-pre-line">
                  {currentQ ? renderInlineMarkdown(currentQ.answerKey) : ''}
                </div>
              </div>
            ) : (
              <div
                onClick={() => setShowAnswer(true)}
                className="mt-8 p-6 rounded-2xl border border-dashed border-violet-200 text-center bg-white/50 hover:bg-violet-50/50 transition-all cursor-pointer group"
              >
                <Eye className="w-5 h-5 text-violet-500 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-violet-700 block">
                  Click to Reveal Answer
                </span>
                <span className="text-[11px] text-[#6B6888] mt-0.5 block">
                  Test your active memory first before checking the key.
                </span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="mt-8 pt-4 border-t border-violet-100 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentIndex === 0
                  ? 'opacity-40 cursor-not-allowed text-gray-400'
                  : 'text-[#6B6888] hover:text-[#242238] hover:bg-violet-50'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Middle: Active Assessment Buttons when Answer is Revealed */}
            {showAnswer ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkQuestion('missed')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all cursor-pointer shadow-xs"
                  title="Mark this question as needing more practice"
                >
                  <XCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Missed / Review Again</span>
                </button>
                <button
                  onClick={() => handleMarkQuestion('mastered')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all cursor-pointer shadow-xs"
                  title="Mark this question as mastered"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Got It! (Mastered)</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAnswer(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show Answer</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer hover:shadow-lg transition-all"
            >
              <span>{currentIndex + 1 === activeQuestionsList.length ? 'Finish' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
