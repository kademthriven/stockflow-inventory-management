import { AppShell } from "@/components/stockflow/app-shell";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();

  return (
    <AppShell organizationName={user.organizationName} email={user.email}>
      {children}
    </AppShell>
  );
}
