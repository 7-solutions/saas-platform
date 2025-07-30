#!/bin/bash

# Script to generate Go code from protobuf definitions

set -e

# Add Go bin to PATH
export PATH="$PATH:$(go env GOPATH)/bin"

# Create output directory
mkdir -p gen

# Generate Go code for auth service
protoc \
  --proto_path=proto \
  --proto_path=third_party/googleapis-master \
  --go_out=gen \
  --go_opt=paths=source_relative \
  --go-grpc_out=gen \
  --go-grpc_opt=paths=source_relative \
  --grpc-gateway_out=gen \
  --grpc-gateway_opt=paths=source_relative \
  proto/auth/v1/auth.proto

# Generate Go code for content service
protoc \
  --proto_path=proto \
  --proto_path=third_party/googleapis-master \
  --go_out=gen \
  --go_opt=paths=source_relative \
  --go-grpc_out=gen \
  --go-grpc_opt=paths=source_relative \
  --grpc-gateway_out=gen \
  --grpc-gateway_opt=paths=source_relative \
  proto/content/v1/content.proto

# Generate Go code for media service
protoc \
  --proto_path=proto \
  --proto_path=third_party/googleapis-master \
  --go_out=gen \
  --go_opt=paths=source_relative \
  --go-grpc_out=gen \
  --go-grpc_opt=paths=source_relative \
  --grpc-gateway_out=gen \
  --grpc-gateway_opt=paths=source_relative \
  proto/media/v1/media.proto

# Generate Go code for contact service
protoc \
  --proto_path=proto \
  --proto_path=third_party/googleapis-master \
  --go_out=gen \
  --go_opt=paths=source_relative \
  --go-grpc_out=gen \
  --go-grpc_opt=paths=source_relative \
  --grpc-gateway_out=gen \
  --grpc-gateway_opt=paths=source_relative \
  proto/contact/v1/contact.proto

echo "Proto generation completed successfully!"