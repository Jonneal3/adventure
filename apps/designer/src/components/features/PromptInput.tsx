"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowUp, RefreshCw } from "lucide-react";
import { getRandomSuggestions, Suggestion } from "@/lib/suggestions";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import { DesignSettings } from "@/types";

type QualityMode = "performance" | "quality";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  showProviders: boolean;
  onToggleProviders: () => void;
  mode: QualityMode;
  onModeChange: (mode: QualityMode) => void;
  suggestions: Suggestion[];
  config?: DesignSettings;
}

export function PromptInput({
  suggestions: initSuggestions,
  isLoading,
  onSubmit,
  config,
}: PromptInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initSuggestions);

  const updateSuggestions = () => {
    setSuggestions(getRandomSuggestions());
  };
  const handleSuggestionSelect = (prompt: string) => {
    setInput(prompt);
    onSubmit(prompt);
  };

  const handleSubmit = () => {
    if (!isLoading && input.trim()) {
      onSubmit(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSubmit(input);
      }
    }
  };

  const promptBackgroundColor = config?.prompt_input_background_color || config?.prompt_background_color || "#f9fafb";
  const promptTextColor = config?.prompt_input_text_color || config?.prompt_text_color || "#1e293b";
  const promptPlaceholderColor = config?.prompt_input_placeholder_color || config?.prompt_placeholder_color || "#64748b";
  const promptBorderColor = config?.prompt_input_border_color || config?.prompt_border_color || "#e5e7eb";
  const promptBorderRadius = config?.prompt_input_border_radius || config?.prompt_border_radius || 12;
  const promptBorderWidth = config?.prompt_input_border_width || config?.prompt_border_width || 1;
  const promptBorderStyle = config?.prompt_input_border_style || config?.prompt_border_style || "solid";

  return (
    <div className="w-full mb-8">
      <div 
        className="rounded-xl p-4"
        style={{
          backgroundColor: promptBackgroundColor,
          border: `${promptBorderWidth}px ${promptBorderStyle} ${promptBorderColor}`,
          borderRadius: `${promptBorderRadius}px`,
        }}
      >
        <div className="flex flex-col gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt here"
            rows={3}
            className="text-base bg-transparent border-none p-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
            style={{ 
              width: '100%', 
              minWidth: '100%',
              color: promptTextColor,
              '--placeholder-color': promptPlaceholderColor,
            } as React.CSSProperties}
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center justify-between space-x-2">
              <button
                onClick={updateSuggestions}
                className="flex items-center justify-between px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200"
              >
                <RefreshCw className="w-4 h-4 group-hover:opacity-70" style={{ color: promptPlaceholderColor }} />
              </button>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion.prompt || suggestion.text)}
                  className={cn(
                    "flex items-center justify-between px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200",
                    index > 2
                      ? "hidden md:flex"
                      : index > 1
                        ? "hidden sm:flex"
                        : "",
                  )}
                >
                  <span>
                    <span className="text-xs sm:text-sm" style={{ color: promptTextColor }}>
                      {suggestion.text.toLowerCase()}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-1 h-2 w-2 sm:h-3 sm:w-3 group-hover:opacity-70" style={{ color: promptPlaceholderColor }} />
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-50"
              style={{ backgroundColor: config?.submit_button_background_color || "#000000" }}
            >
              {isLoading ? (
                <Spinner className="w-3 h-3 text-white" />
              ) : (
                <ArrowUp className="w-5 h-5" style={{ color: config?.submit_button_text_color || "#ffffff" }} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
