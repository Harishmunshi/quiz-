import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: do NOT use "output: standalone" on Vercel.
  // Standalone output is for self-hosting (Docker, your own server) and
  // breaks Vercel's build because the .next/next-server.js.nft.json file
  // isn't generated in the layout Vercel's onBuildComplete hook expects.
  // Vercel handles the serverless build for us — no flag needed.
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
