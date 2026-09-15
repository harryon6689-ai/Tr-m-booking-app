"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database, LocationType, PricingMode } from "@/lib/types/database";
import { updateDiscountRule } from "@/lib/actions/discount-rules";
import {
  createPricingRule,
  updatePricingRule,
  setPricingRuleActive,
  type PricingRuleInput,
} from "@/lib/actions/pricing-rules";
import { updateLocationPolicy } from "@/lib/actions/locations";
import CurrencyInput from "@/components/CurrencyInput";
import { formatPricingRule, formatAttendeeRange } from "@/lib/pricing-rules-utils";
import ExportExcelButton from "@/components/ExportExcelButton";

type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];

interface DiscountRulesClientProps {
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  locations: Location[];
  canEdit: boolean;
}

export default function DiscountRulesClient({
  discountRules,
  pricingRules,
  locations,
  canEdit,
}: DiscountRulesClientProps) {
  const [tab, setTab] = useState<"discount" | "pricing" | "minimum-spend">("discount");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-lg border border-brand-forest/20 p-0.5">
        <button
          onClick={() => setTab("discount")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "discount" ? "bg-brand-forest text-brand-cream" : "text-brand-forest"
          }`}
        >
          Giảm giá %
        </button>
        <button
          onClick={() => setTab("pricing")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "pricing" ? "bg-brand-forest text-brand-cream" : "text-brand-forest"
          }`}
        >
          Giá phòng/chỗ
        </button>
        <button
          onClick={() => setTab("minimum-spend")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "minimum-spend" ? "bg-brand-forest text-brand-cream" : "text-brand-forest"
          }`}
        >
          Mức chi tối thiểu &amp; Phụ thu giờ
        </button>
      </div>

      {tab === "discount" ? (
        <DiscountPercentTable discountRules={discountRules} canEdit={canEdit} />
      ) : tab === "pricing" ? (
        <PricingRulesPanel pricingRules={pricingRules} canEdit={canEdit} />
      ) : (
        <MinimumSpendPanel locations={locations} canEdit={canEdit} />
      )}
    </div>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

interface PolicyDraft {
  minimumSpend: number;
  includedHours: number;
  overageFeePerHour: number;
}

function MinimumSpendPanel({
  locations,
  canEdit,
}: {
  locations: Location[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>(
    Object.fromEntries(
      locations.map((l) => [
        l.id,
        {
          minimumSpend: l.minimum_spend ?? 0,
          includedHours: l.included_hours,
          overageFeePerHour: l.overage_fee_per_hour ?? 0,
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateDraft(locationId: string, patch: Partial<PolicyDraft>) {
    setDrafts((d) => ({ ...d, [locationId]: { ...d[locationId], ...patch } }));
  }

  async function handleSave(locationId: string) {
    setSavingId(locationId);
    const draft = drafts[locationId];
    const result = await updateLocationPolicy(locationId, {
      minimumSpend: draft.minimumSpend > 0 ? draft.minimumSpend : null,
      includedHours: draft.includedHours,
      overageFeePerHour: draft.overageFeePerHour > 0 ? draft.overageFeePerHour : null,
    });
    setSavingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-brand-forest/60">
        Mức chi tối thiểu (đồ uống) cho từng vị trí, dùng trong số giờ quy định — quá số
        giờ đó sẽ tự tính phụ thu thêm giờ. Để trống mức chi tối thiểu hoặc phụ thu/giờ
        (0đ) nghĩa là vị trí đó không áp dụng phần tương ứng.
      </p>
      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Vị trí</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Mức chi tối thiểu</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Số giờ quy định</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Phụ thu/giờ vượt</th>
              {canEdit && <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 font-medium text-brand-forest">{loc.name}</td>
                <td className="px-3 py-2 text-brand-forest/80">{loc.type}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <CurrencyInput
                      value={drafts[loc.id].minimumSpend}
                      onChange={(v) => updateDraft(loc.id, { minimumSpend: v })}
                      className="w-32 rounded-lg border border-brand-forest/30 px-2 py-1 outline-none focus:border-brand-amber"
                    />
                  ) : loc.minimum_spend ? (
                    formatMoney(loc.minimum_spend)
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={drafts[loc.id].includedHours}
                      onChange={(e) =>
                        updateDraft(loc.id, { includedHours: Number(e.target.value) })
                      }
                      className="w-20 rounded-lg border border-brand-forest/30 px-2 py-1 outline-none focus:border-brand-amber"
                    />
                  ) : (
                    `${loc.included_hours}h`
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <CurrencyInput
                      value={drafts[loc.id].overageFeePerHour}
                      onChange={(v) => updateDraft(loc.id, { overageFeePerHour: v })}
                      className="w-32 rounded-lg border border-brand-forest/30 px-2 py-1 outline-none focus:border-brand-amber"
                    />
                  ) : loc.overage_fee_per_hour ? (
                    `${formatMoney(loc.overage_fee_per_hour)}/h`
                  ) : (
                    "-"
                  )}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleSave(loc.id)}
                      disabled={savingId === loc.id}
                      className="rounded-lg bg-brand-amber px-3 py-1 text-xs font-bold text-white hover:bg-brand-amber/90 disabled:opacity-60"
                    >
                      {savingId === loc.id ? "Đang lưu..." : "Lưu"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiscountPercentTable({
  discountRules,
  canEdit,
}: {
  discountRules: DiscountRule[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, { percent: string; active: boolean }>>(
    Object.fromEntries(
      discountRules.map((r) => [r.id, { percent: String(r.default_percent), active: r.active }])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSave(id: string) {
    setSavingId(id);
    const draft = drafts[id];
    const percent = Math.max(0, Math.min(100, Number(draft.percent) || 0));
    const result = await updateDiscountRule(id, {
      default_percent: percent,
      active: draft.active,
    });
    setSavingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ExportExcelButton
          filename="chinh-sach-giam-gia"
          sheetName="Giảm giá"
          rows={discountRules.map((r) => ({
            "Loại khách": r.customer_type,
            "Áp dụng cho": r.discount_type,
            "% mặc định": r.default_percent,
            "Đang áp dụng": r.active ? "Có" : "Không",
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-cream text-brand-forest/70">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Loại khách</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Áp dụng cho</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">% mặc định</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Đang áp dụng</th>
            {canEdit && <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>}
          </tr>
        </thead>
        <tbody>
          {discountRules.map((r) => {
            const draft = drafts[r.id];
            return (
              <tr key={r.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 font-medium text-brand-forest">
                  {r.customer_type}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">{r.discount_type}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={draft.percent}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [r.id]: { ...d[r.id], percent: e.target.value },
                        }))
                      }
                      className="w-20 rounded-lg border border-brand-forest/30 px-2 py-1 outline-none focus:border-brand-amber"
                    />
                  ) : (
                    `${r.default_percent}%`
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [r.id]: { ...d[r.id], active: e.target.checked },
                        }))
                      }
                    />
                  ) : r.active ? (
                    "Có"
                  ) : (
                    "Không"
                  )}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleSave(r.id)}
                      disabled={savingId === r.id}
                      className="rounded-lg bg-brand-amber px-3 py-1 text-xs font-bold text-white hover:bg-brand-amber/90 disabled:opacity-60"
                    >
                      {savingId === r.id ? "Đang lưu..." : "Lưu"}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function PricingRulesPanel({
  pricingRules,
  canEdit,
}: {
  pricingRules: PricingRule[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<PricingRule | null>(null);

  async function handleToggleActive(rule: PricingRule) {
    const result = await setPricingRuleActive(rule.id, !rule.active);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  if (mode === "form") {
    return (
      <PricingRuleForm
        rule={editing}
        onDone={() => {
          setMode("list");
          router.refresh();
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {canEdit ? (
          <button
            onClick={() => {
              setEditing(null);
              setMode("form");
            }}
            className="w-fit rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
          >
            + Thêm chính sách giá
          </button>
        ) : (
          <span />
        )}
        <ExportExcelButton
          filename="chinh-sach-gia-phong"
          sheetName="Giá phòng"
          rows={pricingRules.map((r) => ({
            "Vị trí": r.location_type,
            "Chính sách": r.rule_name,
            "Số người": formatAttendeeRange(r),
            Giá: formatPricingRule(r),
            "Đồ uống": r.requires_drink_per_person ? "Bắt buộc" : "-",
            "Trạng thái": r.active ? "Đang áp dụng" : "Tạm ngưng",
          }))}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Vị trí</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Chính sách</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Số người</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Đồ uống</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Trạng thái</th>
              {canEdit && <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {pricingRules.map((r) => (
              <tr key={r.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 text-brand-forest/80">{r.location_type}</td>
                <td className="px-3 py-2 font-medium text-brand-forest">{r.rule_name}</td>
                <td className="px-3 py-2 text-brand-forest/80">{formatAttendeeRange(r)}</td>
                <td className="px-3 py-2 text-brand-forest/80">{formatPricingRule(r)}</td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {r.requires_drink_per_person ? "Bắt buộc" : "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.active
                        ? "bg-brand-forest/10 text-brand-forest"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {r.active ? "Đang áp dụng" : "Tạm ngưng"}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        onClick={() => {
                          setEditing(r);
                          setMode("form");
                        }}
                        className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-brand-forest hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleToggleActive(r)}
                        className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-brand-forest/70 hover:underline"
                      >
                        {r.active ? "Tạm ngưng" : "Kích hoạt"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingRuleForm({
  rule,
  onDone,
  onCancel,
}: {
  rule: PricingRule | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [locationType, setLocationType] = useState<LocationType>(
    rule?.location_type ?? "phòng lớn"
  );
  const [ruleName, setRuleName] = useState(rule?.rule_name ?? "");
  const [minAttendees, setMinAttendees] = useState<string>(
    rule?.min_attendees != null ? String(rule.min_attendees) : ""
  );
  const [maxAttendees, setMaxAttendees] = useState<string>(
    rule?.max_attendees != null ? String(rule.max_attendees) : ""
  );
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    rule?.pricing_mode ?? "free_hours_plus_overage"
  );
  const [freeHours, setFreeHours] = useState(rule?.free_hours ?? 4);
  const [overageFee, setOverageFee] = useState(rule?.overage_fee_per_hour ?? 100000);
  const [flatPrice, setFlatPrice] = useState(rule?.flat_price ?? 0);
  const [flatPriceHours, setFlatPriceHours] = useState(rule?.flat_price_hours ?? 3);
  const [requiresDrink, setRequiresDrink] = useState(rule?.requires_drink_per_person ?? false);
  const [active, setActive] = useState(rule?.active ?? true);
  const [displayOrder, setDisplayOrder] = useState(rule?.display_order ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const input: PricingRuleInput = {
      location_type: locationType,
      rule_name: ruleName,
      min_attendees: minAttendees ? Number(minAttendees) : null,
      max_attendees: maxAttendees ? Number(maxAttendees) : null,
      pricing_mode: pricingMode,
      free_hours: pricingMode === "free_hours_plus_overage" ? freeHours : null,
      overage_fee_per_hour: pricingMode === "free_hours_plus_overage" ? overageFee : null,
      flat_price: pricingMode === "flat_rate" ? flatPrice : null,
      flat_price_hours: pricingMode === "flat_rate" ? flatPriceHours : null,
      requires_drink_per_person: requiresDrink,
      active,
      display_order: displayOrder,
    };

    const result = rule
      ? await updatePricingRule(rule.id, input)
      : await createPricingRule(input);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-3 rounded-xl border border-brand-forest/15 bg-white p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">Vị trí</label>
        <select
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as LocationType)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          <option value="phòng lớn">Phòng lớn</option>
          <option value="phòng nhỏ">Phòng nhỏ</option>
          <option value="box">Box</option>
          <option value="ghế ngoài">Khu ngồi ngoài</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Tên chính sách
        </label>
        <input
          required
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="VD: Sinh viên/CLB dưới 50 người"
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số người tối thiểu
          </label>
          <input
            type="number"
            min={0}
            value={minAttendees}
            onChange={(e) => setMinAttendees(e.target.value)}
            placeholder="Không giới hạn"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số người tối đa
          </label>
          <input
            type="number"
            min={0}
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            placeholder="Không giới hạn"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Chế độ tính giá
        </label>
        <select
          value={pricingMode}
          onChange={(e) => setPricingMode(e.target.value as PricingMode)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          <option value="free_hours_plus_overage">Miễn phí N giờ đầu + phụ phí/giờ</option>
          <option value="flat_rate">Giá trọn gói theo khung giờ</option>
        </select>
      </div>

      {pricingMode === "free_hours_plus_overage" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Số giờ miễn phí
            </label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={freeHours}
              onChange={(e) => setFreeHours(Number(e.target.value))}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Phụ phí/giờ (đ)
            </label>
            <CurrencyInput
              value={overageFee}
              onChange={setOverageFee}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Giá trọn gói (đ)
            </label>
            <CurrencyInput
              value={flatPrice}
              onChange={setFlatPrice}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Số giờ trong gói
            </label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={flatPriceHours}
              onChange={(e) => setFlatPriceHours(Number(e.target.value))}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
        <input
          type="checkbox"
          checked={requiresDrink}
          onChange={(e) => setRequiresDrink(e.target.checked)}
        />
        Yêu cầu mỗi người 1 đồ uống
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Đang áp dụng
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Thứ tự hiển thị
        </label>
        <input
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream"
        >
          Quay lại
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-amber px-4 py-2 font-medium text-white hover:bg-brand-amber/90 disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </form>
  );
}
