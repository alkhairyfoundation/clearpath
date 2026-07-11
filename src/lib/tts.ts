let synth: SpeechSynthesis | null = null;
let voicesLoaded = false;
let onVoicesReady: (() => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (synth) synth.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function preloadVoices(callback?: () => void): void {
  if (!isSpeechSupported()) return;
  synth = window.speechSynthesis;
  onVoicesReady = callback || null;
  const voices = synth.getVoices();
  if (voices.length > 0) {
    voicesLoaded = true;
    onVoicesReady?.();
  } else {
    synth.onvoiceschanged = () => {
      voicesLoaded = true;
      onVoicesReady?.();
    };
  }
}

export function areVoicesLoaded(): boolean {
  return voicesLoaded;
}

function findBestVoice(): SpeechSynthesisVoice | null {
  if (!synth) return null;
  const voices = synth.getVoices();
  if (voices.length === 0) return null;

  const nameMatches = (name: string, patterns: string[]) =>
    patterns.some(p => name.toLowerCase().includes(p.toLowerCase()));

  const naturalPatterns = [
    'natural', 'neural',
    'microsoft jenny', 'microsoft aria', 'microsoft guy',
    'microsoft sara', 'microsoft ana', 'microsoft sonia',
    'microsoft ryan', 'microsoft ezinne',
  ];

  const femalePatterns = ['female', 'zira', 'samantha', 'hazel', 'karen', 'susan',
    'linda', 'catherine', 'jenny', 'aria', 'libby', 'aderonke', 'eno',
    'google us english', 'google uk english female',
    'microsoft jenny', 'microsoft aria', 'microsoft sara',
    'microsoft ana', 'microsoft sonia', 'microsoft ezinne',
  ];

  const isFemale = (v: SpeechSynthesisVoice) =>
    nameMatches(v.name, femalePatterns);

  for (const v of voices) {
    if (nameMatches(v.name, naturalPatterns)) {
      console.log(`[tts] Selected voice: ${v.name} (${v.lang})`);
      return v;
    }
  }

  const ngFemale = voices.find(v => v.lang === 'en-NG' && isFemale(v));
  if (ngFemale) {
    console.log(`[tts] Selected voice: ${ngFemale.name} (${ngFemale.lang})`);
    return ngFemale;
  }

  const usFemale = voices.find(v =>
    (v.lang === 'en-US' || v.lang.startsWith('en-US')) && isFemale(v)
  );
  if (usFemale) {
    console.log(`[tts] Selected voice: ${usFemale.name} (${usFemale.lang})`);
    return usFemale;
  }

  const ngAny = voices.find(v => v.lang === 'en-NG');
  if (ngAny) {
    console.log(`[tts] Selected voice: ${ngAny.name} (${ngAny.lang})`);
    return ngAny;
  }

  const preferredFemaleNames = [
    'Microsoft Zira', 'Microsoft Libby', 'Google US English',
    'Samantha', 'Microsoft Catherine', 'Microsoft Hazel',
    'Karen', 'Microsoft Susan', 'Microsoft Linda',
  ];
  for (const name of preferredFemaleNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) {
      console.log(`[tts] Selected voice: ${voice.name} (${voice.lang})`);
      return voice;
    }
  }

  const femaleEn = voices.find(v =>
    v.lang.startsWith('en') && nameMatches(v.name, femalePatterns)
  );
  if (femaleEn) {
    console.log(`[tts] Selected voice: ${femaleEn.name} (${femaleEn.lang})`);
    return femaleEn;
  }

  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) {
    console.log(`[tts] Selected voice: ${enVoice.name} (${enVoice.lang})`);
    return enVoice;
  }

  const fallback = voices[0];
  console.log(`[tts] Selected voice: ${fallback.name} (${fallback.lang})`);
  return fallback;
}

function speakWithBrowser(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): void {
  if (!synth) {
    if (!isSpeechSupported()) {
      onError?.();
      return;
    }
    synth = window.speechSynthesis;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.05;
  utterance.volume = 1.0;
  utterance.lang = 'en-US';

  const voice = findBestVoice();
  if (voice) utterance.voice = voice;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  synth.speak(utterance);
}

async function speakWithServer(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'en-US-JennyNeural' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      onError?.();
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;
    onStart?.();

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      onEnd?.();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      onError?.();
    };

    try {
      await audio.play();
    } catch {
      URL.revokeObjectURL(url);
      currentAudio = null;
      onError?.();
    }
  } catch {
    onError?.();
  }
}

export function speak(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  const { onStart, onEnd, onError } = options || {};

  speakWithServer(text, onStart, onEnd, () => {
    // Server TTS failed — fall back to browser TTS
    speakWithBrowser(text, onStart, onEnd, onError);
  });
}
