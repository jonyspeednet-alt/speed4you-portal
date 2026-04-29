#!/bin/bash
set -e

echo "🔑 Generating new SSH key without passphrase..."

# Remove old keys
rm -f deploy_key deploy_key.pub

# Generate new key
ssh-keygen -t ed25519 -f deploy_key -N '' -C 'github-deploy@speed4you'

echo "✅ SSH key generated successfully"
echo ""
echo "Public key:"
cat deploy_key.pub
echo ""
echo "Private key (first 5 lines):"
head -5 deploy_key
