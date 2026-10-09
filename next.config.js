/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        "timers/promises": false,
        timers: false,
        dns: false,
        child_process: false,
        os: false,
        path: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        mongodb: false,
        kerberos: false,
        '@mongodb-js/zstd': false,
        snappy: false,
        'gcp-metadata': false,
        '@aws-sdk/credential-providers': false,
        socks: false,
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
