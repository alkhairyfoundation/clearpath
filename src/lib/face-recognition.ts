const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let faceapi: any = null;
let modelsLoaded = false;

export async function loadFaceModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  try {
    const faceApiModule = await import('@vladmandic/face-api');
    faceapi = faceApiModule;
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    return true;
  } catch (err) {
    console.error('Failed to load face models:', err);
    return false;
  }
}

export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ detection: any; descriptor: number[] } | null> {
  if (!faceapi) return null;
  try {
    const result = await faceapi
      .detectSingleFace(input)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    return {
      detection: result.detection,
      descriptor: Array.from(result.descriptor),
    };
  } catch {
    return null;
  }
}

export async function getFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<number[] | null> {
  const result = await detectFace(videoElement);
  return result?.descriptor || null;
}

export function compareDescriptors(
  desc1: number[],
  desc2: number[],
  threshold: number = 0.5
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
    match: bestMatch.distance < 0.5,
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
