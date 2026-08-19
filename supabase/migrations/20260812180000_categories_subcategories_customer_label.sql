-- Customer-facing service taxonomy (business label stays on subcategory).
alter table public.categories_subcategories
  add column if not exists customer_label text,
  add column if not exists visual_eligible boolean not null default true;

comment on column public.categories_subcategories.customer_label is
  'Customer-facing card label for Adventure; business name remains subcategory.';
comment on column public.categories_subcategories.visual_eligible is
  'When false, service should not enter the visual Adventure experience.';
