let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNotes(notes: { freq: number; time: number; duration: number }[], type: OscillatorType = 'sine', volume = 0.25) {
  const ctx = getCtx();
  if (!ctx) return;
  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + duration);
  });
}

export function playCorrect() {
  playNotes([
    { freq: 523.25, time: 0, duration: 0.15 },
    { freq: 659.25, time: 0.1, duration: 0.25 },
  ], 'sine', 0.3);
}

export function playWrong() {
  playNotes([
    { freq: 311.13, time: 0, duration: 0.2 },
    { freq: 261.63, time: 0.15, duration: 0.3 },
  ], 'square', 0.15);
}

export function playNext() {
  playTone(880, 0.08, 'sine', 0.15);
}

export function playEnd() {
  playNotes([
    { freq: 523.25, time: 0, duration: 0.2 },
    { freq: 659.25, time: 0.2, duration: 0.2 },
    { freq: 783.99, time: 0.4, duration: 0.2 },
    { freq: 1046.5, time: 0.6, duration: 0.5 },
  ], 'sine', 0.25);
}
