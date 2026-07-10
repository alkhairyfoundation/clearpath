import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

export const runtime = 'nodejs';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

const EDGE_VOICES: Record<string, string> = {
  'en-US-JennyNeural': 'Jenny (Natural) - English US',
  'en-US-AriaNeural': 'Aria (Natural) - English US',
  'en-US-GuyNeural': 'Guy (Natural) - English US',
  'en-US-AnaNeural': 'Ana (Natural) - English US',
  'en-US-SaraNeural': 'Sara (Natural) - English US',
  'en-GB-SoniaNeural': 'Sonia (Natural) - English UK',
  'en-GB-RyanNeural': 'Ryan (Natural) - English UK',
  'en-NG-EzinneNeural': 'Ezinne (Natural) - English Nigeria',
};

async function synthesizeWithEdge(text: string, voiceName: string): Promise<Buffer> {
  const connectionId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&connectionId=${connectionId}`;

  return new Promise((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let timeout: ReturnType<typeof setTimeout>;

    const ws = new WebSocket(wsUrl);

    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        ws.close();
        reject(new Error('TTS WebSocket timed out'));
      }, 15000);
    };

    ws.on('open', () => {
      resetTimeout();
      // Send speech config
      const configMsg = buildEdgeMessage(
        'speech.config',
        'application/json; charset=utf-8',
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: false,
                  wordBoundaryEnabled: false,
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        }),
        requestId
      );
      ws.send(configMsg);

      // Send SSML
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="0%" pitch="0%">${escapedText}</prosody></voice></speak>`;

      const ssmlMsg = buildEdgeMessage('ssml', 'application/ssml+xml', ssml, requestId);
      ws.send(ssmlMsg);
    });

    ws.on('message', (data: Buffer) => {
      resetTimeout();
      // Find the audio data after the headers (after \r\n\r\n)
      const headerEnd = data.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerSection = data.subarray(0, headerEnd).toString();
      const audioData = data.subarray(headerEnd + 4);

      // Skip non-audio messages (like Turn.Start, Turn.End)
      if (headerSection.includes('Content-Type:audio')) {
        if (audioData.length > 0) {
          audioChunks.push(audioData);
        }
      }

      // Check if this is the end
      if (headerSection.includes('Path:turn.end')) {
        ws.close();
      }
    });

    ws.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', () => {
      if (timeout) clearTimeout(timeout);
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(new Error('No audio data received'));
      }
    });
  });
}

function buildEdgeMessage(path: string, contentType: string, body: string, requestId: string): Buffer {
  const headers = [
    `X-RequestId:${requestId}`,
    `Content-Type:${contentType}`,
    `Path:${path}`,
    '',
    body,
  ].join('\r\n');
  return Buffer.from(headers, 'utf-8');
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const voiceName = voice && EDGE_VOICES[voice] ? voice : 'en-US-JennyNeural';
    const audioBuffer = await synthesizeWithEdge(text, voiceName);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[tts] Edge TTS error:', error);
    return NextResponse.json(
      { error: 'TTS synthesis failed', detail: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    voices: Object.entries(EDGE_VOICES).map(([id, name]) => ({ id, name })),
    defaultVoice: 'en-US-JennyNeural',
  });
}
