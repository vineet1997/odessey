alter table public.community_signals
  add column applies_to_formats text[] not null default '{}',
  add constraint community_signals_formats_limit
    check (cardinality(applies_to_formats) <= 20);

comment on column public.community_signals.applies_to_formats is
  'Exact District format labels affected by the signal. Empty means every format at the matched venue.';
