alter table public.categories_subcategories
  add column if not exists photo_subject text,
  add column if not exists photo_context text;

comment on column public.categories_subcategories.photo_subject is
  'Customer-facing noun used by photo upload prompts, such as room, yard, roof, or face/profile.';
comment on column public.categories_subcategories.photo_context is
  'Sentence fragment explaining what a real photo reveals for a more grounded estimate.';

alter table public.categories_subcategories
  drop constraint if exists categories_subcategories_photo_subject_length,
  drop constraint if exists categories_subcategories_photo_context_length;

alter table public.categories_subcategories
  add constraint categories_subcategories_photo_subject_length
    check (photo_subject is null or char_length(btrim(photo_subject)) between 1 and 80),
  add constraint categories_subcategories_photo_context_length
    check (photo_context is null or char_length(btrim(photo_context)) between 1 and 300);

with service_language as (
  select
    service.id,
    lower(concat_ws(' ', service.subcategory, category.name, service.service_summary)) as haystack
  from public.categories_subcategories service
  left join public.categories category on category.id = service.category_id
)
update public.categories_subcategories service
set
  photo_subject = coalesce(
    nullif(btrim(service.photo_subject), ''),
    case
      when language.haystack ~ '(rhinoplast|nose (job|surgery)|facial plastic|nose reshaping)' then 'face/profile'
      when language.haystack ~ '(manicure|nail art|nail salon|acrylic nails|gel nails|(^| )nails?( |$))' then 'nails'
      when language.haystack ~ '(roof|gutter)' then 'roof'
      when language.haystack ~ '(landscap|lawn|garden|yard|irrigation)' then 'yard'
      when language.haystack ~ '(kitchen|cabinet|countertop)' then 'kitchen'
      when language.haystack ~ '(bath|shower|tub|vanity|toilet)' then 'bathroom'
      when language.haystack ~ '(furniture|sofa|couch|sectional|dining table|home furnishing)' then 'room/space'
      when language.haystack ~ '(interior design|home decor|room design|living room|bedroom|dining room)' then 'room'
      when language.haystack ~ '(deck|porch)' then 'deck'
      when language.haystack ~ '(patio|pergola|hardscap|outdoor|fire pit)' then 'outdoor space'
      when language.haystack ~ '(pool|spa|hot tub)' then 'pool area'
      when language.haystack ~ '(window|door)' then 'windows'
      when language.haystack ~ '(floor|tile|carpet|hardwood)' then 'room'
      else 'space'
    end
  ),
  photo_context = coalesce(
    nullif(btrim(service.photo_context), ''),
    case
      when language.haystack ~ '(rhinoplast|nose (job|surgery)|facial plastic|nose reshaping)'
        then 'your actual profile, proportions, and visible details that affect the estimate'
      when language.haystack ~ '(manicure|nail art|nail salon|acrylic nails|gel nails|(^| )nails?( |$))'
        then 'their current length, shape, condition, and details that affect price'
      when language.haystack ~ '(roof|gutter)'
        then 'its visible condition, size, slope, and details that affect price'
      when language.haystack ~ '(landscap|lawn|garden|yard|irrigation|patio|pergola|hardscap|outdoor|fire pit|pool|hot tub)'
        then 'the actual space, condition, size, and site details that affect price'
      when language.haystack ~ '(furniture|sofa|couch|sectional|dining table|home furnishing)'
        then 'the actual room, layout, size, and existing details that affect price'
      when language.haystack ~ '(interior design|home decor|room design|living room|bedroom|dining room)'
        then 'the actual space, layout, size, and details that affect price'
      when language.haystack ~ '(window|door)'
        then 'their visible condition, size, placement, and details that affect price'
      when language.haystack ~ '(floor|tile|carpet|hardwood)'
        then 'the actual floor area, condition, layout, and details that affect price'
      else 'the actual space, condition, size, and details that affect price'
    end
  )
from service_language language
where language.id = service.id;
