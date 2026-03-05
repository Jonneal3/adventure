"use client";

import { useMemo, useState, useEffect } from 'react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft, X, Settings, Plus, Clock, XCircle, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatSubcategoryLabel } from '@/utils/subcategory';

interface Category {
  id: string;
  name: string;
  description: string | null;
  account_id?: string | null;
}

interface Subcategory {
  id: string;
  subcategory: string;
  description: string | null;
  status?: string;
  account_id?: string | null;
}

interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
  status?: string;
}

interface CategorySelectorProps {
  instanceId?: string; // make optional
  onComplete?: () => void;
  onSelect?: (category: CategoryWithSubcategories | null) => void;
  onAccumulatedServicesChange?: (services: Subcategory[]) => void;
  selectedCategoryId?: string | null;
  accountId?: string | null;
  showCategoryManagement?: boolean;
  instanceType?: 'ecomm' | 'service';
  showLeadPrices?: boolean;
  selectedServices?: Array<{id: string, subcategory: string, description: string | null}>; // Add this prop
  onRemoveService?: (serviceId: string) => void; // Add callback for removing services
  onClearAllServices?: () => void; // Add callback for clearing all services
  hideSaveButton?: boolean; // Add prop to hide save button when used in settings
  variant?: 'industries' | 'services';
}

export function CategorySelector({ instanceId, onComplete, onSelect, onAccumulatedServicesChange, selectedCategoryId: propSelectedCategoryId, accountId, showCategoryManagement = false, instanceType, showLeadPrices = false, selectedServices: propSelectedServices, onRemoveService, onClearAllServices, hideSaveButton = false, variant = 'industries' }: CategorySelectorProps) {
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [currentInstanceSubcategories, setCurrentInstanceSubcategories] = useState<any[]>([]);
  const [accumulatedServices, setAccumulatedServices] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Category management state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [showCustomServiceDialog, setShowCustomServiceDialog] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<CategoryWithSubcategories | null>(null);

  // Category form
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categorySearchResults, setCategorySearchResults] = useState<CategoryWithSubcategories[]>([]);

  // Subcategory form
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryDescription, setSubcategoryDescription] = useState('');
  const [subcategorySearchResults, setSubcategorySearchResults] = useState<Subcategory[]>([]);

  const supabase = useSupabaseClientWithAuth();
  const { session } = useAuth();
  const { toast } = useToast();




  // Add service to accumulated list
  const addToAccumulated = (subcategory: Subcategory) => {
    setAccumulatedServices(prev => {
      // Check if already exists
      if (prev.some(service => service.id === subcategory.id)) {
        return prev;
      }
      return [...prev, subcategory];
    });
  };

  // Remove service from current instance
  const removeCurrentInstanceService = async (serviceId: string) => {
    if (!instanceId || !supabase) return;

    try {
      const { error } = await supabase
        .from('instance_subcategories')
        .delete()
        .eq('instance_id', instanceId)
        .eq('category_subcategory_id', serviceId);

      if (error) throw error;

      // Update local state
      setCurrentInstanceSubcategories(prev => 
        prev.filter(service => service.id !== serviceId)
      );

      toast({
        title: "Success",
        description: "Service removed successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
    }
  };

  // Clear all current instance services
  const clearCurrentInstanceServices = async () => {
    if (!instanceId || !supabase) return;

    try {
      const { error } = await supabase
        .from('instance_subcategories')
        .delete()
        .eq('instance_id', instanceId);

      if (error) throw error;

      // Update local state
      setCurrentInstanceSubcategories([]);

      toast({
        title: "Success",
        description: "All services removed successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove services",
        variant: "destructive",
      });
    }
  };

  // Remove service from accumulated list
  const removeFromAccumulated = (subcategoryId: string) => {
    setAccumulatedServices(prev => prev.filter(service => service.id !== subcategoryId));
  };

  // Clear accumulated services
  const clearAccumulated = () => {
    setAccumulatedServices([]);
  };

  // Create custom service and add to accumulated services
  const createCustomService = async () => {
    if (!accountId || !selectedCategoryId || !subcategoryName.trim() || !subcategoryDescription.trim()) return;
    
    setSaving(true);
    try {
      // First get the category name
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('name')
        .eq('id', selectedCategoryId)
        .single();

      if (categoryError || !category) {
        toast({
          title: "Error",
          description: "Category not found",
          variant: "destructive",
        });
        return;
      }

      // Create the subcategory in the database
      const insertData = {
        subcategory: subcategoryName.trim(),
        description: subcategoryDescription.trim(),
        category_id: selectedCategoryId,
        user_id: session?.user?.id,
        account_id: accountId,
        status: 'verification_needed',
        instance_type: instanceType || 'service',
      };
      
      const { data: subcategory, error } = await supabase
        .from('categories_subcategories')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating custom service:', error);
        throw error;
      }
      

      // Create a service object for the accumulated list
      const customService: Subcategory = {
        id: subcategory.id,
        subcategory: subcategory.subcategory,
        description: subcategory.description,
        account_id: accountId
      };
      
      // Add to accumulated services
      addToAccumulated(customService);
      
      // Refresh categories to show the new service in the dropdown
      await refreshCategories();
      
      // Reset form
      setSubcategoryName('');
      setSubcategoryDescription('');
      setSelectedCategoryId('');
      setShowCustomServiceDialog(false);
      
      toast({
        title: "Custom Service Added",
        description: `"${customService.subcategory}" has been added to your selected services and will be reviewed.`,
      });
    } catch (error) {
      console.error('Error creating custom service:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('error' in error) {
          errorMessage = String(error.error);
        } else if ('details' in error) {
          errorMessage = String(error.details);
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Error",
        description: `Failed to add custom service: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Load existing instance subcategories (only if propSelectedServices is not provided)
  useEffect(() => {
    if (!instanceId || propSelectedServices) return; // Skip if propSelectedServices is provided
    
    const loadInstanceSubcategories = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('instance_subcategories')
          .select(`
            category_subcategory_id,
            categories_subcategories (
              id,
              subcategory,
              description,
              categories (
                id,
                name,
                description
              )
            )
          `)
          .eq('instance_id', instanceId);

        if (error) {
          console.error('Error loading instance subcategories:', error);
          throw error;
        }

        const subcategories = data?.map(item => ({
          id: item.categories_subcategories.id,
          subcategory: item.categories_subcategories.subcategory,
          description: item.categories_subcategories.description,
          category: item.categories_subcategories.categories
        })) || [];
        setCurrentInstanceSubcategories(subcategories);
        
        // Pre-populate selected subcategories for editing
        const subcategoryIds = subcategories.map(sub => sub.id);
        setSelectedSubcategories(subcategoryIds);
      } catch (err) {
        console.error('Error in loadInstanceSubcategories:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInstanceSubcategories();
  }, [instanceId, supabase, propSelectedServices]);

  useEffect(() => {
    setLoading(true);
    
    const fetchCategories = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {}

        let query = supabase
          .from('categories')
          .select(`
            id,
            name,
            description,
            status,
            account_id,
            instance_type,
            categories_subcategories (
              id,
              subcategory,
              description,
              status,
              instance_type,
              email_lead_price,
              phone_lead_price,
              credit_price
            )
          `)
          .order('name');

        if (accountId) {
          // Fetch categories that are active OR belong to this account
          query = query.or(`status.eq.active,account_id.eq.${accountId}`);
        } else {
          // Only fetch active categories
          query = query.eq('status', 'active');
        }

        let data: any[] | null = null;
        let error: any = null;

        const result = await query;
        data = result.data;
        error = result.error;

        // If credit_price column doesn't exist yet, fall back to basic data
        if (error && error.message.includes('credit_price')) {
          console.log('credit_price column not found in fetchCategories, falling back to basic data');
          let fallbackQuery = supabase
            .from('categories')
            .select(`
              id,
              name,
              description,
              status,
              account_id,
              instance_type,
              categories_subcategories (
                id,
                subcategory,
                description,
                status,
                instance_type,
                email_lead_price,
                phone_lead_price
              )
            `)
            .order('name');

          if (accountId) {
            fallbackQuery = fallbackQuery.or(`status.eq.active,account_id.eq.${accountId}`);
          } else {
            fallbackQuery = fallbackQuery.eq('status', 'active');
          }
          
          const fallbackResult = await fallbackQuery;
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) {
          setError('Failed to load categories');
          setLoading(false);
          return;
        }

        const mappedCategories = (data || []).map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          instance_type: cat.instance_type,
          subcategories: Array.isArray(cat.categories_subcategories) 
            ? cat.categories_subcategories.filter((sub: any) => {
                if (sub.status !== 'active') return false;
                if (!instanceType) return true;
                // Show if subcategory has no instance_type or matches selection
                const subType = sub.instance_type;
                return subType === null || subType === 'both' || subType === instanceType;
              })
            : [],
        }))
        .filter((cat: any) => {
          if (!instanceType) return true;
          // Show category if it has no type or matches selection
          const catType = cat.instance_type;
          return catType === null || catType === 'both' || catType === instanceType;
        });

        setCategories(mappedCategories);
        setLoading(false);
      } catch (err) {
        setError('Failed to load categories');
        setLoading(false);
      }
    };

    fetchCategories();
  }, [accountId, supabase, instanceType]);

  const refreshSubcategoriesForCategory = async (categoryId: string) => {
    try {
      // First try to get all data including credit_price
      let subcategories: any[] | null = null;
      let error: any = null;

      const result = await supabase
        .from('categories_subcategories')
        .select(`
          id,
          subcategory,
          description,
          status,
          account_id,
          instance_type,
          credit_price
        `)
        .eq('category_id', categoryId);

      subcategories = result.data;
      error = result.error;

      // If credit_price column doesn't exist yet, fall back to basic data
      if (error && error.message.includes('credit_price')) {
        console.log('credit_price column not found in refreshSubcategoriesForCategory, falling back to basic data');
        const fallbackResult = await supabase
          .from('categories_subcategories')
          .select(`
            id,
            subcategory,
            description,
            status,
            account_id,
            instance_type
          `)
          .eq('category_id', categoryId);
        
        subcategories = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('Error fetching subcategories:', error);
        return [];
      }

      // Filter subcategories based on the rule
      let filteredSubcategories = (subcategories || []).filter(sub => {
        const isActiveGlobal = sub.status === 'active' && sub.account_id === null;
        const isAccountCustom = sub.account_id === accountId;
        return isActiveGlobal || isAccountCustom;
      });

      // Apply instance type filtering consistent with category filtering
      if (instanceType) {
        filteredSubcategories = filteredSubcategories.filter(sub => {
          const subType = sub.instance_type;
          return subType === null || subType === 'both' || subType === instanceType;
        });
      }

      return filteredSubcategories;
    } catch (error) {
      console.error('Error refreshing subcategories:', error);
      return [];
    }
  };

  const handleCategorySelect = async (category: CategoryWithSubcategories) => {
    // First set the category to show loading state
    setSelectedCategory(category);
    
    // Refresh only the subcategories for this category
    const freshSubcategories = await refreshSubcategoriesForCategory(category.id);
    
    // Update the category with fresh subcategories
    const updatedCategory = {
      ...category,
      subcategories: freshSubcategories
    };
    
    setSelectedCategory(updatedCategory);
    
    // Pre-select existing services from this category
    const existingSubcategoryIds = currentInstanceSubcategories
      .filter(sub => sub.category?.id === category.id)
      .map(sub => sub.id);
    
    setSelectedSubcategories(existingSubcategoryIds);
  };

  const handleSubcategoryToggle = (subcategoryId: string) => {
    if (propSelectedServices) {
      // Staging area mode - when propSelectedServices is provided, use the parent's callbacks
      const subcategory = selectedCategory?.subcategories.find(sub => sub.id === subcategoryId);
      if (!subcategory) return;
      
      const isSelected = propSelectedServices.some(service => service.id === subcategoryId);
      
      if (isSelected) {
        // Don't allow removing if it's the last service
        if (propSelectedServices.length <= 1) {
          toast({
            title: "Cannot remove service",
            description: "At least one service must be selected",
            variant: "destructive",
          });
          return;
        }
        // Remove from staging area
        onRemoveService?.(subcategoryId);
      } else {
        // Add to staging area - need to call parent to add this service
        const newService = {
          id: subcategory.id,
          subcategory: subcategory.subcategory,
          description: subcategory.description ?? null
        };
        // We need to add this to the parent's selectedServices
        // This will be handled by the parent's onAccumulatedServicesChange
        if (onAccumulatedServicesChange) {
          const updatedServices = [...propSelectedServices, newService];
          onAccumulatedServicesChange(updatedServices);
        }
      }
    } else if (instanceId) {
      // Original instance mode logic
      setSelectedSubcategories(prev => {
        const isCurrentlySelected = prev.includes(subcategoryId);
        
        if (isCurrentlySelected) {
          // Don't allow deselecting if it's the last selected item
          if (prev.length <= 1) {
            toast({
              title: "Cannot remove service",
              description: "At least one service must be selected",
              variant: "destructive",
            });
            return prev;
          }
          return prev.filter(id => id !== subcategoryId);
        } else {
          return [...prev, subcategoryId];
        }
      });
    } else {
      // New instance creation mode - handle accumulated services
      const subcategory = selectedCategory?.subcategories.find(sub => sub.id === subcategoryId);
      if (!subcategory) return;
      
      const isSelected = accumulatedServices.some(service => service.id === subcategoryId);
      
      if (isSelected) {
        removeFromAccumulated(subcategoryId);
      } else {
        addToAccumulated(subcategory);
      }
    }
  };

  const handleSelectAll = () => {
    if (!selectedCategory) return;
    
    if (propSelectedServices) {
      // Staging area mode - handle select all for staging area
      const allSelected = selectedCategory.subcategories.every(sub => 
        propSelectedServices.some(service => service.id === sub.id)
      );
      
      if (allSelected) {
        // Deselect all from this category
        const updatedServices = propSelectedServices.filter(service => 
          !selectedCategory.subcategories.some(sub => sub.id === service.id)
        );
        onAccumulatedServicesChange?.(updatedServices);
      } else {
        // Select all from this category
        const newServices = selectedCategory.subcategories.map(sub => ({
          id: sub.id,
          subcategory: sub.subcategory,
          description: sub.description ?? null
        }));
        const updatedServices = [...propSelectedServices, ...newServices.filter(newService => 
          !propSelectedServices.some(existing => existing.id === newService.id)
        )];
        onAccumulatedServicesChange?.(updatedServices);
      }
      return;
    }
    
    // If not in instance mode, handle accumulated services
    if (!instanceId) {
      const allSelected = selectedCategory.subcategories.every(sub => 
        accumulatedServices.some(service => service.id === sub.id)
      );
      
      if (allSelected) {
        // Deselect all from this category
        selectedCategory.subcategories.forEach(sub => {
          removeFromAccumulated(sub.id);
        });
      } else {
        // Select all from this category
        selectedCategory.subcategories.forEach(sub => {
          addToAccumulated(sub);
        });
      }
      return;
    }
    
    // Original instance mode logic
    // If all are selected, deselect all except one (to maintain minimum requirement)
    if (selectedSubcategories.length === selectedCategory.subcategories.length) {
      const firstSubcategoryId = selectedCategory.subcategories[0]?.id;
      setSelectedSubcategories(firstSubcategoryId ? [firstSubcategoryId] : []);
    } else {
      // Otherwise, select all
      const allSubcategoryIds = selectedCategory.subcategories.map(sub => sub.id);
      setSelectedSubcategories(allSubcategoryIds);
    }
  };

  // Call onSelect when subcategories change (for new instance creation)
  useEffect(() => {
    if (onSelect && selectedCategory && selectedSubcategories.length > 0) {
      // Create a category object with only the selected subcategories
      const selectedSubcategoryObjects = selectedCategory.subcategories.filter(sub => 
        selectedSubcategories.includes(sub.id)
      );
      
      const categoryWithSelectedSubs = {
        ...selectedCategory,
        subcategories: selectedSubcategoryObjects
      };
      
      onSelect(categoryWithSelectedSubs);
    } else if (onSelect && selectedCategory && selectedSubcategories.length === 0) {
      // Report cleared industry with empty subcategories, so parent can remove only this industry's services
      const clearedCategory = {
        ...selectedCategory,
        subcategories: []
      } as CategoryWithSubcategories;
      onSelect(clearedCategory);
    }
  }, [selectedSubcategories, selectedCategory, onSelect]);

  // Call onAccumulatedServicesChange when accumulated services change (for new instance creation)
  useEffect(() => {
    if (onAccumulatedServicesChange && !instanceId) {
      onAccumulatedServicesChange(accumulatedServices);
    }
  }, [accumulatedServices, onAccumulatedServicesChange, instanceId]);

  const saveSelection = async () => {
    if (!session?.user || !supabase) {
      toast({
        title: "Error",
        description: "You must be logged in to save categories",
        variant: "destructive",
      });
      return;
    }

    if (!instanceId || typeof instanceId !== 'string') {
      toast({
        title: "Error",
        description: "No instance ID provided for saving categories",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCategory) {
      toast({
        title: "Error",
        description: "No industry selected",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Only modify selections that belong to the currently selected industry
      const categorySubcategoryIds = (selectedCategory.subcategories || []).map(sub => sub.id);

      if (categorySubcategoryIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('instance_subcategories')
          .delete()
          .eq('instance_id', instanceId)
          .in('category_subcategory_id', categorySubcategoryIds);

        if (deleteError) throw deleteError;
      }

      // Insert new selections
      if (selectedSubcategories.length > 0) {
        const insertData = selectedSubcategories.map(subcategoryId => ({
          instance_id: instanceId,
          category_subcategory_id: subcategoryId,
        }));

        const { error: insertError } = await supabase
          .from('instance_subcategories')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      // Reload current instance subcategories
      const { data: reloadData, error: reloadError } = await supabase
        .from('instance_subcategories')
        .select(`
          category_subcategory_id,
          categories_subcategories (
            id,
            subcategory,
            description,
            categories (
              id,
              name,
              description
            )
          )
        `)
        .eq('instance_id', instanceId);

      if (reloadError) throw reloadError;

      const reloadedSubcategories = reloadData?.map(item => ({
        id: item.categories_subcategories.id,
        subcategory: item.categories_subcategories.subcategory,
        description: item.categories_subcategories.description,
        category: item.categories_subcategories.categories
      })) || [];

      setCurrentInstanceSubcategories(reloadedSubcategories);

      toast({
        title: "Success",
        description: "Categories saved successfully!",
      });

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save categories');
      toast({
        title: "Error",
        description: "Failed to save categories",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeSubcategory = async (subcategoryId: string) => {
    if (!instanceId) return;

    try {
      const { error } = await supabase
        .from('instance_subcategories')
        .delete()
        .eq('instance_id', instanceId)
        .eq('category_subcategory_id', subcategoryId);

      if (error) throw error;

      setCurrentInstanceSubcategories(prev => 
        prev.filter(sub => sub.id !== subcategoryId)
      );

      toast({
        title: "Success",
        description: "Service removed successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
    }
  };

  // For new instance creation, handle selection
  const handleCategoryClick = (category: CategoryWithSubcategories) => {
    if (onSelect) {
      onSelect(category);
    }
  };

  // Category management functions
  const createCategory = async () => {
    if (!accountId || !categoryName.trim() || !categoryDescription.trim()) return;

    setSaving(true);
    try {
      // Use Supabase client directly instead of fetch
      const { data: category, error } = await supabase
        .from('categories')
        .insert({
          name: categoryName.trim(),
          description: categoryDescription.trim(),
          user_id: session?.user?.id,
          account_id: accountId,
          status: 'verification_needed',
          instance_type: instanceType || null
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create category",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Category created successfully and is pending verification",
      });
      setShowCategoryDialog(false);
      setCategoryName('');
      setCategoryDescription('');
      
      // Refresh categories
      refreshCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createSubcategory = async () => {
    if (!accountId || !selectedCategoryId || !subcategoryName.trim() || !subcategoryDescription.trim()) return;
    
    setSaving(true);
    try {
      // First get the category name
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('name')
        .eq('id', selectedCategoryId)
        .single();

      if (categoryError || !category) {
        toast({
          title: "Error",
          description: "Category not found",
          variant: "destructive",
        });
        return;
      }

      // Use Supabase client directly instead of fetch
      const { data: subcategory, error } = await supabase
        .from('categories_subcategories')
        .insert({
          subcategory: subcategoryName.trim(),
          description: subcategoryDescription.trim(),
          category_id: selectedCategoryId,
          user_id: session?.user?.id,
          account_id: accountId,
          status: 'verification_needed',
          instance_type: instanceType || null
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create subcategory",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Subcategory created successfully and is pending verification",
      });
      setShowSubcategoryDialog(false);
      setSubcategoryName('');
      setSubcategoryDescription('');
      setSelectedCategoryId('');
      
      // Refresh categories
      refreshCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create subcategory",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSubcategory = async (subcategoryId: string) => {
    if (!accountId) return;
    
    setSaving(true);
    try {
      // Use Supabase client directly instead of fetch
      const { error } = await supabase
        .from('categories_subcategories')
        .delete()
        .eq('id', subcategoryId)
        .eq('account_id', accountId);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete subcategory",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Subcategory deleted successfully",
      });
      
      // Refresh categories
      refreshCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete subcategory",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!accountId) return;
    
    setSaving(true);
    try {
      // Use Supabase client directly instead of fetch
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('account_id', accountId);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete category",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      
      // Refresh categories
      refreshCategories();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'pending_approval':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isAccountLevel = (item: { account_id?: string | null }) => {
    return item.account_id !== null && item.account_id !== undefined;
  };

  const isOwner = (item: { account_id?: string | null }) => {
    return item.account_id === accountId;
  };

  const deleteCustomService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('categories_subcategories')
        .delete()
        .eq('id', serviceId)
        .eq('account_id', accountId || ''); // Ensure user can only delete their own services

      if (error) {
        console.error('Error deleting custom service:', error);
        toast({
          title: "Error",
          description: "Failed to delete custom service. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Remove from accumulated services if it's there
      setAccumulatedServices(prev => prev.filter(service => service.id !== serviceId));
      
      // Refresh categories to update the UI
      await refreshCategories();
      
      toast({
        title: "Custom Service Deleted",
        description: "The custom service has been removed.",
      });
    } catch (error) {
      console.error('Error deleting custom service:', error);
      toast({
        title: "Error",
        description: "Failed to delete custom service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const refreshCategories = async () => {
    try {
      let query = supabase
        .from('categories')
        .select(`
          id,
          name,
          description,
          status,
          account_id,
          instance_type,
          categories_subcategories (
            id,
            subcategory,
            description,
            status,
            account_id,
            instance_type,
            credit_price
          )
        `)
        .order('name');

        // Always show all active categories (global and account-specific)
        query = query.eq('status', 'active');

      let categoriesData: any[] | null = null;
      let error: any = null;

      const result = await query;
      categoriesData = result.data;
      error = result.error;

      // If credit_price column doesn't exist yet, fall back to basic data
      if (error && error.message.includes('credit_price')) {
        console.log('credit_price column not found in refreshCategories, falling back to basic data');
        let fallbackQuery = supabase
          .from('categories')
          .select(`
            id,
            name,
            description,
            status,
            account_id,
            instance_type,
            categories_subcategories (
              id,
              subcategory,
              description,
              status,
              account_id,
              instance_type
            )
          `)
          .order('name');

        fallbackQuery = fallbackQuery.eq('status', 'active');
        
        const fallbackResult = await fallbackQuery;
        categoriesData = fallbackResult.data;
        error = fallbackResult.error;
      }
      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
      

      const categoriesWithSubcategories = categoriesData?.map(category => {
        // Filter subcategories based on the rule:
        // Show if: (status = 'active' AND account_id = NULL) OR (account_id = current account)
        const allSubcategories = category.categories_subcategories || [];
        const filteredSubcategories = allSubcategories.filter((sub: any) => {
          const isActiveGlobal = sub.status === 'active' && sub.account_id === null;
          const isAccountCustom = sub.account_id === accountId;
          return isActiveGlobal || isAccountCustom;
        });
        
        return {
          ...category,
          subcategories: filteredSubcategories.map((sub: any) => ({
            ...sub
          }))
        };
      }) || [];

          // Sort categories: current account items first, then alphabetically
          const sortedCategories = categoriesWithSubcategories.sort((a, b) => {
            const aIsCurrentAccount = a.account_id === accountId;
            const bIsCurrentAccount = b.account_id === accountId;
            
            if (aIsCurrentAccount && !bIsCurrentAccount) return -1;
            if (!aIsCurrentAccount && bIsCurrentAccount) return 1;
            
            return a.name.localeCompare(b.name);
          });

          setCategories(sortedCategories);
      
      // Update selected category if we're in drill-down view
      if (selectedCategory) {
        const updatedSelectedCategory = categoriesWithSubcategories.find(cat => cat.id === selectedCategory.id);
        if (updatedSelectedCategory) {
          setSelectedCategory(updatedSelectedCategory);
        }
      }
    } catch (err) {
      setError('Failed to load categories');
    }
  };

  // Search for existing categories as user types
  const searchExistingCategories = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCategorySearchResults([]);
      return;
    }

    const filtered = categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setCategorySearchResults(filtered);
  };

  // Handle category name change with search
  const handleCategoryNameChange = (value: string) => {
    setCategoryName(value);
    searchExistingCategories(value);
  };

  // Search for existing subcategories as user types
  const searchExistingSubcategories = (searchTerm: string) => {
    if (!searchTerm.trim() || !selectedCategoryId) {
      setSubcategorySearchResults([]);
      return;
    }

    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
    if (!selectedCategory) {
      setSubcategorySearchResults([]);
      return;
    }

    const filtered = selectedCategory.subcategories.filter(subcategory =>
      subcategory.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcategory.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSubcategorySearchResults(filtered);
  };

  // Handle subcategory name change with search
  const handleSubcategoryNameChange = (value: string) => {
    setSubcategoryName(value);
    searchExistingSubcategories(value);
  };

  // Determine which services to show - prioritize propSelectedServices
  const displayServices = propSelectedServices || (instanceId ? currentInstanceSubcategories : accumulatedServices);
  const serviceCount = displayServices ? displayServices.length : 0;

  const flatServices = useMemo(() => {
    const out: Array<Subcategory & { categoryId: string }> = [];
    for (const category of categories) {
      for (const sub of category.subcategories || []) {
        out.push({ ...(sub as any), categoryId: category.id });
      }
    }
    return out;
  }, [categories]);

  const serviceById = useMemo(() => {
    const map = new Map<string, Subcategory & { categoryId: string }>();
    for (const s of flatServices) map.set(s.id, s);
    return map;
  }, [flatServices]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? flatServices.filter((s) => {
          const name = String(s.subcategory || "").toLowerCase();
          const cleaned = formatSubcategoryLabel(String(s.subcategory || "")).toLowerCase();
          const desc = String(s.description || "").toLowerCase();
          return name.includes(q) || cleaned.includes(q) || desc.includes(q);
        })
      : flatServices;
    return [...list].sort((a, b) => String(a.subcategory).localeCompare(String(b.subcategory)));
  }, [flatServices, searchQuery]);

  const suggestedServices = useMemo(() => {
    if (instanceId) return [];
    if (propSelectedServices) return [];
    if (accumulatedServices.length === 0) return [];

    const selectedIds = new Set(accumulatedServices.map((s) => s.id));
    const categoryCounts = new Map<string, number>();
    for (const sel of accumulatedServices) {
      const catId = (serviceById.get(sel.id) as any)?.categoryId as string | undefined;
      if (!catId) continue;
      categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
    }

    const candidates = flatServices.filter((s) => {
      const catId = (s as any).categoryId as string | undefined;
      return !!catId && categoryCounts.has(catId) && !selectedIds.has(s.id);
    });

    candidates.sort((a, b) => {
      const aCat = (a as any).categoryId as string;
      const bCat = (b as any).categoryId as string;
      const score = (categoryCounts.get(bCat) || 0) - (categoryCounts.get(aCat) || 0);
      if (score !== 0) return score;
      return String(a.subcategory).localeCompare(String(b.subcategory));
    });

    return candidates.slice(0, 6);
  }, [accumulatedServices, flatServices, instanceId, propSelectedServices, serviceById]);

  const toggleAccumulatedService = (serviceId: string) => {
    if (instanceId) return;
    if (propSelectedServices) return;
    const svc = serviceById.get(serviceId);
    if (!svc) return;
    const isSelected = accumulatedServices.some((s) => s.id === serviceId);
    if (isSelected) removeFromAccumulated(serviceId);
    else addToAccumulated(svc);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Categories...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Categories
          </CardTitle>
          <CardDescription className="text-destructive">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Flat service search + multi-select (used for new instance creation)
  if (variant === 'services' && !instanceId && !propSelectedServices) {
    const selectedIds = new Set(accumulatedServices.map((s) => s.id));
    const visible = searchQuery.trim().length > 0 ? filteredServices : filteredServices.slice(0, 100);
    const selectedPreview = accumulatedServices.slice(0, 12);
    const remainingSelectedCount = Math.max(0, accumulatedServices.length - selectedPreview.length);

    return (
      <div className="h-full flex flex-col min-h-0 max-h-full">
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="pb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold leading-none">
                Services
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {flatServices.length.toLocaleString()}
                </span>
              </div>
              {showCategoryManagement && (
                <Dialog
                  open={showCustomServiceDialog}
                  onOpenChange={(open) => {
                    setShowCustomServiceDialog(open);
                    if (!open) {
                      setSubcategoryName('');
                      setSubcategoryDescription('');
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedCategoryId('');
                        setSelectedCategoryForSubcategory(null);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Custom
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Service</DialogTitle>
                      <DialogDescription>
                        Add a custom service to an existing category. Choose the category that best fits your service.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedCategoryId}
                          onChange={(e) => setSelectedCategoryId(e.target.value)}
                          className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                          required
                          disabled={loading}
                        >
                          <option value="">
                            {loading ? "Loading categories..." : "Select a category..."}
                          </option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        {!loading && categories.length === 0 && (
                          <p className="text-xs text-red-500 mt-1">
                            No categories available. Please contact support.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Service Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={subcategoryName}
                          onChange={(e) => setSubcategoryName(e.target.value)}
                          placeholder="Enter service name"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Description <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                          value={subcategoryDescription}
                          onChange={(e) => setSubcategoryDescription(e.target.value)}
                          placeholder="Please provide a detailed description of this service"
                          rows={3}
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Required: Please provide a clear description so we can understand your service
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCustomServiceDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={createCustomService}
                        disabled={saving || !selectedCategoryId || !subcategoryName.trim() || !subcategoryDescription.trim()}
                      >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Add Service
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-sm rounded-full"
              />
            </div>

            {serviceCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">
                    Selected
                    <span className="ml-1 tabular-nums">({serviceCount})</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearAccumulated}
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {selectedPreview.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => removeFromAccumulated(service.id)}
                      className="group inline-flex shrink-0 items-center rounded-full bg-muted/70 px-2 py-1 text-[11px] text-foreground/90 hover:bg-muted"
                      title="Remove"
                    >
                      <span className="truncate max-w-[220px]">{formatSubcategoryLabel(service.subcategory)}</span>
                      <X className="ml-1 h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                    </button>
                  ))}
                  {remainingSelectedCount > 0 && (
                    <div className="shrink-0 rounded-full bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                      +{remainingSelectedCount} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
            {searchQuery.trim().length === 0 && suggestedServices.length > 0 ? (
              <div className="mb-2">
                <div className="px-1 text-xs font-medium text-muted-foreground">Suggested</div>
                <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1 px-1">
                  {suggestedServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleAccumulatedService(s.id)}
                      className="shrink-0 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                      title="Add"
                    >
                      + {formatSubcategoryLabel(s.subcategory)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {visible.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                No services found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {visible.map((service) => {
                  const checked = selectedIds.has(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleAccumulatedService(service.id)}
                      className="w-full py-2.5 text-left hover:bg-accent/40 rounded-md px-2 -mx-2 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleAccumulatedService(service.id)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground truncate">
                              {formatSubcategoryLabel(service.subcategory)}
                            </span>
                          </div>
                          {searchQuery.trim().length > 0 && service.description ? (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {service.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show subcategories view when a category is selected
  if (selectedCategory) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{selectedCategory.name}</CardTitle>
              <CardDescription>
                {selectedCategory.description || "Select the services you provide"}
              </CardDescription>
            </div>
            {showCategoryManagement && instanceId && (
              <Dialog open={showSubcategoryDialog} onOpenChange={(open) => {
                setShowSubcategoryDialog(open);
                if (!open) {
                  setSubcategorySearchResults([]);
                  setSubcategoryName('');
                  setSubcategoryDescription('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setSelectedCategoryId(selectedCategory.id);
                      setSelectedCategoryForSubcategory(selectedCategory);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Subcategory
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Subcategory</DialogTitle>
                    <DialogDescription>
                      Search for existing subcategories first, or create a new one if none exist. This helps keep our database organized.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Subcategory Name</label>
                      <Input
                        value={subcategoryName}
                        onChange={(e) => handleSubcategoryNameChange(e.target.value)}
                        placeholder="Enter subcategory name"
                      />
                      {subcategorySearchResults.length > 0 && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                          <p className="text-xs font-medium text-blue-700 mb-2">
                            🎯 Existing subcategories found - Please select one:
                          </p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {subcategorySearchResults.map((subcategory) => (
                              <div key={subcategory.id} className="flex items-center justify-between p-2 bg-background rounded border border-blue-100">
                                <div className="flex-1">
	                                  <p className="text-sm font-medium">{formatSubcategoryLabel(subcategory.subcategory)}</p>
                                  {subcategory.description && (
                                    <p className="text-xs text-muted-foreground">{subcategory.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isAccountLevel(subcategory) && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200">
                                      Custom
                                    </Badge>
                                  )}
                                  {isOwner(subcategory) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCustomService(subcategory.id);
                                      }}
                                      title="Delete custom service"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                                    onClick={() => {
                                      setShowSubcategoryDialog(false);
                                      setSubcategorySearchResults([]);
                                      setSubcategoryName('');
                                      setSubcategoryDescription('');
                                      toast({
                                        title: "Subcategory Found",
                                        description: `"${subcategory.subcategory}" already exists and is available for selection.`,
                                      });
                                    }}
                                  >
                                    Select This
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-blue-600 mt-2 font-medium">
                            💡 Selecting an existing subcategory helps keep our database organized and prevents duplicates.
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description <span className="text-red-500">*</span></label>
                      <Textarea
                        value={subcategoryDescription}
                        onChange={(e) => setSubcategoryDescription(e.target.value)}
                        placeholder="Please provide a detailed description of what this subcategory covers and the specific services it includes. This helps us understand and approve your subcategory."
                        rows={3}
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required: Please provide a clear description so we can understand your service subcategory
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createSubcategory} disabled={saving || !subcategoryName.trim() || !subcategoryDescription.trim()}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Create Subcategory
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        
        {/* Selected Services - only show when there are selections */}
        {serviceCount > 0 && (
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Selected Services ({serviceCount})
              </span>
              {propSelectedServices ? (
	                <button
	                  type="button"
	                  onClick={onClearAllServices}
	                  className="text-xs text-muted-foreground hover:text-foreground"
	                >
                  Clear All
                </button>
              ) : !instanceId && (
	                <button
	                  type="button"
	                  onClick={clearAccumulated}
	                  className="text-xs text-muted-foreground hover:text-foreground"
	                >
                  Clear All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {displayServices && displayServices.length > 0 ? displayServices
                .filter(service => {
                  // Filter out services that don't have the expected data structure
                  if (propSelectedServices) {
                    return service && service.id;
                  } else if (instanceId) {
                    return service && service.categories_subcategories && service.categories_subcategories.id;
                  }
                  return service && service.id;
                })
                .map((service) => {
                  let serviceData, serviceId, serviceName, serviceAccountId;
                  
                  if (propSelectedServices) {
                    // propSelectedServices format: {id, subcategory, description}
                    serviceData = service;
                    serviceId = service.id;
                    serviceName = service.subcategory;
                    serviceAccountId = (service as any).account_id;
                  } else if (instanceId) {
                    // currentInstanceSubcategories format: {categories_subcategories: {id, subcategory, description, account_id}}
                    serviceData = service.categories_subcategories;
                    serviceId = serviceData.id;
                    serviceName = serviceData.subcategory;
                    serviceAccountId = serviceData.account_id;
                  } else {
                    // accumulatedServices format: {id, subcategory, description, account_id}
                    serviceData = service;
                    serviceId = service.id;
                    serviceName = service.subcategory;
                    serviceAccountId = service.account_id;
                  }
                
	                  return (
	                    <div 
	                      key={serviceId} 
	                      className="group inline-flex items-center bg-muted rounded-full px-2 py-1 text-xs"
	                    >
	                      <span className="text-foreground">{formatSubcategoryLabel(serviceName)}</span>
	                      {serviceAccountId && isOwner({ account_id: serviceAccountId }) && (
	                        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
	                          Custom
	                        </Badge>
	                      )}
	                      {propSelectedServices ? (
	                        <button
	                          type="button"
	                          onClick={() => onRemoveService?.(serviceId)}
	                          className="ml-1.5 h-3 w-3 rounded-full hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
	                        >
	                          <X className="h-2 w-2 text-red-500" />
	                        </button>
	                      ) : !instanceId && (
	                        <button
	                          type="button"
	                          onClick={() => removeFromAccumulated(serviceId)}
	                          className="ml-1.5 h-3 w-3 rounded-full hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
	                        >
	                          <X className="h-2 w-2 text-red-500" />
                        </button>
                      )}
                    </div>
                  );
                }) : (
                  <div className="text-sm text-muted-foreground italic">
                    No services selected yet. Choose services below to add them.
                  </div>
                )}
            </div>
          </div>
        </div>
        )}
        
        <CardContent className="space-y-4">


          {/* Back Button */}
          <div className="flex items-center justify-between px-2 py-1.5 text-sm text-muted-foreground border-b">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={propSelectedServices ? 
                    (selectedCategory.subcategories.length > 0 && selectedCategory.subcategories.every(sub => propSelectedServices.some(service => service.id === sub.id))) :
                    (instanceId ? 
                      (selectedCategory.subcategories.length > 0 && selectedSubcategories.length === selectedCategory.subcategories.length) :
                      (selectedCategory.subcategories.length > 0 && selectedCategory.subcategories.every(sub => accumulatedServices.some(service => service.id === sub.id)))
                    )
                  }
                  onCheckedChange={handleSelectAll}
              />
              <span>Select All Services</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSubcategories([]);
              }}
              className="h-8 px-3 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Categories
            </Button>
          </div>

          {/* Subcategories List */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {selectedCategory.subcategories.map((subcategory: any) => (
              <div key={subcategory.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
                <Checkbox
                  checked={propSelectedServices ? 
                    propSelectedServices.some(service => service.id === subcategory.id) :
                    (instanceId ? 
                      selectedSubcategories.includes(subcategory.id) :
                      accumulatedServices.some(service => service.id === subcategory.id)
                    )
                  }
                  onCheckedChange={() => handleSubcategoryToggle(subcategory.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
	                    <span className="text-sm">{formatSubcategoryLabel(subcategory.subcategory)}</span>
                    {isAccountLevel(subcategory) && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200">
                        Custom
                      </Badge>
                    )}
                    {isOwner(subcategory) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomService(subcategory.id);
                        }}
                        title="Delete custom service"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {showLeadPrices && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        Credits: {Number(subcategory?.credit_price ?? 1)} per generation
                      </span>
                    )}
                  </div>
                  {subcategory.description && (
                    <p className="text-xs text-muted-foreground">{subcategory.description}</p>
                  )}
                </div>
                {accumulatedServices.some(service => service.id === subcategory.id) && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>

          {/* Save Button */}
          {instanceId && !hideSaveButton && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">
                    Selected: {selectedSubcategories.length} services
                  </p>
                  <p className="text-xs text-muted-foreground">
                    These will be available for image generation in this instance
                  </p>
                </div>
              </div>

              <Button
                onClick={saveSelection}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Save Selection
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 min-h-0 max-h-full">
  {/* Selected Services - only show when there are selections */}
  {serviceCount > 0 && (
  <div key={`selected-services-main-${serviceCount}`} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Selected Services ({serviceCount})
            </span>
            {propSelectedServices ? (
	              <button
	                type="button"
	                onClick={onClearAllServices}
	            className="text-xs text-muted-foreground hover:text-foreground"
	              >
                Clear All
              </button>
            ) : !instanceId && (
	              <button
	                type="button"
	                onClick={clearAccumulated}
	            className="text-xs text-muted-foreground hover:text-foreground"
	              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
            {displayServices && displayServices.length > 0 ? displayServices
              .filter(service => {
                // Filter out services that don't have the expected data structure
                if (propSelectedServices) {
                  return service && service.id;
                } else if (instanceId) {
                  return service && service.categories_subcategories && service.categories_subcategories.id;
                }
                return service && service.id;
              })
              .map((service) => {
                let serviceData, serviceId, serviceName, serviceAccountId;
                
                if (propSelectedServices) {
                  // propSelectedServices format: {id, subcategory, description}
                  serviceData = service;
                  serviceId = service.id;
                  serviceName = service.subcategory;
                  serviceAccountId = (service as any).account_id;
                } else if (instanceId) {
                  // currentInstanceSubcategories format: {categories_subcategories: {id, subcategory, description, account_id}}
                  serviceData = service.categories_subcategories;
                  serviceId = serviceData.id;
                  serviceName = serviceData.subcategory;
                  serviceAccountId = serviceData.account_id;
                } else {
                  // accumulatedServices format: {id, subcategory, description, account_id}
                  serviceData = service;
                  serviceId = service.id;
                  serviceName = service.subcategory;
                  serviceAccountId = service.account_id;
                }
              
	              return (
	                <div 
	                  key={serviceId} 
	                  className="group inline-flex items-center bg-muted rounded-full px-2 py-1 text-xs"
	                >
	                  <span className="text-foreground">{formatSubcategoryLabel(serviceName)}</span>
	                  {serviceAccountId && isOwner({ account_id: serviceAccountId }) && (
	                    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
	                      Custom
	                    </Badge>
	                  )}
	                  {propSelectedServices ? (
	                    <button
	                      type="button"
	                      onClick={() => onRemoveService?.(serviceId)}
	                      className="ml-1.5 h-3 w-3 rounded-full hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
	                    >
	                      <X className="h-2 w-2 text-red-500" />
	                    </button>
	                  ) : !instanceId && (
	                    <button
	                      type="button"
	                      onClick={() => removeFromAccumulated(serviceId)}
	                      className="ml-1.5 h-3 w-3 rounded-full hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
	                    >
	                      <X className="h-2 w-2 text-red-500" />
	                    </button>
	                  )}
	                </div>
	              );
            }) : (
              <div className="text-sm text-muted-foreground italic">
                No services selected yet. Choose a category below to add services.
              </div>
            )}
          </div>
        </div>
        )}


      {/* Industry Selection */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Industries</CardTitle>
            {!instanceId && !selectedCategory && (
              <Dialog open={showCustomServiceDialog} onOpenChange={(open) => {
                setShowCustomServiceDialog(open);
                if (!open) {
                  setSubcategoryName('');
                  setSubcategoryDescription('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => {
                      setSelectedCategoryId('');
                      setSelectedCategoryForSubcategory(null);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Custom Service
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Service</DialogTitle>
                    <DialogDescription>
                      Add a custom service to an existing category. Choose the category that best fits your service.
                    </DialogDescription>
                  </DialogHeader>
                  {/* Debug info removed */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Category <span className="text-red-500">*</span></label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        required
                        disabled={loading}
                      >
                        <option value="">
                          {loading ? "Loading categories..." : "Select a category..."}
                        </option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {!loading && categories.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          No categories available. Please contact support.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Service Name <span className="text-red-500">*</span></label>
                      <Input
                        value={subcategoryName}
                        onChange={(e) => setSubcategoryName(e.target.value)}
                        placeholder="Enter service name"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description <span className="text-red-500">*</span></label>
                      <Textarea
                        value={subcategoryDescription}
                        onChange={(e) => setSubcategoryDescription(e.target.value)}
                        placeholder="Please provide a detailed description of this service"
                        rows={3}
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required: Please provide a clear description so we can understand your service
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCustomServiceDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createCustomService} disabled={saving || !selectedCategoryId || !subcategoryName.trim() || !subcategoryDescription.trim()}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Add Service
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3 min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Input
              placeholder="Search industries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          
          {/* Categories List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {categories
              .filter((category) => 
                category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                category.description?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((category) => (
                <div 
                  key={category.id} 
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
                  onClick={() => handleCategorySelect(category)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{category.name}</h3>
                      {isAccountLevel(category) && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200">
                          Custom
                        </Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {category.subcategories.length} services
                    </Badge>
                    {showCategoryManagement && isAccountLevel(category) && category.status === 'verification_needed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(category.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                </div>
              ))}
            
            {categories.filter((category) => 
              category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              category.description?.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && searchQuery && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No industries found matching "{searchQuery}"
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
