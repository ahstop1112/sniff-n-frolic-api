export interface Order {
  id: string;
  member_id: string | null;
  staff_id: string | null;
  source: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  guest_name: string | null;
  guest_email: string | null;
  shipping_address: ShippingAddress | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: Date;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
}