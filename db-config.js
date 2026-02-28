/*
==========================================================
  NIPE QUIZ PORTAL — Supabase Database Configuration
  ✅ SUPABASE IS 100% FREE — No credit card, no payment!
==========================================================

  HOW TO SET UP (takes ~5 minutes):

  STEP 1 — Create free account:
    → Go to https://supabase.com → "Start your project"
    → Sign up with Google (FREE — no credit card needed)

  STEP 2 — Create a project:
    → Click "New Project" → name: "nipe-quiz"
    → Set any database password → Click "Create Project"
    → Wait ~1 minute

  STEP 3 — Run this SQL to create tables:
    → Left sidebar → "SQL Editor" → New query → Paste below → RUN

─────────────────── SQL TO RUN ───────────────────────────

create table if not exists nipe_data (
  id text primary key default 'main',
  quizzes jsonb default '[]',
  selections jsonb default '{}',
  congrats jsonb default '{}'
);

create table if not exists nipe_results (
  id bigserial primary key,
  data jsonb,
  created_at timestamptz default now()
);

alter table nipe_data    enable row level security;
alter table nipe_results enable row level security;

create policy "allow_all" on nipe_data    for all using (true) with check (true);
create policy "allow_all" on nipe_results for all using (true) with check (true);

insert into nipe_data (id) values ('main') on conflict (id) do nothing;

──────────────────────────────────────────────────────────

  STEP 4 — Get your credentials:
    → Left sidebar → "Project Settings" → "API"
    → Copy "Project URL"        → paste as SUPABASE_URL below
    → Copy "anon / public" key  → paste as SUPABASE_ANON_KEY below

  STEP 5 — Save this file. Done! All devices now share data.

  ⚠️ NOTE: If credentials are wrong or empty, the app will
     automatically fall back to localStorage (device-only mode).

==========================================================
*/

const SUPABASE_URL = 'https://himbhxcqrlvprtzslcvi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpbWJoeGNxcmx2cHJ0enNsY3ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTk0NjIsImV4cCI6MjA4NzY3NTQ2Mn0.ak5Bc3A4weV_MkV0MrAVlEoo7Z2xV04n0MfzaSXIeFY';

// ⚠️ NEVER share the sb_secret_ key — keep it private!
