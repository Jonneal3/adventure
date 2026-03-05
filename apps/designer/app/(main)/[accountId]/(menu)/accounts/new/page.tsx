"use client";
import { PageHeader } from '@/components/layout/PageHeader';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, ArrowLeft, Loader2 } from 'lucide-react';

export default function NewAccountPage() {
  const [accountName, setAccountName] = useState('');
  const [accountSlug, setAccountSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const { session } = useAuth();
  const { setCurrentAccount } = useAccount();
  const router = useRouter();
  const { toast } = useToast();

  // Auto-generate slug from account name
  const handleAccountNameChange = (name: string) => {
    setAccountName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setAccountSlug(slug);
  };

  const createAccount = async () => {
    if (!accountName.trim()) {
      toast({
        title: "Error",
        description: "Account name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/accounts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName,
          accountSlug,
          description: description || `Account for ${accountName}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }

      const { account, message } = await response.json();

      toast({
        title: "Account created!",
        description: message || `Welcome to ${accountName}!`,
      });

      setCurrentAccount(account);

      // Redirect to the new account's designer instances
      router.push(`/${account.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Create New Account"
          description="Set up a new account for your team or organization"
          actions={
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name *</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => handleAccountNameChange(e.target.value)}
                  placeholder="Enter account name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-slug">Account Slug</Label>
                <Input
                  id="account-slug"
                  value={accountSlug}
                  onChange={(e) => setAccountSlug(e.target.value)}
                  placeholder="account-slug"
                />
                <p className="text-xs text-muted-foreground">
                  This will be used in URLs. Auto-generated from account name.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this account"
                />
              </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                onClick={createAccount}
                disabled={loading || !accountName.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@adventure.app" className="text-primary hover:underline">
              support@adventure.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 
