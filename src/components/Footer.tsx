import React from 'react';
import { Heart, BookOpen } from 'lucide-react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer
      className="mt-16 pt-8 pb-10 border-t print:hidden transition-all text-xs"
      style={{
        borderColor: 'rgba(220, 212, 255, 0.5)',
        color: '#6B6888',
      }}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Brand & Microcopy */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #7456E8 0%, #9B82F3 100%)',
            }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="font-extrabold text-[#242238] tracking-tight">LectureScript</span>
              <span
                className="px-2 py-0.2 rounded-full text-[9.5px] font-semibold border"
                style={{
                  background: 'rgba(220, 212, 255, 0.6)',
                  color: '#5E40D4',
                  borderColor: 'rgba(184, 168, 255, 0.7)',
                }}
              >
                Student Edition
              </span>
            </div>
            <p className="text-[11px] text-[#6B6888] mt-0.5">
              Turn class recordings &amp; transcripts into clean, high-yield study notes.
            </p>
          </div>
        </div>

        {/* Right: Security & AI Engine Status */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 border border-violet-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-800">Gemini 3.1 Flash Ready</span>
          </div>
          <span className="text-[#6B6888]">100% Client-Side Encrypted</span>
        </div>
      </div>

      {/* Bottom Sub-row */}
      <div className="mt-6 pt-4 border-t border-violet-100/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] text-[#8F8CA7]">
        <p>&copy; 2026 LectureScript. Built for quiet focus and deep learning.</p>
        <p className="flex items-center gap-1">
          <span>Crafted with</span>
          <Heart className="w-3 h-3 text-red-400 fill-red-400" />
          <span>for students worldwide</span>
        </p>
      </div>
    </footer>
  );
};
