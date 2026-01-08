/**
 * Text-to-Speech API Route - ElevenLabs Integration
 * Converts text to natural-sounding speech for Eddie
 * Last Modified: January 2025
 */

import { NextResponse } from 'next/server';

// ElevenLabs voice IDs - can be customized
// Default: "Daniel" - a clear, natural male voice
const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9'; // Daniel - British male
const FALLBACK_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam - American male

export async function POST(request: Request) {
  try {
    const { text, voiceId } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.BIRDHAUS_VOICE || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      // Fall back to Web Speech API if no API key
      return NextResponse.json(
        { fallback: true, message: 'No ElevenLabs API key configured' },
        { status: 200 }
      );
    }

    // Truncate very long text to avoid excessive API costs
    const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: truncatedText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);

      // If voice not found, try fallback voice
      if (response.status === 404 && voiceId !== FALLBACK_VOICE_ID) {
        console.log('Trying fallback voice...');
        const fallbackResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${FALLBACK_VOICE_ID}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({
              text: truncatedText,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          }
        );

        if (fallbackResponse.ok) {
          const audioBuffer = await fallbackResponse.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString('base64');
          return NextResponse.json({ audio: base64Audio });
        }
      }

      return NextResponse.json(
        { fallback: true, error: 'ElevenLabs API error' },
        { status: 200 }
      );
    }

    // Convert audio to base64 for client-side playback
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({ audio: base64Audio });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { fallback: true, error: 'Failed to generate speech' },
      { status: 200 }
    );
  }
}
