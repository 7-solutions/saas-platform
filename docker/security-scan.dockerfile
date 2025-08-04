# Security scanning Dockerfile
# This Dockerfile is used to create a container for security scanning

FROM aquasec/trivy:latest AS trivy-scanner

# Install additional security tools
FROM alpine:3.20 AS security-tools

# Install security scanning tools
RUN apk add --no-cache \
    curl \
    jq \
    bash \
    git \
    docker-cli

# Install Trivy
COPY --from=trivy-scanner /usr/local/bin/trivy /usr/local/bin/trivy

# Install Grype (alternative vulnerability scanner)
RUN curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Install Syft (SBOM generator)
RUN curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Create security scanning script
COPY <<EOF /usr/local/bin/security-scan.sh
#!/bin/bash
set -euo pipefail

IMAGE_NAME=\${1:-""}
OUTPUT_DIR=\${2:-"/output"}
SCAN_TYPE=\${3:-"all"}

if [ -z "\$IMAGE_NAME" ]; then
    echo "Usage: \$0 <image-name> [output-dir] [scan-type]"
    echo "Scan types: trivy, grype, sbom, all"
    exit 1
fi

mkdir -p "\$OUTPUT_DIR"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")

echo "🔍 Scanning image: \$IMAGE_NAME"

case "\$SCAN_TYPE" in
    "trivy"|"all")
        echo "📦 Running Trivy scan..."
        trivy image --format json --output "\$OUTPUT_DIR/trivy_\${TIMESTAMP}.json" "\$IMAGE_NAME"
        trivy image --format table "\$IMAGE_NAME"
        ;;
esac

case "\$SCAN_TYPE" in
    "grype"|"all")
        echo "📦 Running Grype scan..."
        grype "\$IMAGE_NAME" -o json > "\$OUTPUT_DIR/grype_\${TIMESTAMP}.json"
        grype "\$IMAGE_NAME"
        ;;
esac

case "\$SCAN_TYPE" in
    "sbom"|"all")
        echo "📦 Generating SBOM..."
        syft "\$IMAGE_NAME" -o json > "\$OUTPUT_DIR/sbom_\${TIMESTAMP}.json"
        syft "\$IMAGE_NAME" -o table
        ;;
esac

echo "✅ Security scan completed. Results saved in \$OUTPUT_DIR"
EOF

RUN chmod +x /usr/local/bin/security-scan.sh

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/security-scan.sh"]