import type { Metadata } from 'next';
import { Providers } from '../components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SaaS Startup Platform',
    template: '%s | SaaS Startup Platform',
  },
  description: 'Modern SaaS platform built with Next.js, TypeScript, Go, and CouchDB. Everything you need to launch your startup quickly and efficiently.',
  keywords: ['SaaS', 'startup', 'platform', 'Next.js', 'TypeScript', 'Go', 'CouchDB'],
  authors: [{ name: 'SaaS Platform Team' }],
  creator: 'SaaS Platform',
  publisher: 'SaaS Platform',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    siteName: 'SaaS Startup Platform',
    title: 'SaaS Startup Platform',
    description: 'Modern SaaS platform built with Next.js, TypeScript, Go, and CouchDB.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SaaS Startup Platform',
    description: 'Modern SaaS platform built with Next.js, TypeScript, Go, and CouchDB.',
    creator: '@saasplatform',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}