#!/bin/bash
# ============================================
# CEH AI - Database Setup Script
# ============================================
# This script helps you set up Neon PostgreSQL
# and migrate your existing data.
#
# Usage: bash scripts/setup-neon.sh
# ============================================

set -e

echo ""
echo "================================================"
echo "     CEH AI - Neon PostgreSQL Setup"
echo "================================================"
echo ""

# Check if DATABASE_URL contains placeholder
if grep -q "YOUR_NEON" .env 2>/dev/null; then
    echo "STEP 1 NEEDED: Set up Neon Database"
    echo ""
    echo "Please follow these steps:"
    echo ""
    echo "  1. Open https://neon.tech in your browser"
    echo "  2. Sign up for a FREE account (GitHub/Google/Email)"
    echo "     -> No credit card required"
    echo "  3. Click 'Create Project'"
    echo "     -> Name: ceh-ai"
    echo "     -> Region: pick closest to your users"
    echo "  4. Wait for the project to be created (~10 seconds)"
    echo "  5. Copy the connection string from the dashboard"
    echo "     It looks like: postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require"
    echo ""
    echo "  6. Edit the .env file and replace:"
    echo "     - YOUR_NEON_USERNAME  -> your Neon username"
    echo "     - YOUR_NEON_PASSWORD  -> your Neon password"
    echo "     - YOUR_NEON_HOST      -> ep-xyz.region.aws.neon.tech"
    echo "     - YOUR_NEON_DATABASE  -> neondb (or your db name)"
    echo ""
    echo "  7. Run this script again after updating .env"
    echo ""
    exit 1
fi

echo "Database URL configured"
echo ""
echo "Running Prisma schema push..."
bunx prisma db push
echo ""

echo "Database tables created successfully!"
echo ""
echo "Your CEH AI app is now connected to Neon PostgreSQL."
echo "All data will persist forever in the cloud."
echo ""
