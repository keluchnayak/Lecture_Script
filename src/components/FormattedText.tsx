import React from 'react';

/**
 * Parses inline markdown:
 * - **bold text** -> <strong>
 * - `code text` -> <code>
 * - *italic text* -> <em>
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match bold **...**, inline code `...`, or italic *...*
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold" style={{ color: '#242238' }}>
          {content}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <code
          key={index}
          className="font-mono text-[11px] sm:text-xs px-1.5 py-0.5 rounded border font-medium"
          style={{ background: '#EEE8FF', color: '#5E40D4', borderColor: '#C4B8F8' }}
        >
          {content}
        </code>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <em key={index} className="italic" style={{ color: '#6B6888' }}>
          {content}
        </em>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Formats a single note or bullet line.
 * If the line is an independent section header (e.g. `**Event Loop Phases (Conceptual Order)**:`),
 * renders it as a prominent section sub-heading.
 * If the line starts with a number like `1. **Timers**:`, renders with a clean number badge.
 * Handles `- **Worker Threads**: ...` without duplicate bullets.
 */
interface FormattedNoteItemProps {
  content: string;
  className?: string;
  bulletColor?: string;
}

export const FormattedNoteItem: React.FC<FormattedNoteItemProps> = ({
  content,
  className = '',
  bulletColor = 'text-emerald-600',
}) => {
  if (!content) return null;

  let clean = content.trim();

  // Strip leading dash or bullet if present in the string itself (e.g. "- **Worker Threads**")
  clean = clean.replace(/^[-*•]\s+/, '');

  // Check 1: Is this a Standalone Section Header?
  // e.g. `**Event Loop Phases (Conceptual Order)**:` or `**Heading Topic**`
  const standaloneHeaderMatch = clean.match(/^\*\*([^*]+)\*\*:\s*$/) || clean.match(/^\*\*([^*]+)\*\*$/);
  if (standaloneHeaderMatch) {
    const title = standaloneHeaderMatch[1];
    return (
      <div className="pt-3 pb-1 mt-1 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-primary)' }} />
        <h4 className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--color-text)' }}>
          {title}
        </h4>
      </div>
    );
  }

  // Check 2: Numbered Step / Phase
  // e.g. `1. **Timers**: Executes setTimeout()...` or `1. Timers: ...`
  const numberedMatch = clean.match(/^(\d+)\.\s+(\*\*([^*]+)\*\*|([A-Za-z0-9\s/()-]+)):\s*(.*)$/);
  if (numberedMatch) {
    const stepNumber = numberedMatch[1];
    const headerTitle = numberedMatch[3] || numberedMatch[4];
    const rest = numberedMatch[5];

    return (
      <div className={`flex items-start gap-2.5 text-[1em] leading-relaxed ${className}`} style={{ color: 'var(--color-text)' }}>
        <span className="flex items-center justify-center w-5 h-5 rounded-md font-bold text-[0.85em] shrink-0 mt-0.5 text-white" style={{ background: 'var(--color-primary)' }}>
          {stepNumber}
        </span>
        <div className="leading-relaxed">
          <strong className="font-bold text-[1em]" style={{ color: 'var(--color-text)' }}>
            {headerTitle}:
          </strong>{' '}
          {renderInlineMarkdown(rest)}
        </div>
      </div>
    );
  }

  // Check 3: Standard Bullet with Heading prefix
  // e.g. `**Single-Threaded JavaScript Execution**: Node.js executes...`
  const headerPrefixMatch = clean.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
  if (headerPrefixMatch) {
    const headerTitle = headerPrefixMatch[1];
    const rest = headerPrefixMatch[2];

    return (
      <div className={`flex items-start gap-2 text-[1em] leading-relaxed ${className}`} style={{ color: 'var(--color-text)' }}>
        <span className={`${bulletColor} font-bold mt-0.5 shrink-0`}>&bull;</span>
        <div className="leading-relaxed">
          <strong className="font-bold text-[1em]" style={{ color: 'var(--color-text)' }}>
            {headerTitle}:
          </strong>{' '}
          {renderInlineMarkdown(rest)}
        </div>
      </div>
    );
  }

  // General Bullet
  return (
    <div className={`flex items-start gap-2 text-[1em] leading-relaxed ${className}`} style={{ color: 'var(--color-text)' }}>
      <span className={`${bulletColor} font-bold mt-0.5 shrink-0`}>&bull;</span>
      <div className="leading-relaxed">
        {renderInlineMarkdown(clean)}
      </div>
    </div>
  );
};

/**
 * Clean plain text version for print/download HTML
 * Converts markdown **text** to <strong>text</strong> and `code` to <code>
 */
export function formatHtmlMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/^[-*•]\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
