/**
 * Fuzzy / typo-tolerant senator search (accent-insensitive, case-insensitive).
 * Scores name, nom, prenom, circonscription, and party labels.
 */

const MAX_LEVENSHTEIN = 64;

/** Strip accents, lowercase, unify punctuation for soft matching. */
export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[-_/.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(query) {
  const n = normalizeSearchText(query);
  return n ? n.split(' ').filter(Boolean) : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length > MAX_LEVENSHTEIN || b.length > MAX_LEVENSHTEIN) {
    return Math.max(a.length, b.length);
  }
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = new Uint16Array(cols);
  let curr = new Uint16Array(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

/** Best soft score of `token` against a haystack string (0 = no match). */
function scoreTokenAgainstField(token, fieldNorm) {
  if (!token || !fieldNorm) return 0;
  if (fieldNorm === token) return 120;
  if (fieldNorm.startsWith(token)) return 100;
  if (fieldNorm.includes(token)) return 85;

  const parts = fieldNorm.split(' ');
  let best = 0;
  for (const part of parts) {
    if (!part) continue;
    if (part === token) best = Math.max(best, 110);
    else if (part.startsWith(token)) best = Math.max(best, 95);
    else if (token.startsWith(part) && part.length >= 3) best = Math.max(best, 70);
    else if (part.includes(token) && token.length >= 3) best = Math.max(best, 75);
    else {
      const maxLen = Math.max(part.length, token.length);
      const maxDist = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
      if (Math.abs(part.length - token.length) > maxDist) continue;
      const dist = levenshtein(token, part);
      if (dist <= maxDist) {
        const score = Math.round(65 * (1 - dist / maxLen));
        best = Math.max(best, score);
      }
    }
  }

  /* Partial token vs whole field (e.g. "hautsdeseine" vs "hauts de seine") */
  if (best < 60 && token.length >= 4) {
    const compact = fieldNorm.replace(/\s+/g, '');
    if (compact.includes(token.replace(/\s+/g, ''))) best = Math.max(best, 80);
    else {
      const maxDist = token.length <= 7 ? 2 : 3;
      if (Math.abs(compact.length - token.length) <= maxDist + 2) {
        const dist = levenshtein(token.replace(/\s+/g, ''), compact);
        if (dist <= maxDist) best = Math.max(best, Math.round(55 * (1 - dist / Math.max(compact.length, token.length))));
      }
    }
  }

  return best;
}

function senatorSearchBlob(senator) {
  const bits = [
    senator.name,
    senator.nom,
    senator.prenom,
    senator.circonscription,
    senator.partyLabel,
    senator.party,
    senator.groupe_libelle,
    senator.groupe_code,
  ];
  return normalizeSearchText(bits.filter(Boolean).join(' '));
}

function buildIndexedSenator(senator, index) {
  const name = normalizeSearchText(senator.name);
  const nom = normalizeSearchText(senator.nom);
  const prenom = normalizeSearchText(senator.prenom);
  const circ = normalizeSearchText(senator.circonscription);
  const party = normalizeSearchText(
    [senator.partyLabel, senator.party, senator.groupe_libelle].filter(Boolean).join(' ')
  );
  const blob = senatorSearchBlob(senator);
  return { senator, index, name, nom, prenom, circ, party, blob };
}

/**
 * @param {object[]} senators
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {{ senator: object, score: number, seatHint?: string }[]}
 */
export function searchSenators(senators, query, { limit = 8 } = {}) {
  const tokens = tokenizeQuery(query);
  if (!tokens.length || !Array.isArray(senators) || !senators.length) return [];

  const indexed = senators.map(buildIndexedSenator);
  const results = [];

  for (const row of indexed) {
    let score = 0;
    let matchedAll = true;

    for (const token of tokens) {
      const fieldScores = [
        scoreTokenAgainstField(token, row.name) * 1.15,
        scoreTokenAgainstField(token, row.nom) * 1.2,
        scoreTokenAgainstField(token, row.prenom) * 1.05,
        scoreTokenAgainstField(token, row.circ) * 1.1,
        scoreTokenAgainstField(token, row.party) * 0.55,
        scoreTokenAgainstField(token, row.blob) * 0.9,
      ];
      const best = Math.max(0, ...fieldScores);
      if (best < 45) {
        matchedAll = false;
        break;
      }
      score += best;
    }

    if (!matchedAll) continue;

    /* Prefer shorter names when scores tie; boost full-query substring */
    const q = tokens.join(' ');
    if (row.name.includes(q) || row.blob.includes(q)) score += 25;
    if (row.circ.includes(q) || row.circ.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) {
      score += 20;
    }

    results.push({ senator: row.senator, score, index: row.index });
  }

  results.sort((a, b) => b.score - a.score || String(a.senator.name).localeCompare(String(b.senator.name), 'fr'));
  return results.slice(0, limit);
}
