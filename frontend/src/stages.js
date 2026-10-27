// What each stage of the call screen shows.
//
// Written from reading the call transcripts: where calls end, what prospects say at each point,
// and how callers' logged outcomes drift from what was said. Everything below is paraphrased
// patterns, not quotes from any call. Tap ids must exist in backend/src/catalog.js
// (backend/test/catalog.test.js checks this).

export const STAGES = [
  {
    n: 1,
    name: 'Opening',
    purpose: 'Reach the right person and say who you are. They decide in ten seconds if this is worth a minute.',
    mayHear: [
      '“Who is this? From where?” Often asked twice.',
      'Reception: “Name and reason for calling?”',
      '“That person left a long time ago.” Or: “This number has been mine for years.”',
    ],
    followUp: {
      mayHear: [
        '“Yes, I remember. What is it about?”',
        '“I am tied up right now.”',
        '“You mean the email you sent?”',
      ],
    },
    hint: 'Say the company name slowly: Meridian Growth Partners, Hyderabad. Confirm the name before anything else.',
    ready: 'If it is the wrong number, ask once whether they know where the person went, then stop.',
    taps: [
      ['right_person', 'Right person'],
      ['reception', 'Reception asked why'],
      ['someone_else', 'Someone else answered'],
      ['left_company', 'Left the company'],
      ['stale_number', 'Number is stale'],
      ['other_language', 'Needs another language'],
    ],
    wordsLabel: 'What they said first',
    wordsPlaceholder: 'Optional. Anything that helps the next caller.',
  },
  {
    n: 2,
    name: 'Purpose',
    purpose: 'Say in one or two sentences why you called, in words they could repeat to a colleague.',
    mayHear: [
      '“What do you do?” Asked again if the first answer was a label.',
      '“Why is it free? What do you get out of it?”',
      '“Where did you get my number?” Or: “I never asked for a report.”',
    ],
    followUp: {
      mayHear: [
        '“I have not opened it yet. Give me a day.”',
        '“It did not reach me. Send it again.”',
        '“Can I get it as a PDF?”',
      ],
      hint: 'Ask if they have seen it, then wait. Do not start explaining it.',
      ready: 'Check the email address before resending. Ask what format they want.',
      taps: [
        ['read_it', 'Has read it'],
        ['needs_day', 'Not yet, asked for a day'],
        ['not_received', 'Never received it'],
        ['wants_other_format', 'Wants another format'],
        ['wants_changes', 'Wants changes made'],
      ],
    },
    hint: '“Meridian Growth Partners, Hyderabad. We study Indian companies and write a short, free growth report on each. I would like to send you yours.”',
    ready: 'Website link on hand. If they ask where you got the number, answer truthfully.',
    taps: [
      ['asked_what', 'Asked what we do'],
      ['asked_why_free', 'Asked why it is free'],
      ['asked_source', 'Asked where we got the number'],
      ['asked_proof', 'Asked for website / proof first'],
      ['not_asked_for', 'Said they did not ask for it'],
      ['let_me_go_on', 'Let me go on'],
    ],
    wordsLabel: 'Their words',
    wordsPlaceholder: 'Exactly what they said when you told them why you called.',
  },
  {
    n: 3,
    name: 'Permission',
    purpose: 'Find out if they will talk now. A yes, a no, or a clock time are all good. Talking on without one is not.',
    mayHear: [
      '“Call me in half an hour.” Or: “after my meeting”, “in the evening”.',
      '“Send it first, I will see.”',
      'A short “yes”, then silence. Or they keep talking without answering.',
    ],
    hint: '“Is now a good time for two minutes, or shall I call when it suits you?”',
    ready: 'Get a clock time, not “later”. Write it in the box below.',
    taps: [
      ['yes_now', 'Yes, now'],
      ['callback', 'Call back at a time'],
      ['send_first', 'Send it first'],
      ['no_now', 'No, not now'],
      ['didnt_answer', 'Did not answer'],
    ],
    extra: {
      key: 'callback_at',
      when: 'callback',
      label: 'Call back at',
      type: 'datetime-local',
    },
    wordsLabel: 'Their words',
    wordsPlaceholder: 'The time they gave, in their words.',
  },
  {
    n: 4,
    name: 'Their business',
    purpose: 'Ask about their company and their work before saying more about yours.',
    mayHear: [
      'One line, then they wait for the pitch.',
      '“We only manufacture.” Or: “We are a startup.” Or: “That is another division.”',
      '“Tell me about yourself first.”',
    ],
    hint: '“What does the company do, and what are you responsible for there?”',
    ready: 'Know their sector before you ask. Do not read from the list.',
    taps: [
      ['answered', 'Answered'],
      ['corrected', 'Corrected us'],
      ['asked_about_us', 'Asked about us first'],
      ['one_liner', 'One line, then waited'],
      ['wrong_function', 'Not their function'],
      ['wouldnt_say', 'Would not say'],
    ],
    wordsLabel: 'Their words',
    wordsPlaceholder: 'How they describe the company or their role.',
  },
  {
    n: 5,
    name: 'Their need',
    purpose: 'Hear what they are trying to do or struggling with, in their own words. Write it down as said.',
    mayHear: [
      'A named goal: new markets, new products, hiring, what their buyers now ask for.',
      '“All fine. We have our own process.” Or: “We already have consultants.”',
      '“What can you do for a company like ours?”',
    ],
    hint: 'One open question, not a yes/no: “What are you trying to get done this year that is harder than it should be?”',
    ready: 'If they ask for proof, a sample in their sector.',
    taps: [
      ['named_need', 'Named a need'],
      ['none_needed', 'Said nothing needed'],
      ['has_provider', 'Has a provider / in-house'],
      ['asked_offer', 'Asked what we can do'],
      ['wants_proof', 'Wants a sample first'],
    ],
    wordsLabel: 'Their words, exactly as said',
    wordsPlaceholder: 'This is the line the next call is built on. Do not tidy it.',
    emphasis: true,
  },
  {
    n: 6,
    name: 'Objection',
    purpose: 'Hear the reason for a no and understand it. A reason you understand can be answered. One you talked over cannot.',
    mayHear: [
      '“We already have consultants, or an in-house team.”',
      '“Not me. Talk to the CFO, head office, corporate.”',
      '“Send something in writing and we will see.”',
    ],
    hint: 'Repeat the reason back in one line. Many “objections” are really “I do not understand what this is”.',
    ready: 'Being redirected or declining is not the same as being asked not to call.',
    taps: [
      ['have_provider', 'Has provider / in-house'],
      ['not_right_person', 'Not the right person'],
      ['no_reason', 'Not now, no reason'],
      ['stable', 'Stable, no need'],
      ['dont_understand', 'Does not understand it'],
      ['send_details', 'Send details first'],
      ['asked_not_to_call', 'Asked not to call again'],
    ],
    wordsLabel: 'Their words',
    wordsPlaceholder: 'The reason, as they said it.',
  },
  {
    n: 7,
    name: 'Next step',
    purpose: 'Agree one concrete thing, with a day and time or a channel.',
    mayHear: [
      '“Bhej dijiye, dekhte hain.” A yes that may be politeness.',
      'A day or time they name. Worth more than one you propose.',
      'A name or a department, sometimes with no number.',
    ],
    hint: '“Shall I send it on WhatsApp or email, and when should I call to hear what you thought?”',
    ready: 'Spell the email back. Note whose time it is: theirs or yours.',
    taps: [
      ['channel_whatsapp', 'Report on WhatsApp'],
      ['channel_email', 'Report by email'],
      ['time_theirs', 'Time named by them'],
      ['time_ours', 'Time proposed by us'],
      ['referral_number', 'Referred, number given'],
      ['referral_no_number', 'Referred, no number'],
      ['after_no', 'Agreed after saying no'],
    ],
    extra: {
      key: 'when',
      label: 'Day and time agreed',
      type: 'text',
      placeholder: 'e.g. Tuesday after 2',
    },
    wordsLabel: 'Their words',
    wordsPlaceholder: 'What they agreed to, in their words.',
  },
  {
    n: 8,
    name: 'Close',
    purpose: 'End clearly and record what happened: the outcome, the next step, and their words from stage 5.',
    mayHear: [
      'The line drops, or they hang up mid-sentence.',
      'A warm goodbye after a no. It is still a no.',
      'You log an outcome the call does not support.',
    ],
    taps: [],
  },
];

export const STAGE_BY_N = Object.fromEntries(STAGES.map((s) => [s.n, s]));

// content for a stage, applying the follow-up-call variant where one exists
export function stageContent(n, callType) {
  const base = STAGE_BY_N[n];
  if (callType === 'follow_up' && base.followUp) return { ...base, ...base.followUp };
  return base;
}

export function tapLabel(n, id) {
  const stage = STAGE_BY_N[n];
  const all = [...stage.taps, ...(stage.followUp?.taps ?? [])];
  return all.find(([tid]) => tid === id)?.[1] ?? id;
}

export const OUTCOMES = [
  { id: 'next_step_set', label: 'Next step set', hint: 'They named a day or time' },
  { id: 'report_agreed', label: 'Report agreed', hint: 'Will receive it, no day set' },
  { id: 'interested', label: 'Interested', hint: 'Positive, nothing agreed' },
  { id: 'call_back', label: 'Call back', hint: 'Asked for a later time' },
  { id: 'referred', label: 'Referred', hint: 'Pointed to someone else' },
  { id: 'not_interested', label: 'Not interested', hint: 'Declined' },
  { id: 'asked_not_to_call', label: 'Asked not to call', hint: 'Said so explicitly' },
  { id: 'wrong_person_or_left', label: 'Wrong person / left', hint: 'Or number is stale' },
  { id: 'could_not_connect', label: 'Could not connect', hint: 'Nobody useful reached' },
];
export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.label]));

export const FLAG_LABEL = {
  stale_contact: 'Stale contact',
  language_handoff: 'Needs another language',
  callback_due: 'Callback due',
  soft_yes: 'Yes after a no',
};

export const CALL_TYPES = [
  ['first_call', 'First call'],
  ['follow_up', 'Follow-up on a sent report'],
];
export const OFFERS = [
  ['growth_report', 'Free growth report'],
  ['founder_meeting', 'Meeting with the founder'],
  ['company_profile', 'Company profile to review'],
];
export const LANGUAGES = [
  ['english', 'English'],
  ['hindi', 'Hindi'],
  ['hinglish', 'Hinglish'],
  ['marathi', 'Marathi'],
  ['kannada', 'Kannada'],
  ['other', 'Other'],
];

// flags worth pre-selecting from what was tapped; the caller can change them at close
export function autoFlags(data, outcome) {
  const taps = (n) => data[n]?.taps ?? [];
  const flags = new Set();
  if (taps(1).includes('left_company') || taps(1).includes('stale_number')) flags.add('stale_contact');
  if (taps(1).includes('other_language')) flags.add('language_handoff');
  if (taps(3).includes('callback') || outcome === 'call_back') flags.add('callback_due');
  if (taps(7).includes('after_no')) flags.add('soft_yes');
  return [...flags];
}
