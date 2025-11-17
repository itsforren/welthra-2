import type { NextConfig } from "next";
import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: /\/_next\/.*/,
      handler: "CacheFirst",
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  compress: true,
  experimental: {
    ppr: true,
    turbo: {
      minify: true,
      sourceMaps: false,
      rules: {},
    },
  },

  images: {
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },

  productionBrowserSourceMaps: false,
};

export default withPWA(nextConfig);
