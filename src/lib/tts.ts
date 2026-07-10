let synth: SpeechSynthesis | null = null;
let voicesLoaded = false;
let onVoicesReady: (() => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;

// Voice quality levels
export type VoiceQuality = 'natural' | 'decent' | 'robotic' | 'unavailable';

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

export function getVoiceQuality(): VoiceQuality {
  if (!synth) {
    if (!isSpeechSupported()) return 'unavailable';
    synth = window.speechSynthesis;
  }
  const voices = synth.getVoices();
  if (voices.length === 0) return 'unavailable';

  const voiceNames = voices.map(v => v.name.toLowerCase());

  // Check for neural/natural voices (best quality)
  const hasNatural = voiceNames.some(n =>
    n.includes('natural') || n.includes('neural') ||
    n.includes('microsoft jenny') || n.includes('microsoft aria') ||
    n.includes('google us english') || n.includes('google uk english female')
  );
  if (hasNatural) return 'natural';

  // Check for decent voices
  const hasDecent = voiceNames.some(n =>
    n.includes('zira') || n.includes('david') ||
    n.includes('samantha') || n.includes('karen')
  );
  if (hasDecent) return 'decent';

  return 'robotic';
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

  // 1. Natural/Neural voices (best quality)
  for (const v of voices) {
    if (nameMatches(v.name, naturalPatterns)) {
      console.log(`[tts] Selected voice: ${v.name} (${v.lang})`);
      return v;
    }
  }

  // 2. Nigerian English female voice (for Nigerian names)
  const ngFemale = voices.find(v => v.lang === 'en-NG' && isFemale(v));
  if (ngFemale) {
    console.log(`[tts] Selected voice: ${ngFemale.name} (${ngFemale.lang})`);
    return ngFemale;
  }

  // 3. American English female voice
  const usFemale = voices.find(v =>
    (v.lang === 'en-US' || v.lang.startsWith('en-US')) && isFemale(v)
  );
  if (usFemale) {
    console.log(`[tts] Selected voice: ${usFemale.name} (${usFemale.lang})`);
    return usFemale;
  }

  // 4. Nigerian English any voice
  const ngAny = voices.find(v => v.lang === 'en-NG');
  if (ngAny) {
    console.log(`[tts] Selected voice: ${ngAny.name} (${ngAny.lang})`);
    return ngAny;
  }

  // 5. Named female voices (any accent)
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

  // 6. Any female English voice
  const femaleEn = voices.find(v =>
    v.lang.startsWith('en') && nameMatches(v.name, femalePatterns)
  );
  if (femaleEn) {
    console.log(`[tts] Selected voice: ${femaleEn.name} (${femaleEn.lang})`);
    return femaleEn;
  }

  // 7. Any English voice
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) {
    console.log(`[tts] Selected voice: ${enVoice.name} (${enVoice.lang})`);
    return enVoice;
  }

  // 8. Any voice at all
  const fallback = voices[0];
  console.log(`[tts] Selected voice: ${fallback.name} (${fallback.lang})`);
  return fallback;
}

async function speakWithServerTTS(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'en-US-JennyNeural' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return false;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    currentAudio = audio;

    options?.onStart?.();

    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        options?.onEnd?.();
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        options?.onError?.();
        resolve(false);
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        options?.onError?.();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

function speakWithBrowserTTS(
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
  if (!synth) {
    if (!isSpeechSupported()) {
      options?.onError?.();
      return;
    }
    synth = window.speechSynthesis;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1.05;
  utterance.volume = options?.volume ?? 1.0;
  utterance.lang = 'en-US';

  const voice = findBestVoice();
  if (voice) utterance.voice = voice;

  if (options?.onStart) utterance.onstart = options.onStart;
  if (options?.onEnd) utterance.onend = options.onEnd;
  if (options?.onError) utterance.onerror = options.onError;

  synth.speak(utterance);
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
  // Try server Edge TTS first for natural voice
  speakWithServerTTS(text, {
    onStart: options?.onStart,
    onEnd: options?.onEnd,
    onError: () => {
      // Fallback to browser TTS if server fails
      speakWithBrowserTTS(text, options);
    },
  });
}
