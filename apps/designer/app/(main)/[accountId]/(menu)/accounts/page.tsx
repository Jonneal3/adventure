"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Toggle } from '@/components/ui/toggle';
import {
  Plus,
  Building2,
  Crown,
  Shield,
  User,
  Trash2,
  Settings,
  CheckCircle,
  X,
  Loader2,
  Grid3X3,
  List,
  Edit
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsShell } from '@/components/layout/SettingsShell';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { Spinner } from '@/components/ui/spinner';

export default function AccountsPage() {
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountSlug, setAccountSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountSlug, setEditAccountSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { session } = useAuth();
  const { currentAccount, setCurrentAccount, refreshAccounts, userAccounts: contextUserAccounts } = useAccount();
  const router = useRouter();
  const params = useParams();
  const accountId = params?.accountId as string;
  const { toast } = useToast();
  const supabase = useSupabaseClientWithAuth();

  // Use context userAccounts if available, otherwise use local state
  const displayUserAccounts = contextUserAccounts || userAccounts;

  // Derive hasAccounts from context - show all user accounts, not just accepted ones
  const hasAccounts = displayUserAccounts && displayUserAccounts.length > 0;
  const sortedAccounts = useMemo(() => {
    const accounts = [...(displayUserAccounts || [])];
    accounts.sort((a: any, b: any) => {
      if (sortBy === 'name') {
        const an = (a.accounts?.name || '').toLowerCase();
        const bn = (b.accounts?.name || '').toLowerCase();
        if (an < bn) return sortDir === 'asc' ? -1 : 1;
        if (an > bn) return sortDir === 'asc' ? 1 : -1;
        return 0;
      } else {
        const ad = new Date(a.accounts?.created_at || a.created_at || 0).getTime();
        const bd = new Date(b.accounts?.created_at || b.created_at || 0).getTime();
        return sortDir === 'asc' ? ad - bd : bd - ad;
      }
    });
    return accounts;
  }, [displayUserAccounts, sortBy, sortDir]);

  // Auto-generate slug from account name
  useEffect(() => {
    if (accountName) {
      const slug = accountName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setAccountSlug(slug);
    }
  }, [accountName]);

  const createAccount = async () => {
    if (!session?.user) {
      toast({
        title: "Error",
        description: "You must be logged in to create an account",
        variant: "destructive",
      });
      return;
    }

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
      const response = await fetch('/api/accounts/create-with-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          name: accountName.trim(),
          slug: accountSlug,
          description: description.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === '23505' || (result.error && result.error.message && result.error.message.includes('duplicate key value'))) {
          toast({
            title: "Duplicate Slug",
            description: "An account with this slug already exists. Please choose a different slug.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        throw result.error || 'Failed to create account';
      }

      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      setAccountName('');
      setAccountSlug('');
      setDescription('');

      // Check if billing is required
      if (result.requiresBilling && result.redirectTo) {
        // Redirect to billing onboarding
        router.push(result.redirectTo);
        return;
      }

      // Immediately update the context with the new account
      const newUserAccount = {
        account_id: result.account.id,
        status: 'accepted',
        user_status: 'owner',
        accounts: result.account
      };

      // Update the context immediately
      await refreshAccounts();

      // Force a re-render by updating the local state
      setCheckingAccounts(true);
      setTimeout(() => setCheckingAccounts(false), 100);

      setShowCreateAccountForm(false); // Return to selection view after creation
      // No need to set hasAccounts, always derived from context
    } catch (error) {
      let errorMsg = '';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object') {
        errorMsg = JSON.stringify(error);
      } else {
        errorMsg = String(error);
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccountSelect = async (userAccount: any) => {
    if (userAccount.status === 'invited') {
      // Handle invitation acceptance
      try {
        const response = await fetch('/api/accounts/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: userAccount.account_id
          })
        });

        if (!response.ok) {
          throw new Error('Failed to accept invitation');
        }

        toast({
          title: "Invitation Accepted",
          description: `You've joined ${userAccount.accounts.name}!`,
        });

        // Refresh accounts to get updated status
        await refreshAccounts();

        // Set as current account and navigate
        setCurrentAccount(userAccount.accounts);
        router.push(`/${userAccount.account_id}`);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to accept invitation",
          variant: "destructive",
        });
      }
    } else if (userAccount.user_status === 'owner') {
      // Owner clicks to edit account
      openEditDialog(userAccount);
    } else {
      // Navigate to account management page for non-owners
      router.push(`/${userAccount.account_id}/accounts`);
    }
  };

  const selectAccount = (accountId: string) => {
    // Find the userAccount row
    const userAccount = displayUserAccounts.find(acc => acc.account_id === accountId);
    if (userAccount && userAccount.accounts) {
      const account = userAccount.accounts;
      // Set the current account in context
      setCurrentAccount({
        id: account.id,
        name: account.name,
        slug: account.slug,
        description: account.description || '',
        created_at: account.created_at,
        updated_at: account.updated_at,
      });
      // Build the target path - let the account-level subscription checking handle the rest
      const targetPath = `/${accountId}`;
      try {
        router.push(targetPath);
      } catch (error) {
        // Fallback to window.location
        window.location.href = targetPath;
      }
    } else {}
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const initials = parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('');
    return initials || (name[0] ? name[0].toUpperCase() : 'A');
  };

  const getStatusIcon = (userStatus: string) => {
    switch (userStatus) {
      case 'owner':
        return <Crown className="h-4 w-4 text-foreground" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-muted-foreground" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'border-border bg-muted text-foreground';
      case 'invited':
        return 'border-border bg-muted/40 text-muted-foreground';
      default:
        return 'border-border bg-muted/40 text-muted-foreground';
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount || !session?.user) return;
    
    setDeleteLoading(true);
    try {
      if (deletingAccount.user_status === 'owner') {
        // Owner is deleting the entire account
        const response = await fetch('/api/accounts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: deletingAccount.account_id })
        });
        
        const data = await response.json();
        if (response.ok) {
          toast({
            title: 'Account deleted',
            description: `${deletingAccount.accounts.name} and all its data have been permanently deleted`
          });
          
          // Check if we deleted the current account
          if (currentAccount && currentAccount.id === deletingAccount.account_id) {
            // Check if user has any other accounts
            const remainingAccounts = displayUserAccounts.filter(acc => acc.account_id !== deletingAccount.account_id);
            
            if (remainingAccounts.length === 0) {
              // No accounts left, sign out and redirect to auth
              await supabase.auth.signOut();
              router.push('/auth');
            } else {
              // Switch to another account
              const nextAccount = remainingAccounts[0];
              setCurrentAccount(nextAccount.accounts);
              router.push(`/${nextAccount.account_id}`);
            }
          } else {
            // Just refresh accounts if it wasn't the current one
            await refreshAccounts();
          }
          
          setShowDeleteDialog(false);
          setDeletingAccount(null);
        } else {
          throw new Error(data.error || 'Failed to delete account');
        }
      } else {
        // Admin/User is removing themselves from the account
        const response = await fetch('/api/accounts/remove-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userAccountId: deletingAccount.account_id,
            accountId: deletingAccount.account_id 
          })
        });
        
        const data = await response.json();
        if (response.ok) {
          toast({
            title: 'Removed from account',
            description: `You have been removed from ${deletingAccount.accounts.name}`
          });
          await refreshAccounts();
          setShowDeleteDialog(false);
          setDeletingAccount(null);
        } else {
          throw new Error(data.error || 'Failed to remove from account');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process request',
        variant: 'destructive'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteDialog = (userAccount: any) => {
    setDeletingAccount(userAccount);
    setShowDeleteDialog(true);
  };

  const openEditDialog = (userAccount: any) => {
    setEditingAccount(userAccount);
    setEditAccountName(userAccount.accounts.name || '');
    setEditAccountSlug(userAccount.accounts.slug || '');
    setEditDescription(userAccount.accounts.description || '');
    setShowEditDialog(true);
  };

  const handleEditAccount = async () => {
    if (!editingAccount || !session?.user) return;
    
    setEditLoading(true);
    try {
      const response = await fetch('/api/accounts/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: editingAccount.account_id,
          name: editAccountName.trim(),
          slug: editAccountSlug.trim(),
          description: editDescription.trim() || null
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'Account updated',
          description: `${editingAccount.accounts.name} has been updated successfully`
        });
        await refreshAccounts();
        setShowEditDialog(false);
        setEditingAccount(null);
        setEditAccountName('');
        setEditAccountSlug('');
        setEditDescription('');
      } else {
        throw new Error(data.error || 'Failed to update account');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update account',
        variant: 'destructive'
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Auto-generate slug from edit account name
  useEffect(() => {
    if (editAccountName) {
      const slug = editAccountName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setEditAccountSlug(slug);
    }
  }, [editAccountName]);

  if (!session) {
    return <FullPageLoader height="content" />;
  }

  return (
    <SettingsShell
      accountId={accountId}
      active="accounts"
      title="Settings"
      description="Accounts and memberships."
      actions={
        <Button
          onClick={() => setShowCreateAccountForm(true)}
          className="h-8 rounded-full px-3"
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">New</span>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={`${sortBy}:${sortDir}`}
          onValueChange={(value) => {
            const [by, dir] = value.split(':') as ['created' | 'name', 'asc' | 'desc'];
            setSortBy(by);
            setSortDir(dir);
          }}
        >
          <SelectTrigger className="h-8 w-[160px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created:desc">Newest first</SelectItem>
            <SelectItem value="created:asc">Oldest first</SelectItem>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
            <SelectItem value="name:desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>

        <div className="inline-flex items-center rounded-full border border-border bg-background p-1">
          <Toggle
            size="sm"
            pressed={viewMode === 'card'}
            onPressedChange={() => setViewMode('card')}
            className="rounded-full data-[state=on]:bg-muted data-[state=on]:text-foreground"
            aria-label="Card view"
            title="Card view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            className="rounded-full data-[state=on]:bg-muted data-[state=on]:text-foreground"
            aria-label="List view"
            title="List view"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>

	      {/* Accounts List */}
	          {checkingAccounts ? (
	            <div className="grid place-items-center rounded-2xl border border-border bg-card py-16">
	              <div className="text-center">
	                <Spinner className="mx-auto h-8 w-8 text-muted-foreground" />
	                <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
	              </div>
	            </div>
	          ) : hasAccounts ? (
            viewMode === 'card' ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedAccounts.map((userAccount) => (
                  <Card
                    key={userAccount.account_id}
                    className="group cursor-pointer border border-border transition-colors hover:border-foreground/20"
                    onClick={() => handleAccountSelect(userAccount)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="rounded-md bg-muted p-1.5">
                            {getStatusIcon(userAccount.user_status)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base text-foreground truncate">
                            {userAccount.accounts?.name || 'Unnamed Account'}
                            </h3>
                            {userAccount.accounts?.description && (
                              <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                                {userAccount.accounts.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={getStatusColor(userAccount.status)}>
                          {userAccount.status === 'invited' ? 'Pending' : userAccount.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
                        <span>Role: {userAccount.user_status}</span>
                        <div className="flex items-center gap-2">
                          <span>{userAccount.accounts?.created_at && new Date(userAccount.accounts.created_at).toLocaleDateString()}</span>
                          {userAccount.user_status === 'owner' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(userAccount);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Edit Account"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteDialog(userAccount);
                            }}
                            className={`${
                              userAccount.user_status === 'owner' 
                                ? 'text-destructive' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={userAccount.user_status === 'owner' ? 'Delete Account' : 'Leave Account'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAccounts.map((userAccount) => (
                  <Card
                    key={userAccount.account_id}
                    className="group cursor-pointer border border-border transition-colors hover:border-foreground/20"
                    onClick={() => handleAccountSelect(userAccount)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="rounded-md bg-muted p-1.5 transition-colors group-hover:bg-muted/70">
                            {getStatusIcon(userAccount.user_status)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-base text-foreground transition-colors">
                                {userAccount.accounts?.name || 'Unnamed Account'}
                              </h3>
                              <Badge variant="outline" className={getStatusColor(userAccount.status)}>
                                {userAccount.status === 'invited' ? 'Pending' : userAccount.status}
                              </Badge>
                            </div>
                            {userAccount.accounts?.description && (
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {userAccount.accounts.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-medium">Role: {userAccount.user_status}</span>
                            <span>
                              {userAccount.accounts?.created_at && 
                                new Date(userAccount.accounts.created_at).toLocaleDateString()
                              }
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          {userAccount.status === 'invited' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAccountSelect(userAccount);
                              }}
                            >
                              Accept
                            </Button>
                          )}
                          {userAccount.user_status === 'owner' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(userAccount);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Edit Account"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteDialog(userAccount);
                            }}
                            className={`${
                              userAccount.user_status === 'owner' 
                                ? 'text-destructive hover:text-destructive' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={userAccount.user_status === 'owner' ? 'Delete Account' : 'Leave Account'}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first account to get started
              </p>
              <Button onClick={() => setShowCreateAccountForm(true)} className="h-8 rounded-full px-3">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Account
              </Button>
            </div>
          )}

          {/* Create Account Dialog */}
          {showCreateAccountForm && (
            <Dialog open={showCreateAccountForm} onOpenChange={setShowCreateAccountForm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Account</DialogTitle>
                  <DialogDescription>
                    Create a new account to organize your team and projects.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">Account Name</Label>
                    <Input
                      id="account-name"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Enter account name"
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
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateAccountForm(false)}
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
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Delete Account Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {deletingAccount?.user_status === 'owner' ? 'Delete Account' : 'Leave Account'}
                </DialogTitle>
                <DialogDescription>
                  {deletingAccount?.user_status === 'owner' ? (
                    <>
                      Are you sure you want to delete "{deletingAccount?.accounts?.name}"? This action cannot be undone and will permanently delete:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>All account data and settings</li>
                        <li>All designer instances and images</li>
                        <li>All team member relationships</li>
                        <li>All billing and subscription data</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      Are you sure you want to leave "{deletingAccount?.accounts?.name}"? You will lose access to this account and all its resources, but the account and its data will remain intact for other team members.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeletingAccount(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {deletingAccount?.user_status === 'owner' ? 'Deleting...' : 'Leaving...'}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingAccount?.user_status === 'owner' ? 'Delete Account' : 'Leave Account'}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Account Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Account</DialogTitle>
                <DialogDescription>
                  Update your account information. Changes will be applied immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-account-name">Account Name</Label>
                  <Input
                    id="edit-account-name"
                    value={editAccountName}
                    onChange={(e) => setEditAccountName(e.target.value)}
                    placeholder="Enter account name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-account-slug">Account Slug</Label>
                  <Input
                    id="edit-account-slug"
                    value={editAccountSlug}
                    onChange={(e) => setEditAccountSlug(e.target.value)}
                    placeholder="account-slug"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used in your account URL
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (Optional)</Label>
                  <Input
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Brief description of this account"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingAccount(null);
                      setEditAccountName('');
                      setEditAccountSlug('');
                      setEditDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditAccount}
                    disabled={editLoading || !editAccountName.trim()}
                  >
                    {editLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Update Account
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
    </SettingsShell>
  );
}
