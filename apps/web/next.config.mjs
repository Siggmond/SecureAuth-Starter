import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@secureauth/shared"],
  typedRoutes: true,
  outputFileTracingRoot: workspaceRoot
};

export default nextConfig;
