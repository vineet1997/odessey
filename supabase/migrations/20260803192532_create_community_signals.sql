create table public.community_signals (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  source_url text not null,
  reddit_post_id text,
  subreddit text not null check (subreddit ~ '^[A-Za-z0-9_]{2,32}$'),
  title text not null check (char_length(title) between 1 and 500),
  excerpt text not null default '' check (char_length(excerpt) <= 4000),
  author text check (author is null or char_length(author) <= 100),
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  matched_venue_ids text[] not null default '{}',
  signal_categories text[] not null default '{}',
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  public_summary text check (public_summary is null or char_length(public_summary) <= 1200),
  public_impact text check (public_impact in ('positive', 'negative', 'mixed', 'neutral')),
  score_adjustment smallint not null default 0 check (score_adjustment between -30 and 20),
  applies_after_local_time time,
  applies_before_local_time time,
  active_from date,
  active_until date,
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(matched_venue_ids) <= 20),
  check (cardinality(signal_categories) <= 12),
  check (active_until is null or active_from is null or active_until >= active_from),
  check (
    status <> 'approved'
    or (public_summary is not null and char_length(btrim(public_summary)) > 0)
  )
);

create unique index community_signals_reddit_post_id_idx
  on public.community_signals (reddit_post_id)
  where reddit_post_id is not null;

create index community_signals_status_published_idx
  on public.community_signals (status, published_at desc nulls last, discovered_at desc);

create index community_signals_venues_idx
  on public.community_signals using gin (matched_venue_ids);

create index community_signals_categories_idx
  on public.community_signals using gin (signal_categories);

alter table public.community_signals enable row level security;

-- All ingestion and review operations are server-side. The browser reads a
-- deliberately reduced projection through /api/community-data, so the table
-- itself is not exposed to anonymous or signed-in Data API clients.
revoke all on public.community_signals from anon, authenticated;
grant select, insert, update on public.community_signals to service_role;

comment on table public.community_signals is
  'Human-reviewed Reddit leads used as contextual cinema and journey signals. Pending rows are leads, not facts.';
comment on column public.community_signals.review_notes is
  'Private founder notes. Never returned by the public community-data API.';
