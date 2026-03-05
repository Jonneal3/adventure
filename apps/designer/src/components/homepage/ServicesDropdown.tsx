"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "../ui/button";
import { toSubcategorySlug } from "@/utils/slug";
import { cn } from "@/lib/utils";
import { formatSubcategoryLabel } from "@/utils/subcategory";

type Sub = { text: string; href: string };
type Cat = { name: string; subs: Sub[] };

export default function ServicesDropdown({
  isActive,
  triggerClassName,
}: {
  isActive?: boolean;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/public/categories?ts=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('bad status');
        const json = await res.json();
        const bySlug = new Map<string, Sub>();
        for (const c of (json.categories || [])) {
          for (const s of (c.categories_subcategories || [])) {
            // Merge ecomm/service variants into one entry using a canonical slug.
            const canonicalSlug = toSubcategorySlug(s.subcategory as string);
            if (!canonicalSlug) continue;
            if (bySlug.has(canonicalSlug)) continue;
            bySlug.set(canonicalSlug, {
              href: `/services/${canonicalSlug}`,
              text: formatSubcategoryLabel(s.subcategory as string),
            });
          }
        }
        setCats([{ name: "All", subs: Array.from(bySlug.values()) }]);
      } catch {
        setCats([]);
      }
    };
    load();
  }, []);

  const flat: Sub[] = cats.flatMap((c) => c.subs);
  const sortedFlat = [...flat].sort((a, b) => a.text.localeCompare(b.text));
  const filteredFlat = sortedFlat.filter((s) => s.text.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent/70 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          triggerClassName,
        )}
      >
        Services
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[520px] rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search subcategories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <div className="p-2">
              {filteredFlat.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No services found.</div>
              )}

              <div className="space-y-0.5">
                {(searchTerm.trim().length > 0 ? filteredFlat : sortedFlat).slice(0, 60).map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setIsOpen(false)}
                    className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm text-foreground/90 hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="truncate">{s.text}</span>
                    <span className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      View
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {cats.length > 0 ? `${sortedFlat.length.toLocaleString()} services` : "Loading services..."}
            </div>
            <Link
              href="/services"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-foreground hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
