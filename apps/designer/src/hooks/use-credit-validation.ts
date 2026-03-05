import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { useToast } from '@/hooks/use-toast';

interface CreditValidationResult {
  hasEnoughCredits: boolean;
  currentBalance: number;
  requiredCredits: number;
  canProceed: boolean;
}

export function useCreditValidation() {
  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);

  const checkCredits = useCallback(async (requiredCredits: number): Promise<CreditValidationResult> => {
    if (!session?.user || !currentAccount?.id) {
      return {
        hasEnoughCredits: false,
        currentBalance: 0,
        requiredCredits,
        canProceed: false,
      };
    }

    setIsChecking(true);
    try {
      const response = await fetch(`/api/user-subscriptions/credits?accountId=${currentAccount.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check credits');
      }

      const { credits: currentBalance } = await response.json();
      const hasEnoughCredits = currentBalance >= requiredCredits;

      return {
        hasEnoughCredits,
        currentBalance,
        requiredCredits,
        canProceed: hasEnoughCredits,
      };
    } catch (error) {
      return {
        hasEnoughCredits: false,
        currentBalance: 0,
        requiredCredits,
        canProceed: false,
      };
    } finally {
      setIsChecking(false);
    }
  }, [session, currentAccount]);

  const deductCredits = useCallback(async (credits: number, operation: string): Promise<boolean> => {
    if (!session?.user || !currentAccount?.id) {
      return false;
    }

    try {
      const response = await fetch('/api/use-credits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits,
          operation,
          accountId: currentAccount.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 402) {
          // Insufficient credits
          toast({
            title: 'Insufficient Credits',
            description: `You need ${errorData.requiredCredits} credits but only have ${errorData.currentBalance}. Please purchase more credits.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to process credit deduction',
            variant: 'destructive',
          });
        }
        return false;
      }

      const result = await response.json();
      
      if (result.autoPurchased) {
        toast({
          title: 'Credits Auto-Purchased',
          description: `Automatically purchased credits to complete your operation.`,
        });
      }

      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process credit deduction',
        variant: 'destructive',
      });
      return false;
    }
  }, [session, currentAccount, toast]);

  const validateAndDeduct = useCallback(async (
    requiredCredits: number, 
    operation: string
  ): Promise<boolean> => {
    // First check if we have enough credits
    const creditCheck = await checkCredits(requiredCredits);
    
    if (!creditCheck.canProceed) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${requiredCredits} credits but only have ${creditCheck.currentBalance}. Please purchase more credits.`,
        variant: 'destructive',
      });
      return false;
    }

    // Then deduct the credits
    return await deductCredits(requiredCredits, operation);
  }, [checkCredits, deductCredits, toast]);

  return {
    checkCredits,
    deductCredits,
    validateAndDeduct,
    isChecking,
  };
} 