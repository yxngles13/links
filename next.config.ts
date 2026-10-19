import type { NextConfig } from "next";

// lib/embeddings.ts runs a local model through onnxruntime-node. Its native
// library (libonnxruntime.so) is loaded at runtime, so file tracing misses
// it and Vercel functions crash with "cannot open shared object file".
// Include the Linux build explicitly; drop the macOS/Windows builds.
const ONNX_BIN = "./node_modules/onnxruntime-node/bin/napi-v3";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**": [`${ONNX_BIN}/linux/x64/**/*`],
  },
  outputFileTracingExcludes: {
    "/**": [`${ONNX_BIN}/darwin/**/*`, `${ONNX_BIN}/win32/**/*`, `${ONNX_BIN}/linux/arm64/**/*`],
  },
  experimental: {
    // Profile photo (≤1.5 MB) and resume (≤2.5 MB) can upload together
    // through one server action; the default limit is 1 MB. Vercel caps
    // request bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
