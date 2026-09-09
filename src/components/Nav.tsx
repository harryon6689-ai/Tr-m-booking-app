"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserPermissions, UserRole } from "@/lib/types/database";
import { hasModulePermission } from "@/lib/permissions";

interface NavProps {
  name: string;
  role: UserRole;
  permissions: UserPermissions;
}

const links = [
  { href: "/", label: "Bản đồ mặt bằng", roles: ["admin", "staff"], permKey: "floor_map" },
  { href: "/kol", label: "Lịch KOL Review", roles: ["admin", "staff"], permKey: "kol" },
  { href: "/history", label: "Lịch sử", roles: ["admin", "staff"], permKey: "history" },
  { href: "/fixed-customers", label: "Khách cố định", roles: ["admin", "staff"], permKey: "fixed_customers" },
  { href: "/preferred-customers", label: "Khách VIP/KOL", roles: ["admin", "staff"], permKey: "preferred_customers" },
  { href: "/discount-rules", label: "Chính sách giá", roles: ["admin", "staff"], permKey: "discount_rules" },
  { href: "/reports", label: "Báo cáo doanh thu", roles: ["admin"], permKey: null },
  { href: "/staff", label: "Quản lý nhân viên", roles: ["admin"], permKey: null },
] as const;

export default function Nav({ name, role, permissions }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleLinks = links
    .filter((link) => (link.roles as readonly string[]).includes(role))
    .filter((link) => !link.permKey || hasModulePermission(role, permissions, link.permKey));

  return (
    <header className="bg-brand-forest">
      <div className="overflow-hidden border-b border-brand-cream/10 bg-brand-forest/95 py-0.5">
        <p className="marquee-track inline-block whitespace-nowrap text-xs font-semibold text-brand-cream/90">
          Tầng 3 toà nhà B&B số 60 ngõ 850 đường Láng - Đống Đa - Hà Nội
        </p>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-1.5">
        <Link href="/" className="flex items-center gap-2 text-brand-cream">
          <Image
            src="/LOGO.jpg"
            alt="TRẠM Coworking Space"
            width={36}
            height={36}
            priority
            className="rounded-full"
          />
          <span className="flex flex-col leading-none">
            <Image
              src="/tram-wordmark-light.png"
              alt="TRẠM"
              width={1246}
              height={278}
              priority
              className="h-4 w-auto"
            />
            <span className="mt-0.5 text-[8px] font-bold tracking-[0.2em] text-brand-cream/80">
              COWORKING SPACE
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <a
            href="tel:0966468978"
            className="hidden rounded-lg border border-brand-cream/40 px-3 py-1 font-semibold text-brand-cream transition hover:bg-white/10 sm:block"
          >
            Hotline: 0966 468 978
          </a>
          <span className="hidden font-semibold text-brand-cream md:inline">
            {name} · {role === "admin" ? "Quản lý" : "Nhân viên"}
          </span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-brand-cream/40 px-3 py-1 font-semibold text-brand-cream transition hover:bg-white/10"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <nav className="border-t border-brand-cream/10">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-1">
          {visibleLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1 text-sm font-bold transition ${
                  active
                    ? "bg-brand-cream text-brand-forest"
                    : "text-brand-cream hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
