#!/bin/bash
# SSH Key Setup Script for GitHub
# This script helps you set up SSH keys for GitHub authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SSH Key Setup for GitHub ===${NC}\n"

# Check if SSH key already exists
if [ -f ~/.ssh/id_ed25519 ]; then
    echo -e "${YELLOW}⚠️  SSH key pair already exists at ~/.ssh/id_ed25519${NC}"
    read -p "Do you want to generate a new key pair? [y/N]: " GENERATE_NEW
    if [[ ! $GENERATE_NEW =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Using existing SSH key${NC}"
        KEY_EXISTS=true
    fi
fi

if [ "$KEY_EXISTS" != "true" ]; then
    echo -e "\n${GREEN}Generating new SSH key pair...${NC}"
    read -p "Enter email for SSH key (default: your_email@example.com): " EMAIL
    EMAIL=${EMAIL:-"your_email@example.com"}
    
    echo -e "\n${YELLOW}Enter a file in which to save the key (${HOME}/.ssh/id_ed25519):${NC}"
    echo -e "${GREEN}Press Enter to accept default location${NC}"
    
    ssh-keygen -t ed25519 -C "$EMAIL"
fi

# Start SSH agent
eval "$(ssh-agent -s)"

# Add SSH key to agent
if [ -f ~/.ssh/id_ed25519 ]; then
    KEY_FILE=~/.ssh/id_ed25519
elif [ -f ~/.ssh/id_rsa ]; then
    KEY_FILE=~/.ssh/id_rsa
else
    echo -e "${RED}✗ No SSH key found. Please generate one first.${NC}"
    exit 1
fi

ssh-add "$KEY_FILE"
echo -e "${GREEN}✓ SSH key added to agent${NC}"

# Display public key
echo -e "\n${GREEN}Your public SSH key:${NC}"
cat "${KEY_FILE}.pub"

echo -e "\n${GREEN}=== Next Steps ===${NC}"
echo "1. Copy the public key above"
echo "2. Go to: https://github.com/settings/keys"
echo "3. Click 'New SSH key'"
 echo "4. Give it a title (e.g., 'My Computer')"
echo "5. Paste the public key"
echo "6. Click 'Add SSH key'"
echo ""
echo -e "${GREEN}To test your connection, run:${NC}"
echo "  ssh -T git@github.com"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"