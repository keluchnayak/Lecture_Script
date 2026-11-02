export interface CornellSection {
  cue: string;
  notes: string[];
  tag?: string;
}

export interface DiagramItem {
  title: string;
  instruction: string;
  asciiSketch: string;
}

export interface FormulaItem {
  term: string;
  formulaOrDefinition: string;
  context: string;
  examSignificance?: string;
}

export interface ExamModule {
  topic: string;
  subheading: string;
  coreExplanation: string;
  keyPoints: string[];
  exampleOrCaseStudy?: string;
  importance?: 'High-Yield' | 'Key Topic' | 'Core Theory' | 'Advanced' | string;
}

export interface ComparisonItem {
  aspect: string;
  conceptA: string;
  conceptB: string;
  keyDifference: string;
}

export interface ExamTrapItem {
  topic: string;
  trapDescription: string;
  howToAnswerInExam: string;
}

export interface ActiveRecallQuestion {
  question: string;
  answerKey: string;
}

export interface LectureNotes {
  id?: string;
  clientId?: string;
  version?: number;
  updatedAt?: string;
  title: string;
  subject: string;
  courseCodeOrTopic?: string;
  lectureDate: string;
  overview: string;
  modules?: ExamModule[];
  cornellSections: CornellSection[];
  diagramsToDraw: DiagramItem[];
  keyFormulasOrDefinitions: FormulaItem[];
  comparisonAnalysis?: ComparisonItem[];
  examAlerts: string[];
  examTrapsAndAlerts?: ExamTrapItem[];
  activeRecallQuestions?: ActiveRecallQuestion[];
  bottomSummary: string;
  notebookHandwritingTips?: string[];
  stats?: {
    wordCountOriginal: number;
    estimatedLectureMinutes: number;
    modelUsed: string;
  };
  isDemo?: boolean;
  isDemoFallback?: boolean;
  message?: string;
}

export type NoteStyle = 'cornell' | 'bullet' | 'cheatsheet' | 'detailed';
export type NoteDensity = 'concise' | 'balanced' | 'comprehensive';

export interface FlashcardItem {
  id: string;
  front: string; // Question or prompt
  back: string;  // Answer or key takeaway
  tag?: string;  // e.g. "Definition", "Formula", "High-Yield", "Core Concept"
  known?: boolean;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subject: string;
  description?: string;
  cards: FlashcardItem[];
  createdAt: string;
  lastStudiedAt?: string;
  colorTheme?: string;
  sourceType?: 'lecture' | 'file' | 'text' | 'studio';
  sourceTitle?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  isGuest?: boolean;
  createdAt?: string;
}

