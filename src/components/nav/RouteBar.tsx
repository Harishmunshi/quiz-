'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

/**
 * The equivalent of AppNav for the pages that live at their own URLs —
 * /round2, /round2/display and /admin/round2.
 *
 * Those three are real routes rather than views inside the single-page flow, so
 * the browser Back button already works on them. What they were missing was a
 * visible way home: someone who opened /admin/round2 from a bookmark has no
 * back entry to use, and the page offered no link out.
 */
export default function RouteBar({
  section,
  label,
  href = '/',
  hrefLabel = 'Main site',
}: {
  section?: string;
  label: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#FFB000]/25 bg-[#F4F5F7]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:px-4">
        <a
          href={href}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#FFB000]/35 bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-[#0A0D14] transition-colors hover:bg-white sm:px-3"
        >
          <ArrowLeft className="h-4 w-4" />
          {hrefLabel}
        </a>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SCHOOL_LOGO_URL}
          alt=""
          className="ml-1 hidden h-7 w-7 shrink-0 rounded-full object-contain sm:block"
        />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {section && (
            <>
              <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-[#966700] sm:inline">
                {section}
              </span>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-[#5B6472]/40 sm:block" />
            </>
          )}
          <span className="truncate text-sm font-bold text-[#0A0D14]">{label}</span>
        </div>
      </nav>
    </div>
  );
}
