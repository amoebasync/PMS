import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function PortalFooter() {
  return (
    <footer className="bg-slate-800 text-slate-300 py-10 mt-auto border-t border-slate-700 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          
          {/* 左側：ロゴと会社情報 */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="relative w-32 h-8">
              <Image 
                src="/logo/logo_dark_transparent.png" 
                alt="Logo" 
                fill 
                className="object-contain object-left" 
              />
            </div>
            <div className="text-xs text-slate-400 font-medium text-center md:text-left leading-relaxed">
              〒104-0061<br />
              東京都中央区銀座一丁目22番11号<br />
              銀座大竹ビジデンス 2F<br />
              株式会社KP
            </div>
          </div>

          {/* 右側：リンク集 */}
          <div className="flex flex-wrap justify-center gap-6 text-sm font-bold">
            <Link href="/portal" className="hover:text-white transition-colors">
              トップページ
            </Link>
            <Link href="/portal/terms" className="hover:text-white transition-colors">
              利用規約
            </Link>
            <Link href="/portal/privacy" className="hover:text-white transition-colors">
              個人情報の取り扱いについて
            </Link>
          </div>

        </div>

        <div className="mt-10 pt-6 border-t border-slate-700 text-center text-xs text-slate-500 font-mono">
          &copy; {new Date().getFullYear()} KP Inc. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}