-- name: ListContactsByCreatedAt :many
SELECT *
FROM contact_submissions
WHERE created_at >= $1 AND created_at <= $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListContactsByStatus :many
SELECT *
FROM contact_submissions
WHERE status = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListContactsByEmail :many
SELECT *
FROM contact_submissions
WHERE email = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountContactsByStatus :one
SELECT COUNT(*)::bigint AS count
FROM contact_submissions
WHERE status = $1;

-- name: SearchContacts :many
-- tsquery should be provided by caller, e.g., to_tsquery('simple', 'term1:* & term2:*')
SELECT *
FROM contact_submissions
WHERE search_tsv @@ to_tsquery('simple', $1)
ORDER BY ts_rank_cd(search_tsv, to_tsquery('simple', $1)) DESC,
         created_at DESC
LIMIT $2 OFFSET $3;

-- name: InsertContact :one
INSERT INTO contact_submissions (
  email, name, subject, message, status
) VALUES (
  $1, $2, $3, $4, COALESCE($5, 'new')
)
RETURNING *;

-- name: UpdateContactStatus :one
UPDATE contact_submissions
SET status = $2
WHERE id = $1
RETURNING *;