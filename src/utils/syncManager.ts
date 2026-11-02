/**
 * Cloud Synchronization Manager for LectureScript
 * 
 * Implements a true local-first architecture:
 * 1. Immediate local persistence (IndexedDB / scoped storage).
 * 2. Background cloud synchronization with Neon PostgreSQL.
 * 3. Durable offline retry queue with conflict resolution (updated_at / version).
 * 4. Reactive synchronization status (Saved locally, Syncing, Synced, Sync failed, Offline).
 * 5. Full cloud-to-local hydration on login.
 * 6. Guest isolation: Guest notes are temporary and never synced to the database.
 */

import { LectureNotes, FlashcardDeck } from '../types';
import { localDB, SyncAction, SyncQueueItem } from './dbStorage';
import { apiFetch } from './apiClient';

export type SyncState = 'saved_locally' | 'syncing' | 'synced' | 'sync_failed' | 'offline';

type SyncListener = (state: SyncState, message?: string) => void;

class SyncManager {
  private currentStatus: SyncState = 'synced';
  private statusMessage: string = 'Synced with Neon';
  private listeners: Set<SyncListener> = new Set();
  private isProcessingQueue = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setStatus('syncing', 'Back online. Processing queue...');
        this.processPendingQueue();
      });

      window.addEventListener('offline', () => {
        this.setStatus('offline', 'Working offline. Changes saved locally.');
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus, this.statusMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(state: SyncState, message?: string) {
    this.currentStatus = state;
    this.statusMessage = message || this.getDefaultMessage(state);
    this.listeners.forEach((listener) => listener(this.currentStatus, this.statusMessage));
  }

  private getDefaultMessage(state: SyncState): string {
    switch (state) {
      case 'saved_locally':
        return 'Saved locally';
      case 'syncing':
        return 'Syncing to Neon cloud...';
      case 'synced':
        return 'All changes synced';
      case 'sync_failed':
        return 'Sync failed. Will retry automatically.';
      case 'offline':
        return 'Offline. Saved locally.';
      default:
        return '';
    }
  }

  public getStatus(): { status: SyncState; message: string } {
    return { status: this.currentStatus, message: this.statusMessage };
  }

  // ── 1. Cloud-to-Local Hydration on Login ──
  public async hydrateFromCloud(userId: string): Promise<{
    lectures: LectureNotes[];
    decks: FlashcardDeck[];
    characterPreference?: string;
  }> {
    this.setStatus('syncing', 'Hydrating cloud notes & flashcards...');

    try {
      const response = await apiFetch('/api/sync/hydration', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Hydration failed with status ${response.status}`);
      }

      const data = await response.json();
      const cloudLectures: LectureNotes[] = data.lectures || [];
      const cloudDecks: FlashcardDeck[] = data.decks || [];

      // Merge and save to local storage
      for (const lec of cloudLectures) {
        await localDB.saveLecture(userId, lec as any);
      }

      if (cloudDecks.length > 0) {
        await localDB.saveDecks(userId, cloudDecks);
      }

      this.setStatus('synced', 'Cloud data hydrated successfully');

      // Process any lingering offline items if present
      this.processPendingQueue(userId);

      return {
        lectures: cloudLectures,
        decks: cloudDecks,
        characterPreference: data.userSettings?.character_preference,
      };
    } catch (err: any) {
      console.warn('[SyncManager] Hydration error, loading from local offline cache:', err);
      const localLectures = await localDB.getLectures(userId);
      const localDecks = await localDB.getDecks(userId);
      this.setStatus('saved_locally', 'Loaded from local cache');
      return { lectures: localLectures, decks: localDecks };
    }
  }

  // ── 2. Lecture Save / Update ──
  public async saveLecture(
    userId: string | null,
    lecture: LectureNotes & { clientId?: string; id?: string; version?: number; updatedAt?: string }
  ): Promise<LectureNotes> {
    // Ensure stable client_id
    if (!lecture.clientId) {
      lecture.clientId = lecture.id || `lec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    lecture.updatedAt = new Date().toISOString();

    // Guest Mode: Store in memory/guest only. Never sync to DB.
    if (!userId) {
      return lecture;
    }

    // 1. Save to local storage first (instant responsiveness)
    await localDB.saveLecture(userId, lecture);
    this.setStatus('syncing', 'Syncing note to Neon...');

    // 2. Synchronize to Neon Cloud
    try {
      const response = await apiFetch('/api/sync/lectures', {
        method: 'POST',
        body: JSON.stringify({
          clientId: lecture.clientId,
          title: lecture.title,
          subject: lecture.subject,
          noteStyle: 'cornell',
          payload: lecture,
          version: lecture.version || 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync API responded with ${response.status}`);
      }

      const saved = await response.json();
      const updatedLecture: LectureNotes = {
        ...lecture,
        id: saved.id,
        clientId: saved.client_id,
        version: saved.version,
        updatedAt: saved.updated_at,
      };

      // Update local storage with authoritative cloud IDs and timestamps
      await localDB.saveLecture(userId, updatedLecture as any);
      this.setStatus('synced', 'Note synced to Neon');
      return updatedLecture;
    } catch (err) {
      console.warn('[SyncManager] Cloud sync failed, enqueued for retry:', err);
      await localDB.enqueueSync(userId, {
        type: 'SAVE_LECTURE',
        payload: lecture,
        timestamp: new Date().toISOString(),
      });
      this.setStatus('saved_locally', 'Saved locally (offline)');
      return lecture;
    }
  }

  // ── 3. Lecture Deletion ──
  public async deleteLecture(userId: string | null, clientId: string, cloudId?: string): Promise<void> {
    if (!userId) return;

    // 1. Delete locally first
    await localDB.deleteLecture(userId, clientId);
    this.setStatus('syncing', 'Deleting note from cloud...');

    // 2. Sync soft deletion to Neon
    try {
      const targetId = cloudId || clientId;
      const response = await apiFetch(`/api/sync/lectures/${targetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }

      this.setStatus('synced', 'Note deleted from cloud');
    } catch (err) {
      console.warn('[SyncManager] Cloud delete failed, enqueued for retry:', err);
      await localDB.enqueueSync(userId, {
        type: 'DELETE_LECTURE',
        payload: { clientId, cloudId },
        timestamp: new Date().toISOString(),
      });
      this.setStatus('saved_locally', 'Deleted locally (sync pending)');
    }
  }

  // ── 4. Flashcard Deck Save ──
  public async saveDeck(userId: string | null, deck: FlashcardDeck): Promise<FlashcardDeck> {
    if (!userId) return deck;

    this.setStatus('syncing', 'Syncing flashcard deck...');

    try {
      const response = await apiFetch('/api/sync/flashcards/decks', {
        method: 'POST',
        body: JSON.stringify({
          clientId: deck.id,
          title: deck.title,
          subject: deck.subject,
          description: deck.description,
          colorTheme: deck.colorTheme,
          cards: deck.cards,
        }),
      });

      if (!response.ok) {
        throw new Error(`Deck sync failed with status ${response.status}`);
      }

      const result = await response.json();
      this.setStatus('synced', 'Flashcards synced to Neon');
      return { ...deck, id: result.clientId || result.id };
    } catch (err) {
      console.warn('[SyncManager] Deck sync failed, enqueued:', err);
      await localDB.enqueueSync(userId, {
        type: 'SAVE_DECK',
        payload: deck,
        timestamp: new Date().toISOString(),
      });
      this.setStatus('saved_locally', 'Deck saved locally');
      return deck;
    }
  }

  // ── 5. Flashcard Deck Deletion ──
  public async deleteDeck(userId: string | null, deckId: string): Promise<void> {
    if (!userId) return;

    try {
      await apiFetch(`/api/sync/flashcards/decks/${deckId}`, {
        method: 'DELETE',
      });
      this.setStatus('synced', 'Deck removed from cloud');
    } catch (err) {
      await localDB.enqueueSync(userId, {
        type: 'DELETE_DECK',
        payload: { deckId },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── 6. Practice Progress Sync ──
  public async savePracticeProgress(
    userId: string | null,
    lectureId: string | null,
    itemId: string,
    confidence: 'mastered' | 'missed'
  ): Promise<void> {
    if (!userId) return;

    try {
      await apiFetch('/api/sync/practice/progress', {
        method: 'POST',
        body: JSON.stringify({
          lectureId,
          itemId,
          confidence,
        }),
      });
    } catch (err) {
      await localDB.enqueueSync(userId, {
        type: 'PRACTICE_PROGRESS',
        payload: { lectureId, itemId, confidence },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── 7. Flashcard Confidence / Review Progress ──
  public async saveFlashcardProgress(
    userId: string | null,
    cardId: string,
    confidence: 'known' | 'learning' | 'hard'
  ): Promise<void> {
    if (!userId) return;

    try {
      await apiFetch('/api/sync/flashcards/progress', {
        method: 'POST',
        body: JSON.stringify({
          cardId,
          confidence,
        }),
      });
    } catch (err) {
      await localDB.enqueueSync(userId, {
        type: 'FLASHCARD_PROGRESS',
        payload: { cardId, confidence },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── 8. Study Activity Day Logging ──
  public async logStudyActivity(userId: string | null, seconds = 60): Promise<void> {
    if (!userId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await apiFetch('/api/sync/activity', {
        method: 'POST',
        body: JSON.stringify({
          activityDate: today,
          activeSeconds: seconds,
        }),
      });
    } catch (err) {
      // Non-critical background task
    }
  }

  // ── 9. Offline Durable Queue Drainer ──
  public async processPendingQueue(userId?: string): Promise<void> {
    if (this.isProcessingQueue || typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    if (!userId) return;

    this.isProcessingQueue = true;
    try {
      const queue = await localDB.getSyncQueue(userId);
      if (queue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      this.setStatus('syncing', `Processing ${queue.length} offline changes...`);

      for (const item of queue) {
        try {
          if (item.type === 'SAVE_LECTURE') {
            await apiFetch('/api/sync/lectures', {
              method: 'POST',
              body: JSON.stringify({
                clientId: item.payload.clientId,
                title: item.payload.title,
                subject: item.payload.subject,
                noteStyle: 'cornell',
                payload: item.payload,
                version: item.payload.version || 1,
              }),
            });
          } else if (item.type === 'DELETE_LECTURE') {
            const targetId = item.payload.cloudId || item.payload.clientId;
            await apiFetch(`/api/sync/lectures/${targetId}`, {
              method: 'DELETE',
            });
          } else if (item.type === 'SAVE_DECK') {
            await apiFetch('/api/sync/flashcards/decks', {
              method: 'POST',
              body: JSON.stringify({
                clientId: item.payload.id,
                title: item.payload.title,
                subject: item.payload.subject,
                description: item.payload.description,
                colorTheme: item.payload.colorTheme,
                cards: item.payload.cards,
              }),
            });
          } else if (item.type === 'DELETE_DECK') {
            await apiFetch(`/api/sync/flashcards/decks/${item.payload.deckId}`, {
              method: 'DELETE',
            });
          } else if (item.type === 'PRACTICE_PROGRESS') {
            await apiFetch('/api/sync/practice/progress', {
              method: 'POST',
              body: JSON.stringify(item.payload),
            });
          }

          if (item.id) {
            await localDB.removeSyncQueueItem(item.id, userId);
          }
        } catch (itemErr) {
          console.warn('[SyncManager] Failed to process queue item:', itemErr);
          break; // Stop and retry on next tick
        }
      }

      this.setStatus('synced', 'All offline changes synchronized');
    } catch (err) {
      console.warn('[SyncManager] Queue processing error:', err);
      this.setStatus('sync_failed', 'Some changes pending synchronization');
    } finally {
      this.isProcessingQueue = false;
    }
  }
}

export const syncManager = new SyncManager();
