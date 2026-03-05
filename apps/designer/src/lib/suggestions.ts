import type { Suggestion } from '@mage/types';

export type { Suggestion };

const artStyles = ["anime", "art nouveau", "ukiyo-e", "watercolor"];

const basePrompts: { text: string; prompt: string }[] = [
  {
    text: "Salamander Dusk",
    prompt: "A salamander at dusk in a forest pond",
  },
  {
    text: "Sultry Chicken",
    prompt:
      "A sultry chicken peering around the corner from shadows, clearly up to no good",
  },
  {
    text: "Cat Vercel",
    prompt: "A cat launching its website on Vercel",
  },
  {
    text: "Red Panda",
    prompt:
      "A red panda sipping tea under cherry blossoms at sunset with Mount Fuji in the background",
  },
  {
    text: "Beach Otter",
    prompt: "A mischievous otter surfing the waves in Bali at golden hour",
  },
  {
    text: "Badger Ramen",
    prompt: "A pensive honey badger eating a bowl of ramen in Osaka",
  },
  {
    text: "Zen Frog",
    prompt:
      "A frog meditating on a lotus leaf in a tranquil forest pond at dawn, surrounded by fireflies",
  },
  {
    text: "Macaw Love",
    prompt:
      "A colorful macaw delivering a love letter, flying over the Grand Canyon at sunrise",
  },
  {
    text: "Fox Painting",
    prompt: "A fox walking through a field of lavender with a golden sunset",
  },
  {
    text: "Armadillo Aerospace",
    prompt:
      "An armadillo in a rocket at countdown preparing to blast off to Mars",
  },
  {
    text: "Penguin Delight",
    prompt: "A penguin in pajamas eating ice cream while watching television",
  },
  {
    text: "Echidna Library",
    prompt:
      "An echidna reading a book in a cozy library built into the branches of a eucalyptus tree",
  },
  {
    text: "Capybara Onsen",
    prompt:
      "A capybara relaxing in a hot spring surrounded by snow-covered mountains with a waterfall in the background",
  },
  {
    text: "Lion Throne",
    prompt:
      "A regal lion wearing a crown, sitting on a throne in a jungle palace, with waterfalls in the distance",
  },
  {
    text: "Dolphin Glow",
    prompt:
      "A dolphin leaping through a glowing ring of bioluminescence under a starry sky",
  },
  {
    text: "Owl Detective",
    prompt:
      "An owl wearing a monocle and top hat, solving a mystery in a misty forest at midnight",
  },
  {
    text: "Jellyfish Cathedral",
    prompt:
      "A jellyfish floating gracefully in an underwater cathedral made of coral and glass",
  },
  {
    text: "Platypus River",
    prompt: "A platypus foraging in a river with a sunset in the background",
  },
  {
    text: "Chameleon Urban",
    prompt:
      "A chameleon blending into a graffiti-covered wall in an urban jungle",
  },
  {
    text: "Tortoise Oasis",
    prompt:
      "A giant tortoise slowly meandering its way to an oasis in the desert",
  },
  {
    text: "Hummingbird Morning",
    prompt:
      "A hummingbird sipping nectar from a purple bougainvillea at sunrise, captured mid-flight",
  },
  {
    text: "Polar Bear",
    prompt:
      "A polar bear clambering onto an iceberg to greet a friendly harbor seal as dusk falls",
  },
  {
    text: "Lemur Sunbathing",
    prompt:
      "A ring-tailed lemur sunbathing on a rock in Madagascar in early morning light",
  },
];

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const getRandomSuggestions = (count: number = 3): Suggestion[] => {
  const shuffledPrompts = shuffle(basePrompts);
  const shuffledStyles = shuffle(artStyles);

  return shuffledPrompts.slice(0, count).map((item, index) => ({
    text: item.text,
    prompt: `${item.prompt}, in the style of ${
      shuffledStyles[index % shuffledStyles.length]
    }`,
  }));
}

// New function to get dynamic suggestions based on instance subcategories
export const getDynamicSuggestions = async (
  instanceId: string, 
  count: number = 3,
  supabase: any
): Promise<Suggestion[]> => {
  try {
    if (!instanceId || !supabase) {
      // Fallback to random suggestions if no instance or supabase
      return getRandomSuggestions(count);
    }

    // Get subcategories for this instance
    const { data: instanceSubcategories, error: subError } = await supabase
      .from('instance_subcategories')
      .select(`
        category_subcategory_id,
        categories_subcategories (
          id,
          subcategory,
          categories ( name )
        )
      `)
      .eq('instance_id', instanceId);

    if (subError || !instanceSubcategories || instanceSubcategories.length === 0) {
      return getRandomSuggestions(count);
    }

    // Get prompts from images associated with these subcategories
    const subcategoryIds = instanceSubcategories.map(
      (item: any) => item.categories_subcategories.id
    );

    const { data: images, error: imageError } = await supabase
      .from('images')
      .select(`
        id,
        metadata,
        subcategory_id,
        categories_subcategories (
          subcategory,
          categories ( name )
        )
      `)
      .in('subcategory_id', subcategoryIds)
      .not('metadata->prompt', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // Get more than needed to have variety

    if (imageError || !images || images.length === 0) {
      return getRandomSuggestions(count);
    }

    // Extract unique prompts from images
    const uniquePrompts = new Map<string, { prompt: string; category: string; subcategory: string }>();
    
    images.forEach((image: any) => {
      const prompt = image.metadata?.prompt;
      const category = image.categories_subcategories?.categories?.name || 'Unknown';
      const subcategory = image.categories_subcategories?.subcategory || 'Unknown';
      
      if (prompt && !uniquePrompts.has(prompt)) {
        uniquePrompts.set(prompt, { prompt, category, subcategory });
      }
    });

    const promptArray = Array.from(uniquePrompts.values());
    
    if (promptArray.length === 0) {
      return getRandomSuggestions(count);
    }

    // Shuffle and select prompts
    const shuffledPrompts = shuffle(promptArray);
    const shuffledStyles = shuffle(artStyles);
    
    const selectedPrompts = shuffledPrompts.slice(0, count);
    
    return selectedPrompts.map((item, index) => ({
      text: `${item.category} - ${item.subcategory}`,
      prompt: `${item.prompt}, in the style of ${
        shuffledStyles[index % shuffledStyles.length]
      }`,
      category: item.category,
      subcategory: item.subcategory
    }));

  } catch (error) {
    // Fallback to random suggestions on error
    return getRandomSuggestions(count);
  }
};