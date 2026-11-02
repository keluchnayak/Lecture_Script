/**
 * Local-First IndexedDB and Scoped Storage Layer for LectureScript
 * 
 * Provides robust offline storage for heavy lecture payloads, Cornell notes,
 * flashcard decks, practice progress, and a persistent sync retry queue.
 * Ensures strict user isolation: User A's data is never visible to User B or Guests.
 */

import { LectureNotes, FlashcardDeck } from '../types';

export interface SyncAction {
  type:
    | 'SAVE_LECTURE'
    | 'DELETE_LECTURE'
    | 'SAVE_DECK'
    | 'DELETE_DECK'
    | 'PRACTICE_PROGRESS'
    | 'FLASHCARD_PROGRESS'
    | 'STUDY_ACTIVITY';
  payload: any;
  timestamp: string;
}

export interface SyncQueueItem extends SyncAction {
  id?: number;
  userId: string;
  retries: number;
}

const DB_NAME = 'LectureScriptLocalDB';
const DB_VERSION = 1;

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported = typeof window !== 'undefined' && 'indexedDB' in window;

  private getDB(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error('IndexedDB not supported'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('lectures')) {
            const lectureStore = db.createObjectStore('lectures', { keyPath: 'storageKey' });
            lectureStore.createIndex('userId', 'userId', { unique: false });
            lectureStore.createIndex('clientId', 'clientId', { unique: false });
          }

          if (!db.objectStoreNames.contains('decks')) {
            const deckStore = db.createObjectStore('decks', { keyPath: 'storageKey' });
            deckStore.createIndex('userId', 'userId', { unique: false });
          }

          if (!db.objectStoreNames.contains('sync_queue')) {
            const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
            queueStore.createIndex('userId', 'userId', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  // ── Lecture Methods ──

  async saveLecture(userId: string, lecture: LectureNotes & { clientId?: string; id?: string; version?: number; updatedAt?: string }): Promise<void> {
    const clientId = lecture.clientId || lecture.id || `lec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storageKey = `${userId}:${clientId}`;
    const record = {
      storageKey,
      userId,
      clientId,
      lecture: {
        ...lecture,
        clientId,
        updatedAt: lecture.updatedAt || new Date().toISOString(),
        version: lecture.version || 1,
      },
      updatedAt: lecture.updatedAt || new Date().toISOString(),
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('lectures', 'readwrite');
        const store = tx.objectStore('lectures');
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to user-scoped localStorage
      try {
        const key = `ls_notes_${userId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = existing.filter((item: any) => item.clientId !== clientId && !(item.title === lecture.title && item.subject === lecture.subject));
        localStorage.setItem(key, JSON.stringify([record.lecture, ...filtered]));
      } catch (err) {
        console.warn('[Storage] Local fallback failed:', err);
      }
    }
  }

  async getLectures(userId: string): Promise<LectureNotes[]> {
    try {
      const db = await this.getDB();
      return await new Promise<LectureNotes[]>((resolve, reject) => {
        const tx = db.transaction('lectures', 'readonly');
        const store = tx.objectStore('lectures');
        const index = store.index('userId');
        const req = index.getAll(userId);

        req.onsuccess = () => {
          const rows = req.result || [];
          const sorted = rows
            .map((r: any) => r.lecture)
            .sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
          resolve(sorted);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage
      try {
        const key = `ls_notes_${userId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }
  }

  async deleteLecture(userId: string, clientId: string): Promise<void> {
    const storageKey = `${userId}:${clientId}`;
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('lectures', 'readwrite');
        const store = tx.objectStore('lectures');
        const req = store.delete(storageKey);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const key = `ls_notes_${userId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = existing.filter((item: any) => item.clientId !== clientId);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {}
    }
  }

  // ── Flashcard Decks Methods ──

  async saveDecks(userId: string, decks: FlashcardDeck[]): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('decks', 'readwrite');
        const store = tx.objectStore('decks');
        const req = store.put({
          storageKey: `decks:${userId}`,
          userId,
          decks,
          updatedAt: new Date().toISOString(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        localStorage.setItem(`ls_decks_${userId}`, JSON.stringify(decks));
      } catch {}
    }
  }

  async getDecks(userId: string): Promise<FlashcardDeck[]> {
    try {
      const db = await this.getDB();
      return await new Promise<FlashcardDeck[]>((resolve, reject) => {
        const tx = db.transaction('decks', 'readonly');
        const store = tx.objectStore('decks');
        const req = store.get(`decks:${userId}`);
        req.onsuccess = () => resolve(req.result ? req.result.decks : []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const data = localStorage.getItem(`ls_decks_${userId}`);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }
  }

  // ── Sync Queue Methods ──

  async enqueueSync(userId: string, action: SyncAction): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...action,
      userId,
      retries: 0,
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.add(queueItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const key = `ls_sync_queue_${userId}`;
        const queue: SyncQueueItem[] = JSON.parse(localStorage.getItem(key) || '[]');
        queue.push({ ...queueItem, id: Date.now() });
        localStorage.setItem(key, JSON.stringify(queue));
      } catch {}
    }
  }

  async getSyncQueue(userId: string): Promise<SyncQueueItem[]> {
    try {
      const db = await this.getDB();
      return await new Promise<SyncQueueItem[]>((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const index = store.index('userId');
        const req = index.getAll(userId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const key = `ls_sync_queue_${userId}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
      } catch {
        return [];
      }
    }
  }

  async removeSyncQueueItem(id: number, userId?: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (userId) {
        try {
          const key = `ls_sync_queue_${userId}`;
          const queue: SyncQueueItem[] = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = queue.filter((item) => item.id !== id);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
    }
  }

  // ── Clean User Cache upon Logout ──
  async clearUserSession(userId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['lectures', 'decks', 'sync_queue'], 'readwrite');
      
      // Clean lectures index
      const lectureStore = tx.objectStore('lectures');
      const lecIndex = lectureStore.index('userId');
      const req = lecIndex.getAll(userId);
      req.onsuccess = () => {
        for (const item of req.result || []) {
          lectureStore.delete(item.storageKey);
        }
      };

      // Clean decks
      const deckStore = tx.objectStore('decks');
      deckStore.delete(`decks:${userId}`);

      // Clean sync queue
      const queueStore = tx.objectStore('sync_queue');
      const qIndex = queueStore.index('userId');
      const qReq = qIndex.getAll(userId);
      qReq.onsuccess = () => {
        for (const item of qReq.result || []) {
          queueStore.delete(item.id);
        }
      };
    } catch {
      try {
        localStorage.removeItem(`ls_notes_${userId}`);
        localStorage.removeItem(`ls_decks_${userId}`);
        localStorage.removeItem(`ls_sync_queue_${userId}`);
      } catch {}
    }
  }
}

export const localDB = new LocalDatabase();
