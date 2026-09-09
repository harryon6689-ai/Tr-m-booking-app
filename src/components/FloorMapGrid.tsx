"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

interface FloorMapGridProps {
  locations: Location[];
  bookings: Booking[];
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  canEdit: boolean;
}

export default function FloorMapGrid({
  locations,
  bookings,
  discountRules,
  pricingRules,
  preferredCustomers,
  canEdit,
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
        () => router.refresh()
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

  return (
    <div className="flex flex-col gap-3">
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

      <Row title="Khu ngồi ngoài">
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
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
