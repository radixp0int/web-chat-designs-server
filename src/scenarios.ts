// Canned demo scenarios, themed to match the chat-interfaces "Aristotle"
// finance assistant. pickScenario routes on keywords in the prompt so the
// demo can show off specific flows on cue:
//
//   "error"                → stream dies mid-answer with a fatal error event
//   "fail"                 → a tool call fails, the model recovers and answers
//   "tool"/"search"/"rate" → two sequential tool calls before the answer
//   "50"/"stress"          → an answer citing 50 references (scale test)
//   "cite"/"source"/"save" → an answer citing a handful of references
//   anything else          → cycles through the default scenarios

import { financeSources, makeStressSources, sourceHighlights } from './citations.ts';
import type { Scenario } from './stream.ts';

// The stress corpus is deterministic, so one instance is reused for both the
// scenario's sources and its highlight-offset lookups.
const stressSources = makeStressSources(50);

const toolHeavy: Scenario = [
  {
    kind: 'thinking',
    text: 'The user wants current market context. I should pull fresh numbers rather than rely on stale training data — one call for benchmark rates, one for the equity snapshot, then synthesize.',
  },
  {
    kind: 'tool',
    name: 'get_benchmark_rates',
    input: { series: ['fed_funds', 'us10y'], region: 'US' },
    output: { fed_funds: 4.25, us10y: 3.98, as_of: '2026-07-15' },
    durationMs: 900,
  },
  {
    kind: 'tool',
    name: 'market_snapshot',
    input: { symbols: ['SPY', 'AGG'], window: '1M' },
    output: { SPY: { change_pct: 2.4 }, AGG: { change_pct: 0.6 } },
    durationMs: 1100,
  },
  {
    kind: 'answer',
    text: 'Here is where things stand as of yesterday’s close.\n\nThe fed funds rate sits at 4.25% and the 10-year Treasury yields 3.98%, so the curve remains mildly inverted at the short end. Over the past month broad equities (SPY) added about 2.4% while core bonds (AGG) gained 0.6%.\n\nFor a balanced portfolio that mix argues for staying the course: equities are doing the growth work while bonds are finally paying you to wait. If you tell me your current allocation, I can sketch what a rebalance would look like.',
  },
];

const plain: Scenario = [
  {
    kind: 'thinking',
    text: 'This is a conceptual question — no live data needed. I want to explain compounding with one concrete, memorable example and keep the math light. A single doubling illustration should land better than a formula.',
  },
  {
    kind: 'answer',
    text: 'Compound interest is interest that earns interest. Each period, returns are calculated on your original principal plus everything it has already earned, so growth accelerates rather than staying linear.\n\nA quick example: $10,000 growing at 7% a year becomes about $19,700 after 10 years — but about $76,100 after 30. The last decade alone adds more than the first two combined, which is why starting early matters more than starting big.\n\nThe practical takeaway: time in the market is the one input you can’t buy back later.',
  },
];

const toolFailure: Scenario = [
  {
    kind: 'thinking',
    text: 'They asked for live pricing, so I’ll hit the quote service first. If that fails I can fall back to the most recent cached close and be transparent about the staleness.',
  },
  {
    kind: 'tool',
    name: 'live_quote',
    input: { symbol: 'VTI' },
    outcome: 'failed',
    error: 'Upstream quote service timed out after 5000ms',
    durationMs: 1400,
  },
  {
    kind: 'thinking',
    text: 'The live feed timed out. Falling back to the cached end-of-day snapshot — still useful, just needs a caveat.',
  },
  {
    kind: 'tool',
    name: 'cached_quote',
    input: { symbol: 'VTI', max_age_hours: 24 },
    output: { symbol: 'VTI', close: 289.44, as_of: '2026-07-15T20:00:00Z' },
    durationMs: 500,
  },
  {
    kind: 'answer',
    text: 'The live quote service timed out on me, so this is the latest cached close rather than a real-time price: VTI last traded at $289.44 as of yesterday’s market close.\n\nFor deciding whether to place a market order right now you’d want a fresh quote from your brokerage, but for allocation math a day-old close is more than accurate enough.',
  },
];

const fatalError: Scenario = [
  {
    kind: 'thinking',
    text: 'Pulling together the full portfolio review — positions, cost basis, and dividend history. This needs the account data service.',
  },
  {
    kind: 'answer',
    text: 'Starting your portfolio review now. Pulling your current positions and',
  },
  {
    kind: 'error',
    message: 'Stream terminated: account data service returned 503 and the response cannot be completed.',
    code: 'UPSTREAM_UNAVAILABLE',
    recoverable: false,
  },
];

// Answer that cites a handful of references — the sources ride out on the
// summary event (see runScenario), so the client resolves [n] markers to docs.
const citations: Scenario = [
  {
    kind: 'thinking',
    text: 'The user is asking a personal-finance planning question. I should ground each claim in a specific reference so the answer is auditable, and keep the split simple.',
  },
  {
    kind: 'answer',
    text: 'Here is a straightforward way to think about it.\n\nAutomating a transfer on payday matters more than the exact amount [3], because consistency beats optimization at this stage. A practical split many people use:\n\n1. Keep one month of expenses in checking as a buffer [1].\n2. Direct new savings to a high-yield account until you reach your target — rates vary widely between providers [2].\n3. Only after that, route the overflow toward investing or extra debt payments [4].\n\nMost people land on a three-to-six-month emergency fund [1]. Tell me your monthly surplus and I can turn this into a schedule.',
    sources: financeSources,
    // Offsets index each source's own markdown. Reference 1 gets two sections
    // to show one source highlighting multiple passages.
    highlights: sourceHighlights(financeSources, [
      { referenceNumber: 1, phrase: 'the right number depends on income stability, household structure' },
      { referenceNumber: 1, phrase: 'An emergency fund is insurance, not an investment' },
      { referenceNumber: 2, phrase: 'APYs move with the federal funds rate' },
      { referenceNumber: 3, phrase: 'Money moved before it reaches the spending account' },
      { referenceNumber: 4, phrase: 'even while attacking debt' },
    ]),
  },
];

// Answer that cites a 50-document corpus, with markers scattered across the
// full range so distant navigation gets exercised.
const citationsStress: Scenario = [
  {
    kind: 'thinking',
    text: 'The user wants to see how the reference UI behaves with a large corpus. I will cite documents scattered across the full range — low, middle, and high numbers — so jumping between distant references gets exercised.',
  },
  {
    kind: 'answer',
    text: 'Here is a synthesis drawn from a **50-document corpus** — the point here is navigation, so the citations jump around on purpose.\n\nThe headline series sits near its five-year median [3], though the fee data tells a different story [17]. Rate dispersion is widest in the upper band [8], and the pattern repeats across the quarterly cuts [23]. The checklist docs [11] and [29] both flag quarter-over-quarter moves beyond their thresholds — compare them against the summary in [36].\n\nThe tail of the corpus is where the caveats live: methodology notes [42], the confidence table [47], and the final reconciliation [50].\n\nJump between [3] and [50] to feel the navigation.',
    sources: stressSources,
    highlights: sourceHighlights(stressSources, [
      { referenceNumber: 3, phrase: 'generated reference documents in the stress-test corpus' },
      { referenceNumber: 8, phrase: 'This working note supports answer marker' },
      { referenceNumber: 8, phrase: 'generated reference documents in the stress-test corpus' },
      { referenceNumber: 50, phrase: 'This working note supports answer marker' },
    ]),
  },
];

const defaults = [toolHeavy, plain];
let defaultIndex = 0;

/** Routes a prompt to a scenario. Keyword triggers beat the default cycle. */
export function pickScenario(prompt: string): Scenario {
  if (/error/i.test(prompt)) return fatalError;
  if (/fail/i.test(prompt)) return toolFailure;
  if (/\b50\b|stress|many ref|lots of ref/i.test(prompt)) return citationsStress;
  if (/cite|citation|reference|source|budget|sav(e|ing)/i.test(prompt)) return citations;
  if (/tool|search|rate|market/i.test(prompt)) return toolHeavy;
  return defaults[defaultIndex++ % defaults.length];
}
