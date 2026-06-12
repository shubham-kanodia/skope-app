import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The embed script (public/skope*.js) is served with permissive CORS so it
  // can load on customer sites. Headers for it are set per-route at the edge later.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
