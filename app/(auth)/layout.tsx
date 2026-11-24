import { CheckCircle2, PackageCheck, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/stockflow/brand-mark";

const proofPoints = [
  { icon: PackageCheck, text: "Clear stock levels at a glance" },
  { icon: ShieldCheck, text: "Your organization’s data stays private" },
  { icon: CheckCircle2, text: "Low-stock alerts without the noise" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f7f9f6] lg:grid-cols-[minmax(390px,0.82fr)_1.18fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#17201d] px-10 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div className="absolute -right-40 top-16 size-[440px] rounded-full bg-[#45c895]/10 blur-3xl" />
        <div className="absolute -bottom-44 -left-24 size-[480px] rounded-full bg-[#ef735c]/10 blur-3xl" />
        <div className="surface-grid absolute inset-0 opacity-20" />
        <BrandMark inverse className="relative z-10" />

        <div className="relative z-10 my-auto max-w-lg py-16">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#a9d8c6]">
            <span className="size-1.5 rounded-full bg-[#45c895] shadow-[0_0_0_4px_rgb(69_200_149/12%)]" />
            Inventory, in focus
          </div>
          <h2 className="text-[clamp(2.5rem,4.4vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
            Less counting.
            <br />
            More knowing.
          </h2>
          <p className="mt-7 max-w-md text-lg leading-8 text-[#aab6b1]">
            StockFlow gives small teams one calm place to track every product and catch low inventory early.
          </p>

          <ul className="mt-11 space-y-4">
            {proofPoints.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] font-medium text-[#dce4e1]">
                <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-[#6ee0b2]">
                  <Icon className="size-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[#73817b]">Built for focused product teams.</p>
      </section>

      <section className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <BrandMark />
          <span className="rounded-full bg-[#e4f5ed] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#0f704f]">Secure workspace</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24">
          {children}
        </div>
      </section>
    </main>
  );
}
