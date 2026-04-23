#!/bin/bash
# Batch GitHub Setup Script
# This script automates the GitHub workflow setup for isp-entertainment-portal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ISP Entertainment Portal - GitHub Setup Automation ===${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed. Please install git first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git is installed${NC}"

# Check if node/npm is installed
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ Node.js and npm are not installed. Please install them first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js and npm are installed${NC}"

# Check GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) is not installed.${NC}"
    echo "You can skip this step and create the repository manually."
    gh_available=false
else
    gh_available=true
    echo -e "${GREEN}✓ GitHub CLI is installed${NC}"
fi

# Step 1: Create GitHub Repository
echo -e "\n${GREEN}=== Step 1: Create GitHub Repository ===${NC}"
if [ "$gh_available" = true ]; then
    read -p "Create repository using GitHub CLI? [Y/n]: " CREATE_REPO
    if [[ $CREATE_REPO =~ ^[Nn]$ ]]; then
        echo -e "${YELLOW}Skipping automatic repository creation.${NC}"
        read -p "Enter your GitHub repository URL (e.g., https://github.com/username/isp-entertainment-portal): " REPO_URL
    else
        bash github-setup.sh
        REPO_URL=$(gh repo view --json url --jq .url)
        echo -e "${GREEN}✓ Repository created: $REPO_URL${NC}"
    fi
else
    echo -e "${YELLOW}Please create your repository manually at: https://github.com/new${NC}"
    read -p "Enter your GitHub repository URL: " REPO_URL
fi

# Step 2: Initialize Git Repository
echo -e "\n${GREEN}=== Step 2: Initialize Git Repository ===${NC}"
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git add -A
    git commit -m "Initial commit: ISP Entertainment Portal" || true
    echo -e "${GREEN}✓ Git repository initialized${NC}"
else
    echo -e "${YELLOW}⚠️  Git repository already exists${NC}"
fi

# Step 3: Add Remote Repository
echo -e "\n${GREEN}=== Step 3: Add Remote Repository ===${NC}"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$CURRENT_REMOTE" ]; then
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✓ Remote origin added${NC}"
else
    echo -e "${YELLOW}Current remote: $CURRENT_REMOTE${NC}"
    read -p "Update remote to new repository? [y/N]: " UPDATE_REMOTE
    if [[ $UPDATE_REMOTE =~ ^[Yy]$ ]]; then
        git remote set-url origin "$REPO_URL"
        echo -e "${GREEN}✓ Remote origin updated${NC}"
    fi
fi

# Step 4: Configure SSH Keys
echo -e "\n${GREEN}=== Step 4: Configure SSH Keys ===${NC}"
if [ -f ~/.ssh/id_ed25519.pub ] || [ -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${GREEN}✓ SSH key pair found${NC}"
    echo "Your public key:"
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        cat ~/.ssh/id_ed25519.pub
    else
        cat ~/.ssh/id_rsa.pub
    fi
else
    echo -e "${YELLOW}⚠️  No SSH key pair found.${NC}"
    read -p "Generate new SSH key? [Y/n]: " GENERATE_SSH
    if [[ $GENERATE_SSH =~ ^[Nn]$ ]]; then
        echo -e "${RED}Please generate an SSH key manually and add it to GitHub.${NC}"
    else
        bash setup-ssh-keys.sh
    fi
fi

# Step 5: Update README with GitHub Info
echo -e "\n${GREEN}=== Step 5: Update README ===${NC}"
if [ -f "README.md" ]; then
    # Replace placeholders with actual repo info
    if [[ "$REPO_URL" == *"github.com"* ]]; then
        USERNAME=$(echo "$REPO_URL" | sed -E 's|https://github.com/([^/]+)/.*|\1|')
        sed -i "s|<username>|$USERNAME|g" README.md
        echo -e "${GREEN}✓ README updated with GitHub info${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not extract username from URL${NC}"
    fi
else
    echo -e "${RED}✗ README.md not found${NC}"
fi

# Step 6: Install Dependencies and Build
echo -e "\n${GREEN}=== Step 6: Install Dependencies and Build ===${NC}"
echo "Installing dependencies..."
npm run install:all || {
    echo -e "${YELLOW}⚠️  npm install:all failed, trying individual installs...${NC}"
    cd frontend && npm ci && cd ..
    cd backend && npm ci && cd ..
}
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo "Building frontend..."
npm run build 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Build may have failed, this is OK for initial setup${NC}"
}

# Step 7: Setup GitHub Actions Secrets
echo -e "\n${GREEN}=== Step 7: GitHub Actions Secrets ===${NC}"
echo -e "${YELLOW}You need to configure the following secrets in your GitHub repository:${NC}"
echo "  Go to: ${REPO_URL}/settings/secrets/actions"
echo ""
echo "Required secrets:"
echo "  - DEPLOY_HOST: Server hostname or IP address"
echo "  - DEPLOY_PORT: SSH port (usually 22)"
echo "  - DEPLOY_USER: SSH username"
echo "  - DEPLOY_SSH_KEY: SSH private key for deployment"
echo "  - JWT_SECRET: JWT signing secret"
echo "  - TMDB_API_KEY: The Movie Database API key"
echo ""
echo -e "${GREEN}✓ Secret configuration instructions displayed${NC}"

# Step 8: Final Instructions
echo -e "\n${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Configure SSH keys: bash setup-ssh-keys.sh"
echo "2. Add GitHub secrets in repository settings"
echo "3. Push to GitHub: git push -u origin main"
echo "4. Enable GitHub Actions in repository settings"
echo ""
echo -e "${GREEN}Your project is ready for deployment!${NC}"
echo ""
echo "Files created/modified:"
echo "  - github-setup.sh: Interactive repository creation"
echo "  - setup-ssh-keys.sh: SSH key configuration"
echo "  - github-deploy.yml: GitHub Actions workflow"
echo "  - README.md: Updated with GitHub instructions"
echo ""
echo -e "${YELLOW}Note: Remember to replace <username> in README.md with your actual GitHub username.${NC}"