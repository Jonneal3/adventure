# Sample Images Setup for Starting Niches

This document explains how to set up sample images for your starting niches using the provided seed files and generation scripts.

## Overview

The seed file creates:
- **3 main categories**: Home Interior, Home Exterior, Fashion/Cosmetics/Ecomm
- **9 subcategories** with lead pricing
- **50+ sample prompts** for each subcategory
- **45+ placeholder images** with proper database relationships
- **Sample image URLs** in subcategory metadata

## Files Created

1. **`supabase/migrations/20250129000000_seed_starting_niches.sql`** - Database seed file
2. **`scripts/generate-sample-images.js`** - Image generation script
3. **Updated `package.json`** - Added `generate:samples` script

## Setup Instructions

### 1. Run the Database Migration

```bash
# Apply the seed migration
supabase db push

# Or if using local development
supabase migration up
```

### 2. Generate Real Sample Images

The seed file creates placeholder URLs. To generate real images using Replicate:

```bash
# Set required environment variables
export REPLICATE_API_TOKEN="your_replicate_token"
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export AWS_ACCESS_KEY_ID="your_aws_key"
export AWS_SECRET_ACCESS_KEY="your_aws_secret"
export AWS_REGION="us-east-1"
export S3_BUCKET="your_s3_bucket"

# Run the image generation script
npm run generate:samples
```

### 3. Verify the Setup

After running the migration and image generation:

1. **Check categories**: Visit your admin panel to see the new categories
2. **Check subcategories**: Each should have sample images and lead pricing
3. **Check images**: The `images` table should have entries with real S3 URLs
4. **Check prompts**: The `prompts` table should have all the sample prompts

## Categories and Subcategories Created

### Home Interior
- **Interior Design** ($5 email, $8 phone leads)
- **Paint** ($3 email, $5 phone leads)
- **Flooring** ($4 email, $6 phone leads)
- **Landscaping** ($4 email, $6 phone leads)
- **Basements** ($6 email, $10 phone leads)

### Home Exterior
- **Landscaping** ($4 email, $6 phone leads)

### Fashion / Cosmetics / Try-Ons / Ecomm
- **Furniture** ($2 email, $3 phone leads)
- **Jewelry** ($3 email, $4 phone leads)
- **Clothing** ($2 email, $3 phone leads)

## Sample Prompts Included

Each subcategory includes 5-10 professional prompts designed for AI image generation:

### Interior Design Examples
- "Modern minimalist living room with neutral colors, clean lines, and contemporary furniture"
- "Cozy farmhouse kitchen with white cabinets, wooden countertops, and vintage accessories"
- "Luxury master bedroom with king-size bed, elegant lighting, and sophisticated color scheme"

### Paint Examples
- "Accent wall with bold geometric pattern in navy blue and white"
- "Ombre wall effect transitioning from light blue to deep navy"
- "Two-tone bedroom walls with soft gray and crisp white"

### And many more for each subcategory...

## Database Structure

The seed creates proper relationships:
- `categories` → `categories_subcategories` → `images`
- `prompts` → `images` (each image linked to its generation prompt)
- `images` → `instance_sample_gallery` (when added to galleries)

## Customization

### Adding More Subcategories
1. Add entries to the `categories_subcategories` table
2. Add corresponding prompts to the `prompts` table
3. Add placeholder images to the `images` table
4. Update the generation script with new prompts

### Modifying Lead Prices
Update the `email_lead_price` and `phone_lead_price` fields in the subcategory records.

### Adding More Sample Images
1. Add more prompts to the subcategory arrays in the generation script
2. Run `npm run generate:samples` again
3. The script will generate additional images for existing subcategories

## Troubleshooting

### Migration Fails
- Check that all required tables exist
- Verify foreign key constraints
- Check for duplicate IDs

### Image Generation Fails
- Verify Replicate API token is valid
- Check AWS credentials and S3 bucket permissions
- Ensure Supabase service role key has proper permissions
- Check network connectivity

### Images Not Showing
- Verify S3 bucket is public or has proper CORS settings
- Check that image URLs are accessible
- Verify database relationships are correct

## Cost Considerations

- **Replicate API**: ~$0.01-0.05 per image generated
- **S3 Storage**: ~$0.023 per GB per month
- **Database**: Minimal impact on Supabase usage

For 45+ images, expect costs around $2-5 total.

## Next Steps

After running the seed:
1. Test creating instances with these subcategories
2. Verify the "Available Images" section works
3. Test the gallery builder functionality
4. Customize prompts and pricing as needed
5. Add more subcategories for your specific use cases
