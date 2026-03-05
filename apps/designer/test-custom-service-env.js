// Using built-in fetch and environment variables
require('dotenv').config({ path: '.env.local' });

async function testCustomServiceWithEnv() {
  try {
    console.log('Testing custom service creation with environment variables...');
    
    // Read environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing environment variables');
      return;
    }
    
    // Test direct Supabase insert
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('Testing direct Supabase insert...');
    
    const { data, error } = await supabase
      .from('categories_subcategories')
      .insert({
        subcategory: 'Test Custom Service Direct',
        description: 'This is a test custom service description via direct Supabase',
        category_id: '023993ca-b768-4f19-bf61-24c3e59b5fbb',
        user_id: null, // Set to null since we don't have a real user ID
        account_id: '4a589115-67bb-4ad6-93d9-dc921b4f9f67',
        status: 'verification_needed',
        instance_type: 'service',
      })
      .select()
      .single();
    
    if (error) {
      console.log('❌ Direct Supabase insert failed:', error.message);
      console.log('Error details:', error);
    } else {
      console.log('✅ Direct Supabase insert successful!');
      console.log('Created subcategory:', data);
    }
    
  } catch (error) {
    console.error('❌ Error testing custom service:', error.message);
  }
}

testCustomServiceWithEnv();
