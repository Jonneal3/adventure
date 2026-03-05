const { createClient } = require('@supabase/supabase-js');

// This script queries the database to get all subcategories and generates a seed file
async function generateCreditSeed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '');
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    console.error('URL:', supabaseUrl);
    console.error('Key:', supabaseKey ? 'Present' : 'Missing');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Query all subcategories (not just active ones)
    const { data: subcategories, error } = await supabase
      .from('categories_subcategories')
      .select('subcategory, instance_type, email_lead_price, phone_lead_price, status')
      .order('instance_type, subcategory');

    if (error) {
      console.error('Error fetching subcategories:', error);
      return;
    }

    console.log('Found subcategories:', subcategories.length);
    console.log('Sample subcategories:', subcategories.slice(0, 5));
    
    // Generate seed file content
    let seedContent = `-- Seed credit pricing for existing subcategories
-- Generated automatically from database

BEGIN;

`;

    // Group by instance type
    const ecommServices = subcategories.filter(s => s.instance_type === 'ecomm');
    const serviceServices = subcategories.filter(s => s.instance_type === 'service');
    const otherServices = subcategories.filter(s => !s.instance_type || (s.instance_type !== 'ecomm' && s.instance_type !== 'service'));

    // E-commerce services (1-2 credits)
    if (ecommServices.length > 0) {
      seedContent += `-- E-commerce services (1-2 credits)
`;
      ecommServices.forEach(sub => {
        const creditPrice = sub.email_lead_price && sub.email_lead_price > 3 ? 2 : 1;
        seedContent += `UPDATE categories_subcategories 
SET credit_price = ${creditPrice}
WHERE subcategory = '${sub.subcategory}' AND instance_type = 'ecomm';

`;
      });
    }

    // Service services (2-5 credits based on lead prices)
    if (serviceServices.length > 0) {
      seedContent += `-- Service services (2-5 credits based on value)
`;
      serviceServices.forEach(sub => {
        let creditPrice = 2; // default
        if (sub.email_lead_price) {
          if (sub.email_lead_price >= 8) creditPrice = 5;
          else if (sub.email_lead_price >= 6) creditPrice = 4;
          else if (sub.email_lead_price >= 4) creditPrice = 3;
          else creditPrice = 2;
        }
        seedContent += `UPDATE categories_subcategories 
SET credit_price = ${creditPrice}
WHERE subcategory = '${sub.subcategory}' AND instance_type = 'service';

`;
      });
    }

    seedContent += `-- Set default credit price for any remaining NULL values
UPDATE categories_subcategories 
SET credit_price = 2
WHERE credit_price IS NULL;

COMMIT;
`;

    // Write to file
    const fs = require('fs');
    fs.writeFileSync('supabase/migrations/20250121_seed_credit_pricing_generated.sql', seedContent);
    
    console.log('Generated seed file: supabase/migrations/20250121_seed_credit_pricing_generated.sql');
    console.log('E-commerce services:', ecommServices.length);
    console.log('Service services:', serviceServices.length);
    console.log('Other services:', otherServices.length);

  } catch (error) {
    console.error('Error:', error);
  }
}

generateCreditSeed();
