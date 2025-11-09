import type { NextConfig } from "next"
import { baseURL } from "./baseUrl"

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
