const MODEL_URLS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/',
  'https://unpkg.com/@vladmandic/face-api@1.7.15/model/',
];
const LOAD_TIMEOUT_MS = 30000;

let faceapi: any = null;
let modelsLoaded = false;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function loadModelsFromUrl(url: string): Promise<boolean> {
  const faceApiModule = await import('@vladmandic/face-api');
  faceapi = faceApiModule;
  await withTimeout(faceapi.nets.ssdMobilenetv1.loadFromUri(url), LOAD_TIMEOUT_MS);
  await withTimeout(faceapi.nets.faceLandmark68Net.loadFromUri(url), LOAD_TIMEOUT_MS);
  await withTimeout(faceapi.nets.faceRecognitionNet.loadFromUri(url), LOAD_TIMEOUT_MS);
  return true;
}

export async function loadFaceModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  for (const url of MODEL_URLS) {
    try {
      console.log(`[face-api] Loading models from: ${url}`);
      const ok = await loadModelsFromUrl(url);
      modelsLoaded = ok;
      return ok;
    } catch (err) {
      console.warn(`[face-api] Failed to load from ${url}:`, err);
    }
  }
  console.error('[face-api] All CDN URLs failed');
  return false;
}

// Minimum confidence threshold for face detection
const MIN_CONFIDENCE = 0.6;

export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ detection: any; descriptor: number[] } | null> {
  if (!faceapi) return null;
  try {
    // Detect all faces and pick the best (highest confidence)
    const results = await faceapi
      .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!results || results.length === 0) return null;

    // Pick the face with highest detection score
    const best = results.reduce((a: any, b: any) =>
      a.detection.score > b.detection.score ? a : b
    );

    // Quality check: ensure the face box is reasonably sized
    const box = best.detection.box;
    const minSize = 80;
    if (box.width < minSize || box.height < minSize) return null;

    return {
      detection: best.detection,
      descriptor: Array.from(best.descriptor),
    };
  } catch {
    return null;
  }
}

// Best face descriptor from multiple capture attempts
export async function getBestFaceDescriptor(
  videoElement: HTMLVideoElement,
  attempts: number = 5,
  pauseMs: number = 200
): Promise<number[] | null> {
  const descriptors: { descriptor: number[]; score: number }[] = [];

  for (let i = 0; i < attempts; i++) {
    const result = await detectFace(videoElement);
    if (result) {
      descriptors.push({
        descriptor: result.descriptor,
        score: result.detection.score,
      });
    }
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, pauseMs));
    }
  }

  if (descriptors.length === 0) return null;

  descriptors.sort((a, b) => b.score - a.score);
  return descriptors[0].descriptor;
}

// Quick single capture for faster check-in recognition
export async function quickFaceScan(
  videoElement: HTMLVideoElement
): Promise<number[] | null> {
  const attempts = 2;
  const descriptors: { descriptor: number[]; score: number }[] = [];

  for (let i = 0; i < attempts; i++) {
    const result = await detectFace(videoElement);
    if (result) {
      descriptors.push({
        descriptor: result.descriptor,
        score: result.detection.score,
      });
    }
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  if (descriptors.length === 0) return null;

  descriptors.sort((a, b) => b.score - a.score);
  return descriptors[0].descriptor;
}

// Quick single descriptor capture (for backward compatibility)
export async function getFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<number[] | null> {
  return getBestFaceDescriptor(videoElement, 1);
}

export function compareDescriptors(
  desc1: number[],
  desc2: number[],
  threshold: number = 0.4
): { match: boolean; distance: number } {
  if (desc1.length !== desc2.length) {
    return { match: false, distance: Infinity };
  }
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += (desc1[i] - desc2[i]) ** 2;
  }
  const distance = Math.sqrt(sum);
  return { match: distance < threshold, distance };
}

export function findBestMatch(
  descriptor: number[],
  registeredDescriptors: { studentId: string; descriptor: number[] }[]
): { studentId: string | null; distance: number; match: boolean } {
  let bestMatch: { studentId: string | null; distance: number } = {
    studentId: null,
    distance: Infinity,
  };

  for (const reg of registeredDescriptors) {
    if (!reg.descriptor || reg.descriptor.length === 0) continue;
    const { distance } = compareDescriptors(descriptor, reg.descriptor);
    if (distance < bestMatch.distance) {
      bestMatch = { studentId: reg.studentId, distance };
    }
  }

  return {
    ...bestMatch,
    // Stricter threshold for reliable matching (0.4 vs previous 0.5)
    match: bestMatch.distance < 0.4,
  };
}

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
