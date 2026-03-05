#!/usr/bin/env node

/**
 * Script to generate sample images for starting niches
 * This script uses the Replicate API to generate images for each subcategory
 * and uploads them to S3, then updates the database with the real URLs
 */

const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET;

if (!REPLICATE_API_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Sample data for each subcategory
const subcategories = [
  {
    id: 'sub-interior-design',
    name: 'Interior Design',
    prompts: [
      'Modern minimalist living room with neutral colors, clean lines, and contemporary furniture',
      'Cozy farmhouse kitchen with white cabinets, wooden countertops, and vintage accessories',
      'Luxury master bedroom with king-size bed, elegant lighting, and sophisticated color scheme',
      'Scandinavian-style dining room with light wood furniture and natural textures',
      'Industrial loft space with exposed brick walls, metal fixtures, and urban aesthetic'
    ]
  },
  {
    id: 'sub-paint',
    name: 'Paint',
    prompts: [
      'Accent wall with bold geometric pattern in navy blue and white',
      'Ombre wall effect transitioning from light blue to deep navy',
      'Two-tone bedroom walls with soft gray and crisp white',
      'Chalkboard wall in children\'s room with colorful trim',
      'Metallic accent wall with gold geometric patterns'
    ]
  },
  {
    id: 'sub-flooring',
    name: 'Flooring',
    prompts: [
      'Hardwood flooring with herringbone pattern in warm oak',
      'Luxury vinyl plank flooring with realistic wood grain texture',
      'Marble tile flooring with intricate geometric patterns',
      'Bamboo flooring with natural finish and sustainable appeal',
      'Carpet tiles with modern geometric design in neutral tones'
    ]
  },
  {
    id: 'sub-landscaping',
    name: 'Landscaping',
    prompts: [
      'Indoor vertical garden wall with various succulents and herbs',
      'Tropical plant arrangement with large leafy plants and natural lighting',
      'Modern terrarium display with geometric glass containers',
      'Zen garden corner with rocks, sand, and minimalist plants',
      'Hanging plant installation with macrame holders and trailing vines'
    ]
  },
  {
    id: 'sub-basements',
    name: 'Basements',
    prompts: [
      'Finished basement home theater with comfortable seating and dark walls',
      'Basement home gym with rubber flooring and mirrored walls',
      'Basement wine cellar with custom shelving and climate control',
      'Basement playroom with bright colors and storage solutions',
      'Basement office space with built-in desk and storage'
    ]
  },
  {
    id: 'sub-exterior-landscaping',
    name: 'Exterior Landscaping',
    prompts: [
      'Front yard landscaping with native plants and stone pathways',
      'Backyard patio with outdoor kitchen and dining area',
      'Garden with raised beds and vegetable planting areas',
      'Pool area landscaping with tropical plants and privacy screening',
      'Xeriscape garden with drought-tolerant plants and rock features'
    ]
  },
  {
    id: 'sub-furniture',
    name: 'Furniture',
    prompts: [
      'Modern sectional sofa in neutral gray with clean lines',
      'Rustic dining table with reclaimed wood and metal legs',
      'Mid-century modern armchair with walnut frame and leather upholstery',
      'Industrial bookshelf with metal frame and wooden shelves',
      'Scandinavian coffee table with light wood and minimalist design'
    ]
  },
  {
    id: 'sub-jewelry',
    name: 'Jewelry',
    prompts: [
      'Elegant gold necklace with delicate chain and pendant',
      'Vintage-inspired ring with gemstone and intricate setting',
      'Modern earrings with geometric shapes and minimalist design',
      'Pearl bracelet with multiple strands and clasp closure',
      'Statement necklace with bold colors and artistic design'
    ]
  },
  {
    id: 'sub-clothing',
    name: 'Clothing',
    prompts: [
      'Casual summer dress with floral print and flowing silhouette',
      'Business suit with tailored fit and professional styling',
      'Denim jacket with vintage wash and classic cut',
      'Athletic wear with moisture-wicking fabric and modern design',
      'Evening gown with elegant draping and sophisticated details'
    ]
  }
];

async function generateImage(prompt, subcategoryName, index) {
  try {
    console.log(`Generating image ${index + 1} for ${subcategoryName}...`);
    
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          seed: Math.floor(Math.random() * 1000000),
        }
      }
    );

    if (output && Array.isArray(output) && output.length > 0) {
      const imageUrl = output[0];
      
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      
      // Upload to S3
      const fileName = `${subcategoryName.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.jpg`;
      const s3Key = `sample-images/${fileName}`;
      
      const uploadCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      });
      
      await s3Client.send(uploadCommand);
      
      const s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
      
      console.log(`✅ Generated and uploaded: ${s3Url}`);
      return s3Url;
    }
  } catch (error) {
    console.error(`❌ Error generating image for ${subcategoryName}:`, error.message);
    return null;
  }
}

async function updateDatabaseImage(imageId, newUrl) {
  try {
    const { error } = await supabase
      .from('images')
      .update({ image_url: newUrl })
      .eq('id', imageId);
    
    if (error) {
      console.error(`❌ Error updating database for ${imageId}:`, error.message);
    } else {
      console.log(`✅ Updated database for ${imageId}`);
    }
  } catch (error) {
    console.error(`❌ Database update failed for ${imageId}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting sample image generation...\n');
  
  for (const subcategory of subcategories) {
    console.log(`\n📁 Processing ${subcategory.name}...`);
    
    // Get existing images for this subcategory
    const { data: existingImages, error } = await supabase
      .from('images')
      .select('id, image_url')
      .eq('subcategory_id', subcategory.id)
      .order('created_at');
    
    if (error) {
      console.error(`❌ Error fetching images for ${subcategory.name}:`, error.message);
      continue;
    }
    
    if (!existingImages || existingImages.length === 0) {
      console.log(`⚠️  No existing images found for ${subcategory.name}`);
      continue;
    }
    
    // Generate new images for each existing placeholder
    for (let i = 0; i < Math.min(existingImages.length, subcategory.prompts.length); i++) {
      const image = existingImages[i];
      const prompt = subcategory.prompts[i];
      
      // Skip if already has a real URL (not placeholder)
      if (image.image_url && !image.image_url.includes('/public/sample-images/')) {
        console.log(`⏭️  Skipping ${image.id} - already has real URL`);
        continue;
      }
      
      const newUrl = await generateImage(prompt, subcategory.name, i);
      
      if (newUrl) {
        await updateDatabaseImage(image.id, newUrl);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.log('\n🎉 Sample image generation complete!');
}

// Run the script
main().catch(console.error);
