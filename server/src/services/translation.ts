import { GeminiProvider } from './llm.js';
import { db } from '../lib/db.js';
import { tenders } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Translate a single string using Gemini
export async function translateText(text: string, targetLangCode: string): Promise<string> {
  const langNames: Record<string, string> = {
    hi: 'Hindi',
    mr: 'Marathi',
    ta: 'Tamil',
    en: 'English'
  };

  const targetLang = langNames[targetLangCode] || targetLangCode;
  if (targetLang === 'English') return text;

  const gemini = new GeminiProvider();
  const messages = [
    {
      role: 'system' as const,
      content: 'You are a professional translator specializing in translating business and technical government tender summaries from English to Indian regional languages. Translate the content accurately, preserving technical terms, numerical values (crores, lakhs), and formatting. Return ONLY the translated text without explanations, introduction, greetings, or markdown container formatting like backticks unless it is in the source.'
    },
    {
      role: 'user' as const,
      content: `Translate the following text to ${targetLang}:\n\n${text}`
    }
  ];

  try {
    const stream = await gemini.streamChat(messages, {
      model: 'gemini-1.5-flash',
      temperature: 0.1
    });

    let translated = '';
    for await (const chunk of stream) {
      translated += chunk;
    }
    return translated.trim();
  } catch (err: any) {
    console.error(`[TranslationService] LLM translation failed for ${targetLangCode}:`, err.message || err);
    throw err;
  }
}

// Recursively translate string properties of an object
async function translateObjectStrings(obj: any, targetLangCode: string): Promise<any> {
  if (typeof obj === 'string') {
    if (obj.trim() === '' || obj.includes('Upgrade to Starter or Pro')) return obj;
    return await translateText(obj, targetLangCode);
  }
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => translateObjectStrings(item, targetLangCode)));
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      if (key === 'translations') continue; // don't translate cache metadata
      result[key] = await translateObjectStrings(obj[key], targetLangCode);
    }
    return result;
  }
  return obj;
}

// Main translation orchestrator that handles caching
export async function getOrTranslateSummary(
  tenderId: string,
  targetLangCode: string
): Promise<any> {
  const lang = (targetLangCode || 'en').toLowerCase();
  
  // 1. Fetch tender details
  const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId)).limit(1);
  if (!tender) {
    throw new Error('Tender not found');
  }

  const aiSummaryJson = tender.aiSummary ? JSON.parse(tender.aiSummary) : {};

  // If language is English, return directly
  if (lang === 'en') {
    return aiSummaryJson;
  }

  // 2. Check cache
  if (aiSummaryJson.translations && aiSummaryJson.translations[lang]) {
    console.log(`[TranslationService] Translation cache hit for tender ${tenderId} in lang ${lang}`);
    return aiSummaryJson.translations[lang];
  }

  console.log(`[TranslationService] Translation cache miss for tender ${tenderId} in lang ${lang}. Generating...`);

  // 3. Perform on-demand translation
  const cleanSummaryToTranslate = { ...aiSummaryJson };
  delete cleanSummaryToTranslate.translations;

  const translatedSummary = await translateObjectStrings(cleanSummaryToTranslate, lang);

  // 4. Update Cache in DB
  const updatedSummary = {
    ...aiSummaryJson,
    translations: {
      ...(aiSummaryJson.translations || {}),
      [lang]: translatedSummary
    }
  };

  await db
    .update(tenders)
    .set({ aiSummary: JSON.stringify(updatedSummary) })
    .where(eq(tenders.id, tenderId));

  console.log(`[TranslationService] Translation successfully generated and cached for tender ${tenderId} in lang ${lang}`);
  
  return translatedSummary;
}
