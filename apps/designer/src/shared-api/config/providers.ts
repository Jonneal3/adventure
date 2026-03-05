import { ProviderKey, ProviderConfig, ModelConfig, ModelMode } from '../types/api';

export const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
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
};

export const MODEL_CONFIGS: ModelConfig = {
  performance: {
    replicate: "google/nano-banana",
  },
  quality: {
    replicate: "google/nano-banana",
  },
};

export const PROVIDER_ORDER: ProviderKey[] = [
  "replicate",
];

// Helper function to get model for a specific mode and provider
export function getModelForMode(mode: ModelMode, provider: ProviderKey): string {
  return MODEL_CONFIGS[mode][provider];
}

// Helper function to check if a model is valid for a provider
export function isValidModel(provider: ProviderKey, modelId: string): boolean {
  return PROVIDERS[provider].models.includes(modelId);
} 