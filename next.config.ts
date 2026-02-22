import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ まずは原因切り分けのため Turbopack を使わずビルド（安定）
  experimental: {
    turbo: false,
  },

  // ✅ middleware を疑似的に完全無効化（matcher で何も当てない）
  //   ※ middleware.ts が存在しても、ここで止められる
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;