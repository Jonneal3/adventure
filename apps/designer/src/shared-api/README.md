# Shared API Package

This package provides a unified interface for external AI image generation APIs that can be used across both the designer and widget apps.

## Features

- **Replicate Provider**: Support for Replicate's AI models
- **OpenAI Provider**: Support for DALL-E 2 and DALL-E 3
- **Unified Interface**: Consistent API across all providers
- **Type Safety**: Full TypeScript support
- **Error Handling**: Robust error handling and validation

## Installation

This package is part of the workspace and should be installed automatically when you run `npm install` in the root directory.

## Usage

### Basic Usage

```typescript
import { ProviderFactory, GenerateImageRequest } from '@shared/api';

const request: GenerateImageRequest = {
  prompt: "A beautiful sunset over mountains",
  provider: "replicate",
  modelId: "stability-ai/stable-diffusion-3.5-large",
  width: 1024,
  height: 1024,
  numOutputs: 1
};

const apiKey = process.env.REPLICATE_API_KEY;
const response = await ProviderFactory.generateImage("replicate", request, apiKey);
```

### Using Individual Providers

```typescript
import { ReplicateProvider } from '@shared/api';

const replicate = new ReplicateProvider(process.env.REPLICATE_API_KEY);
const response = await replicate.generateImage(request);
```

### Checking Prediction Status (Replicate)

```typescript
import { ReplicateProvider } from '@shared/api';

const replicate = new ReplicateProvider(process.env.REPLICATE_API_KEY);

// Start a prediction
const response = await replicate.generateImage(request);

if (response.predictionId) {
  // Check status
  const prediction = await replicate.getPrediction(response.predictionId);
  
  // Wait for completion
  const finalPrediction = await replicate.waitForPrediction(response.predictionId);
}
```

## Environment Variables

Set these environment variables in your app:

- `REPLICATE_API_KEY`: Your Replicate API key
- `OPENAI_API_KEY`: Your OpenAI API key

## Available Models

### Replicate Models
- `stability-ai/stable-diffusion-3.5-large`
- `stability-ai/stable-diffusion-3.5-large-turbo`
- `black-forest-labs/flux-1.1-pro`
- `black-forest-labs/flux-1.1-pro-ultra`
- And many more...

### OpenAI Models
- `dall-e-2`
- `dall-e-3`

## Development

To build the package:

```bash
cd packages/shared-api
npm run build
```

To watch for changes during development:

```bash
cd packages/shared-api
npm run dev
``` 