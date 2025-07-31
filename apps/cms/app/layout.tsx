import type { Metadata } from 'next';
import { Providers } from '../components/providers';
import './globals.css';

// Force dynamic rendering for CMS app (authentication required)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CMS Dashboard',
  description: 'Content Management System for SaaS Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}