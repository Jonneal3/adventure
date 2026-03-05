"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';

interface Subcategory {
  id: string;
  subcategory: string;
}

interface InstanceSubcategory {
  category_subcategory_id: string;
  categories_subcategories: {
    id: string;
    subcategory: string;
    category_id: string;
    categories: {
      name: string;
    };
  };
}

export function SubcategoryGalleryGenerator({
  instanceId,
  onComplete,
}: {
  instanceId: string;
  onComplete?: () => void;
}) {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [userCredits, setUserCredits] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const supabase = useSupabaseClientWithAuth();
  const { session } = useAuth();
  const { currentAccount } = useAccount();

  useEffect(() => {
    if (!instanceId || !supabase) return;
    
    const fetchSubcategories = async () => {
      try {
        setLoading(true);
        
        // Get subcategories for this instance
        const { data: instanceSubcategories, error: subError } = await supabase
          .from('instance_subcategories')
          .select(`
            category_subcategory_id,
            categories_subcategories (
              id,
              subcategory,
              category_id,
              categories (
                name
              )
            )
          `)
          .eq('instance_id', instanceId);

        if (subError) throw subError;

        if (instanceSubcategories) {
          const subcats = instanceSubcategories.map((item: InstanceSubcategory) => ({
            ...item.categories_subcategories,
          }));
          setSubcategories(subcats);
          setTotalCount(subcats.length);
        }
      } catch (err) {
        setError('Failed to load subcategories');
      } finally {
        setLoading(false);
      }
    };

    const fetchUserCredits = async () => {
      if (!session?.user || !currentAccount?.id) return;
      
      try {
        const response = await fetch(`/api/user-subscriptions/credits?accountId=${currentAccount.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const { credits } = await response.json();
          setUserCredits(credits || 0);
        } else {}
      } catch (err) {}
    };

    fetchSubcategories();
    fetchUserCredits();
  }, [instanceId, supabase, session, currentAccount]);

  const generateGallery = async () => {
    if (!session?.user || !supabase) {
      toast({
        title: "Error",
        description: "You must be logged in to generate galleries",
        variant: "destructive",
      });
      return;
    }

    if (userCredits < subcategories.length) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${subcategories.length} credits to generate this gallery. You have ${userCredits} credits.`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setProgress(0);
    setGeneratedCount(0);
    setError(null);

    try {
      for (let i = 0; i < subcategories.length; i++) {
        const subcategory = subcategories[i];
        
        // Generate images for this subcategory
        const response = await fetch('/api/generate-subcategory-gallery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId,
            subcategoryId: subcategory.id,
            subcategoryName: subcategory.subcategory,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate gallery for ${subcategory.subcategory}`);
        }

        setGeneratedCount(i + 1);
        setProgress(((i + 1) / subcategories.length) * 100);
      }

      toast({
        title: "Success",
        description: "Gallery generated successfully!",
      });

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate gallery');
      toast({
        title: "Error",
        description: "Failed to generate gallery",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Subcategories...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (subcategories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Subcategories Found</CardTitle>
          <CardDescription>
            This instance doesn't have any subcategories configured.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Subcategory Gallery Generator
        </CardTitle>
        <CardDescription>
          Generate AI images for all subcategories in this instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Subcategories: {subcategories.length}</p>
            <p className="text-sm text-muted-foreground">
              Credits required: {subcategories.length} | Available: {userCredits}
            </p>
          </div>
          <Badge variant={userCredits >= subcategories.length ? "default" : "destructive"}>
            {userCredits >= subcategories.length ? "Ready" : "Insufficient Credits"}
          </Badge>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {generating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Generating galleries...</span>
              <span>{generatedCount}/{totalCount}</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {subcategories.map((subcategory) => (
            <div
              key={subcategory.id}
              className="flex items-center gap-2 p-2 text-sm border rounded"
            >
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="truncate">{subcategory.subcategory}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={generateGallery}
          disabled={generating || userCredits < subcategories.length}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Gallery...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Generate Gallery ({subcategories.length} credits)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
} 