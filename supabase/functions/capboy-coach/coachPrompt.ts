// Shared by the capboy-coach Edge Function and scripts/coach-evals. Keeping the
// prompt, schema and request shape in one place guarantees that the evals test
// exactly what the app sends. No npm: or remote imports here, so Node can load
// this file directly for the evals.

type Row = Record<string, any>;
export type Scope = 'coach' | 'sleep' | 'comp' | 'skinfold' | 'overall';

export const COACH_MODEL = 'gpt-6-sol';

export const SHARED_SAFETY = `Die App hat alle objektiven Werte bereits deterministisch berechnet. Rechne keine Trends, Summen, Ränge, Verhältnisse oder Korrelationen selbst neu aus und widersprich diesen Ergebnissen nicht. Nutze file_search ausschließlich, um die berechneten Ergebnisse verständlich einzuordnen und relevante Seminarpassagen zu finden. Seminarzusammenhänge sind Hypothesen und keine Diagnosen. Behaupte nie Kausalität, wenn nur ein Zusammenhang sichtbar ist. Stelle keine medizinischen Diagnosen. Leite aus Hautfalten keine Hormone, Organe, Krankheiten oder Nährstoffmängel als Tatsache ab. Erfinde keine Supplement-Dosis, keinen Grenzwert und keine Wechselwirkung. Ziele oder Pläne dürfen nur vorgeschlagen und nie automatisch verändert werden.`;

export const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'string', enum: ['niedrig', 'mittel', 'hoch'] },
    facts: { type: 'array', items: { type: 'string' } },
    interpretations: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          action: { type: 'string' }, rationale: { type: 'string' }, timeframe: { type: 'string' },
        },
        required: ['action', 'rationale', 'timeframe'],
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' } },
    followUpQuestions: { type: 'array', items: { type: 'string' } },
    safetyNote: { type: 'string' },
  },
  required: ['title', 'summary', 'confidence', 'facts', 'interpretations', 'recommendations', 'uncertainties', 'followUpQuestions', 'safetyNote'],
};

export const scopeInstruction: Record<Scope, string> = {
  coach: 'Beantworte die konkrete Frage, betrachte aber immer das Gesamtbild aus Körperkomposition, Training, Ernährung, Schlaf, Erholung und Routinen.',
  overall: 'Erstelle eine bereichsübergreifende Gesamtanalyse und priorisiere höchstens drei nächste Schritte.',
  sleep: 'Fokussiere Schlaf, beziehe Training, Ernährung, Erholung und Routinen aber ein, wenn die Daten einen Zusammenhang stützen.',
  comp: 'Interpretiere die Körperkomposition aus mehreren Signalen. Gewicht allein ist nie ein Beweis für Muskel- oder Fettveränderung.',
  skinfold: 'Priorisiere risikoarme nächste Schritte. Hautfalten erlauben keine Diagnose von Hormonen, Organen, Mängeln oder Krankheiten.',
};

export function coachSystemPrompt(scope: Scope, webResearch: boolean) {
  return `Du bist der persönliche CAPBOY Coach für Training, Ernährung, Schlaf, Muskelaufbau, Körperkomposition und gesundheitsorientierte Gewohnheiten. ${SHARED_SAFETY}

Jede Anfrage ist eigenständig; behaupte nicht, dich an frühere Gespräche zu erinnern. Trenne klar zwischen gemessenen Fakten, plausiblen Interpretationen und Unsicherheiten. Einzelwerte nie überbewerten. Gib höchstens drei konkrete, überprüfbare Empfehlungen und nenne einen realistischen Zeitraum. Bei möglichen medizinischen Warnzeichen empfehle professionelle Abklärung. ${webResearch ? 'Der Nutzer hat ausdrücklich aktuelle Webrecherche aktiviert. Führe mindestens eine Websuche durch. Bevorzuge Primärquellen, systematische Übersichten, Fachgesellschaften und öffentliche Gesundheitsbehörden. Trenne externe Erkenntnisse sichtbar von den persönlichen CAPBOY-Daten und den Seminarunterlagen.' : 'Es ist keine Webrecherche erlaubt. Nutze nur den CAPBOY-Datensnapshot, die Seminar-Wissensbasis und dein allgemeines Modellwissen.'} Antworte auf Deutsch, knapp und konkret. ${scopeInstruction[scope]}`;
}

export function coachUserPrompt(question: string, snapshot: unknown) {
  return `${question || 'Erstelle jetzt die angeforderte Analyse.'}\n\nAktueller strukturierter CAPBOY-Datensnapshot:\n${JSON.stringify(snapshot)}`;
}

// Request body of the free coach and of the non-central scopes. The central
// COMP assessment builds its own body in index.ts.
export function coachRequestBody({ scope, question, snapshot, webResearch, vectorStoreId }: {
  scope: Scope; question: string; snapshot: unknown; webResearch: boolean; vectorStoreId: string | null;
}) {
  const tools: Row[] = vectorStoreId
    ? [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: 6 }]
    : [];
  const include = vectorStoreId ? ['file_search_call.results'] : [];
  if (webResearch) {
    tools.push({ type: 'web_search', search_context_size: 'medium' });
    include.push('web_search_call.action.sources');
  }
  return {
    model: COACH_MODEL,
    instructions: coachSystemPrompt(scope, webResearch),
    input: [{ role: 'user', content: coachUserPrompt(question, snapshot) }],
    reasoning: { effort: scope === 'coach' ? 'medium' : 'high' },
    max_output_tokens: 4000,
    tools,
    tool_choice: webResearch ? 'required' : 'auto',
    include,
    text: {
      format: {
        type: 'json_schema',
        name: 'capboy_coach_result',
        strict: true,
        schema: resultSchema,
      },
    },
  };
}

export function outputText(response: Row) {
  const parts: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('');
}
