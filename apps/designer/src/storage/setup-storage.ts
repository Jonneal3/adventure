import { createClient } from '@supabase/supabase-js';

async function setupStorage() {
  const supabaseUrl = process.argv[2];
  const serviceRoleKey = process.argv[3];

  if (!supabaseUrl || !serviceRoleKey) {
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    // Check if images bucket exists
    const imagesBucket = buckets?.find(b => b.name === 'images');
    if (imagesBucket) {} else {
      const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('images', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
      });

      if (bucketError) throw bucketError;
    }

    const { data: bucket, error: getBucketError } = await supabase.storage.getBucket('images');
    if (getBucketError) throw getBucketError;
  } catch (error) {
    if (error instanceof Error) {}
    process.exit(1);
  }
}

setupStorage().catch(console.error); 