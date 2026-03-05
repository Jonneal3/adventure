export type ProviderKey = "replicate";

export type ModelMode = "performance" | "quality";

export interface GenerateImageRequest {
  prompt: string;
  provider: ProviderKey;
  modelId: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

export interface GenerateImageResponse {
  images?: string[];
  error?: string;
  predictionId?: string;
  status?: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
}

export interface PredictionStatus {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: any;
  error?: string;
  logs?: string;
}

export interface ProviderConfig {
  displayName: string;
  iconPath: string;
  color: string;
  models: string[];
}

export interface ModelConfig {
  performance: Record<ProviderKey, string>;
  quality: Record<ProviderKey, string>;
} 