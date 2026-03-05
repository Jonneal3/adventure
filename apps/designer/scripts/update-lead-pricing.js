const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Industry-specific pricing tiers (in dollars, will be converted to credits)
const PRICING_TIERS = {
  // High-value services (contractors, professional services)
  high_value_services: {
    email: 15, // $15 = 250 credits
    phone: 50  // $50 = 833 credits
  },
  
  // Medium-value services (beauty, retail, etc.)
  medium_value_services: {
    email: 8,  // $8 = 133 credits
    phone: 25  // $25 = 416 credits
  },
  
  // E-commerce (varies by product type)
  ecomm_high_value: {
    email: 5,  // $5 = 83 credits
    phone: 15  // $15 = 250 credits
  },
  
  ecomm_medium_value: {
    email: 3,  // $3 = 50 credits
    phone: 8   // $8 = 133 credits
  },
  
  ecomm_low_value: {
    email: 2,  // $2 = 33 credits
    phone: 5   // $5 = 83 credits
  }
};

// Keywords to identify service types
const SERVICE_KEYWORDS = {
  high_value: [
    'roofing', 'contractor', 'construction', 'electrical', 'plumbing', 'hvac', 'heating', 'air-conditioning',
    'masonry', 'concrete', 'foundation', 'structural', 'steel', 'precast', 'poured', 'site-preparation',
    'siding', 'flooring', 'tile', 'terrazzo', 'glass', 'glazing', 'painting', 'wall-covering',
    'drywall', 'insulation', 'finish-carpentry', 'carpentry', 'window', 'door', 'garage',
    'landscaping', 'irrigation', 'solar', 'water-supply', 'property-manager', 'real-estate',
    'custom', 'architectural', 'millwork', 'woodwork', 'metal-work', 'ornamental',
    'prefabricated', 'ready-mix', 'reconstituted', 'preservation', 'kitchen-cabinet',
    'countertop', 'office-furniture', 'container', 'pallet', 'window-treatment',
    'sign-manufacturing', 'vending-machine', 'mobile-food', 'full-service-restaurant',
    'retail-bakery', 'beauty-salon', 'nail-salon', 'personal-care', 'specialized-design',
    'outdoor-advertising', 'paint-coating', 'paint-wallpaper', 'paint-varnish',
    'plastics-plumbing', 'plumbing-fixture', 'heating-air-conditioning',
    'highway-street-bridge', 'heavy-civil-engineering', 'personal-household-goods',
    'pressed-blown-glass', 'glassware-manufacturing', 'textile-fabric-finishing',
    'travel-trailer', 'camper-manufacturing', 'rv-recreational-vehicle',
    'sewing-needlework', 'piece-goods', 'lumber-plywood', 'wood-panel',
    'metal-service-centers', 'home-furnishing', 'household-furniture',
    'commercial-industrial', 'institutional', 'electric-lighting-fixture',
    'cut-sew-apparel', 'leather-hide-tanning', 'new-housing', 'nonresidential',
    'nursery-garden-center', 'farm-supply', 'offices-real-estate-agents',
    'other-activities-real-estate', 'other-building-equipment',
    'other-building-finishing', 'other-building-material', 'other-concrete-product',
    'other-heavy-civil-engineering', 'other-personal-household-goods',
    'other-personal-care', 'other-pressed-blown-glass', 'other-specialized-design',
    'roofing-siding-insulation', 'soil-preparation-planting-cultivating',
    'structural-steel-precast-concrete', 'tile-terrazzo', 'wood-container-pallet',
    'wood-kitchen-cabinet', 'wood-office-furniture', 'wood-preservation',
    'wood-window-door', 'all-other-specialty-trade'
  ],
  
  medium_value: [
    'interior-design', 'landscaping', 'garden', 'nursery', 'outdoor', 'patio', 'deck',
    'pool', 'hot-tub', 'sauna', 'fireplace', 'fire-pit', 'gazebo', 'pergola',
    'outdoor-kitchen', 'outdoor-lighting', 'water-features', 'walkways', 'paving',
    'stonework', 'fence', 'shed', 'garage', 'home-gym', 'home-office', 'home-theater',
    'mancave', 'wine-cellar', 'tiny-home', 'virtual-staging', 'airbnb-makeovers',
    'custom-tailoring', 'hair-styling', 'hair-extensions', 'makeup', 'lashes',
    'microblading', 'nail-color', 'wig-hairpiece', 'beauty', 'salon', 'nail',
    'personal-care', 'furniture', 'closet-storage', 'artwork-wall-decor',
    'paint-wallpaper', 'flooring', 'carpeting', 'lighting-smart-lighting',
    'seasonal-holiday-decor', 'custom-metal-fabrication', 'door-garage-door',
    'exterior-painting', 'siding-replacement', 'roof-replacement', 'solar-panel',
    'structural-modular', 'campground-layout', 'irrigation-system', 'land-lot-planning',
    'recreational-sports', 'new-custom-homes', 'greenhouse', 'prosthetics'
  ]
};

// E-commerce product categories
const ECOMM_CATEGORIES = {
  high_value: [
    'furniture', 'appliance', 'electronics', 'jewelry', 'luxury', 'premium',
    'custom', 'tailored', 'designer', 'artwork', 'art', 'decor', 'lighting',
    'kitchen', 'bathroom', 'bedroom', 'living-room', 'outdoor-furniture',
    'home-gym', 'home-office', 'home-theater', 'wine-cellar', 'hot-tub',
    'sauna', 'pool', 'gazebo', 'pergola', 'outdoor-kitchen', 'fireplace',
    'fire-pit', 'water-features', 'stonework', 'custom-metal', 'prosthetics'
  ],
  
  medium_value: [
    'clothing', 'fashion', 'apparel', 'shoes', 'accessories', 'beauty',
    'makeup', 'skincare', 'hair', 'nail', 'wig', 'home-decor', 'wall-decor',
    'paint', 'wallpaper', 'flooring', 'carpeting', 'lighting', 'seasonal',
    'holiday', 'outdoor', 'patio', 'deck', 'garden', 'nursery', 'landscaping',
    'campground', 'recreational', 'sports', 'tiny-home', 'virtual-staging',
    'airbnb', 'makeover', 'custom-tailoring', 'hair-styling', 'hair-extensions',
    'lashes', 'microblading', 'nail-color', 'door', 'garage-door', 'exterior',
    'siding', 'roof', 'solar', 'structural', 'modular', 'irrigation', 'land',
    'lot-planning', 'new-custom-homes', 'greenhouse'
  ],
  
  low_value: [
    'general', 'basic', 'standard', 'simple', 'budget', 'affordable',
    'mass-market', 'commodity', 'bulk', 'wholesale', 'retail', 'store',
    'shop', 'market', 'grocery', 'food', 'beverage', 'snack', 'candy',
    'toy', 'game', 'book', 'magazine', 'newspaper', 'stationery',
    'office-supply', 'cleaning', 'household', 'kitchen-ware', 'bathroom',
    'personal-care', 'hygiene', 'health', 'wellness', 'fitness',
    'sports-equipment', 'outdoor-gear', 'camping', 'hiking', 'travel',
    'luggage', 'bag', 'backpack', 'wallet', 'purse', 'handbag'
  ]
};

function getPricingTier(subcategory, instanceType) {
  const subcategoryLower = subcategory.toLowerCase();
  
  if (instanceType === 'service') {
    // Check for high-value services
    if (SERVICE_KEYWORDS.high_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'high_value_services';
    }
    // Check for medium-value services
    if (SERVICE_KEYWORDS.medium_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'medium_value_services';
    }
    // Default to medium-value for services
    return 'medium_value_services';
  } else if (instanceType === 'ecomm') {
    // Check for high-value e-commerce
    if (ECOMM_CATEGORIES.high_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_high_value';
    }
    // Check for medium-value e-commerce
    if (ECOMM_CATEGORIES.medium_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_medium_value';
    }
    // Check for low-value e-commerce
    if (ECOMM_CATEGORIES.low_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_low_value';
    }
    // Default to medium-value for e-commerce
    return 'ecomm_medium_value';
  }
  
  // Fallback
  return 'medium_value_services';
}

function calculateCredits(dollarAmount) {
  // $0.06 per credit, so divide by 0.06 or multiply by 16.67
  return Math.round(dollarAmount * 16.67);
}

async function updateLeadPricing() {
  try {
    console.log('🔍 Fetching all rows to update lead pricing...');
    
    const { data: rows, error } = await supabase
      .from('categories_subcategories')
      .select('id, subcategory, instance_type, email_lead_price, phone_lead_price')
      .order('subcategory');

    if (error) {
      throw error;
    }

    console.log(`📊 Total rows: ${rows.length}`);

    const updates = [];
    let updatedCount = 0;

    rows.forEach((row, index) => {
      const pricingTier = getPricingTier(row.subcategory, row.instance_type);
      const pricing = PRICING_TIERS[pricingTier];
      
      const newEmailPrice = calculateCredits(pricing.email);
      const newPhonePrice = calculateCredits(pricing.phone);
      
      // Only update if prices are different
      if (row.email_lead_price !== newEmailPrice || row.phone_lead_price !== newPhonePrice) {
        updates.push({
          id: row.id,
          email_lead_price: newEmailPrice,
          phone_lead_price: newPhonePrice,
          pricing_tier: pricingTier,
          subcategory: row.subcategory,
          instance_type: row.instance_type
        });
        updatedCount++;
      }
    });

    console.log(`\n📝 Found ${updatedCount} rows that need pricing updates`);
    console.log(`📊 Pricing breakdown:`);
    
    // Show some examples
    const examples = updates.slice(0, 10);
    examples.forEach(update => {
      console.log(`  ${update.subcategory} (${update.instance_type}) - Tier: ${update.pricing_tier}`);
      console.log(`    Email: $${update.email_lead_price / 16.67} (${update.email_lead_price} credits)`);
      console.log(`    Phone: $${update.phone_lead_price / 16.67} (${update.phone_lead_price} credits)`);
    });

    if (updates.length > 10) {
      console.log(`  ... and ${updates.length - 10} more rows`);
    }

    // Update in batches
    console.log(`\n📤 Updating ${updates.length} rows...`);
    
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('categories_subcategories')
          .update({ 
            email_lead_price: update.email_lead_price,
            phone_lead_price: update.phone_lead_price
          })
          .eq('id', update.id);
        
        if (updateError) {
          throw updateError;
        }
      }
      
      console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
    }

    console.log(`\n🎉 Successfully updated ${updates.length} rows with industry-standard pricing!`);
    
    // Show final summary
    const tierCounts = {};
    updates.forEach(update => {
      tierCounts[update.pricing_tier] = (tierCounts[update.pricing_tier] || 0) + 1;
    });
    
    console.log(`\n📊 Final pricing distribution:`);
    Object.entries(tierCounts).forEach(([tier, count]) => {
      const pricing = PRICING_TIERS[tier];
      console.log(`  ${tier}: ${count} rows`);
      console.log(`    Email: $${pricing.email} (${calculateCredits(pricing.email)} credits)`);
      console.log(`    Phone: $${pricing.phone} (${calculateCredits(pricing.phone)} credits)`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
updateLeadPricing();
