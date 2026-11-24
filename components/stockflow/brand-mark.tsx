import Link from "next/link";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "focus-ring inline-flex items-center gap-3 rounded-lg font-semibold tracking-[-0.02em]",
        inverse ? "text-white" : "text-[#17201d]",
        className,
      )}
      aria-label="StockFlow dashboard"
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-[13px]",
          inverse
            ? "bg-[#45c895] text-[#11201b]"
            : "bg-[#17201d] text-[#6ee0b2]",
        )}
      >
        <Boxes className="size-5" strokeWidth={2.2} />
      </span>
      {!compact && <span className="text-[1.18rem]">StockFlow</span>}
    </Link>
  );
}
