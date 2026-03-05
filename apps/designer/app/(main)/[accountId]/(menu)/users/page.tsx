"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Plus,
  Mail,
  Crown,
  Shield,
  User,
  Trash2,
  AlertCircle,
  X,
  Settings
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
  SelectValue
} from '@/components/ui/select';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { SettingsShell } from '@/components/layout/SettingsShell';
import { Spinner } from '@/components/ui/spinner';
import { clearAccountUsersCache, fetchAccountUsersCached } from '@/lib/account-users-cache';

export default function UsersPage() {
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [accountUsers, setAccountUsers] = useState<any[]>([]);
  const [loadingAccountUsers, setLoadingAccountUsers] = useState(true);

  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const accountId = params?.accountId as string;
  const supabase = useSupabaseClientWithAuth();

  const fetchAccountUsers = useCallback(async () => {
    if (!accountId) return;

    setLoadingAccountUsers(true);
    try {
      const users = await fetchAccountUsersCached(accountId);
      setAccountUsers(users);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoadingAccountUsers(false);
    }
  }, [accountId, toast]);

  useEffect(() => {
    fetchAccountUsers();
  }, [fetchAccountUsers]);

  // Only allow invite/remove if current user is owner or admin
  const myUserAccount = useMemo(
    () => accountUsers.find((ua) => ua.user_id === session?.user?.id),
    [accountUsers, session?.user?.id],
  );
  const canManageUsers = myUserAccount && (myUserAccount.user_status === 'owner' || myUserAccount.user_status === 'admin');

  // Show invite button if user can manage users or if we're still loading
  const showInviteButton = canManageUsers || (session?.user?.id && loadingAccountUsers);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !currentAccount) return;
    setInviteLoading(true);
    try {
      const response = await fetch('/api/accounts/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          accountId: currentAccount.id,
          role: inviteRole
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'User invited!', description: data.message });
        clearAccountUsersCache(currentAccount.id);
        await fetchAccountUsers();
        setInviteEmail('');
        setInviteRole('user');
        setShowInviteDialog(false);
      } else {
        throw new Error(data.error || 'Failed to invite user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to invite user',
        variant: 'destructive'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveUser = async (userAccountId: string, userEmail: string) => {
    if (!currentAccount) return;
    setRemoveLoading(userAccountId);
    try {
      const response = await fetch('/api/accounts/remove-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAccountId,
          accountId: currentAccount.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'User removed',
          description: `${userEmail} has been removed from the account`
        });
        clearAccountUsersCache(currentAccount.id);
        await fetchAccountUsers();
      } else {
        throw new Error(data.error || 'Failed to remove user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove user',
        variant: 'destructive'
      });
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleResendInvite = async (userEmail: string) => {
    if (!currentAccount) return;
    setResendLoading(userEmail);
    try {
      const response = await fetch('/api/accounts/resend-invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: userEmail,
          accountId: currentAccount.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'Invitation resent',
          description: `Invitation email has been resent to ${userEmail}`
        });
      } else {
        throw new Error(data.error || 'Failed to resend invitation');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend invitation',
        variant: 'destructive'
      });
    } finally {
      setResendLoading(null);
    }
  };

  const handleEditUser = async () => {
    if (!currentAccount || !editingUser) return;
    setEditLoading(editingUser.id);
    try {
      const response = await fetch('/api/accounts/edit-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAccountId: editingUser.id,
          accountId: currentAccount.id,
          newRole: editRole
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'User updated',
          description: `User role has been updated to ${editRole}`
        });
        clearAccountUsersCache(currentAccount.id);
        await fetchAccountUsers();
        setShowEditDialog(false);
        setEditingUser(null);
        setEditRole('user');
      } else {
        throw new Error(data.error || 'Failed to update user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive'
      });
    } finally {
      setEditLoading(null);
    }
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setEditRole(user.user_status === 'admin' ? 'admin' : 'user');
    setShowEditDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'owner':
        return <Crown className="h-4 w-4 text-foreground" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-muted-foreground" />;
      case 'user':
        return <User className="h-4 w-4 text-muted-foreground" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'owner':
        return 'border-border bg-foreground text-background';
      case 'admin':
        return 'border-border bg-muted text-foreground';
      case 'user':
        return 'border-border bg-muted/40 text-muted-foreground';
      default:
        return 'border-border bg-muted/40 text-muted-foreground';
    }
  };

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Account not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsShell
        accountId={accountId}
        active="users"
        title="Settings"
        description="Team members, roles, and invitations."
        actions={
          showInviteButton ? (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                  <DialogDescription>
                    Invite a user to join this account. If they already exist, they’ll be added automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: 'admin' | 'user') => setInviteRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    If the user already exists, they’ll be added to this account. Otherwise we’ll email them an invitation.
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleInviteUser}
                      disabled={inviteLoading || !inviteEmail.trim()}
                      className="flex-1"
                    >
                      {inviteLoading ? 'Inviting…' : 'Invite'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowInviteDialog(false)}
                      disabled={inviteLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : null
        }
      >
        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Role</DialogTitle>
              <DialogDescription>
                Change the role for {editingUser?.email || editingUser?.user_id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editRole} onValueChange={(value: 'admin' | 'user') => setEditRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleEditUser}
                  disabled={editLoading === editingUser?.id || editRole === editingUser?.user_status}
                  className="flex-1"
                >
                  {editLoading === editingUser?.id ? 'Updating...' : 'Update User'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={editLoading === editingUser?.id}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Users List as Simple List */}
        {loadingAccountUsers ? (
          <div className="grid place-items-center rounded-2xl border border-border bg-card py-16">
            <div className="text-center">
              <Spinner className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        ) : accountUsers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No users yet</h3>
            <p className="text-muted-foreground mb-6">
              Invite users to collaborate on this account
            </p>
            {showInviteButton && (
              <Button onClick={() => setShowInviteDialog(true)} className="h-8 rounded-full px-3">
                <Plus className="h-4 w-4 mr-2" />
                Invite Your First User
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {accountUsers.map((userAccount) => (
              <div
                key={userAccount.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
                    {getStatusIcon(userAccount.user_status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {userAccount.email || userAccount.user_id}
                      </span>
                      <Badge variant="outline" className={getStatusColor(userAccount.user_status)}>
                        {userAccount.user_status}
                      </Badge>
                      {userAccount.status === 'invited' && (
                        <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(userAccount.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userAccount.status === 'invited' && canManageUsers && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvite(userAccount.email || userAccount.user_id)}
                      disabled={resendLoading === (userAccount.email || userAccount.user_id)}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    >
                      {resendLoading === (userAccount.email || userAccount.user_id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground"></div>
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {(myUserAccount?.user_status === 'owner' || myUserAccount?.user_status === 'admin') && userAccount.user_status !== 'owner' && (
                    <>
                      {myUserAccount?.user_status === 'owner' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(userAccount)}
                          className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveUser(userAccount.id, userAccount.email || userAccount.user_id)}
                        disabled={removeLoading === userAccount.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {removeLoading === userAccount.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-destructive" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsShell>
    </div>
  );
}
