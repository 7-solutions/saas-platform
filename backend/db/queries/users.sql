-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1
LIMIT 1;

-- name: ListUsers :many
SELECT *
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: InsertUser :one
INSERT INTO users (
  email, name, password_hash, role
) VALUES (
  $1, $2, $3, $4
)
RETURNING *;