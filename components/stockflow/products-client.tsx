"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Edit3,
  LoaderCircle,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/stockflow/page-header";
import { EmptyState, ErrorPanel, LoadingPanel } from "@/components/stockflow/states";

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  costPrice: number | null;
  sellingPrice: number | null;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductForm = {
  name: string;
  sku: string;
  description: string;
  quantityOnHand: string;
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold: string;
};

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  description: "",
  quantityOnHand: "0",
  costPrice: "",
  sellingPrice: "",
  lowStockThreshold: "",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const integer = new Intl.NumberFormat("en-US");

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-[#34413c]">{label}</label>
        {optional && <span className="text-xs text-[#89958f]">Optional</span>}
      </div>
      {children}
      {error && <p className="text-xs font-medium text-[#bd453b]" role="alert">{error}</p>}
    </div>
  );
}

function StatusBadge({ low }: { low: boolean }) {
  return low ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0ec] px-2.5 py-1 text-xs font-bold text-[#b94b3d]">
      <AlertCircle className="size-3.5" /> Low stock
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f5ed] px-2.5 py-1 text-xs font-bold text-[#0f704f]">
      <CheckCircle2 className="size-3.5" /> In stock
    </span>
  );
}

export function ProductsClient() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "healthy">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductForm | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json()) as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Products are unavailable right now.");
      setProducts(payload.products ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Products are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalized || product.name.toLowerCase().includes(normalized) || product.sku.toLowerCase().includes(normalized);
      const matchesFilter = filter === "all" || (filter === "low" ? product.isLowStock : !product.isLowStock);
      return matchesQuery && matchesFilter;
    });
  }, [products, query, filter]);

  const lowCount = useMemo(() => products.filter((product) => product.isLowStock).length, [products]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description ?? "",
      quantityOnHand: String(product.quantityOnHand),
      costPrice: product.costPrice === null ? "" : String(product.costPrice),
      sellingPrice: product.sellingPrice === null ? "" : String(product.sellingPrice),
      lowStockThreshold: product.lowStockThreshold === null ? "" : String(product.lowStockThreshold),
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function update(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (formErrors[field]) setFormErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function validate() {
    const next: typeof formErrors = {};
    if (!form.name.trim()) next.name = "Product name is required.";
    if (!form.sku.trim()) next.sku = "SKU is required.";
    const quantity = Number(form.quantityOnHand);
    if (!Number.isInteger(quantity) || quantity < 0) next.quantityOnHand = "Enter a whole number of 0 or more.";
    for (const field of ["costPrice", "sellingPrice"] as const) {
      const value = form[field];
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) next[field] = "Enter a price of 0 or more.";
    }
    if (form.lowStockThreshold !== "") {
      const threshold = Number(form.lowStockThreshold);
      if (!Number.isInteger(threshold) || threshold < 0) next.lowStockThreshold = "Enter a whole number of 0 or more.";
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setFormErrors({});
    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          description: form.description.trim() || null,
          quantityOnHand: Number(form.quantityOnHand),
          costPrice: form.costPrice === "" ? null : Number(form.costPrice),
          sellingPrice: form.sellingPrice === "" ? null : Number(form.sellingPrice),
          lowStockThreshold: form.lowStockThreshold === "" ? null : Number(form.lowStockThreshold),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { product?: Product; error?: string; fields?: Record<string, string> };
      if (!response.ok) {
        setFormErrors({ ...(payload.fields ?? {}), form: payload.error ?? "We couldn’t save this product." });
        return;
      }
      if (!payload.product) throw new Error("The product was saved but no record was returned.");
      setProducts((current) => editing ? current.map((item) => item.id === payload.product!.id ? payload.product! : item) : [payload.product!, ...current]);
      setDialogOpen(false);
      toast.success(editing ? "Product updated" : "Product added", { description: `${payload.product.name} is now in your inventory.` });
    } catch (reason) {
      setFormErrors({ form: reason instanceof Error ? reason.message : "We couldn’t save this product." });
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const response = await fetch(`/api/products/${deleting.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "We couldn’t delete this product.");
      setProducts((current) => current.filter((item) => item.id !== deleting.id));
      toast.success("Product deleted", { description: `${deleting.name} was removed from your inventory.` });
      setDeleting(null);
    } catch (reason) {
      toast.error("Delete failed", { description: reason instanceof Error ? reason.message : "Please try again." });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Product catalog"
        title="Products"
        description="Track every SKU, price, and stock level from one organized catalog."
        actions={
          <Button onClick={openCreate} className="h-11 rounded-xl bg-[#16825d] px-5 font-semibold shadow-[0_7px_18px_rgb(22_130_93/18%)] hover:bg-[#0f704f]">
            <Plus className="size-[18px]" /> Add product
          </Button>
        }
      />

      {loading ? (
        <LoadingPanel label="Loading product catalog" />
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => void load()} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#dce3de] bg-white shadow-[0_10px_35px_rgb(31_49_42/4%)]">
          <div className="border-b border-[#e6ebe7] p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#839089]" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by product name or SKU"
                  aria-label="Search products"
                  className="h-11 rounded-xl border-[#d8e0da] bg-[#f9fbf9] pl-11 pr-4 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-[#7a8781]" aria-hidden="true" />
                <label htmlFor="stock-filter" className="sr-only">Filter by stock status</label>
                <select
                  id="stock-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                  className="focus-ring h-11 min-w-40 appearance-none rounded-xl border border-[#d8e0da] bg-white px-3.5 pr-9 text-sm font-semibold text-[#43504b] shadow-sm"
                  style={{ backgroundImage: "linear-gradient(45deg, transparent 50%, #718079 50%), linear-gradient(135deg, #718079 50%, transparent 50%)", backgroundPosition: "calc(100% - 16px) 19px, calc(100% - 11px) 19px", backgroundSize: "5px 5px, 5px 5px", backgroundRepeat: "no-repeat" }}
                >
                  <option value="all">All products ({products.length})</option>
                  <option value="low">Low stock ({lowCount})</option>
                  <option value="healthy">In stock ({products.length - lowCount})</option>
                </select>
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <EmptyState
              title="Add your first product"
              description="Start with a name, SKU, and quantity. StockFlow will take care of the overview."
              action={<Button onClick={openCreate} className="h-10 rounded-xl bg-[#16825d] font-semibold hover:bg-[#0f704f]"><PackagePlus className="size-4" /> Add product</Button>}
            />
          ) : visibleProducts.length === 0 ? (
            <EmptyState title="No matching products" description="Try a different search term or stock filter." />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#f8faf8] text-xs font-bold uppercase tracking-[0.095em] text-[#75817c]">
                      <th className="px-5 py-3.5 sm:px-6">Product</th>
                      <th className="px-5 py-3.5">SKU</th>
                      <th className="px-5 py-3.5 text-right">Quantity</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Selling price</th>
                      <th className="w-24 px-5 py-3.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ee]">
                    {visibleProducts.map((product) => (
                      <tr key={product.id} className="group transition-colors hover:bg-[#fbfcfb]">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf3ef] text-sm font-bold text-[#4d5b55]">{product.name.slice(0, 2).toUpperCase()}</span>
                            <div className="min-w-0">
                              <p className="max-w-[240px] truncate font-semibold text-[#26312d]">{product.name}</p>
                              <p className="mt-0.5 max-w-[240px] truncate text-xs text-[#87938d]">{product.description || "No description"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><code className="rounded-md bg-[#f1f4f2] px-2 py-1 text-xs font-semibold text-[#59665f]">{product.sku}</code></td>
                        <td className="px-5 py-4 text-right"><span className="font-semibold tabular-nums text-[#34413c]">{integer.format(product.quantityOnHand)}</span><span className="ml-1 text-xs text-[#909b96]">units</span></td>
                        <td className="px-5 py-4"><StatusBadge low={product.isLowStock} /></td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#34413c]">{product.sellingPrice === null ? <span className="text-[#9ba59f]">—</span> : currency.format(product.sellingPrice)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button type="button" onClick={() => openEdit(product)} className="focus-ring grid size-9 place-items-center rounded-lg text-[#63706a] hover:bg-[#e8f4ee] hover:text-[#0f704f]" aria-label={`Edit ${product.name}`}><Edit3 className="size-[17px]" /></button>
                            <button type="button" onClick={() => setDeleting(product)} className="focus-ring grid size-9 place-items-center rounded-lg text-[#7a706d] hover:bg-[#fff0ec] hover:text-[#b94b3d]" aria-label={`Delete ${product.name}`}><Trash2 className="size-[17px]" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#e8ede9] md:hidden">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf3ef] text-sm font-bold text-[#4d5b55]">{product.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold text-[#26312d]">{product.name}</p><code className="mt-1 inline-block text-xs font-semibold text-[#7a8781]">{product.sku}</code></div>
                      <StatusBadge low={product.isLowStock} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9f7] p-3 text-sm">
                      <div><p className="text-xs text-[#84908a]">Quantity</p><p className="mt-0.5 font-semibold text-[#34413c]">{integer.format(product.quantityOnHand)} units</p></div>
                      <div><p className="text-xs text-[#84908a]">Selling price</p><p className="mt-0.5 font-semibold text-[#34413c]">{product.sellingPrice === null ? "Not set" : currency.format(product.sellingPrice)}</p></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" onClick={() => openEdit(product)} className="h-9 flex-1 rounded-xl bg-white"><Edit3 className="size-4" /> Edit</Button>
                      <Button type="button" variant="outline" onClick={() => setDeleting(product)} className="h-9 rounded-xl border-[#f0d3ce] bg-white text-[#b94b3d] hover:bg-[#fff0ec]"><Trash2 className="size-4" /> <span className="sr-only">Delete {product.name}</span></Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {products.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#e8ede9] bg-[#fafbfa] px-5 py-3 text-xs font-medium text-[#7c8882] sm:px-6">
              <span>{visibleProducts.length} of {products.length} products</span>
              <span>{integer.format(products.reduce((sum, product) => sum + product.quantityOnHand, 0))} total units</span>
            </div>
          )}
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-[#dce3de] p-0 sm:max-w-[650px]">
          <DialogHeader className="border-b border-[#e7ece8] px-6 pb-5 pt-6 text-left">
            <div className="mb-2 grid size-11 place-items-center rounded-[14px] bg-[#e4f5ed] text-[#16825d]"><Boxes className="size-5" /></div>
            <DialogTitle className="text-2xl tracking-[-0.035em] text-[#26312d]">{editing ? "Edit product" : "Add a product"}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#718079]">{editing ? "Update the product details and current stock level." : "Add the basics now. You can always refine them later."}</DialogDescription>
          </DialogHeader>

          <form onSubmit={save} noValidate>
            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="product-name" label="Product name" error={formErrors.name}>
                  <Input id="product-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Classic canvas tote" aria-invalid={Boolean(formErrors.name)} className="h-11 rounded-xl border-[#d5ddd7] px-3.5 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" autoFocus />
                </Field>
                <Field id="product-sku" label="SKU" error={formErrors.sku}>
                  <Input id="product-sku" value={form.sku} onChange={(event) => update("sku", event.target.value.toUpperCase())} placeholder="TOTE-NAT-01" aria-invalid={Boolean(formErrors.sku)} className="h-11 rounded-xl border-[#d5ddd7] px-3.5 font-mono text-base uppercase focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" />
                </Field>
              </div>

              <Field id="product-description" label="Description" optional>
                <Textarea id="product-description" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="A short internal description for your team" className="min-h-20 resize-y rounded-xl border-[#d5ddd7] px-3.5 py-3 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" />
              </Field>

              <div className="rounded-2xl border border-[#e0e6e1] bg-[#f8faf8] p-4">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-[#65726c]">Stock controls</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="product-quantity" label="Quantity on hand" error={formErrors.quantityOnHand}>
                    <Input id="product-quantity" type="number" min="0" step="1" inputMode="numeric" value={form.quantityOnHand} onChange={(event) => update("quantityOnHand", event.target.value)} aria-invalid={Boolean(formErrors.quantityOnHand)} className="h-11 rounded-xl border-[#d5ddd7] bg-white px-3.5 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" />
                  </Field>
                  <Field id="product-threshold" label="Low-stock threshold" optional error={formErrors.lowStockThreshold}>
                    <Input id="product-threshold" type="number" min="0" step="1" inputMode="numeric" value={form.lowStockThreshold} onChange={(event) => update("lowStockThreshold", event.target.value)} placeholder="Use workspace default" aria-invalid={Boolean(formErrors.lowStockThreshold)} className="h-11 rounded-xl border-[#d5ddd7] bg-white px-3.5 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" />
                  </Field>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="product-cost" label="Cost price" optional error={formErrors.costPrice}>
                  <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7e8a84]">$</span><Input id="product-cost" type="number" min="0" step="0.01" inputMode="decimal" value={form.costPrice} onChange={(event) => update("costPrice", event.target.value)} placeholder="0.00" aria-invalid={Boolean(formErrors.costPrice)} className="h-11 rounded-xl border-[#d5ddd7] pl-8 pr-3.5 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" /></div>
                </Field>
                <Field id="product-selling" label="Selling price" optional error={formErrors.sellingPrice}>
                  <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7e8a84]">$</span><Input id="product-selling" type="number" min="0" step="0.01" inputMode="decimal" value={form.sellingPrice} onChange={(event) => update("sellingPrice", event.target.value)} placeholder="0.00" aria-invalid={Boolean(formErrors.sellingPrice)} className="h-11 rounded-xl border-[#d5ddd7] pl-8 pr-3.5 text-base focus-visible:border-[#16825d] focus-visible:ring-[#16825d]/15 md:text-sm" /></div>
                </Field>
              </div>

              {formErrors.form && <div role="alert" className="rounded-xl border border-[#f1c6c1] bg-[#fff2f0] px-4 py-3 text-sm font-medium text-[#a73c34]">{formErrors.form}</div>}
            </div>
            <DialogFooter className="border-t border-[#e7ece8] bg-[#fafbfa] px-6 py-4 sm:items-center">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="h-10 rounded-xl bg-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#16825d] px-5 font-semibold hover:bg-[#0f704f]">{saving ? <><LoaderCircle className="size-4 animate-spin" /> Saving</> : editing ? "Save changes" : "Add product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl border-[#eadad6]">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[#fff0ec] text-[#b94b3d]"><Trash2 className="size-7" /></AlertDialogMedia>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">This permanently removes the product from your inventory. This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending} className="rounded-xl">Keep product</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={(event) => { event.preventDefault(); void removeProduct(); }} variant="destructive" className="rounded-xl">{deletePending ? <><LoaderCircle className="size-4 animate-spin" /> Deleting</> : "Delete product"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
