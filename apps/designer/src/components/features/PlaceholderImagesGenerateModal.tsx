"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type Subcategory = { id: string; subcategory: string; category_name?: string | null };

export function PlaceholderImagesGenerateModal({
  instanceId,
  accountId,
  onClose,
  onGenerated,
}: {
  instanceId: string;
  accountId: string;
  onClose: () => void;
  onGenerated?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(true);
  const [subcategories, setSubcategories] = React.useState<Subcategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [progressText, setProgressText] = React.useState<string>("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [uniformCount, setUniformCount] = React.useState<number>(2);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/instances/${instanceId}/subcategories`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load services");
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data?.subcategories) ? (data.subcategories as Subcategory[]) : [];
        if (!cancelled) {
          setSubcategories(list);
          setSelectedIds(new Set(list.map((s) => s.id)));
          setUniformCount(2);
        }
      } catch {
        if (!cancelled) {
          setSubcategories([]);
          setSelectedIds(new Set());
          setUniformCount(2);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const selectedServices = React.useMemo(
    () => subcategories.filter((s) => selectedIds.has(s.id)),
    [subcategories, selectedIds],
  );

  const perServiceCount = React.useMemo(() => Math.max(1, Math.min(12, Number(uniformCount || 1))), [uniformCount]);

  const totalToGenerate = React.useMemo(() => {
    return selectedServices.length * perServiceCount;
  }, [perServiceCount, selectedServices.length]);

  const generate = async () => {
    if (generating) return;
    if (subcategories.length === 0) {
      toast({
        title: "No services",
        description: "Add at least one service first.",
        variant: "destructive",
      });
      return;
    }

    if (selectedServices.length === 0) {
      toast({
        title: "Select a service",
        description: "Pick at least one service to generate images for.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setProgressText("");
    const newImageIds: string[] = [];

    try {
      for (let i = 0; i < selectedServices.length; i++) {
        const s = selectedServices[i];
        setProgressText(`Generating…`);

        const resp = await fetch("/api/sample_image_gallery/generate-samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceId,
            subcategoryId: s.id,
            subcategoryName: s.subcategory,
            accountId,
            count: perServiceCount,
          }),
        });

        const j = await resp.json().catch(() => null);
        if (!resp.ok || !j?.images) {
          throw new Error(j?.error || `Failed generating ${s.subcategory}`);
        }

        const ids = (Array.isArray(j.images) ? j.images : [])
          .map((img: any) => String(img?.id || ""))
          .filter(Boolean);
        newImageIds.push(...ids);
      }

      if (newImageIds.length === 0) {
        throw new Error("No images generated.");
      }

      setProgressText("Adding to placeholder gallery…");
      const addResp = await fetch("/api/sample_image_gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, imageIds: newImageIds }),
      });
      if (!addResp.ok) {
        const j = await addResp.json().catch(() => null);
        throw new Error(j?.error || "Failed adding images to gallery.");
      }

      toast({ title: "Placeholder gallery created", description: `Added ${newImageIds.length} images.` });
      onGenerated?.();
      setOpen(false);
      onClose();
    } catch (e: any) {
      toast({
        title: "Couldn’t generate placeholders",
        description: e?.message ? String(e.message) : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setProgressText("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate placeholder images</DialogTitle>
          <DialogDescription>
            Generate a few images so the gallery isn’t empty.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading services…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">Images per service</div>
              <Input
                type="number"
                className="h-9 w-20"
                min={1}
                max={12}
                value={uniformCount}
                onChange={(e) => {
                  const next = Math.max(1, Math.min(12, Number(e.target.value || 1)));
                  setUniformCount(next);
                }}
              />
            </div>

            <div className="max-h-60 overflow-auto rounded-md border border-border">
              {subcategories.map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const isChecked = v === true;
                        const next = new Set(selectedIds);
                        if (isChecked) next.add(s.id);
                        else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                      aria-label={`Select ${s.subcategory}`}
                    />
                    <span className="text-sm text-foreground/90 truncate">{s.subcategory}</span>
                  </label>
                );
              })}
            </div>

            <Button
              onClick={generate}
              className="w-full"
              disabled={generating || selectedServices.length === 0 || totalToGenerate <= 0}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {progressText || "Generating…"}
                </>
              ) : (
                `Generate ${totalToGenerate} image${totalToGenerate === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

