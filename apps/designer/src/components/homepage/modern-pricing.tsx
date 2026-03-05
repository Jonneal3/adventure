"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';

interface Plan {
  plan_id: string;
  name: string;
  monthly_price_cents: number | null;
  ai_credits_included: number;
  additional_credit_price: number | null;
  max_widgets: number | null;
  analytics_level: string | null;
  api_access: boolean | null;
  white_label: boolean | null;
  support_level: string | null;
}

export function ModernPricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabaseClientWithAuth();
  const { session } = useAuth();

  useEffect(() => {
    if (!supabase) return;
    
    const fetchPlans = async () => {
      try {
        setLoading(true);
        
        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .order('monthly_price_cents');

        if (plansError) throw plansError;

        if (plansData) {
          setPlans(plansData);
        }
      } catch (err) {
        setError('Failed to load pricing plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-xl text-muted-foreground">
          Choose the plan that's right for your business
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {plans.map((plan) => (
          <Card key={plan.plan_id} className="relative">
            {plan.name.toLowerCase().includes('pro') && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>
                {plan.monthly_price_cents ? (
                  <span className="text-3xl font-bold">
                    ${(plan.monthly_price_cents / 100).toFixed(0)}
                    <span className="text-lg font-normal text-muted-foreground">/month</span>
                  </span>
                ) : (
                  <span className="text-3xl font-bold text-green-600">Free</span>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.ai_credits_included} AI credits included</span>
                </div>
                
                {plan.max_widgets && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Up to {plan.max_widgets} widgets</span>
                  </div>
                )}
                
                {plan.analytics_level && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{plan.analytics_level} analytics</span>
                  </div>
                )}
                
                {plan.api_access && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>API access</span>
                  </div>
                )}
                
                {plan.white_label && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>White label</span>
                  </div>
                )}
                
                {plan.support_level && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{plan.support_level} support</span>
                  </div>
                )}
              </div>

              {plan.additional_credit_price && (
                <div className="text-sm text-muted-foreground text-center pt-4 border-t">
                  Additional credits: ${(plan.additional_credit_price / 100).toFixed(2)} each
                </div>
              )}

              <Button className="w-full" variant={plan.name.toLowerCase().includes('pro') ? "default" : "outline"}>
                {session ? 'Get Started' : 'Sign Up'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



