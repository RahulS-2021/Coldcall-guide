// Single place for the ids the API accepts. The frontend (frontend/src/stages.js) owns the
// wording the caller sees; test/catalog.test.js fails if the two drift apart.

export const STAGE_NAMES = {
  1: 'Opening',
  2: 'Purpose',
  3: 'Permission',
  4: 'Their business',
  5: 'Their need',
  6: 'Objection',
  7: 'Next step',
  8: 'Close',
};

// What the outcome ids mean. These definitions are also given to the LLM.
export const OUTCOMES = {
  next_step_set: 'Next step set: a meeting or call at a day/time the prospect agreed to.',
  report_agreed: 'Report agreed: the prospect agreed to receive a document, but no day/time was agreed. May be politeness.',
  interested: 'Interested, no step: the prospect said something positive about a need, but nothing was agreed.',
  call_back: 'Call back: the prospect asked to be called later (a time, or "after my meeting"), and no pitch was completed.',
  referred: 'Referred elsewhere: the prospect pointed to another person, department or company.',
  not_interested: 'Not interested: the prospect declined, with or without a reason. They did NOT ask to stop being called.',
  asked_not_to_call: 'Asked not to call: the prospect explicitly asked not to be called again. Use only when that was said.',
  wrong_person_or_left: 'Wrong person or left: the person reached is not the listed person, left the company, or the number is stale.',
  could_not_connect: 'Could not connect: nobody useful was reached, or the line dropped before any real exchange.',
};

export const FLAGS = ['stale_contact', 'language_handoff', 'callback_due', 'soft_yes'];
export const CALL_TYPES = ['first_call', 'follow_up'];
export const OFFERS = ['growth_report', 'founder_meeting', 'company_profile'];
export const LANGUAGES = ['english', 'hindi', 'hinglish', 'marathi', 'kannada', 'other'];
export const NEXT_STEP_STRENGTHS = ['none', 'weak', 'firm'];

// stage -> { tap id: label }. Labels are what the LLM and the fallback summary read.
export const TAPS = {
  1: {
    right_person: 'Right person',
    reception: 'Reception asked why',
    someone_else: 'Someone else answered',
    left_company: 'Left the company',
    stale_number: 'Number is stale',
    other_language: 'Needs another language',
  },
  2: {
    asked_what: 'Asked what we do',
    asked_why_free: 'Asked why it is free',
    asked_source: 'Asked where we got the number',
    asked_proof: 'Asked for website / proof first',
    not_asked_for: 'Said they did not ask for it',
    let_me_go_on: 'Let me go on',
    // follow-up calls
    read_it: 'Has read it',
    needs_day: 'Not yet, asked for a day',
    not_received: 'Never received it',
    wants_other_format: 'Wants another format',
    wants_changes: 'Wants changes made',
  },
  3: {
    yes_now: 'Yes, now',
    callback: 'Call back at a time',
    send_first: 'Send it first',
    no_now: 'No, not now',
    didnt_answer: 'Did not answer',
  },
  4: {
    answered: 'Answered',
    corrected: 'Corrected us',
    asked_about_us: 'Asked about us first',
    one_liner: 'One line, then waited',
    wrong_function: 'Not their function',
    wouldnt_say: 'Would not say',
  },
  5: {
    named_need: 'Named a need',
    none_needed: 'Said nothing needed',
    has_provider: 'Has a provider / in-house',
    asked_offer: 'Asked what we can do',
    wants_proof: 'Wants a sample first',
  },
  6: {
    have_provider: 'Has provider / in-house',
    not_right_person: 'Not the right person',
    no_reason: 'Not now, no reason',
    stable: 'Stable, no need',
    dont_understand: 'Does not understand it',
    send_details: 'Send details first',
    asked_not_to_call: 'Asked not to call again',
  },
  7: {
    channel_whatsapp: 'Report on WhatsApp',
    channel_email: 'Report by email',
    time_theirs: 'Time named by them',
    time_ours: 'Time proposed by us',
    referral_number: 'Referred, number given',
    referral_no_number: 'Referred, no number',
    after_no: 'Agreed after saying no',
  },
  8: {},
};

export const isValidTap = (stage, id) =>
  Boolean(TAPS[stage]) && Object.hasOwn(TAPS[stage], id);

export const tapLabel = (stage, id) => (isValidTap(stage, id) ? TAPS[stage][id] : id);
