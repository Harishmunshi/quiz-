import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/questions/bulk  (admin only)
 *
 * Load a whole round's questions in one shot instead of filling the form
 * twenty times. Accepts either a JSON array or a tab/pipe separated block
 * pasted straight out of a spreadsheet.
 *
 * Body: { round: 2, replace?: boolean, questions: [...] }
 *       { round: 2, replace?: boolean, text: "..." }
 *
 * `replace: true` deletes the round's existing questions first — the normal
 * choice when re-uploading a corrected sheet.
 */

const bulkQuestionSchema = z.object({
  questionNumber: z.number().int().positive(),
  englishQuestion: z.string().min(1),
  // Gujarati is optional on input; the English text is copied across so the
  // bilingual UI still renders when only one language was supplied.
  gujaratiQuestion: z.string().optional(),
  optionAEnglish: z.string().min(1),
  optionBEnglish: z.string().min(1),
  optionCEnglish: z.string().min(1),
  optionDEnglish: z.string().min(1),
  optionAGujarati: z.string().optional(),
  optionBGujarati: z.string().optional(),
  optionCGujarati: z.string().optional(),
  optionDGujarati: z.string().optional(),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  marks: z.number().int().positive().optional(),
});

const bodySchema = z.object({
  round: z.number().int().min(1).max(2).default(2),
  replace: z.boolean().default(false),
  questions: z.array(bulkQuestionSchema).optional(),
  text: z.string().optional(),
});

/**
 * Parse a pasted spreadsheet block.
 * One question per line, columns separated by TAB or | :
 *
 *   question | optionA | optionB | optionC | optionD | correctLetter [| marks]
 *
 * A leading "1." or "1)" on the question is stripped and used as the number.
 */
function parseText(text: string): z.infer<typeof bulkQuestionSchema>[] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const out: z.infer<typeof bulkQuestionSchema>[] = [];
  let autoNumber = 0;

  for (const row of rows) {
    const cols = row.split(/\t|\s*\|\s*/).map((c) => c.trim());
    if (cols.length < 6) continue;

    let questionText = cols[0];
    autoNumber += 1;
    let number = autoNumber;

    const numMatch = questionText.match(/^(\d+)\s*[.)\]]\s*/);
    if (numMatch) {
      number = parseInt(numMatch[1], 10);
      autoNumber = number;
      questionText = questionText.slice(numMatch[0].length).trim();
    }

    const letter = cols[5].trim().toUpperCase().charAt(0);
    if (!['A', 'B', 'C', 'D'].includes(letter)) continue;

    out.push({
      questionNumber: number,
      englishQuestion: questionText,
      optionAEnglish: cols[1],
      optionBEnglish: cols[2],
      optionCEnglish: cols[3],
      optionDEnglish: cols[4],
      correctOption: letter as 'A' | 'B' | 'C' | 'D',
      marks: cols[6] ? parseInt(cols[6], 10) || 1 : 1,
    });
  }

  return out;
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { round, replace } = parsed.data;

    let items = parsed.data.questions ?? [];
    if (items.length === 0 && parsed.data.text) {
      const fromText = parseText(parsed.data.text);
      const validated = z.array(bulkQuestionSchema).safeParse(fromText);
      if (!validated.success) {
        return NextResponse.json(
          { success: false, error: `Could not parse pasted text: ${validated.error.issues[0].message}` },
          { status: 400 }
        );
      }
      items = validated.data;
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No questions found. Provide `questions` or `text`.' },
        { status: 400 }
      );
    }

    // Duplicate numbers would make "open question 3" ambiguous during the live
    // round, so reject the whole batch rather than import half of it.
    const numbers = items.map((q) => q.questionNumber);
    const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    if (dupes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Duplicate question numbers: ${[...new Set(dupes)].join(', ')}` },
        { status: 400 }
      );
    }

    if (replace) {
      // Answers reference questions, so clear them first.
      const existing = await db.question.findMany({
        where: { round },
        select: { id: true },
      });
      const ids = existing.map((q) => q.id);
      if (ids.length > 0) {
        await db.round2LiveAnswer.deleteMany({ where: { questionId: { in: ids } } });
        await db.round1Answer.deleteMany({ where: { questionId: { in: ids } } });
        await db.question.deleteMany({ where: { round } });
      }
    }

    const created = await db.question.createMany({
      data: items.map((q) => ({
        questionNumber: q.questionNumber,
        englishQuestion: q.englishQuestion,
        gujaratiQuestion: q.gujaratiQuestion || q.englishQuestion,
        optionAEnglish: q.optionAEnglish,
        optionBEnglish: q.optionBEnglish,
        optionCEnglish: q.optionCEnglish,
        optionDEnglish: q.optionDEnglish,
        optionAGujarati: q.optionAGujarati || q.optionAEnglish,
        optionBGujarati: q.optionBGujarati || q.optionBEnglish,
        optionCGujarati: q.optionCGujarati || q.optionCEnglish,
        optionDGujarati: q.optionDGujarati || q.optionDEnglish,
        correctOption: q.correctOption,
        marks: q.marks ?? 1,
        round,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      data: { imported: created.count, round, replaced: replace },
    });
  } catch (error) {
    console.error('Bulk question import failed:', error);
    return NextResponse.json(
      { success: false, error: 'Bulk import failed' },
      { status: 500 }
    );
  }
}
