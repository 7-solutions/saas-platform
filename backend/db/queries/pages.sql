-- name: GetPageBySlug :one
SELECT *
FROM pages
WHERE slug = $1
LIMIT 1;

-- name: ListPagesByStatus :many
SELECT *
FROM pages
WHERE status = $1
ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPagesByAuthor :many
SELECT *
FROM pages
WHERE author_id = $1
ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: SearchPages :many
-- tsquery should be provided by caller, e.g., to_tsquery('simple', 'term1:* & term2:*')
SELECT *
FROM pages
WHERE search_tsv @@ to_tsquery('simple', $1)
ORDER BY ts_rank_cd(search_tsv, to_tsquery('simple', $1)) DESC,
         COALESCE(published_at, created_at) DESC
LIMIT $2 OFFSET $3;

-- name: InsertPage :one
INSERT INTO pages (
  slug, title, content, status, author_id, published_at
) VALUES (
  $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: UpdatePage :one
UPDATE pages
SET
  slug = COALESCE($2, slug),
  title = COALESCE($3, title),
  content = COALESCE($4, content),
  status = COALESCE($5, status),
  author_id = COALESCE($6, author_id),
  published_at = COALESCE($7, published_at)
WHERE id = $1
RETURNING *;

-- name: DeletePageByID :exec
DELETE FROM pages
WHERE id = $1;