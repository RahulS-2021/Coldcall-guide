-- Optional demo rows so the "Past calls" screen is not empty on first load.
-- Every name and company below is invented for this demo.

insert into calls (id, contact_name, company, call_type, offer, language, started_at, ended_at, duration_seconds,
                   last_stage, outcome, flags, callback_at, summary, mismatch)
values
 ('a0000000-0000-4000-8000-000000000001', 'Ms. Kavita Rao', 'Harbor Lane Foods', 'first_call', 'growth_report', 'english',
  now() - interval '5 hours', now() - interval '5 hours' + interval '3 minutes', 190,
  7, 'next_step_set', '{}', null,
  'Wants the report by email first; she named Thursday after 3 for the follow-up call.', false),
 ('a0000000-0000-4000-8000-000000000002', 'Mr. Dev Malhotra', 'Pinecrest Tools', 'first_call', 'growth_report', 'hinglish',
  now() - interval '4 hours', now() - interval '4 hours' + interval '40 seconds', 40,
  1, 'wrong_person_or_left', '{stale_contact}', null,
  'Number now belongs to someone else; contact record needs fixing.', false),
 ('a0000000-0000-4000-8000-000000000003', 'Mr. Imran Sheikh', 'Brightwell Packaging', 'first_call', 'founder_meeting', 'english',
  now() - interval '3 hours 30 minutes', now() - interval '3 hours 30 minutes' + interval '1 minute', 62,
  3, 'call_back', '{callback_due}', now() + interval '2 hours',
  'In a meeting; asked for a call back this afternoon.', false),
 ('a0000000-0000-4000-8000-000000000004', 'Dr. Suman Pillai', 'Verdant Labs', 'first_call', 'growth_report', 'english',
  now() - interval '3 hours', now() - interval '3 hours' + interval '90 seconds', 95,
  6, 'not_interested', '{}', null,
  'Already works with an outside firm; no need this year.', false),
 ('a0000000-0000-4000-8000-000000000005', 'Mr. Rohan Desai', 'Kestrel Components', 'follow_up', 'company_profile', 'english',
  now() - interval '2 hours', now() - interval '2 hours' + interval '1 minute', 58,
  2, 'call_back', '{callback_due}', now() + interval '1 day',
  'Has not opened the profile yet; asked for a day.', false),
 ('a0000000-0000-4000-8000-000000000006', 'Ms. Anita Verghese', 'Lakeshore Textiles', 'first_call', 'growth_report', 'english',
  now() - interval '90 minutes', now() - interval '90 minutes' + interval '4 minutes', 255,
  7, 'report_agreed', '{soft_yes}', null,
  'Said they do not need it, then agreed to receive the report on WhatsApp; no day set.', false),
 ('a0000000-0000-4000-8000-000000000007', 'Mr. Gopal Nair', 'Summit Fasteners', 'first_call', 'growth_report', 'english',
  now() - interval '1 hour', now() - interval '1 hour' + interval '50 seconds', 50,
  4, 'asked_not_to_call', '{}', null,
  'Said he is not interested this quarter.', true),
 ('a0000000-0000-4000-8000-000000000008', 'Mr. Tarun Bose', 'Orchid Pharma Services', 'first_call', 'growth_report', 'hindi',
  now() - interval '30 minutes', now() - interval '30 minutes' + interval '45 seconds', 45,
  1, 'could_not_connect', '{language_handoff}', null,
  'Prefers Hindi; needs a Hindi-speaking caller.', false)
on conflict (id) do nothing;

insert into stage_results (call_id, stage, taps, words, extra)
values
 ('a0000000-0000-4000-8000-000000000001', 1, '{right_person}', '', '{}'),
 ('a0000000-0000-4000-8000-000000000001', 2, '{asked_what,asked_why_free}', 'what do you get out of doing this for free', '{}'),
 ('a0000000-0000-4000-8000-000000000001', 5, '{named_need}', 'we want to open two new export markets but do not know which ones first', '{}'),
 ('a0000000-0000-4000-8000-000000000001', 7, '{channel_email,time_theirs}', '', '{"when": "Thursday after 3"}'),
 ('a0000000-0000-4000-8000-000000000007', 3, '{no_now}', 'not this quarter, we are busy with audits', '{}')
on conflict (call_id, stage) do nothing;
