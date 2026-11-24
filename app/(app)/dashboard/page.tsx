import type { Metadata } from "next";
import { DashboardClient } from "@/components/stockflow/dashboard-client";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardClient />;
}
