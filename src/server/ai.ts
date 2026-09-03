/**
 * Optional AI assistance (§38).
 *
 * Hard rules encoded below:
 *  - AI never invents facts. Every prompt ships the exact structured data the
 *    user entered and instructs the model to use nothing else.
 *  - The user always edits the result; nothing is written to the database
 *    without them pressing save.
 *  - With no OPENAI_API_KEY set, every entry point fails loudly and the UI
 *    hides the buttons — the CRM is fully usable without AI.
 */

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI assistance is not configured. Add OPENAI_API_KEY to enable it.');
  }
}

export function aiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

type ChatMessage = { role: 'system' | 'user'; content: string };

async function chat(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiNotConfiguredError();

  const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI service returned ${res.status}. ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('The AI service returned an empty response.');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

const GROUND_RULES = [
  'You help a Rotaract club write event report descriptions.',
  'Use ONLY the facts given to you. Never invent numbers, names, organisations, outcomes or dates.',
  'If a detail is missing, simply leave it out — do not guess or use placeholders.',
  'Write in clear, warm, professional English. No emoji, no marketing hype, no headings.',
].join(' ');

export type EventFacts = {
  eventName: string;
  avenue?: string;
  eventDate?: string;
  venue?: string;
  chair?: string;
  projectWith?: string;
  participants?: Record<string, number>;
  beneficiaries?: string[];
  directBeneficiaries?: number;
  indirectBeneficiaries?: number;
  cost?: number;
  currency?: string;
  objective?: string;
  accomplished?: string;
  impact?: string;
  projectName?: string;
  phaseNumber?: number;
};

function factsBlock(facts: EventFacts) {
  return JSON.stringify(facts, null, 2);
}

export async function improveDescription(rawText: string, facts: EventFacts): Promise<string> {
  if (!rawText.trim()) throw new Error('Write a sentence or two first — the assistant only polishes your own words.');
  return chat([
    { role: 'system', content: GROUND_RULES },
    {
      role: 'user',
      content: [
        'Rewrite the board member\'s notes into a polished event description of 90–160 words.',
        'Keep every fact they wrote. You may reference the structured event data below, but add nothing beyond it.',
        '',
        'BOARD MEMBER NOTES:',
        rawText,
        '',
        'STRUCTURED EVENT DATA:',
        factsBlock(facts),
      ].join('\n'),
    },
  ]);
}

export async function summariseEvent(facts: EventFacts, description: string): Promise<string> {
  return chat(
    [
      { role: 'system', content: GROUND_RULES },
      {
        role: 'user',
        content: `Write a single sentence (max 30 words) summarising this event for a monthly report index.\n\nDESCRIPTION:\n${description}\n\nDATA:\n${factsBlock(facts)}`,
      },
    ],
    120,
  );
}

export async function suggestBeneficiaries(description: string, allowed: string[]): Promise<string[]> {
  const text = await chat(
    [
      { role: 'system', content: GROUND_RULES },
      {
        role: 'user',
        content: [
          'From the allowed list, return the beneficiary categories that the description explicitly supports.',
          'Answer with a JSON array of strings and nothing else. Return [] if the description does not say.',
          `ALLOWED: ${allowed.join(', ')}`,
          `DESCRIPTION: ${description}`,
        ].join('\n'),
      },
    ],
    200,
  );
  try {
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    return Array.isArray(parsed) ? parsed.filter((v) => allowed.includes(v)) : [];
  } catch {
    return [];
  }
}

export async function detectMissingInformation(facts: EventFacts, description: string): Promise<string[]> {
  const text = await chat(
    [
      { role: 'system', content: GROUND_RULES },
      {
        role: 'user',
        content: [
          'Look at this event report and list up to 4 short, specific questions whose answers would make the report more complete.',
          'Base each question on what is actually absent from the data. Return a JSON array of strings only.',
          `DATA:\n${factsBlock(facts)}`,
          `DESCRIPTION:\n${description || '(empty)'}`,
        ].join('\n'),
      },
    ],
    300,
  );
  try {
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    return Array.isArray(parsed) ? parsed.slice(0, 4).map(String) : [];
  } catch {
    return [];
  }
}

export async function summarisePeriod(params: {
  label: string;
  totals: { events: number; participants: number; beneficiaries: number; cost: number; currency: string };
  events: Array<{ name: string; avenue: string; date: string; description?: string | null }>;
}): Promise<string> {
  return chat(
    [
      { role: 'system', content: GROUND_RULES },
      {
        role: 'user',
        content: [
          `Write a 120–180 word narrative summary for the club's ${params.label} report.`,
          'Use only the events and totals below. Do not invent impact claims.',
          `TOTALS: ${JSON.stringify(params.totals)}`,
          `EVENTS: ${JSON.stringify(params.events.slice(0, 40))}`,
        ].join('\n'),
      },
    ],
    500,
  );
}
