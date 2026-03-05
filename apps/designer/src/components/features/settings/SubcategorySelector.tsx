"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Subcategory {
  id: string;
  subcategory: string;
}

interface SubcategorySelectorProps {
  instanceId: string;
  selectedSubcategoryId: string | null;
  onSubcategoryChange: (subcategoryId: string | null, subcategoryData?: any) => void;
}

export function SubcategorySelector({ 
  instanceId, 
  selectedSubcategoryId, 
  onSubcategoryChange 
}: SubcategorySelectorProps) {
  const [subcategories, setSubcategories] = React.useState<Subcategory[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch subcategories for this instance
  const fetchSubcategories = React.useCallback(async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/instances/${instanceId}/subcategories`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(data.subcategories || []);
      } else {
        setSubcategories([]);
      }
    } catch (error) {
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  React.useEffect(() => {
    fetchSubcategories();
  }, [fetchSubcategories]);

  const handleSubcategoryClick = (subcategory: Subcategory) => {
    if (selectedSubcategoryId === subcategory.id) {
      // Deselect if already selected
      onSubcategoryChange(null);
    } else {
      // Select new subcategory
      onSubcategoryChange(subcategory.id, subcategory);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/90">Subcategory</Label>
      <div className="relative">
        <Select
          value={selectedSubcategoryId ?? 'all'}
          onValueChange={(v) => {
            if (v === 'all') {
              onSubcategoryChange(null, undefined);
              return;
            }
            const picked = subcategories.find((s) => s.id === v);
            if (picked) handleSubcategoryClick(picked);
          }}
          disabled={loading || subcategories.length === 0}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="All subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subcategories</SelectItem>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory.id} value={subcategory.id}>
                {subcategory.subcategory}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading ? (
          <div className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
        ) : null}
      </div>
    </div>
  );
} 