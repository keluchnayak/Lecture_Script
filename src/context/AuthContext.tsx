import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types';
import { syncManager, SyncState } from '../utils/syncManager';
import { localDB } from '../utils/dbStorage';
import { apiFetch } from '../utils/apiClient';

export interface UserSettingsData {
  character_preference?: string;
  timezone?: string;
  preferences?: Record<string, any>;
}

interface AuthContextType {
  user: AuthUser | null;
  isGuest: boolean;
  isLoadingSession: boolean;
  characterPreference: string;
  syncState: { status: SyncState; message: string };
  signIn: (params: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    nickname: string;
    avatar?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  updateProfile: (params: { nickname?: string; avatar?: string }) => Promise<{ success: boolean; error?: string }>;
  updateCharacterPreference: (preference: string) => Promise<void>;
  refreshCloudData: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  isGuest: true,
  isLoadingSession: true,
  characterPreference: 'girl',
  syncState: { status: 'synced', message: 'All changes synced' },
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  continueAsGuest: () => {},
  signOut: async () => {},
  updateProfile: async () => ({ success: false }),
  updateCharacterPreference: async () => {},
  refreshCloudData: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onHydrateNotes?: (notes: any[]) => void;
  onHydrateDecks?: (decks: any[]) => void;
}> = ({ children, onHydrateNotes, onHydrateDecks }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [characterPreference, setCharacterPreference] = useState<string>(() => {
    try {
      return localStorage.getItem('lecturescript_character_preference') || localStorage.getItem('lecturescript_lofi_character') || 'girl';
    } catch {
      return 'girl';
    }
  });
  const [syncState, setSyncState] = useState<{ status: SyncState; message: string }>({
    status: 'synced',
    message: 'Synced with Neon',
  });

  // ── Sync Manager Subscription ──
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((status, message) => {
      setSyncState({ status, message: message || '' });
    });
    return unsubscribe;
  }, []);

  // ── Hydrate Cloud Data for Authenticated User ──
  const performHydration = useCallback(async (userId: string) => {
    try {
      const { lectures, decks, characterPreference: pref } = await syncManager.hydrateFromCloud(userId);
      if (pref) {
        setCharacterPreference(pref);
      }
      if (onHydrateNotes && lectures) {
        onHydrateNotes(lectures);
      }
      if (onHydrateDecks && decks) {
        onHydrateDecks(decks);
      }
    } catch (err) {
      console.warn('[AuthContext] Hydration error:', err);
    }
  }, [onHydrateNotes, onHydrateDecks]);

  // ── Check Authenticated Session on Load (HttpOnly Cookie) ──
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const res = await apiFetch('/api/auth/me', {
          method: 'GET',
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted && data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              nickname: data.user.nickname,
              avatar: data.user.profile_photo_url || '🎓',
              isGuest: false,
              createdAt: data.user.created_at,
            });

            if (data.settings?.character_preference) {
              setCharacterPreference(data.settings.character_preference);
            }

            // Hydrate cloud notes and decks
            await performHydration(data.user.id);
          }
        } else {
          if (mounted) {
            setUser(null); // Guest mode
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session verification check failed:', err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoadingSession(false);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [performHydration]);

  // ── Sign In ──
  const signIn = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to sign in. Please verify your credentials.' };
      }

      const authenticatedUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        nickname: data.user.nickname,
        avatar: data.user.profile_photo_url || '🎓',
        isGuest: false,
        createdAt: data.user.created_at,
      };

      setUser(authenticatedUser);

      if (data.settings?.character_preference) {
        setCharacterPreference(data.settings.character_preference);
      }

      // Hydrate cloud notes & decks
      await performHydration(authenticatedUser.id);

      return { success: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Connection timed out. The server may be waking up from sleep (Render free tier). Please try again in 30 seconds.' };
      }
      if (/failed to fetch/i.test(err?.message || '')) {
        return { success: false, error: 'Unable to reach server. The free-tier backend may be spinning up from sleep (~50s). Please wait a moment and tap again.' };
      }
      return { success: false, error: err.message || 'Network error connecting to authentication server.' };
    }
  };

  // ── Sign Up ──
  const signUp = async ({
    email,
    password,
    nickname,
    avatar,
  }: {
    email: string;
    password: string;
    nickname: string;
    avatar?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          nickname,
          avatar: avatar || '🎓',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }

      const authenticatedUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        nickname: data.user.nickname,
        avatar: data.user.profile_photo_url || '🎓',
        isGuest: false,
        createdAt: data.user.created_at,
      };

      setUser(authenticatedUser);

      if (data.settings?.character_preference) {
        setCharacterPreference(data.settings.character_preference);
      }

      return { success: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Connection timed out. The server may be waking up from sleep (Render free tier). Please try again in 30 seconds.' };
      }
      if (/failed to fetch/i.test(err?.message || '')) {
        return { success: false, error: 'Unable to reach server. The free-tier backend may be spinning up from sleep (~50s). Please wait a moment and tap again.' };
      }
      return { success: false, error: err.message || 'Network error during registration.' };
    }
  };

  // ── Continue As Guest ──
  const continueAsGuest = () => {
    setUser(null);
  };

  // ── Sign Out ──
  const signOut = async () => {
    const currentUserId = user?.id;
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[AuthContext] Sign out call error:', err);
    } finally {
      if (currentUserId) {
        await localDB.clearUserSession(currentUserId);
      }
      setUser(null);
      // Reset to guest defaults
      if (onHydrateNotes) onHydrateNotes([]);
      if (onHydrateDecks) onHydrateDecks([]);
    }
  };

  // ── Update Profile ──
  const updateProfile = async ({
    nickname,
    avatar,
  }: {
    nickname?: string;
    avatar?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ nickname, profilePhotoUrl: avatar }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update profile.' };
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              nickname: data.user.nickname,
              avatar: data.user.profile_photo_url || prev.avatar,
            }
          : null
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Profile update failed.' };
    }
  };

  // ── Update Character Preference ──
  const updateCharacterPreference = async (pref: string) => {
    setCharacterPreference(pref);
    if (user) {
      try {
        await apiFetch('/api/auth/settings', {
          method: 'PUT',
          body: JSON.stringify({ characterPreference: pref }),
        });
      } catch (err) {
        console.warn('[AuthContext] Character preference sync error:', err);
      }
    }
  };

  // ── Manual Refresh Cloud Data ──
  const refreshCloudData = async () => {
    if (user?.id) {
      await performHydration(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest: !user,
        isLoadingSession,
        characterPreference,
        syncState,
        signIn,
        signUp,
        continueAsGuest,
        signOut,
        updateProfile,
        updateCharacterPreference,
        refreshCloudData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return context || defaultAuthContext;
};
