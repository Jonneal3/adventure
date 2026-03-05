import Replicate from 'replicate';
import { GenerateImageRequest, GenerateImageResponse } from '../types/api';

export class ReplicateProvider {
  private replicate: Replicate;

  constructor(apiKey: string) {
    this.replicate = new Replicate({
      auth: apiKey,
    });
  }

  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    try {
      const {
        prompt,
        modelId = 'black-forest-labs/flux-1.1-pro',
        negativePrompt,
        width = 1024,
        height = 1024,
        numOutputs = 1,
        guidanceScale = 7.5,
        numInferenceSteps = 20,
      } = request;

      // Prepare input parameters based on model requirements
      const input: any = {
        prompt,
        num_outputs: numOutputs,
        guidance_scale: guidanceScale,
      };

      // Handle model-specific parameter constraints
      if (modelId.includes('flux-schnell')) {
        // flux-schnell has strict requirements
        input.num_inference_steps = Math.min(numInferenceSteps, 4);
        input.aspect_ratio = this.getAspectRatio(width, height);
      } else if (modelId.includes('flux-1.1-pro') || modelId.includes('flux-pro') || modelId.includes('flux-kontext')) {
        // FLUX models support custom dimensions
        input.width = width;
        input.height = height;
        input.num_inference_steps = numInferenceSteps;
      } else {
        // Default for other models
        input.width = width;
        input.height = height;
        input.num_inference_steps = numInferenceSteps;
      }

      // Add negative prompt if provided
      if (negativePrompt) {
        input.negative_prompt = negativePrompt;
      }

      const prediction = await this.replicate.predictions.create({
        ...(String(modelId).includes(':') ? { version: modelId } : { model: modelId }),
        input,
      });

      return {
        predictionId: prediction.id,
        status: prediction.status,
        images: prediction.output ? (Array.isArray(prediction.output) ? prediction.output : [prediction.output]) : [],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async waitForPrediction(predictionId: string, timeoutMs: number = 60000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const prediction = await this.replicate.predictions.get(predictionId);
        
        if (prediction.status === 'succeeded') {
          return {
            status: prediction.status,
            output: prediction.output,
          };
        } else if (prediction.status === 'failed') {
          return {
            status: prediction.status,
            error: prediction.error || 'Prediction failed',
          };
        }
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    return {
      status: 'timeout',
      error: 'Prediction timed out',
    };
  }

  private getAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    
    // Define supported aspect ratios for flux-schnell
    const ratios: { [key: string]: number } = {
      '1:1': 1,
      '16:9': 16/9,
      '21:9': 21/9,
      '3:2': 3/2,
      '2:3': 2/3,
      '4:5': 4/5,
      '5:4': 5/4,
      '3:4': 3/4,
      '4:3': 4/3,
      '9:16': 9/16,
      '9:21': 9/21,
    };

    // Find the closest supported ratio
    let closestRatio = '1:1';
    let minDifference = Math.abs(ratio - 1);

    for (const [ratioStr, ratioValue] of Object.entries(ratios)) {
      const difference = Math.abs(ratio - ratioValue);
      if (difference < minDifference) {
        minDifference = difference;
        closestRatio = ratioStr;
      }
    }

    return closestRatio;
  }
} 