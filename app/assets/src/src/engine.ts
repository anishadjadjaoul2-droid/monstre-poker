export type Decision = { action: string; note?: string };

export type HandState = {
  players: number;                  // nb joueurs dans le coup
  stackBB: number;                  // ton stack en BB
  bbSize: number;                   // taille BB en jetons
  cards: string;                    // ex: "Ah7s"
  street?: 'preflop' | 'flop' | 'turn' | 'river';
  board?: string;                   // ex: "6d7h9h"
};

// 🚧 Placeholder : on branchera Monstre v3.1 ici
export function computeDecision(s: HandState): Decision {
  const cards = s.cards.replace(/\s+/g, '').toUpperCase();

  // --- PRE-FLOP DEMO ---
  if (s.street === 'preflop' || !s.street) {
    const isPair = cards.length >= 2 && cards[0] === cards[1];

    if (/(AA|KK|QQ|JJ|TT)/.test(cards)) {
      return { action: 'Raise 2.5bb', note: 'Premium' };
    }
    if (/AK|AQ|AJ|KQ/.test(cards)) {
      return { action: 'Raise 2.2bb' };
    }
    if (isPair && /(99|88|77|66)/.test(cards)) {
      return {
        action: s.stackBB <= 15 ? `Jam ${Math.max(10, Math.min(30, Math.round(s.stackBB)))}bb` : 'Raise 2bb',
        note: 'Pocket'
      };
    }
    return { action: 'Fold' };
  }

  // --- POST-FLOP DEMO ---
  return { action: 'C-bet 33%', note: 'Démo placeholder' };
}

