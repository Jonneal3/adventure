"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type Item = { text: string; slug: string };

export default function ServicesDirectory({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((s) => s.text.toLowerCase().includes(query));
  }, [items, q]);

  const listWithLetters = useMemo(() => {
    const out: Array<{ kind: "letter"; letter: string } | { kind: "item"; item: Item }> = [];
    let prev = "";
    for (const item of items) {
      const letter = (item.text.trim()[0] || "#").toUpperCase();
      if (letter !== prev) {
        out.push({ kind: "letter", letter });
        prev = letter;
      }
      out.push({ kind: "item", item });
    }
    return out;
  }, [items]);

  return (
    <section aria-label="Service Directory" className="w-full">
      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-11 pr-4 py-3 text-[15px] rounded-full border border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>{items.length.toLocaleString()} total</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>{filtered.length.toLocaleString()} shown</span>
        </div>
      </div>

      <div className="mt-10">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">No matches.</div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-10 [column-fill:balance]">
            <ul className="m-0 list-none p-0">
              {(q.trim().length > 0
                ? filtered.map((item) => ({ kind: "item" as const, item }))
                : listWithLetters
              ).map((row) => {
                if (row.kind === "letter") {
                  return (
                    <li key={`letter-${row.letter}`} className="break-inside-avoid pt-5 first:pt-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                        {row.letter}
                      </div>
                    </li>
                  );
                }

                const item = row.item;
                return (
                  <li key={item.slug} className="break-inside-avoid">
                    <Link
                      href={`/services/${item.slug}`}
                      className="block py-2 text-[15px] text-foreground/90 hover:text-foreground underline-offset-4 hover:underline decoration-muted-foreground/40"
                    >
                      {item.text}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
