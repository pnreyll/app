import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiGet } from "./api";
import type { Account, Contact, Material, Product } from "./types";

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return "Lütfen form alanlarını kontrol edin";
    if (e.status === 401) return "Oturum süresi doldu, tekrar giriş yapın";
  }
  return "İşlem başarısız oldu";
}

// Every mutation here touches cross-cutting state (stock, cari, kasa) → refresh everything on success.
export function useApiMutation<V, R = unknown>(
  fn: (v: V) => Promise<R>,
  opts: { success?: string; onSuccess?: (r: R) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      void qc.invalidateQueries();
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useForm<T extends object>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const set =
    <K extends keyof T>(k: K) =>
    (v: T[K]) =>
      setForm((f) => ({ ...f, [k]: v }));
  return { form, setForm, set };
}

const browserToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Business "today" anchored on the server (Europe/Istanbul); browser date only as offline fallback. */
export function useToday(): string {
  const q = useQuery({ queryKey: ["today"], queryFn: () => apiGet<{ today: string }>("/today"), staleTime: 5 * 60_000 });
  return q.data?.today ?? browserToday();
}

export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: () => apiGet<Account[]>("/accounts") });
export const useProducts = () => useQuery({ queryKey: ["products"], queryFn: () => apiGet<Product[]>("/products") });
export const useContacts = (type?: "customer" | "supplier") =>
  useQuery({ queryKey: ["contacts", type ?? "all"], queryFn: () => apiGet<Contact[]>(`/contacts${type ? `?type=${type}` : ""}`) });
export const useMaterials = (kind?: "green_bean" | "material") =>
  useQuery({ queryKey: ["materials", kind ?? "all"], queryFn: () => apiGet<Material[]>(`/materials${kind ? `?kind=${kind}` : ""}`) });

export const toNum = (s: string | number) => {
  const n = typeof s === "number" ? s : parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
