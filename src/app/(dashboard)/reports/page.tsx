import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/current-user";
import { getRevenueSummary } from "@/lib/actions/reports";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const summary = await getRevenueSummary({ dateFrom: firstOfMonth, dateTo: today });

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">Báo cáo doanh thu</h1>
      <ReportsClient
        initialSummary={summary}
        initialDateFrom={firstOfMonth}
        initialDateTo={today}
      />
    </div>
  );
}
