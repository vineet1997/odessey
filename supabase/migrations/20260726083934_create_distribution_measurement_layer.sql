create table public.distribution_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('instagram', 'reddit', 'email', 'community', 'other')),
  handle_or_url text,
  contact jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  status text not null default 'shortlisted' check (status in ('shortlisted', 'contacted', 'replied', 'paused', 'declined')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outreach_touches (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references public.distribution_targets(id) on delete set null,
  channel text not null check (channel in ('instagram', 'reddit', 'email', 'community', 'other')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'replied', 'follow_up_due', 'closed')),
  message_variant text,
  sent_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.referral_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  label text not null,
  target_id uuid references public.distribution_targets(id) on delete set null,
  intended_channel text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  visitor_id uuid not null,
  visit_id uuid not null,
  event_name text not null check (event_name in (
    'app_opened', 'prologue_completed', 'search_submitted', 'recommendation_ready',
    'intent_changed', 'plan_refined', 'directions_opened', 'booking_opened',
    'share_opened', 'share_completed', 'feedback_started', 'feedback_submitted'
  )),
  referral_code text,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object')
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  visit_id uuid not null,
  referral_code text,
  sentiment text not null check (sentiment in ('helpful', 'almost', 'missed')),
  message text check (char_length(message) <= 1200),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object')
);

create index product_events_occurred_at_idx on public.product_events (occurred_at desc);
create index product_events_referral_event_idx on public.product_events (referral_code, event_name, occurred_at desc);
create index outreach_touches_target_idx on public.outreach_touches (target_id, sent_at desc);
create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.distribution_targets enable row level security;
alter table public.outreach_touches enable row level security;
alter table public.referral_links enable row level security;
alter table public.product_events enable row level security;
alter table public.feedback enable row level security;

create or replace view public.distribution_summary
with (security_invoker = true)
as
with event_rollup as (
  select
    coalesce(nullif(referral_code, ''), 'direct') as source,
    count(*) filter (where event_name = 'app_opened') as opens,
    count(distinct visit_id) as visits,
    count(distinct visitor_id) as visitors,
    count(*) filter (where event_name = 'search_submitted') as searches,
    count(*) filter (where event_name = 'recommendation_ready') as recommendations,
    count(*) filter (where event_name = 'booking_opened') as booking_clicks,
    count(*) filter (where event_name = 'directions_opened') as directions_clicks,
    count(*) filter (where event_name = 'share_completed') as shares
  from public.product_events
  group by 1
),
feedback_rollup as (
  select
    coalesce(nullif(referral_code, ''), 'direct') as source,
    count(*) as feedback_count,
    count(*) filter (where sentiment = 'helpful') as helpful_feedback
  from public.feedback
  group by 1
)
select
  coalesce(e.source, f.source) as source,
  coalesce(e.opens, 0) as opens,
  coalesce(e.visits, 0) as visits,
  coalesce(e.visitors, 0) as visitors,
  coalesce(e.searches, 0) as searches,
  coalesce(e.recommendations, 0) as recommendations,
  coalesce(e.booking_clicks, 0) as booking_clicks,
  coalesce(e.directions_clicks, 0) as directions_clicks,
  coalesce(e.shares, 0) as shares,
  coalesce(f.feedback_count, 0) as feedback_count,
  coalesce(f.helpful_feedback, 0) as helpful_feedback
from event_rollup e
full join feedback_rollup f on f.source = e.source;

comment on table public.product_events is 'Anonymous, minimal Ithaka usage events. Exact locations and IP addresses are not stored.';
comment on table public.feedback is 'Optional qualitative Ithaka feedback, submitted through the server-side event endpoint.';
comment on view public.distribution_summary is 'Private, attribution-level product and outreach rollup. Booking clicks are not completed bookings.';

revoke all on public.distribution_targets, public.outreach_touches, public.referral_links, public.product_events, public.feedback from anon, authenticated;
revoke all on public.distribution_summary from anon, authenticated;
