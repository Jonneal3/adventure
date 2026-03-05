import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const timestamp = new Date().toISOString();
  const startedAtMs = Date.now();
  const requestId = `instance_${startedAtMs.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    const instanceId = params.instanceId;
    const debugEnabled = (() => {
      try {
        const url = new URL(request.url);
        const v = (url.searchParams.get("debug") || url.searchParams.get("ai_form_debug") || url.searchParams.get("form_debug") || "")
          .trim()
          .toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "on";
      } catch {
        return false;
      }
    })();
    const hintedServiceId = (() => {
      try {
        const url = new URL(request.url);
        const raw =
          url.searchParams.get("serviceId") ||
          url.searchParams.get("service_id") ||
          url.searchParams.get("service") ||
          null;
        return raw ? String(raw).trim() : null;
      } catch {
        return null;
      }
    })();
    if (debugEnabled) {
      logger.info("[instance] REQUEST", {
        requestId,
        instanceId,
        hintedServiceId,
        method: request.method,
        url: request.url,
      });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Try service role key first, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500, headers: { "X-Request-Id": requestId } }
      );
    }

    // Create a fresh Supabase client for each request to avoid any caching
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache-Bust': Date.now().toString()
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // First, let's check if the instance exists at all (this will help debug RLS issues)
    
    const { data: instanceExists, error: existsError } = await supabase
      .from('instances')
      .select('id, is_public')
      .eq('id', instanceId)
      .maybeSingle();

    if (existsError) {
      
    } else if (!instanceExists) {
      
      return NextResponse.json({
        error: 'Instance not found',
        instanceId: instanceId,
        details: 'Instance does not exist in database'
      }, { status: 404, headers: { "X-Request-Id": requestId } });
    } else {
      
    }

    // Fetch the instance data with explicit cache busting and force fresh data
    
    
    // Force fresh data by using a cache-busting approach
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .single();
      
    // Log any query errors for debugging
    if (instanceError) {
      
    }

    if (instanceError) {
      
      return NextResponse.json({
        error: 'Instance not found',
        instanceId: instanceId,
        errorCode: instanceError.code,
        errorMessage: instanceError.message,
        details: 'This could be due to RLS policy blocking access (is_public = false) or instance does not exist'
      }, { status: 404, headers: { "X-Request-Id": requestId } });
    }

    const responseTimestamp = new Date().toISOString();
    
    const { data: rawConfig, error: rawError } = await supabase
      .from('instances')
      .select('config, updated_at, created_at, name')
      .eq('id', instanceId)
      .single();
      
    if (!rawError && rawConfig) {
      
    } else {
      
    }

    // Provide deterministic service options to the client so the form can render
    // service-selection without needing to hit /api/ai-form/:id/generate-steps.
    let serviceOptions: Array<{
      label: string;
      value: string;
      industryId?: string | null;
      industryName?: string | null;
      serviceName?: string | null;
      serviceSummary?: string | null;
    }> = [];
    try {
      const { data: instanceSubcats, error: instanceSubcatsError } = await supabase
        .from("instance_subcategories")
        .select("category_subcategory_id")
        .eq("instance_id", instanceId);
      if (instanceSubcatsError) {
        logger.warn("[widget] Failed to read instance_subcategories for serviceOptions", {
          instanceId,
          error: instanceSubcatsError.message,
          code: (instanceSubcatsError as any).code,
        });
      }
      if (Array.isArray(instanceSubcats) && instanceSubcats.length > 0) {
        const ids = instanceSubcats
          .map((r: any) => r?.category_subcategory_id)
          .filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: subcats, error: subcatsError } = await supabase
            .from("categories_subcategories")
            .select("id, subcategory, category_id, service_summary, categories(name)")
            .in("id", ids)
            .limit(60);
          if (subcatsError) {
            logger.warn("[widget] Failed to read categories_subcategories for serviceOptions", {
              instanceId,
              error: subcatsError.message,
              code: (subcatsError as any).code,
            });
          }
          const metaById = new Map<
            string,
            { serviceName: string; industryId: string | null; industryName: string | null; serviceSummary: string | null }
          >(
            (Array.isArray(subcats) ? subcats : []).map((s: any) => {
              const serviceName = String(s?.subcategory || "Service");
              const industryId = s?.category_id ? String(s.category_id) : null;
              const serviceSummary = typeof (s as any)?.service_summary === "string" ? String((s as any).service_summary).trim() || null : null;
              const cat = (s as any)?.categories;
              const industryName =
                cat && typeof cat === "object" && typeof (cat as any).name === "string"
                  ? String((cat as any).name)
                  : null;
              return [String(s.id), { serviceName, industryId, industryName, serviceSummary }];
            })
          );
          serviceOptions = ids
            .map((id) => {
              const meta = metaById.get(id) || { serviceName: "Service", industryId: null, industryName: null, serviceSummary: null };
              const rawLabel = meta.serviceName || "Service";
              const cleanedLabel =
                rawLabel.replace(/\s*\(service\)\s*$/i, "").trim() || rawLabel;
              return {
                value: id,
                label: cleanedLabel,
                serviceName: cleanedLabel,
                industryId: meta.industryId,
                industryName: meta.industryName,
                serviceSummary: meta.serviceSummary,
              };
            })
            .slice(0, 40);
        }
      }
    } catch (e) {
      logger.warn("[widget] Failed to resolve serviceOptions", {
        instanceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Fallbacks:
    // - If `instance_subcategories` isn't configured for this instance, use `config.aiFormConfig.services` when present.
    // - If the embed passes `?serviceId=...`, include that service so the form doesn't show a raw UUID text input.
    if (serviceOptions.length === 0) {
      const configServicesRaw = (instance as any)?.config?.aiFormConfig?.services;
      const configServices = Array.isArray(configServicesRaw)
        ? configServicesRaw.map((s: any) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
        : [];
      const candidateIds = (configServices.length > 0 ? configServices : hintedServiceId ? [hintedServiceId] : []).slice(
        0,
        40,
      );

      if (candidateIds.length > 0) {
        try {
          const { data: subcats, error: subcatsError } = await supabase
            .from("categories_subcategories")
            .select("id, subcategory, category_id, service_summary, categories(name)")
            .in("id", candidateIds)
            .limit(60);
          if (subcatsError) {
            logger.warn("[widget] Failed to resolve fallback services from categories_subcategories", {
              instanceId,
              error: subcatsError.message,
              code: (subcatsError as any).code,
            });
          }

          const metaById = new Map<
            string,
            { label: string; industryId: string | null; industryName: string | null; serviceSummary: string | null }
          >(
            (Array.isArray(subcats) ? subcats : []).map((s: any) => {
              const rawLabel = String(s?.subcategory || "Service");
              const cleanedLabel = rawLabel.replace(/\s*\(service\)\s*$/i, "").trim() || rawLabel;
              const industryId = s?.category_id ? String(s.category_id) : null;
              const serviceSummary =
                typeof (s as any)?.service_summary === "string" ? String((s as any).service_summary).trim() || null : null;
              const cat = (s as any)?.categories;
              const industryName =
                cat && typeof cat === "object" && typeof (cat as any).name === "string"
                  ? String((cat as any).name)
                  : null;
              return [String(s.id), { label: cleanedLabel, industryId, industryName, serviceSummary }];
            }),
          );

          serviceOptions = candidateIds.map((id) => {
            const meta = metaById.get(id);
            const label = meta?.label || id;
            return {
              value: id,
              label,
              serviceName: label,
              industryId: meta?.industryId ?? null,
              industryName: meta?.industryName ?? null,
              serviceSummary: meta?.serviceSummary ?? null,
            };
          });
        } catch (e) {
          logger.warn("[widget] Failed to build fallback serviceOptions", {
            instanceId,
            error: e instanceof Error ? e.message : String(e),
          });
          serviceOptions = candidateIds.map((id) => ({ value: id, label: id, serviceName: id }));
        }
      }
    }

    const responseData = {
      success: true,
      instance: instance,
      serviceOptions,
      images: [],
      totalImages: 0,
      fetchedAt: responseTimestamp,
      requestTimestamp: timestamp
    };
    
    const response = NextResponse.json(responseData);

    // Comprehensive cache control to prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Last-Modified', new Date().toUTCString());
    response.headers.set('ETag', `"${Date.now()}"`);
    response.headers.set("X-Request-Id", requestId);

    if (debugEnabled) {
      logger.info("[instance] RESPONSE", {
        requestId,
        instanceId,
        status: 200,
        durationMs: Date.now() - startedAtMs,
        hasServiceOptions: Array.isArray(serviceOptions) && serviceOptions.length > 0,
      });
    }

    return response;

  } catch (error) {
    logger.error("[instance] ERROR", {
      requestId,
      instanceId: params.instanceId,
      durationMs: Date.now() - startedAtMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      error: 'Internal server error',
      instanceId: params.instanceId,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
} 
