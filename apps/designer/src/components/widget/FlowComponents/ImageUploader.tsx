"use client";

import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
}

export function ImageUploader({
  value = [],
  onChange,
  label,
  maxFiles = 6,
  maxSize = 10,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Check max files
    if (value.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Check file sizes and types
    const validFiles = files.filter((file) => {
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File ${file.name} exceeds ${maxSize}MB limit`);
        return false;
      }
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
        alert(`File ${file.name} is not an accepted type`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);

    try {
      // Convert to data URLs for now (in production, upload to storage)
      const newUrls = await Promise.all(
        validFiles.map((file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve(e.target?.result as string);
            };
            reader.readAsDataURL(file);
          });
        })
      );

      onChange([...value, ...newUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div className="border-2 border-dashed border-border rounded-lg p-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || value.length >= maxFiles}
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || value.length >= maxFiles}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : `Upload Images (${value.length}/${maxFiles})`}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
