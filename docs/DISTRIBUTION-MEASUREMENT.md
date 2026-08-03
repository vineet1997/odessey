# Ithaka distribution measurement

This is a private learning log, not a sales funnel. It answers only the useful questions: where a visitor came from, whether they reached a recommendation, whether they opened a practical next step, and what they thought of it.

## Before deploying

Add these **server-only** variables in Vercel for the Ithaka project:

```
SUPABASE_URL=https://tiycurqyfqdcsfrycypm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Get the service-role key from Supabase Dashboard → Project Settings → API. It must never be prefixed with `VITE_`, committed, or pasted into client code.

## Referral links

Create one row in `referral_links` for each intentional distribution source, then share a link in this form:

```
https://ithaka.vineet.cc/?ref=delhimovieclub
```

Keep codes lowercase, short, and non-identifying. A visitor who arrives without `ref` is counted as `direct`. Existing Reddit replies without a `ref` remain direct; do not edit them just to add tracking.

## What is recorded

- Anonymous browser and tab IDs, not accounts or email addresses.
- Referral code, app path, chosen intent, and the recommended venue/format.
- Recommendation completion, directions/booking **clicks**, sharing, and optional feedback.

Exact home coordinates, route coordinates, IP address, and booking completion are intentionally not recorded.

## Reading the data

`distribution_summary` rolls up opens, visits, searches, recommendations, practical clicks, shares, and feedback by referral code. It is private: all base tables have RLS enabled and no browser roles have access.
