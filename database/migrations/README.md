# Migrations as applied

These files are the SQL that was applied to the live Supabase project, kept here so the repo can rebuild the Mall's rules.
The live database is the authority; `database/schema.sql` and `database/schema/` are older and stale.

| File | Applied | What it does |
|---|---|---|
| `20261114_stage1_mall_hardening.sql` | 2026-11-14 | Order items priced by the database, KYC and transfer fixes, tighter grants, indexes |
| `20261120_stage2a_stock_reservations_rewards.sql` | 2026-11-20 | Stock reservations, stock back on cancel, reward paid on delivery |

Rules: additive or replace-only, never a DROP without Todd's explicit approval; prove in a rolled-back transaction first; check the Supabase advisors afterwards.
