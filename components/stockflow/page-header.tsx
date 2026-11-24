export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#16825d]">{eyebrow}</p>
        )}
        <h1 className="text-[clamp(2rem,4vw,3.15rem)] font-semibold leading-none tracking-[-0.05em] text-[#17201d]">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#66716d]">{description}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
