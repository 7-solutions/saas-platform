/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@saas-platform/ui', '@saas-platform/shared'],
  
  // Next.js 15 experimental features
  experimental: {
    typedRoutes: true,
    // Optimize package imports for better tree shaking
    optimizePackageImports: [
      '@saas-platform/ui',
      '@saas-platform/shared',
      'lucide-react',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'next-auth'
    ],
    // Enable enhanced caching strategies
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // Image optimization for Docker environment with CMS-specific settings
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
        pathname: '/**',
      },
    ],
    // CMS-specific image optimization
    unoptimized: process.env.NODE_ENV === 'development',
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Docker-optimized standalone output
  output: 'standalone',

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Enhanced caching configuration for CMS
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Webpack optimizations for Next.js 15
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle splitting for CMS
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          tiptap: {
            test: /[\\/]node_modules[\\/]@tiptap[\\/]/,
            name: 'tiptap',
            chunks: 'all',
            priority: 15,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },

  // Security headers for CMS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;