import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow any HTTPS host so admins can paste image URLs from any image
    // hosting service (Imgur, Cloudinary, Drive direct links, etc.) without
    // having to whitelist hosts.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
