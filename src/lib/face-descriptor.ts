export const FACE_DESCRIPTOR_LENGTH = 128;

export function isValidDescriptor(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_LENGTH) return false;
  return value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

// L2-normalize a raw face descriptor to unit length. face-api descriptors
// must be unit vectors for cosine/Euclidean matching to be consistent.
export function normalizeDescriptor(raw: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < raw.length; i++) {
    norm += raw[i] * raw[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0 || !Number.isFinite(norm)) return raw;
  const unit = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    unit[i] = raw[i] / norm;
  }
  return unit;
}
