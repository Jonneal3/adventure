import { useMemo } from 'react';
import { useInstance } from '@/contexts/InstanceContext';

export type ImplementationMode = 'standalone' | 'modal' | 'iframe';

export const useImplementationMode = (): ImplementationMode => {
  const { currentInstance } = useInstance();

  return useMemo(() => {
    // For now, we'll determine the mode based on the current context
    // In the future, this could be based on:
    // 1. URL parameters
    // 2. Instance configuration
    // 3. User preferences
    // 4. Parent component context
    
    // Default to standalone for now
    // This will be enhanced when modal and iframe modes are implemented
    return 'standalone';
  }, [currentInstance]);
};

export const useImplementationSettings = () => {
  const { currentInstance } = useInstance();
  const implementationMode = useImplementationMode();

  return useMemo(() => {
    const instanceType = currentInstance?.instance_type || 'service';
    
    return {
      instanceType: instanceType as 'ecomm' | 'service' | 'both',
      implementationMode,
      isEcomm: instanceType === 'ecomm',
      isService: instanceType === 'service',
      isBoth: instanceType === 'both',
      isStandalone: implementationMode === 'standalone',
      isModal: implementationMode === 'modal',
      isIframe: implementationMode === 'iframe',
    };
  }, [currentInstance, implementationMode]);
};
