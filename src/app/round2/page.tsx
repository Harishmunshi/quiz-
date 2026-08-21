'use client';

import { ChevronRight } from 'lucide-react';
import QuestionStage from '@/components/round2/QuestionStage';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

/**
 * /round2 — pick a question.
 *
 * This used to be the whole Round 2 student experience: the quiz-master-driven
 * flow where one question was released at a time, with the standings shown to
 * every student after each reveal. Round 2 is self-paced now and lives at
 * /round2/q/1 and /round2/q/2, so nothing links here any more — but a bookmark
 * or a shared screenshot still does, and that page was putting the leaderboard
 * in front of students.
 *
 * Replaced with the two doors and nothing else. No standings, no scores, no
 * sign-in state: whichever question they pick asks for their ID and school
 * there.
 */
export default function Round2Index() {
  return (
    <QuestionStage questionNumber={0} full>
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SCHOOL_LOGO_URL} alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
            Round 02
          </p>
          <h1 className="mt-2 text-4xl font-black leading-[0.95] tracking-tight text-[#0A0D14] sm:text-5xl">
            TARTIB-E
            <br />
            <span className="text-[#966700]">WAQIYAAT</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#5B6472]/80">
            तरतीब-ए-वाक़िआत
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#5B6472]">
            Arrange 12 events in the correct order. Every item in its right place
            earns <span className="font-bold text-[#966700]">1 mark out of 12</span>.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            {[1, 2].map((n) => (
              <a
                key={n}
                href={`/round2/q/${n}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#FFB000] py-4 text-base font-bold text-[#0A0D14] transition-all hover:bg-[#FFC33D] active:scale-[0.98]"
              >
                Question {n}
                <ChevronRight className="h-5 w-5" />
              </a>
            ))}
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-[#5B6472]/80">
            Each question is separate and can be answered on its own. You will be
            asked for your student ID and school.
          </p>
        </div>
      </main>
    </QuestionStage>
  );
}
