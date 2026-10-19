// lib/similarity.ts
//
// Cosine similarity in JS for the small sets (a student's contacts, the
// mentor pool) where a pgvector RPC would be overkill. Vectors from
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
