/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 3Dmol ships a large UMD bundle; transpile it so Next can bundle cleanly.
  transpilePackages: ["3dmol"],
};

export default nextConfig;
