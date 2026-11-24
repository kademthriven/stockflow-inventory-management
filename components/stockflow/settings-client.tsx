"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, LoaderCircle, PackageSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/stockflow/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/stockflow/states";

export function SettingsClient() {
  const router = useRouter();
  const [threshold, setThreshold] = useState("5");
  const [savedThreshold, setSavedThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json()) as { defaultLowStockThreshold?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Settings are unavailable right now.");
      const value = payload.defaultLowStockThreshold ?? 5;
      setThreshold(String(value));
      setSavedThreshold(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Settings are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    const value = Number(threshold);
    if (!Number.isInteger(value) || value < 0) {
      setFieldError("Enter a whole number of 0 or more.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultLowStockThreshold: value }),
      });
      const payload = (await response.json().catch(() => ({}))) as { defaultLowStockThreshold?: number; error?: string; fields?: { defaultLowStockThreshold?: string } };
      if (!response.ok) {
        setFieldError(payload.fields?.defaultLowStockThreshold ?? payload.error ?? "We couldn’t save your settings.");
        return;
      }
      const next = payload.defaultLowStockThreshold ?? value;
      setSavedThreshold(next);
      setThreshold(String(next));
      toast.success("Settings saved", { description: `Your default low-stock threshold is now ${next}.` });
    } catch {
      setFieldError("StockFlow is temporarily unreachable. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Choose how StockFlow identifies items that need your attention."
      />

      {loading ? (
        <LoadingPanel label="Loading workspace settings" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_minmax(280px,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#dce3de] bg-white shadow-[0_10px_35px_rgb(31_49_42/4%)]">
            <div className="flex items-start gap-4 border-b border-[#e7ece8] px-5 py-5 sm:px-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#e4f5ed] text-[#16825d]"><BellRing className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#26312d]">Low-stock default</h2>
                <p className="mt-1 text-sm leading-6 text-[#718079]">Used whenever a product doesn’t have its own threshold.</p>
              </div>
            </div>

            <form onSubmit={save} noValidate className="p-5 sm:p-6">
              <div className="max-w-md space-y-2">
                <label htmlFor="default-threshold" className="text-sm font-semibold text-[#34413c]">Default low-stock threshold</label>
                <div className="relative">
                  <Input
                    id="default-threshold"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={threshold}
                    onChange={(event) => { setThreshold(event.target.value); setFieldError(""); }}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? "threshold-error" : "threshold-help"}
                    className="h-12 rounded-xl border-[#d5ddd7] pr-20 text-base font-semibold focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-base"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#7b8782]">units</span>
                </div>
                {fieldError ? (
                  <p id="threshold-error" role="alert" className="text-sm font-medium text-[#bd453b]">{fieldError}</p>
                ) : (
                  <p id="threshold-help" className="text-sm leading-6 text-[#7b8782]">A product is low stock when its quantity is equal to or below this number.</p>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-[#e0e6e1] bg-[#f8faf8] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#16825d] shadow-sm"><PackageSearch className="size-[18px]" /></span>
                  <div>
                    <p className="text-sm font-semibold text-[#34413c]">How this works</p>
                    <p className="mt-1 text-sm leading-6 text-[#6e7b75]">
                      With a default of <strong className="font-semibold text-[#34413c]">{Number.isFinite(Number(threshold)) ? threshold || "0" : savedThreshold}</strong>, a product with that many units or fewer appears on your dashboard. Product-specific thresholds always take priority.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#edf1ee] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#84908a]"><Check className="size-3.5 text-[#16825d]" /> Current saved value: {savedThreshold} units</p>
                <Button type="submit" disabled={saving || threshold === String(savedThreshold)} className="h-10 rounded-xl bg-[#16825d] px-5 font-semibold hover:bg-[#0f704f]">
                  {saving ? <><LoaderCircle className="size-4 animate-spin" /> Saving</> : "Save changes"}
                </Button>
              </div>
            </form>
          </section>

          <aside className="h-fit rounded-2xl bg-[#17201d] p-5 text-white shadow-[0_12px_35px_rgb(23_32_29/12%)] sm:p-6">
            <span className="grid size-11 place-items-center rounded-[14px] bg-white/[0.08] text-[#6ee0b2]"><ShieldCheck className="size-5" /></span>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em]">Workspace-wide, still flexible.</h2>
            <p className="mt-2 text-sm leading-6 text-[#a7b4af]">This default keeps setup fast. For special products, set a custom threshold from the product editor.</p>
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#778780]">Applied to</p>
              <p className="mt-1 text-sm font-semibold text-[#edf3f0]">Products without a custom value</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
