import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST() {
  try {
    // Create admin user
    const adminExists = await db.adminUser.count();
    if (adminExists === 0) {
      await db.adminUser.create({
        data: {
          email: 'admin@mes.edu',
          password: await hashPassword('admin123'),
          name: 'Competition Admin',
        },
      });
    }

    // Check if questions already exist
    const qCount = await db.question.count();
    if (qCount > 0) {
      return NextResponse.json({ success: true, message: 'Data already seeded' });
    }

    // Seed 10 Round 1 questions
    const questions = [
      {
        questionNumber: 1,
        englishQuestion: 'What is the first pillar of Islam?',
        gujaratiQuestion: 'ઇસ્લામનો પ્રથમ સ્તંભ કયો છે?',
        optionAEnglish: 'Zakat', optionBEnglish: 'Salah',
        optionCEnglish: 'Shahada', optionDEnglish: 'Sawm',
        optionAGujarati: 'ઝકાત', optionBGujarati: 'સલાહ',
        optionCGujarati: 'શહાદા', optionDGujarati: 'સવમ',
        correctOption: 'C', marks: 1, round: 1,
      },
      {
        questionNumber: 2,
        englishQuestion: 'How many times do Muslims pray each day?',
        gujaratiQuestion: 'મુસ્લિમો દરરોજ કેટલી વાર નમાજ પઢે છે?',
        optionAEnglish: '3', optionBEnglish: '4',
        optionCEnglish: '5', optionDEnglish: '6',
        optionAGujarati: '3', optionBGujarati: '4',
        optionCGujarati: '5', optionDGujarati: '6',
        correctOption: 'C', marks: 1, round: 1,
      },
      {
        questionNumber: 3,
        englishQuestion: 'What is the holy book of Islam?',
        gujaratiQuestion: 'ઇસ્લામનું પવિત્ર ગ્રંથ કયો છે?',
        optionAEnglish: 'Bible', optionBEnglish: 'Quran',
        optionCEnglish: 'Torah', optionDEnglish: 'Psalm',
        optionAGujarati: 'બાઇબલ', optionBGujarati: 'કુરઆન',
        optionCGujarati: 'તોરાહ', optionDGujarati: 'ઝબૂર',
        correctOption: 'B', marks: 1, round: 1,
      },
      {
        questionNumber: 4,
        englishQuestion: 'In which month do Muslims fast?',
        gujaratiQuestion: 'મુસ્લિમો કયા મહિનામાં ઉપવાસ રાખે છે?',
        optionAEnglish: 'Shaban', optionBEnglish: 'Rajab',
        optionCEnglish: 'Ramadan', optionDEnglish: 'Muharram',
        optionAGujarati: 'શબાન', optionBGujarati: 'રજબ',
        optionCGujarati: 'રમદાન', optionDGujarati: 'મુહરરમ',
        correctOption: 'C', marks: 1, round: 1,
      },
      {
        questionNumber: 5,
        englishQuestion: 'What is the name of the Prophet of Islam?',
        gujaratiQuestion: 'ઇસ્લામના નબીનું નામ શું છે?',
        optionAEnglish: 'Prophet Isa (AS)', optionBEnglish: 'Prophet Musa (AS)',
        optionCEnglish: 'Prophet Ibrahim (AS)', optionDEnglish: 'Prophet Muhammad (PBUH)',
        optionAGujarati: 'નબી ઈસા (અ.)', optionBGujarati: 'નબી મૂસા (અ.)',
        optionCGujarati: 'નબી ઇબ્રાહિમ (અ.)', optionDGujarati: 'નબી મુહમ્મદ (સ.અ.વ.)',
        correctOption: 'D', marks: 1, round: 1,
      },
      {
        questionNumber: 6,
        englishQuestion: 'What is the Kaaba?',
        gujaratiQuestion: 'કાબા શું છે?',
        optionAEnglish: 'A mosque in Medina', optionBEnglish: 'The sacred house in Mecca',
        optionCEnglish: 'A Islamic school', optionDEnglish: 'A holy book',
        optionAGujarati: 'મદીનાની મસ્જિદ', optionBGujarati: 'મક્કાનું પવિત્ર ઘર',
        optionCGujarati: 'એક ઇસ્લામિક શાળા', optionDGujarati: 'એક પવિત્ર ગ્રંથ',
        correctOption: 'B', marks: 1, round: 1,
      },
      {
        questionNumber: 7,
        englishQuestion: 'How many Surahs are in the Holy Quran?',
        gujaratiQuestion: 'પવિત્ર કુરઆનમાં કેટલી સૂરતો છે?',
        optionAEnglish: '100', optionBEnglish: '110',
        optionCEnglish: '120', optionDEnglish: '114',
        optionAGujarati: '100', optionBGujarati: '110',
        optionCGujarati: '120', optionDGujarati: '114',
        correctOption: 'D', marks: 1, round: 1,
      },
      {
        questionNumber: 8,
        englishQuestion: 'What does "Salam" mean?',
        gujaratiQuestion: '"સલામ" નો અર્થ શું છે?',
        optionAEnglish: 'Goodbye', optionBEnglish: 'Peace',
        optionCEnglish: 'Thanks', optionDEnglish: 'Welcome',
        optionAGujarati: 'વિદાય', optionBGujarati: 'શાંતિ',
        optionCGujarati: 'આભાર', optionDGujarati: 'સ્વાગત',
        correctOption: 'B', marks: 1, round: 1,
      },
      {
        questionNumber: 9,
        englishQuestion: 'Which city is the holiest in Islam?',
        gujaratiQuestion: 'ઇસ્લામમાં સૌથી પવિત્ર શહેર કયો છે?',
        optionAEnglish: 'Medina', optionBEnglish: 'Jerusalem',
        optionCEnglish: 'Mecca', optionDEnglish: 'Cairo',
        optionAGujarati: 'મદીના', optionBGujarati: 'જેરુસલેમ',
        optionCGujarati: 'મક્કા', optionDGujarati: 'કાહિરા',
        correctOption: 'C', marks: 1, round: 1,
      },
      {
        questionNumber: 10,
        englishQuestion: 'What is Zakat?',
        gujaratiQuestion: 'ઝકાત શું છે?',
        optionAEnglish: 'Fasting', optionBEnglish: 'Charity/almsgiving',
        optionCEnglish: 'Pilgrimage', optionDEnglish: 'Prayer',
        optionAGujarati: 'ઉપવાસ', optionBGujarati: 'દાન/ભેટ',
        optionCGujarati: 'હજ્જ', optionDGujarati: 'નમાજ',
        correctOption: 'B', marks: 1, round: 1,
      },
    ];

    for (const q of questions) {
      await db.question.create({ data: q });
    }

    // Seed Round 2 challenges
    const challenges = [
      {
        challengeNumber: 1,
        prompt: 'Arrange the Five Pillars of Islam in the correct order: Shahada, Salah, Zakat, Sawm, Hajj',
        items: JSON.stringify(['Zakat', 'Hajj', 'Shahada', 'Sawm', 'Salah']),
        correctOrder: JSON.stringify(['Shahada', 'Salah', 'Zakat', 'Sawm', 'Hajj']),
        timeLimitMs: 30000,
        maxAttempts: 3,
      },
      {
        challengeNumber: 2,
        prompt: 'Arrange these Islamic months in calendar order: Ramadan, Muharram, Shawwal, Dhul Hijjah, Rajab',
        items: JSON.stringify(['Ramadan', 'Dhul Hijjah', 'Muharram', 'Shawwal', 'Rajab']),
        correctOrder: JSON.stringify(['Muharram', 'Rajab', 'Ramadan', 'Shawwal', 'Dhul Hijjah']),
        timeLimitMs: 30000,
        maxAttempts: 3,
      },
      {
        challengeNumber: 3,
        prompt: 'Arrange these prophets in chronological order: Adam, Isa, Muhammad, Musa, Ibrahim',
        items: JSON.stringify(['Isa', 'Muhammad', 'Adam', 'Musa', 'Ibrahim']),
        correctOrder: JSON.stringify(['Adam', 'Ibrahim', 'Musa', 'Isa', 'Muhammad']),
        timeLimitMs: 30000,
        maxAttempts: 3,
      },
    ];

    for (const c of challenges) {
      await db.round2Challenge.create({ data: c });
    }

    // Round 2 questions are ordering challenges and live in their own table.
    // Seed them from POST /api/seed/round2.

    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: 'Seed failed' }, { status: 500 });
  }
}
