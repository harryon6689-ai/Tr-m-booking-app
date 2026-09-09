import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/current-user";
import Nav from "@/components/Nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !user.active) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <Nav name={user.name} role={user.role} permissions={user.permissions} />
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
    </div>
  );
}
