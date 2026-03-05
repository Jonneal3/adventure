"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { CategorySelector } from '@/components/features/CategorySelector';
import { useInstance } from '@/contexts/InstanceContext';
import { useAccount } from '@/contexts/AccountContext';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { Button } from '@/components/ui/button';
 
import { useToast } from '@/hooks/use-toast';
import { SettingsPageHeader } from '@/components/features/settings/SettingsPrimitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SelectedCategory {
  id: string;
  name: string;
  subcategories: Array<{
    id: string;
    subcategory: string;
    description?: string;
  }>;
}

interface IndustryServicesSettingsProps {
  onSave?: () => void;
}

export function IndustryServicesSettings({ onSave }: IndustryServicesSettingsProps) {
  const { currentInstance, currentConfig, updateInstance } = useInstance();
  const { currentAccount } = useAccount();
  const supabase = useSupabaseClientWithAuth();
  const { toast } = useToast();
  
  // Get account ID from current instance or current account
  const accountId = currentInstance?.account_id || currentAccount?.id;

  // Simplified state management
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [selectedServices, setSelectedServices] = useState<Array<{id: string, subcategory: string, description: string | null}>>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalServices, setOriginalServices] = useState<Array<{id: string, subcategory: string, description: string | null}>>([]);
  const loadingRef = useRef(false);
  const isLoadingFromDB = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const leadPricingActive = useMemo(() => {
    if (!currentInstance) return false;
    const isServiceType = currentInstance.instance_type === 'service';
    const isImmediate = currentConfig?.lead_capture_trigger === 'immediate';
    const overlayEnabled = currentConfig?.lead_capture_enabled === true;
    return isServiceType && isImmediate && overlayEnabled;
  }, [currentInstance, currentConfig]);

  const [baselineEmail, setBaselineEmail] = useState<number>(0);
  const [baselinePhone, setBaselinePhone] = useState<number>(0);
  const [baselineEmailSource, setBaselineEmailSource] = useState<{ category?: string; subcategory?: string } | null>(null);
  const [baselinePhoneSource, setBaselinePhoneSource] = useState<{ category?: string; subcategory?: string } | null>(null);

  const [pricingPreview, setPricingPreview] = useState<{
    creditPrice: number | null;
    emailLeadPrice: number | null;
    loading: boolean;
    phoneLeadPrice: number | null;
  }>({ creditPrice: null, emailLeadPrice: null, loading: false, phoneLeadPrice: null });

  const CREDIT_USD_BASE = 0.07;
  const CREDIT_USD_LOW = 0.05;
  const CREDIT_USD_HIGH = 0.09;

  const usdFromCredits = (credits: number) => {
    const safeCredits = Number.isFinite(credits) ? credits : 0;
    return {
      base: safeCredits * CREDIT_USD_BASE,
      high: safeCredits * CREDIT_USD_HIGH,
      low: safeCredits * CREDIT_USD_LOW,
    };
  };

  const formatUsd = (value: number) => `$${value.toFixed(2)}`;

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Test database connection
  useEffect(() => {
    if (supabase && currentInstance?.id) {
      console.log('Testing database connection...');
      supabase
        .from('instance_subcategories')
        .select('count')
        .eq('instance_id', currentInstance.id)
        .then(({ data, error }) => {
          console.log('Database test result:', { data, error });
        });
    }
  }, [supabase, currentInstance?.id]);

  // Load existing services on mount - SIMPLIFIED
  useEffect(() => {
    console.log('Loading services useEffect triggered - currentInstance:', currentInstance?.id, 'loadingRef.current:', loadingRef.current);
    if (!currentInstance?.id) {
      console.log('No current instance ID, skipping load');
      return;
    }
    if (loadingRef.current) {
      console.log('Already loading, skipping load');
      return;
    }
    
    const loadServices = async () => {
      console.log('loadServices function called for instance:', currentInstance.id, 'supabase available:', !!supabase);
      if (!supabase) {
        console.error('Supabase client not available');
        return;
      }
      loadingRef.current = true;
      isLoadingFromDB.current = true;
      setLoading(true);
      try {
        // First try a simple query to see what's in the table
        const { data: simpleData, error: simpleError } = await supabase
          .from('instance_subcategories')
          .select('*')
          .eq('instance_id', currentInstance.id);
        
        console.log('Simple query result:', { simpleData, simpleError });

        // Try the same query structure that works in other components
        const { data, error } = await supabase
          .from('instance_subcategories')
          .select(`
            category_subcategory_id,
            categories_subcategories!inner (
              id,
              subcategory,
              description,
              email_lead_price,
              phone_lead_price,
              categories (
                id,
                name
              )
            )
          `)
          .eq('instance_id', currentInstance.id);

        console.log('Database query result - data:', data, 'error:', error);

        if (error) {
          console.error('Error loading services:', error);
          // Try a fallback query without joins
          console.log('Trying fallback query...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('instance_subcategories')
            .select('category_subcategory_id')
            .eq('instance_id', currentInstance.id);

          console.log('Fallback query result:', { fallbackData, fallbackError });

          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
          } else if (fallbackData && fallbackData.length > 0) {
            const ids = fallbackData
              .map((r: any) => r?.category_subcategory_id)
              .filter((id: any) => !!id);
            if (ids.length > 0) {
              const { data: catRows, error: catError } = await supabase
                .from('categories_subcategories')
                .select('id, subcategory, description')
                .in('id', ids);
              if (catError) {
                console.error('Error loading categories_subcategories in fallback:', catError);
              } else if (Array.isArray(catRows)) {
                const fallbackServices = catRows.map((r: any) => ({
                  id: r.id,
                  subcategory: r.subcategory,
                  description: r.description ?? null,
                }));
                setSelectedServices(fallbackServices);
              }
            }
          }
          // Continue; rows will be [] and services can be set from fallback above if available
        }

        const rows = (data || []) as Array<any>;
        console.log('Raw rows from database:', rows);
        
        // Check if the data structure is correct
        if (rows.length > 0) {
          console.log('First row structure:', rows[0]);
          console.log('categories_subcategories:', rows[0].categories_subcategories);
        }
        
        let services = rows
          .filter((r: any) => r && r.categories_subcategories) // Filter out null/undefined
          .map((r: any) => ({
            id: r.categories_subcategories.id,
            subcategory: r.categories_subcategories.subcategory,
            description: r.categories_subcategories.description ?? null
          }));

        // Fallback: if join returned nothing but simple query found rows, fetch details by IDs
        if (services.length === 0 && Array.isArray(simpleData) && simpleData.length > 0) {
          try {
            const ids = simpleData
              .map((r: any) => r?.category_subcategory_id)
              .filter((id: any) => !!id);
            console.log('Fallback fetching categories_subcategories for ids:', ids);
            if (ids.length > 0) {
              const { data: catRows, error: catError } = await supabase
                .from('categories_subcategories')
                .select('id, subcategory, description')
                .in('id', ids);
              if (catError) {
                console.error('Error loading categories_subcategories in fallback:', catError);
              } else if (Array.isArray(catRows)) {
                services = catRows.map((r: any) => ({
                  id: r.id,
                  subcategory: r.subcategory,
                  description: r.description ?? null,
                }));
              }
            }
          } catch (e) {
            console.error('Unexpected error during fallback fetch:', e);
          }
        }

        setSelectedServices(services);
        setOriginalServices(services); // Store original services for comparison
        setInitialLoadComplete(true);
        isLoadingFromDB.current = false;

        // Compute baseline (most expensive selected service)
        let maxEmail = 0;
        let maxPhone = 0;
        let maxEmailRow: any = null;
        let maxPhoneRow: any = null;
        for (const r of rows) {
          const s = r.categories_subcategories;
          const email = s?.email_lead_price != null ? Number(s.email_lead_price) : 1;
          const phone = s?.phone_lead_price != null ? Number(s.phone_lead_price) : 1;
          if (email > maxEmail) {
            maxEmail = email;
            maxEmailRow = s;
          }
          if (phone > maxPhone) {
            maxPhone = phone;
            maxPhoneRow = s;
          }
        }
        setBaselineEmail(maxEmail);
        setBaselinePhone(maxPhone);

        setBaselineEmailSource(maxEmailRow ? { category: maxEmailRow?.categories?.name, subcategory: maxEmailRow?.subcategory } : null);
        setBaselinePhoneSource(maxPhoneRow ? { category: maxPhoneRow?.categories?.name, subcategory: maxPhoneRow?.subcategory } : null);

        // Update instance pricing to match the most expensive selected service
        // Always update pricing even if values are 0 (to reset when no services selected)
        let maxCredit = 1; // Default to 1 credit minimum
        for (const r of rows) {
          const s = r.categories_subcategories;
          const credit = s?.credit_price != null ? Number(s.credit_price) : 1;
          if (credit > maxCredit) {
            maxCredit = credit;
          }
        }
        
        await updateInstance({ 
          email_lead_price: maxEmail, 
          phone_lead_price: maxPhone,
          credit_price: maxCredit
        } as any);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    };

    loadServices();
  }, [currentInstance?.id, supabase]); // Depend on both instance ID and supabase client

  useEffect(() => {
    let cancelled = false;

    async function computePricingPreview() {
      if (!supabase || selectedServices.length === 0) {
        setPricingPreview({ creditPrice: null, emailLeadPrice: null, loading: false, phoneLeadPrice: null });
        return;
      }

      setPricingPreview((prev) => ({ ...prev, loading: true }));

      const ids = selectedServices.map((s) => s.id).filter(Boolean);
      if (ids.length === 0) {
        setPricingPreview({ creditPrice: null, emailLeadPrice: null, loading: false, phoneLeadPrice: null });
        return;
      }

      try {
        let rows: any[] | null = null;
        let queryError: any = null;

        const { data, error } = await supabase
          .from("categories_subcategories")
          .select("id, email_lead_price, phone_lead_price, credit_price")
          .in("id", ids);

        if (error && String(error.message || "").includes("credit_price")) {
          const fallback = await supabase
            .from("categories_subcategories")
            .select("id, email_lead_price, phone_lead_price")
            .in("id", ids);
          rows = fallback.data as any[] | null;
          queryError = fallback.error;
        } else {
          rows = data as any[] | null;
          queryError = error;
        }

        if (queryError) throw queryError;

        let maxEmail = 1;
        let maxPhone = 1;
        let maxCredit = 1;

        for (const row of rows || []) {
          const email = Number(row?.email_lead_price ?? 0);
          const phone = Number(row?.phone_lead_price ?? 0);
          const credit = Number(row?.credit_price ?? 0);
          if (Number.isFinite(email) && email > maxEmail) maxEmail = email;
          if (Number.isFinite(phone) && phone > maxPhone) maxPhone = phone;
          if (Number.isFinite(credit) && credit > maxCredit) maxCredit = credit;
        }

        if (!cancelled) {
          setPricingPreview({
            creditPrice: maxCredit,
            emailLeadPrice: maxEmail,
            loading: false,
            phoneLeadPrice: maxPhone,
          });
        }
      } catch {
        if (!cancelled) {
          setPricingPreview((prev) => ({
            creditPrice: prev.creditPrice ?? 1,
            emailLeadPrice: prev.emailLeadPrice ?? 1,
            loading: false,
            phoneLeadPrice: prev.phoneLeadPrice ?? 1,
          }));
        }
      }
    }

    void computePricingPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedServices, supabase]);

  // Simplified category selection handler
  const handleCategorySelect = (category: any | null) => {
    console.log('handleCategorySelect called with category:', category);
    if (!category) return;
    // Convert CategoryWithSubcategories to SelectedCategory format
    const formattedCategory: SelectedCategory = {
      id: category.id,
      name: category.name,
      subcategories: (category.subcategories || []).map((sub: any) => ({
        id: sub.id,
        subcategory: sub.subcategory,
        description: sub.description
      }))
    };
    console.log('Formatted category subcategories:', formattedCategory.subcategories);
    // Track last interacted category for highlighting (don't auto-select services)
    setSelectedCategory(formattedCategory.subcategories.length > 0 ? formattedCategory : null);
  };

  const handleAccumulatedServicesChange = (services: Array<{id: string, subcategory: string, description: string | null}>) => {
    console.log('handleAccumulatedServicesChange called with services:', services, 'currentInstance exists:', !!currentInstance, 'initialLoadComplete:', initialLoadComplete, 'isLoadingFromDB:', isLoadingFromDB.current, 'current selectedServices length:', selectedServices.length);
    // Don't update if we're currently loading from DB
    if (isLoadingFromDB.current) {
      console.log('Skipping handleAccumulatedServicesChange - currently loading from DB');
      return;
    }
    // Always update selectedServices (including when unselecting services)
    setSelectedServices(services);
    // Only check for changes after initial load is complete
    if (initialLoadComplete) {
      // Check if services have changed from original
      const servicesChanged = JSON.stringify(services.sort((a, b) => a.id.localeCompare(b.id))) !== 
                             JSON.stringify(originalServices.sort((a, b) => a.id.localeCompare(b.id)));
      console.log('Services changed check:', servicesChanged, 'current services:', services.length, 'original services:', originalServices.length);
      setHasUnsavedChanges(servicesChanged);
    }
  };

  // Auto-save services to database
  const saveServicesToDB = useCallback(async (services: Array<{id: string, subcategory: string, description: string | null}>) => {
    if (!currentInstance?.id || !supabase) return;
    
    try {
      // Delete existing services
      const { error: deleteError } = await supabase
        .from('instance_subcategories')
        .delete()
        .eq('instance_id', currentInstance.id);

      if (deleteError) {
        console.error('Error deleting existing services:', deleteError);
        return;
      }

      // Insert new services
      const instanceSubcategories = services.map(service => ({
        instance_id: currentInstance.id,
        category_subcategory_id: service.id
      }));

      const { error: insertError } = await supabase
        .from('instance_subcategories')
        .insert(instanceSubcategories);

      if (insertError) {
        console.error('Error inserting new services:', insertError);
        return;
      }

      console.log('Services auto-saved successfully!');
    } catch (error) {
      console.error('Error auto-saving services:', error);
    }
  }, [currentInstance, supabase]);

  // Save services to database
  const saveServices = useCallback(async () => {
    console.log('Save services called - currentInstance:', currentInstance?.id, 'selectedServices:', selectedServices, 'supabase available:', !!supabase);
    
    if (!currentInstance?.id) {
      console.error('No current instance ID');
      return;
    }
    
    if (!supabase) {
      console.error('Supabase client not available');
      return;
    }
    
    if (selectedServices.length === 0) {
      // Show error or prevent saving
      console.warn('Cannot save: At least 1 service must be selected');
      return;
    }

    try {
      console.log('Deleting existing services for instance:', currentInstance.id);
      // First, remove all existing services for this instance
      const { error: deleteError } = await supabase
        .from('instance_subcategories')
        .delete()
        .eq('instance_id', currentInstance.id);

      if (deleteError) {
        console.error('Error deleting existing services:', deleteError);
        throw deleteError;
      }

      // Then add the new services
      const instanceSubcategories = selectedServices.map(service => ({
        instance_id: currentInstance.id,
        category_subcategory_id: service.id
      }));

      console.log('Inserting new services:', instanceSubcategories);
      const { error: insertError } = await supabase
        .from('instance_subcategories')
        .insert(instanceSubcategories);

      if (insertError) {
        console.error('Error inserting new services:', insertError);
        throw insertError;
      }

      console.log('Services saved successfully!');
      setHasUnsavedChanges(false); // Reset unsaved changes flag
      setOriginalServices(selectedServices); // Update original services

      // Reload services to update the UI
      const { data: reloadData, error: reloadError } = await supabase
        .from('instance_subcategories')
        .select(`
          category_subcategory_id,
          categories_subcategories (
            id,
            subcategory,
            description,
            email_lead_price,
            phone_lead_price,
            categories (
              id,
              name
            )
          )
        `)
        .eq('instance_id', currentInstance.id);

      if (!reloadError && reloadData) {
        const rows = reloadData as Array<any>;
        const services = rows.map(r => ({
          id: r.categories_subcategories.id,
          subcategory: r.categories_subcategories.subcategory,
          description: r.categories_subcategories.description ?? null
        }));
        setSelectedServices(services);
        console.log('Services reloaded in UI:', services);
      }

      // Update lead prices and credit price based on selected services
      const { data: priceRows, error: priceError } = await supabase
        .from('categories_subcategories')
        .select('id, email_lead_price, phone_lead_price, credit_price')
        .in('id', selectedServices.map(s => s.id));

      if (priceError) {
        console.error('Error fetching pricing data:', priceError);
        // Fallback to just email and phone if credit_price column doesn't exist yet
        const { data: fallbackRows } = await supabase
          .from('categories_subcategories')
          .select('id, email_lead_price, phone_lead_price, credit_price')
          .in('id', selectedServices.map(s => s.id));
        
        if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
          let maxEmail = 0;
          let maxPhone = 0;
          let maxCredit = 1; // Default to 1 credit minimum
          for (const row of fallbackRows as any[]) {
            if (row.email_lead_price && row.email_lead_price > maxEmail) {
              maxEmail = row.email_lead_price as unknown as number;
            }
            if (row.phone_lead_price && row.phone_lead_price > maxPhone) {
              maxPhone = row.phone_lead_price as unknown as number;
            }
            if (row.credit_price && row.credit_price > maxCredit) {
              maxCredit = row.credit_price as unknown as number;
            }
          }
          await updateInstance({ 
            email_lead_price: maxEmail, 
            phone_lead_price: maxPhone,
            credit_price: maxCredit
          } as any);
        }
        return;
      }

      if (Array.isArray(priceRows) && priceRows.length > 0) {
        let maxEmail = 0;
        let maxPhone = 0;
        let maxCredit = 1; // Default to 1 credit minimum
        for (const row of priceRows as any[]) {
          if (row.email_lead_price && row.email_lead_price > maxEmail) {
            maxEmail = row.email_lead_price as unknown as number;
          }
          if (row.phone_lead_price && row.phone_lead_price > maxPhone) {
            maxPhone = row.phone_lead_price as unknown as number;
          }
          if (row.credit_price && row.credit_price > maxCredit) {
            maxCredit = row.credit_price as unknown as number;
          }
        }
        
        // Always update credit price for all instances
        await updateInstance({ 
          email_lead_price: maxEmail, 
          phone_lead_price: maxPhone,
          credit_price: maxCredit
        } as any);
      }

      onSave?.();
    } catch (error) {
      console.error('Error saving services:', error);
      toast({
        title: "Error",
        description: "Failed to save services. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentInstance, selectedServices, leadPricingActive, supabase, updateInstance, onSave]);

  // Auto-save when services change - DISABLED to prevent infinite loops
  // useEffect(() => {
  //   if (mounted && selectedServices.length > 0) {
  //     const timeoutId = setTimeout(() => {
  //       saveServices();
  //     }, 1000); // Debounce saves

  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [selectedServices, mounted]);

  // Prevent hydration issues
  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-2/3 mb-8"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <SettingsPageHeader
        title="Industry & services"
        description="Choose your industry focus and service offerings so we can optimize your widget."
      />

      <div className="grid flex-1 min-h-0 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_340px] md:gap-6">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
          <div className="h-full min-h-0 overflow-hidden">
            <CategorySelector
              instanceId={currentInstance?.id}
              onSelect={handleCategorySelect}
              onAccumulatedServicesChange={handleAccumulatedServicesChange}
              selectedCategoryId={selectedCategory?.id || null}
              accountId={accountId}
              instanceType={(currentInstance?.instance_type as 'ecomm' | 'service') || undefined}
              showCategoryManagement={true}
              showLeadPrices={leadPricingActive}
              hideSaveButton={true}
              selectedServices={selectedServices}
              onRemoveService={(serviceId) => {
                const newServices = selectedServices.filter((s) => s.id !== serviceId);
                setSelectedServices(newServices);
                if (initialLoadComplete) {
                  const servicesChanged =
                    JSON.stringify(newServices.sort((a, b) => a.id.localeCompare(b.id))) !==
                    JSON.stringify(originalServices.sort((a, b) => a.id.localeCompare(b.id)));
                  setHasUnsavedChanges(servicesChanged);
                }
              }}
              onClearAllServices={() => {
                setSelectedServices([]);
                if (initialLoadComplete) {
                  const emptySorted: Array<{ id: string }> = [];
                  const originalSorted = [...originalServices].sort((a, b) => a.id.localeCompare(b.id));
                  const servicesChanged = JSON.stringify(emptySorted) !== JSON.stringify(originalSorted);
                  setHasUnsavedChanges(servicesChanged);
                }
              }}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <Card className="h-full overflow-hidden md:sticky md:top-6">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Estimated charges</CardTitle>
                  <CardDescription>Credits + USD estimate.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 overflow-auto">
              {selectedServices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
                  Select at least 1 service to see pricing.
                </div>
              ) : (
                <>
                  {(() => {
                    const rows = [
                      {
                        credits: pricingPreview.creditPrice ?? 1,
                        helper: "Per generated image",
                        key: "image",
                        label: "Image gen",
                      },
                      {
                        credits: pricingPreview.emailLeadPrice ?? 1,
                        helper: "Per captured email",
                        key: "email",
                        label: "Email lead",
                      },
                      {
                        credits: pricingPreview.phoneLeadPrice ?? 1,
                        helper: "Per captured phone",
                        key: "phone",
                        label: "Phone lead",
                      },
                    ];

                    return (
                      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40 divide-y divide-border/60">
                        {rows.map((row) => {
                          const credits = row.credits;
                          const creditsLabel =
                            pricingPreview.loading
                              ? "…"
                              : Number.isInteger(credits)
                              ? String(credits)
                              : Number(credits).toFixed(2);

                          const { base, high, low } = usdFromCredits(row.credits);
                          const usdTitle = pricingPreview.loading
                            ? row.helper
                            : `${row.helper} · USD range ${formatUsd(low)}–${formatUsd(high)} (est. ${formatUsd(base)} @ $0.07/credit)`;

                          return (
                            <div key={row.key} className="px-3 py-2.5" title={usdTitle}>
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-sm text-foreground">{row.label}</div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">{row.helper}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold tabular-nums">
                                    {creditsLabel}{" "}
                                    <span className="text-[11px] font-normal text-muted-foreground">credits</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground tabular-nums">
                                    ≈ {pricingPreview.loading ? "…" : formatUsd(base)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!leadPricingActive ? (
                    <div className="text-xs text-muted-foreground">
                      Lead pricing applies when lead capture is enabled and set to immediate.
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="flex-shrink-0 border-t border-border/60 bg-background/80 pt-3 backdrop-blur">
          <Button onClick={saveServices} className="w-full">
            {selectedServices.length === 0
              ? 'Choose at least 1 service'
              : `Save Changes (${selectedServices.length} services)`}
          </Button>
        </div>
      )}
    </div>
  );
} 
