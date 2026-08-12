import { z } from 'zod';

// ============================================================
// PARTICIPANT VALIDATION
// ============================================================
export const registerParticipantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  className: z.string().min(1, 'Class is required').max(20, 'Invalid class'),
  division: z.string().min(1, 'Division is required').max(10, 'Invalid division'),
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