import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const TRANSLATE_API_URL = 'https://translation-worker.qa-kodionsoftware-b64.workers.dev/';

// Single translation endpoint
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const text = searchParams.get('text');
    const target = searchParams.get('target');

    if (!text || !target) {
      return NextResponse.json(
        { error: 'Missing text or target parameter' },
        { status: 400 }
      );
    }

    // Forward the request to the translation API from server side (avoids CORS)
    const response = await axios.get(TRANSLATE_API_URL, {
      params: { text, target },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed', details: error.message },
      { status: 500 }
    );
  }
}

// Batch translation endpoint - POST method
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts, target } = body;

    if (!texts || !Array.isArray(texts) || !target) {
      return NextResponse.json(
        { error: 'Missing texts array or target parameter' },
        { status: 400 }
      );
    }

    // Translate all texts in parallel (but in one API call from client perspective)
    const translationPromises = texts.map(async (text: string) => {
      try {
        const response = await axios.get(TRANSLATE_API_URL, {
          params: { text, target },
        });
        return {
          original: text,
          translated: response.data.translated,
          success: true,
        };
      } catch (error) {
        console.error(`Translation failed for "${text}":`, error);
        return {
          original: text,
          translated: text, // Fallback to original
          success: false,
        };
      }
    });

    const results = await Promise.all(translationPromises);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Batch translation API error:', error);
    return NextResponse.json(
      { error: 'Batch translation failed', details: error.message },
      { status: 500 }
    );
  }
}
