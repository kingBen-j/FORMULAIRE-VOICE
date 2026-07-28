/* ============================================================
   VOICE OF GOD — Analyse IA des motifs (Claude Opus 4.8)
   Utilise l'IA Claude si ANTHROPIC_API_KEY est defini,
   sinon repli automatique sur l'analyse par regles (analyze.js).
   ============================================================ */
'use strict';

const rules = require('./analyze');

const MODEL = process.env.ANALYSE_MODEL || 'claude-opus-4-8';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement
  }
  return client;
}

const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEME = `Tu es l'assistant du groupe d'adoration Voice of God (VOG).
Ta mission : evaluer, avec justice et bienveillance, si le motif d'absence ou de retard d'un membre est legitime.

Contexte et valeurs de VOG :
- Amour de Christ
- Performance de qualite
- Vie d'intimite avec le Seigneur
Les membres s'engagent a la fidelite, a l'humilite et a la sanctification. La ponctualite et la presence aux repetitions sont importantes, mais VOG reste un lieu de grace : on evalue avec justesse, sans durete inutile.

Regles de jugement :
- Motifs serieux (maladie, hospitalisation, deuil/deces d'un proche, urgence familiale, examen ou cours obligatoire, obligation professionnelle) : generalement legitimes.
- Un justificatif fourni renforce fortement la credibilite. L'avoir prevenu a l'avance est un bon signe de serieux.
- Motifs de simple convenance (oubli, flemme, "pas envie", grasse matinee, sortie/loisir) : ne justifient pas une absence.
- Un retard est juge avec plus d'indulgence qu'une absence complete, surtout s'il est court.
- En cas de doute (motif plausible mais non prouve, explication vague) : "a_verifier".

Reponds UNIQUEMENT via le format JSON demande, en francais, en tutoyant le membre avec respect.
- "verdict" : "valable" | "a_verifier" | "non_valable".
- "score" : entier de 0 a 100 (credibilite du motif).
- "categorie" : le type de motif identifie (ex "Maladie", "Deuil", "Transport") ou "" si indetermine.
- "explication" : 1 a 2 phrases adressees au membre, honnetes mais bienveillantes.
- "facteurs" : liste courte de points, chacun avec "signe" ("+" favorable, "-" defavorable) et "txt" (bref).`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['valable', 'a_verifier', 'non_valable'] },
    score: { type: 'integer' },
    categorie: { type: 'string' },
    explication: { type: 'string' },
    facteurs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          signe: { type: 'string', enum: ['+', '-'] },
          txt: { type: 'string' },
        },
        required: ['signe', 'txt'],
      },
    },
  },
  required: ['verdict', 'score', 'categorie', 'explication', 'facteurs'],
};

async function analyse(input) {
  // La presence n'a pas besoin d'analyse.
  if (input.statut === 'present') {
    return { ...rules.analyse(input), moteur: 'regles' };
  }

  const c = getClient();
  if (!c) {
    return { ...rules.analyse(input), moteur: 'regles' };
  }

  try {
    const contenu =
      `Declaration a analyser :\n` +
      `- Type : ${input.statut === 'retard' ? 'Retard' : 'Absence'}\n` +
      `- Motif choisi : ${input.motif_categorie || '(non precise)'}\n` +
      `- Details donnes par le membre : ${input.details || '(aucun)'}\n` +
      `- Justificatif transfere : ${input.hasJustificatif ? 'oui' : 'non'}\n` +
      `- Responsable prevenu a l'avance : ${input.prevenu ? 'oui' : 'non'}\n` +
      (input.statut === 'retard' ? `- Retard estime : ${input.retard_minutes || '?'} minutes\n` : '');

    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEME,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: contenu }],
    });

    if (resp.stop_reason === 'refusal') throw new Error('refus IA');
    const bloc = resp.content.find((b) => b.type === 'text');
    const out = JSON.parse(bloc ? bloc.text : '{}');

    if (!['valable', 'a_verifier', 'non_valable'].includes(out.verdict)) {
      throw new Error('verdict invalide');
    }
    return {
      verdict: out.verdict,
      score: typeof out.score === 'number' ? Math.max(0, Math.min(100, Math.round(out.score))) : 50,
      categorie: out.categorie || null,
      explication: out.explication || '',
      facteurs: Array.isArray(out.facteurs) ? out.facteurs : [],
      moteur: 'ia',
    };
  } catch (err) {
    console.error('[analyse-ai] repli sur les regles :', err.message);
    return { ...rules.analyse(input), moteur: 'regles' };
  }
}

module.exports = { analyse, aiEnabled, VERDICT_LABEL: rules.VERDICT_LABEL, MODEL };
