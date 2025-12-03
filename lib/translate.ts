import axios from 'axios';

// Single text translation
export async function translateText(text: string, target: 'zh' | 'en'): Promise<string> {
  if (target === 'en') return text;

  // Use Next.js API route to avoid CORS issues
  const response = await axios.get('/api/translate', {
    params: { text, target }
  });

  return response.data.translated;
}

// Batch translation - sends all texts in ONE request
export async function translateBatchTexts(
  texts: string[],
  target: 'zh' | 'en'
): Promise<Record<string, string>> {
  if (target === 'en') {
    // Return original texts as key-value pairs
    return texts.reduce((acc, text) => ({ ...acc, [text]: text }), {});
  }

  // Use POST to send batch of texts in one request
  const response = await axios.post('/api/translate', {
    texts,
    target
  });

  // Convert array of results to object for easy lookup
  const translationMap: Record<string, string> = {};
  response.data.results.forEach((result: any) => {
    translationMap[result.original] = result.translated;
  });

  return translationMap;
}
