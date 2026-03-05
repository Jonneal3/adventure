#!/bin/bash

# Quick Shopify Integration Test Script
# Run this to verify your setup

echo "🚀 Shopify Integration Test Script"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "   Create it with Shopify credentials"
    exit 1
fi

echo "✅ .env.local exists"

# Check required env vars
echo ""
echo "Checking environment variables..."
source .env.local 2>/dev/null || true

MISSING_VARS=0

if [ -z "$SHOPIFY_CLIENT_ID" ]; then
    echo "❌ SHOPIFY_CLIENT_ID not set"
    MISSING_VARS=1
else
    echo "✅ SHOPIFY_CLIENT_ID is set"
fi

if [ -z "$SHOPIFY_CLIENT_SECRET" ]; then
    echo "❌ SHOPIFY_CLIENT_SECRET not set"
    MISSING_VARS=1
else
    echo "✅ SHOPIFY_CLIENT_SECRET is set"
fi

if [ -z "$NEXT_PUBLIC_SITE_URL" ]; then
    echo "⚠️  NEXT_PUBLIC_SITE_URL not set (using default)"
else
    echo "✅ NEXT_PUBLIC_SITE_URL is set: $NEXT_PUBLIC_SITE_URL"
fi

# SHOPIFY_SCOPES is optional - check but don't fail if missing
if [ -z "$SHOPIFY_SCOPES" ]; then
    echo "ℹ️  SHOPIFY_SCOPES not set (will use default: read_products)"
else
    echo "✅ SHOPIFY_SCOPES is set: $SHOPIFY_SCOPES"
fi

if [ $MISSING_VARS -eq 1 ]; then
    echo ""
    echo "❌ Missing required environment variables!"
    exit 1
fi

# Check if Supabase CLI is available
echo ""
echo "Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI installed"
    SUPABASE_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    echo "   Version: $SUPABASE_VERSION"
else
    echo "⚠️  Supabase CLI not found"
    echo "   Install: npm install -g supabase"
    echo "   OR: brew install supabase/tap/supabase"
fi

# Check if migration file exists
echo ""
echo "Checking migration file..."
if [ -f "supabase/migrations/20250130000000_create_shopify_tables.sql" ]; then
    echo "✅ Migration file exists"
    MIGRATION_LINES=$(wc -l < supabase/migrations/20250130000000_create_shopify_tables.sql)
    echo "   Lines: $MIGRATION_LINES"
else
    echo "❌ Migration file not found!"
    exit 1
fi

# Check if new API files exist
echo ""
echo "Checking new API files..."
FILES_EXIST=1

if [ -f "app/api/shopify/instance-config/route.ts" ]; then
    echo "✅ instance-config API exists"
else
    echo "❌ instance-config API missing"
    FILES_EXIST=0
fi

if [ -f "app/api/shopify/app-block/route.ts" ]; then
    echo "✅ app-block API exists"
else
    echo "❌ app-block API missing"
    FILES_EXIST=0
fi

if [ -f "app/api/shopify/instances/route.ts" ]; then
    echo "✅ instances API exists"
else
    echo "❌ instances API missing"
    FILES_EXIST=0
fi

if [ -f "app/shopify/app/configure/page.tsx" ]; then
    echo "✅ configure page exists"
else
    echo "❌ configure page missing"
    FILES_EXIST=0
fi

if [ $FILES_EXIST -eq 0 ]; then
    echo ""
    echo "❌ Some files are missing!"
    exit 1
fi

# Check if widget.js was updated
echo ""
echo "Checking widget.js..."
if grep -q "Shopify auto-detection" public/widget.js 2>/dev/null; then
    echo "✅ widget.js has Shopify detection"
else
    echo "⚠️  widget.js might not have Shopify detection"
fi

# Summary
echo ""
echo "===================================="
echo "📋 Summary"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Apply database migration:"
echo "   npm run db:push"
echo "   OR manually run SQL in Supabase Dashboard"
echo ""
echo "2. Start dev server:"
echo "   npm run dev"
echo ""
echo "3. Configure Shopify Partner Dashboard:"
echo "   - Set App URL to: http://localhost:3000/shopify/app"
echo "   - Set callback to: http://localhost:3000/api/shopify/auth/callback"
echo ""
echo "4. Test OAuth:"
echo "   Navigate to: http://localhost:3000/api/shopify/auth?shop=YOUR-STORE.myshopify.com"
echo ""
echo "For full testing guide, see: SHOPIFY_TESTING_GUIDE.md"
echo ""

