// lib/similarity.ts
//
// Cosine similarity in JS for small sets (a student's contacts) where a
// pgvector RPC would be overkill. Vectors from
// lib/embeddings.ts are already normalized, so this is just a dot product,
// but it divides by the norms anyway in case a vector came from elsewhere.

// PostgREST returns vector columns as a string like "[0.1,0.2,...]".
export function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

export function cosine(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

// One professor against a student's vector, for picks from Professors.
// A professor seeded without an embedding just scores 0.
export function scoreFor(profileVec: number[], opportunityEmbedding: unknown): number {
  const v = parseVector(opportunityEmbedding)
  return v ? cosine(profileVec, v) : 0
}

// What students see instead of raw cosine × 100. With all-MiniLM-L6-v2,
// related texts land around 0.3–0.6, so a genuinely good match used to show
// as "51". This stretches that range onto friendlier numbers, pinned to the
// label thresholds in lib/matching.ts (0.4 = Good starts at 70, 0.6 =
// Strong starts at 90) so the number and the label always agree. Ranking
// still uses the raw similarity; this is display only.
const SCORE_POINTS: [number, number][] = [
  [0.2, 40],
  [0.4, 70],
  [0.6, 90],
  [0.75, 99],
]

export function displayScore(similarity: number): number {
  const [first] = SCORE_POINTS
  const last = SCORE_POINTS[SCORE_POINTS.length - 1]
  if (similarity <= first[0]) return first[1]
  if (similarity >= last[0]) return last[1]
  for (let i = 1; i < SCORE_POINTS.length; i++) {
    const [x1, y1] = SCORE_POINTS[i]
    if (similarity <= x1) {
      const [x0, y0] = SCORE_POINTS[i - 1]
      return Math.round(y0 + ((similarity - x0) / (x1 - x0)) * (y1 - y0))
    }
  }
  return last[1]
}
