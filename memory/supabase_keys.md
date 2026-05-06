---
name: Supabase Key Naming
description: Supabase now uses PUBLISHABLE KEY and SECRET KEY — ANON KEY is deprecated
type: project
---

Supabase has renamed its keys: use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).

**Why:** Supabase deprecated the old naming convention. The env var names in this project already use the new convention.

**How to apply:** Always use the new names when writing Supabase config, docs, or env var references. Never suggest `ANON_KEY` or `SERVICE_ROLE_KEY`.
