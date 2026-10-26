// טיפוסים משותפים — מראה של הסכימה (0001_foundation.sql)

export type BusinessStatus = 'pending' | 'listed' | 'suspended';
export type AddressMode = 'studio' | 'home';

export interface Business {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  description: string | null;
  instagram_url: string | null;
  status: BusinessStatus;
  verified_at: string | null;
  address_mode: AddressMode;
  city: string | null;
  neighborhood: string | null;
  street_public: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
  booking_horizon_days: number;
  min_notice_minutes: number;
  buffer_minutes: number;
  cancel_window_hours: number;
  require_approval_all: boolean;
  require_approval_new: boolean;
  min_reliability_pct: number | null;
  approval_timeout_minutes: number;
  created_at: string;
  // שדות תצוגה (נוספו ב-seed הדמו)
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
}

export interface BusinessPrivate {
  business_id: string;
  street: string | null;
  house_number: string | null;
  entrance_notes: string | null;
  lat: number | null;
  lng: number | null;
}

export interface CategoryGroup {
  key: string;
  name: string;
  sort_order: number;
}

export interface Category {
  id: string;
  group_key: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface Service {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_min: number;
  active: boolean;
  sort_order: number;
}

export interface OpenHour {
  id: string;
  business_id: string;
  calendar_id: string;
  weekday: number;
  opens: string;  // "09:00:00"
  closes: string;
}
