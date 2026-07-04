let synth: SpeechSynthesis | null = null;
let voicesLoaded = false;
let onVoicesReady: (() => void) | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (synth) synth.cancel();
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

  const femalePatterns = ['female', 'zira', 'samantha', 'hazel', 'karen', 'susan',
    'linda', 'catherine', 'jenny', 'aria', 'libby', 'aderonke', 'eno',
    'google us english', 'google uk english female'];

  const isFemale = (v: SpeechSynthesisVoice) =>
    nameMatches(v.name, femalePatterns);

  // 1. Nigerian English female voice (en-NG) — best for Nigerian names
  const ngFemale = voices.find(v =>
    v.lang === 'en-NG' && isFemale(v)
  );
  if (ngFemale) {
    console.log(`[tts] Selected voice: ${ngFemale.name} (${ngFemale.lang})`);
    return ngFemale;
  }

  // 2. American English female voice
  const usFemale = voices.find(v =>
    (v.lang === 'en-US' || v.lang.startsWith('en-US')) && isFemale(v)
  );
  if (usFemale) {
    console.log(`[tts] Selected voice: ${usFemale.name} (${usFemale.lang})`);
    return usFemale;
  }

  // 3. Nigerian English any voice
  const ngAny = voices.find(v => v.lang === 'en-NG');
  if (ngAny) {
    console.log(`[tts] Selected voice: ${ngAny.name} (${ngAny.lang})`);
    return ngAny;
  }

  // 4. Named female voices (any accent) — ordered by quality
  const preferredFemaleNames = [
    'Microsoft Jenny',       // Windows 11 - American female (natural)
    'Microsoft Aria',        // Windows 11 - American female (natural)
    'Microsoft Zira',        // Windows - American female
    'Microsoft Libby',       // Windows - American female (natural)
    'Google US English',     // Chrome - American female
    'Samantha',              // macOS - American female
    'Microsoft Aderonke',    // Windows - Nigerian English female (if installed)
    'Microsoft Eno',         // Windows - Nigerian English female (if installed)
    'Google UK English Female', // Chrome - British female
    'Microsoft Catherine',   // Windows - female
    'Microsoft Hazel',       // Windows - British female
    'Karen',                 // macOS - Australian female
    'Microsoft Susan',       // Windows - female
    'Microsoft Linda',       // Windows - female
  ];
  for (const name of preferredFemaleNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) {
      console.log(`[tts] Selected voice: ${voice.name} (${voice.lang})`);
      return voice;
    }
  }

  // 5. Any female English voice
  const femaleEn = voices.find(v =>
    v.lang.startsWith('en') &&
    nameMatches(v.name, femalePatterns)
  );
  if (femaleEn) {
    console.log(`[tts] Selected voice: ${femaleEn.name} (${femaleEn.lang})`);
    return femaleEn;
  }

  // 6. Any English voice
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) {
    console.log(`[tts] Selected voice: ${enVoice.name} (${enVoice.lang})`);
    return enVoice;
  }

  // 7. Any voice at all
  const fallback = voices[0];
  console.log(`[tts] Selected voice: ${fallback.name} (${fallback.lang})`);
  return fallback;
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
  if (!synth) {
    if (!isSpeechSupported()) return;
    synth = window.speechSynthesis;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1.05;
  utterance.volume = options?.volume ?? 1.0;

  const voice = findBestVoice();
  if (voice) utterance.voice = voice;

  if (options?.onStart) utterance.onstart = options.onStart;
  if (options?.onEnd) utterance.onend = options.onEnd;
  if (options?.onError) utterance.onerror = options.onError;

  synth.speak(utterance);
}
