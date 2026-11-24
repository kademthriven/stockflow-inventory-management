import { AlertTriangle, Boxes, LoaderCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingPanel({ label = "Loading inventory" }: { label?: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-2xl border border-[#dce3de] bg-white">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-7 animate-spin text-[#16825d]" />
        <p className="mt-3 text-sm font-semibold text-[#53605b]">{label}</p>
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-2xl border border-[#efcbc5] bg-[#fff8f6] px-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fde4df] text-[#bd453b]">
          <AlertTriangle className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#372522]">We couldn’t load this view</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#7d625d]">{message}</p>
        {onRetry && (
          <Button type="button" onClick={onRetry} variant="outline" className="mt-5 h-10 rounded-xl bg-white">
            <RefreshCcw className="size-4" /> Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e4f5ed] text-[#16825d]">
          <Boxes className="size-7" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#26312d]">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6c7973]">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
