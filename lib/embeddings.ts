// lib/embeddings.ts
//
// Single source of truth for turning text into a vector. The seed script
// and the live matching flow BOTH need this — and critically, they need
// the exact same model and settings, or the vectors won't be comparable
// to each other. Import from here in both places rather than
// reimplementing it.

import { pipeline } from '@xenova/transformers'

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null

export async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
