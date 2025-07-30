import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainLayout } from '../../components/layout';
import { ContentRenderer } from '../../components/content-renderer';
import { getPageBySlug, getPublishedPages } from '../../lib/cms';
import type { Page } from '@saas-platform/shared';

interface PageProps {
  params: {
    slug: string[];
  };
}

// Generate static params for all published pages
export async function generateStaticParams() {
  try {
    const pages = await getPublishedPages();
    
    return pages.map((page) => ({
      slug: page.slug.split('/').filter(Boolean),
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug.join('/');
  
  try {
    const page = await getPageBySlug(slug);
    
    if (!page) {
      return {
        title: 'Page Not Found',
        description: 'The requested page could not be found.',
      };
    }

    return {
      title: page.meta.title || page.title,
      description: page.meta.description,
      keywords: page.meta.keywords,
      openGraph: {
        title: page.meta.title || page.title,
        description: page.meta.description,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: page.meta.title || page.title,
        description: page.meta.description,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Error',
      description: 'An error occurred while loading the page.',
    };
  }
}

export default async function DynamicPage({ params }: PageProps) {
  const slug = params.slug.join('/');
  
  try {
    const page = await getPageBySlug(slug);
    
    if (!page) {
      notFound();
    }

    return (
      <MainLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <article>
            <header className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                {page.title}
              </h1>
            </header>
            <div className="prose prose-lg max-w-none">
              <ContentRenderer content={page.content} />
            </div>
          </article>
        </div>
      </MainLayout>
    );
  } catch (error) {
    console.error('Error loading page:', error);
    notFound();
  }
}

// Enable ISR (Incremental Static Regeneration)
export const revalidate = 60; // Revalidate every 60 seconds