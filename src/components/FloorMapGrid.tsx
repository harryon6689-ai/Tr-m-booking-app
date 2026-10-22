"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import CalendarBookingModal from "@/components/CalendarBookingModal";
import { PERIODS } from "@/lib/periods";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

function periodBookedCount(todayBookings: Booking[], startHour: number, endHour: number) {
  const start = new Date();
  start.setHours(startHour, 0, 0, 0);
  const end = new Date();
  end.setHours(endHour, 0, 0, 0);
  return todayBookings.filter(
    (b) =>
      b.status !== "hủy" &&
      new Date(b.start_time) < end &&
      new Date(b.end_time) > start
  ).length;
}

function PeriodBadges({
  location,
  todayBookings,
}: {
  location: Location;
  todayBookings: Booking[];
}) {
  const isOutdoor = location.type === "ghế ngoài";

  return (
    <div className="flex gap-1.5">
      {PERIODS.map((period) => {
        const bookedCount = periodBookedCount(
          todayBookings,
          period.startHour,
          period.endHour
        );
        const available = location.capacity - bookedCount;
        const occupied = isOutdoor ? available <= 0 : bookedCount > 0;

        return (
          <div
            key={period.key}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 shadow-[0_2px_4px_rgba(0,0,0,0.25)] ${
              occupied ? "bg-brand-amber text-white" : "bg-brand-forest text-white"
            }`}
          >
            <span className="text-xs font-bold leading-none">{period.label}</span>
            <span className="text-[9px] font-medium leading-none opacity-90">
              {isOutdoor
                ? occupied
                  ? "Hết chỗ"
                  : `${available} trống`
                : occupied
                ? "Đã thuê"
                : "Trống"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type TodaysKolBooking = { kol_name: string; start_time: string | null; end_time: string | null };

interface FloorMapGridProps {
  locations: Location[];
  bookings: Booking[];
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  canEdit: boolean;
  isAdmin: boolean;
  /** null = account has no access to the KOL module, so the card is hidden entirely. */
  todaysKol: TodaysKolBooking[] | null;
  canSeeCheckin: boolean;
}

export default function FloorMapGrid({
  locations,
  bookings,
  discountRules,
  pricingRules,
  preferredCustomers,
  canEdit,
  isAdmin,
  todaysKol,
  canSeeCheckin,
}: FloorMapGridProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<Location | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bookings-floor-map")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          // The floor map only shows today's bookings — skip the refresh
          // when the changed row is clearly for a different day, so edits
          // to future/past bookings elsewhere in the app don't force every
          // open floor-map tab to re-fetch.
          const row = (payload.new ?? payload.old) as
            | { start_time?: string }
            | null;
          if (row?.start_time && new Date(row.start_time).toDateString() !== new Date().toDateString()) {
            return;
          }
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const bookingsByLocation = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const list = map.get(b.location_id) ?? [];
      list.push(b);
      map.set(b.location_id, list);
    }
    return map;
  }, [bookings]);

  function currentBooking(locationId: string) {
    const list = bookingsByLocation.get(locationId) ?? [];
    return list.find(
      (b) =>
        b.status !== "hủy" &&
        new Date(b.start_time) <= now &&
        now <= new Date(b.end_time)
    );
  }

  const rooms = locations.filter(
    (l) => l.type === "phòng lớn" || l.type === "phòng nhỏ"
  );
  const boxes = locations.filter((l) => l.type === "box");
  const outdoor = locations.filter((l) => l.type === "ghế ngoài");

  function outdoorBookedSeatsNow(location: Location) {
    const list = bookingsByLocation.get(location.id) ?? [];
    return list.filter(
      (b) => b.status !== "hủy" && new Date(b.start_time) <= now && now <= new Date(b.end_time)
    ).length;
  }

  const indoorUnits = [...rooms, ...boxes];
  const occupiedIndoorNow = indoorUnits.filter((l) => currentBooking(l.id)).length;
  const freeIndoorNow = indoorUnits.length - occupiedIndoorNow;
  const outdoorCapacityTotal = outdoor.reduce((sum, l) => sum + l.capacity, 0);
  const outdoorBookedNow = outdoor.reduce((sum, l) => sum + outdoorBookedSeatsNow(l), 0);
  const outdoorFreeNow = Math.max(outdoorCapacityTotal - outdoorBookedNow, 0);
  const totalBookedToday = bookings.filter((b) => b.status !== "hủy").length;

  return (
    <div className="flex flex-col gap-4">
      <OverviewSummary
        totalBookedToday={totalBookedToday}
        freeIndoorNow={freeIndoorNow}
        occupiedIndoorNow={occupiedIndoorNow}
        totalIndoorUnits={indoorUnits.length}
        outdoorFreeNow={outdoor.length > 0 ? outdoorFreeNow : null}
        outdoorCapacityTotal={outdoorCapacityTotal}
        todaysKol={todaysKol}
        canSeeCheckin={canSeeCheckin}
      />

      <div id="phong-box-grid" className="flex flex-col gap-3 scroll-mt-20">
      <Row title="Phòng họp">
        {rooms.map((loc) => (
          <Cell
            key={loc.id}
            location={loc}
            booking={currentBooking(loc.id)}
            todayBookings={bookingsByLocation.get(loc.id) ?? []}
            onClick={() => setSelected(loc)}
          />
        ))}
      </Row>

      <Row title="Box">
        {boxes.map((loc) => (
          <Cell
            key={loc.id}
            location={loc}
            booking={currentBooking(loc.id)}
            todayBookings={bookingsByLocation.get(loc.id) ?? []}
            onClick={() => setSelected(loc)}
          />
        ))}
      </Row>
      </div>

      <Row title="Khu ngồi ngoài" id="khu-ngoai-grid">
        {outdoor.map((loc) => {
          const list = bookingsByLocation.get(loc.id) ?? [];
          const bookedSeats = list.filter(
            (b) =>
              b.status !== "hủy" &&
              new Date(b.start_time) <= now &&
              now <= new Date(b.end_time)
          ).length;
          return (
            <OutdoorCell
              key={loc.id}
              location={loc}
              bookedSeats={bookedSeats}
              todayBookings={list}
              onClick={() => setSelected(loc)}
            />
          );
        })}
      </Row>

      {selected && (
        <CalendarBookingModal
          location={selected}
          discountRules={discountRules}
          pricingRules={pricingRules}
          preferredCustomers={preferredCustomers}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function formatKolTime(kol: TodaysKolBooking) {
  if (!kol.start_time) return "";
  const range = kol.end_time
    ? `${kol.start_time.slice(0, 5)} - ${kol.end_time.slice(0, 5)}`
    : kol.start_time.slice(0, 5);
  return ` (${range})`;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function OverviewSummary({
  totalBookedToday,
  freeIndoorNow,
  occupiedIndoorNow,
  totalIndoorUnits,
  outdoorFreeNow,
  outdoorCapacityTotal,
  todaysKol,
  canSeeCheckin,
}: {
  totalBookedToday: number;
  freeIndoorNow: number;
  occupiedIndoorNow: number;
  totalIndoorUnits: number;
  outdoorFreeNow: number | null;
  outdoorCapacityTotal: number;
  todaysKol: TodaysKolBooking[] | null;
  canSeeCheckin: boolean;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-brand-forest/60">
        Tổng quan hôm nay
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <OverviewCard
          label="Khách đã đặt hôm nay"
          value={String(totalBookedToday)}
          tone="forest"
          href={canSeeCheckin ? "/check-in" : undefined}
        />
        <OverviewCard
          label="Phòng/Box còn trống"
          value={`${freeIndoorNow}/${totalIndoorUnits}`}
          tone={freeIndoorNow > 0 ? "green" : "red"}
          onClick={() => scrollToSection("phong-box-grid")}
        />
        <OverviewCard
          label="Phòng/Box đang có khách"
          value={`${occupiedIndoorNow}/${totalIndoorUnits}`}
          tone={occupiedIndoorNow > 0 ? "amber" : "forest"}
          onClick={() => scrollToSection("phong-box-grid")}
        />
        {outdoorFreeNow !== null && (
          <OverviewCard
            label="Chỗ ngồi ngoài còn trống"
            value={`${outdoorFreeNow}/${outdoorCapacityTotal}`}
            tone={outdoorFreeNow > 0 ? "green" : "red"}
            onClick={() => scrollToSection("khu-ngoai-grid")}
          />
        )}
        {todaysKol !== null && (
          <OverviewCard
            label="KOL hôm nay"
            value={todaysKol.length > 0 ? `Có ${todaysKol.length} KOL` : "Không có KOL"}
            tone={todaysKol.length > 0 ? "amber" : "forest"}
            detail={
              todaysKol.length > 0
                ? todaysKol.map((k) => `${k.kol_name}${formatKolTime(k)}`).join(", ")
                : undefined
            }
            href="/kol"
          />
        )}
      </div>
    </section>
  );
}

function OverviewCard({
  label,
  value,
  tone,
  detail,
  href,
  onClick,
}: {
  label: string;
  value: string;
  tone: "forest" | "amber" | "green" | "red";
  detail?: string;
  /** Navigates to another page's matching list. */
  href?: string;
  /** Scrolls to the matching section further down this same page. */
  onClick?: () => void;
}) {
  const toneClass = {
    forest: "text-brand-forest",
    amber: "text-brand-amber",
    green: "text-green-700",
    red: "text-red-600",
  }[tone];

  const content = (
    <>
      <p className="text-xs font-bold text-brand-forest/60">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {detail && (
        <p className="mt-1 truncate text-xs text-brand-forest/60" title={detail}>
          {detail}
        </p>
      )}
    </>
  );

  const className =
    "block w-full rounded-xl border border-brand-forest/15 bg-white p-4 text-center transition " +
    (href || onClick ? "cursor-pointer hover:border-brand-forest/40 hover:shadow-md" : "");

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

function Row({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={id ? "scroll-mt-20" : undefined}>
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-brand-forest/60">
        {title}
      </h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

function Cell({
  location,
  booking,
  todayBookings,
  onClick,
}: {
  location: Location;
  booking: Booking | undefined;
  todayBookings: Booking[];
  onClick: () => void;
}) {
  const occupied = Boolean(booking);

  return (
    <button
      onClick={onClick}
      className={`flex min-h-28 w-48 flex-col justify-between rounded-2xl border-2 p-3 text-left shadow-sm transition hover:shadow-md ${
        occupied
          ? "border-brand-amber bg-brand-amber/20"
          : "border-brand-forest/20 bg-brand-cream"
      }`}
    >
      <div>
        <p className="font-bold text-brand-forest">{location.name}</p>
        <p className="text-xs text-brand-forest/60">
          {location.capacity} người
          {location.equipment ? ` · ${location.equipment}` : ""}
        </p>
      </div>
      {occupied && booking && (
        <div>
          <p className="text-sm font-semibold text-brand-amber">Đã đặt</p>
          <p className="text-xs text-brand-forest/70">{booking.customer_name}</p>
        </div>
      )}
      <PeriodBadges location={location} todayBookings={todayBookings} />
    </button>
  );
}

function OutdoorCell({
  location,
  bookedSeats,
  todayBookings,
  onClick,
}: {
  location: Location;
  bookedSeats: number;
  todayBookings: Booking[];
  onClick: () => void;
}) {
  const occupied = bookedSeats > 0;
  const available = Math.max(location.capacity - bookedSeats, 0);

  return (
    <button
      onClick={onClick}
      className={`flex min-h-28 w-full flex-col justify-between rounded-2xl border-2 p-3 text-left shadow-sm transition hover:shadow-md ${
        occupied
          ? "border-brand-amber bg-brand-amber/20"
          : "border-brand-forest/20 bg-brand-cream"
      }`}
    >
      <div>
        <p className="font-bold text-brand-forest">{location.name}</p>
        <p className="text-xs text-brand-forest/60">Sức chứa {location.capacity} người</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-amber">
          {bookedSeats} chỗ đã đặt
        </p>
        <p className="text-xs text-brand-forest/70">{available} chỗ còn trống</p>
      </div>
      <PeriodBadges location={location} todayBookings={todayBookings} />
    </button>
  );
}
