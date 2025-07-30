import { Metadata } from 'next';
import Link from 'next/link';
import { MainLayout } from '../../components/layout';
import { Card, Button } from '@saas-platform/ui';
import { getPublishedBlogPosts, getBlogCategories, getBlogTags } from '../../lib/cms';
import type { BlogPost, BlogCategory, BlogTag } from '@saas-platform/shared';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Latest insights, tutorials, and updates from our team.',
  openGraph: {
    title: 'Blog | SaaS Startup Platform',
    description: 'Latest insights, tutorials, and updates from our team.',
  },
};

interface BlogPageProps {
  searchParams: {
    page?: string;
    category?: string;
    tag?: string;
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  try {
    const page = parseInt(searchParams.page || '1', 10);
    const category = searchParams.category;
    const tag = searchParams.tag;
    const pageSize = 12;

    // Get blog posts with pagination and filtering
    const { posts, hasMore, totalCount } = await getPublishedBlogPosts({
      page,
      pageSize,
      category,
      tag,
    });

    // Get categories and tags for sidebar
    const [categories, tags] = await Promise.all([
      getBlogCategories(),
      getBlogTags(),
    ]);

    return (
      <MainLayout>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Blog
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Latest insights, tutorials, and updates from our team about building modern SaaS applications.
            </p>
            
            {/* Search box */}
            <div className="mt-8 max-w-md mx-auto">
              <form action="/blog/search" method="GET" className="flex gap-2">
                <input
                  type="text"
                  name="q"
                  placeholder="Search blog posts..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button type="submit" size="sm">
                  Search
                </Button>
              </form>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="space-y-8">
                {/* Categories */}
                {categories.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
                    <div className="space-y-2">
                      <Link
                        href="/blog"
                        className={`block text-sm ${
                          !category ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
                        }`}
                      >
                        All Posts ({totalCount})
                      </Link>
                      {categories.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/blog?category=${cat.slug}`}
                          className={`block text-sm ${
                            category === cat.slug
                              ? 'text-blue-600 font-medium'
                              : 'text-gray-600 hover:text-blue-600'
                          }`}
                        >
                          {cat.name} ({cat.post_count})
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tagItem) => (
                        <Link
                          key={tagItem.slug}
                          href={`/blog?tag=${tagItem.slug}`}
                          className={`inline-block px-3 py-1 text-xs rounded-full ${
                            tag === tagItem.slug
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tagItem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-3">
              {/* Active filters */}
              {(category || tag) && (
                <div className="mb-6 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Filtered by:</span>
                  {category && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Category: {categories.find(c => c.slug === category)?.name || category}
                      <Link href="/blog" className="ml-1 hover:text-blue-600">×</Link>
                    </span>
                  )}
                  {tag && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Tag: {tags.find(t => t.slug === tag)?.name || tag}
                      <Link href="/blog" className="ml-1 hover:text-green-600">×</Link>
                    </span>
                  )}
                </div>
              )}

              {posts.length > 0 ? (
                <>
                  <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {posts.map((post) => (
                      <Card key={post.id} className="overflow-hidden">
                        {post.featured_image && (
                          <div className="aspect-video bg-gray-200">
                            <img
                              src={post.featured_image}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <time dateTime={post.published_at || post.created_at}>
                              {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </time>
                            <span className="text-gray-400">by {post.author}</span>
                          </div>
                          
                          <h2 className="text-xl font-semibold text-gray-900 mb-3">
                            <Link 
                              href={`/blog/${post.slug}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {post.title}
                            </Link>
                          </h2>
                          
                          <p className="text-gray-600 mb-4 line-clamp-3">
                            {post.excerpt || post.meta.description}
                          </p>

                          {/* Categories and tags */}
                          {(post.categories.length > 0 || post.tags.length > 0) && (
                            <div className="mb-4 space-y-2">
                              {post.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {post.categories.map((cat) => (
                                    <Link
                                      key={cat}
                                      href={`/blog?category=${cat.toLowerCase().replace(/\s+/g, '-')}`}
                                      className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                    >
                                      {cat}
                                    </Link>
                                  ))}
                                </div>
                              )}
                              {post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {post.tags.slice(0, 3).map((tagItem) => (
                                    <Link
                                      key={tagItem}
                                      href={`/blog?tag=${tagItem.toLowerCase().replace(/\s+/g, '-')}`}
                                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                      #{tagItem}
                                    </Link>
                                  ))}
                                  {post.tags.length > 3 && (
                                    <span className="text-xs text-gray-500">
                                      +{post.tags.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <Button asChild variant="outline" size="sm">
                            <Link href={`/blog/${post.slug}`}>
                              Read more
                            </Link>
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  {(page > 1 || hasMore) && (
                    <div className="mt-12 flex justify-center items-center gap-4">
                      {page > 1 && (
                        <Button asChild variant="outline">
                          <Link 
                            href={{
                              pathname: '/blog',
                              query: { 
                                ...(category && { category }),
                                ...(tag && { tag }),
                                page: page - 1 
                              }
                            }}
                          >
                            Previous
                          </Link>
                        </Button>
                      )}
                      
                      <span className="text-sm text-gray-500">
                        Page {page}
                      </span>
                      
                      {hasMore && (
                        <Button asChild variant="outline">
                          <Link 
                            href={{
                              pathname: '/blog',
                              query: { 
                                ...(category && { category }),
                                ...(tag && { tag }),
                                page: page + 1 
                              }
                            }}
                          >
                            Next
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    {category || tag ? 'No posts found' : 'No blog posts yet'}
                  </h2>
                  <p className="text-gray-600 mb-8">
                    {category || tag 
                      ? 'Try adjusting your filters or browse all posts.'
                      : 'We\'re working on some great content. Check back soon!'
                    }
                  </p>
                  <Button asChild>
                    <Link href={category || tag ? '/blog' : '/'}>
                      {category || tag ? 'View All Posts' : 'Back to Home'}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  } catch (error) {
    console.error('Error loading blog posts:', error);
    
    return (
      <MainLayout>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Blog
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Sorry, we couldn't load the blog posts at this time.
            </p>
            <Button asChild className="mt-8">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }
}

// Enable ISR
export const revalidate = 300; // 5 minutes