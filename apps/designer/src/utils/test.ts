import { createClient } from '@supabase/supabase-js';
import { ImageStorage } from './image-storage.js';
import { readFileSync } from 'fs';
import path from 'path';

async function testImageStorage() {
  // Use environment variables for Supabase credentials
  const supabaseUrl = 'https://xvpagpzufitqzoijoalz.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cGFncHp1Zml0cXpvaWpvYWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzQyMzg1MCwiZXhwIjoyMDYyOTk5ODUwfQ.Uzh0xJN5GP5koSSHtbtr1kDP8q1AKQBZk34G_-Vj8j0';

  // Create Supabase client for database operations
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const imageStorage = new ImageStorage({
    s3Config: {
      endpoint: 'https://xvpagpzufitqzoijoalz.supabase.co/storage/v1/s3',
      region: 'us-east-2',
      credentials: {
        accessKeyId: '665f1e038288c615e91ce7d16b9a28aa',
        secretAccessKey: 'e95b8caf5683ae65f7fc3f3476e4def01aa00348c6b5dde3ef0031022db9161d'
      },
      forcePathStyle: true
    },
    supabaseClient: supabase
  });

  try {
    // Read test image
    const imagePath = path.join(__dirname, '../../../apps/designer/assets/headshots-packs.png');
    const imageData = readFileSync(imagePath);
    const imageBlob = new Blob([imageData], { type: 'image/png' });

    // Test upload with a timestamp in the name to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const imageUrl = await imageStorage.uploadImage(imageBlob, {
      path: `main/headshots-${timestamp}.png`,
      userId: 'test-user-id',
      instanceId: 'test-instance-id',
      modelId: 'test-model-id',
      promptId: 'test-prompt-id',
      negativePrompt: 'test negative prompt',
      metadata: {
        originalName: 'headshots-packs.png',
        uploadedAt: timestamp,
        test: true
      }
    });

    await imageStorage.deleteImage(imageUrl);
  } catch (error) {
    if (error instanceof Error) {}
    process.exit(1);
  }
}

// Run the test
testImageStorage().catch(error => {
  process.exit(1);
}); 