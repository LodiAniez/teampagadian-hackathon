/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@raket/contracts"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
