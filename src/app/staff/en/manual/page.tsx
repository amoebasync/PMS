'use client';

import React, { useEffect, useState, useRef } from 'react';

type ManualPage = {
  pageNumber: number;
  imageUrl: string;
};

export default function StaffManualPageEn() {
  const [pages, setPages] = useState<ManualPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/staff/training-manual')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.pages) {
          setPages(data.pages);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
    } else if (diff < -50 && currentPage > 0) {
      setCurrentPage((p) => p - 1);
    }
    touchStartX.current = null;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse mx-auto"></div>
        <div className="w-full aspect-[3/4] bg-slate-200 rounded-lg animate-pulse"></div>
        <div className="flex justify-between gap-4">
          <div className="h-12 flex-1 bg-slate-200 rounded-xl animate-pulse"></div>
          <div className="h-12 flex-1 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-slate-400">
        <i className="bi bi-book text-4xl mb-3"></i>
        <p className="text-sm">No manual available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Page indicator */}
      <div className="text-center text-sm text-slate-500 py-2 font-medium">
        {currentPage + 1} / {pages.length}
      </div>

      {/* Image container with touch events */}
      <div
        className="flex-1 flex items-center justify-center select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pages[currentPage]?.imageUrl}
          alt={`Manual page ${currentPage + 1}`}
          className="w-full rounded-lg shadow-sm cursor-pointer"
          onClick={() => setZoomImage(pages[currentPage]?.imageUrl)}
          draggable={false}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center py-4 gap-4">
        <button
          onClick={() => setCurrentPage((p) => p - 1)}
          disabled={currentPage === 0}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl font-bold text-sm transition-colors ${
            currentPage === 0
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 text-white active:bg-indigo-700'
          }`}
        >
          <i className="bi bi-chevron-left"></i>
          Previous
        </button>
        <button
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={currentPage === pages.length - 1}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl font-bold text-sm transition-colors ${
            currentPage === pages.length - 1
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 text-white active:bg-indigo-700'
          }`}
        >
          Next
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomImage}
            alt="Zoomed view"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
