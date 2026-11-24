"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, PackageCheck, Plus, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/stockflow/page-header";
import { EmptyState, ErrorPanel, LoadingPanel } from "@/components/stockflow/states";

type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  quantityOnHand: number;
  lowStockThreshold?: number | null;
  effectiveLowStockThreshold?: number;
};

type DashboardData = {
  totalProducts: number;
  totalUnits: number;
  lowStockItems: LowStockItem[];
};

const integer = new Intl.NumberFormat("en-US");

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Boxes;
  tone: "green" | "ink" | "coral";
}) {
  const styles = {
    green: "bg-[#e3f5ed] text-[#0f704f]",
    ink: "bg-[#e8eeea] text-[#26312d]",
    coral: "bg-[#fff0ec] text-[#c15442]",
  }[tone];

  return (
    <article className="animate-float-in rounded-2xl border border-[#dce3de] bg-white p-5 shadow-[0_8px_30px_rgb(31_49_42/4%)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#68746f]">{label}</p>
          <p className="mt-3 text-[2.35rem] font-semibold leading-none tracking-[-0.055em] text-[#17201d]">{integer.format(value)}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-[14px] ${styles}`}>
          <Icon className="size-[21px]" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-5 border-t border-[#edf1ee] pt-4 text-xs font-medium text-[#83908a]">{note}</p>
    </article>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json()) as DashboardData & { error?: string; dashboard?: DashboardData };
      if (!response.ok) throw new Error(payload.error ?? "Inventory data is unavailable right now.");
      setData(payload.dashboard ?? payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inventory data is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const healthyProducts = useMemo(
    () => Math.max(0, (data?.totalProducts ?? 0) - (data?.lowStockItems.length ?? 0)),
    [data],
  );

  return (
    <>
      <PageHeader
        eyebrow="Inventory overview"
        title="Good to see you."
        description="Here’s the pulse of your inventory today—what you have, and what needs attention."
        actions={
          <Button asChild className="h-11 rounded-xl bg-[#16825d] px-5 font-semibold shadow-[0_7px_18px_rgb(22_130_93/18%)] hover:bg-[#0f704f]">
            <Link href="/products"><Plus className="size-[18px]" /> Add product</Link>
          </Button>
        }
      />

      {loading ? (
        <LoadingPanel label="Counting your inventory" />
      ) : error || !data ? (
        <ErrorPanel message={error || "Dashboard data is unavailable."} onRetry={() => void load()} />
      ) : (
        <div className="space-y-7">
          <section className="grid gap-4 md:grid-cols-3" aria-label="Inventory summary">
            <StatCard label="Total products" value={data.totalProducts} note={`${healthyProducts} currently above threshold`} icon={Boxes} tone="green" />
            <StatCard label="Units on hand" value={data.totalUnits} note="Across every active product" icon={Warehouse} tone="ink" />
            <StatCard label="Low-stock items" value={data.lowStockItems.length} note={data.lowStockItems.length ? "Ready for your attention" : "Everything is comfortably stocked"} icon={AlertTriangle} tone="coral" />
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#dce3de] bg-white shadow-[0_10px_35px_rgb(31_49_42/4%)]">
            <div className="flex flex-col justify-between gap-4 border-b border-[#e6ebe7] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#fff0ec] text-[#c15442]"><AlertTriangle className="size-[18px]" /></span>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#26312d]">Low-stock items</h2>
                </div>
                <p className="mt-1.5 text-sm text-[#74817b]">Products at or below their configured threshold.</p>
              </div>
              <Button asChild variant="outline" className="h-10 rounded-xl border-[#d8e0da] bg-white font-semibold text-[#34413c]">
                <Link href="/products">View all products</Link>
              </Button>
            </div>

            {data.lowStockItems.length === 0 ? (
              <EmptyState
                title="Everything looks well stocked"
                description="When a product reaches its low-stock threshold, it will appear here for quick action."
                action={<span className="inline-flex items-center gap-2 text-sm font-semibold text-[#16825d]"><PackageCheck className="size-4" /> No action needed</span>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#f8faf8] text-xs font-bold uppercase tracking-[0.1em] text-[#75817c]">
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-5 py-3.5">SKU</th>
                      <th className="px-5 py-3.5 text-right">On hand</th>
                      <th className="px-6 py-3.5 text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ee]">
                    {data.lowStockItems.map((product) => {
                      const threshold = product.effectiveLowStockThreshold ?? product.lowStockThreshold ?? 0;
                      return (
                        <tr key={product.id} className="group transition-colors hover:bg-[#fbfcfb]">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-10 place-items-center rounded-xl bg-[#f1f4f2] text-sm font-bold text-[#59665f]">{product.name.slice(0, 2).toUpperCase()}</span>
                              <span className="font-semibold text-[#26312d]">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4"><code className="rounded-md bg-[#f1f4f2] px-2 py-1 text-xs font-semibold text-[#59665f]">{product.sku}</code></td>
                          <td className="px-5 py-4 text-right"><span className="inline-flex min-w-10 justify-center rounded-full bg-[#fff0ec] px-2.5 py-1 text-sm font-bold text-[#b84b3c]">{integer.format(product.quantityOnHand)}</span></td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-[#5e6a65]">{integer.format(threshold)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
