import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // unpdf and mammoth run only on the server (API routes).
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
