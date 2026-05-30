import type { NextConfig } from "next";

/**
 * Next.js 16.2 configuration.
 * - Turbopack is the default bundler in 16.x; no explicit flag required.
 * - React Compiler is opt-in via experimental.reactCompiler (stable in 16.2).
 */
const config: NextConfig = {
  reactCompiler: true,
};

export default config;
