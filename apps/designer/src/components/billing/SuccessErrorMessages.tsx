"use client";

import { Check, AlertCircle } from 'lucide-react';

interface SuccessErrorMessagesProps {
  showSuccessMessage: boolean;
  showErrorMessage: boolean;
  successMessage: string;
  errorMessage: string;
}

export function SuccessErrorMessages({
  showSuccessMessage,
  showErrorMessage,
  successMessage,
  errorMessage
}: SuccessErrorMessagesProps) {
  return (
    <>
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-green-900">Success!</h2>
          </div>
          <p className="text-green-700 mt-1">
            {successMessage}
          </p>
        </div>
      )}

      {/* Error Message */}
      {showErrorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Error!</h2>
          </div>
          <p className="text-red-700 mt-1">
            {errorMessage}
          </p>
        </div>
      )}
    </>
  );
} 