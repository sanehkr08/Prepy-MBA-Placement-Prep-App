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
  // Server-only packages, loaded at run time rather than bundled (the libSQL client has a native part).
  serverExternalPackages: ["unpdf", "mammoth", "@libsql/client", "libsql"],
};

export default nextConfig;
