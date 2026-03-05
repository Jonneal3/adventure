import { ProviderKey, GenerateImageRequest, GenerateImageResponse } from '../types/api';
import { ReplicateProvider } from './replicate';

export { ReplicateProvider } from './replicate';

export interface Provider {
  generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse>;
}

export class ProviderFactory {
  private static getProviderInstance(provider: ProviderKey, apiKey: string): Provider {
    switch (provider) {
      case 'replicate':
        return new ReplicateProvider(apiKey);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  static async generateImage(
    provider: ProviderKey,
    request: GenerateImageRequest,
    apiKey: string
  ): Promise<GenerateImageResponse> {
    const providerInstance = this.getProviderInstance(provider, apiKey);
    return providerInstance.generateImage(request);
  }

  static getProvider(provider: ProviderKey, apiKey: string): Provider {
    return this.getProviderInstance(provider, apiKey);
  }
} 