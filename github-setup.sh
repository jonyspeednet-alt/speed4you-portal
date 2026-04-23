#!/bin/bash
# GitHub Repository Setup Script for isp-entertainment-portal
# This script guides you through creating a new GitHub repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ISP Entertainment Portal GitHub Setup ===${NC}\n"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    echo "Or you can create the repository manually at: https://github.com/new"
    read -p "Press [Enter] key after installing gh or when ready to continue..."
fi

# Get repository name
read -p "Enter repository name (e.g., 'isp-entertainment-portal'): " REPO_NAME
REPO_NAME=${REPO_NAME:-isp-entertainment-portal}

# Get repository description
read -p "Enter repository description: " REPO_DESC
REPO_DESC=${REPO_DESC:-"ISP Entertainment Portal - Media normalization and streaming platform"}

# Get visibility preference
echo -e "\n${GREEN}Choose repository visibility:${NC}"
echo "1) Public"
echo "2) Private"
read -p "Enter choice [1-2]: " VISIBILITY_CHOICE

case $VISIBILITY_CHOICE in
    1)
        VISIBILITY="--public"
        ;;
    2)
        VISIBILITY="--private"
        ;;
    *)
        echo -e "${RED}Invalid choice. Defaulting to public.${NC}"
        VISIBILITY="--public"
        ;;
esac

# Check GitHub authentication
echo -e "\n${YELLOW}Checking GitHub authentication...${NC}"
if gh auth status &> /dev/null; then
    echo -e "${GREEN}✓ Authenticated with GitHub${NC}"
else
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
    echo "Running: gh auth login"
    gh auth login
fi

# Create repository
echo -e "\n${GREEN}Creating repository: $REPO_NAME${NC}"
gh repo create "$REPO_NAME" $VISIBILITY --description "$REPO_DESC" --confirm

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Repository created successfully!${NC}"
    
    # Get repository URL
    REPO_URL=$(gh repo view --json url --jq .url)
    echo -e "${GREEN}Repository URL: $REPO_URL${NC}"
    
    # Initialize local git repo if not already initialized
    if [ ! -d ".git" ]; then
        echo -e "\n${GREEN}Initializing local git repository...${NC}"
        git init
        git remote add origin "$REPO_URL"
        echo -e "${GREEN}✓ Local repository linked to GitHub${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Local git repository already exists${NC}"
        CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "not set")
        if [ "$CURRENT_REMOTE" = "not set" ]; then
            git remote add origin "$REPO_URL"
            echo -e "${GREEN}✓ Remote origin set to: $REPO_URL${NC}"
        else
            echo -e "${YELLOW}Current remote: $CURRENT_REMOTE${NC}"
            read -p "Do you want to update it to the new repository? [y/N]: " UPDATE_REMOTE
            if [[ $UPDATE_REMOTE =~ ^[Yy]$ ]]; then
                git remote set-url origin "$REPO_URL"
                echo -e "${GREEN}✓ Remote origin updated${NC}"
            fi
        fi
    fi
    
    echo -e "\n${GREEN}=== Setup Complete ===${NC}"
    echo "Next steps:"
    echo "1. Review the updated README.md"
    echo "2. Configure SSH keys if not already set up"
    echo "3. Push to GitHub: git push -u origin main"
else
    echo -e "${RED}✗ Failed to create repository${NC}"
    echo "You may need to create it manually at: $REPO_URL"
fi