"use client";

import { ChevronDown, ChevronRight, Cog, Building2, Globe } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

interface SettingsTabProps {
  instance: any;
  updateInstance: (updates: any) => void;
  openSections: Record<string, Record<string, boolean>>;
  toggleSection: (tab: string, section: string) => void;
  selectedItem: string;
  onItemSelect: (itemId: string) => void;
}

const SECTIONS = [
  {
    id: 'instance',
    label: 'Instance',
    icon: Building2,
    items: [
      { id: 'basic-info', label: 'Basic Info', description: 'Name, description, and core details' },
      { id: 'industry-services', label: 'Industry & Services', description: 'Choose your industry focus and services' },
      { id: 'access-control', label: 'Access Control', description: 'Public/private settings' },
      { id: 'credits', label: 'Credits', description: 'Configure credit pricing for generations' }
    ]
  },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: Cog,
    items: [
      // { id: 'service-config', label: 'Service Configuration', description: 'AI model and generation settings' },
      // { id: 'api-config', label: 'API Configuration', description: 'API keys and endpoints' },
      { id: 'usage-limits', label: 'Usage Limits', description: 'Rate limits and quotas' }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Globe,
    items: [
      { id: 'webhooks', label: 'Webhooks', description: 'Configure webhook endpoints' },
      { id: 'notifications', label: 'Notifications', description: 'Email and alert settings' }
    ]
  },
  // {
  //   id: 'advanced',
  //   label: 'Advanced',
  //   icon: Zap,
  //   items: [
  //     { id: 'database', label: 'Database', description: 'Storage and data settings' },
  //     { id: 'security', label: 'Security', description: 'Authentication and permissions' },
  //     { id: 'monitoring', label: 'Monitoring', description: 'Logs and analytics' }
  //   ]
  // }
] as const;

export const SettingsTab: React.FC<SettingsTabProps> = ({
  instance,
  updateInstance,
  openSections,
  toggleSection,
  selectedItem,
  onItemSelect
}) => {
  const handleSectionClick = (sectionId: string) => {
    toggleSection('settings', sectionId);
  };

  const handleItemClick = (itemId: string) => {
    // Close all other sections first
    SECTIONS.forEach(section => {
      section.items.forEach(item => {
        if (item.id !== itemId && openSections.settings?.[item.id]) {
          toggleSection('settings', item.id);
        }
      });
    });
    // Open the clicked item
    toggleSection('settings', itemId);
    // Set the selected item
    onItemSelect(itemId);
  };

  return (
    <div className="space-y-3 pt-2">
      {SECTIONS.map((section) => {
        const isSectionOpen = openSections.settings?.[section.id];
        
        return (
          <div
            key={section.id}
            className="rounded-xl border border-border/60 bg-card/40 shadow-sm p-1"
          >
            {/* Section Header */}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-between text-sm font-medium hover:bg-muted/30 h-10 px-3 rounded-lg",
                isSectionOpen && "bg-muted/25"
              )}
              onClick={() => handleSectionClick(section.id)}
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-muted-foreground" />
                {section.label}
              </div>
              {isSectionOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            
            {/* Section Items */}
            {isSectionOpen && (
              <div className="px-1 pb-1 pt-1 space-y-1">
                {section.items.map((item) => {
                  const isActive = selectedItem === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start hover:bg-muted/40 h-auto py-2.5 px-3 rounded-lg",
                        isActive && "bg-muted/50 text-foreground"
                      )}
                      onClick={() => handleItemClick(item.id)}
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="text-sm font-medium leading-tight">{item.label}</span>
                        <span className="text-xs text-muted-foreground font-normal leading-snug">
                          {item.description}
                        </span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}; 
