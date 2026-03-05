import OpenAI from 'openai';
import { GenerateImageRequest, GenerateImageResponse } from '../types/api';

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey,
    });
  }

  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    try {
      const {
        prompt,
        modelId,
        width = 1024,
        height = 1024,
        numOutputs = 1,
      } = request;

      // Validate model
      if (!['dall-e-2', 'dall-e-3'].includes(modelId)) {
        throw new Error(`Unsupported OpenAI model: ${modelId}`);
      }

      // DALL-E 2 has different size constraints
      if (modelId === 'dall-e-2') {
        if (width !== 1024 && width !== 512) {
          throw new Error('DALL-E 2 only supports 512x512 or 1024x1024');
        }
        if (height !== width) {
          throw new Error('DALL-E 2 requires square images');
        }
      }

      // DALL-E 3 has different size constraints
      if (modelId === 'dall-e-3') {
        if (!['1024x1024', '1792x1024', '1024x1792'].includes(`${width}x${height}`)) {
          throw new Error('DALL-E 3 only supports 1024x1024, 1792x1024, or 1024x1792');
        }
      }

      const response = await this.client.images.generate({
        model: modelId,
        prompt,
        n: Math.min(numOutputs, modelId === 'dall-e-3' ? 1 : 10), // DALL-E 3 only supports 1 image
        size: `${width}x${height}` as any,
        quality: modelId === 'dall-e-3' ? 'standard' : undefined,
        response_format: 'url',
      });

      const images = response.data?.map((img: any) => img.url).filter(Boolean) as string[] || [];

      return {
        images,
        status: 'succeeded',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
} 