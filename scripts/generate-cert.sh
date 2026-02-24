#!/usr/bin/env bash
# Generate self-signed TLS certificate for development/testing
# Usage: ./scripts/generate-cert.sh [output_dir]

set -euo pipefail

OUTPUT_DIR="${1:-./data/tls}"

mkdir -p "$OUTPUT_DIR"

echo "Generating self-signed certificate in $OUTPUT_DIR ..."

openssl req -x509 \
  -newkey rsa:2048 \
  -nodes \
  -keyout "$OUTPUT_DIR/key.pem" \
  -out "$OUTPUT_DIR/cert.pem" \
  -days 365 \
  -subj "/CN=localhost/O=Mail Gateway Dev"

echo "Done."
echo "  Key:  $OUTPUT_DIR/key.pem"
echo "  Cert: $OUTPUT_DIR/cert.pem"
echo ""
echo "Add to .env:"
echo "  SMTP_TLS_ENABLED=true"
echo "  SMTP_TLS_KEY=$OUTPUT_DIR/key.pem"
echo "  SMTP_TLS_CERT=$OUTPUT_DIR/cert.pem"