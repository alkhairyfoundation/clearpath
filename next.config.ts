import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["z-ai-web-dev-sdk", "@prisma/client", "prisma"],

};

export default nextConfig;
