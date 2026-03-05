import React from 'react';
import { ChevronDown } from 'lucide-react';
import { ColorInput, NumberInput } from '../FormComponents';
import { Switch } from '../../ui/switch';
import { DesignSettings } from '@/types/design';

interface StandaloneSettingsProps {
  config: DesignSettings;
  isOpen: boolean;
  onToggle: () => void;
  updateConfig: (updates: Partial<DesignSettings>) => void;
}

export const StandaloneSettings: React.FC<StandaloneSettingsProps> = ({
  ...props
}) => {
  const { config, isOpen, onToggle, updateConfig } = props;
  return (
    <details 
      className="group overflow-hidden rounded-lg border border-border/40 bg-background/30"
      open={isOpen}
    >
      <summary 
        className="flex items-center justify-between cursor-pointer px-3 py-2.5 select-none hover:bg-muted/30 transition-colors"
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
      >
        <span className="text-sm font-medium text-foreground">Page settings</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      
      {isOpen && (
        <div className="border-t border-border/30">
          <div className="space-y-3 p-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Layout</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Full width</span>
                    <Switch
                      checked={config.full_width_layout || false}
                      onCheckedChange={(checked) => updateConfig({ full_width_layout: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Sticky header</span>
                    <Switch
                      checked={config.sticky_header || false}
                      onCheckedChange={(checked) => updateConfig({ sticky_header: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Page title</span>
                    <Switch
                      checked={config.show_page_title !== false}
                      onCheckedChange={(checked) => updateConfig({ show_page_title: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Settings */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Navigation</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Breadcrumbs</span>
                    <Switch
                      checked={config.show_breadcrumbs || false}
                      onCheckedChange={(checked) => updateConfig({ show_breadcrumbs: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Back button</span>
                    <Switch
                      checked={config.show_back_button || false}
                      onCheckedChange={(checked) => updateConfig({ show_back_button: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Page Styling */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Style</label>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Background</label>
                    <ColorInput
                      label="Page background color"
                      value={config.background_color || '#ffffff'}
                      onChange={(value) => updateConfig({ background_color: value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Content max width</label>
                    <NumberInput
                      value={config.content_max_width || 1200}
                      onChange={(value) => updateConfig({ content_max_width: value })}
                      min={800}
                      max={1600}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </details>
  );
};
