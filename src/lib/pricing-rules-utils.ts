import type { Database } from "@/lib/types/database";

type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];

export function formatPricingRule(r: PricingRule): string {
  if (r.pricing_mode === "free_hours_plus_overage") {
    return `Miễn phí ${r.free_hours}h đầu, sau đó ${(r.overage_fee_per_hour ?? 0).toLocaleString(
      "vi-VN"
    )}đ/giờ`;
  }
  return `${(r.flat_price ?? 0).toLocaleString("vi-VN")}đ / ${r.flat_price_hours}h`;
}

export function formatAttendeeRange(r: PricingRule): string {
  if (r.min_attendees && r.max_attendees) return `${r.min_attendees}-${r.max_attendees} người`;
  if (r.min_attendees) return `từ ${r.min_attendees} người`;
  if (r.max_attendees) return `dưới ${r.max_attendees + 1} người`;
  return "Không giới hạn";
}

/** Suggested final_price for a rule given the booking's actual start/end time (ISO). */
export function computeSuggestedPrice(
  rule: PricingRule,
  startTimeIso: string,
  endTimeIso: string
): number {
  const hours =
    (new Date(endTimeIso).getTime() - new Date(startTimeIso).getTime()) / 3_600_000;

  if (rule.pricing_mode === "free_hours_plus_overage") {
    const overageHours = Math.max(0, hours - (rule.free_hours ?? 0));
    return Math.round(overageHours * (rule.overage_fee_per_hour ?? 0));
  }

  return rule.flat_price ?? 0;
}

export function matchingPricingRules(
  rules: PricingRule[],
  locationType: string,
  attendeeCount: number | null
): PricingRule[] {
  return rules.filter((r) => {
    if (r.location_type !== locationType) return false;
    if (attendeeCount == null) return true;
    if (r.min_attendees != null && attendeeCount < r.min_attendees) return false;
    if (r.max_attendees != null && attendeeCount > r.max_attendees) return false;
    return true;
  });
}
