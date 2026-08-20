import { z } from 'zod';

// ============================================================
// PARTICIPANT VALIDATION
// ============================================================
/**
 * Round 1 sign-in.
 *
 * Students identify by a code their school issues them, not by typing a name.
 * Names are not unique — the live data has three "Harish Munshi" — so a name was
 * never an identifier, and on an inter-school board the school plus the code is
 * what actually distinguishes competitors.
 *
 * `name` is kept optional purely so an older client posting a name still works.
 */
export const registerParticipantSchema = z.object({
  // Anything the school actually prints on a card. Real IDs look like
  // "M.E.S.B S-1" — dots, spaces and hyphens all carry meaning, and rejecting
  // them turned a valid ID into an error the student could not resolve.
  // Normalisation happens server-side, not here.
  participantCode: z
    .string()
    .trim()
    .min(2, 'Enter your student ID')
    .max(64, 'That ID is too long'),
  schoolName: z.string().min(2, 'School name is required').max(150, 'School name is too long'),
  name: z.string().max(100, 'Name is too long').optional(),
  language: z.enum(['english', 'gujarati']),
});

export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;

// ============================================================
// QUIZ ANSWER VALIDATION
// ============================================================
export const quizAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
});

export const submitRound1Schema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(quizAnswerSchema).min(1, 'At least one answer required'),
});

export type SubmitRound1Input = z.infer<typeof submitRound1Schema>;

// ============================================================
// ROUND 2 VALIDATION
// ============================================================
export const submitRound2Schema = z.object({
  attemptId: z.string().min(1),
  submittedOrder: z.array(z.string().min(1)).min(2, 'At least 2 items required'),
  clientElapsedMs: z.number().int().nonnegative(),
});

export type SubmitRound2Input = z.infer<typeof submitRound2Schema>;

// ============================================================
// QUESTION VALIDATION
// ============================================================
export const questionFormSchema = z.object({
  questionNumber: z.number().int().positive('Question number must be positive'),
  englishQuestion: z.string().min(1, 'English question is required'),
  gujaratiQuestion: z.string().min(1, 'Gujarati question is required'),
  optionAEnglish: z.string().min(1, 'Option A (English) is required'),
  optionBEnglish: z.string().min(1, 'Option B (English) is required'),
  optionCEnglish: z.string().min(1, 'Option C (English) is required'),
  optionDEnglish: z.string().min(1, 'Option D (English) is required'),
  optionAGujarati: z.string().min(1, 'Option A (Gujarati) is required'),
  optionBGujarati: z.string().min(1, 'Option B (Gujarati) is required'),
  optionCGujarati: z.string().min(1, 'Option C (Gujarati) is required'),
  optionDGujarati: z.string().min(1, 'Option D (Gujarati) is required'),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  marks: z.number().int().positive('Marks must be positive').default(1),
  round: z.number().int().min(1).max(2).default(1),
  isActive: z.boolean().default(true),
});

export type QuestionFormInput = z.infer<typeof questionFormSchema>;

// ============================================================
// CHALLENGE VALIDATION
// ============================================================
export const challengeFormSchema = z.object({
  challengeNumber: z.number().int().positive(),
  prompt: z.string().min(1, 'Prompt is required'),
  items: z.array(z.string().min(1)).min(2, 'At least 2 items'),
  correctOrder: z.array(z.string().min(1)).min(2, 'At least 2 items'),
  timeLimitMs: z.number().int().positive().default(60000),
  maxAttempts: z.number().int().positive().default(3),
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    const itemsSorted = [...data.items].sort();
    const orderSorted = [...data.correctOrder].sort();
    return JSON.stringify(itemsSorted) === JSON.stringify(orderSorted);
  },
  { message: 'Items and correct order must contain the same elements' }
);

export type ChallengeFormInput = z.infer<typeof challengeFormSchema>;

// ============================================================
// ADMIN LOGIN VALIDATION
// ============================================================
export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ============================================================
// COMPETITION SETTINGS VALIDATION
// ============================================================
export const competitionUpdateSchema = z.object({
  competitionStatus: z.enum(['draft', 'test', 'live', 'paused', 'completed']).optional(),
  round1Status: z.enum(['locked', 'open', 'paused', 'closed']).optional(),
  round2Status: z.enum(['locked', 'open', 'paused', 'closed']).optional(),
  isTestMode: z.boolean().optional(),
  round1TotalQuestions: z.number().int().positive().optional(),
  round1TimeLimit: z.number().int().min(0).optional(),
  round2TimeLimit: z.number().int().positive().optional(),
  allowRound2Retry: z.boolean().optional(),
  round2PenaltySeconds: z.number().int().min(0).optional(),
});

export type CompetitionUpdateInput = z.infer<typeof competitionUpdateSchema>;