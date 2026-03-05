export interface Plan {
  plan_id: string;
  name: string;
  monthly_price_cents: number;
  setup_fee_cents: number;
  max_widgets: number | null;
  ai_credits_included: number;
  lead_capture_level: 'basic' | 'crm' | 'api';
  support_level: 'standard' | 'priority' | 'dedicated';
  white_label: boolean;
  api_access: boolean;
  revenue_share: boolean;
  exclusivity: boolean;
  onboarding_type: 'self_serve' | 'one_on_one' | 'concierge';
  analytics_level: 'basic' | 'advanced' | 'enterprise';
  prompt_packs_level: 'standard' | 'customizable' | 'custom_development';
  additional_credit_price: number | null;
  is_pricing_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface AICreditPack {
  pack_id: string;
  name: string;
  credits_amount: number;
  price_cents: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  subscription_id: string;
  user_id: string | null;  // Allow null to match database schema
  plan_id: string | null;  // Allow null to match database schema
  start_date: string | null;
  end_date: string | null;
  monthly_price_cents: number | null;
  ai_credits_balance: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;  // Database can return any status string
  trial_end: string | null;
  auto_purchase_enabled: boolean | null;
  auto_purchase_amount: number | null; // Dollar amount to auto-purchase when going over
  additional_credit_price: number | null; // Price per additional credit for this subscription
  created_at: string | null;
  updated_at: string | null;
}

export interface CreditUsage {
  usage_id: string;
  user_id: string;
  subscription_id: string | null;
  credits_used: number;
  cost_cents: number | null;
  usage_date: string | null;
  created_at: string | null;
} 