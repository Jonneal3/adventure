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
    additional_credits_price_cents: number;
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
    user_id: string;
    plan_id: string;
    start_date: string | null;
    end_date: string | null;
    monthly_price_cents: number;
    ai_credits_balance: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    status: 'active' | 'canceled' | 'past_due' | 'inactive' | 'trialing';
    created_at: string;
    updated_at: string;
}
