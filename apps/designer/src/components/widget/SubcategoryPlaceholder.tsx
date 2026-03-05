"use client";

import React from "react";
import { Button } from "../ui/button";
import { Sparkles, ImageIcon, ArrowRight } from "lucide-react";

interface SubcategoryPlaceholderProps {
  subcategoryName: string;
  categoryName: string;
  onGenerateGallery?: () => void;
  config?: any;
}

export function SubcategoryPlaceholder({
  subcategoryName,
  categoryName,
  onGenerateGallery,
  config
}: SubcategoryPlaceholderProps) {
  const hasGenerateAction = !!onGenerateGallery;

  return (
    <div className="col-span-full aspect-[2/1] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px), radial-gradient(circle at 75% 75%, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          color: 'currentColor'
        }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-6">
        <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center mx-auto">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-800 dark:to-indigo-800 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {subcategoryName}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {categoryName} • Professional Gallery
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 max-w-md">
          This subcategory doesn't have placeholder images yet. Generate a professional gallery to showcase your work.
        </p>

        {hasGenerateAction ? (
          <Button
            onClick={onGenerateGallery}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Gallery
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <ImageIcon className="w-4 h-4" />
            <span>Gallery coming soon</span>
          </div>
        )}

        {/* Feature highlights */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-1">
              <span className="text-green-600 dark:text-green-400 font-bold">8+</span>
            </div>
            <span>Images</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-1">
              <span className="text-purple-600 dark:text-purple-400 font-bold">AI</span>
            </div>
            <span>Generated</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-1">
              <span className="text-orange-600 dark:text-orange-400 font-bold">∞</span>
            </div>
            <span>Reusable</span>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 opacity-30" />
      <div className="absolute bottom-4 left-4 w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 opacity-30" />
    </div>
  );
} 