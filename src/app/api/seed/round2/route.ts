import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/seed/round2  (admin only)
 *
 * Loads the three Round 2 ordering questions. Idempotent: it clears the table
 * and rewrites it, so re-running after an edit is safe and never leaves a
 * half-updated set behind.
 *
 * Every question is a 12-item sequence, scored all-or-nothing.
 */

const QUESTIONS = [
  {
    questionNumber: 1,
    titleEnglish: 'Order of the Surahs',
    titleSecondary: 'सूरहों का क्रम',
    promptEnglish: "Arrange the following Surahs in the correct Qur'anic order.",
    promptSecondary: 'निम्नलिखित सूरहों को क़ुरआन के सही क्रम में व्यवस्थित करें।',
    items: [
      { key: 'al-balad', en: 'Al-Balad', ar: 'البلد', hi: 'अल-बलद' },
      { key: 'al-qadr', en: 'Al-Qadr', ar: 'القدر', hi: 'अल-क़द्र' },
      { key: 'al-adiyat', en: "Al-'Adiyat", ar: 'العاديات', hi: 'अल-आदियात' },
      { key: 'ash-sharh', en: 'Ash-Sharh', ar: 'الشرح', hi: 'अश-शरह' },
      { key: 'ad-duha', en: 'Ad-Duha', ar: 'الضحى', hi: 'अद-दुहा' },
      { key: 'al-alaq', en: "Al-'Alaq", ar: 'العلق', hi: 'अल-अलक़' },
      { key: 'al-layl', en: 'Al-Layl', ar: 'الليل', hi: 'अल-लैल' },
      { key: 'al-bayyinah', en: 'Al-Bayyinah', ar: 'البينة', hi: 'अल-बय्यिनह' },
      { key: 'az-zalzalah', en: 'Az-Zalzalah', ar: 'الزلزلة', hi: 'अज़-ज़लज़लह' },
      { key: 'at-tin', en: 'At-Tin', ar: 'التين', hi: 'अत-तीन' },
      { key: 'al-qariah', en: "Al-Qari'ah", ar: 'القارعة', hi: 'अल-क़ारिआह' },
      { key: 'ash-shams', en: 'Ash-Shams', ar: 'الشمس', hi: 'अश-शम्स' },
    ],
    // Surahs 90 through 101, in order.
    correctOrder: [
      'al-balad', 'ash-shams', 'al-layl', 'ad-duha', 'ash-sharh', 'at-tin',
      'al-alaq', 'al-qadr', 'al-bayyinah', 'az-zalzalah', 'al-adiyat', 'al-qariah',
    ],
  },
  {
    questionNumber: 2,
    titleEnglish: 'Events in the life of the Prophet ﷺ',
    titleSecondary: 'हज़रत मुहम्मद ﷺ की ज़िंदगी की घटनाएँ',
    promptEnglish:
      'Arrange the following major events from the life of Prophet Muhammad ﷺ in chronological order.',
    promptSecondary:
      'हज़रत मुहम्मद ﷺ की ज़िंदगी की निम्नलिखित प्रमुख घटनाओं को कालानुक्रमिक क्रम में व्यवस्थित कीजिए।',
    items: [
      { key: 'uhud', en: 'Battle of Uhud', hi: 'ग़ज़वा-ए-उहुद' },
      { key: 'first-revelation', en: 'First Revelation in Cave Hira', hi: 'ग़ारे-हिरा में पहली वह़ी' },
      { key: 'hudaybiyyah', en: 'Treaty of Hudaybiyyah', hi: 'सुल्ह-ए-हुदैबिया' },
      { key: 'khandaq', en: 'Battle of Khandaq', hi: 'ग़ज़वा-ए-ख़ंदक़' },
      { key: 'hijrah', en: 'Hijrah to Madinah', hi: 'मदीना की हिजरत' },
      { key: 'conquest-makkah', en: 'Conquest of Makkah', hi: 'फ़त्ह-ए-मक्का' },
      { key: 'isra-miraj', en: "Isra and Mi'raj", hi: 'इस्रा और मेराज' },
      { key: 'badr', en: 'Battle of Badr', hi: 'ग़ज़वा-ए-बद्र' },
      { key: 'public-preaching', en: 'Prophet Muhammad ﷺ begins public preaching', hi: 'खुले तौर पर इस्लाम की दावत का आग़ाज़' },
      { key: 'year-elephant', en: 'Year of the Elephant', hi: 'आमुल-फ़ील (हाथी का साल)' },
      { key: 'farewell-hajj', en: 'Farewell Hajj', hi: 'हज्जतुल-वदा' },
      { key: 'first-aqabah', en: 'First Pledge at Aqabah', hi: 'अक़बा की पहली बैअत' },
    ],
    correctOrder: [
      'year-elephant', 'first-revelation', 'public-preaching', 'isra-miraj',
      'first-aqabah', 'hijrah', 'badr', 'uhud', 'khandaq', 'hudaybiyyah',
      'conquest-makkah', 'farewell-hajj',
    ],
  },
  {
    questionNumber: 3,
    titleEnglish: 'Order of the Prophets',
    titleSecondary: 'પયગંબરોનો ક્રમ',
    promptEnglish: 'Arrange the following Prophets in chronological order.',
    promptSecondary: 'નીચે આપેલા પયગંબરોને કાલક્રમ પ્રમાણે ગોઠવો.',
    items: [
      { key: 'musa', en: 'Prophet Musa (Moses) عليه السلام', gu: 'હઝરત મૂસા અલૈહિસ્સલામ' },
      { key: 'yusuf', en: 'Prophet Yusuf (Joseph) عليه السلام', gu: 'હઝરત યુસુફ અલૈહિસ્સલામ' },
      { key: 'hud', en: 'Prophet Hud عليه السلام', gu: 'હઝરત હૂદ અલૈહિસ્સલામ' },
      { key: 'ishaq', en: 'Prophet Ishaq (Isaac) عليه السلام', gu: 'હઝરત ઇસ્હાક અલૈહિસ્સલામ' },
      { key: 'shuayb', en: "Prophet Shu'ayb عليه السلام", gu: 'હઝરત શોએબ અલૈહિસ્સલામ' },
      { key: 'ismail', en: 'Prophet Ismail (Ishmael) عليه السلام', gu: 'હઝરત ઇસ્માઇલ અલૈહિસ્સલામ' },
      { key: 'ayyub', en: 'Prophet Ayyub (Job) عليه السلام', gu: 'હઝરત અય્યુબ અલૈહિસ્સલામ' },
      { key: 'lut', en: 'Prophet Lut (Lot) عليه السلام', gu: 'હઝરત લૂત અલૈહિસ્સલામ' },
      { key: 'harun', en: 'Prophet Harun (Aaron) عليه السلام', gu: 'હઝરત હારૂન અલૈહિસ્સલામ' },
      { key: 'salih', en: 'Prophet Salih عليه السلام', gu: 'હઝરત સાલેહ અલૈહિસ્સલામ' },
      { key: 'yaqub', en: 'Prophet Yaqub (Jacob) عليه السلام', gu: 'હઝરત યાકૂબ અલૈહિસ્સલામ' },
      { key: 'ibrahim', en: 'Prophet Ibrahim (Abraham) عليه السلام', gu: 'હઝરત ઇબ્રાહીમ અલૈહિસ્સલામ' },
    ],
    correctOrder: [
      'hud', 'salih', 'ibrahim', 'lut', 'ismail', 'ishaq',
      'yaqub', 'yusuf', 'ayyub', 'shuayb', 'musa', 'harun',
    ],
  },
];

export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    // Integrity check before touching the database: every answer-key entry must
    // be a real item, and the key must be a complete permutation. A typo here
    // would silently mark every student wrong on the night.
    for (const q of QUESTIONS) {
      const keys = new Set(q.items.map((i) => i.key));
      if (keys.size !== q.items.length) {
        return NextResponse.json(
          { success: false, error: `Q${q.questionNumber}: duplicate item keys` },
          { status: 500 }
        );
      }
      if (q.correctOrder.length !== q.items.length) {
        return NextResponse.json(
          { success: false, error: `Q${q.questionNumber}: answer key length mismatch` },
          { status: 500 }
        );
      }
      for (const k of q.correctOrder) {
        if (!keys.has(k)) {
          return NextResponse.json(
            { success: false, error: `Q${q.questionNumber}: answer key references unknown item "${k}"` },
            { status: 500 }
          );
        }
      }
      if (new Set(q.correctOrder).size !== q.correctOrder.length) {
        return NextResponse.json(
          { success: false, error: `Q${q.questionNumber}: answer key repeats an item` },
          { status: 500 }
        );
      }
    }

    // Answers reference questions, so clear them first.
    await db.round2LiveAnswer.deleteMany({});
    await db.round2LiveQuestion.deleteMany({});

    for (const q of QUESTIONS) {
      await db.round2LiveQuestion.create({
        data: {
          questionNumber: q.questionNumber,
          type: 'order',
          titleEnglish: q.titleEnglish,
          titleSecondary: q.titleSecondary,
          promptEnglish: q.promptEnglish,
          promptSecondary: q.promptSecondary,
          items: JSON.stringify(q.items),
          correctOrder: JSON.stringify(q.correctOrder),
          marks: 1,
          timeLimitSec: 120,
          isActive: true,
        },
      });
    }

    // Reset the live state so a reload never leaves a stale question on screen.
    const settings = await db.competitionSettings.findFirst();
    if (settings) {
      await db.competitionSettings.update({
        where: { id: settings.id },
        data: {
          round2CurrentQuestion: 0,
          round2QuestionState: 'idle',
          round2QuestionOpenedAt: null,
          round2QuestionLockedAt: null,
          round2QuestionSeconds: 120,
          round2Mode: 'live',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { loaded: QUESTIONS.length, itemsPerQuestion: QUESTIONS.map((q) => q.items.length) },
    });
  } catch (error) {
    console.error('Round 2 seed error:', error);
    return NextResponse.json({ success: false, error: 'Round 2 seed failed' }, { status: 500 });
  }
}
