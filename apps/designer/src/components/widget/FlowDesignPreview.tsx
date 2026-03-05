"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { FlowState } from '@/types/flow';

interface FlowDesignPreviewProps {
  designs: FlowState['generatedDesigns'];
  onRefresh?: () => void;
  onDownload?: (designId: string) => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export function FlowDesignPreview({
  designs,
  onRefresh,
  onDownload,
  position = 'right',
}: FlowDesignPreviewProps) {
  if (designs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-sm">Designs will appear here as you progress through the flow.</p>
        </CardContent>
      </Card>
    );
  }

  const latestDesign = designs[designs.length - 1];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Design Preview</h3>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            )}
          </div>

          {/* Latest Design */}
          <div className="space-y-2">
            <div className="relative aspect-square rounded-lg overflow-hidden border">
              <img
                src={latestDesign.imageUrl}
                alt="Generated design"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {latestDesign.prompt}
            </p>
            {onDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(latestDesign.id)}
                className="w-full"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            )}
          </div>

          {/* Previous Designs (if multiple) */}
          {designs.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Previous Versions</h4>
              <div className="grid grid-cols-2 gap-2">
                {designs.slice(0, -1).reverse().map((design) => (
                  <div
                    key={design.id}
                    className="relative aspect-square rounded overflow-hidden border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => onDownload?.(design.id)}
                  >
                    <img
                      src={design.imageUrl}
                      alt="Previous design"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
