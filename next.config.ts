import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default config;
