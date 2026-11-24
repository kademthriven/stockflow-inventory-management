"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Menu,
  PackageSearch,
  Power,
  Settings2,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/stockflow/brand-mark";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: PackageSearch },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

const pageNames: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/settings": "Settings",
};

function initials(value: string) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SF";
}

export function AppShell({
  children,
  organizationName = "Your workspace",
  email = "Account owner",
}: {
  children: React.ReactNode;
  organizationName?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-8 pt-7">
        <BrandMark inverse />
      </div>

      <div className="mx-4 mb-7 rounded-2xl border border-white/[0.07] bg-white/[0.045] px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#75847e]">Workspace</p>
        <p className="mt-1 truncate text-sm font-semibold text-[#e9efec]">{organizationName}</p>
      </div>

      <nav className="flex-1 px-3" aria-label="Primary navigation">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#66756f]">Manage</p>
        <ul className="space-y-1.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-[#45c895] text-[#11201b] shadow-[0_7px_18px_rgb(0_0_0/14%)]"
                      : "text-[#aeb9b4] hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <Icon className={cn("size-[19px]", active ? "text-[#11201b]" : "text-[#75847e] group-hover:text-[#9aaba4]")} strokeWidth={2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="m-4 rounded-2xl border border-white/[0.07] bg-[#202b27] p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#33423c] text-sm font-bold text-[#8ce4c1]">
            {initials(organizationName || email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#edf3f0]">{organizationName}</p>
            <p className="truncate text-xs text-[#7f8d87]">{email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-[#77867f] transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
            aria-label="Sign out"
            title="Sign out"
          >
            <Power className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f8f5]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] bg-[#17201d] lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-[#0c1512]/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,300px)] bg-[#17201d] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="focus-ring absolute right-4 top-6 z-10 grid size-9 place-items-center rounded-lg text-[#9aa8a2] hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dce3de] bg-[#f6f8f5]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="focus-ring grid size-10 place-items-center rounded-xl border border-[#d8e0da] bg-white text-[#26312d] shadow-sm lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#819089]">StockFlow</p>
              <p className="text-sm font-semibold text-[#26312d]">{pageNames[pathname] ?? "Workspace"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#d8e0da] bg-white px-3 py-1.5 text-xs font-semibold text-[#53605b] shadow-[0_1px_2px_rgb(23_32_29/4%)]">
            <span className="size-2 rounded-full bg-[#31b981] shadow-[0_0_0_3px_rgb(49_185_129/12%)]" />
            Live inventory
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pb-16 lg:pt-9">
          {children}
        </main>
      </div>
    </div>
  );
}
