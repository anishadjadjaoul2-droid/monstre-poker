// app/src/logic/computeWin.ts
// Monte-Carlo + évaluateur 7 cartes (Texas Hold'em)

import type { PlayingCard } from '../components/CardPicker';

export type Stage = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

export type ComputeResult = {
  status: 'ok' | 'incomplete';
  winPct: number;      // % de victoire (incluant le partage pondéré)
  tiePct: number;      // % de splits (informationnel)
  samples: number;     // nombre de simulations
  detail?: string;     // debug
};

/* ------------------------------------------------------------------ */
/* -------------------------- API PUBLIQUE --------------------------- */
/* ------------------------------------------------------------------ */

export async function computeWin(
  hero: [PlayingCard | null, PlayingCard | null],
  board5: (PlayingCard | null)[],
  opponents: number,
  stage: Stage
): Promise<ComputeResult> {
  if (!hero[0] || !hero[1]) {
    return { status: 'incomplete', winPct: 0, tiePct: 0, samples: 0, detail: 'hero incomplete' };
  }

  const need = stage === 'PREFLOP' ? 0 : stage === 'FLOP' ? 3 : stage === 'TURN' ? 4 : 5;
  if (board5.filter(Boolean).length < need) {
    return { status: 'incomplete', winPct: 0, tiePct: 0, samples: 0, detail: `board incomplete for ${stage}` };
  }

  // paramètres Monte-Carlo (réglages safe pour mobiles)
  const SAMPLES: Record<Stage, number> = {
    PREFLOP: 15000,
    FLOP:    25000,
    TURN:    35000,
    RIVER:   50000, // au river, seules les cartes adverses sont inconnues
  };

  const samples = SAMPLES[stage];

  const known: Card[] = [];
  known.push(toCard(hero[0]!)); known.push(toCard(hero[1]!));
  for (const b of board5) if (b) known.push(toCard(b));

  const baseDeck = fullDeckMinus(known);

  let expectedWins = 0; // somme des poids: 1 si meilleur, 1/(nTied+1) si ex æquo, 0 sinon
  let tieCount = 0;

  for (let i = 0; i < samples; i++) {
    // 1) Prépare un deck mutable
    const deck = _scratchCopy(baseDeck);

    // 2) Complète le board selon la street
    const board: Card[] = [];
    for (const b of board5) if (b) board.push(toCard(b));
    const missing = 5 - board.length;
    for (let k = 0; k < missing; k++) board.push(draw(deck));

    // 3) Distribue les adversaires (2 cartes chacun)
    const oppHands: [Card, Card][] = [];
    for (let j = 0; j < opponents; j++) {
      oppHands.push([draw(deck), draw(deck)]);
    }

    // 4) Évalue les jeux
    const heroScore = eval7([toCard(hero[0]!), toCard(hero[1]!), ...board]);
    let maxOppScore = -Infinity;
    const oppScores: number[] = [];
    for (let j = 0; j < opponents; j++) {
      const s = eval7([oppHands[j][0], oppHands[j][1], ...board]);
      oppScores.push(s);
      if (s > maxOppScore) maxOppScore = s;
    }

    if (opponents === 0) {
      expectedWins += 1; // heads-up inexistant => toujours "meilleur"
    } else {
      if (heroScore > maxOppScore) {
        expectedWins += 1;
      } else if (heroScore === maxOppScore) {
        // Nombre d’adversaires ex æquo
        let equal = 0;
        for (let s of oppScores) if (s === maxOppScore) equal++;
        expectedWins += 1 / (equal + 1);
        tieCount++;
      }
    }
  }

  return {
    status: 'ok',
    winPct: (expectedWins / samples) * 100,
    tiePct: (tieCount / samples) * 100,
    samples,
  };
}

/* ------------------------------------------------------------------ */
/* --------------------------- ÉVALUATEUR ---------------------------- */
/* ------------------------------------------------------------------ */

/** Représentation compacte d’une carte */
type Suit = 0 | 1 | 2 | 3; // c, d, h, s
type RankIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; // 2..A
type Card = { r: RankIdx; s: Suit };

const RANK_TO_IDX: Record<PlayingCard['rank'], RankIdx> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
};
const SUIT_TO_ID: Record<PlayingCard['suit'], Suit> = { c: 0, d: 1, h: 2, s: 3 };

function toCard(c: PlayingCard): Card {
  return { r: RANK_TO_IDX[c.rank], s: SUIT_TO_ID[c.suit] };
}

function fullDeck(): Card[] {
  const d: Card[] = [];
  for (let s: Suit = 0 as Suit; s < 4; s = (s + 1) as Suit)
    for (let r: RankIdx = 0 as RankIdx; r < 13; r = (r + 1) as RankIdx)
      d.push({ r, s });
  return d;
}
function fullDeckMinus(remove: Card[]): Card[] {
  const deck = fullDeck();
  for (const rem of remove) {
    const i = deck.findIndex(c => c.r === rem.r && c.s === rem.s);
    if (i >= 0) deck.splice(i, 1);
  }
  return deck;
}
function draw(deck: Card[]): Card {
  const i = (Math.random() * deck.length) | 0;
  const c = deck[i];
  deck[i] = deck[deck.length - 1];
  deck.pop();
  return c;
}
function _scratchCopy(src: Card[]) {
  // copie rapide
  const out = new Array<Card>(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i];
  return out;
}

/**
 * Évalue 7 cartes. Retourne un score "comparable" (nombre).
 * Plus grand => meilleur. Encodage lexicographique:
 *   cat * 1e10 + a * 1e8 + b * 1e6 + c * 1e4 + d * 1e2 + e
 * cat: 8 SF, 7 4K, 6 FH, 5 Flush, 4 Straight, 3 Trips, 2 TwoPair, 1 Pair, 0 High
 */
function eval7(cards: Card[]): number {
  // Comptes par rang et par couleur
  const cntR = new Array<number>(13).fill(0);
  const cntS = new Array<number>(4).fill(0);
  const suitRanks: number[][] = [[], [], [], []];

  for (const c of cards) {
    cntR[c.r]++;
    cntS[c.s]++;
    suitRanks[c.s].push(c.r);
  }

  // Flush ? + Straight Flush
  let flushSuit: Suit | -1 = -1;
  for (let s = 0; s < 4; s++) if (cntS[s] >= 5) { flushSuit = s as Suit; break; }

  const maskAll = rankMaskFromCounts(cntR);
  if (flushSuit !== -1) {
    const maskFlush = rankMaskFromList(suitRanks[flushSuit]);
    const hiSF = highestStraight(maskFlush);
    if (hiSF >= 0) return packScore(8, [hiSF]); // straight flush
  }

  // 4 of a kind / full house / trips / pairs…
  let four = -1, trips: number[] = [], pairs: number[] = [], singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const c = cntR[r];
    if (c === 4) four = r;
    else if (c === 3) trips.push(r);
    else if (c === 2) pairs.push(r);
    else if (c === 1) singles.push(r);
  }

  if (four !== -1) {
    const kicker = (singles[0] ?? pairs[0] ?? trips[0] ?? 0);
    return packScore(7, [four, kicker]);
  }

  if (trips.length >= 2 || (trips.length >= 1 && pairs.length >= 1)) {
    const topTrip = trips[0];
    const topPair = trips.length >= 2 ? trips[1] : pairs[0];
    return packScore(6, [topTrip, topPair]); // full house
  }

  if (flushSuit !== -1) {
    const ranks = suitRanks[flushSuit].sort((a, b) => b - a);
    const top5 = uniqueTop(ranks, 5);
    return packScore(5, top5);
  }

  const hiStraight = highestStraight(maskAll);
  if (hiStraight >= 0) return packScore(4, [hiStraight]);

  if (trips.length >= 1) {
    const kickers = uniqueTop(singles, 2);
    return packScore(3, [trips[0], ...kickers]);
  }

  if (pairs.length >= 2) {
    const kicker = singles[0] ?? 0;
    return packScore(2, [pairs[0], pairs[1], kicker]);
  }

  if (pairs.length === 1) {
    const kickers = uniqueTop(singles, 3);
    return packScore(1, [pairs[0], ...kickers]);
  }

  const hc = uniqueTop(singles, 5);
  return packScore(0, hc);
}

/* ---------------------------- Helpers rangs ---------------------------- */

function rankMaskFromCounts(cntR: number[]): number {
  let m = 0;
  for (let r = 0; r < 13; r++) if (cntR[r] > 0) m |= (1 << r);
  return m;
}
function rankMaskFromList(list: number[]): number {
  let m = 0;
  for (let r of list) m |= (1 << r);
  return m;
}
function highestStraight(mask: number): number {
  // traite aussi la roue A-2-3-4-5 (A bas)
  // recherche du plus haut rang (r) tel que r..r-4 présents
  for (let hi = 12; hi >= 4; hi--) {
    const seq = 0b11111 << (hi - 4);
    if ((mask & seq) === seq) return hi; // valeur hi (ex: 12 = A-haut)
  }
  // roue: A + 2..5
  const wheel = (1 << 12) | 0b1111; // A + 2,3,4,5
  if ((mask & wheel) === wheel) return 3; // 5-haut
  return -1;
}
function uniqueTop(arr: number[], n: number): number[] {
  const seen: boolean[] = new Array(13).fill(false);
  const out: number[] = [];
  for (let v of arr) {
    if (!seen[v]) { out.push(v); seen[v] = true; if (out.length === n) break; }
  }
  while (out.length < n) out.push(0);
  return out;
}
function packScore(cat: number, ranks: number[]): number {
  // Encodage lexicographique sur base 100
  // cat max 8, rangs max 12 -> large
  let score = cat * 1e10;
  const muls = [1e8, 1e6, 1e4, 1e2, 1];
  for (let i = 0; i < Math.min(ranks.length, 5); i++) {
    score += ranks[i] * muls[i];
  }
  return score;
}
