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

  const isFemale = (v: SpeechSynthesisVoice) =>
    nameMatches(v.name, ['female', 'zira', 'samantha', 'hazel', 'karen', 'susan', 'linda', 'catherine', 'google us english', 'google uk english female']);

  // 1. Nigerian English female voice (en-NG)
  const ngFemale = voices.find(v =>
    v.lang === 'en-NG' && isFemale(v)
  );
  if (ngFemale) return ngFemale;

  // 2. American English female voice
  const usFemale = voices.find(v =>
    (v.lang === 'en-US' || v.lang.startsWith('en-US')) && isFemale(v)
  );
  if (usFemale) return usFemale;

  // 3. Nigerian English any voice
  const ngAny = voices.find(v => v.lang === 'en-NG');
  if (ngAny) return ngAny;

  // 4. Named female voices (any accent)
  const preferredFemaleNames = [
    'Microsoft Zira',       // Windows - American female
    'Google US English',    // Chrome - American female
    'Samantha',             // macOS - American female
    'Google UK English Female', // Chrome - British female
    'Microsoft Hazel',       // Windows - British female
    'Karen',                // macOS - Australian female
    'Microsoft Catherine',   // Windows - female
    'Microsoft Susan',      // Windows - female
    'Microsoft Linda',      // Windows - female
  ];
  for (const name of preferredFemaleNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) return voice;
  }

  // 5. Any female English voice
  const femaleEn = voices.find(v =>
    v.lang.startsWith('en') &&
    nameMatches(v.name, ['female', 'zira', 'samantha', 'hazel', 'karen'])
  );
  if (femaleEn) return femaleEn;

  // 6. Any English voice
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) return enVoice;

  // 7. Any voice at all
  return voices[0];
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
