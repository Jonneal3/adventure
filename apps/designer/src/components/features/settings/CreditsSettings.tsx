"use client";

import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { AlertCircle, Coins, HelpCircle } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { useAccount } from '@/contexts/AccountContext';
import { createClientComponent } from '@/config/supabase';
import { SettingsPageHeader, SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CreditsSettingsProps {
  onSave?: () => void;
}

export function CreditsSettings({ onSave }: CreditsSettingsProps) {
  const { currentInstance, currentConfig } = useInstance();
  const { currentAccount } = useAccount();

  // Credits state
  const [loading, setLoading] = React.useState(false);
  const [highestCreditService, setHighestCreditService] = React.useState<{
    name: string;
    creditPrice: number;
    category: string;
  } | null>(null);
  const [baselineEmail, setBaselineEmail] = React.useState<number>(0);
  const [baselinePhone, setBaselinePhone] = React.useState<number>(0);
  const [baselineEmailSource, setBaselineEmailSource] = React.useState<{ category?: string; subcategory?: string } | null>(null);
  const [baselinePhoneSource, setBaselinePhoneSource] = React.useState<{ category?: string; subcategory?: string } | null>(null);

  const supabase = createClientComponent();

  const leadPricingActive = React.useMemo(() => {
    if (!currentInstance) return false;
    const isServiceType = (currentInstance as any).instance_type === 'service';
    const isImmediate = (currentConfig as any)?.lead_capture_trigger === 'immediate';
    const overlayEnabled = (currentConfig as any)?.lead_capture_enabled === true;
    return isServiceType && isImmediate && overlayEnabled;
  }, [currentInstance, currentConfig]);

  // Load credits data
  useEffect(() => {
    const loadCreditsData = async () => {
      if (!currentInstance) return;

      setLoading(true);
      try {
        // Always set the instance's direct values first
        setBaselineEmail((currentInstance as any).email_lead_price || 1);
        setBaselinePhone((currentInstance as any).phone_lead_price || 1);

        // Try to get subcategories from instance_subcategories table first
        const { data: instanceSubcategories, error: instanceError } = await supabase
          .from('instance_subcategories')
          .select(`
            category_subcategory_id,
            categories_subcategories!inner (
              id,
              subcategory,
              credit_price,
              email_lead_price,
              phone_lead_price,
              categories (
                id,
                name
              )
            )
          `)
          .eq('instance_id', currentInstance.id);

        if (!instanceError && instanceSubcategories && instanceSubcategories.length > 0) {
          const subcategories = instanceSubcategories.map((r: any) => r.categories_subcategories);
          
          const maxCreditPrice = Math.max(...subcategories.map(s => s.credit_price || 1));
          const highestService = subcategories.find(s => s.credit_price === maxCreditPrice);

          if (highestService) {
            setHighestCreditService({
              name: highestService.subcategory,
              creditPrice: highestService.credit_price || 1,
              category: highestService.categories?.name || 'Unknown'
            });
          }

          let maxEmail = 0;
          let maxPhone = 0;
          let maxEmailRow: any = null;
          let maxPhoneRow: any = null;

          for (const sub of subcategories) {
            const email = sub?.email_lead_price != null ? Number(sub.email_lead_price) : 1;
            const phone = sub?.phone_lead_price != null ? Number(sub.phone_lead_price) : 1;
            if (email > maxEmail) {
              maxEmail = email;
              maxEmailRow = sub;
            }
            if (phone > maxPhone) {
              maxPhone = phone;
              maxPhoneRow = sub;
            }
          }

          setBaselineEmailSource(maxEmailRow ? { category: maxEmailRow?.categories?.name, subcategory: maxEmailRow?.subcategory } : null);
          setBaselinePhoneSource(maxPhoneRow ? { category: maxPhoneRow?.categories?.name, subcategory: maxPhoneRow?.subcategory } : null);
        } else if ((currentInstance as any).selected_subcategories && (currentInstance as any).selected_subcategories.length > 0) {
          // Fallback to old method if instance_subcategories doesn't work
          const { data: subcategories, error } = await supabase
            .from('categories_subcategories')
            .select('id, subcategory, credit_price, email_lead_price, phone_lead_price, categories(name)')
            .in('id', (currentInstance as any).selected_subcategories);

          if (!error && subcategories && subcategories.length > 0) {
            const maxCreditPrice = Math.max(...(subcategories as any[]).map(s => s.credit_price || 1));
            const highestService = (subcategories as any[]).find(s => s.credit_price === maxCreditPrice);

            if (highestService) {
              setHighestCreditService({
                name: (highestService as any).subcategory,
                creditPrice: (highestService as any).credit_price || 1,
                category: (highestService as any).categories?.name || 'Unknown'
              });
            }

            let maxEmail = 0;
            let maxPhone = 0;
            let maxEmailRow: any = null;
            let maxPhoneRow: any = null;

            for (const sub of (subcategories as any[])) {
              const email = sub?.email_lead_price != null ? Number(sub.email_lead_price) : 1;
              const phone = sub?.phone_lead_price != null ? Number(sub.phone_lead_price) : 1;
              if (email > maxEmail) {
                maxEmail = email;
                maxEmailRow = sub;
              }
              if (phone > maxPhone) {
                maxPhone = phone;
                maxPhoneRow = sub;
              }
            }

            setBaselineEmailSource(maxEmailRow ? { category: maxEmailRow?.categories?.name, subcategory: maxEmailRow?.subcategory } : null);
            setBaselinePhoneSource(maxPhoneRow ? { category: maxPhoneRow?.categories?.name, subcategory: maxPhoneRow?.subcategory } : null);
          }
        }
      } catch (error) {
        console.error('Error loading credits data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreditsData();
  }, [currentInstance, currentAccount, supabase]);

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Credit pricing" description="View your pricing and how it’s calculated." />

      <SettingsSection title="How it works">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Credit price is determined by the highest credit price among your selected services.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="Current pricing">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading pricing…</div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-6 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Credit price</Label>
                </div>
                <p className="text-xs text-muted-foreground">Per image generation.</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">
                  {highestCreditService?.creditPrice || (currentInstance as any)?.credit_price || 1} credits
                </div>
                {highestCreditService ? (
                  <div className="text-xs text-muted-foreground">Set by: {highestCreditService.name}</div>
                ) : null}
              </div>
            </div>

            {leadPricingActive ? (
              <TooltipProvider>
                <div className="flex items-start justify-between gap-6 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Email lead price</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Charged per lead when you select “immediate” for the form overlay (image generation is less frequent).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground">Per email capture.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">${baselineEmail.toFixed(2)}</div>
                    {baselineEmailSource ? (
                      <div className="text-xs text-muted-foreground">Set by: {baselineEmailSource.subcategory}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-6 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Phone lead price</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Charged per lead when you select “immediate” for the form overlay (image generation is less frequent).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground">Per phone capture.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">${baselinePhone.toFixed(2)}</div>
                    {baselinePhoneSource ? (
                      <div className="text-xs text-muted-foreground">Set by: {baselinePhoneSource.subcategory}</div>
                    ) : null}
                  </div>
                </div>
              </TooltipProvider>
            ) : null}
          </div>
        )}
      </SettingsSection>
    </div>
  );
} 
