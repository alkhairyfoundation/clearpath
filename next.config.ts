import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["z-ai-web-dev-sdk"],

};

export default nextConfig;
