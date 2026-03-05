import { MetadataRoute } from "next";
import { SERVICES, SITE_URL } from "@/config/services";
import { getIndexableLocalSeoPagePaths } from "@/config/seo/localServicePages";
import { getTypeBPaths } from "@/config/seo/typeBPages";
import { createServerComponent } from "@/config/supabase-server";
import { toSubcategorySlug } from "@/utils/slug";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticBase = [
    { priority: 1, url: `${SITE_URL}/` },
    { priority: 0.9, url: `${SITE_URL}/services` },
    { priority: 0.8, url: `${SITE_URL}/pricing` },
    { priority: 0.6, url: `${SITE_URL}/partners` },
    { priority: 0.6, url: `${SITE_URL}/agency` },
    { priority: 0.55, url: `${SITE_URL}/problems` },
    { priority: 0.55, url: `${SITE_URL}/workflows` },
    { priority: 0.55, url: `${SITE_URL}/guides` },
    ...getTypeBPaths().map((p) => ({ priority: 0.55, url: `${SITE_URL}${p}` })),
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticBase.map(({ priority, url }) => ({
    changeFrequency: "weekly",
    lastModified: now,
    priority,
    url,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = SERVICES.map((s) => ({
    changeFrequency: "monthly",
    lastModified: now,
    priority: 0.8,
    url: `${SITE_URL}/services/${s.slug}`,
  }));

  const localServiceRoutes: MetadataRoute.Sitemap = getIndexableLocalSeoPagePaths().map((path) => ({
    changeFrequency: "monthly",
    lastModified: now,
    priority: 0.55,
    url: `${SITE_URL}${path}`,
  }));

  // Subcategory routes (DB-backed)
  const supabase = createServerComponent();
  const { data } = await supabase
    .from("categories")
    .select(`name, status, categories_subcategories(id, subcategory, slug, status, instance_type)`)
    .eq("status", "active");
  const seen = new Set<string>();
  const subcatRoutes: MetadataRoute.Sitemap = (data || [])
    .flatMap((cat: any) => (cat.categories_subcategories || []))
    .filter((sub: any) => sub.status === "active")
    .map((sub: any) => (sub.slug as string) || toSubcategorySlug(sub.subcategory as string))
    .filter((slug: string) => (seen.has(slug) ? false : (seen.add(slug), true)))
    .map((slug: string) => ({
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${SITE_URL}/services/${slug}`,
    }));

  return [...staticRoutes, ...serviceRoutes, ...localServiceRoutes, ...subcatRoutes];
}
