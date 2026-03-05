"use client";

import React, { useState, useEffect, useRef } from "react";

import { getSuggestions, Suggestion } from "../../lib/suggestions";
import { DesignSettings } from "../../types";
import { useToast } from "../../hooks";
import { LeadCaptureModal } from "./LeadCaptureModal";
import { useShopifyContext } from "@/hooks/use-shopify-context";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Import layout components
import { LeftRightLayout } from "./layouts/LeftRightLayout";
import { RightLeftLayout } from "./layouts/RightLeftLayout";
import { PromptBottomLayout } from "./layouts/PromptBottomLayout";
import { PromptTopLayout } from "./layouts/PromptTopLayout";
import { MobileLayout } from "./layouts/MobileLayout";

interface InstanceData {
  id: string;
  submission_limit_enabled: boolean;
  max_submissions_per_session: number;
  current_submissions: number;
  last_submission_at: string | null;
  config?: DesignSettings;
  [key: string]: any;
}

interface MainWidgetSectionProps {
  config: DesignSettings;
  instanceId: string;
  containerWidth: number;
  fullPage: boolean;
  deployment: boolean;
  instanceData: InstanceData | null;
  isIframe: boolean;
}

export const MainWidgetSection = React.memo(({
  config,
  instanceId,
  containerWidth,
  fullPage,
  deployment,
  instanceData,
  isIframe
}: MainWidgetSectionProps) => {
  const reduceMotion = useReducedMotion();
  
  
  // Sample images to display by default (only used when no instanceId is provided)
  const sampleImages = [
    { image: "/homepage/example0001.png" },
    { image: "/homepage/example0002.png" },
    { image: "/homepage/example0003.png" },
    { image: "/homepage/example0004.png" },
    { image: "/homepage/example0005.png" },
    { image: "/homepage/example0006.png" },
    { image: "/homepage/example0007.png" },
    { image: "/homepage/example0008.png" },
  ];

  // State
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  
  // For designer preview, show placeholder slots instead of empty array
  const isDesignerPreview = !deployment && !!instanceId;
  const useLocalSamples =
    config.gallery_show_placeholder_images === true &&
    ((!instanceId) || (isDesignerPreview && config.demo_enabled !== false));
  // IMPORTANT: don't initialize with samples synchronously, or we can paint a single frame
  // before config/preview flags settle (visible "flash"). We'll add samples via effect instead.
  const [generatedImages, setGeneratedImages] = useState<Array<{ image: string | null }>>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isSubmissionLimitReached, setIsSubmissionLimitReached] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const shouldGateWithImmediateLead =
    config.lead_capture_enabled && (config as any).lead_capture_trigger === "immediate" && !hasSubmitted;
  const [showLeadModal, setShowLeadModal] = useState(shouldGateWithImmediateLead);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoRegenerateNonce, setAutoRegenerateNonce] = useState(0);
  const shopify = useShopifyContext();
  const shopifyImagesAppliedRef = React.useRef(false);
  // Measured gallery aspect ratio from layouts (e.g., '16:9', '4:3')
  const [measuredAspect, setMeasuredAspect] = useState<string | null>(null);
  // Prevent duplicate submissions in quick succession
  const isSubmittingRef = useRef(false);
  const autoRegenerateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSubmitRef = useRef<(e: React.FormEvent, fromLeadCapture?: boolean) => void>(() => {});
  
  // If Shopify mode is active, never show default sample images
  useEffect(() => {
    if (shopify?.isShopify) {
      setGeneratedImages(prev => {
        // If prev are our sample images (local paths), clear them
        const areSamples = prev.length > 0 && prev.every(img => typeof img.image === 'string' && (img.image || '').startsWith('/homepage/'));
        return areSamples ? [] : prev;
      });
    }
  }, [shopify?.isShopify]);

  // If demo/sample gallery is disabled in designer preview, never show local sample images
  useEffect(() => {
    if (!isDesignerPreview) return;
    if (config.demo_enabled !== false && config.gallery_show_placeholder_images === true) return;
    setGeneratedImages((prev) => {
      const areSamples =
        prev.length > 0 &&
        prev.every((img) => typeof img.image === "string" && (img.image || "").startsWith("/homepage/"));
      return areSamples ? [] : prev;
    });
  }, [isDesignerPreview, config.demo_enabled, config.gallery_show_placeholder_images]);

  // If local samples are enabled (homepage or designer preview), populate them once.
  useEffect(() => {
    if (!useLocalSamples) return;
    // Avoid stomping real generated images.
    setGeneratedImages((prev) => (prev.length === 0 ? sampleImages : prev));
  }, [useLocalSamples]);

  const { toast } = useToast();
  const componentId = React.useMemo(() => `widget-${instanceId}`, [instanceId]);

  // Enforce uploader_max_images based on instance use_case:
  // - tryon: allow multiple (default to 4 if unset)
  // - scene-placement: allow multiple (config-based, default to 4 if unset)
  // - scene: force single image
  const instanceUseCase: string | undefined = (instanceData as any)?.use_case;
  const effectiveUploaderMaxImages =
    instanceUseCase === 'tryon' || instanceUseCase === 'scene-placement'
      ? (config.uploader_max_images ?? 4)
      : 1;
  const configWithUseCase = React.useMemo(() => ({
    ...config,
    uploader_max_images: effectiveUploaderMaxImages,
  }), [config, effectiveUploaderMaxImages]);

  // Ensure reference images are URLs by uploading any data URLs via server (service role)
  const ensureReferenceImageUrls = async (images: string[]): Promise<string[]> => {
    const results: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (typeof img === 'string' && img.startsWith('data:')) {
        try {
          // Delegate upload to server to avoid anon permission issues
          const res = await fetch('/api/upload-reference-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId, image: img })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('❌ Upload API error:', err);
            // If payload is too large, do NOT fallback to data URL – it will also 413 on generate.
            if (res.status === 413 || (err?.error && String(err.error).includes('Request Entity Too Large'))) {
              toast({
                title: 'Image too large',
                description: 'Please upload a smaller image (try under ~4 MB).',
                variant: 'destructive'
              });
              // Skip adding this image
              continue;
            }
            // For other upload errors, fall back to using the original data URL
            toast({
              title: 'Upload failed',
              description: err?.error || 'Could not attach reference image. Using local image instead.',
              variant: 'destructive'
            });
            results.push(img);
            continue;
          }
          const data = await res.json();
          if (data?.url) results.push(data.url);
        } catch (err) {
          console.error('❌ Failed to process reference image:', err);
          toast({
            title: 'Image error',
            description: 'Could not process reference image. Using local image instead.',
            variant: 'destructive'
          });
          // Fallback to original data URL on unexpected error
          results.push(img);
        }
      } else if (typeof img === 'string') {
        results.push(img);
      }
    }
    return results;
  };

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Support `?fresh=1` resets (used by /adventure too).
  // This mirrors the AI form behavior: a "fresh" load should act like a new session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const isFresh = sp.get("fresh") === "1" || sp.get("fresh") === "true";
      if (!isFresh) return;
      // Clear widget session-scoped keys.
      try { sessionStorage.removeItem(`submission_count_${instanceId}`); } catch {}
      try { sessionStorage.removeItem(`has_generated_${instanceId}`); } catch {}
      // Best-effort clear lead capture local form draft for this instance too.
      try { localStorage.removeItem(`lead_form_data_${instanceId}`); } catch {}
      try { localStorage.removeItem(`lead_submitted_${instanceId}`); } catch {}
      // Reset local state so the UI reflects the cleared storage immediately.
      setSubmissionCount(0);
      setIsSubmissionLimitReached(false);
      setGeneratedImages([]);
      setError(null);
    } catch {}
    // Only run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show lead modal immediately if configured and not yet submitted
  useEffect(() => {
    if (!isClient) return;
    if (shouldGateWithImmediateLead && !showLeadModal) setShowLeadModal(true);
  }, [isClient, shouldGateWithImmediateLead, showLeadModal]);

  // Load suggestions when component mounts
  useEffect(() => {
    const loadSuggestions = async () => {
      if (instanceId) {
        try {
          const suggestions = await getSuggestions(
            instanceId, 
            config.suggestions_count || 4
          );
          setSuggestions(suggestions);
        } catch (error) {
          console.error('Error loading suggestions:', error);
          setSuggestions([]);
        }
      }
    };

    loadSuggestions();
  }, [instanceId, config.suggestions_count]);

  // If Shopify context provides product images, add them to referenceImages once on load
  // Use effectiveUploaderMaxImages to respect use_case (tryon/scene-placement allow multiple, scene forces 1)
  useEffect(() => {
    if (shopifyImagesAppliedRef.current) return;
    if (!shopify || !shopify.images || shopify.images.length === 0) return;
    const maxImages = effectiveUploaderMaxImages;
    const uniq = Array.from(new Set(shopify.images));
    const toAdd = uniq.slice(0, Math.max(0, maxImages));
    if (toAdd.length > 0) {
      // Normalize scheme-less URLs
      const normalized = Array.from(new Set(
        toAdd.map((u) => (typeof u === 'string' && u.startsWith('//') ? `https:${u}` : u))
      ));
      setReferenceImages((prev) => {
        if (prev.length > 0) return prev; // respect user uploads if already present
        return normalized;
      });
      shopifyImagesAppliedRef.current = true;
    }
  }, [shopify, effectiveUploaderMaxImages, generatedImages.length]);

  // Add event listener for addToUploader
  useEffect(() => {
    const handleAddToUploader = (e: Event) => {
      const customEvent = e as CustomEvent<{ image: string }>;
      if (customEvent.detail?.image) {
        const effectiveMaxImages = config.uploader_max_images ?? 1;
        setReferenceImages(prev => {
          if (prev.length >= effectiveMaxImages) {
            return prev; // Don't add if already at max
          }
          return [...prev, customEvent.detail.image];
        });
      }
    };

    const element = document.getElementById(componentId);
    if (element) {
      element.addEventListener('addToUploader', handleAddToUploader);
      return () => {
        element.removeEventListener('addToUploader', handleAddToUploader);
      };
    }
  }, [componentId, config.uploader_max_images]);

  // Initialize submission count from session storage
  useEffect(() => {
    if (!isClient) return;
    const count = sessionStorage.getItem(`submission_count_${instanceId}`);
    const initialCount = count ? parseInt(count, 10) : 0;
  
    setSubmissionCount(initialCount);
  }, [isClient, instanceId, instanceData?.max_submissions_per_session]);

  // Update submission limit state when instance data changes
  useEffect(() => {
    if (instanceData) {
      const maxSubmissions = instanceData.max_submissions_per_session;
      const currentCount = getSubmissionCount();

      setIsSubmissionLimitReached(currentCount >= maxSubmissions);
    }
  }, [instanceData, submissionCount]); // Add submissionCount to dependencies

  const getSubmissionCount = () => {
    if (!isClient) return 0;
    const count = sessionStorage.getItem(`submission_count_${instanceId}`);
    const parsedCount = count ? parseInt(count, 10) : 0;

    return parsedCount;
  };

  const getSubmissionCountForDisplay = () => {
    const raw = getSubmissionCount();
    const max = instanceData?.max_submissions_per_session;
    if (typeof max === "number" && max > 0) {
      return Math.min(Math.max(0, raw), max);
    }
    return raw;
  };

  const incrementSubmissionCount = () => {
    const currentCount = getSubmissionCount();
    const newCount = currentCount + 1;

    sessionStorage.setItem(`submission_count_${instanceId}`, newCount.toString());
    setSubmissionCount(newCount);
    
    // Force a re-render by updating the refresh trigger
    setRefreshTrigger(prev => prev + 1);
  };

	  const handleSubmit = async (e: React.FormEvent, fromLeadCapture: boolean = false) => {
	    e.preventDefault();
	    if (isSubmittingRef.current) return;
	    isSubmittingRef.current = true;
	    let startedGenerating = false;
	    try {
	      // Show lead capture modal if enabled and trigger is 'submit' and this is the first submission
	      if (config.lead_capture_enabled && ((config as any).lead_capture_trigger ?? 'submit') === 'submit' && !hasSubmitted) {
	        setShowLeadModal(true);
	        return;
      }

      if (!prompt.trim()) {
        return;
      }

      // Check submission limit BEFORE generation (but don't increment yet)
      const currentSessionCount = getSubmissionCount();
      const maxSubmissions = instanceData?.max_submissions_per_session ?? 0;
      
      if (instanceData?.submission_limit_enabled && maxSubmissions > 0 && currentSessionCount >= maxSubmissions) {
        setIsSubmissionLimitReached(true);
        
        // Show subtle toast notification
        toast({
          title: "Limit reached",
          description: `${maxSubmissions}/${maxSubmissions} submissions used`,
          variant: "default",
          duration: 2000 // Show for 2 seconds
        });
        
        return;
      }

      // Preflight credits: ensure enough for this request (attempts auto top-up)
      const requiredCredits = config.gallery_max_images || 1;
      try {
        const preflight = await fetch(`/api/leads/availability/${instanceId}?required=${requiredCredits}`);
        if (preflight.ok) {
          const availability = await preflight.json();
          if (!availability?.hasEnough) {
            const need = availability?.required ?? requiredCredits;
            const have = availability?.currentBalance ?? 0;
            setError(`Insufficient credits. You need ${need} credits but only have ${have}.`);
            toast({
              title: "Insufficient Credits",
              description: availability?.toppedUp ? "Auto-reload attempted but credits are still insufficient." : "Auto-reload not available. Please add credits.",
              variant: "destructive",
              duration: 4000
            });
            return;
          }
        }
      } catch {
        // Fail open: proceed to server which enforces as well
      }

      startedGenerating = true;
      setIsGenerating(true);
      setError(null);

      // Transform any data URL reference images into hosted URLs to avoid large JSON bodies
      console.log('🖼️ [MainWidgetSection] Before ensureReferenceImageUrls:', {
        referenceImagesCount: referenceImages.length,
        referenceImages: referenceImages.map(img => typeof img === 'string' ? (img.startsWith('data:') ? 'data:...' : img.substring(0, 50)) : typeof img)
      });
      const referenceImagesToSend = await ensureReferenceImageUrls(referenceImages);
      console.log('🖼️ [MainWidgetSection] After ensureReferenceImageUrls:', {
        referenceImagesToSendCount: referenceImagesToSend.length,
        referenceImagesToSend: referenceImagesToSend.map(img => img.substring(0, 50))
      });
      const uc = (instanceData as any)?.use_case;

      // Allow prompt-only generation (no upload required). If an image is provided, we pass it through.
      const requestBody: any = {
        prompt,
        instanceId,
        // Only include referenceImages if it has items (avoid sending empty arrays)
        ...(referenceImagesToSend.length > 0 && { referenceImages: referenceImagesToSend }),
        // Pass designer settings to control number of outputs
        gallery_max_images: config.gallery_max_images || 1,
        numOutputs: config.gallery_max_images || 1,
        // Use measured aspect only for scene (Flux); let nano-banana match input image
        aspectRatio: (uc === 'scene') ? (measuredAspect || undefined) : undefined,
        // Prefer jpg for nano-banana (try-on, scene-placement)
        outputFormat: (uc === 'tryon' || uc === 'scene-placement') ? 'jpg' : undefined
      };
      // Provide explicit role hints for providers that use them
      if (uc === 'tryon' && referenceImagesToSend.length >= 2) {
        // Heuristic: first is user, second is product
        requestBody.userImage = referenceImagesToSend[0];
        requestBody.productImage = referenceImagesToSend[1];
      }
      if (uc === 'scene-placement' && referenceImagesToSend.length >= 2) {
        // Heuristic: first is scene, second is product
        requestBody.sceneImage = referenceImagesToSend[0];
        requestBody.productImage = referenceImagesToSend[1];
      }
      // For 'scene' use case (Flux): exactly ONE input image
      if ((uc === 'scene' || !uc) && referenceImagesToSend.length >= 1) {
        // First reference image becomes the single scene image
        requestBody.sceneImage = referenceImagesToSend[0];
        console.log('✅ [MainWidgetSection] Set sceneImage for scene use case (single-image Flux)');
      }
      // Route by use case
      // Note: drilldown is ONLY for DrillDownModal (clicking on generated images), not for main submissions
      const endpoint =
        uc === 'tryon'
          ? '/api/generate/try-on'
          : uc === 'scene-placement'
          ? '/api/generate/scene-placement'
          : '/api/generate/scene';
      
      // Log request details for debugging
      console.log('📤 [MainWidgetSection] Sending request:', {
        endpoint,
        useCase: uc,
        instanceId,
        hasPrompt: !!prompt,
        promptPreview: prompt?.substring(0, 50),
        referenceImagesCount: referenceImagesToSend.length,
        hasSceneImage: !!requestBody.sceneImage,
        hasProductImage: !!requestBody.productImage,
        hasUserImage: !!requestBody.userImage,
        requestBodyKeys: Object.keys(requestBody),
        requestBody: {
          ...requestBody,
          prompt: requestBody.prompt?.substring(0, 100),
          referenceImages: requestBody.referenceImages ? `[${requestBody.referenceImages.length} images]` : undefined,
          sceneImage: requestBody.sceneImage ? '[present]' : undefined,
          productImage: requestBody.productImage ? '[present]' : undefined,
          userImage: requestBody.userImage ? '[present]' : undefined
        }
      });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const clone = response.clone();
        const errorData = await clone.json().catch(async () => {
          const text = await response.text().catch(() => '');
          try { return JSON.parse(text); } catch { return { error: text || 'Unknown error' }; }
        });
        console.error('❌ [MainWidgetSection] API error response:', {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          useCase: uc,
          errorData,
          requestSummary: {
            instanceId,
            hasPrompt: !!prompt,
            referenceImagesCount: referenceImagesToSend.length,
            hasSceneImage: !!requestBody.sceneImage,
            hasProductImage: !!requestBody.productImage
          }
        });
        
        if (response.status === 413) {
          setError('Request too large. Try a smaller reference image.');
          toast({ title: 'Request too large', description: 'Please upload a smaller image.', variant: 'destructive' });
          return;
        }

        if (response.status === 402) {
          // 402 can mean "internal credits" OR upstream provider billing limit.
          if (errorData?.code === "provider_spend_limit") {
            const msg =
              typeof errorData?.error === "string" && errorData.error.trim()
                ? String(errorData.error).trim()
                : "Image generation is temporarily unavailable. Please try again later.";
            setError(msg);
            toast({
              title: "Generation unavailable",
              description: msg,
              variant: "destructive",
              duration: 4500,
            });
          } else {
            // Insufficient credits
            const errorMessage = `Insufficient credits. You need ${errorData.requiredCredits} credits but only have ${errorData.currentBalance}. Please contact the account owner to purchase more credits.`;
            setError(errorMessage);

            // Show toast notification for credit error
            toast({
              title: "Insufficient Credits",
              description: `Please contact the widget owner to upgrade their credit balance.`,
              variant: "destructive",
              duration: 4000 // Show for 4 seconds
            });
          }
        } else {
          setError(errorData.error || 'Failed to generate images');
        }
        return;
      }

      const data = await response.json();
      
      // Always use the images returned from the generation API
      if (data.images && data.images.length > 0) {
        const mappedImages = data.images.map((image: string) => ({ image }));
        setGeneratedImages(mappedImages);
        
        // INCREMENT SUBMISSION COUNT AFTER SUCCESSFUL GENERATION (but not from lead capture)
        if (!fromLeadCapture) {
          incrementSubmissionCount();
        }

        // Halfway trigger: show modal after a successful generation if not yet submitted
        if (config.lead_capture_enabled && (config as any).lead_capture_trigger === 'halfway' && !hasSubmitted) {
          setShowLeadModal(true);
        }
      } else {
        setGeneratedImages([]);
      }
      
      // Mark that user has generated something (for sample gallery state management)
      if (instanceId) {
        sessionStorage.setItem(`has_generated_${instanceId}`, 'true');
      }
      
      // Trigger gallery refresh to show new images
      const newRefreshTrigger = refreshTrigger + 1;
      setRefreshTrigger(newRefreshTrigger);
    } catch (error) {
      console.error('❌ [MainWidgetSection] Generation error:', error);
      // If it's our validation error, the error message is already set
      if (error instanceof Error && error.message.startsWith('BLOCKED:')) {
        // Error already set and toast shown in validation block
        console.log('🛑 [MainWidgetSection] Request blocked by validation');
      } else {
        setError('Failed to generate images. Please try again.');
      }
    } finally {
      if (startedGenerating) setIsGenerating(false);
      isSubmittingRef.current = false;
    }
  };

  // New function specifically for drill-down modal submissions
  const handleDrillDownSubmit = async (drillDownPrompt: string, selectedImage: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    let startedGenerating = false;
    try {
      if (!drillDownPrompt.trim()) {
        return;
      }

      // Check submission limit BEFORE generation
      const currentSessionCount = getSubmissionCount();
      const maxSubmissions = instanceData?.max_submissions_per_session ?? 0;
      
      if (instanceData?.submission_limit_enabled && maxSubmissions > 0 && currentSessionCount >= maxSubmissions) {
        setIsSubmissionLimitReached(true);
        
        toast({
          title: "Limit reached",
          description: `${maxSubmissions}/${maxSubmissions} submissions used`,
          variant: "default",
          duration: 2000
        });
        
        return;
      }

      // Preflight credits for drill-down (always 1 image)
      try {
        const preflight = await fetch(`/api/leads/availability/${instanceId}?required=1`);
        if (preflight.ok) {
          const availability = await preflight.json();
          if (!availability?.hasEnough) {
            const need = availability?.required ?? 1;
            const have = availability?.currentBalance ?? 0;
            setError(`Insufficient credits. You need ${need} credits but only have ${have}.`);
            toast({
              title: "Insufficient Credits",
              description: availability?.toppedUp ? "Auto-reload attempted but credits are still insufficient." : "Auto-reload not available. Please add credits.",
              variant: "destructive",
              duration: 4000
            });
            return;
          }
        }
      } catch {}

      startedGenerating = true;
      setIsGenerating(true);
      setError(null);

      const referenceImagesToSend = await ensureReferenceImageUrls([selectedImage]);
      // Enhance the prompt to emphasize micro changes
      const enhancedPrompt = `Make a small, subtle change to this image: ${drillDownPrompt}. Keep the overall composition, style, and most elements exactly the same. Only modify the specific aspect mentioned in the request.`;
      
      const requestBody = {
        prompt: enhancedPrompt,
        instanceId,
        selectedImage: selectedImage, // The image to edit
        referenceImages: referenceImagesToSend, // Ensure URL form
        outputFormat: 'jpg'
      };
      // Route drill-down to drilldown endpoint (nano-banana) - NEVER use scene or try-on
      console.log('🔍 [MainWidgetSection] Calling drilldown endpoint:', {
        endpoint: '/api/generate/drilldown',
        prompt: enhancedPrompt.substring(0, 50) + '...',
        referenceImagesCount: referenceImagesToSend.length,
        outputFormat: requestBody.outputFormat
      });
      const response = await fetch('/api/generate/drilldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const clone = response.clone();
        const errorData = await clone.json().catch(async () => {
          const text = await response.text().catch(() => '');
          try { return JSON.parse(text); } catch { return { error: text || 'Unknown error' }; }
        });
        console.error('❌ [MainWidgetSection] Drill-down API error:', errorData);
        
        if (response.status === 413) {
          setError('Request too large. Try a smaller reference image.');
          toast({ title: 'Request too large', description: 'Please upload a smaller image.', variant: 'destructive' });
          return;
        }

        if (response.status === 402) {
          if (errorData?.code === "provider_spend_limit") {
            const msg =
              typeof errorData?.error === "string" && errorData.error.trim()
                ? String(errorData.error).trim()
                : "Image generation is temporarily unavailable. Please try again later.";
            setError(msg);
            toast({
              title: "Generation unavailable",
              description: msg,
              variant: "destructive",
              duration: 4500,
            });
          } else {
            const errorMessage = `Insufficient credits. You need ${errorData.requiredCredits} credits but only have ${errorData.currentBalance}. Please contact the account owner to purchase more credits.`;
            setError(errorMessage);

            toast({
              title: "Insufficient Credits",
              description: `Please contact the widget owner to upgrade their credit balance.`,
              variant: "destructive",
              duration: 4000
            });
          }
        } else {
          setError(errorData.error || 'Failed to generate image modifications');
        }
        return;
      }

      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        const mappedImages = data.images.map((image: string) => ({ image }));
        setGeneratedImages(mappedImages);
        
        // Increment submission count for drill-down
        incrementSubmissionCount();
      } else {
        setGeneratedImages([]);
      }
      
      // Mark that user has generated something
      if (instanceId) {
        sessionStorage.setItem(`has_generated_${instanceId}`, 'true');
      }
      
      // Trigger gallery refresh
      const newRefreshTrigger = refreshTrigger + 1;
      setRefreshTrigger(newRefreshTrigger);
    } catch (error) {
      console.error('❌ [MainWidgetSection] Drill-down generation error:', error);
      setError('Failed to modify image. Please try again.');
    } finally {
      if (startedGenerating) setIsGenerating(false);
      isSubmittingRef.current = false;
    }
  };

  const handleLeadSubmit = async (data: { email: string; name?: string; phone?: string; isPartial?: boolean; keepModalOpen?: boolean }) => {
    try {
      // Prepare webhook payload with partial flag
      const webhookPayload = {
        lead_id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        form: {
          name: data.name || '',
          email: data.email,
          phone: data.phone || ''
        },
        source: {
          widget_id: instanceId,
          company_id: instanceData?.account_id,
          company_name: instanceData?.name,
          page_url: window.location.href
        },
        metadata: {
          is_partial: data.isPartial || false,
          submission_type: data.isPartial ? 'partial' : 'complete'
        }
      };

      // Send webhook if configured
      if (instanceData?.webhook_url) {
        try {
          const response = await fetch('/api/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhookUrl: instanceData.webhook_url,
              payload: webhookPayload,
              instanceId: instanceId
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Webhook error:', errorText);
          }
        } catch (webhookError) {
          console.error('❌ Webhook error:', webhookError);
          // Don't throw here, we still want to complete the lead submission
        }
      } else {
        // If no webhook URL, just save to database via our webhook API
        try {
          const response = await fetch('/api/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhookUrl: 'https://example.com/dummy', // Dummy URL, will be ignored
              payload: webhookPayload,
              instanceId: instanceId
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Database save error:', errorText);
          }
        } catch (dbError) {
          console.error('❌ Database save error:', dbError);
        }
      }

      // Only set hasSubmitted to true for complete submissions (step 2)
      if (!data.isPartial) {
        setHasSubmitted(true);
        setShowLeadModal(false);
        
        // Check submission limit before proceeding with generation
        if (instanceData?.submission_limit_enabled) {
          const currentSessionCount = getSubmissionCount();
          if (currentSessionCount >= instanceData.max_submissions_per_session) {
            setIsSubmissionLimitReached(true);
            toast({
              title: "Submission Limit Reached",
              description: `You've reached the maximum number of submissions (${instanceData.max_submissions_per_session}) for this session.`,
              variant: "destructive"
            });
            return;
          }
        }
        
        // Proceed with image generation for complete submissions
        if (prompt.trim()) {
          handleSubmit(new Event('submit') as any, true); // fromLeadCapture = true
        }
      } else {
        // For partial submissions, only close modal if not keeping it open
        if (!data.keepModalOpen) {
          setShowLeadModal(false);
        }
      }
    } catch (error) {
      console.error('Error submitting lead:', error);
      setError('Failed to submit lead. Please try again.');
    }
  };

  const handleImageUpload = (
    imageData: string | null,
    opts?: { suppressAutoRegenerate?: boolean; source?: string }
  ) => {
    if (imageData) {
      const effectiveMaxImages = config.uploader_max_images ?? 1;
      let didAdd = false;
      setReferenceImages(prev => {
        if (prev.length >= effectiveMaxImages) {
          return prev; // Don't add if already at max
        }
        didAdd = true;
        return [...prev, imageData];
      });
      if (didAdd && !opts?.suppressAutoRegenerate) {
        if (autoRegenerateTimerRef.current) {
          clearTimeout(autoRegenerateTimerRef.current);
        }
        autoRegenerateTimerRef.current = setTimeout(() => {
          setAutoRegenerateNonce(prev => prev + 1);
        }, 350);
      }
    }
  };

  const handleImageRemove = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setPrompt(suggestion.prompt || suggestion.text);
  };

  const refreshSuggestions = async () => {
    if (instanceId) {
      try {
        const suggestions = await getSuggestions(
          instanceId, 
          config.suggestions_count || 4
        );
        setSuggestions(suggestions);
      } catch (error) {
        console.error('Error refreshing suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    if (autoRegenerateNonce === 0) return;
    if (!prompt.trim()) return;
    if (isGenerating) return;
    if (config.lead_capture_enabled && ((config as any).lead_capture_trigger ?? 'submit') === 'submit' && !hasSubmitted) {
      return;
    }
    handleSubmitRef.current(new Event('submit') as unknown as React.FormEvent, false);
  }, [autoRegenerateNonce, config.lead_capture_enabled, hasSubmitted, isGenerating, prompt, config]);

  useEffect(() => {
    return () => {
      if (autoRegenerateTimerRef.current) clearTimeout(autoRegenerateTimerRef.current);
    };
  }, []);





  // Layout component selector
  const getLayoutComponent = () => {
    // Handle reset to sample gallery
    const handleResetToSampleGallery = () => {
      setGeneratedImages([]); // Clear generated images
      setIsGenerating(false);
      setError(null);
      // This will allow the ImageGallery to show sample gallery images
    };
    
    // Handle gallery generation for subcategories
    const handleGenerateGallery = () => {
      // This would typically open a modal or navigate to a gallery generation page
      // For now, we'll just show a toast message
      toast({
        title: "Gallery Generation",
        description: "Please use the designer interface to generate placeholder images for this subcategory.",
        variant: "default",
      });
    };
    
    // Smart responsive scaling - creates scaled design settings based on container width
    const getResponsiveConfig = (originalConfig: DesignSettings, containerWidth: number): DesignSettings => {
      // Calculate scale factor based on container width
      // 1.0 at 1200px+, scales down to 0.5 at 300px (more aggressive)
      const minWidth = 300;
      const maxWidth = 1200;
      const minScale = 0.5; // More aggressive minimum scale
      const maxScale = 1.0;
      
      const scaleFactor = Math.max(minScale, Math.min(maxScale, 
        minScale + (maxScale - minScale) * (containerWidth - minWidth) / (maxWidth - minWidth)
      ));

      // For very small elements, use even more aggressive scaling
      const smallElementScale = Math.max(0.4, scaleFactor * 0.8); // Extra aggressive for small text
      // Create scaled config by applying scale factor to size-related properties
      const scaledConfig = { ...originalConfig };
      
      // Scale main fonts (less aggressive for readability)
      if (originalConfig.prompt_font_size) scaledConfig.prompt_font_size = Math.max(11, originalConfig.prompt_font_size * scaleFactor);
      if (originalConfig.brand_name_font_size) scaledConfig.brand_name_font_size = Math.max(14, originalConfig.brand_name_font_size * scaleFactor);
      if (originalConfig.uploader_font_size) scaledConfig.uploader_font_size = Math.max(10, originalConfig.uploader_font_size * scaleFactor);
      
      // Scale logo size
      if (originalConfig.logo_height) scaledConfig.logo_height = Math.max(24, originalConfig.logo_height * scaleFactor);
      
      // Scale small elements more aggressively
      if (originalConfig.suggestion_font_size) scaledConfig.suggestion_font_size = Math.max(8, originalConfig.suggestion_font_size * smallElementScale);
      
      // Scale border radius (more aggressive)
      if (originalConfig.prompt_border_radius) scaledConfig.prompt_border_radius = Math.max(4, originalConfig.prompt_border_radius * scaleFactor);
      if (originalConfig.suggestion_border_radius) scaledConfig.suggestion_border_radius = Math.max(3, originalConfig.suggestion_border_radius * smallElementScale);
      if (originalConfig.uploader_border_radius) scaledConfig.uploader_border_radius = Math.max(4, originalConfig.uploader_border_radius * scaleFactor);
      if (originalConfig.gallery_border_radius) scaledConfig.gallery_border_radius = Math.max(4, originalConfig.gallery_border_radius * scaleFactor);
      if (originalConfig.gallery_image_border_radius) scaledConfig.gallery_image_border_radius = Math.max(3, originalConfig.gallery_image_border_radius * scaleFactor);
      
      // Scale spacing more aggressively for compact layouts
      if (originalConfig.gallery_spacing) scaledConfig.gallery_spacing = Math.max(4, originalConfig.gallery_spacing * scaleFactor);
      
      // Scale border widths (keep them thin in small containers)
      if (originalConfig.prompt_border_width) scaledConfig.prompt_border_width = Math.max(0.5, originalConfig.prompt_border_width * scaleFactor);
      if (originalConfig.suggestion_border_width) scaledConfig.suggestion_border_width = Math.max(0.5, originalConfig.suggestion_border_width * smallElementScale);
      if (originalConfig.uploader_border_width) scaledConfig.uploader_border_width = Math.max(0.5, originalConfig.uploader_border_width * scaleFactor);
      
      // Scale gallery settings for tighter layouts
      if (originalConfig.gallery_columns && containerWidth < 500) {
        // Force fewer columns in very small containers
        scaledConfig.gallery_columns = Math.min(originalConfig.gallery_columns, containerWidth < 350 ? 1 : 2);
      }
      
      return scaledConfig;
    };

    const layoutProps = {
      config: getResponsiveConfig(configWithUseCase, containerWidth),
      images: generatedImages,
      generatedImages: generatedImages, // Add this for layout compatibility
      isLoading: false,
      isGenerating,
      fullPage,
      deployment,
      containerWidth,
      instanceId,
      onGenerateGallery: handleGenerateGallery,
      onResetToSampleGallery: handleResetToSampleGallery,
      suggestions,
      onRefreshSuggestions: refreshSuggestions,
      onSuggestionClick: handleSuggestionClick,
      prompt,
      setPrompt,
      referenceImages,
      onPromptSubmit: (prompt?: string) => {
        if (prompt) {
          setPrompt(prompt);
        }
        handleSubmit(new Event('submit') as unknown as React.FormEvent, false);
      },
      onDrillDownSubmit: handleDrillDownSubmit, // Add drill-down submit function
      onImageUpload: handleImageUpload,
      onImageRemove: handleImageRemove,
      onReplaceImage: (imageData: string) => {
        // Replace the generated images with the new image
        setGeneratedImages([{ image: imageData }]);
        
        // Mark that user has generated something
        if (instanceId) {
          sessionStorage.setItem(`has_generated_${instanceId}`, 'true');
        }
        
        // Trigger gallery refresh
        const newRefreshTrigger = refreshTrigger + 1;
        setRefreshTrigger(newRefreshTrigger);
      },
      originalPrompt: prompt,
      refreshTrigger,
      error,
      setError,
      // Add submission limit props
      isSubmissionLimitReached,
      submissionCount,
      maxSubmissions: instanceData?.max_submissions_per_session,
      // Lead capture plumbing
      hasSubmitted,
      onRequestLeadCapture: () => setShowLeadModal(true),
      onMeasuredAspectChange: (aspect: string) => setMeasuredAspect(aspect)
    };



    // Use container width to determine layout
    if (containerWidth <= 768 || config.layout_mode === 'mobile-optimized') {
      return <MobileLayout {...layoutProps} />;
    }

    // For larger screens, use the configured layout
    switch (config.layout_mode) {
      case "left-right":
        return <LeftRightLayout {...layoutProps} />;
      case "prompt-bottom":
        return <PromptBottomLayout {...layoutProps} />;
      case "right-left":
        return <RightLeftLayout {...layoutProps} />;
      case "prompt-top":
        return <PromptTopLayout {...layoutProps} />;
      default:
        return <LeftRightLayout {...layoutProps} />;
    }
  };

  return (
    <div 
      className="h-full w-full relative"
      style={{
        // GOD CONTAINER - NOTHING can overflow this
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'visible',
        boxSizing: 'border-box',
        // Keep normal widget background visible even when modal shown
        backgroundColor: config.background_color || undefined
      }}
    >
      {/* Submission Limit Banner */}
      {isSubmissionLimitReached && instanceData?.submission_limit_enabled && (
        <div 
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center py-1 px-2 bg-amber-50 border-b border-amber-200"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-amber-600">⚠️</span>
            <span className="text-amber-800">
              Limit reached ({getSubmissionCountForDisplay()}/{instanceData.max_submissions_per_session})
            </span>
          </div>
        </div>
      )}
      

      
      {/* GOD CONTAINER WRAPPER - Forces all layouts to respect bounds */}
      <div 
        className="absolute inset-0"
        style={{
          position: 'absolute',
          top: isSubmissionLimitReached && instanceData?.submission_limit_enabled ? '28px' : 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: isSubmissionLimitReached && instanceData?.submission_limit_enabled ? 'calc(100% - 28px)' : '100%',
          overflow: 'visible'
        }}
      >
	        {/* Hide widget content entirely until lead is completed when trigger is immediate */}
	        <AnimatePresence mode="wait" initial={false}>
	          {!(shouldGateWithImmediateLead && showLeadModal) && (
	            <motion.div
	              key={
	                containerWidth <= 768 || config.layout_mode === "mobile-optimized"
	                  ? `mobile:${config.mobile_layout_mode || "prompt-bottom"}`
                  : config.layout_mode || "left-right"
              }
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.995 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.995 }}
              transition={reduceMotion ? undefined : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              {getLayoutComponent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
	      {/* Lead Capture Modal */}
	      {showLeadModal && (
	        <LeadCaptureModal
	          config={config}
	          onSubmit={handleLeadSubmit}
	          onClose={() => {
	            // In immediate mode, keep the widget gated until the lead is completed.
	            if (shouldGateWithImmediateLead) return;
	            setShowLeadModal(false);
	          }}
	          instanceId={instanceId}
	          isIframe={isIframe}
	          instanceData={instanceData ? {
	            webhook_url: instanceData.webhook_url,
	            account_id: instanceData.account_id,
	            name: instanceData.name
	          } : undefined}
	        />
	      )}
    </div>
  );
}); 

MainWidgetSection.displayName = "MainWidgetSection";
