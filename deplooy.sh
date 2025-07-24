#!/bin/bash

# Deploy script untuk Aplikasi KPU ke Netlify
# Usage: ./deploy.sh [production|staging]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    print_error "Netlify CLI tidak ditemukan. Install dengan: npm install -g netlify-cli"
    exit 1
fi

# Check if logged in to Netlify
if ! netlify status &> /dev/null; then
    print_warning "Belum login ke Netlify. Menjalankan login..."
    netlify login
fi

# Get deployment type
DEPLOY_TYPE=${1:-"production"}

print_info "🚀 Memulai deployment ke $DEPLOY_TYPE..."

# Validate environment variables file
if [ ! -f ".env" ]; then
    print_warning "File .env tidak ditemukan. Pastikan environment variables sudah di-set di Netlify dashboard."
fi

# Install dependencies
print_info "📦 Installing dependencies..."
npm install --silent

# Validate required files
required_files=("index.html" "netlify.toml" "netlify/functions/kegiatan.js" "netlify/functions/kegiatan-detail.js")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "File required tidak ditemukan: $file"
        exit 1
    fi
done

print_success "Semua file required ditemukan"

# Validate Notion setup (if .env exists locally)
if [ -f ".env" ]; then
    source .env
    if [ -z "$NOTION_TOKEN" ] || [ -z "$NOTION_DATABASE_ID" ]; then
        print_warning "Environment variables tidak lengkap di file .env lokal"
        print_info "Pastikan NOTION_TOKEN dan NOTION_DATABASE_ID sudah di-set di Netlify dashboard"
    else
        print_success "Environment variables terdeteksi"
    fi
fi

# Deploy based on type
if [ "$DEPLOY_TYPE" = "production" ] || [ "$DEPLOY_TYPE" = "prod" ]; then
    print_info "🚀 Deploying to production..."
    netlify deploy --prod --dir=. --functions=netlify/functions
    
    if [ $? -eq 0 ]; then
        print_success "🎉 Production deployment berhasil!"
        print_info "📝 Cek status di: https://app.netlify.com"
        
        # Get site info
        SITE_URL=$(netlify status --json | grep -o '"url":"[^"]*' | cut -d'"' -f4)
        if [ ! -z "$SITE_URL" ]; then
            print_success "🌐 Site URL: $SITE_URL"
        fi
    else
        print_error "Production deployment gagal!"
        exit 1
    fi
    
elif [ "$DEPLOY_TYPE" = "staging" ] || [ "$DEPLOY_TYPE" = "preview" ]; then
    print_info "🧪 Deploying to staging..."
    netlify deploy --dir=. --functions=netlify/functions
    
    if [ $? -eq 0 ]; then
        print_success "🎉 Staging deployment berhasil!"
        
        # Get preview URL
        PREVIEW_URL=$(netlify status --json | grep -o '"deploy_url":"[^"]*' | cut -d'"' -f4)
        if [ ! -z "$PREVIEW_URL" ]; then
            print_success "🔗 Preview URL: $PREVIEW_URL"
        fi
    else
        print_error "Staging deployment gagal!"
        exit 1
    fi
    
else
    print_error "Deployment type tidak valid. Gunakan: production, prod, staging, atau preview"
    exit 1
fi

# Post-deployment checks
print_info "🔍 Menjalankan post-deployment checks..."

# Test if functions are working (if we have the URL)
if [ ! -z "$SITE_URL" ]; then
    print_info "Testing API endpoints..."
    
    # Test kegiatan endpoint
    if curl -s "$SITE_URL/.netlify/functions/kegiatan" > /dev/null; then
        print_success "✅ Kegiatan API endpoint working"
    else
        print_warning "⚠️  Kegiatan API endpoint might have issues"
    fi
    
    # Test main page
    if curl -s "$SITE_URL" > /dev/null; then
        print_success "✅ Main page accessible"
    else
        print_warning "⚠️  Main page might have issues"
    fi
fi

print_success "🎊 Deployment completed successfully!"
print_info "💡 Tip: Monitor function logs di Netlify dashboard jika ada issues"

# Show helpful commands
echo ""
print_info "🛠️  Helpful commands:"
echo "  - View logs: netlify logs"
echo "  - Open site: netlify open:site"
echo "  - Open admin: netlify open:admin"
echo "  - Local dev: npm run dev"