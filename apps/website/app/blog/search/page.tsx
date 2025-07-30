import { Metadata } from 'next';
import Link from 'next/link';
import { MainLayout } from '../../../components/layout';
import { Card, Button } from '@saas-platform/ui';
import { searchBlogPosts } from '../../../lib/cms';
import type { BlogPost } from '@saas-platform/shared';

export const metadata: Metadata = {
  title: 'Search Blog Posts',
  description: 'Search through our blog posts to find the content you\'re looking for.',
};

interface BlogSearchPageProps {
  searchParams: {
    q?: string;
    page?: string;
  };
}

export default async function BlogSearchPage({ searchParams }: BlogSearchPageProps) {
  const query = searchParams.q || '';
  const page = parseInt(searchParams.page || '1', 10);
  const pageSize = 12;

  let posts: BlogPost[] = [];
  let hasMore = false;
  let totalCount = 0;

  if (query.trim()) {
    try {
      const result = await searchBlogPosts(query, { page, pageSize });
      posts = result.posts;
      hasMore = result.hasMore;
      totalCount = result.totalCount;
    } catch (error) {
      console.error('Error searching blog posts:', error);
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Search Blog Posts
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
            Find the content you're looking for in our blog.
          </p>
        </div>

        {/* Search form */}
        <div className="max-w-2xl mx-auto mb-12">
          <form method="GET" className="flex gap-4">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search blog posts..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button type="submit">
              Search
            </Button>
          </form>
        </div>

        {query.trim() ? (
          <>
            {/* Search results header */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">
                {totalCount > 0 
                  ? `Found ${totalCount} result${totalCount === 1 ? '' : 's'} for "${query}"`
                  : `No results found for "${query}"`
                }
              </h2>
              {totalCount > 0 && (
                <p className="text-gray-600 mt-2">
                  Showing page {page} of results
                </p>
              )}
            </div>

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
                        
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                          <Link 
                            href={`/blog/${post.slug}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {post.title}
                          </Link>
                        </h3>
                        
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
                                {post.tags.slice(0, 3).map((tag) => (
                                  <Link
                                    key={tag}
                                    href={`/blog?tag=${tag.toLowerCase().replace(/\s+/g, '-')}`}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                  >
                                    #{tag}
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
                            pathname: '/blog/search',
                            query: { 
                              q: query,
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
                            pathname: '/blog/search',
                            query: { 
                              q: query,
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
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  No posts found
                </h3>
                <p className="text-gray-600 mb-8">
                  Try adjusting your search terms or browse all posts.
                </p>
                <Button asChild>
                  <Link href="/blog">
                    Browse All Posts
                  </Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Enter a search term
            </h2>
            <p className="text-gray-600 mb-8">
              Use the search box above to find blog posts by title, content, categories, or tags.
            </p>
            <Button asChild>
              <Link href="/blog">
                Browse All Posts
              </Link>
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// Enable ISR
export const revalidate = 300; // 5 minutes