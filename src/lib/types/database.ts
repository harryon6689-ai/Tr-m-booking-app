export type LocationType = "phòng lớn" | "phòng nhỏ" | "box" | "ghế ngoài";
export type BookingStatus = "đã đặt" | "đã tới" | "hủy";
export type CustomerType = "thường" | "VIP" | "KOL";
export type DiscountType = "phòng" | "đồ uống";
export type UserRole = "admin" | "staff";
export type CustomerOrgType = "cá nhân" | "công ty/tổ chức";
export type PricingMode = "free_hours_plus_overage" | "flat_rate";
export type RecurrenceType =
  | "hàng tuần"
  | "hàng tháng"
  | "hàng quý"
  | "hàng năm"
  | "ngày cụ thể";

export const EQUIPMENT_OPTIONS = [
  "Máy chiếu",
  "Loa",
  "Micro",
  "Bảng trắng/Flipchart",
  "Ổ cắm điện mở rộng",
] as const;

export interface UserPermissions {
  floor_map: boolean;
  kol: boolean;
  history: boolean;
  fixed_customers: boolean;
  preferred_customers: boolean;
  discount_rules: boolean;
  checkin: boolean;
  quick_booking: boolean;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          role: UserRole;
          active: boolean;
          permissions: UserPermissions;
          view_only: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          role?: UserRole;
          active?: boolean;
          permissions?: UserPermissions;
          view_only?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          role?: UserRole;
          active?: boolean;
          permissions?: UserPermissions;
          view_only?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          name: string;
          type: LocationType;
          capacity: number;
          equipment: string | null;
          display_order: number;
          minimum_spend: number | null;
          included_hours: number;
          overage_fee_per_hour: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: LocationType;
          capacity: number;
          equipment?: string | null;
          display_order?: number;
          minimum_spend?: number | null;
          included_hours?: number;
          overage_fee_per_hour?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: LocationType;
          capacity?: number;
          equipment?: string | null;
          display_order?: number;
          minimum_spend?: number | null;
          included_hours?: number;
          overage_fee_per_hour?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          location_id: string;
          customer_name: string;
          phone: string | null;
          start_time: string;
          end_time: string;
          status: BookingStatus;
          deposit_amount: number;
          discount_applied: number;
          final_price: number;
          note: string | null;
          org_type: CustomerOrgType;
          organization_name: string | null;
          attendee_count: number | null;
          equipment_needed: string[];
          equipment_note: string | null;
          pricing_rule_id: string | null;
          deposit_refunded: boolean;
          overage_fee: number;
          vat_invoice_requested: boolean;
          vat_company_name: string | null;
          vat_company_address: string | null;
          vat_tax_code: string | null;
          vat_email: string | null;
          actual_drink_spend: number | null;
          overage_fee_paid: boolean;
          minimum_spend_shortfall_paid: boolean;
          seat_number: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          customer_name: string;
          phone?: string | null;
          start_time: string;
          end_time: string;
          status?: BookingStatus;
          deposit_amount?: number;
          discount_applied?: number;
          final_price?: number;
          note?: string | null;
          org_type?: CustomerOrgType;
          organization_name?: string | null;
          attendee_count?: number | null;
          equipment_needed?: string[];
          equipment_note?: string | null;
          pricing_rule_id?: string | null;
          deposit_refunded?: boolean;
          overage_fee?: number;
          vat_invoice_requested?: boolean;
          vat_company_name?: string | null;
          vat_company_address?: string | null;
          vat_tax_code?: string | null;
          vat_email?: string | null;
          actual_drink_spend?: number | null;
          overage_fee_paid?: boolean;
          minimum_spend_shortfall_paid?: boolean;
          seat_number?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          customer_name?: string;
          phone?: string | null;
          start_time?: string;
          end_time?: string;
          status?: BookingStatus;
          deposit_amount?: number;
          discount_applied?: number;
          final_price?: number;
          note?: string | null;
          org_type?: CustomerOrgType;
          organization_name?: string | null;
          attendee_count?: number | null;
          equipment_needed?: string[];
          equipment_note?: string | null;
          pricing_rule_id?: string | null;
          deposit_refunded?: boolean;
          overage_fee?: number;
          vat_invoice_requested?: boolean;
          vat_company_name?: string | null;
          vat_company_address?: string | null;
          vat_tax_code?: string | null;
          vat_email?: string | null;
          actual_drink_spend?: number | null;
          overage_fee_paid?: boolean;
          minimum_spend_shortfall_paid?: boolean;
          seat_number?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_location_id_fkey";
            columns: ["location_id"];
            referencedRelation: "locations";
            referencedColumns: ["id"];
          }
        ];
      };
      kol_bookings: {
        Row: {
          id: string;
          kol_name: string;
          platform: string | null;
          follower_count: number | null;
          visit_date: string;
          start_time: string | null;
          end_time: string | null;
          deal_type: string | null;
          content_deliverable: string | null;
          status: BookingStatus;
          note: string | null;
          channel_link: string | null;
          review_price: number;
          gift_drink: boolean;
          gift_drink_quantity: number | null;
          gift_cake: boolean;
          gift_cake_quantity: number | null;
          phone: string | null;
          has_reviewed: boolean;
          video_links: string[];
          booked_by_name: string | null;
          effectiveness_rating: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kol_name: string;
          platform?: string | null;
          follower_count?: number | null;
          visit_date: string;
          start_time?: string | null;
          end_time?: string | null;
          deal_type?: string | null;
          content_deliverable?: string | null;
          status?: BookingStatus;
          note?: string | null;
          channel_link?: string | null;
          review_price?: number;
          gift_drink?: boolean;
          gift_drink_quantity?: number | null;
          gift_cake?: boolean;
          gift_cake_quantity?: number | null;
          phone?: string | null;
          has_reviewed?: boolean;
          video_links?: string[];
          booked_by_name?: string | null;
          effectiveness_rating?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kol_name?: string;
          platform?: string | null;
          follower_count?: number | null;
          visit_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          deal_type?: string | null;
          content_deliverable?: string | null;
          status?: BookingStatus;
          note?: string | null;
          channel_link?: string | null;
          review_price?: number;
          gift_drink?: boolean;
          gift_drink_quantity?: number | null;
          gift_cake?: boolean;
          gift_cake_quantity?: number | null;
          phone?: string | null;
          has_reviewed?: boolean;
          video_links?: string[];
          booked_by_name?: string | null;
          effectiveness_rating?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kol_bookings_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      discount_rules: {
        Row: {
          id: string;
          customer_type: CustomerType;
          discount_type: DiscountType;
          default_percent: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_type: CustomerType;
          discount_type: DiscountType;
          default_percent?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_type?: CustomerType;
          discount_type?: DiscountType;
          default_percent?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          location_type: LocationType;
          rule_name: string;
          min_attendees: number | null;
          max_attendees: number | null;
          pricing_mode: PricingMode;
          free_hours: number | null;
          overage_fee_per_hour: number | null;
          flat_price: number | null;
          flat_price_hours: number | null;
          requires_drink_per_person: boolean;
          active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_type: LocationType;
          rule_name: string;
          min_attendees?: number | null;
          max_attendees?: number | null;
          pricing_mode: PricingMode;
          free_hours?: number | null;
          overage_fee_per_hour?: number | null;
          flat_price?: number | null;
          flat_price_hours?: number | null;
          requires_drink_per_person?: boolean;
          active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          location_type?: LocationType;
          rule_name?: string;
          min_attendees?: number | null;
          max_attendees?: number | null;
          pricing_mode?: PricingMode;
          free_hours?: number | null;
          overage_fee_per_hour?: number | null;
          flat_price?: number | null;
          flat_price_hours?: number | null;
          requires_drink_per_person?: boolean;
          active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      fixed_customers: {
        Row: {
          id: string;
          location_id: string;
          customer_name: string;
          phone: string | null;
          recurrence_type: RecurrenceType;
          weekday: number[] | null;
          day_of_month: number[] | null;
          custom_dates: string[] | null;
          start_time: string;
          end_time: string;
          effective_from: string;
          effective_until: string | null;
          active: boolean;
          deposit_amount: number;
          note: string | null;
          seat_number: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          customer_name: string;
          phone?: string | null;
          recurrence_type: RecurrenceType;
          weekday?: number[] | null;
          day_of_month?: number[] | null;
          custom_dates?: string[] | null;
          start_time: string;
          end_time: string;
          effective_from?: string;
          effective_until?: string | null;
          active?: boolean;
          deposit_amount?: number;
          note?: string | null;
          seat_number?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          customer_name?: string;
          phone?: string | null;
          recurrence_type?: RecurrenceType;
          weekday?: number[] | null;
          day_of_month?: number[] | null;
          custom_dates?: string[] | null;
          start_time?: string;
          end_time?: string;
          effective_from?: string;
          effective_until?: string | null;
          deposit_amount?: number;
          active?: boolean;
          note?: string | null;
          seat_number?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_customers_location_id_fkey";
            columns: ["location_id"];
            referencedRelation: "locations";
            referencedColumns: ["id"];
          }
        ];
      };
      preferred_customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          customer_type: CustomerType;
          org_type: CustomerOrgType;
          organization_name: string | null;
          custom_discount_percent: number | null;
          equipment_needed: string[];
          equipment_note: string | null;
          note: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          customer_type?: CustomerType;
          org_type?: CustomerOrgType;
          organization_name?: string | null;
          custom_discount_percent?: number | null;
          equipment_needed?: string[];
          equipment_note?: string | null;
          note?: string | null;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          customer_type?: CustomerType;
          org_type?: CustomerOrgType;
          organization_name?: string | null;
          custom_discount_percent?: number | null;
          equipment_needed?: string[];
          equipment_note?: string | null;
          note?: string | null;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fixed_customer_checkins: {
        Row: {
          fixed_customer_id: string;
          occurrence_date: string;
          arrived: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          fixed_customer_id: string;
          occurrence_date: string;
          arrived?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          fixed_customer_id?: string;
          occurrence_date?: string;
          arrived?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_customer_checkins_fixed_customer_id_fkey";
            columns: ["fixed_customer_id"];
            referencedRelation: "fixed_customers";
            referencedColumns: ["id"];
          }
        ];
      };
      app_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
