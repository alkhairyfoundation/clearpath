const MODEL_BASE = '/models';
const LOAD_TIMEOUT_MS = 120000;

let faceapi: any = null;
let modelsLoaded = false;
let loadingGuard: Promise<boolean> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function loadFaceModels(onProgress?: (loaded: number, total: number) => void): Promise<boolean> {
  if (modelsLoaded) return true;
  if (loadingGuard) return loadingGuard;

  loadingGuard = (async () => {
    try {
      const faceApiModule = await import('@vladmandic/face-api');
      faceapi = faceApiModule;

      const models = [
        { name: 'Tiny Face Detector', load: () => faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE) },
        { name: 'Face Landmark 68', load: () => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE) },
        { name: 'Face Recognition', load: () => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE) },
      ];

      for (let i = 0; i < models.length; i++) {
        console.log(`[face-api] Loading ${models[i].name} from ${MODEL_BASE}`);
        onProgress?.(i, models.length);
        await withTimeout(models[i].load(), LOAD_TIMEOUT_MS);
        console.log(`[face-api] ${models[i].name} loaded`);
      }

      onProgress?.(models.length, models.length);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('[face-api] Model loading failed:', err);
      modelsLoaded = false;
      return false;
    } finally {
      loadingGuard = null;
    }
  })();

  return loadingGuard;
}

// ===================== FACE QUALITY ASSESSMENT =====================

export interface FaceQuality {
  blurScore: number;
  poseScore: number;
  brightnessScore: number;
  detectionScore: number;
  overall: number;
}

function getFaceRegionCanvas(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box?: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  if (box) {
    canvas.width = box.width;
    canvas.height = box.height;
  } else if (source instanceof HTMLVideoElement) {
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
  } else {
    canvas.width = source.width;
    canvas.height = source.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (box) {
    ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  } else {
    ctx.drawImage(source, 0, 0);
  }
  return canvas;
}

function detectBlur(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      const t = (y - 1) * w + x;
      const b = (y + 1) * w + x;
      const l = y * w + (x - 1);
      const r = y * w + (x + 1);
      const lap = 4 * gray
        - (0.299 * pixels[t * 4] + 0.587 * pixels[t * 4 + 1] + 0.114 * pixels[t * 4 + 2])
        - (0.299 * pixels[b * 4] + 0.587 * pixels[b * 4 + 1] + 0.114 * pixels[b * 4 + 2])
        - (0.299 * pixels[l * 4] + 0.587 * pixels[l * 4 + 1] + 0.114 * pixels[l * 4 + 2])
        - (0.299 * pixels[r * 4] + 0.587 * pixels[r * 4 + 1] + 0.114 * pixels[r * 4 + 2]);
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Normalize: typical sharp face ~ 50-200+, blurry < 20
  return Math.min(1, variance / 120);
}

function checkPose(landmarks: any): { frontal: boolean; score: number } {
  const pos = landmarks.positions || landmarks;
  if (!pos || pos.length < 47) return { frontal: false, score: 0 };

  const leftEye = { x: (pos[36].x + pos[39].x) / 2, y: (pos[36].y + pos[39].y) / 2 };
  const rightEye = { x: (pos[42].x + pos[45].x) / 2, y: (pos[42].y + pos[45].y) / 2 };
  const noseTip = pos[30];
  const faceMidX = (leftEye.x + rightEye.x) / 2;

  const eyeDist = Math.abs(leftEye.x - rightEye.x);
  if (eyeDist < 1) return { frontal: false, score: 0 };

  const rollRaw = Math.abs(leftEye.y - rightEye.y) / eyeDist;
  const rollScore = Math.max(0, 1 - rollRaw * 8);

  const yawRaw = Math.abs(noseTip.x - faceMidX) / eyeDist;
  const yawScore = Math.max(0, 1 - yawRaw * 5);

  const score = rollScore * yawScore;
  return { frontal: score > 0.45, score };
}

function checkBrightness(canvas: HTMLCanvasElement): { ok: boolean; score: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, score: 0 };
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  const mean = sum / (pixels.length / 4) / 255;
  const ok = mean > 0.12 && mean < 0.88;
  const score = mean < 0.1 || mean > 0.9 ? 0 : mean < 0.15 || mean > 0.85 ? 0.4 : 1;
  return { ok, score };
}

function assessFaceQuality(
  detectionScore: number,
  box: { width: number; height: number },
  landmarks: any,
  sourceCanvas: HTMLCanvasElement
): FaceQuality {
  const blurScore = detectBlur(sourceCanvas);
  const pose = checkPose(landmarks);
  const brightness = checkBrightness(sourceCanvas);
  const overall = (
    blurScore * 0.25 +
    pose.score * 0.30 +
    brightness.score * 0.15 +
    detectionScore * 0.30
  );
  return { blurScore, poseScore: pose.score, brightnessScore: brightness.score, detectionScore, overall };
}

// ===================== ENHANCED FACE DETECTION =====================

const MIN_CONFIDENCE = 0.6;
const MIN_FACE_SIZE = 80;

export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ detection: any; descriptor: number[]; landmarks: any; quality: FaceQuality } | null> {
  if (!faceapi) return null;
  try {
    const results = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!results || results.length === 0) return null;

    const best = results.reduce((a: any, b: any) =>
      a.detection.score > b.detection.score ? a : b
    );

    const box = best.detection.box;
    if (box.width < MIN_FACE_SIZE || box.height < MIN_FACE_SIZE) return null;

    const sourceCanvas = getFaceRegionCanvas(input, { x: box.x, y: box.y, width: box.width, height: box.height });
    if (!sourceCanvas) return null;

    const quality = assessFaceQuality(best.detection.score, box, best.landmarks, sourceCanvas);

    return {
      detection: best.detection,
      descriptor: Array.from(best.descriptor),
      landmarks: best.landmarks,
      quality,
    };
  } catch {
    return null;
  }
}

// ===================== ENHANCED ENROLLMENT =====================

export async function getBestFaceDescriptor(
  videoElement: HTMLVideoElement,
  attempts: number = 8,
  pauseMs: number = 250
): Promise<{ descriptor: number[]; quality: FaceQuality } | null> {
  const results: { descriptor: number[]; quality: FaceQuality; score: number }[] = [];

  for (let i = 0; i < attempts; i++) {
    const result = await detectFace(videoElement);
    if (result) {
      // Only accept decent quality captures
      if (result.quality.overall > 0.3) {
        results.push({
          descriptor: result.descriptor,
          quality: result.quality,
          score: result.quality.overall,
        });
      }
    }
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, pauseMs));
    }
  }

  if (results.length === 0) return null;

  // Take top 3 by quality and average their descriptors
  results.sort((a, b) => b.score - a.score);
  const topN = results.slice(0, Math.min(3, results.length));

  const avgDescriptor = new Array(128).fill(0);
  for (const r of topN) {
    for (let i = 0; i < 128; i++) {
      avgDescriptor[i] += r.descriptor[i] / topN.length;
    }
  }

  // Re-normalize the averaged descriptor (face-api descriptors are unit vectors)
  let norm = 0;
  for (let i = 0; i < 128; i++) {
    norm += avgDescriptor[i] * avgDescriptor[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 128; i++) {
      avgDescriptor[i] /= norm;
    }
  }

  // Best quality score from the top results
  const bestQuality = topN[0].quality;

  return { descriptor: avgDescriptor, quality: bestQuality };
}

// ===================== QUICK SCAN (for live recognition) =====================

export async function quickFaceScan(
  videoElement: HTMLVideoElement
): Promise<{ descriptor: number[]; quality: FaceQuality } | null> {
  const result = await detectFace(videoElement);
  if (!result || result.quality.overall < 0.25) return null;
  return { descriptor: result.descriptor, quality: result.quality };
}

// Backward compatibility wrapper
export async function getFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<number[] | null> {
  const result = await getBestFaceDescriptor(videoElement, 1);
  return result?.descriptor ?? null;
}

// ===================== ENHANCED MATCHING =====================

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function combinedDistance(a: number[], b: number[]): { distance: number; similarity: number } {
  const euc = euclideanDistance(a, b);
  // Face-api descriptors are L2-normalized, so cosine similarity is just the dot product
  // and Euclidean distance is in [0, 2]. Convert to a combined score.
  const sim = cosineSimilarity(a, b);
  // Normalize Euclidean distance to [0, 1] range (max possible is 2 for unit vectors)
  const eucNorm = euc / 2;
  // Combined: lower is better (weighted average of normalized euclidean and 1-cosine)
  const distance = eucNorm * 0.5 + (1 - sim) * 0.5;
  return { distance, similarity: sim };
}

export function compareDescriptors(
  desc1: number[],
  desc2: number[],
  threshold: number = 0.4
): { match: boolean; distance: number; similarity: number } {
  if (desc1.length !== desc2.length || desc1.length !== 128) {
    return { match: false, distance: Infinity, similarity: 0 };
  }
  const { distance, similarity } = combinedDistance(desc1, desc2);
  return { match: distance < threshold, distance, similarity };
}

export interface MatchResult {
  studentId: string | null;
  distance: number;
  similarity: number;
  match: boolean;
  margin: number;
}

export function findBestMatch(
  descriptor: number[],
  registeredDescriptors: { studentId: string; descriptor: number[] }[]
): MatchResult {
  const scored: { studentId: string; distance: number; similarity: number }[] = [];

  for (const reg of registeredDescriptors) {
    if (!reg.descriptor || reg.descriptor.length !== 128) continue;
    const { distance, similarity } = combinedDistance(descriptor, reg.descriptor);
    scored.push({ studentId: reg.studentId, distance, similarity });
  }

  if (scored.length === 0) {
    return { studentId: null, distance: Infinity, similarity: 0, match: false, margin: 0 };
  }

  scored.sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const second = scored[1];

  // Margin check: if #1 and #2 are too close, it's ambiguous
  const margin = second ? (second.distance - best.distance) / (best.distance || 1) : Infinity;
  const hasMargin = margin > 0.12;

  // Adaptive threshold: lower threshold for lower-quality captures
  const threshold = 0.45;

  const match = best.distance < threshold && hasMargin;

  return {
    studentId: best.studentId,
    distance: best.distance,
    similarity: best.similarity,
    match,
    margin,
  };
}

// ===================== TEMPORAL CONSISTENCY =====================

export interface TemporalVote {
  studentId: string | null;
  distance: number;
  similarity: number;
  timestamp: number;
}

export class TemporalConsensus {
  private window: TemporalVote[] = [];
  private readonly maxWindow: number;
  private readonly requiredConsensus: number;
  private readonly windowDuration: number;

  constructor(
    maxWindow: number = 6,
    requiredConsensus: number = 3,
    windowDurationMs: number = 5000
  ) {
    this.maxWindow = maxWindow;
    this.requiredConsensus = requiredConsensus;
    this.windowDuration = windowDurationMs;
  }

  addVote(vote: TemporalVote): void {
    this.window.push(vote);
    this.prune();
  }

  private prune(): void {
    const now = Date.now();
    this.window = this.window.filter(v => now - v.timestamp < this.windowDuration);
    while (this.window.length > this.maxWindow) {
      this.window.shift();
    }
  }

  getConsensus(): { studentId: string | null; confidence: number; votes: TemporalVote[] } | null {
    this.prune();
    if (this.window.length < this.requiredConsensus) return null;

    const votesByStudent = new Map<string, TemporalVote[]>();
    for (const v of this.window) {
      if (v.studentId === null) continue;
      const arr = votesByStudent.get(v.studentId) || [];
      arr.push(v);
      votesByStudent.set(v.studentId, arr);
    }

    for (const [studentId, votes] of votesByStudent) {
      if (votes.length >= this.requiredConsensus) {
        // Calculate confidence: average similarity weighted by how many votes
        const avgSim = votes.reduce((s, v) => s + v.similarity, 0) / votes.length;
        const ratio = votes.length / this.maxWindow;
        const confidence = avgSim * 0.6 + ratio * 0.4;
        return { studentId, confidence, votes };
      }
    }

    return null;
  }

  reset(): void {
    this.window = [];
  }

  get voteCount(): number {
    this.prune();
    return this.window.length;
  }
}

// ===================== FRAME CAPTURE =====================

export function captureFrame(
  video: HTMLVideoElement,
  width: number = 320,
  height: number = 240
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.7);
}
