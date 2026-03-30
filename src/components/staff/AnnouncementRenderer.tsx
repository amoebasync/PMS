'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Simple Markdown Renderer (uses React elements, safe approach)      */
/* ------------------------------------------------------------------ */

export function AnnouncementBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n');

        // Check if this paragraph is a list block
        const listItems: { type: 'ul' | 'ol'; text: string }[] = [];
        let isListBlock = true;

        for (const line of lines) {
          if (!line.trim()) continue;
          const ulMatch = line.match(/^[-*]\s+(.+)/);
          const olMatch = line.match(/^\d+\.\s+(.+)/);
          if (ulMatch) {
            listItems.push({ type: 'ul', text: ulMatch[1] });
          } else if (olMatch) {
            listItems.push({ type: 'ol', text: olMatch[1] });
          } else {
            isListBlock = false;
            break;
          }
        }

        if (isListBlock && listItems.length > 0) {
          const listType = listItems[0].type;
          const items = listItems.map((item, li) => (
            <li key={li} className="text-sm text-slate-700 leading-relaxed">{formatInline(item.text)}</li>
          ));

          if (listType === 'ol') {
            return <ol key={pi} className="list-decimal list-inside space-y-1">{items}</ol>;
          }
          return <ul key={pi} className="list-disc list-inside space-y-1">{items}</ul>;
        }

        return (
          <div key={pi}>
            {lines.map((line, li) => {
              // ## Heading 2
              if (line.startsWith('## ')) {
                return <h2 key={li} className="text-lg font-black text-slate-900 mt-2 mb-1">{formatInline(line.slice(3))}</h2>;
              }
              // ### Heading 3
              if (line.startsWith('### ')) {
                return <h3 key={li} className="text-base font-bold text-slate-800 mt-2 mb-1">{formatInline(line.slice(4))}</h3>;
              }
              // Bullet list item (single line within mixed content)
              const ulMatch = line.match(/^[-*]\s+(.+)/);
              if (ulMatch) {
                return (
                  <div key={li} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="text-slate-400">•</span>
                    <span>{formatInline(ulMatch[1])}</span>
                  </div>
                );
              }
              // Numbered list item (single line within mixed content)
              const olMatch = line.match(/^(\d+)\.\s+(.+)/);
              if (olMatch) {
                return (
                  <div key={li} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="text-slate-500 font-medium">{olMatch[1]}.</span>
                    <span>{formatInline(olMatch[2])}</span>
                  </div>
                );
              }
              // Empty line within paragraph
              if (!line.trim()) return <div key={li} className="h-2" />;
              // Normal line
              return <p key={li} className="text-sm text-slate-700 leading-relaxed">{formatInline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Parse bold and italic inline formatting into React elements */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text* (but not **)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    const boldIdx = boldMatch?.index ?? Infinity;
    const italicIdx = italicMatch?.index ?? Infinity;

    if (boldIdx === Infinity && italicIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    if (boldIdx <= italicIdx && boldMatch) {
      if (boldIdx > 0) parts.push(remaining.slice(0, boldIdx));
      parts.push(<strong key={key++} className="font-bold text-slate-900">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (italicMatch) {
      if (italicIdx > 0) parts.push(remaining.slice(0, italicIdx));
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicIdx + italicMatch[0].length);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
