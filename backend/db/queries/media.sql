-- name: GetMediaByFilename :one
SELECT *
FROM media
WHERE filename = $1
LIMIT 1;

-- name: ListMediaByUploader :many
SELECT *
FROM media
WHERE uploader_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: InsertMedia :one
INSERT INTO media (
  filename, path, mime_type, size_bytes, uploader_id
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;

-- name: DeleteMediaByID :exec
DELETE FROM media
WHERE id = $1;

-- name: UpdateMedia :one
UPDATE media
SET mime_type = $2, size_bytes = $3, path = $4
WHERE id = $1
RETURNING *;

-- name: ListMediaAll :many
SELECT *
FROM media
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;