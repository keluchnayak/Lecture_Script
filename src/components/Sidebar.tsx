import React from 'react';
import {
  Home,
  Sparkles,
  Layers,
  Brain,
  FolderOpen,
  Settings,
  LucideIcon
} from 'lucide-react';

export type NavRoute = 'home' | 'studio' | 'flashcards' | 'practice' | 'library' | 'settings' | 'auth';

export interface NavItemConfig {
  id: NavRoute;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface SidebarProps {
  currentRoute: NavRoute;
  onRouteChange: (route: NavRoute) => void;
  hasActiveNotes?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'studio', label: 'Study Studio', icon: Sparkles },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'practice', label: 'Practice', icon: Brain },
  { id: 'library', label: 'Library', icon: FolderOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  hasActiveNotes = false,
}) => {
  return (
    <>
      {/* ── DESKTOP & TABLET CURVED LIQUID GLASS SIDEBAR ── */}
      <aside
        className="hidden sm:flex flex-col items-center justify-between fixed top-0 left-0 bottom-0 z-40 select-none transition-all duration-300"
        style={{ width: '84px' }}
        aria-label="Main Navigation"
      >
        {/* Curved Liquid Purple Silhouette (Organic SVG Background) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-visible" style={{ width: '106px' }}>
          <svg
            className="w-full h-full drop-shadow-[4px_0_20px_rgba(116,86,232,0.3)]"
            viewBox="0 0 106 800"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="liquidSidebarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#674BE8" />
                <stop offset="35%" stopColor="#7456E8" />
                <stop offset="100%" stopColor="#5131D7" />
              </linearGradient>
              <linearGradient id="liquidEdgeGlass" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
                <stop offset="100%" stopColor="rgba(220, 212, 255, 0.15)" />
              </linearGradient>
            </defs>

            {/* Seamless organic liquid curve: 104px top swoop -> 84px vertical straight rail -> 104px bottom swoop */}
            <path
              d="M 0,0 
                 L 104,0 
                 C 90,0 84,28 84,72 
                 L 84,728 
                 C 84,772 90,800 104,800 
                 L 0,800 
                 Z"
              fill="url(#liquidSidebarGradient)"
            />

            {/* Subtle inner glass highlight sheen along the organic edge */}
            <path
              d="M 104,0 
                 C 90,0 84,28 84,72 
                 L 84,728 
                 C 84,772 90,800 104,800"
              stroke="url(#liquidEdgeGlass)"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Top Logo / App Icon */}
        <div className="relative z-10 pt-5 flex flex-col items-center">
          <button
            onClick={() => onRouteChange('home')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 group cursor-pointer shadow-md"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              border: '1px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 4px 14px rgba(36, 34, 56, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
            }}
            title="LectureScript Home"
          >
            <span className="font-black text-white text-base tracking-tighter group-hover:rotate-6 transition-transform">
              LS
            </span>
          </button>
        </div>

        {/* Middle Nav Items Stack (Icon on top, clean label underneath) */}
        <nav className="relative z-10 flex flex-col items-center gap-3 w-full px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onRouteChange(item.id)}
                className={`group relative flex flex-col items-center justify-center w-16 py-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'scale-105'
                    : 'hover:-translate-y-0.5 hover:opacity-100 opacity-80'
                }`}
                style={
                  isActive
                    ? {
                        background: 'rgba(255, 255, 255, 0.24)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.45)',
                        boxShadow:
                          '0 8px 20px -2px rgba(36, 34, 56, 0.2), inset 0 1px 1px 0 rgba(255, 255, 255, 0.65)',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                      }
                }
                title={item.label}
              >
                {/* Active Soft Pill Glow Background indicator */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.25) 0%, transparent 70%)',
                    }}
                  />
                )}

                {/* Icon Container with subtle glass icon badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'text-white'
                      : 'text-white/85 group-hover:text-white group-hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.1]" />
                </div>

                {/* Text Label Underneath */}
                <span
                  className={`text-[10.5px] font-semibold tracking-tight mt-0.5 text-center leading-tight transition-colors ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-white/80 group-hover:text-white'
                  }`}
                >
                  {item.label}
                </span>

                {/* Has Notes Pulse Indicator for Study Studio */}
                {item.id === 'studio' && hasActiveNotes && !isActive && (
                  <span
                    className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-violet-700 animate-pulse"
                    title="Active Notes in Memory"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section: Active Status Dot & Quick Info */}
        <div className="relative z-10 pb-5 flex flex-col items-center gap-2">
          {/* Green Online / Ready Dot (as seen in the design reference image) */}
          <div
            className="flex items-center justify-center p-1.5 rounded-full"
            title="System Ready • AI Workspace Active"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white/60"></span>
            </span>
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM FLOATING NAVIGATION BAR ── */}
      <nav
        className="sm:hidden fixed bottom-3 left-4 right-4 z-40 px-3 py-2 rounded-2xl flex items-center justify-around shadow-xl border print:hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(105, 77, 232, 0.95) 0%, rgba(83, 52, 217, 0.95) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.35)',
          boxShadow: '0 12px 32px -4px rgba(116, 86, 232, 0.45)',
        }}
        aria-label="Mobile Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onRouteChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isActive ? 'text-white font-bold bg-white/20' : 'text-white/75 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9.5px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
