

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/config";

/**
 * Types for organization analytics data returned by the backend.
 * Extend safely as backend grows – unknown fields are preserved in `extra`.
 */
export interface OrganizationAnalytics {
  organizationId: string;
  organizationName: string;
  totalProjects: number;
  totalMembers: number;
  activeMembers: number;
  revenue: number; // in major currency units
  period?: {
    from?: string; // ISO date
    to?: string;   // ISO date
  };
  // Keep any additional backend fields without breaking the UI
  [key: string]: unknown;
}

export interface UseOrganizationAnalyticsResult {
  data: OrganizationAnalytics | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * A fully ready hook to load organization analytics by orgId.
 *
 * Usage:
 *   const { data, loading, error, refresh } = useOrganizationAnalytics(orgId);
 */
export function useOrganizationAnalytics(orgId?: string): UseOrganizationAnalyticsResult {
  const [data, setData] = useState<OrganizationAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const canLoad = useMemo(() => typeof orgId === "string" && orgId.length > 0, [orgId]);

  const fetchOnce = useCallback(async () => {
    if (!canLoad) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<Partial<OrganizationAnalytics>>(
        `/orgs/${encodeURIComponent(orgId!)}/analytics`,
        { signal: controller.signal }
      );

      const json = response.data ?? null;

      // Normalize with safe defaults so UI is stable
      const normalized: OrganizationAnalytics = {
        organizationId: String(json?.organizationId ?? orgId),
        organizationName: String(json?.organizationName ?? "Organization"),
        totalProjects: Number(json?.totalProjects ?? 0),
        totalMembers: Number(json?.totalMembers ?? 0),
        activeMembers: Number(json?.activeMembers ?? 0),
        revenue: Number(json?.revenue ?? 0),
        period: json?.period as OrganizationAnalytics["period"],
        ...json,
      };

      setData(normalized);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "AbortError") {
        return; // cancelled
      }
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canLoad, orgId]);

  useEffect(() => {
    fetchOnce();
    return () => abortRef.current?.abort();
  }, [fetchOnce]);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  return { data, loading, error, refresh };
}
