import { redirect } from "next/navigation";
import { getKolBookings } from "@/lib/actions/kol-bookings";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath, canEdit } from "@/lib/permissions";
import KolClient from "./KolClient";

export default async function KolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "kol")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const kolBookings = await getKolBookings();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-brand-forest">Lịch KOL Review</h1>
      <p className="mb-3 text-sm text-brand-forest/60">
        Lịch ghé thăm của KOL/Influencer — tách riêng hoàn toàn khỏi bản đồ mặt bằng.
      </p>
      <KolClient
        initialBookings={kolBookings}
        currentUserName={user.name}
        canEdit={canEdit(user.role, user.view_only)}
      />
    </div>
  );
}
