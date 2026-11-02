import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query } from '../db.js';

const router = Router();

// All sync routes require verified authentication
router.use(requireAuth);

// ============================================================================
// 1. GET /api/sync/hydration — Hydrate entire user state upon login
// ============================================================================
router.get('/hydration', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // 1. Lectures (active, not deleted)
    const lecturesRes = await query(
      `SELECT id, client_id, title, subject, note_style, payload, version, created_at, updated_at
       FROM lectures
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    // 2. Flashcard Decks & Cards
    const decksRes = await query(
      `SELECT id, client_id, source_lecture_id, title, description, subject, color_theme, created_at, updated_at
       FROM flashcard_decks
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    const deckIds = decksRes.rows.map((d) => d.id);
    let cardsByDeck: Record<string, any[]> = {};

    if (deckIds.length > 0) {
      const cardsRes = await query(
        `SELECT c.id, c.deck_id, c.client_id, c.question, c.answer, c.tag, c.difficulty, c.position,
                p.confidence, p.review_count, p.last_reviewed_at
         FROM flashcards c
         LEFT JOIN flashcard_progress p ON p.flashcard_id = c.id AND p.user_id = $1
         WHERE c.deck_id = ANY($2::uuid[])
         ORDER BY c.position ASC, c.created_at ASC`,
        [userId, deckIds]
      );

      for (const card of cardsRes.rows) {
        if (!cardsByDeck[card.deck_id]) {
          cardsByDeck[card.deck_id] = [];
        }
        cardsByDeck[card.deck_id].push({
          id: card.client_id || card.id,
          front: card.question,
          back: card.answer,
          tag: card.tag,
          known: card.confidence === 'known',
          reviewCount: card.review_count || 0,
        });
      }
    }

    const hydratedDecks = decksRes.rows.map((d) => ({
      id: d.client_id || d.id,
      serverDbId: d.id,
      title: d.title,
      description: d.description || '',
      subject: d.subject || '',
      colorTheme: d.color_theme || 'lavender',
      createdAt: d.created_at,
      lastStudiedAt: d.updated_at,
      cards: cardsByDeck[d.id] || [],
    }));

    // 3. Practice Progress
    const practiceRes = await query(
      `SELECT p.item_id, p.confidence, p.review_count, p.last_reviewed_at, l.client_id as lecture_client_id
       FROM practice_progress p
       JOIN lectures l ON p.lecture_id = l.id
       WHERE p.user_id = $1 AND l.deleted_at IS NULL`,
      [userId]
    );

    const practiceProgressMap: Record<string, Record<string, 'mastered' | 'missed'>> = {};
    for (const row of practiceRes.rows) {
      const lId = row.lecture_client_id;
      if (!practiceProgressMap[lId]) practiceProgressMap[lId] = {};
      practiceProgressMap[lId][row.item_id] = row.confidence;
    }

    // 4. Study Activity Days (past 30 days)
    const activityRes = await query(
      `SELECT activity_date, active_seconds, sessions_count
       FROM study_activity_days
       WHERE user_id = $1 AND activity_date >= (CURRENT_DATE - INTERVAL '30 days')
       ORDER BY activity_date ASC`,
      [userId]
    );

    // 5. User Settings
    const settingsRes = await query(
      `SELECT character_preference, timezone, preferences
       FROM user_settings
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      lectures: lecturesRes.rows.map((l) => ({
        ...l.payload,
        id: l.client_id || l.id,
        clientId: l.client_id,
        version: l.version,
        updatedAt: l.updated_at,
        createdAt: l.created_at,
      })),
      decks: hydratedDecks,
      practiceProgress: practiceProgressMap,
      activity: activityRes.rows,
      settings: settingsRes.rows[0] || { character_preference: 'girl', timezone: 'UTC' },
    });
  } catch (err: any) {
    console.error('[Hydration Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to hydrate user cloud data.' });
  }
});

// ============================================================================
// 2. LECTURES: GET, POST, PUT, DELETE
// ============================================================================
router.get('/lectures', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT id, client_id, title, subject, note_style, payload, version, created_at, updated_at
       FROM lectures
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    const lectures = result.rows.map((r) => ({
      ...r.payload,
      id: r.client_id,
      clientId: r.client_id,
      serverDbId: r.id,
      version: r.version,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ lectures });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list user lectures.' });
  }
});

router.post('/lectures', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { clientId, version = 1 } = req.body;
    const notePayload = req.body.payload || req.body.note;

    if (!clientId || !notePayload || typeof notePayload !== 'object') {
      res.status(400).json({ error: 'Missing clientId or lecture note payload.' });
      return;
    }

    const title = req.body.title || notePayload.title || 'Class Notes';
    const subject = req.body.subject || notePayload.subject || 'General';
    const noteStyle = req.body.noteStyle || notePayload.noteStyle || 'cornell';

    const result = await query(
      `INSERT INTO lectures (user_id, client_id, title, subject, note_style, payload, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())
       ON CONFLICT (user_id, client_id) DO UPDATE SET
         title = EXCLUDED.title,
         subject = EXCLUDED.subject,
         note_style = EXCLUDED.note_style,
         payload = EXCLUDED.payload,
         version = lectures.version + 1,
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING id, client_id, title, subject, version, updated_at`,
      [userId, clientId, title, subject, noteStyle, JSON.stringify(notePayload), version]
    );

    const row = result.rows[0];
    res.status(200).json({
      message: 'Lecture saved to cloud.',
      id: row.id,
      client_id: row.client_id,
      title: row.title,
      subject: row.subject,
      version: row.version,
      updated_at: row.updated_at,
      lecture: row,
    });
  } catch (err: any) {
    console.error('[Save Lecture Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to save lecture to cloud.' });
  }
});

router.delete('/lectures/:targetId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { targetId } = req.params;

    // Soft deletion: matches either client_id or UUID id
    const result = await query(
      `UPDATE lectures
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND (client_id = $2 OR id::text = $2) AND deleted_at IS NULL
       RETURNING id`,
      [userId, targetId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lecture not found or already deleted.' });
      return;
    }

    res.json({ message: 'Lecture deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete lecture.' });
  }
});

// ============================================================================
// 3. PRACTICE PROGRESS: POST, GET
// ============================================================================
router.post('/practice/progress', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { lectureClientId, lectureId, itemId, confidence, difficulty = 'medium' } = req.body;

    if (!itemId || !confidence) {
      res.status(400).json({ error: 'Missing itemId or confidence.' });
      return;
    }

    // Resolve lecture_id if lectureId or lectureClientId provided
    let lectureDbId: string | null = null;
    const targetLecture = lectureId || lectureClientId;
    if (targetLecture) {
      const lRes = await query(
        `SELECT id FROM lectures WHERE user_id = $1 AND (id::text = $2 OR client_id = $2) LIMIT 1`,
        [userId, targetLecture]
      );
      if (lRes.rows.length > 0) {
        lectureDbId = lRes.rows[0].id;
      }
    }

    if (lectureDbId) {
      await query(
        `INSERT INTO practice_progress (user_id, lecture_id, item_id, confidence, difficulty, review_count, last_reviewed_at)
         VALUES ($1, $2, $3, $4, $5, 1, NOW())
         ON CONFLICT (user_id, lecture_id, item_id) DO UPDATE SET
           confidence = EXCLUDED.confidence,
           difficulty = EXCLUDED.difficulty,
           review_count = practice_progress.review_count + 1,
           last_reviewed_at = NOW()`,
        [userId, lectureDbId, itemId, confidence, difficulty]
      );
    } else {
      const existing = await query(
        `SELECT id, review_count FROM practice_progress WHERE user_id = $1 AND lecture_id IS NULL AND item_id = $2`,
        [userId, itemId]
      );
      if (existing.rows.length > 0) {
        await query(
          `UPDATE practice_progress
           SET confidence = $1, difficulty = $2, review_count = review_count + 1, last_reviewed_at = NOW()
           WHERE id = $3`,
          [confidence, difficulty, existing.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO practice_progress (user_id, lecture_id, item_id, confidence, difficulty, review_count, last_reviewed_at)
           VALUES ($1, NULL, $2, $3, $4, 1, NOW())`,
          [userId, itemId, confidence, difficulty]
        );
      }
    }

    res.json({ message: 'Practice progress recorded.' });
  } catch (err: any) {
    console.error('[Practice Progress Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to record practice progress.' });
  }
});

// ============================================================================
// 4. FLASHCARD DECKS: GET, POST, DELETE
// ============================================================================
router.get('/flashcards/decks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const decksRes = await query(
      `SELECT id, client_id, title, description, subject, color_theme, created_at, updated_at
       FROM flashcard_decks
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    const deckDbIds = decksRes.rows.map((d) => d.id);
    let cardsMap: Record<string, any[]> = {};

    if (deckDbIds.length > 0) {
      const cardsRes = await query(
        `SELECT c.id, c.deck_id, c.client_id, c.question, c.answer, c.tag, c.position,
                p.confidence, p.review_count
         FROM flashcards c
         LEFT JOIN flashcard_progress p ON p.flashcard_id = c.id AND p.user_id = $1
         WHERE c.deck_id = ANY($2::uuid[])
         ORDER BY c.position ASC`,
        [userId, deckDbIds]
      );

      for (const c of cardsRes.rows) {
        if (!cardsMap[c.deck_id]) cardsMap[c.deck_id] = [];
        cardsMap[c.deck_id].push({
          id: c.client_id || c.id,
          front: c.question,
          back: c.answer,
          tag: c.tag,
          known: c.confidence === 'known',
        });
      }
    }

    const decks = decksRes.rows.map((d) => ({
      id: d.client_id || d.id,
      title: d.title,
      description: d.description || '',
      subject: d.subject || '',
      colorTheme: d.color_theme,
      createdAt: d.created_at,
      lastStudiedAt: d.updated_at,
      cards: cardsMap[d.id] || [],
    }));

    res.json({ decks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list flashcard decks.' });
  }
});

router.post('/flashcards/decks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { clientId, title, description, subject, colorTheme, cards } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required for flashcard deck.' });
      return;
    }

    const clientDeckId = clientId || `deck-${Date.now()}`;

    // Transactional deck creation with its cards
    const deckRes = await query(
      `INSERT INTO flashcard_decks (user_id, client_id, title, description, subject, color_theme, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id, client_id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         subject = EXCLUDED.subject,
         color_theme = EXCLUDED.color_theme,
         updated_at = NOW(),
         deleted_at = NULL
       RETURNING id, client_id, title, created_at`,
      [userId, clientDeckId, title, description || '', subject || '', colorTheme || 'lavender']
    );

    const deckDbId = deckRes.rows[0].id;

    if (Array.isArray(cards) && cards.length > 0) {
      // Clear existing cards for this deck to maintain position order
      await query('DELETE FROM flashcards WHERE deck_id = $1', [deckDbId]);

      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        await query(
          `INSERT INTO flashcards (deck_id, client_id, question, answer, tag, position, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [deckDbId, c.id || `card-${Date.now()}-${i}`, c.front || '', c.back || '', c.tag || 'High-Yield', i]
        );
      }
    }

    res.status(200).json({
      message: 'Flashcard deck saved to cloud.',
      id: deckDbId,
      clientId: clientDeckId,
      deckId: deckDbId,
    });
  } catch (err: any) {
    console.error('[Save Deck Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to save flashcard deck.' });
  }
});

router.delete('/flashcards/decks/:targetId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { targetId } = req.params;

    await query(
      `UPDATE flashcard_decks
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND (client_id = $2 OR id::text = $2)`,
      [userId, targetId]
    );

    res.json({ message: 'Deck removed.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete flashcard deck.' });
  }
});

// ============================================================================
// 5. FLASHCARD PROGRESS: POST
// ============================================================================
router.post('/flashcards/progress', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { cardId, confidence = 'known' } = req.body;

    if (!cardId) {
      res.status(400).json({ error: 'Missing cardId.' });
      return;
    }

    // Resolve cardId (could be UUID or client_id)
    const cardRes = await query(
      `SELECT id FROM flashcards WHERE id::text = $1 OR client_id = $1 LIMIT 1`,
      [cardId]
    );

    if (cardRes.rows.length === 0) {
      res.status(404).json({ error: 'Flashcard not found.' });
      return;
    }

    const cardDbId = cardRes.rows[0].id;

    await query(
      `INSERT INTO flashcard_progress (user_id, flashcard_id, confidence, review_count, last_reviewed_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (user_id, flashcard_id) DO UPDATE SET
         confidence = EXCLUDED.confidence,
         review_count = flashcard_progress.review_count + 1,
         last_reviewed_at = NOW()`,
      [userId, cardDbId, confidence]
    );

    res.json({ message: 'Flashcard progress recorded.' });
  } catch (err: any) {
    console.error('[Flashcard Progress Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to record flashcard progress.' });
  }
});

// ============================================================================
// 6. STUDY ACTIVITY & STREAKS
// ============================================================================
router.post('/activity', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { activeSeconds = 60, activityDate } = req.body;
    const targetDate = activityDate || new Date().toISOString().split('T')[0];

    await query(
      `INSERT INTO study_activity_days (user_id, activity_date, active_seconds, sessions_count)
       VALUES ($1, $2::date, $3, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE SET
         active_seconds = study_activity_days.active_seconds + EXCLUDED.active_seconds,
         sessions_count = study_activity_days.sessions_count + 1`,
      [userId, targetDate, activeSeconds]
    );

    res.json({ message: 'Activity logged.' });
  } catch (err: any) {
    console.error('[Activity Log Error]:', err.message || err);
    res.status(500).json({ error: 'Failed to log study activity.' });
  }
});

router.get('/activity', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const resDays = await query(
      `SELECT activity_date, active_seconds, sessions_count
       FROM study_activity_days
       WHERE user_id = $1
       ORDER BY activity_date DESC
       LIMIT 30`,
      [userId]
    );

    res.json({ activityDays: resDays.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch study activity.' });
  }
});

export default router;
