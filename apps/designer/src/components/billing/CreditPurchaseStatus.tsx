import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useCreditPurchaseStatus } from '@/hooks/use-credit-purchase-status';

interface GenericLoadingState {
  id: string;
  title: string;
  message: string;
  amount?: number;
  credits?: number;
}

interface CreditPurchaseStatusProps {
  genericLoading?: GenericLoadingState | null;
  onGenericLoadingComplete?: (id: string) => void;
  accountId?: string;
}

export function CreditPurchaseStatus({ 
  genericLoading, 
  onGenericLoadingComplete,
  accountId
}: CreditPurchaseStatusProps = {}) {
  const { 
    getLatestPendingPurchase, 
    getLatestCompletedPurchase, 
    clearCompletedPurchases 
  } = useCreditPurchaseStatus(accountId);
  
  const [showCompleted, setShowCompleted] = useState(false);
  const [genericLoadingTimeout, setGenericLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const pendingPurchase = getLatestPendingPurchase();
  const completedPurchase = getLatestCompletedPurchase();



  // Auto-hide completed purchase after 5 seconds
  useEffect(() => {
    if (completedPurchase) {
      setShowCompleted(true);
      const timer = setTimeout(() => {
        setShowCompleted(false);
        clearCompletedPurchases();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [completedPurchase, clearCompletedPurchases]);

  // Handle generic loading timeout (15 seconds)
  useEffect(() => {
    if (genericLoading) {
      // Clear any existing timeout
      if (genericLoadingTimeout) {
        clearTimeout(genericLoadingTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        onGenericLoadingComplete?.(genericLoading.id);
      }, 15000); // 15 seconds

      setGenericLoadingTimeout(timeout);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [genericLoading, onGenericLoadingComplete]);

  if (!pendingPurchase && !showCompleted && !genericLoading) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Generic Loading State */}
      {genericLoading && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                {genericLoading.title}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {genericLoading.message}
              </p>
            </div>
            {(genericLoading.amount || genericLoading.credits) && (
              <div className="text-right">
                {genericLoading.amount && (
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    ${genericLoading.amount}
                  </div>
                )}
                {genericLoading.credits && (
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    {genericLoading.credits} credits
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Purchase */}
      {pendingPurchase && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Processing Payment
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Adding {pendingPurchase.creditsToAdd} credits to your account...
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                ${pendingPurchase.amount}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {pendingPurchase.creditsToAdd} credits
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Purchase */}
      {showCompleted && completedPurchase && (
        <div className={`bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 transition-all duration-300 ${
          showCompleted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}>
          <div className="flex items-center gap-3">
            {completedPurchase.status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${
                completedPurchase.status === 'success' 
                  ? 'text-green-900 dark:text-green-100' 
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {completedPurchase.status === 'success' ? 'Payment Successful!' : 'Payment Failed'}
              </h4>
              <p className={`text-sm ${
                completedPurchase.status === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {completedPurchase.message}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${
                completedPurchase.status === 'success' 
                  ? 'text-green-900 dark:text-green-100' 
                  : 'text-red-900 dark:text-red-100'
              }`}>
                ${completedPurchase.amount}
              </div>
              <div className={`text-xs ${
                completedPurchase.status === 'success' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {completedPurchase.creditsToAdd} credits
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 