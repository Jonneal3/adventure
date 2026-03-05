"use client";

import { useState } from "react";
import { ModelSelect } from "./ModelSelect";
import { PromptInput } from "./PromptInput";
import { ModelCardCarousel } from "./ModelCardCarousel";
import {
  MODEL_CONFIGS,
  PROVIDERS,
  PROVIDER_ORDER,
  ProviderKey,
  ModelMode,
  initializeProviderRecord,
} from "@/lib/provider-config";
import { Suggestion } from "@/lib/suggestions";
import { useImageGeneration } from "@/hooks/use-image-generation";
import { Header } from "./Header";

export function ImagePlayground({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const {
    images,
    timings,
    failedProviders,
    isLoading,
    startGeneration,
    activePrompt,
  }: {
    images: { provider: ProviderKey; image: string | null; modelId: string }[];
    timings: Partial<Record<ProviderKey, any>>;
    failedProviders: ProviderKey[];
    isLoading: boolean;
    startGeneration: (
      prompt: string,
      providers: ProviderKey[],
      providerToModel: Record<ProviderKey, string>
    ) => void;
    activePrompt: string;
  } = useImageGeneration();

  const [showProviders, setShowProviders] = useState(true);
  const [selectedModels, setSelectedModels] = useState<Record<ProviderKey, string>>({
    replicate: MODEL_CONFIGS.performance.replicate,
    vertex: MODEL_CONFIGS.performance.vertex,
    openai: MODEL_CONFIGS.performance.openai,
    fireworks: MODEL_CONFIGS.performance.fireworks,
  } as Record<ProviderKey, string>);
  const [enabledProviders, setEnabledProviders] = useState<Record<ProviderKey, boolean>>(
    initializeProviderRecord(true),
  );
  const [mode, setMode] = useState<ModelMode>("performance");
  const toggleView = () => {
    setShowProviders((prev) => !prev);
  };

  const handleModeChange = (newMode: ModelMode) => {
    setMode(newMode);
    setSelectedModels({
      replicate: MODEL_CONFIGS[newMode].replicate,
      vertex: MODEL_CONFIGS[newMode].vertex,
      openai: MODEL_CONFIGS[newMode].openai,
      fireworks: MODEL_CONFIGS[newMode].fireworks,
    });
    setShowProviders(true);
  };

  const handleModelChange = (providerKey: ProviderKey, model: string) => {
    setSelectedModels((prev) => ({ ...prev, [providerKey]: model }));
  };

  const handleProviderToggle = (provider: string, enabled: boolean) => {
    setEnabledProviders((prev) => ({
      ...prev,
      [provider]: enabled,
    }));
  };

  const providerToModel: Record<ProviderKey, string> = {
    replicate: selectedModels.replicate,
    vertex: selectedModels.vertex,
    openai: selectedModels.openai,
    fireworks: selectedModels.fireworks,
  };

  const handlePromptSubmit = (newPrompt: string) => {
    const activeProviders = PROVIDER_ORDER.filter((p) => enabledProviders[p]);
    if (activeProviders.length > 0) {
      startGeneration(newPrompt, activeProviders, providerToModel);
    }
    setShowProviders(false);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <PromptInput
          onSubmit={handlePromptSubmit}
          isLoading={isLoading}
          showProviders={showProviders}
          onToggleProviders={toggleView}
          mode={mode}
          onModeChange={handleModeChange}
          suggestions={suggestions}
        />
        <>
          {(() => {
            const getModelProps = () =>
              (Object.keys(PROVIDERS) as ProviderKey[]).map((key) => {
                const provider = PROVIDERS[key];
                const imageItem = images.find((img) => img.provider === key);
                const imageData = imageItem?.image;
                const modelId = imageItem?.modelId ?? "N/A";
                const timing = timings[key];

                return {
                  label: provider.displayName,
                  models: provider.models,
                  value: selectedModels[key],
                  providerKey: key,
                  onChange: (model: string, providerKey: ProviderKey) =>
                    handleModelChange(providerKey, model),
                  iconPath: provider.iconPath,
                  color: provider.color,
                  enabled: enabledProviders[key],
                  onToggle: (enabled: boolean) =>
                    handleProviderToggle(key, enabled),
                  image: imageData,
                  modelId,
                  timing,
                  failed: failedProviders.includes(key),
                };
              });

            return (
              <>
                <div className="md:hidden">
                  <ModelCardCarousel models={getModelProps()} />
                </div>
                <div className="hidden md:grid md:grid-cols-2 2xl:grid-cols-4 gap-8">
                  {getModelProps().map((props) => (
                    <ModelSelect key={props.label} {...props} />
                  ))}
                </div>
                {activePrompt && activePrompt.length > 0 && (
                  <div className="text-center mt-4 text-muted-foreground">
                    {activePrompt}
                  </div>
                )}
              </>
            );
          })()}
        </>
      </div>
    </div>
  );
}
