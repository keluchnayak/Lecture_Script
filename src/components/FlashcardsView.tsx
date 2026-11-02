import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Sparkles,
  Plus,
  Search,
  BookOpen,
  Upload,
  FileText,
  Check,
  RotateCw,
  Trash2,
  Edit3,
  Play,
  ArrowLeft,
  ArrowRight,
  Flame,
  Award,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  Shuffle,
  Eye,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { FlashcardDeck, FlashcardItem, LectureNotes } from '../types';
import { NavRoute } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { localDB } from '../utils/dbStorage';
import { syncManager } from '../utils/syncManager';
import { apiFetch } from '../utils/apiClient';

// Curated default starter decks so user has an instantly engaging experience
const STARTER_DECKS: FlashcardDeck[] = [
  {
    id: 'starter-distributed-systems',
    title: 'Distributed Systems & Microservices',
    subject: 'Computer Science',
    description: 'Amdahl’s law, idempotency keys, client-server decoupling, and node latency limits.',
    colorTheme: 'lavender',
    createdAt: 'Oct 30, 2026',
    lastStudiedAt: 'Today',
    sourceType: 'lecture',
    sourceTitle: 'Distributed Systems & Client-Server Architecture',
    cards: [
      {
        id: 'ds-1',
        front: "What is the core premise of client-server decoupling?",
        back: "Separating presentation state (client) from business logic & storage (server). Enforces the untrusted client security rule and enables independent scaling.",
        tag: 'Core Concept',
        known: true,
      },
      {
        id: 'ds-2',
        front: "Why is POST non-idempotent whereas PUT is idempotent?",
        back: "PUT replaces the resource state completely (f(f(x)) = f(x)). POST creates a new subordinate resource; re-transmitting it creates duplicate entries.",
        tag: 'Exam Trap',
        known: true,
      },
      {
        id: 'ds-3',
        front: "What does Amdahl’s Law define regarding system speedup?",
        back: "Speedup is bounded by the serial non-parallelizable fraction (1 - p). As cores -> infinity, maximum theoretical speedup = 1 / (1 - p).",
        tag: 'Formula',
        known: false,
      },
      {
        id: 'ds-4',
        front: "How does Node.js achieve high concurrency on a single JavaScript thread?",
        back: "Through the libuv event loop. Synchronous JS executes on the main thread, while non-blocking I/O is offloaded to OS kernel polling and worker pools.",
        tag: 'Mechanism',
        known: true,
      },
      {
        id: 'ds-5',
        front: "Why are network timeouts critical when dealing with financial transactions?",
        back: "A network timeout does not mean failure—the server may have processed the charge. Idempotency keys (UUIDs) prevent double-charging on automated retry.",
        tag: 'High-Yield',
        known: false,
      },
    ],
  },
  {
    id: 'starter-organic-chemistry',
    title: 'SN1 vs SN2 Reaction Mechanisms',
    subject: 'Organic Chemistry',
    description: 'Substrate steric hindrance, solvent polarity, carbocation intermediates, and stereochemistry.',
    colorTheme: 'sunset',
    createdAt: 'Oct 29, 2026',
    lastStudiedAt: 'Yesterday',
    sourceType: 'lecture',
    sourceTitle: 'Organic Chemistry: SN1 vs SN2 Mechanisms',
    cards: [
      {
        id: 'chem-1',
        front: "What is the substrate reactivity order for SN2 reactions?",
        back: "Methyl > 1° > 2° >>> 3°. Tertiary substrates cannot undergo SN2 due to steric hindrance blocking backside nucleophilic attack.",
        tag: 'High-Yield',
        known: true,
      },
      {
        id: 'chem-2',
        front: "What stereochemical outcome characterizes an SN2 displacement?",
        back: "Walden inversion of configuration (100% stereochemical inversion) due to backside attack at 180° to the leaving group.",
        tag: 'Core Concept',
        known: true,
      },
      {
        id: 'chem-3',
        front: "Why do polar protic solvents favor SN1 over SN2?",
        back: "Protic solvents (H2O, EtOH) stabilize the leaving group anion and carbocation intermediate via hydrogen bonding, lowering activation energy.",
        tag: 'Mechanism',
        known: false,
      },
      {
        id: 'chem-4',
        front: "What is the rate equation for an SN1 reaction?",
        back: "Rate = k[Substrate]. It is unimolecular because the rate-determining step is heterolytic cleavage forming the carbocation intermediate.",
        tag: 'Formula',
        known: true,
      },
    ],
  },
];

interface FlashcardsViewProps {
  savedNotes: LectureNotes[];
  onNavigate: (route: NavRoute) => void;
  preselectedLecture?: LectureNotes | null;
  onClearPreselectedLecture?: () => void;
  apiKey?: string;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  savedNotes,
  onNavigate,
  preselectedLecture,
  onClearPreselectedLecture,
  apiKey,
}) => {
  const { user } = useAuth();

  // ── Persistent Decks State (User-scoped & Local-first) ──
  const [decks, setDecks] = useState<FlashcardDeck[]>(STARTER_DECKS);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      localDB.getDecks(user.id).then((saved) => {
        if (mounted && saved && saved.length > 0) {
          setDecks(saved);
        } else if (mounted) {
          setDecks(STARTER_DECKS);
        }
      });
    } else {
      // Guest: memory starter decks
      setDecks(STARTER_DECKS);
    }
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const saveDecksToStorage = (updatedDecks: FlashcardDeck[]) => {
    setDecks(updatedDecks);
    if (user?.id) {
      localDB.saveDecks(user.id, updatedDecks);
    }
  };

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState('');

  // ── Study Mode State ──
  const [activeDeckForStudy, setActiveDeckForStudy] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCards, setStudiedCards] = useState<{ [cardId: string]: 'known' | 'review' }>({});
  const [studyStreak, setStudyStreak] = useState(0);
  const [isDeckCompleted, setIsDeckCompleted] = useState(false);
  const [onlyReviewMissedMode, setOnlyReviewMissedMode] = useState(false);
  const [studyCardsList, setStudyCardsList] = useState<FlashcardItem[]>([]);

  // ── Creation Modal / Screen State ──
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creationStep, setCreationStep] = useState<'source' | 'preview'>('source');
  const [sourceType, setSourceType] = useState<'lecture' | 'file' | 'text'>('lecture');
  
  // Creation fields
  const [selectedLectureIndex, setSelectedLectureIndex] = useState<number>(0);
  const [textInput, setTextInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileText, setUploadedFileText] = useState('');
  const [deckTitle, setDeckTitle] = useState('');
  const [deckSubject, setDeckSubject] = useState('');
  const [deckTheme, setDeckTheme] = useState<'lavender' | 'sunset' | 'matcha' | 'cyber' | 'amber'>('lavender');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Preview / Editable Cards
  const [previewCards, setPreviewCards] = useState<FlashcardItem[]>([]);

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Check if Preselected Lecture passed from Study Studio ──
  useEffect(() => {
    if (preselectedLecture) {
      setIsCreateModalOpen(true);
      setSourceType('lecture');
      setDeckTitle(`${preselectedLecture.title} Flashcards`);
      setDeckSubject(preselectedLecture.subject);
      // Auto generate cards from this lecture
      generateCardsFromLecture(preselectedLecture);
      if (onClearPreselectedLecture) onClearPreselectedLecture();
    }
  }, [preselectedLecture]);

  // ── Extract high-yield cards from a LectureNotes object ──
  const generateCardsFromLecture = (lecture: LectureNotes) => {
    const extracted: FlashcardItem[] = [];

    // 1. From Active Recall Questions
    if (lecture.activeRecallQuestions?.length) {
      lecture.activeRecallQuestions.forEach((q, idx) => {
        extracted.push({
          id: `recall-${Date.now()}-${idx}`,
          front: q.question,
          back: q.answerKey,
          tag: 'High-Yield',
        });
      });
    }

    // 2. From Key Formulas & Definitions
    if (lecture.keyFormulasOrDefinitions?.length) {
      lecture.keyFormulasOrDefinitions.forEach((f, idx) => {
        extracted.push({
          id: `formula-${Date.now()}-${idx}`,
          front: `Define or write the formula for: ${f.term}`,
          back: `${f.formulaOrDefinition}\n\nContext: ${f.context}${f.examSignificance ? `\n\nExam Note: ${f.examSignificance}` : ''}`,
          tag: 'Formula / Def',
        });
      });
    }

    // 3. From Exam Traps & Alerts
    if (lecture.examTrapsAndAlerts?.length) {
      lecture.examTrapsAndAlerts.forEach((trap, idx) => {
        extracted.push({
          id: `trap-${Date.now()}-${idx}`,
          front: `Exam Trap Alert: ${trap.topic}\nWhat mistake do students commonly make?`,
          back: `Trap: ${trap.trapDescription}\n\nCorrect Exam Approach: ${trap.howToAnswerInExam}`,
          tag: 'Exam Trap',
        });
      });
    }

    // 4. From Cornell sections (All sections to preserve 100% of concept cards)
    if (lecture.cornellSections?.length) {
      lecture.cornellSections.forEach((sec, idx) => {
        extracted.push({
          id: `cornell-${Date.now()}-${idx}`,
          front: sec.cue,
          back: sec.notes.join('\n• '),
          tag: sec.tag || 'Core Concept',
        });
      });
    }

    if (extracted.length > 0) {
      setPreviewCards(extracted);
      setCreationStep('preview');
      showToast(`Generated ${extracted.length} high-yield cards from "${lecture.title}"!`);
    } else {
      // Fallback: AI call with overview
      callAiToGenerate(lecture.title, lecture.subject, lecture.overview);
    }
  };

  // ── AI Flashcard Generation Endpoint Call ──
  const callAiToGenerate = async (title: string, subject: string, content: string) => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await apiFetch('/api/generate-flashcards', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subject,
          content,
          userApiKey: apiKey || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate flashcards (${response.status})`);
      }

      const data = await response.json();
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        setPreviewCards(data.cards);
        setCreationStep('preview');
        showToast(`✨ Generated ${data.cards.length} smart study cards!`);
      } else {
        throw new Error('No flashcards returned by AI.');
      }
    } catch (err: any) {
      console.error('Error generating cards:', err);
      // Fallback local heuristic cards
      const fallbackCards: FlashcardItem[] = [
        {
          id: `card-${Date.now()}-1`,
          front: `What is the central focus of ${title || subject || 'this topic'}?`,
          back: content.slice(0, 200) || 'Core principles and definitions discussed in the study material.',
          tag: 'Core Concept',
        },
        {
          id: `card-${Date.now()}-2`,
          front: 'What key formula or terminology is critical for the exam?',
          back: 'Review the high-yield mechanisms, standard definitions, and practical problem-solving applications.',
          tag: 'High-Yield',
        },
        {
          id: `card-${Date.now()}-3`,
          front: 'What common misconception or exam trap should you avoid?',
          back: 'Carefully verify assumptions, units, and definitions before concluding your answer.',
          tag: 'Exam Trap',
        },
      ];
      setPreviewCards(fallbackCards);
      setCreationStep('preview');
      showToast('Loaded instant study cards.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Handle Source Submission ──
  const handleProceedFromSource = () => {
    if (sourceType === 'lecture') {
      const currentLecture = savedNotes[selectedLectureIndex];
      if (!currentLecture) {
        setGenerationError('Please select a saved lecture from your library.');
        return;
      }
      setDeckTitle(currentLecture.title);
      setDeckSubject(currentLecture.subject);
      generateCardsFromLecture(currentLecture);
    } else if (sourceType === 'text') {
      if (!textInput.trim() || textInput.length < 15) {
        setGenerationError('Please paste at least 15 characters of notes or transcript.');
        return;
      }
      const title = deckTitle.trim() || 'Study Notes Deck';
      const subject = deckSubject.trim() || 'General Study';
      setDeckTitle(title);
      setDeckSubject(subject);
      callAiToGenerate(title, subject, textInput);
    } else if (sourceType === 'file') {
      if (!uploadedFileText.trim()) {
        setGenerationError('Please upload a document (.txt, .md, .vtt, .srt) or choose another source.');
        return;
      }
      const title = deckTitle.trim() || uploadedFileName.replace(/\.[^/.]+$/, '') || 'Document Deck';
      const subject = deckSubject.trim() || 'Class Material';
      setDeckTitle(title);
      setDeckSubject(subject);
      callAiToGenerate(title, subject, uploadedFileText);
    }
  };

  // ── Handle File Upload ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    if (!deckTitle) {
      setDeckTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedFileText(content || '');
    };
    reader.readAsText(file);
  };

  // ── Editable Preview Card Handlers ──
  const handleUpdateCard = (id: string, field: 'front' | 'back' | 'tag', value: string) => {
    setPreviewCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleDeletePreviewCard = (id: string) => {
    setPreviewCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCustomCard = () => {
    const newCard: FlashcardItem = {
      id: `custom-${Date.now()}`,
      front: 'New Question / Concept Prompt',
      back: 'Explanation or Answer here...',
      tag: 'Custom',
    };
    setPreviewCards((prev) => [...prev, newCard]);
  };

  // ── Final Save Deck to Storage ──
  const handleSaveDeck = () => {
    if (previewCards.length === 0) {
      setGenerationError('A deck must have at least one card.');
      return;
    }

    const newDeck: FlashcardDeck = {
      id: `deck-${Date.now()}`,
      title: deckTitle.trim() || 'Untitled Deck',
      subject: deckSubject.trim() || 'General Study',
      cards: previewCards,
      colorTheme: deckTheme,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      sourceType: sourceType,
      sourceTitle: sourceType === 'lecture' ? savedNotes[selectedLectureIndex]?.title : uploadedFileName,
    };

    saveDecksToStorage([newDeck, ...decks]);
    if (user?.id) {
      syncManager.saveDeck(user.id, newDeck);
    }
    setIsCreateModalOpen(false);
    setCreationStep('source');
    setPreviewCards([]);
    setTextInput('');
    setUploadedFileText('');
    setUploadedFileName('');
    setDeckTitle('');
    setDeckSubject('');
    showToast(`🎉 Deck "${newDeck.title}" saved! Ready to study.`);
  };

  // ── Delete a Saved Deck ──
  const handleDeleteDeck = (deckId: string) => {
    const updated = decks.filter((d) => d.id !== deckId);
    saveDecksToStorage(updated);
    if (user?.id) {
      syncManager.deleteDeck(user.id, deckId);
    }
    showToast('Deck removed from your collection.');
  };

  // ── Start Study Session ──
  const handleStartStudy = (deck: FlashcardDeck, reviewMissedOnly: boolean = false) => {
    setActiveDeckForStudy(deck);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudiedCards({});
    setStudyStreak(0);
    setIsDeckCompleted(false);
    setOnlyReviewMissedMode(reviewMissedOnly);

    if (reviewMissedOnly) {
      const missed = deck.cards.filter((c) => c.known === false);
      setStudyCardsList(missed.length > 0 ? missed : deck.cards);
    } else {
      setStudyCardsList(deck.cards);
    }

    // Update lastStudiedAt on the deck
    const updated = decks.map((d) =>
      d.id === deck.id ? { ...d, lastStudiedAt: 'Just now' } : d
    );
    saveDecksToStorage(updated);
  };

  // ── Study Mode Action Handlers ──
  const handleFlipCard = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleCardAssessment = (status: 'known' | 'review') => {
    if (!activeDeckForStudy) return;

    const currentCard = studyCardsList[currentCardIndex];
    if (!currentCard) return;

    // Record assessment
    setStudiedCards((prev) => ({ ...prev, [currentCard.id]: status }));

    if (status === 'known') {
      setStudyStreak((s) => s + 1);
    } else {
      setStudyStreak(0);
    }

    // Update the card's known status in the persistent deck
    const updatedDecks = decks.map((d) => {
      if (d.id === activeDeckForStudy.id) {
        return {
          ...d,
          cards: d.cards.map((c) =>
            c.id === currentCard.id ? { ...c, known: status === 'known' } : c
          ),
        };
      }
      return d;
    });
    saveDecksToStorage(updatedDecks);

    if (user?.id) {
      syncManager.saveFlashcardProgress(
        user.id,
        currentCard.id,
        status === 'known' ? 'known' : 'learning'
      );
      syncManager.logStudyActivity(user.id, 20);
    }

    // Advance to next card or complete
    if (currentCardIndex + 1 < studyCardsList.length) {
      setIsFlipped(false);
      setCurrentCardIndex((i) => i + 1);
    } else {
      setIsDeckCompleted(true);
    }
  };

  // ── Keyboard Shortcuts for Study Mode ──
  useEffect(() => {
    if (!activeDeckForStudy || isDeckCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleFlipCard();
      } else if (e.key === '1' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleCardAssessment('review');
      } else if (e.key === '2' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleCardAssessment('known');
      } else if (e.code === 'Escape') {
        setActiveDeckForStudy(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDeckForStudy, isDeckCompleted, currentCardIndex, isFlipped, studyCardsList]);

  // ── Filtered Decks ──
  const filteredDecks = useMemo(() => {
    if (!searchQuery.trim()) return decks;
    const q = searchQuery.toLowerCase();
    return decks.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
    );
  }, [decks, searchQuery]);

  // ── Recently Studied / "Continue Studying" Shelf ──
  const recentlyStudiedDecks = useMemo(() => {
    return decks.slice(0, 3);
  }, [decks]);

  // ──────────────────────────────────────────────
  // ── FULLSCREEN STUDY MODE VIEW
  // ──────────────────────────────────────────────
  if (activeDeckForStudy) {
    const currentCard = studyCardsList[currentCardIndex];
    const totalCards = studyCardsList.length;
    const progressPercent = Math.round(((currentCardIndex + 1) / totalCards) * 100);

    const knownCount = Object.values(studiedCards).filter((v) => v === 'known').length;
    const reviewCount = Object.values(studiedCards).filter((v) => v === 'review').length;

    return (
      <div className="max-w-4xl mx-auto pb-16 space-y-6">
        {/* Top Study Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setActiveDeckForStudy(null)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#6B6888] hover:text-[#242238] bg-white/70 hover:bg-white border border-violet-200 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Study</span>
          </button>

          {/* Title & Progress info */}
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100/80 px-2.5 py-0.5 rounded-full">
              {activeDeckForStudy.subject}
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-[#242238] mt-0.5">
              {activeDeckForStudy.title}
            </h2>
          </div>

          {/* Streak pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200/80">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Streak {studyStreak}</span>
          </div>
        </div>

        {/* ── Progress Rail ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6B6888] font-medium px-1">
            <span>
              Card {currentCardIndex + 1} of {totalCards}
            </span>
            <span className="font-semibold text-violet-700">{progressPercent}% Completed</span>
          </div>
          <div className="w-full h-2 rounded-full bg-violet-100 overflow-hidden border border-violet-200/60">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── DECK COMPLETED SCREEN ── */}
        {isDeckCompleted ? (
          <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center border border-violet-200 max-w-lg mx-auto shadow-xl space-y-6 animate-celebrate">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-violet-500 flex items-center justify-center text-white mx-auto shadow-lg">
              <Award className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-100 px-3 py-1 rounded-full">
                Session Complete ✨
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-[#242238] mt-3">
                {knownCount >= totalCards * 0.8
                  ? 'Brain Unlocked! 🧠⚡'
                  : 'Great Practice Session! 📚'}
              </h3>
              <p className="text-sm text-[#6B6888] mt-1.5">
                You studied all {totalCards} cards in this deck.
              </p>
            </div>

            {/* Stats Pills */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <span className="text-2xl font-black block">{knownCount}</span>
                <span className="text-xs font-medium">Mastered ("I knew it")</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                <span className="text-2xl font-black block">{reviewCount}</span>
                <span className="text-xs font-medium">Review Again</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleStartStudy(activeDeckForStudy, false)}
                className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Study All Again</span>
              </button>

              {reviewCount > 0 && (
                <button
                  onClick={() => handleStartStudy(activeDeckForStudy, true)}
                  className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-amber-300 text-amber-800"
                >
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Review {reviewCount} Missed Cards</span>
                </button>
              )}

              <button
                onClick={() => setActiveDeckForStudy(null)}
                className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <span>Back to Decks</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── ACTIVE CARD 3D FLIP CONTAINER ── */
          currentCard && (
            <div className="space-y-6">
              <div
                className="flashcard-perspective w-full h-[360px] sm:h-[400px] cursor-pointer select-none group"
                onClick={handleFlipCard}
              >
                <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                  {/* ── CARD FRONT (QUESTION / PROMPT) ── */}
                  <div
                    className="flashcard-face p-8 sm:p-10 flex flex-col justify-between border-2 transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(20px)',
                      borderColor: 'rgba(206, 192, 255, 0.85)',
                      boxShadow: '0 20px 45px -10px rgba(116, 86, 232, 0.16), 0 4px 12px rgba(36, 34, 56, 0.05)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                        {currentCard.tag || 'Prompt'}
                      </span>
                      <span className="text-xs text-[#6B6888] font-medium flex items-center gap-1 group-hover:text-violet-600 transition-colors">
                        <RotateCw className="w-3.5 h-3.5" />
                        Click or Space to flip
                      </span>
                    </div>

                    <div className="my-auto py-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#6B6888] block mb-2">
                        Question / Concept
                      </span>
                      <p className="text-lg sm:text-2xl font-bold text-[#242238] leading-relaxed">
                        {currentCard.front}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B6888] pt-4 border-t border-violet-100">
                      <span>Front Side</span>
                      <span className="font-semibold text-violet-600 group-hover:underline">
                        Tap to reveal answer →
                      </span>
                    </div>
                  </div>

                  {/* ── CARD BACK (ANSWER / HIGH-YIELD TAKEAWAYS) ── */}
                  <div
                    className="flashcard-face flashcard-back p-8 sm:p-10 flex flex-col justify-between border-2 transition-all"
                    style={{
                      background: 'linear-gradient(145deg, #FFFFFF 0%, #F5F1FF 100%)',
                      backdropFilter: 'blur(20px)',
                      borderColor: 'rgba(116, 86, 232, 0.65)',
                      boxShadow: '0 20px 50px -10px rgba(116, 86, 232, 0.22), 0 4px 12px rgba(36, 34, 56, 0.05)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Answer & Key Takeaways
                      </span>
                      <span className="text-xs text-[#6B6888] font-medium flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5" />
                        Click to flip back
                      </span>
                    </div>

                    <div className="my-auto py-4 overflow-y-auto max-h-[220px]">
                      <p className="text-base sm:text-lg text-[#242238] font-medium leading-relaxed whitespace-pre-line">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B6888] pt-4 border-t border-violet-100">
                      <span>Back Side</span>
                      <span className="font-bold text-violet-700">Self-Assess Below 👇</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── USER INTERACTION BUTTONS ── */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {/* 1: Review again */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardAssessment('review');
                  }}
                  className="w-full sm:w-56 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                  title="Press [1] or [Left Arrow]"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Review again</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] rounded bg-rose-200/70 font-mono">1</kbd>
                </button>

                {/* Flip button */}
                <button
                  onClick={handleFlipCard}
                  className="btn-secondary w-full sm:w-auto px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                  title="Press [Space]"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>{isFlipped ? 'Show Question' : 'Reveal Answer'}</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] rounded bg-violet-100 font-mono">Space</kbd>
                </button>

                {/* 2: I knew it! */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardAssessment('known');
                  }}
                  className="w-full sm:w-56 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                  title="Press [2] or [Right Arrow]"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>I knew it!</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] rounded bg-emerald-200/70 font-mono">2</kbd>
                </button>
              </div>

              {/* Keyboard shortcuts hints footer */}
              <div className="hidden sm:flex items-center justify-center gap-6 text-[11px] text-[#6B6888] pt-2">
                <span><kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-violet-700">Space</kbd> Flip card</span>
                <span><kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-violet-700">1</kbd> Review again</span>
                <span><kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-violet-700">2</kbd> I knew it</span>
                <span><kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-violet-700">Esc</kbd> Exit</span>
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // ── MAIN FLASHCARDS HUB (DECKS & CONTINUE STUDYING)
  // ──────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-[#242238] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-violet-400/40 animate-float">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Header & Primary Action ── */}
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
            <Layers className="w-3.5 h-3.5 text-violet-600" />
            <span>Active Recall System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242238]">
            Study Flashcards
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6888] mt-1">
            Master high-yield concepts with spaced active recall. Turn lectures, transcripts, or notes into aesthetic study decks.
          </p>
        </div>

        {/* Create Flashcards Button */}
        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            setCreationStep('source');
            setGenerationError(null);
          }}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer shadow-lg hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Flashcards</span>
        </button>
      </div>

      {/* ── "CONTINUE STUDYING" SHELF ── */}
      {recentlyStudiedDecks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B6888] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-600" />
              <span>Continue Studying</span>
            </h2>
            <span className="text-xs text-[#6B6888]">Recently Opened Decks</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {recentlyStudiedDecks.map((deck) => {
              const total = deck.cards.length;
              const known = deck.cards.filter((c) => c.known === true).length;
              const mastery = Math.round((known / total) * 100) || 0;

              return (
                <div
                  key={deck.id}
                  onClick={() => handleStartStudy(deck)}
                  className="glass-panel p-4 rounded-2xl border border-violet-200/80 hover:border-violet-400 hover:shadow-md cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-full inline-block truncate max-w-full">
                      {deck.subject}
                    </span>
                    <h3 className="font-bold text-sm text-[#242238] group-hover:text-violet-700 transition-colors truncate mt-1">
                      {deck.title}
                    </h3>
                    <p className="text-[11px] text-[#6B6888] mt-0.5">
                      {total} cards • {mastery}% mastered
                    </p>
                  </div>

                  {/* Play Button */}
                  <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center transition-all shrink-0 shadow-sm">
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── SEARCH & FILTER DECK TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-violet-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved decks, topics..."
            className="glass-input w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm text-[#242238] placeholder-[#6B6888] focus:outline-none"
          />
        </div>

        <div className="text-xs text-[#6B6888] font-medium self-end sm:self-center">
          Showing <span className="font-bold text-violet-700">{filteredDecks.length}</span> deck{filteredDecks.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* ── SAVED DECKS BENTO GRID ── */}
      {filteredDecks.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-violet-200/60 max-w-md mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 mx-auto mb-4">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-lg text-[#242238]">No flashcard decks found</h3>
          <p className="text-xs sm:text-sm text-[#6B6888] mt-2 leading-relaxed">
            {searchQuery
              ? 'No decks match your search query. Try searching for something else.'
              : 'Create your first study deck from a lecture, a document file, or pasted notes!'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setIsCreateModalOpen(true);
            }}
            className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Flashcards Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDecks.map((deck) => {
            const total = deck.cards.length;
            const known = deck.cards.filter((c) => c.known === true).length;
            const mastery = Math.round((known / total) * 100) || 0;

            return (
              <div
                key={deck.id}
                className="glass-panel-elevated p-5 rounded-2xl border flex flex-col justify-between transition-all group relative overflow-hidden"
                style={{
                  borderColor: 'rgba(220, 212, 255, 0.75)',
                }}
              >
                {/* Decorative Top Accent Ribbon */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    deck.colorTheme === 'sunset'
                      ? 'deck-gradient-sunset'
                      : deck.colorTheme === 'matcha'
                      ? 'deck-gradient-matcha'
                      : deck.colorTheme === 'cyber'
                      ? 'deck-gradient-cyber'
                      : deck.colorTheme === 'amber'
                      ? 'deck-gradient-amber'
                      : 'deck-gradient-lavender'
                  }`}
                />

                <div>
                  <div className="flex items-center justify-between text-xs text-[#6B6888] mb-2.5 pt-1">
                    <span className="font-bold text-violet-700 bg-violet-100/80 px-2.5 py-0.5 rounded-full text-[11px] truncate max-w-[170px]">
                      {deck.subject}
                    </span>
                    <span className="text-[11px] font-medium text-[#6B6888]">
                      {deck.cards.length} cards
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-[#242238] group-hover:text-violet-700 transition-colors line-clamp-2 leading-snug">
                    {deck.title}
                  </h3>

                  {deck.description && (
                    <p className="text-xs text-[#6B6888] mt-2 line-clamp-2 leading-relaxed">
                      {deck.description}
                    </p>
                  )}

                  {/* Progress & Mastery Info */}
                  <div className="mt-4 pt-3 border-t border-violet-100/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#6B6888]">
                      <span>Mastery</span>
                      <span className="font-bold text-violet-700">{mastery}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-violet-100 overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full transition-all"
                        style={{ width: `${mastery}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-violet-100 flex items-center justify-between">
                  <button
                    onClick={() => handleStartStudy(deck)}
                    className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer shadow-sm group-hover:shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Study Now</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setDeckTitle(deck.title);
                        setDeckSubject(deck.subject);
                        setPreviewCards(deck.cards);
                        setCreationStep('preview');
                        setIsCreateModalOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-violet-700 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer"
                      title="Edit cards"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteDeck(deck.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete deck"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          ── CREATE FLASHCARDS MODAL / SCREEN
          ────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#242238]/60 backdrop-blur-md animate-fade-in">
          <div
            className="glass-panel w-full max-w-2xl max-h-[90vh] rounded-3xl border border-violet-200/90 shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'rgba(255, 255, 255, 0.95)' }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#242238]">
                    {creationStep === 'source' ? 'Create New Flashcard Deck' : 'Preview & Edit Deck'}
                  </h3>
                  <span className="text-[11px] text-[#6B6888]">
                    {creationStep === 'source'
                      ? 'Choose your study material source'
                      : `${previewCards.length} high-yield cards generated`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setPreviewCards([]);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message inside modal */}
            {generationError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {generationError}
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {creationStep === 'source' ? (
                <>
                  {/* Source Tabs */}
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-violet-100/60 border border-violet-200/60">
                    <button
                      type="button"
                      onClick={() => setSourceType('lecture')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sourceType === 'lecture'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-[#6B6888] hover:text-[#242238]'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>From a lecture</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSourceType('file')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sourceType === 'file'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-[#6B6888] hover:text-[#242238]'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>From a file</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSourceType('text')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sourceType === 'text'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-[#6B6888] hover:text-[#242238]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>From text</span>
                    </button>
                  </div>

                  {/* 1. From a Lecture */}
                  {sourceType === 'lecture' && (
                    <div className="space-y-4">
                      {savedNotes.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-violet-50/60 border border-violet-200 text-center space-y-2">
                          <BookOpen className="w-8 h-8 text-violet-500 mx-auto" />
                          <h4 className="font-bold text-sm text-[#242238]">No saved lectures in Library</h4>
                          <p className="text-xs text-[#6B6888] max-w-sm mx-auto">
                            You don't have any saved lecture notes yet. You can paste notes using "From text" or create notes in Study Studio.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSourceType('text')}
                            className="btn-primary mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold"
                          >
                            Switch to Paste Text
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-[#242238] block">
                            Select Saved Lecture:
                          </label>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {savedNotes.map((note, idx) => (
                              <div
                                key={idx}
                                onClick={() => setSelectedLectureIndex(idx)}
                                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                                  selectedLectureIndex === idx
                                    ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-200'
                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                                    {note.subject}
                                  </span>
                                  <h4 className="font-bold text-xs sm:text-sm text-[#242238] mt-1">
                                    {note.title}
                                  </h4>
                                  <p className="text-[11px] text-[#6B6888] line-clamp-1 mt-0.5">
                                    {note.overview}
                                  </p>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                                    selectedLectureIndex === idx
                                      ? 'bg-violet-600 border-violet-600 text-white'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {selectedLectureIndex === idx && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. From a File */}
                  {sourceType === 'file' && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-violet-300 rounded-2xl p-6 text-center hover:bg-violet-50/50 transition-colors">
                        <Upload className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                        <span className="font-bold text-sm text-[#242238] block">
                          Upload your document or transcript
                        </span>
                        <p className="text-xs text-[#6B6888] mt-1 mb-3">
                          Supports .txt, .md, .srt, .vtt, transcripts, and study guides
                        </p>
                        <label className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
                          <span>Browse File</span>
                          <input
                            type="file"
                            accept=".txt,.md,.srt,.vtt,.docx,.json"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {uploadedFileName && (
                        <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-violet-600" />
                            <span className="font-semibold text-violet-900">{uploadedFileName}</span>
                          </div>
                          <span className="text-gray-500">{uploadedFileText.length} characters</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. From Text */}
                  {sourceType === 'text' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-[#242238] block mb-1">
                          Paste study notes, transcript, or lecture content:
                        </label>
                        <textarea
                          rows={6}
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Paste class transcript, textbook summary, definitions, or revision notes..."
                          className="glass-input w-full p-3.5 rounded-xl text-xs sm:text-sm text-[#242238] placeholder-[#6B6888] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#6B6888]">
                        <span>{textInput.length} characters</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTextInput(
                              'Amdahl’s law calculates maximum speedup in parallel computing: S = 1 / ((1-p) + p/s). Idempotency ensures f(f(x)) = f(x). GET, PUT, and DELETE are idempotent; POST is non-idempotent because duplicate submissions create duplicate resources.'
                            );
                            setDeckTitle('Parallel Systems & REST API');
                            setDeckSubject('Computer Science');
                          }}
                          className="text-violet-600 font-semibold hover:underline cursor-pointer"
                        >
                          Use Sample Study Notes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Custom Deck Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-[#242238] block mb-1">
                        Deck Title (Optional):
                      </label>
                      <input
                        type="text"
                        value={deckTitle}
                        onChange={(e) => setDeckTitle(e.target.value)}
                        placeholder="e.g. Midterm Flashcards"
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#242238] block mb-1">
                        Subject / Course:
                      </label>
                      <input
                        type="text"
                        value={deckSubject}
                        onChange={(e) => setDeckSubject(e.target.value)}
                        placeholder="e.g. Biology 101, CS 401"
                        className="glass-input w-full px-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* ── STEP 2: PREVIEW & EDIT GENERATED CARDS ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                        {deckSubject || 'Study Deck'}
                      </span>
                      <h4 className="font-extrabold text-base text-[#242238] mt-1">
                        {deckTitle || 'Custom Deck'}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomCard}
                      className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Card</span>
                    </button>
                  </div>

                  {/* Editable Cards List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {previewCards.map((card, idx) => (
                      <div
                        key={card.id}
                        className="p-3.5 rounded-2xl bg-white border border-violet-200/90 shadow-sm space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-violet-700">
                            Card #{idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={card.tag || 'High-Yield'}
                              onChange={(e) => handleUpdateCard(card.id, 'tag', e.target.value)}
                              placeholder="Tag (e.g. Formula)"
                              className="text-[10px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-200 w-24 text-center"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePreviewCard(card.id)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#6B6888] block mb-0.5">
                            Front (Question / Concept):
                          </label>
                          <input
                            type="text"
                            value={card.front}
                            onChange={(e) => handleUpdateCard(card.id, 'front', e.target.value)}
                            className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#242238]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#6B6888] block mb-0.5">
                            Back (Answer / Takeaway):
                          </label>
                          <textarea
                            rows={2}
                            value={card.back}
                            onChange={(e) => handleUpdateCard(card.id, 'back', e.target.value)}
                            className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs text-[#242238]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 border-t border-violet-100 flex items-center justify-between bg-violet-50/40">
              {creationStep === 'source' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleProceedFromSource}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Generating Cards...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate & Preview Deck</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCreationStep('source')}
                    className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ← Back to Source
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDeck}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Save Deck to Flashcards</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
