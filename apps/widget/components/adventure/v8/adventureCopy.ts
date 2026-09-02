export type AdventureIndustryLanguage = {
  key: string;
  space: string;
  spaces: string;
  gallerySubject: string;
  photoSubject: string;
  photoContext: string;
};

export type AdventureLocality = {
  label: string;
  isNamedPlace: boolean;
};

type IndustryLanguageInput = {
  serviceLabel?: string | null;
  industry?: string | null;
  serviceSummary?: string | null;
  photoSubject?: string | null;
  photoContext?: string | null;
};

const LANGUAGE_RULES: Array<{
  key: string;
  pattern: RegExp;
  language: Omit<AdventureIndustryLanguage, "key">;
}> = [
  {
    key: "bathroom",
    pattern: /bath|shower|tub|vanity|toilet/,
    language: {
      space: "bathroom",
      spaces: "bathrooms",
      gallerySubject: "bathroom updates",
      photoSubject: "bathroom",
      photoContext: "the actual space, condition, size, and details that affect price",
    },
  },
  {
    key: "kitchen",
    pattern: /kitchen|cabinet|countertop/,
    language: {
      space: "kitchen",
      spaces: "kitchens",
      gallerySubject: "kitchen updates",
      photoSubject: "kitchen",
      photoContext: "the actual space, condition, size, and details that affect price",
    },
  },
  {
    key: "interior-design",
    pattern: /interior design|home decor|room design|living room|bedroom|dining room/,
    language: {
      space: "room",
      spaces: "rooms",
      gallerySubject: "room designs",
      photoSubject: "room",
      photoContext: "the actual space, layout, size, and details that affect price",
    },
  },
  {
    key: "deck",
    pattern: /deck|porch/,
    language: {
      space: "deck",
      spaces: "decks",
      gallerySubject: "decks",
      photoSubject: "deck",
      photoContext: "its actual size, condition, access, and details that affect price",
    },
  },
  {
    key: "landscaping",
    pattern: /landscap|lawn|garden|yard|irrigation/,
    language: {
      space: "yard",
      spaces: "outdoor spaces",
      gallerySubject: "yards",
      photoSubject: "yard",
      photoContext: "the actual space, condition, size, and site details that affect price",
    },
  },
  {
    key: "outdoor",
    pattern: /patio|pergola|hardscap|outdoor|fire pit/,
    language: {
      space: "outdoor space",
      spaces: "outdoor spaces",
      gallerySubject: "outdoor spaces",
      photoSubject: "outdoor space",
      photoContext: "the actual space, condition, size, and site details that affect price",
    },
  },
  {
    key: "pool",
    pattern: /pool|spa|hot tub/,
    language: {
      space: "pool area",
      spaces: "pool areas",
      gallerySubject: "pool spaces",
      photoSubject: "pool area",
      photoContext: "the actual space, condition, size, and site details that affect price",
    },
  },
  {
    key: "flooring",
    pattern: /floor|tile|carpet|hardwood/,
    language: {
      space: "room",
      spaces: "rooms",
      gallerySubject: "new floors",
      photoSubject: "room",
      photoContext: "the actual floor area, condition, layout, and details that affect price",
    },
  },
  {
    key: "roofing",
    pattern: /roof|gutter/,
    language: {
      space: "roof",
      spaces: "roofs",
      gallerySubject: "roof updates",
      photoSubject: "roof",
      photoContext: "its visible condition, size, slope, and details that affect price",
    },
  },
  {
    key: "windows",
    pattern: /window|door/,
    language: {
      space: "home",
      spaces: "homes",
      gallerySubject: "window updates",
      photoSubject: "windows",
      photoContext: "their visible condition, size, placement, and details that affect price",
    },
  },
  {
    key: "painting",
    pattern: /paint|stain|wallpaper/,
    language: {
      space: "space",
      spaces: "spaces",
      gallerySubject: "painted spaces",
      photoSubject: "space",
      photoContext: "the actual area, condition, size, and details that affect price",
    },
  },
  {
    key: "rhinoplasty",
    pattern: /rhinoplast|nose (?:job|surgery)|facial plastic|nose reshaping/,
    language: {
      space: "profile",
      spaces: "profiles",
      gallerySubject: "profile concepts",
      photoSubject: "face/profile",
      photoContext: "your actual profile, proportions, and visible details that affect the estimate",
    },
  },
  {
    key: "nails",
    pattern: /manicure|nail art|nail salon|acrylic nails|gel nails|\bnails?\b/,
    language: {
      space: "nails",
      spaces: "nails",
      gallerySubject: "nail looks",
      photoSubject: "nails",
      photoContext: "their current length, shape, condition, and details that affect price",
    },
  },
  {
    key: "furniture",
    pattern: /furniture|sofa|couch|sectional|dining table|home furnishing/,
    language: {
      space: "room",
      spaces: "rooms",
      gallerySubject: "furnished spaces",
      photoSubject: "room/space",
      photoContext: "the actual room, layout, size, and existing details that affect price",
    },
  },
];

export function languageForIndustry(input: IndustryLanguageInput): AdventureIndustryLanguage {
  const haystack = [input.serviceLabel, input.industry, input.serviceSummary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matched = LANGUAGE_RULES.find((rule) => rule.pattern.test(haystack));
  const inferred = matched
    ? { key: matched.key, ...matched.language }
    : {
        key: "default",
        space: "space",
        spaces: "spaces",
        gallerySubject: "this kind of work",
        photoSubject: "space",
        photoContext: "the actual space, condition, size, and details that affect price",
      };
  const photoSubject = String(input.photoSubject || "").trim();
  const photoContext = String(input.photoContext || "").trim().replace(/[.!?]+$/, "");
  return {
    ...inferred,
    photoSubject: photoSubject || inferred.photoSubject,
    photoContext: photoContext || inferred.photoContext,
  };
}

/** Use a real configured market when available. Never invent a city. */
export function localityFromInstance(instance: any): AdventureLocality {
  const city = String(
    instance?.city ||
      instance?.location_city ||
      instance?.market_city ||
      instance?.address?.city ||
      instance?.business_city ||
      ""
  ).trim();
  const region = String(
    instance?.state ||
      instance?.location_state ||
      instance?.market_state ||
      instance?.address?.state ||
      ""
  ).trim();
  if (city && region) return { label: `${city}, ${region}`, isNamedPlace: true };
  if (city) return { label: city, isNamedPlace: true };
  return { label: "your area", isNamedPlace: false };
}

export function adventureCopy(
  language: AdventureIndustryLanguage,
  locality: AdventureLocality
) {
  const marketPhrase = locality.isNamedPlace ? `around ${locality.label}` : "in your area";
  return {
    photo: {
      title: `Got a photo of your ${language.photoSubject}?`,
      preciseTitle: `Have a photo of your ${language.photoSubject}?`,
      body: "Upload a quick photo so we can base the estimate on the real thing — not just general assumptions.",
      simpleBody: language.key === "bathroom"
        ? "Upload it and we'll use your actual space for a more accurate estimate."
        : `Upload it and we'll use your actual ${language.photoSubject} for a more accurate estimate.`,
      inputLabel: `Your ${language.photoSubject}`,
      resultLabel: "More accurate estimate",
      context: `Your photo helps us understand ${language.photoContext}.`,
      primary: "Add a photo",
      secondary: "Skip for now",
    },
    gallery: {
      title: `See what ${language.gallerySubject} ${marketPhrase} can cost`,
      body: "Pick a look you like to see what it could cost.",
      loading: `Loading local ${language.gallerySubject}…`,
      empty: "No examples are available yet.",
      action: "Get price",
    },
    detail: {
      priceLabel: "Estimated local price",
      breakdownTitle: "What shapes the price",
      customizeTitle: "Like this direction? Make it yours.",
      customizeBody: "Change the details or add a reference.",
    },
  };
}
