#!/bin/bash

# This script helps set up the deployment key on your server
# Run this on your server (203.0.113.2) as the speed4you user

echo "Setting up deployment SSH key..."

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key to authorized_keys
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJOmk9rXcDxfUS+rUYAOfldhRPNDYLFEiiTwMa1AdKs \isp-entertainment-deploy\
EOF

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys

echo "✓ Deployment key added successfully!"
echo "You can now test the connection with:"
echo "ssh -i deploy_key -p 2973 speed4you@203.0.113.2"
