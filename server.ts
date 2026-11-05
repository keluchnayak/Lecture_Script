import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';

import cookieParser from 'cookie-parser';
import authRoutes from './src/server/routes/authRoutes.js';
import syncRoutes from './src/server/routes/syncRoutes.js';
import { checkDatabaseHealth } from './src/server/db.js';
import { createRateLimiter } from './src/server/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxies (Render, Railway, Cloudflare, load balancers)
app.set('trust proxy', 1);

// Configure CORS for decoupled frontend (Cloudflare Pages, custom domains, local dev)
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const parsedAllowedOrigins = allowedOriginsEnv
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
  .filter(Boolean);

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // allow same-origin, curl, server-to-server, health monitors
  
  const normOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
  if (parsedAllowedOrigins.includes(normOrigin)) return true;
  
  // Local development & LAN IP ports for mobile testing
  if (/^https?:\/\/localhost(:\d+)?$/.test(normOrigin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(normOrigin)) return true;
  if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(normOrigin)) return true;
  if (/^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(normOrigin)) return true;
  
  // Cloudflare Pages deployments (production, branch preview, commit preview)
  // Matches https://lecturescript.pages.dev, https://main.lecturescript.pages.dev, https://hash.lecturescript.pages.dev
  if (/^https:\/\/([a-zA-Z0-9-_]+\.)*pages\.dev$/i.test(normOrigin)) return true;
  
  // Render deployment domains
  if (/^https:\/\/([a-zA-Z0-9-_]+\.)*onrender\.com$/i.test(normOrigin)) return true;
  
  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Retry-After', 'Set-Cookie'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Cookie parser for secure HttpOnly session tokens
app.use(cookieParser());

// Support very large transcripts (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Fast lightweight health check for hosting platforms (Render, Railway, Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount Authentication & Cloud Synchronization API routes
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);

// Rate limiter for expensive AI endpoints: 30 calls per 5 minutes per user/IP
const aiRateLimiter = createRateLimiter(30, 5 * 60 * 1000);

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Detailed health check endpoint verifying database & Gemini API status
app.get('/api/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.1-flash-lite',
    database: dbHealth.ok ? 'connected' : 'disconnected',
    databaseDetails: dbHealth.ok ? { engine: 'Neon PostgreSQL' } : { error: dbHealth.error },
  });
});

// Defensive normalizer to guarantee the client always receives rich, reliable college notes
function normalizeLectureNotes(
  data: any,
  subject: string,
  wordCount: number,
  estMinutes: number,
  modelName: string
) {
  const result: any = { ...data };

  result.title = result.title || `${subject || 'Lecture'} Study Notes`;
  result.subject = result.subject || subject || 'General Class';
  result.courseCodeOrTopic = result.courseCodeOrTopic || subject || 'Class Notes';
  result.lectureDate =
    result.lectureDate ||
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  result.overview =
    result.overview ||
    'Clear study notes covering key concepts, definitions, and real-world examples.';

  // Normalize academic modules
  result.modules = Array.isArray(result.modules)
    ? result.modules.map((m: any) => ({
        topic: m.topic || 'Main Topic',
        subheading: m.subheading || 'Key Concepts & Details',
        coreExplanation:
          m.coreExplanation ||
          'Clear explanation of this topic, breaking down the main ideas and how they work.',
        keyPoints: Array.isArray(m.keyPoints)
          ? m.keyPoints.map((p: any) => String(p))
          : ['Main point covered in this class.'],
        exampleOrCaseStudy: m.exampleOrCaseStudy || undefined,
        importance: m.importance || 'Key Topic',
      }))
    : [];

  // Normalize cornellSections
  let rawSections = result.cornellSections;
  if (!Array.isArray(rawSections)) {
    if (Array.isArray(result.cornell_notes)) {
      rawSections = result.cornell_notes;
    } else if (Array.isArray(result.sections)) {
      rawSections = result.sections;
    } else {
      rawSections = [];
    }
  }

  result.cornellSections = rawSections.map((sec: any) => {
    const cue = sec.cue || sec.topic || sec.question || 'Question / Prompt';
    let notes: string[] = [];

    if (Array.isArray(sec.notes)) {
      notes = sec.notes.map((n: any) =>
        typeof n === 'string' ? n : (n.point || n.note || JSON.stringify(n))
      );
    } else if (typeof sec.notes === 'string') {
      notes = sec.notes
        .split('\n')
        .map((s: string) => s.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
    } else if (sec.point || sec.note) {
      notes = [String(sec.point || sec.note)];
    }

    if (notes.length === 0) {
      notes = ['Important idea to remember.'];
    }

    return {
      cue,
      notes,
      tag: sec.tag || 'Key Point',
    };
  });

  // If modules exist but cornell is empty, generate cornell from modules
  if (result.cornellSections.length === 0 && result.modules.length > 0) {
    result.cornellSections = result.modules.map((m: any) => ({
      cue: `Explain ${m.topic}`,
      notes: m.keyPoints || [m.coreExplanation],
      tag: m.importance || 'Key Topic',
    }));
  }

  // Normalize keyFormulasOrDefinitions
  result.keyFormulasOrDefinitions = Array.isArray(result.keyFormulasOrDefinitions)
    ? result.keyFormulasOrDefinitions.map((f: any) => ({
        term: f.term || 'Key Term',
        formulaOrDefinition: f.formulaOrDefinition || f.definition || '',
        context: f.context || 'How this term or formula is used.',
        examSignificance: f.examSignificance || 'Why this is important to know for tests.',
      }))
    : [];

  // Normalize comparisonAnalysis
  result.comparisonAnalysis = Array.isArray(result.comparisonAnalysis)
    ? result.comparisonAnalysis.map((c: any) => ({
        aspect: c.aspect || 'Topic',
        conceptA: c.conceptA || c.optionA || 'Idea A',
        conceptB: c.conceptB || c.optionB || 'Idea B',
        keyDifference: c.keyDifference || c.difference || '',
      }))
    : [];

  // Normalize examTrapsAndAlerts
  result.examTrapsAndAlerts = Array.isArray(result.examTrapsAndAlerts)
    ? result.examTrapsAndAlerts.map((t: any) => ({
        topic: t.topic || 'Common Mistake',
        trapDescription:
          t.trapDescription || t.trap || 'A mistake students often make when explaining this concept.',
        howToAnswerInExam:
          t.howToAnswerInExam || t.solution || 'Make sure to explain this clearly and include the key details.',
      }))
    : [];

  // Normalize legacy examAlerts if present
  result.examAlerts = Array.isArray(result.examAlerts)
    ? result.examAlerts.map((a: any) => (typeof a === 'string' ? a : JSON.stringify(a)))
    : result.examTrapsAndAlerts.map((t: any) => `${t.topic}: ${t.trapDescription}`);

  // Normalize activeRecallQuestions
  result.activeRecallQuestions = Array.isArray(result.activeRecallQuestions)
    ? result.activeRecallQuestions.map((q: any) => ({
        question: q.question || 'Practice Question',
        answerKey: q.answerKey || q.answer || 'Clear explanation and correct answer.',
      }))
    : [];

  // Normalize diagramsToDraw
  result.diagramsToDraw = Array.isArray(result.diagramsToDraw)
    ? result.diagramsToDraw.map((d: any) => ({
        title: d.title || 'Diagram',
        instruction: d.instruction || 'A visual sketch showing how this works.',
        asciiSketch: d.asciiSketch || '',
      }))
    : [];

  // Normalize bottomSummary
  result.bottomSummary =
    result.bottomSummary ||
    'Review these key ideas, check the formulas and terms, and practice answering the questions before your exam.';

  // Add stats
  result.stats = {
    wordCountOriginal: wordCount,
    estimatedLectureMinutes: estMinutes,
    modelUsed: modelName,
  };

  return result;
}

// Resilient API Caller using active production models with fallback
async function generateNotesWithRetry(
  prompt: string,
  systemInstruction: string,
  clientInstance: GoogleGenAI = ai
): Promise<{ text: string; modelUsed: string }> {
  // Ordered by response speed and availability:
  // 1. gemini-2.5-flash (with thinkingBudget: 0 for instant JSON output in ~5s)
  // 2. gemini-3.1-flash-lite (fast 2s fallback)
  // 3. gemini-2.5-flash-lite (resilient additional fallback)
  const candidateModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Requesting ${model} (attempt ${attempt})...`);
        const generationConfig: any = {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subject: { type: Type.STRING },
              courseCodeOrTopic: { type: Type.STRING },
              lectureDate: { type: Type.STRING },
              overview: { type: Type.STRING },
              modules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    subheading: { type: Type.STRING },
                    coreExplanation: { type: Type.STRING },
                    keyPoints: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    exampleOrCaseStudy: { type: Type.STRING },
                    importance: { type: Type.STRING },
                  },
                  required: ['topic', 'subheading', 'coreExplanation', 'keyPoints'],
                },
              },
              cornellSections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cue: { type: Type.STRING },
                    notes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    tag: { type: Type.STRING },
                  },
                  required: ['cue', 'notes'],
                },
              },
              keyFormulasOrDefinitions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    formulaOrDefinition: { type: Type.STRING },
                    context: { type: Type.STRING },
                    examSignificance: { type: Type.STRING },
                  },
                  required: ['term', 'formulaOrDefinition'],
                },
              },
              comparisonAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    aspect: { type: Type.STRING },
                    conceptA: { type: Type.STRING },
                    conceptB: { type: Type.STRING },
                    keyDifference: { type: Type.STRING },
                  },
                  required: ['aspect', 'conceptA', 'conceptB', 'keyDifference'],
                },
              },
              examTrapsAndAlerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    trapDescription: { type: Type.STRING },
                    howToAnswerInExam: { type: Type.STRING },
                  },
                  required: ['topic', 'trapDescription', 'howToAnswerInExam'],
                },
              },
              activeRecallQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answerKey: { type: Type.STRING },
                  },
                  required: ['question', 'answerKey'],
                },
              },
              diagramsToDraw: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                    asciiSketch: { type: Type.STRING },
                  },
                  required: ['title', 'instruction'],
                },
              },
              bottomSummary: { type: Type.STRING },
            },
            required: ['title', 'overview', 'modules', 'cornellSections', 'bottomSummary'],
          },
        };

        // Bypass reasoning thinking tokens on attempt 1 for 4x faster response time
        if (attempt === 1) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await clientInstance.models.generateContent({
          model,
          contents: prompt,
          config: generationConfig,
        });

        if (response.text) {
          console.log(`[Gemini API] Success with ${model}`);
          return { text: response.text, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] ${model} attempt ${attempt} failed:`, err.message || err);
        // Backoff delay before retry
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError || new Error('All AI model generation attempts failed.');
}

// Main Endpoint: POST /api/generate-notes (Rate limited)
app.post('/api/generate-notes', aiRateLimiter, async (req, res) => {
  try {
    const {
      transcript,
      subject = 'College Course',
      noteStyle = 'cornell',
      density = 'balanced',
      includeDiagramPrompts = true,
      includeExamCues = true,
      userApiKey,
    } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 15) {
      return res.status(400).json({
        error: 'Please paste or type a transcript with at least 15 characters.',
      });
    }

    // Keep transcript within optimal context size (80,000 chars is ~15,000 words, >2 hours lecture)
    const processedTranscript =
      transcript.length > 80000
        ? transcript.slice(0, 80000) + '\n\n[Transcript excerpted to 80,000 characters for optimal AI performance]'
        : transcript;

    const wordCount = processedTranscript.trim().split(/\s+/).length;
    const estMinutes = Math.max(1, Math.round(wordCount / 140));

    const effectiveApiKey = userApiKey || process.env.GEMINI_API_KEY;

    // If API key is missing entirely, fallback to preview demo
    if (!effectiveApiKey) {
      console.warn('No Gemini API key available. Generating demo notes for preview.');
      const demoResult = generateDemoNotes(subject, wordCount, estMinutes);
      return res.json({
        ...demoResult,
        isDemo: true,
        isDemoFallback: true,
        message: 'Using offline demo notes — add a valid Gemini API key in Settings to process your transcript.',
      });
    }

    const systemInstruction = `You are a Distinguished University Professor, Department Chair, and Academic Exam Preparation Specialist.
Your mission is to convert raw, spoken lecture transcripts into DEEP, RIGOROUS, HIGH-YIELD COLLEGE EXAM STUDY NOTES.

CRITICAL PRINCIPLE: NOTE MEANS INTELLECTUAL CONTENT, NOT NOTEBOOK METADATA.
Do NOT give advice about pens, paper ruling, or margin spacing. Instead, provide thorough academic substance, exact scientific/mathematical formulas, core mechanisms, step-by-step logic, and exam-grade analysis that students need to score top marks on midterms and finals.

Structure of the Academic Exam Notes:
1. COURSE MODULES (3 to 5 Comprehensive Units):
   - For each module: A clear Topic title, precise Subheading, an in-depth Core Explanation detailing the underlying mechanism/principle, followed by bulleted key points with bold technical keywords and causal arrows (->), plus practical examples or case studies.
2. PRECISE DEFINITIONS & FORMULAS:
   - Provide verbatim textbook-grade definitions and formulas with variable breakdowns, notation, and why this theorem matters on exams.
3. PROFESSOR'S EXAM TRAPS & MARK-LOSING MISTAKES:
   - Identify common misconceptions where students lose marks on tests, subtle edge cases, and exactly how a student should formulate their answer for full credit.
4. CORNELL ACTIVE RECALL CUES:
   - Margin cues should be sharp, testable recall questions (e.g., "Why does X degrade under Y condition?"), paired with clear outline points.
5. COMPARISON & CONTRAST ANALYSIS:
   - When the lecture contrasts concepts (e.g., TCP vs UDP, SN1 vs SN2, Fiscal vs Monetary), provide explicit side-by-side differentiations.
6. ACTIVE RECALL SELF-TEST QUESTIONS:
   - Provide 3-5 challenging exam-style practice questions with complete answer keys so students can test their mastery before the exam.
7. ARCHITECTURAL & SCHEMATIC DIAGRAMS:
   - Where a visual model or flow was discussed, describe the system architecture and provide a clean ASCII diagram.
8. FILTER ALL BANTER:
   - Completely strip all classroom chatter, mic checks, greetings, student interruptions, and Zoom pauses.`;

    const prompt = `Here is the lecture transcript to convert into comprehensive College Exam Study Notes:
---
COURSE / SUBJECT: ${subject}
DESIRED STYLE: ${noteStyle}
DENSITY: ${density}
INCLUDE DIAGRAM SCHEMATICS: ${includeDiagramPrompts}
INCLUDE EXAM ALERTS & TRAPS: ${includeExamCues}
TRANSCRIPT METRICS: ~${wordCount} words (~${estMinutes} lecture minutes)

TRANSCRIPT TEXT:
${processedTranscript}
---

Generate the complete, in-depth college study notes according to the JSON schema with maximum academic depth.`;

    const activeClient = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : ai;

    const { text: rawText, modelUsed } = await generateNotesWithRetry(
      prompt,
      systemInstruction,
      activeClient
    );

    let parsedNotes: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedNotes = JSON.parse(jsonMatch[0]);
      } else {
        parsedNotes = JSON.parse(rawText);
      }
    } catch (parseErr) {
      console.warn('JSON parse fallback triggered:', parseErr);
      parsedNotes = {
        title: `${subject}: College Exam Study Notes`,
        overview: rawText.substring(0, 300),
      };
    }

    const normalized = normalizeLectureNotes(
      parsedNotes,
      subject,
      wordCount,
      estMinutes,
      modelUsed
    );

    return res.json(normalized);
  } catch (error: any) {
    console.error('Error generating notes:', error);
    let errorMsg = error.message || 'Could not create study notes. Please check your transcript and try again.';

    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed?.error?.message) {
        errorMsg = parsed.error.message;
      }
    } catch {
      // Keep errorMsg as is
    }

    // Resilient fallback to offline demo notes when user key is invalid or network drops
    console.warn('[Gemini API] Request failed; serving fallback demo notes with isDemoFallback flag');
    const rawTranscript = req.body?.transcript;
    const fallbackSubject = req.body?.subject || 'College Course';
    const wordCount = rawTranscript && typeof rawTranscript === 'string' ? rawTranscript.trim().split(/\s+/).length : 500;
    const estMinutes = Math.max(1, Math.round(wordCount / 140));
    const demoResult = generateDemoNotes(fallbackSubject, wordCount, estMinutes);
    return res.json({
      ...demoResult,
      isDemo: true,
      isDemoFallback: true,
      message: 'Using offline demo notes — add a valid Gemini API key in Settings to process your transcript.',
    });
  }
});

// Endpoint: POST /api/generate-flashcards (Rate limited)
app.post('/api/generate-flashcards', aiRateLimiter, async (req, res) => {
  try {
    const {
      content,
      title = 'Study Flashcards',
      subject = 'General Study',
      count = 10,
      userApiKey,
    } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return res.status(400).json({
        error: 'Please provide material or text to generate flashcards.',
      });
    }

    const effectiveApiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.json({
        cards: generateFallbackFlashcards(title, subject, content),
        isDemo: true,
      });
    }

    const clientInstance = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : ai;
    const prompt = `Create high-yield, aesthetic study flashcards for college students based on this material:

Title: ${title}
Subject: ${subject}
Requested Cards: ${count}

Source Material:
"""
${content.slice(0, 16000)}
"""

Generate between 8 and 14 high-yield flashcards.
Each card must have:
- front: A clear, engaging, high-yield question, concept test, or scenario.
- back: A crisp, accurate, comprehensive explanation or definition highlighting key testable points.
- tag: A short category tag like "High-Yield", "Core Concept", "Formula", "Definition", "Exam Trap", or "Mechanism".
`;

    const systemInstruction = `You are a Gen-Z master study coach and top academic scholar.
Your goal is to turn academic texts, lecture notes, and transcripts into razor-sharp, memorable, high-yield study flashcards for active recall. Make each question prompt deep understanding, not shallow trivia. Ensure answers are crystal clear, educational, and concise.`;

    const candidateModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
    let parsedCards: any = null;

    for (const model of candidateModels) {
      try {
        const response = await clientInstance.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: { type: Type.STRING },
                      back: { type: Type.STRING },
                      tag: { type: Type.STRING },
                    },
                    required: ['front', 'back'],
                  },
                },
              },
              required: ['cards'],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            parsedCards = parsed.cards;
            break;
          }
        }
      } catch (err) {
        console.warn(`Flashcard generation failed with model ${model}:`, err);
      }
    }

    if (!parsedCards || parsedCards.length === 0) {
      parsedCards = generateFallbackFlashcards(title, subject, content);
    }

    const cards = parsedCards.map((c: any, idx: number) => ({
      id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      front: c.front || 'Concept Prompt',
      back: c.back || 'Key Explanation',
      tag: c.tag || 'High-Yield',
    }));

    return res.json({ cards });
  } catch (error: any) {
    console.error('Error generating flashcards:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate flashcards',
    });
  }
});

// Helper for offline / fallback flashcards extraction
function generateFallbackFlashcards(title: string, subject: string, content: string) {
  // Extract sentences or chunks
  const lines = content
    .split(/\n|\.\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 25);

  const defaultCards = [
    {
      front: `What is the core premise of ${title || subject}?`,
      back: lines[0] || `The foundational architecture and principles covered in ${subject}.`,
      tag: 'Core Concept',
    },
    {
      front: 'Why is client-side decoupling essential in modern architecture?',
      back: 'Separation of concerns, centralized security enforcement (untrusted client principle), and independent horizontal backend scaling.',
      tag: 'High-Yield',
    },
    {
      front: 'What does Amdahl’s Law define regarding system speedup?',
      back: 'Maximum theoretical speedup is strictly bounded by the non-parallelizable serial fraction (1 - p). S_max = 1 / (1 - p).',
      tag: 'Formula',
    },
    {
      front: 'Explain the difference between idempotent and non-idempotent HTTP methods.',
      back: 'GET, PUT, and DELETE are idempotent (f(f(x)) = f(x)). POST is non-idempotent because retrying it can create duplicate entities or transactions.',
      tag: 'Exam Trap',
    },
    {
      front: 'How does Node.js handle high concurrent I/O despite single-threaded JavaScript?',
      back: 'JavaScript executes on a single event loop thread, while heavy/blocking I/O is delegated to libuv worker threads and OS kernel async polling.',
      tag: 'Mechanism',
    },
  ];

  return defaultCards;
}

// Helper for offline / fallback demo
function generateDemoNotes(subject: string, wordCount: number, estMinutes: number) {
  return {
    title: `${subject}: Distributed Systems Architecture & Reliability`,
    subject: subject,
    courseCodeOrTopic: 'CS 401: Distributed Systems',
    lectureDate: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    overview: `An advanced theoretical and applied analysis of distributed systems architectures, focusing on decoupling client-server tiers, network latency realities, Amdahl's scaling laws, REST idempotency invariants, and event-driven non-blocking I/O.`,
    modules: [
      {
        topic: 'Client-Server Decoupling & Security Boundaries',
        subheading: 'Separation of Concerns and the Untrusted Client Principle',
        coreExplanation:
          'Modern web applications enforce strict separation between presentation tiers (client-side SPAs) and data/business logic tiers. Because clients operate in uncontrolled environments (DevTools, reverse engineering), all authorization, validation, and business invariants must execute server-side.',
        keyPoints: [
          'Presentation layer isolation: Clients manage viewport state, transitions, and local optimistic updates.',
          'Zero-trust security boundary: Never rely on client-side validation; every incoming request must be authenticated and sanitized.',
          'Horizontal scalability: Stateless application servers permit dynamic auto-scaling behind load balancers without mutating client session state.',
        ],
        exampleOrCaseStudy:
          'E-commerce checkout: Client sends cart IDs, server recalculates prices from database to prevent client-side price tampering.',
        importance: 'High-Yield',
      },
      {
        topic: 'Performance Scaling: Latency Hierarchy & Amdahl’s Law',
        subheading: 'Physical Constraints on Computational Speedup',
        coreExplanation:
          'Computational speedup is constrained by network transit delays and serial execution bottlenecks. While L1 cache access takes ~1ns and RAM ~100ns, transatlantic network roundtrips require 70-80ms (nearly 1,000,000x slower), dictating caching and batching strategies.',
        keyPoints: [
          'Network speed of light barrier: Latency cannot be engineered away solely with bandwidth; roundtrip packets incur inescapable propagation delays.',
          'Amdahl’s Law formulation: S(s) = 1 / ((1 - p) + (p / s)), where p is parallelizable fraction and s is component acceleration.',
          'Theoretical limit: If 50% of an application is inherently serial (p = 0.5), maximum system speedup is strictly capped at 2x, regardless of infinite CPU cores.',
        ],
        exampleOrCaseStudy:
          'Database write locks: If 30% of a transaction workload requires sequential global locks, adding 64 processor nodes yields diminishing marginal returns.',
        importance: 'Core Theory',
      },
      {
        topic: 'HTTP Protocol Semantics: Idempotency & Safety',
        subheading: 'Network Failures, Retries, and State Mutations',
        coreExplanation:
          'Idempotency defines operations where f(f(x)) = f(x). In distributed networks with packet loss and timeout retries, idempotency prevents catastrophic duplicate side-effects in financial and ordering systems.',
        keyPoints: [
          'Idempotent methods: GET, HEAD, PUT, DELETE produce identical server state upon repeated execution.',
          'Non-idempotent methods: POST creates new subordinate resources with each dispatch, risking duplicate billing on network retry.',
          'Idempotency Keys: Clients generate unique UUID tokens in request headers (Idempotency-Key) so servers identify and deduplicate retried POST requests.',
        ],
        exampleOrCaseStudy:
          'Stripe payment API: Network timeout during payment processing triggers a safe client retry using the same idempotency key.',
        importance: 'High-Yield',
      },
    ],
    cornellSections: [
      {
        cue: 'Why can client-side authorization never be trusted?',
        notes: [
          'Client runtime (browsers, mobile binaries) is fully controllable by end users via DevTools and memory inspection.',
          'All business logic and permission enforcement must reside behind server-side API boundaries.',
        ],
        tag: 'Security Rule',
      },
      {
        cue: 'What is the exam trap regarding Amdahl’s Law limits?',
        notes: [
          'Formula: S = 1 / ((1 - p) + (p / s)).',
          'Trap: Assuming infinite cores can scale performance indefinitely.',
          'Reality: The strictly serial fraction (1 - p) creates an impenetrable asymptote on maximum speedup.',
        ],
        tag: 'Exam Formula',
      },
      {
        cue: 'Compare HTTP PUT vs POST idempotency.',
        notes: [
          'PUT is idempotent: Replacing resource /users/42 five times results in the same final state.',
          'POST is non-idempotent: Submitting /orders five times creates five distinct database records.',
        ],
        tag: 'Protocol Rule',
      },
    ],
    keyFormulasOrDefinitions: [
      {
        term: 'Amdahl’s Law',
        formulaOrDefinition: 'S_latency(s) = 1 / ((1 - p) + (p / s))',
        context:
          'Calculates theoretical latency speedup limit where p is the parallel fraction and s is the speedup factor.',
        examSignificance:
          'Frequently tested in university distributed systems and computer architecture midterms.',
      },
      {
        term: 'Idempotency Invariant',
        formulaOrDefinition: 'f(f(x)) = f(x) for all valid state transitions x',
        context:
          'Ensures repeated application of an operation produces identical system state.',
        examSignificance:
          'Mandatory question on REST API design, distributed transaction consistency, and network retry mechanisms.',
      },
    ],
    comparisonAnalysis: [
      {
        aspect: 'Execution Semantics',
        conceptA: 'Concurrency',
        conceptB: 'Parallelism',
        keyDifference:
          'Concurrency is dealing with lots of things at once (structure, time-slicing). Parallelism is doing lots of things at once (simultaneous multi-core execution).',
      },
      {
        aspect: 'HTTP Method Nature',
        conceptA: 'PUT',
        conceptB: 'POST',
        keyDifference:
          'PUT is idempotent and replaces the entire target resource state. POST is non-idempotent and creates a new sub-resource.',
      },
    ],
    examTrapsAndAlerts: [
      {
        topic: 'Amdahl’s Law Asymptotic Limit',
        trapDescription:
          'Students often calculate speedup assuming that 100% of an application benefits from multi-core parallelization.',
        howToAnswerInExam:
          'Always identify the non-parallelizable serial fraction (1 - p). State explicitly that as s -> infinity, max speedup = 1 / (1 - p).',
      },
      {
        topic: 'Node.js Single-Threaded Misconception',
        trapDescription:
          'Claiming Node.js cannot handle high concurrent throughput because JavaScript is single-threaded.',
        howToAnswerInExam:
          'Clarify that JavaScript execution is single-threaded on the main event loop, but non-blocking I/O is delegated to libuv worker thread pools and OS kernel polling.',
      },
    ],
    activeRecallQuestions: [
      {
        question:
          'If a server task spends 40% of its execution time in non-parallelizable disk I/O, what is the theoretical maximum speedup achievable with 128 CPU cores?',
        answerKey:
          'Using Amdahl’s law with serial fraction (1 - p) = 0.4: Max speedup = 1 / 0.4 = 2.5x. Even with 128 cores, overall performance cannot exceed 2.5x.',
      },
      {
        question:
          'Why does a network timeout during a POST request require an Idempotency-Key header on retry?',
        answerKey:
          'Because POST is non-idempotent. Without a unique idempotency key, the server cannot distinguish between a re-transmitted packet and an intentional duplicate order.',
      },
    ],
    diagramsToDraw: [
      {
        title: 'Three-Tier Distributed Request Lifecycle',
        instruction:
          'Schematic showing the presentation layer, API gateway / stateless compute cluster, and distributed datastore.',
        asciiSketch:
          '+-----------------+        HTTP REST (JSON)        +------------------------+        TCP Pool / Transactions        +-------------------+\n|  Client Browser  | -----------------------------> | Node.js Express Server | ------------------------------> | PostgreSQL DB /   |\n| (React Frontend) | <----------------------------- | (Stateless Controller) | <------------------------------ | Redis Cache Cluster|\n+-----------------+        Status 200 OK + Data    +------------------------+        Result Set Record              +-------------------+',
      },
    ],
    bottomSummary:
      'Mastery of decoupled service boundaries, network latency realities, Amdahl’s scaling bounds, and HTTP idempotency semantics constitutes the foundational core of scalable distributed systems. Review the active recall questions to ensure full marks on the upcoming exam.',
    stats: {
      wordCountOriginal: wordCount,
      estimatedLectureMinutes: estMinutes || 60,
      modelUsed: 'gemini-3.1-flash-lite',
    },
  };
}

// Dev & Production serving
async function startServer() {
  const distDir = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));

  if (process.env.NODE_ENV !== 'production' && !process.env.RENDER) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (hasDist) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // API-only mode (e.g. backend hosted separately on Render or Railway)
    app.get('/', (req, res) => {
      res.json({
        service: 'LectureScript Backend API',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        health: '/health',
      });
    });
  }

  const HOST = '0.0.0.0';
  app.listen(Number(PORT), HOST, () => {
    console.log(`LectureScript Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
