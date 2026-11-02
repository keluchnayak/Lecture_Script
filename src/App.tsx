import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, AlertCircle, Info, RefreshCw, Sparkles, Search, AlertTriangle, User, LogIn, LogOut, ChevronDown } from 'lucide-react';
import { Sidebar, NavRoute } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { TranscriptInput } from './components/TranscriptInput';
import { NotebookView } from './components/NotebookView';
import { PracticeView } from './components/PracticeView';
import { FlashcardsView } from './components/FlashcardsView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { Footer } from './components/Footer';
import { LectureNotes, NoteDensity, NoteStyle } from './types';
import { SoundscapeProvider } from './context/SoundscapeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SoundscapeHeaderControl } from './components/soundscape/SoundscapeHeaderControl';
import { SoundMixerModal } from './components/soundscape/SoundMixerModal';
import { localDB } from './utils/dbStorage';
import { syncManager } from './utils/syncManager';
import { apiFetch } from './utils/apiClient';

const API_KEY_STORAGE = 'lecturescript_gemini_key';

export default function App() {
  const { user, isGuest, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // ── Router & Navigation State ──
  const [currentRoute, setCurrentRoute] = useState<NavRoute>(() => {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (['home', 'studio', 'flashcards', 'practice', 'library', 'settings', 'auth'].includes(hash)) {
      return hash as NavRoute;
    }
    return 'home';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Preselected Flashcard Lecture (from Study Studio) ──
  const [preselectedFlashcardLecture, setPreselectedFlashcardLecture] = useState<LectureNotes | null>(null);

  // ── Study Studio State (Preserved across SPA navigation) ──
  const [notes, setNotes] = useState<LectureNotes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Persistent Library State (User-Scoped & Local-First) ──
  const [savedNotes, setSavedNotes] = useState<LectureNotes[]>([]);

  // Hydrate user-scoped notes on auth state change
  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      localDB.getLectures(user.id).then((cached) => {
        if (mounted && cached) {
          setSavedNotes(cached);
        }
      });
    } else {
      // Guest: clean memory session only
      setSavedNotes([]);
    }
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // ── Custom User API Key State (Stored locally only) ──
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  });

  // ── Sync Route with Browser History / Back-Forward ──
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (['home', 'studio', 'flashcards', 'practice', 'library', 'settings', 'auth'].includes(hash)) {
        setCurrentRoute(hash as NavRoute);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleNavigate = useCallback((newRoute: NavRoute) => {
    if (newRoute === currentRoute) return;

    // Trigger lightweight smooth transition
    setIsTransitioning(true);
    window.location.hash = `#/${newRoute}`;
    setCurrentRoute(newRoute);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 180);
  }, [currentRoute]);

  // ── Save Notes to Local Storage & Cloud Sync ──
  const saveNoteToLibrary = async (newNote: LectureNotes) => {
    if (user?.id) {
      const updated = await syncManager.saveLecture(user.id, newNote);
      setSavedNotes((prev) => {
        const filtered = prev.filter(
          (n) => n.clientId !== updated.clientId && !(n.title === updated.title && n.subject === updated.subject)
        );
        return [updated, ...filtered];
      });
    } else {
      // Guest: memory-only storage
      setSavedNotes((prev) => {
        const filtered = prev.filter(
          (n) => !(n.title === newNote.title && n.subject === newNote.subject)
        );
        return [newNote, ...filtered];
      });
    }
  };

  const handleDeleteSavedNote = async (index: number) => {
    const noteToDelete = savedNotes[index];
    if (!noteToDelete) return;

    if (user?.id) {
      await syncManager.deleteLecture(user.id, noteToDelete.clientId || noteToDelete.id || '', noteToDelete.id);
    }
    setSavedNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllNotes = async () => {
    if (user?.id) {
      for (const note of savedNotes) {
        await syncManager.deleteLecture(user.id, note.clientId || note.id || '', note.id);
      }
    }
    setSavedNotes([]);
  };

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    try {
      if (newKey) {
        localStorage.setItem(API_KEY_STORAGE, newKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
      }
    } catch {}
  };

  // ── Generate Notes API Call ──
  const handleGenerateNotes = async (params: {
    transcript: string;
    subject: string;
    noteStyle: NoteStyle;
    density: NoteDensity;
    includeDiagramPrompts: boolean;
    includeExamCues: boolean;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/generate-notes', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          userApiKey: apiKey || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data: LectureNotes = await response.json();
      setNotes(data);
      saveNoteToLibrary(data);
    } catch (err: any) {
      console.error('Failed to generate notes:', err);
      setError(err.message || 'Something went wrong while generating notes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SoundscapeProvider>
      <div className="min-h-screen text-[#242238] font-sans antialiased relative overflow-x-hidden flex flex-col sm:flex-row">
      {/* ── Ambient Soft Lavender Glow Elements (Layered Depth) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden" aria-hidden="true">
        <div 
          className="absolute -top-32 -left-20 w-96 h-96 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(220, 212, 255, 0.8) 0%, rgba(206, 192, 255, 0) 70%)' }}
        />
        <div 
          className="absolute top-1/3 -right-24 w-[30rem] h-[30rem] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(184, 168, 255, 0.5) 0%, rgba(247, 245, 255, 0) 70%)' }}
        />
        <div 
          className="absolute bottom-10 left-1/4 w-80 h-80 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(220, 212, 255, 0.6) 0%, rgba(247, 245, 255, 0) 70%)' }}
        />
      </div>

      {/* ── PERMANENT CURVED PURPLE LIQUID GLASS SIDEBAR ── */}
      <Sidebar
        currentRoute={currentRoute}
        onRouteChange={handleNavigate}
        hasActiveNotes={Boolean(notes)}
      />

      {/* ── MAIN CONTENT AREA (Offset for Persistent Left Sidebar) ── */}
      <div className="flex-1 flex flex-col min-h-screen sm:pl-[84px] relative z-10 transition-all">
        {/* ── Seamless Blended Top Bar (Natural Glass & Lavender Canvas) ── */}
        <header
          className="print:hidden sticky top-0 z-30 transition-all"
          style={{
            background: 'rgba(247, 245, 255, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(220, 212, 255, 0.45)',
          }}
        >
          <div className="w-full px-6 lg:px-8 h-16 flex items-center justify-between gap-4 relative z-10">
            {/* Left: Active Section Indicator (Read-only, navigation happens in the sidebar) */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold"
                style={{
                  background: 'rgba(255, 255, 255, 0.75)',
                  borderColor: 'rgba(220, 212, 255, 0.75)',
                  color: '#5E40D4',
                  boxShadow: '0 2px 8px -2px rgba(116, 86, 232, 0.06)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                <span className="tracking-tight">
                  {currentRoute === 'home' && 'Dashboard'}
                  {currentRoute === 'studio' && 'Study Studio'}
                  {currentRoute === 'flashcards' && 'Flashcards Hub'}
                  {currentRoute === 'practice' && 'Practice & Recall'}
                  {currentRoute === 'library' && 'Notes Library'}
                  {currentRoute === 'settings' && 'Workspace Settings'}
                  {currentRoute === 'auth' && 'Account & Access'}
                </span>
              </div>
            </div>

            {/* Center: Search / Workspace status bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-2">
              <div
                className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-full text-xs border"
                style={{
                  background: 'rgba(255, 255, 255, 0.75)',
                  borderColor: 'rgba(220, 212, 255, 0.75)',
                  color: '#6B6888',
                  boxShadow: '0 2px 8px -2px rgba(116, 86, 232, 0.05)',
                }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Search className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-[#6B6888]">
                    LectureScript AI Study Workspace
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 text-[10px] font-semibold rounded-full border text-violet-600"
                  style={{
                    background: 'rgba(220, 212, 255, 0.4)',
                    borderColor: 'rgba(184, 168, 255, 0.6)',
                  }}
                >
                  Focus Active
                </span>
              </div>
            </div>

            {/* Right: Actions, AI Engine Badge, Student Profile / Auth */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* AI Engine Status Pill */}
              <div
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  borderColor: 'rgba(220, 212, 255, 0.7)',
                  color: '#5E40D4',
                }}
                title="Powered by Gemini Flash AI"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Gemini 3.1</span>
              </div>


              {/* Compact Sounds & Music Audio Control */}
              <SoundscapeHeaderControl />

              {/* Action Button: Reset active notes within studio (not navigation) */}
              {currentRoute === 'studio' && notes && (
                <button
                  onClick={() => setNotes(null)}
                  className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Start New Notes</span>
                </button>
              )}

              {/* Interactive Student Authentication / Profile Dropdown */}
              <div className="relative">
                {user ? (
                  // Logged In (Mock Session)
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border transition-all cursor-pointer hover:shadow-xs"
                      style={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        borderColor: 'rgba(220, 212, 255, 0.9)',
                        boxShadow: '0 2px 8px -2px rgba(116, 86, 232, 0.1)',
                      }}
                      title={`Logged in as ${user.nickname} (Mock Session)`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                        style={{
                          background: 'linear-gradient(135deg, #7456E8 0%, #9B82F3 100%)',
                        }}
                      >
                        {user.avatar || user.nickname.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-[#242238] max-w-[90px] truncate hidden sm:inline">
                        {user.nickname}
                      </span>
                      <ChevronDown className="w-3 h-3 text-[#6B6888]" />
                    </button>

                    {/* User Dropdown Menu */}
                    {isUserMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsUserMenuOpen(false)}
                        />
                        <div
                          className="absolute right-0 top-11 z-50 w-56 rounded-2xl p-3 border shadow-xl animate-fadeIn"
                          style={{
                            background: 'rgba(255, 255, 255, 0.96)',
                            backdropFilter: 'blur(16px)',
                            borderColor: 'rgba(220, 212, 255, 0.9)',
                            boxShadow: '0 12px 32px -4px rgba(116, 86, 232, 0.18)',
                          }}
                        >
                          <div className="px-2.5 py-2 border-b border-violet-100 mb-2">
                            <span className="text-xs font-extrabold text-[#242238] block truncate">
                              {user.nickname}
                            </span>
                            <span className="text-[11px] text-[#6B6888] block truncate">
                              {user.email}
                            </span>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                              Mock Session
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              handleNavigate('settings');
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#242238] hover:bg-violet-50 transition-colors cursor-pointer text-left"
                          >
                            <User className="w-3.5 h-3.5 text-violet-600" />
                            <span>Workspace Settings</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              signOut();
                              handleNavigate('home');
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left mt-1"
                          >
                            <LogOut className="w-3.5 h-3.5 text-red-500" />
                            <span>Sign Out (Switch to Guest)</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // Guest Mode: Sign In Trigger
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavigate('auth')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(247, 245, 255, 0.9) 100%)',
                        borderColor: 'rgba(220, 212, 255, 0.9)',
                        color: '#5E40D4',
                      }}
                      title="Sign In or Create Account"
                    >
                      <LogIn className="w-3.5 h-3.5 text-violet-600" />
                      <span className="hidden sm:inline">Sign In</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavigate('auth')}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] text-white shadow-sm select-none cursor-pointer hover:scale-105 transition-transform"
                      style={{
                        background: 'linear-gradient(135deg, #7456E8 0%, #9B82F3 100%)',
                        boxShadow: '0 2px 8px rgba(116, 86, 232, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
                      }}
                      title="Guest Profile • Click to Sign In"
                    >
                      GS
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Dynamic Page Content with Subtle Micro-Transition ── */}
        <main
          className={`flex-1 w-full px-6 lg:px-8 py-6 sm:py-8 relative z-10 transition-opacity duration-200 ease-out ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Global Error Banner */}
          {error && currentRoute === 'studio' && (
            <div
              className="mb-6 p-4 rounded-2xl flex items-start justify-between gap-3 text-sm border max-w-5xl mx-auto"
              style={{ background: '#FFF5F5', borderColor: '#FECACA', color: '#991B1B' }}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                <div>
                  <span className="font-bold block">Could Not Create Notes</span>
                  <p className="text-xs mt-0.5" style={{ color: '#B91C1C' }}>{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-xs font-medium hover:underline cursor-pointer"
                style={{ color: '#B91C1C' }}
              >
                Close
              </button>
            </div>
          )}

          {/* Global Demo Preview & Fallback Banner */}
          {(notes?.isDemoFallback || notes?.isDemo) && (
            <div
              className="mb-6 p-4 rounded-2xl flex items-start justify-between gap-3 text-xs border max-w-5xl mx-auto animate-fadeIn shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                borderColor: '#FCD34D',
                color: '#78350F',
              }}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-amber-900">
                    {notes.isDemoFallback ? 'Offline Demo Notes Active' : 'Sample Preview'}
                  </span>
                  <p className="leading-relaxed text-amber-800">
                    {notes.message || 'Using offline demo notes — add a valid Gemini API key in Settings to process your transcript.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleNavigate('settings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer shrink-0"
              >
                Settings
              </button>
            </div>
          )}

          {/* ── SPA PAGE ROUTING ── */}
          {currentRoute === 'home' && (
            <HomeView onNavigate={handleNavigate} />
          )}

          {/* 1st Thing: Study Studio Feature - Complete End-to-End Workflow */}
          {currentRoute === 'studio' && (
            <>
              {notes ? (
                <NotebookView
                  notes={notes}
                  onBack={() => setNotes(null)}
                  onSendToFlashcards={(lecture) => {
                    setPreselectedFlashcardLecture(lecture);
                    handleNavigate('flashcards');
                  }}
                />
              ) : (
                <TranscriptInput onGenerate={handleGenerateNotes} isLoading={isLoading} />
              )}
            </>
          )}

          {/* Flashcards Feature: Active Recall Deck Hub & Zen Study Mode */}
          {currentRoute === 'flashcards' && (
            <FlashcardsView
              savedNotes={savedNotes}
              onNavigate={handleNavigate}
              preselectedLecture={preselectedFlashcardLecture}
              onClearPreselectedLecture={() => setPreselectedFlashcardLecture(null)}
              apiKey={apiKey}
            />
          )}

          {currentRoute === 'practice' && (
            <PracticeView
              notes={notes}
              savedNotes={savedNotes}
              onSelectLecture={(selected) => setNotes(selected)}
              onNavigate={handleNavigate}
            />
          )}

          {currentRoute === 'library' && (
            <LibraryView
              savedNotes={savedNotes}
              onLoadNote={(selectedNote) => setNotes(selectedNote)}
              onDeleteNote={handleDeleteSavedNote}
              onNavigate={handleNavigate}
            />
          )}

          {currentRoute === 'auth' && (
            <AuthView onNavigate={handleNavigate} />
          )}

          {currentRoute === 'settings' && (
            <SettingsView
              apiKey={apiKey}
              onSaveApiKey={handleSaveApiKey}
              onClearAllNotes={handleClearAllNotes}
              onNavigate={handleNavigate}
            />
          )}

          {/* ── Sleek Minimalist Footer ── */}
          <Footer />
        </main>
      </div>
    </div>

    {/* ── Global Persistent Sounds & Music Popup Modal ── */}
    <SoundMixerModal />
  </SoundscapeProvider>
);
}

