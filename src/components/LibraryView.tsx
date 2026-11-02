import React from 'react';
import { FolderOpen, BookOpen, Trash2, Calendar, FileText, ArrowRight, Plus } from 'lucide-react';
import { LectureNotes } from '../types';
import { NavRoute } from './Sidebar';

interface LibraryViewProps {
  savedNotes: LectureNotes[];
  onLoadNote: (note: LectureNotes) => void;
  onDeleteNote: (index: number) => void;
  onNavigate: (route: NavRoute) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  savedNotes,
  onLoadNote,
  onDeleteNote,
  onNavigate,
}) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2"
            style={{
              background: 'rgba(220, 212, 255, 0.7)',
              color: 'var(--color-primary-dark)',
              border: '1px solid rgba(184, 168, 255, 0.6)',
            }}
          >
            <FolderOpen className="w-3.5 h-3.5 text-violet-600" />
            <span>Saved Notes Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#242238]">
            Your Notes Library
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6888] mt-1">
            Access, review, or export your saved class notes anytime. Notes are stored safely in your browser.
          </p>
        </div>

        <button
          onClick={() => onNavigate('studio')}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Notes</span>
        </button>
      </div>

      {/* Notes List / Empty State */}
      {savedNotes.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-violet-200/60 max-w-lg mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 mx-auto mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-lg text-[#242238]">No saved notes yet</h3>
          <p className="text-xs sm:text-sm text-[#6B6888] mt-2 leading-relaxed">
            Whenever you create notes in Study Studio, they will appear here so you can easily review them before tests.
          </p>
          <button
            onClick={() => onNavigate('studio')}
            className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            <span>Go to Study Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedNotes.map((note, idx) => (
            <div
              key={idx}
              className="glass-panel-elevated p-5 rounded-2xl border flex flex-col justify-between transition-all group"
              style={{
                borderColor: 'rgba(220, 212, 255, 0.7)',
              }}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-[#6B6888] mb-2">
                  <span className="font-semibold text-violet-700 truncate max-w-[160px]">
                    {note.subject}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {note.lectureDate}
                  </span>
                </div>

                <h3 className="font-bold text-base text-[#242238] group-hover:text-violet-700 transition-colors line-clamp-2">
                  {note.title}
                </h3>

                <p className="text-xs text-[#6B6888] mt-2 line-clamp-3 leading-relaxed">
                  {note.overview}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-violet-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    onLoadNote(note);
                    onNavigate('studio');
                  }}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>

                <button
                  onClick={() => onDeleteNote(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Remove from saved notes"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
