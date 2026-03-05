"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Image, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WidgetProps {
  instanceId: string;
}

export function Widget({ instanceId }: WidgetProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [instance, setInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = useSupabaseClientWithAuth();
  const { session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!instanceId || !supabase) return;
    
    const fetchInstance = async () => {
      try {
        setLoading(true);
        
        const { data: instanceData, error: instanceError } = await supabase
          .from('instances')
          .select('*')
          .eq('id', instanceId)
          .single();

        if (instanceError) throw instanceError;

        if (instanceData) {
          setInstance(instanceData);
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load widget configuration",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();
  }, [instanceId, supabase, toast]);

  const generateImage = async () => {
    if (!session?.user || !supabase || !prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt and ensure you're logged in",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          instanceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const result = await response.json();
      setGeneratedImage(result.imageUrl);
      
      toast({
        title: "Success",
        description: "Image generated successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading widget...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!instance) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-center text-destructive">
            Widget configuration not found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{instance.name}</CardTitle>
        {instance.description && (
          <CardDescription>{instance.description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prompt">Describe what you want to see</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your image description..."
            rows={3}
            disabled={generating}
          />
        </div>

        <Button
          onClick={generateImage}
          disabled={generating || !prompt.trim()}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Generate Image
            </>
          )}
        </Button>

        {generatedImage && (
          <div className="space-y-2">
            <Label>Generated Image</Label>
            <div className="relative">
              <img
                src={generatedImage}
                alt="Generated image"
                className="w-full rounded-lg border"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}