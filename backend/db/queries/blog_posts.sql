-- name: GetPostBySlug :one
SELECT *
FROM blog_posts
WHERE slug = $1
LIMIT 1;

-- name: ListPostsByStatus :many
SELECT *
FROM blog_posts
WHERE status = $1
ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPublishedPosts :many
SELECT *
FROM blog_posts
WHERE status = 'published'
ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListPostsByAuthor :many
SELECT *
FROM blog_posts
WHERE author_id = $1
ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPostsByCategorySlug :many
SELECT p.*
FROM blog_posts p
JOIN blog_post_categories pc ON pc.post_id = p.id
JOIN categories c ON c.id = pc.category_id
WHERE c.slug = $1
ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPostsByTagSlug :many
SELECT p.*
FROM blog_posts p
JOIN blog_post_tags pt ON pt.post_id = p.id
JOIN tags t ON t.id = pt.tag_id
WHERE t.slug = $1
ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetCategoryCounts :many
SELECT c.id, c.slug, c.name, COUNT(pc.post_id) AS count
FROM categories c
LEFT JOIN blog_post_categories pc ON pc.category_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY count DESC, c.name ASC;

-- name: GetTagCounts :many
SELECT t.id, t.slug, t.name, COUNT(pt.post_id) AS count
FROM tags t
LEFT JOIN blog_post_tags pt ON pt.tag_id = t.id
GROUP BY t.id, t.slug, t.name
ORDER BY count DESC, t.name ASC;

-- name: SearchPosts :many
-- tsquery should be provided by caller, e.g., to_tsquery('simple', 'term1:* & term2:*')
SELECT *
FROM blog_posts
WHERE search_tsv @@ to_tsquery('simple', $1)
ORDER BY ts_rank_cd(search_tsv, to_tsquery('simple', $1)) DESC,
         COALESCE(published_at, created_at) DESC
LIMIT $2 OFFSET $3;

-- name: InsertPost :one
INSERT INTO blog_posts (
  slug, title, excerpt, content, status, author_id, published_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: UpdatePost :one
UPDATE blog_posts
SET
  slug = COALESCE($2, slug),
  title = COALESCE($3, title),
  excerpt = COALESCE($4, excerpt),
  content = COALESCE($5, content),
  status = COALESCE($6, status),
  author_id = COALESCE($7, author_id),
  published_at = COALESCE($8, published_at)
WHERE id = $1
RETURNING *;

-- name: DeletePostByID :exec
DELETE FROM blog_posts
WHERE id = $1;

-- Minimal Category CRUD

-- name: InsertCategory :one
INSERT INTO categories (slug, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetCategoryBySlug :one
SELECT *
FROM categories
WHERE slug = $1
LIMIT 1;

-- Minimal Tag CRUD

-- name: InsertTag :one
INSERT INTO tags (slug, name)
VALUES ($1, $2)
RETURNING *;

-- name: GetTagBySlug :one
SELECT *
FROM tags
WHERE slug = $1
LIMIT 1;

-- Post-Category linking

-- name: AddPostCategory :exec
INSERT INTO blog_post_categories (post_id, category_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RemovePostCategory :exec
DELETE FROM blog_post_categories
WHERE post_id = $1 AND category_id = $2;

-- Post-Tag linking

-- name: AddPostTag :exec
INSERT INTO blog_post_tags (post_id, tag_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RemovePostTag :exec
DELETE FROM blog_post_tags
WHERE post_id = $1 AND tag_id = $2;

-- name: ListPostsAll :many
SELECT *
FROM blog_posts
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;