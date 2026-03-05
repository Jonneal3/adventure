"use client";

import { useState, useCallback } from "react";
import { ProviderKey } from "@mage/lib/provider-config";
import { ProviderTiming } from "@mage/lib";

interface ImageResult {
  provider: ProviderKey;
  image: string | null;
  modelId: string;
}

export function useImageGeneration() {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [timings, setTimings] = useState<Partial<Record<ProviderKey, ProviderTiming>>>({});
  const [failedProviders, setFailedProviders] = useState<ProviderKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string>("");

  const startGeneration = useCallback(
    async (
      prompt: string,
      providers: ProviderKey[],
      providerToModel: Record<ProviderKey, string>
    ) => {
      setIsLoading(true);
      setActivePrompt(prompt);
      setImages([]);
      setFailedProviders([]);
      setTimings({});

      const promises = providers.map(async (provider) => {
        const startTime = Date.now();
        setTimings(prev => ({
          ...prev,
          [provider]: { startTime }
        }));

        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
              provider,
              model: providerToModel[provider],
            }),
          });

          const completionTime = Date.now();
          const elapsed = completionTime - startTime;

          setTimings(prev => ({
            ...prev,
            [provider]: { startTime, completionTime, elapsed }
          }));

          if (response.ok) {
            const data = await response.json();
            setImages(prev => [...prev, {
              provider,
              image: data.image,
              modelId: providerToModel[provider],
            }]);
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          setFailedProviders(prev => [...prev, provider]);

          const completionTime = Date.now();
          const elapsed = completionTime - startTime;
          setTimings(prev => ({
            ...prev,
            [provider]: { startTime, completionTime, elapsed }
          }));
        }
      });

      await Promise.allSettled(promises);
      setIsLoading(false);
    },
    []
  );

  return {
    images,
    timings,
    failedProviders,
    isLoading,
    startGeneration,
    activePrompt,
  };
} 