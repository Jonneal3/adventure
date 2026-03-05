const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Credit pricing tiers based on service complexity and value
const CREDIT_PRICING = {
  // High-value services (complex, expensive, high-ticket)
  high_value_services: {
    credits: 10, // $0.60 per generation
    description: "Complex services like roofing, construction, custom work"
  },
  
  // Medium-high value services (moderately complex)
  medium_high_services: {
    credits: 6, // $0.36 per generation
    description: "Professional services like interior design, landscaping"
  },
  
  // Medium value services (standard complexity)
  medium_value_services: {
    credits: 4, // $0.24 per generation
    description: "Standard services like beauty, basic home improvement"
  },
  
  // E-commerce high-value (premium products)
  ecomm_high_value: {
    credits: 3, // $0.18 per generation
    description: "Premium e-commerce like furniture, artwork, custom items"
  },
  
  // E-commerce medium-value (standard products)
  ecomm_medium_value: {
    credits: 2, // $0.12 per generation
    description: "Standard e-commerce like clothing, home decor"
  },
  
  // E-commerce low-value (simple, low-ticket items)
  ecomm_low_value: {
    credits: 1, // $0.06 per generation
    description: "Simple e-commerce like basic apparel, accessories"
  }
};

// Keywords to identify service complexity and value
const SERVICE_COMPLEXITY = {
  high_value: [
    // Construction & Contracting
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
    'wood-window-door', 'all-other-specialty-trade',
    // High-value custom work
    'custom-tailoring', 'prosthetics', 'custom-metal-fabrication', 'architectural',
    'millwork', 'woodwork', 'metal-work', 'ornamental', 'prefabricated'
  ],
  
  medium_high: [
    // Professional Design Services
    'interior-design', 'landscaping', 'garden', 'nursery', 'outdoor', 'patio', 'deck',
    'pool', 'hot-tub', 'sauna', 'fireplace', 'fire-pit', 'gazebo', 'pergola',
    'outdoor-kitchen', 'outdoor-lighting', 'water-features', 'walkways', 'paving',
    'stonework', 'fence', 'shed', 'garage', 'home-gym', 'home-office', 'home-theater',
    'mancave', 'wine-cellar', 'tiny-home', 'virtual-staging', 'airbnb-makeovers',
    'hair-styling', 'hair-extensions', 'makeup', 'lashes', 'microblading', 'nail-color',
    'wig-hairpiece', 'beauty', 'salon', 'nail', 'personal-care',
    'furniture', 'closet-storage', 'artwork-wall-decor', 'paint-wallpaper',
    'flooring', 'carpeting', 'lighting-smart-lighting', 'seasonal-holiday-decor',
    'door-garage-door', 'exterior-painting', 'siding-replacement', 'roof-replacement',
    'solar-panel', 'structural-modular', 'campground-layout', 'irrigation-system',
    'land-lot-planning', 'recreational-sports', 'new-custom-homes', 'greenhouse'
  ],
  
  medium_value: [
    // Standard Services
    'accessories', 'general', 'basic', 'standard', 'simple', 'budget', 'affordable'
  ]
};

// E-commerce product complexity
const ECOMM_COMPLEXITY = {
  high_value: [
    // Premium/Complex Products
    'furniture', 'appliance', 'electronics', 'jewelry', 'luxury', 'premium',
    'custom', 'tailored', 'designer', 'artwork', 'art', 'decor', 'lighting',
    'kitchen', 'bathroom', 'bedroom', 'living-room', 'outdoor-furniture',
    'home-gym', 'home-office', 'home-theater', 'wine-cellar', 'hot-tub',
    'sauna', 'pool', 'gazebo', 'pergola', 'outdoor-kitchen', 'fireplace',
    'fire-pit', 'water-features', 'stonework', 'custom-metal', 'prosthetics',
    'architectural', 'millwork', 'woodwork', 'metal-work', 'ornamental',
    'prefabricated', 'ready-mix', 'reconstituted', 'preservation',
    'kitchen-cabinet', 'countertop', 'office-furniture', 'container', 'pallet',
    'window-treatment', 'sign-manufacturing', 'custom-tailoring'
  ],
  
  medium_value: [
    // Standard Products
    'clothing', 'fashion', 'apparel', 'shoes', 'accessories', 'beauty',
    'makeup', 'skincare', 'hair', 'nail', 'wig', 'home-decor', 'wall-decor',
    'paint', 'wallpaper', 'flooring', 'carpeting', 'lighting', 'seasonal',
    'holiday', 'outdoor', 'patio', 'deck', 'garden', 'nursery', 'landscaping',
    'campground', 'recreational', 'sports', 'tiny-home', 'virtual-staging',
    'airbnb', 'makeover', 'hair-styling', 'hair-extensions', 'lashes',
    'microblading', 'nail-color', 'door', 'garage-door', 'exterior',
    'siding', 'roof', 'solar', 'structural', 'modular', 'irrigation', 'land',
    'lot-planning', 'new-custom-homes', 'greenhouse'
  ],
  
  low_value: [
    // Simple/Low-ticket Items
    'general', 'basic', 'standard', 'simple', 'budget', 'affordable',
    'mass-market', 'commodity', 'bulk', 'wholesale', 'retail', 'store',
    'shop', 'market', 'grocery', 'food', 'beverage', 'snack', 'candy',
    'toy', 'game', 'book', 'magazine', 'newspaper', 'stationery',
    'office-supply', 'cleaning', 'household', 'kitchen-ware', 'bathroom',
    'personal-care', 'hygiene', 'health', 'wellness', 'fitness',
    'sports-equipment', 'outdoor-gear', 'camping', 'hiking', 'travel',
    'luggage', 'bag', 'backpack', 'wallet', 'purse', 'handbag',
    'all-ecomm', 'all-accessories'
  ]
};

function getCreditPricingTier(subcategory, instanceType) {
  const subcategoryLower = subcategory.toLowerCase();
  
  if (instanceType === 'service') {
    // Check for high-value services (most complex/expensive)
    if (SERVICE_COMPLEXITY.high_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'high_value_services';
    }
    // Check for medium-high value services
    if (SERVICE_COMPLEXITY.medium_high.some(keyword => subcategoryLower.includes(keyword))) {
      return 'medium_high_services';
    }
    // Default to medium value for services
    return 'medium_value_services';
  } else if (instanceType === 'ecomm') {
    // Check for high-value e-commerce (premium products)
    if (ECOMM_COMPLEXITY.high_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_high_value';
    }
    // Check for medium-value e-commerce
    if (ECOMM_COMPLEXITY.medium_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_medium_value';
    }
    // Check for low-value e-commerce (simple items)
    if (ECOMM_COMPLEXITY.low_value.some(keyword => subcategoryLower.includes(keyword))) {
      return 'ecomm_low_value';
    }
    // Default to medium-value for e-commerce
    return 'ecomm_medium_value';
  }
  
  // Fallback
  return 'medium_value_services';
}

async function updateCreditPricing() {
  try {
    console.log('🔍 Fetching all rows to update credit pricing...');
    
    const { data: rows, error } = await supabase
      .from('categories_subcategories')
      .select('id, subcategory, instance_type, credit_price')
      .order('subcategory');

    if (error) {
      throw error;
    }

    console.log(`📊 Total rows: ${rows.length}`);

    const updates = [];
    let updatedCount = 0;

    rows.forEach((row, index) => {
      const pricingTier = getCreditPricingTier(row.subcategory, row.instance_type);
      const pricing = CREDIT_PRICING[pricingTier];
      
      const newCreditPrice = pricing.credits;
      
      // Only update if price is different
      if (row.credit_price !== newCreditPrice) {
        updates.push({
          id: row.id,
          credit_price: newCreditPrice,
          pricing_tier: pricingTier,
          subcategory: row.subcategory,
          instance_type: row.instance_type
        });
        updatedCount++;
      }
    });

    console.log(`\n📝 Found ${updatedCount} rows that need credit pricing updates`);
    console.log(`📊 Pricing breakdown:`);
    
    // Show some examples
    const examples = updates.slice(0, 15);
    examples.forEach(update => {
      const pricing = CREDIT_PRICING[update.pricing_tier];
      console.log(`  ${update.subcategory} (${update.instance_type}) - Tier: ${update.pricing_tier}`);
      console.log(`    Credits: ${update.credit_price} ($${(update.credit_price * 0.06).toFixed(2)} per generation)`);
    });

    if (updates.length > 15) {
      console.log(`  ... and ${updates.length - 15} more rows`);
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
            credit_price: update.credit_price
          })
          .eq('id', update.id);
        
        if (updateError) {
          throw updateError;
        }
      }
      
      console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
    }

    console.log(`\n🎉 Successfully updated ${updates.length} rows with tiered credit pricing!`);
    
    // Show final summary
    const tierCounts = {};
    updates.forEach(update => {
      tierCounts[update.pricing_tier] = (tierCounts[update.pricing_tier] || 0) + 1;
    });
    
    console.log(`\n📊 Final credit pricing distribution:`);
    Object.entries(tierCounts).forEach(([tier, count]) => {
      const pricing = CREDIT_PRICING[tier];
      console.log(`  ${tier}: ${count} rows`);
      console.log(`    Credits: ${pricing.credits} ($${(pricing.credits * 0.06).toFixed(2)} per generation)`);
      console.log(`    Description: ${pricing.description}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
updateCreditPricing();
