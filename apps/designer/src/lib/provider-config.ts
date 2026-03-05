export type ProviderKey = "replicate" | "vertex" | "openai" | "fireworks";
export type ModelMode = "performance" | "quality";

export const PROVIDERS: Record<
  ProviderKey,
  {
    displayName: string;
    iconPath: string;
    color: string;
    models: string[];
  }
> = {
  replicate: {
    displayName: "Replicate",
    iconPath: "/provider-icons/replicate.svg",
    color: "from-purple-500 to-blue-500",
    models: [
      // Google Nano Banana
      "google/nano-banana",
      // FLUX Models
      "black-forest-labs/flux-kontext-max",
      "black-forest-labs/flux-kontext-pro",
      "black-forest-labs/flux-schnell",
      "black-forest-labs/flux-pro",
      "black-forest-labs/flux-dev-lora",
      "black-forest-labs/flux-dev",
      "black-forest-labs/flux-1.1-pro-ultra",
      "black-forest-labs/flux-1.1-pro",
      
      // Google Imagen Models
      "google/imagen-4-fast",
      "google/imagen-4",
      "google/imagen-4-ultra",
      "google/imagen-3-fast",
      "google/imagen-3",
      
      // Ideogram Models
      "ideogram-ai/ideogram-v3-balanced",
      "ideogram-ai/ideogram-v3-turbo",
      "ideogram-ai/ideogram-v3-quality",
      "ideogram-ai/ideogram-v2a-turbo",
      "ideogram-ai/ideogram-v2a",
      "ideogram-ai/ideogram-v2-turbo",
      "ideogram-ai/ideogram-v2",
      
      // Recraft Models
      "recraft-ai/recraft-v3",
      "recraft-ai/recraft-v3-svg",
      
      // Stability AI Models
      "stability-ai/stable-diffusion-3.5-large",
      "stability-ai/stable-diffusion-3.5-large-turbo",
      "stability-ai/stable-diffusion-3.5-medium",
      "stability-ai/sdxl",
      "stability-ai/stable-diffusion-inpainting",
      "stability-ai/stable-diffusion",
      
      // Pruna AI Models
      "prunaai/hidream-l1-full",
      "prunaai/flux.1-dev",
      "prunaai/sdxl-lightning",
      "prunaai/hidream-l1-fast",
      "prunaai/hidream-l1-dev",
      
      // Other Models
      "bria/image-3.2",
      "fofr/any-comfyui-workflow",
      "fofr/sticker-maker",
      "fofr/latent-consistency-model",
      "fofr/realvisxl-v3-multi-controlnet-lora",
      "fofr/sdxl-multi-controlnet-lora",
      "fofr/sdxl-emoji",
      "bytedance/seedream-3",
      "bytedance/sdxl-lightning-4step",
      "minimax/image-01",
      "nvidia/sana-sprint-1.6b",
      "nvidia/sana",
      "luma/photon-flash",
      "luma/photon",
      "ai-forever/kandinsky-2",
      "ai-forever/kandinsky-2.2",
      "playgroundai/playground-v2.5-1024px-aesthetic",
      "datacte/proteus-v0.3",
      "datacte/proteus-v0.2",
      "adirik/realvisxl-v3.0-turbo",
      "lucataco/open-dalle-v1.1",
      "lucataco/dreamshaper-xl-turbo",
      "lucataco/pixart-xl-2",
      "lucataco/ssd-1b",
      "lucataco/realistic-vision-v5.1",
      "jagilley/controlnet-scribble",
      "tstramer/material-diffusion",
      "fermatresearch/sdxl-controlnet-lora",
    ],
  },
  vertex: {
    displayName: "Vertex AI",
    iconPath: "/provider-icons/vertex.svg",
    color: "from-green-500 to-blue-500",
    models: ["vertex-model-1", "vertex-model-2"], // placeholder
  },
  openai: {
    displayName: "OpenAI",
    iconPath: "/provider-icons/openai.svg",
    color: "from-gray-700 to-green-400",
    models: ["openai-model-1", "openai-model-2"], // placeholder
  },
  fireworks: {
    displayName: "Fireworks AI",
    iconPath: "/provider-icons/fireworks.svg",
    color: "from-yellow-400 to-red-500",
    models: ["fireworks-model-1", "fireworks-model-2"], // placeholder
  },
};

export const MODEL_CONFIGS: Record<ModelMode, Record<ProviderKey, string>> = {
  performance: {
    replicate: "google/nano-banana",
    vertex: "vertex-model-1",
    openai: "openai-model-1",
    fireworks: "fireworks-model-1",
  },
  quality: {
    replicate: "google/nano-banana",
    vertex: "vertex-model-2",
    openai: "openai-model-2",
    fireworks: "fireworks-model-2",
  },
};

export const PROVIDER_ORDER: ProviderKey[] = [
  "replicate",
  "vertex",
  "openai",
  "fireworks",
];

export function initializeProviderRecord(enabled: boolean): Record<ProviderKey, boolean> {
  return PROVIDER_ORDER.reduce((acc, provider) => {
    acc[provider] = enabled;
    return acc;
  }, {} as Record<ProviderKey, boolean>);
}
