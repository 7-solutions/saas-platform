import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainLayout } from '../../../components/layout';
import { Button } from '@saas-platform/ui';
import { ContentRenderer } from '../../../components/content-renderer';
import { getBlogPostBySlug, getRelatedBlogPosts } from '../../../lib/cms';
import type { BlogPost } from '@saas-platform/shared';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  try {
    const post = await getBlogPostBySlug(params.slug);
    
    if (!post) {
      return {
        title: 'Post Not Found',
      };
    }

    return {
      title: post.meta.title || post.title,
      description: post.meta.description || post.excerpt,
      openGraph: {
        title: post.meta.title || post.title,
        description: post.meta.description || post.excerpt,
        type: 'article',
        publishedTime: post.published_at || post.created_at,
        authors: [post.author],
        tags: post.tags,
        ...(post.featured_image && {
          images: [
            {
              url: post.featured_image,
              alt: post.title,
            },
          ],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: post.meta.title || post.title,
        description: post.meta.description || post.excerpt,
        ...(post.featured_image && {
          images: [post.featured_image],
        }),
      },
    };
  } catch (error) {
    return {
      title: 'Post Not Found',
    };
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  try {
    const post = await getBlogPostBySlug(params.slug);
    
    if (!post) {
      notFound();
    }

    // Get related posts
    const relatedPosts = await getRelatedBlogPosts(post, 3);

    return (
      <MainLayout>
        <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-12">
            {/* Breadcrumb */}
            <nav className="mb-8">
              <ol className="flex items-center space-x-2 text-sm text-gray-500">
                <li>
                  <Link href="/" className="hover:text-gray-700">
                    Home
                  </Link>
                </li>
                <li>/</li>
                <li>
                  <Link href="/blog" className="hover:text-gray-700">
                    Blog
                  </Link>
                </li>
                <li>/</li>
                <li className="text-gray-900">{post.title}</li>
              </ol>
            </nav>

            {/* Categories */}
            {post.categories.length > 0 && (
              <div className="mb-4">
                {post.categories.map((category) => (
                  <Link
                    key={category}
                    href={`/blog?category=${category.toLowerCase().replace(/\s+/g, '-')}`}
                    className="inline-block mr-2 mb-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Meta information */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-8">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    By {post.author}
                  </p>
                  <time 
                    dateTime={post.published_at || post.created_at}
                    className="text-sm text-gray-500"
                  >
                    {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              </div>

              {/* Share buttons could go here */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/blog">
                    ← Back to Blog
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Featured image */}
          {post.featured_image && (
            <div className="mb-12">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-lg max-w-none mb-12">
            <ContentRenderer content={post.content} />
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="border-t border-gray-200 pt-8 mb-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${tag.toLowerCase().replace(/\s+/g, '-')}`}
                    className="inline-block px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <div className="border-t border-gray-200 pt-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Related Posts</h3>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <article key={relatedPost.id} className="group">
                    {relatedPost.featured_image && (
                      <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-4">
                        <img
                          src={relatedPost.featured_image}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    )}
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      <Link 
                        href={`/blog/${relatedPost.slug}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {relatedPost.title}
                      </Link>
                    </h4>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {relatedPost.excerpt || relatedPost.meta.description}
                    </p>
                    <time 
                      dateTime={relatedPost.published_at || relatedPost.created_at}
                      className="text-xs text-gray-500"
                    >
                      {new Date(relatedPost.published_at || relatedPost.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </article>
                ))}
              </div>
            </div>
          )}
        </article>
      </MainLayout>
    );
  } catch (error) {
    console.error('Error loading blog post:', error);
    notFound();
  }
}

// Enable ISR
export const revalidate = 300; // 5 minutes