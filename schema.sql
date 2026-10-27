-- Cold-call guide: Supabase (Postgres) schema.
-- Run this once in the Supabase SQL editor.
-- The backend uses the service-role key, so row level security is enabled with no
-- public policies: the browser never talks to the database directly.

create extension if not exists pgcrypto;

create table if not exists calls (
  id               uuid primary key default gen_random_uuid(),
  contact_name     text not null check (char_length(contact_name) between 1 and 120),
  company          text not null default '' check (char_length(company) <= 160),
  call_type        text not null default 'first_call'
                     check (call_type in ('first_call', 'follow_up')),
  offer            text not null default 'growth_report'
                     check (offer in ('growth_report', 'founder_meeting', 'company_profile')),
  language         text not null default 'english'
                     check (language in ('english', 'hindi', 'hinglish', 'marathi', 'kannada', 'other')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  -- furthest stage the call reached (1 Opening .. 8 Close). Calls end early, so this is not the outcome.
  last_stage       smallint not null default 1 check (last_stage between 1 and 8),
  outcome          text check (outcome in (
                     'next_step_set', 'report_agreed', 'interested', 'call_back', 'referred',
                     'not_interested', 'asked_not_to_call', 'wrong_person_or_left', 'could_not_connect')),
  -- stale_contact | language_handoff | callback_due | soft_yes
  flags            text[] not null default '{}',
  callback_at      timestamptz,
  summary          text not null default '' check (char_length(summary) <= 300),
  -- last outcome check (LLM or rules): suggested outcome, next-step strength, reason
  check_result     jsonb,
  -- true when the outcome the caller saved differs from what the check suggested
  mismatch         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists stage_results (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid not null references calls (id) on delete cascade,
  stage      smallint not null check (stage between 1 and 8),
  -- ids of the taps pressed at this stage (see backend/src/catalog.js)
  taps       text[] not null default '{}',
  -- the prospect's own words, exactly as typed. Never rewritten by the LLM.
  words      text not null default '' check (char_length(words) <= 4000),
  -- small structured fields: { "when": "Tuesday after 2" } at stage 7, { "callback_at": "..." } at stage 3
  extra      jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (call_id, stage)
);

create index if not exists calls_started_at_idx on calls (started_at desc);
create index if not exists calls_last_stage_idx on calls (last_stage);

alter table calls enable row level security;
alter table stage_results enable row level security;
