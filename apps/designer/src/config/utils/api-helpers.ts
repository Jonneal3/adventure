import { GenerateImageRequest, GenerateImageResponse, PredictionStatus } from '../types/api';

export function validateImageRequest(request: GenerateImageRequest): string[] {
  const errors: string[] = [];

  if (!request.prompt || request.prompt.trim().length === 0) {
    errors.push('Prompt is required');
  }

  if (!request.provider) {
    errors.push('Provider is required');
  }

  if (!request.modelId) {
    errors.push('Model ID is required');
  }

  if (request.width && (request.width < 256 || request.width > 2048)) {
    errors.push('Width must be between 256 and 2048');
  }

  if (request.height && (request.height < 256 || request.height > 2048)) {
    errors.push('Height must be between 256 and 2048');
  }

  if (request.numOutputs && (request.numOutputs < 1 || request.numOutputs > 10)) {
    errors.push('Number of outputs must be between 1 and 10');
  }

  return errors;
}

export function sanitizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ');
}

export function formatErrorResponse(error: string): GenerateImageResponse {
  return {
    error,
    status: 'failed',
  };
}

export function formatSuccessResponse(images: string[]): GenerateImageResponse {
  return {
    images,
    status: 'succeeded',
  };
}

export function isPredictionComplete(status: string): boolean {
  return ['succeeded', 'failed', 'canceled'].includes(status);
}

export function extractImagesFromPrediction(prediction: PredictionStatus): string[] {
  if (prediction.status !== 'succeeded' || !prediction.output) {
    return [];
  }

  // Handle different output formats
  if (Array.isArray(prediction.output)) {
    return prediction.output.filter((item: any) => typeof item === 'string');
  }

  if (typeof prediction.output === 'string') {
    return [prediction.output];
  }

  return [];
}

export function getApiKeyForProvider(provider: string): string {
  const envVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[envVar];
  
  if (!apiKey) {
    throw new Error(`Missing API key for ${provider}. Please set ${envVar} environment variable.`);
  }
  
  return apiKey;
} 