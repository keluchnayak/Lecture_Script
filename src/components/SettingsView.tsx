import React, { useState } from 'react';
import { Settings, Key, ShieldCheck, Check, RotateCcw, Sparkles, User, LogIn, LogOut, Compass } from 'lucide-react';
import { NavRoute } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onClearAllNotes: () => void;
  onNavigate?: (route: NavRoute) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  apiKey,
  onSaveApiKey,
  onClearAllNotes,
  onNavigate,
}) => {
  const { user, isGuest, signOut, updateProfile, syncState } = useAuth();
  const [inputKey, setInputKey] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [editNickname, setEditNickname] = useState(user?.nickname || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(inputKey.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNickname.trim()) return;
    setProfileSaving(true);
    try {
      await updateProfile({ nickname: editNickname.trim() });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2"
          style={{
            background: 'rgba(220, 212, 255, 0.7)',
            color: 'var(--color-primary-dark)',
            border: '1px solid rgba(184, 168, 255, 0.6)',
          }}
        >
          <Settings className="w-3.5 h-3.5 text-violet-600" />
          <span>App Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242238]">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6888] mt-1">
          Manage your account profile, Neon cloud sync, and Gemini AI key.
        </p>
      </div>

      {/* Account & Access Card */}
      <div
        className="glass-panel-elevated p-6 sm:p-7 rounded-3xl border"
        style={{ borderColor: 'rgba(220, 212, 255, 0.8)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-sm shrink-0"
              style={{
                background: user
                  ? 'linear-gradient(135deg, #7456E8 0%, #9B82F3 100%)'
                  : 'linear-gradient(135deg, #A29BB8 0%, #C4BEDA 100%)',
              }}
            >
              {user?.avatar || (user ? user.nickname.slice(0, 2).toUpperCase() : '👤')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#242238]">
                  {user ? user.nickname : 'Guest Learner'}
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: user ? 'rgba(220, 212, 255, 0.8)' : '#F3F0FF',
                    color: user ? '#5E40D4' : '#6B6888',
                  }}
                >
                  {user ? 'Neon Cloud Account' : 'Guest Mode'}
                </span>
              </div>
              <p className="text-xs text-[#6B6888] mt-0.5">
                {user
                  ? `${user.email} • Synced with Neon PostgreSQL`
                  : 'Currently studying as guest. Notes and cards are saved in local browser storage.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('auth')}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>

        {/* User Profile Edit Form (When authenticated) */}
        {user && (
          <form onSubmit={handleUpdateProfile} className="mt-5 pt-5 border-t border-violet-100 flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-[#242238] mb-1.5">
                Display Nickname
              </label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="Enter your nickname"
                className="glass-input w-full px-3.5 py-2 rounded-xl text-xs text-[#242238] border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {profileSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{profileSaving ? 'Saving...' : 'Update Nickname'}</span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* API Key Card */}
      <div
        className="glass-panel-elevated p-6 sm:p-7 rounded-3xl border"
        style={{ borderColor: 'rgba(220, 212, 255, 0.8)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#242238]">
              Google Gemini API Key
            </h2>
            <p className="text-xs text-[#6B6888]">
              Optional: Provide your own free Gemini API key to generate live notes directly.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#242238] mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2.5 rounded-xl border bg-white/90 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
              style={{ borderColor: 'rgba(220, 212, 255, 0.8)' }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#6B6888] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Stored privately in your browser's local storage.
            </span>

            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Theme Info */}
      <div
        className="glass-panel p-6 rounded-3xl border"
        style={{ borderColor: 'rgba(220, 212, 255, 0.6)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#242238]">
              Design Theme: Lavender Focus
            </h2>
            <p className="text-xs text-[#6B6888]">
              Aesthetic lavender canvas, violet primary actions, and clean note sheets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <span className="w-6 h-6 rounded-full border shadow-sm" style={{ background: '#7456E8' }} title="Primary Violet" />
          <span className="w-6 h-6 rounded-full border shadow-sm" style={{ background: '#DCD4FF' }} title="Soft Accent" />
          <span className="w-6 h-6 rounded-full border shadow-sm" style={{ background: '#F7F5FF' }} title="Canvas" />
          <span className="w-6 h-6 rounded-full border shadow-sm" style={{ background: '#FFFFFF' }} title="Surface" />
          <span className="w-6 h-6 rounded-full border shadow-sm" style={{ background: '#242238' }} title="Text Navy" />
        </div>
      </div>

      {/* Data Management Card */}
      <div
        className="glass-panel p-6 rounded-3xl border border-red-100"
        style={{ background: 'rgba(255, 255, 255, 0.7)' }}
      >
        <h2 className="text-sm font-bold text-red-900 mb-1">
          Reset Saved Data
        </h2>
        <p className="text-xs text-[#6B6888] mb-4">
          Clears all saved lecture notes and cached history from your browser storage.
        </p>

        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to delete all saved notes from your library?')) {
              onClearAllNotes();
            }
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
        >
          Clear Saved Notes
        </button>
      </div>
    </div>
  );
};
