'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface BlockingAnnouncement {
  id: number;
  title: string;
  content: string;
  titleEn: string | null;
  contentEn: string | null;
  imageUrls: string[];
  createdAt: string;
}

export default function AnnouncementBlocker() {
  const pathname = usePathname();
  const isEn = pathname.startsWith('/staff/en');
  const [announcements, setAnnouncements] = useState<BlockingAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/staff/announcements')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.announcements?.length) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(() => {});
  }, []);

  const current = announcements[currentIndex];

  // Scroll detection
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    // Consider "scrolled to bottom" when within 20px of the bottom
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  }, [scrolledToBottom]);

  // Reset scroll state when moving to next announcement
  useEffect(() => {
    setScrolledToBottom(false);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Check if content is short enough to not need scrolling
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // If content fits without scrolling, mark as scrolled
    if (el.scrollHeight <= el.clientHeight + 20) {
      setScrolledToBottom(true);
    }
  }, [current]);

  const handleConfirm = async () => {
    if (!current || !scrolledToBottom) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/staff/announcements/${current.id}/read`, { method: 'POST' });
      if (res.ok) {
        if (currentIndex < announcements.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setAnnouncements([]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfirming(false);
    }
  };

  if (!current) return null;

  const displayTitle = isEn ? (current.titleEn || current.title) : current.title;
  const displayContent = isEn ? (current.contentEn || current.content) : current.content;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-5 py-4 rounded-t-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <i className="bi bi-megaphone-fill text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-indigo-200">
              {isEn ? 'Notice' : 'お知らせ'} {announcements.length > 1 ? `(${currentIndex + 1}/${announcements.length})` : ''}
            </div>
            <div className="text-sm font-bold truncate">{displayTitle}</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ minHeight: 200 }}
        >
          {/* Images */}
          {current.imageUrls.length > 0 && (
            <div className="space-y-3 mb-4">
              {current.imageUrls.map((url, i) => (
                <img
                  key={i}
                  src={`/api/s3-proxy?key=${encodeURIComponent(url.replace(/^https:\/\/[^/]+\//, ''))}`}
                  alt=""
                  className="w-full rounded-lg border border-slate-200"
                />
              ))}
            </div>
          )}

          {/* Text content - preserve whitespace */}
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {displayContent}
          </div>
        </div>

        {/* Scroll indicator + Confirm button */}
        <div className="px-5 py-4 border-t border-slate-200">
          {!scrolledToBottom && (
            <div className="flex items-center justify-center gap-1 text-xs text-amber-600 mb-3 animate-bounce">
              <i className="bi bi-arrow-down-circle" />
              {isEn ? 'Please scroll to the bottom to continue' : '下までスクロールしてください'}
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!scrolledToBottom || confirming}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
              scrolledToBottom
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {isEn ? 'Confirming...' : '確認中...'}
              </span>
            ) : (
              isEn ? 'I have read and understood' : '確認しました'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
