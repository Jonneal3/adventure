"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Loader2,
  Grid3X3,
  List
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInstance } from '@/contexts/InstanceContext';

export default function DesignerInstancesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [deletingInstance, setDeletingInstance] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);
  const [maxWidgets, setMaxWidgets] = useState<number | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(false);

  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const { allInstances, isLoadingInstances, loadAllInstances, deleteInstance } = useInstance();
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const params = useParams();
  const accountId = params?.accountId as string;

  // Subscription check is now handled at the layout level

  // If returning from Stripe with partner=true, route to partner-pending
  useEffect(() => {
    if (searchParams && searchParams.get('partner') === 'true' && accountId) {
      router.replace(`/${accountId}/subscription/partner-pending`);
    }
  }, [searchParams, accountId, router]);

  // Always call hooks first, then do early returns
  useEffect(() => {
    if (session?.user && accountId) {
      loadAllInstances(accountId);
    }
  }, [session?.user, accountId, loadAllInstances]);

  // Fetch the plan limit for this account
  useEffect(() => {
    let isMounted = true;
    async function fetchPlanLimit() {
      if (!accountId) return;
      setCheckingLimit(true);
      try {
        const subRes = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!subRes.ok) {
          setMaxWidgets(null);
          return;
        }
        const { subscription } = await subRes.json();
        const planId: string | null = subscription?.plan_id || null;
        if (!planId) {
          setMaxWidgets(null);
          return;
        }
        const plansRes = await fetch('/api/plans', { headers: { 'Cache-Control': 'no-store' } });
        if (!plansRes.ok) {
          setMaxWidgets(null);
          return;
        }
        const plans = await plansRes.json();
        const plan = Array.isArray(plans) ? plans.find((p: any) => p.plan_id === planId) : null;
        if (isMounted) {
          setMaxWidgets(plan?.max_widgets ?? null);
        }
      } catch (e) {
        if (isMounted) setMaxWidgets(null);
      } finally {
        if (isMounted) setCheckingLimit(false);
      }
    }
    fetchPlanLimit();
    return () => { isMounted = false };
  }, [accountId]);

  const handleCreateNew = () => {
    router.push(`/${accountId}/designer-instances/new`);
  };

  const handleEditInstance = (instanceId: string) => {
    if (process.env.NODE_ENV === 'development') {}
    router.push(`/${accountId}/designer-instances/instance/${instanceId}`);
  };

  const handleDeleteInstance = (instanceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setInstanceToDelete(instanceId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteInstance = async () => {
    if (!instanceToDelete) return;

    setDeletingInstance(instanceToDelete);
    setDeleteConfirmOpen(false);

    try {
      await deleteInstance(instanceToDelete);
    } catch (error) {
    } finally {
      setDeletingInstance(null);
      setInstanceToDelete(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="relative container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Adventures
          </h1>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {maxWidgets !== null ? (
            <div className="text-xs text-muted-foreground sm:mr-1">
              {checkingLimit ? 'Checking limits…' : `${allInstances.length} of ${maxWidgets} used`}
            </div>
          ) : null}

          <div className="inline-flex items-center rounded-full border border-border p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => setViewMode('list')}
              aria-label="List View"
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => setViewMode('grid')}
              aria-label="Grid View"
              title="Grid View"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {maxWidgets !== null && allInstances.length >= (maxWidgets || 0) ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-full"
                onClick={() => router.push(`/${accountId}/subscription/new`)}
              >
                Upgrade
              </Button>
            ) : null}

            <Button
              onClick={handleCreateNew}
              disabled={checkingLimit ? true : (maxWidgets !== null && allInstances.length >= (maxWidgets || 0))}
              className="h-8 rounded-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>
      </div>

      {allInstances.length === 0 ? (
        <div className="mt-10 mx-auto max-w-md text-center">
          <h2 className="text-base font-semibold">No adventures</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create your first adventure to get started.</p>
          <Button
            onClick={handleCreateNew}
            disabled={checkingLimit ? true : (maxWidgets !== null && allInstances.length >= (maxWidgets || 0))}
            className="mt-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first adventure
          </Button>
        </div>
      ) : (
        <div className={`mt-8 grid gap-3 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {allInstances.map((instance) => (
            <div
              key={instance.id}
              className={`
                group relative cursor-pointer rounded-xl border border-border bg-card
                transition-colors hover:bg-accent/40
                ${viewMode === 'grid' ? 'p-6' : 'px-4 py-3'}
              `}
              onClick={() => handleEditInstance(instance.id)}
            >
              <div className={viewMode === 'list' ? 'flex items-start justify-between gap-4' : 'space-y-2'}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                      {instance.name || 'Untitled Instance'}
                    </h3>
                    <p className={viewMode === 'list' ? 'mt-0.5 line-clamp-1 text-sm text-muted-foreground' : 'mt-1 line-clamp-2 text-sm text-muted-foreground'}>
                      {instance.description || 'No description'}
                    </p>
                  </div>

                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteInstance(instance.id, e)}
                      disabled={deletingInstance === instance.id}
                      aria-label="Delete instance"
                      title="Delete instance"
                    >
                      {deletingInstance === instance.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <div className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground">
                    {formatDate(instance.created_at)}
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-muted-foreground">Created {formatDate(instance.created_at)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {isLoadingInstances && ( // This line was added as per the new_code
        (<div className="absolute inset-0 bg-background/60 flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>)
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Instance</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this instance? This action cannot be undone and will permanently remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deletingInstance !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteInstance}
              disabled={deletingInstance !== null}
            >
              {deletingInstance ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Instance'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
