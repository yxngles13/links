// lib/embeddings.ts
//
// Single source of truth for turning text into a vector. The seed script
// and the live matching flow BOTH need this — and critically, they need
// the exact same model and settings, or the vectors won't be comparable
// to each other. Import from here in both places rather than
// reimplementing it.

import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

// The model (~23MB) downloads on first use. Locally it's cached inside
// node_modules; on Vercel that folder is read-only, so cache in /tmp, which
// survives for the life of a warm function instance.
if (process.env.VERCEL) env.cacheDir = '/tmp/transformers-cache'

let embedder: FeatureExtractionPipeline | null = null

export async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as FeatureExtractionPipeline
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
