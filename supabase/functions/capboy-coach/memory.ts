// Memory blocks of the free coach (step 5): <conversation>, <profile_memory>
// and <intervention_log>. Pure functions without database access, so the Edge
// Function and the evals in scripts/coach-evals run the same code. Every block
// is bounded in size; an empty block is left out entirely (coachInput).

type Row = Record<string, any>;

export const MEMORY_LIMITS = {
  conversationMessages: 8,      // turns of the running conversation
  messageChars: 1500,           // per turn
  profileFacts: 40,
  interventions: 12,
  closedInterventionDays: 120,  // closed ones older than this are left out
  textChars: 500,
};

const cut = (value: unknown, limit = MEMORY_LIMITS.textChars) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
};
const day = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : null);

// Turns of the running conversation, oldest first. Rows come newest first
// from the database, limited to MEMORY_LIMITS.conversationMessages.
export function conversationBlock(rows: Row[]) {
  const turns = [...rows].reverse().map((row) => ({
    role: row.role === 'assistant' ? 'coach' : 'user',
    date: day(row.created_at),
    text: cut(row.content, MEMORY_LIMITS.messageChars),
  })).filter((turn) => turn.text);
  return turns.length ? JSON.stringify(turns) : '';
}

// Facts the user entered about themselves. Only the user writes them, so
// every fact counts as confirmed by the user on its last confirmation date.
export function profileBlock(rows: Row[]) {
  const facts = rows.slice(0, MEMORY_LIMITS.profileFacts).map((row) => ({
    category: row.category,
    fact: cut(row.fact),
    source: 'user',
    confidence: 'confirmed_by_user',
    lastConfirmed: day(row.confirmed_on),
  })).filter((fact) => fact.fact);
  return facts.length ? JSON.stringify(facts) : '';
}

// Active experiments and those closed recently. reviewDue is computed here so
// the model does not compare dates itself.
export function interventionBlock(rows: Row[], today: string) {
  const oldestClosed = new Date(Date.parse(`${today}T00:00:00Z`) - MEMORY_LIMITS.closedInterventionDays * 86_400_000).toISOString().slice(0, 10);
  const items = [...rows]
    .sort((a, b) => Number(b.status === 'aktiv') - Number(a.status === 'aktiv') || String(b.start_date).localeCompare(String(a.start_date)))
    .filter((row) => row.status === 'aktiv' || (day(row.updated_at) || day(row.start_date) || '') >= oldestClosed)
    .slice(0, MEMORY_LIMITS.interventions)
    .map((row) => ({
      action: cut(row.action),
      hypothesis: row.hypothesis ? cut(row.hypothesis) : null,
      targetMetric: row.target_metric ? cut(row.target_metric, 300) : null,
      startDate: day(row.start_date),
      reviewDate: day(row.review_date),
      reviewDue: row.status === 'aktiv' && Boolean(row.review_date) && day(row.review_date)! <= today,
      status: row.status === 'aktiv' ? 'active' : row.status === 'abgeschlossen' ? 'completed' : 'stopped',
      adherence: row.adherence || 'unbekannt',
      outcome: row.outcome ? cut(row.outcome) : null,
      source: row.source === 'coach_empfehlung' ? 'coach_recommendation' : 'user',
    }));
  return items.length ? JSON.stringify(items) : '';
}

// What is stored of a coach answer as the coach's turn: the core of the
// answer, not the whole JSON. Numbers stay exactly as the coach wrote them.
export function assistantMemoryText(result: Row) {
  const parts = [
    result?.summary ? String(result.summary) : '',
    ...(result?.recommendations || []).map((item: Row, index: number) => `Empfehlung ${index + 1}: ${item.action}${item.timeframe ? ` (${item.timeframe})` : ''}`),
  ].filter(Boolean);
  return cut(parts.join(' '), MEMORY_LIMITS.messageChars);
}

export const isUuid = (value: unknown) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
