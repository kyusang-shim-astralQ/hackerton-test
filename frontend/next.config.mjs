/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 3dmol는 브라우저 전용(window/WebGL)이므로 dynamic import + ssr:false로만 로드한다.
};

export default nextConfig;
