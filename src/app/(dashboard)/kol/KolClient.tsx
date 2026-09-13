"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingStatus, Database } from "@/lib/types/database";
import {
  getKolBookings,
  createKolBooking,
  updateKolBooking,
  cancelKolBooking,
  deleteKolBooking,
  setKolReviewed,
  setKolEffectivenessRating,
  setKolStatus,
  type KolBookingInput,
  type ReviewStatusFilter,
  type EffectiveFilter,
} from "@/lib/actions/kol-bookings";
import CurrencyInput from "@/components/CurrencyInput";
import ExportExcelButton from "@/components/ExportExcelButton";

type KolBooking = Database["public"]["Tables"]["kol_bookings"]["Row"] & {
  created_by_name: string | null;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  "đã đặt": "Đã đặt",
  "đã tới": "Đã tới",
  hủy: "Đã hủy",
};

const PLATFORMS = ["TikTok", "Facebook", "Instagram", "Threads", "Khác"];

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatGifts(b: KolBooking) {
  const parts: string[] = [];
  if (b.gift_drink) parts.push(`Đồ uống x${b.gift_drink_quantity ?? 1}`);
  if (b.gift_cake) parts.push(`Bánh x${b.gift_cake_quantity ?? 1}`);
  return parts.length > 0 ? parts.join(", ") : "-";
}

function StarRating({
  value,
  onChange,
  size = "text-lg",
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n === value ? 0 : n)}
          className={`${size} leading-none transition disabled:cursor-default ${
            n <= value ? "text-yellow-400" : "text-brand-forest/20 hover:text-yellow-300"
          }`}
          aria-label={`${n} sao`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  tone = "forest",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "forest" | "red";
}) {
  const toneClass = highlight
    ? "text-brand-amber"
    : tone === "red"
    ? "text-red-600"
    : "text-brand-forest";

  return (
    <div className="rounded-xl border border-brand-forest/15 bg-white p-4">
      <p className="text-xs font-medium text-brand-forest/60">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function currentMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default function KolClient({
  initialBookings,
  currentUserName,
  canEdit,
}: {
  initialBookings: KolBooking[];
  currentUserName: string;
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<KolBooking | null>(null);

  const defaultRange = currentMonthRange();
  const [bookings, setBookings] = useState<KolBooking[]>(initialBookings);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>("");
  const [effectiveFilter, setEffectiveFilter] = useState<EffectiveFilter>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 350);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    const data = await getKolBookings({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      query: query || undefined,
      reviewStatus: reviewStatus || undefined,
      effectiveFilter: effectiveFilter || undefined,
    });
    setBookings(data);
    setLoading(false);
  }, [dateFrom, dateTo, query, reviewStatus, effectiveFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch on filter change
    refetch();
  }, [refetch]);

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(b: KolBooking) {
    setEditing(b);
    setMode("form");
  }

  async function handleSetReviewStatus(
    b: KolBooking,
    value: "not_reviewed" | "reviewed" | "cancelled"
  ) {
    if (value === "cancelled") {
      const result = await setKolStatus(b.id, "hủy");
      if (result.error) {
        alert(result.error);
        return;
      }
      refetch();
      return;
    }

    const hasReviewed = value === "reviewed";
    const result = await setKolReviewed(b.id, hasReviewed);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (hasReviewed && b.status !== "đã tới") {
      // Marking a KOL as reviewed implies they actually showed up.
      const statusResult = await setKolStatus(b.id, "đã tới");
      if (statusResult.error) {
        alert(statusResult.error);
        return;
      }
    } else if (!hasReviewed && b.status === "hủy") {
      // Picking this KOL back out of "Hủy" reverts to the default active state.
      const statusResult = await setKolStatus(b.id, "đã đặt");
      if (statusResult.error) {
        alert(statusResult.error);
        return;
      }
    }
    refetch();
  }

  async function handleSetEffectiveness(b: KolBooking, rating: number) {
    const result = await setKolEffectivenessRating(b.id, rating);
    if (result.error) {
      alert(result.error);
      return;
    }
    refetch();
  }

  async function handleDelete(b: KolBooking) {
    if (!confirm(`Xóa vĩnh viễn lịch KOL "${b.kol_name}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    const result = await deleteKolBooking(b.id);
    if (result.error) {
      alert(result.error);
      return;
    }
    refetch();
  }

  const activeBookings = bookings.filter((b) => b.status !== "hủy");
  const reviewedBookings = activeBookings.filter((b) => b.has_reviewed);
  const summary = {
    totalBooked: activeBookings.length,
    totalReviewed: reviewedBookings.length,
    totalNotReviewed: activeBookings.length - reviewedBookings.length,
    totalCancelled: bookings.length - activeBookings.length,
    reviewedCost: reviewedBookings.reduce((sum, b) => sum + b.review_price, 0),
  };

  if (mode === "form") {
    return (
      <KolForm
        booking={editing}
        currentUserName={currentUserName}
        canEdit={canEdit}
        onDone={() => {
          setMode("list");
          refetch();
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-forest/15 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Tìm KOL</label>
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Tên KOL"
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Từ ngày</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Đến ngày</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">
            Trạng thái review
          </label>
          <select
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as ReviewStatusFilter)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          >
            <option value="">Tất cả</option>
            <option value="reviewed">Đã review</option>
            <option value="not_reviewed">Chưa review</option>
            <option value="cancelled">Hủy</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Đánh giá</label>
          <select
            value={effectiveFilter}
            onChange={(e) => setEffectiveFilter(e.target.value as EffectiveFilter)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          >
            <option value="">Tất cả</option>
            <option value="1">Từ 1 sao trở lên</option>
            <option value="2">Từ 2 sao trở lên</option>
            <option value="3">Từ 3 sao trở lên</option>
            <option value="4">Từ 4 sao trở lên</option>
            <option value="5">5 sao</option>
          </select>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <ExportExcelButton
            filename="lich-kol-review"
            sheetName="KOL"
            rows={bookings.map((b) => ({
              KOL: b.kol_name,
              SĐT: b.phone ?? "",
              "Nền tảng": b.platform ?? "",
              "Follower": b.follower_count ?? "",
              "Ngày ghé thăm": b.visit_date,
              Giờ: b.start_time
                ? `${b.start_time.slice(0, 5)} - ${b.end_time?.slice(0, 5) ?? ""}`
                : "",
              "Loại hợp tác": b.deal_type ?? "",
              "Giá review": b.review_price,
              "Đã review": b.has_reviewed ? "Có" : "Chưa",
              "Đánh giá": b.effectiveness_rating,
              "Trạng thái": STATUS_LABEL[b.status],
              "Người book": b.booked_by_name ?? "",
            }))}
          />
          {canEdit && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
            >
              + Tạo lịch KOL
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Tổng KOL đã book" value={String(summary.totalBooked)} />
        <SummaryCard label="Đã review" value={String(summary.totalReviewed)} />
        <SummaryCard label="Chưa review" value={String(summary.totalNotReviewed)} />
        <SummaryCard label="Đã hủy" value={String(summary.totalCancelled)} tone="red" />
        <SummaryCard
          label="Chi phí đã review"
          value={formatMoney(summary.reviewedCost)}
          highlight
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="px-3 py-2 font-semibold">KOL</th>
              <th className="px-3 py-2 font-semibold">Ngày giờ</th>
              <th className="px-3 py-2 font-semibold">Giá &amp; Quà tặng</th>
              <th className="px-3 py-2 font-semibold">Video đã đăng</th>
              <th className="px-3 py-2 font-semibold">Trạng Thái</th>
              <th className="px-3 py-2 font-semibold">Đánh giá</th>
              <th className="px-3 py-2 font-semibold">Người Book KOL</th>
              {canEdit && <th className="px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="font-medium text-brand-forest hover:underline"
                  >
                    {b.kol_name}
                  </button>
                  <span className="block text-xs text-brand-forest/60">
                    {b.phone || "-"}
                    {b.follower_count != null &&
                      ` · ${b.follower_count.toLocaleString("vi-VN")} follower`}
                  </span>
                  {b.channel_link ? (
                    <a
                      href={b.channel_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-brand-amber hover:underline"
                    >
                      {b.platform || "Link kênh"}
                    </a>
                  ) : (
                    b.platform && (
                      <span className="block text-xs text-brand-forest/60">{b.platform}</span>
                    )
                  )}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {new Date(b.visit_date).toLocaleDateString("vi-VN")}
                  {b.start_time && (
                    <span className="block text-xs text-brand-forest/60">
                      {b.start_time.slice(0, 5)}
                      {b.end_time ? ` - ${b.end_time.slice(0, 5)}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {formatMoney(b.review_price)}
                  <span className="block text-xs text-brand-forest/60">
                    {formatGifts(b)}
                  </span>
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {b.video_links.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {b.video_links.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-amber hover:underline"
                        >
                          Video {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={
                      b.status === "hủy"
                        ? "cancelled"
                        : b.has_reviewed
                        ? "reviewed"
                        : "not_reviewed"
                    }
                    onChange={(e) =>
                      handleSetReviewStatus(
                        b,
                        e.target.value as "not_reviewed" | "reviewed" | "cancelled"
                      )
                    }
                    disabled={!canEdit}
                    className={`rounded-full border-none px-2 py-1 text-xs font-bold outline-none disabled:opacity-70 ${
                      b.status === "hủy"
                        ? "bg-red-100 text-red-600"
                        : b.has_reviewed
                        ? "bg-brand-forest text-white"
                        : "bg-brand-amber text-white"
                    }`}
                  >
                    <option value="not_reviewed">Chưa review</option>
                    <option value="reviewed">Đã review</option>
                    <option value="cancelled">Hủy</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <StarRating
                    value={b.effectiveness_rating}
                    onChange={(n) => handleSetEffectiveness(b, n)}
                    size="text-sm"
                    disabled={!canEdit}
                  />
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {b.booked_by_name || "-"}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(b)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && bookings.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            Chưa có lịch KOL nào.
          </p>
        )}
        {loading && (
          <p className="p-4 text-center text-sm text-brand-forest/50">Đang tải...</p>
        )}
      </div>
    </div>
  );
}

function KolForm({
  booking,
  currentUserName,
  canEdit,
  onDone,
  onCancel,
}: {
  booking: KolBooking | null;
  currentUserName: string;
  canEdit: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [kolName, setKolName] = useState(booking?.kol_name ?? "");
  const [bookedByName, setBookedByName] = useState(
    booking?.booked_by_name ?? currentUserName
  );
  const [phone, setPhone] = useState(booking?.phone ?? "");
  const [platform, setPlatform] = useState(booking?.platform ?? "TikTok");
  const [channelLink, setChannelLink] = useState(booking?.channel_link ?? "");
  const [followerCount, setFollowerCount] = useState<string>(
    booking?.follower_count != null ? String(booking.follower_count) : ""
  );
  const [visitDate, setVisitDate] = useState(
    booking?.visit_date ?? new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(booking?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(booking?.end_time?.slice(0, 5) ?? "");
  const [dealType, setDealType] = useState(booking?.deal_type ?? "");
  const [contentDeliverable, setContentDeliverable] = useState(
    booking?.content_deliverable ?? ""
  );
  const [reviewPrice, setReviewPrice] = useState(booking?.review_price ?? 0);
  const [giftDrink, setGiftDrink] = useState(booking?.gift_drink ?? false);
  const [giftDrinkQuantity, setGiftDrinkQuantity] = useState<string>(
    booking?.gift_drink_quantity != null ? String(booking.gift_drink_quantity) : "1"
  );
  const [giftCake, setGiftCake] = useState(booking?.gift_cake ?? false);
  const [giftCakeQuantity, setGiftCakeQuantity] = useState<string>(
    booking?.gift_cake_quantity != null ? String(booking.gift_cake_quantity) : "1"
  );
  const [hasReviewed, setHasReviewed] = useState(booking?.has_reviewed ?? false);
  const [effectivenessRating, setEffectivenessRating] = useState(
    booking?.effectiveness_rating ?? 0
  );
  const [videoLinks, setVideoLinks] = useState<string[]>(booking?.video_links ?? []);
  const [newVideoLink, setNewVideoLink] = useState("");
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? "đã đặt");
  const [note, setNote] = useState(booking?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addVideoLink() {
    const trimmed = newVideoLink.trim();
    if (trimmed && !videoLinks.includes(trimmed)) {
      setVideoLinks([...videoLinks, trimmed]);
      setNewVideoLink("");
    }
  }

  function removeVideoLink(link: string) {
    setVideoLinks(videoLinks.filter((l) => l !== link));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const input: KolBookingInput = {
      kol_name: kolName,
      booked_by_name: bookedByName,
      phone,
      platform,
      channel_link: channelLink,
      follower_count: followerCount ? Number(followerCount) : null,
      visit_date: visitDate,
      start_time: startTime || null,
      end_time: endTime || null,
      deal_type: dealType,
      content_deliverable: contentDeliverable,
      review_price: reviewPrice,
      gift_drink: giftDrink,
      gift_drink_quantity: giftDrink ? Number(giftDrinkQuantity) || 1 : null,
      gift_cake: giftCake,
      gift_cake_quantity: giftCake ? Number(giftCakeQuantity) || 1 : null,
      has_reviewed: hasReviewed,
      effectiveness_rating: effectivenessRating,
      video_links: videoLinks,
      status,
      note,
    };

    const result = booking
      ? await updateKolBooking(booking.id, input)
      : await createKolBooking(input);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onDone();
  }

  async function handleCancel() {
    if (!booking) return;
    if (!confirm("Hủy lịch KOL này?")) return;
    setLoading(true);
    const result = await cancelKolBooking(booking.id);
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
      className="flex max-w-2xl flex-col gap-3 rounded-xl border border-brand-forest/15 bg-white p-6"
    >
      {!canEdit && (
        <p className="rounded-lg bg-brand-forest/10 px-3 py-2 text-xs font-medium text-brand-forest/70">
          Tài khoản chỉ xem — bạn có thể xem chi tiết nhưng không thể tạo/sửa/hủy lịch KOL.
        </p>
      )}
      <fieldset disabled={!canEdit} className="contents">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Tên KOL
          </label>
          <input
            required
            value={kolName}
            onChange={(e) => setKolName(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Người Book KOL
          </label>
          <input
            value={bookedByName}
            onChange={(e) => setBookedByName(e.target.value)}
            placeholder="Tên nhân viên đã book KOL này"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số điện thoại
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số follower
          </label>
          <input
            type="number"
            min={0}
            value={followerCount}
            onChange={(e) => setFollowerCount(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Nền tảng
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Link kênh
          </label>
          <input
            type="url"
            value={channelLink}
            onChange={(e) => setChannelLink(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Ngày ghé thăm
          </label>
          <input
            type="date"
            required
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Giờ bắt đầu
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Giờ kết thúc
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Loại hợp tác
          </label>
          <input
            value={dealType}
            onChange={(e) => setDealType(e.target.value)}
            placeholder="VD: Đổi voucher, Trả phí..."
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Nội dung giao (deliverable)
          </label>
          <input
            value={contentDeliverable}
            onChange={(e) => setContentDeliverable(e.target.value)}
            placeholder="VD: 1 video TikTok + 2 story"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Giá review
        </label>
        <CurrencyInput
          value={reviewPrice}
          onChange={setReviewPrice}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Link video đã đăng (có thể thêm nhiều link nếu đăng trên nhiều nền tảng)
        </label>
        <div className="mb-2 flex gap-2">
          <input
            type="url"
            value={newVideoLink}
            onChange={(e) => setNewVideoLink(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
          <button
            type="button"
            onClick={addVideoLink}
            className="rounded-lg border border-brand-forest/30 px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-cream"
          >
            + Thêm
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {videoLinks.map((link) => (
            <li
              key={link}
              className="flex items-center justify-between gap-2 rounded-lg bg-brand-cream px-3 py-1.5 text-sm"
            >
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-brand-forest hover:underline"
              >
                {link}
              </a>
              <button
                type="button"
                onClick={() => removeVideoLink(link)}
                className="shrink-0 text-brand-forest/60 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
          <input
            type="checkbox"
            checked={hasReviewed}
            onChange={(e) => setHasReviewed(e.target.checked)}
          />
          Đã review
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-brand-forest">
            Đánh giá hiệu quả (để book lại lần sau nếu cần)
          </p>
          <StarRating value={effectivenessRating} onChange={setEffectivenessRating} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Quà tặng
        </label>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-brand-forest">
              <input
                type="checkbox"
                checked={giftDrink}
                onChange={(e) => setGiftDrink(e.target.checked)}
              />
              Đồ uống
            </label>
            {giftDrink && (
              <input
                type="number"
                min={1}
                value={giftDrinkQuantity}
                onChange={(e) => setGiftDrinkQuantity(e.target.value)}
                className="w-16 rounded-lg border border-brand-forest/30 px-2 py-1 text-sm outline-none focus:border-brand-amber"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-brand-forest">
              <input
                type="checkbox"
                checked={giftCake}
                onChange={(e) => setGiftCake(e.target.checked)}
              />
              Bánh
            </label>
            {giftCake && (
              <input
                type="number"
                min={1}
                value={giftCakeQuantity}
                onChange={(e) => setGiftCakeQuantity(e.target.value)}
                className="w-16 rounded-lg border border-brand-forest/30 px-2 py-1 text-sm outline-none focus:border-brand-amber"
              />
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Trạng thái
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BookingStatus)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          <option value="đã đặt">Đã đặt</option>
          <option value="đã tới">Đã tới</option>
          <option value="hủy">Hủy</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Ghi chú
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream"
        >
          Quay lại
        </button>
        {canEdit && (
          <div className="flex gap-2">
            {booking && booking.status !== "hủy" && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Hủy lịch
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-amber px-4 py-2 font-medium text-white hover:bg-brand-amber/90 disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
