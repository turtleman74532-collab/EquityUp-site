// ---- Card representation ----
// Cards are strings like "As", "Td", "9h", "2c"
// Rank order: 2 3 4 5 6 7 8 9 T J Q K A
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["s","h","d","c"];

function buildDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

function rankValue(card) {
  return RANKS.indexOf(card[0]) + 2; // 2..14
}
function suitOf(card) {
  return card[1];
}

// ---- Hand evaluator ----
// Given 5-7 cards, returns a comparable score for the BEST 5-card hand.
// Higher score = better hand. Encodes category + kickers into one number.
function evaluateBest(cards) {
  // Try all 5-card combinations from the given cards (5,6, or 7 cards)
  const combos = kCombinations(cards, 5);
  let best = -1;
  for (const combo of combos) {
    const score = scoreFiveCardHand(combo);
    if (score > best) best = score;
  }
  return best;
}

function kCombinations(arr, k) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

// Category numbers (higher = better): 
// 0 High Card, 1 Pair, 2 Two Pair, 3 Trips, 4 Straight,
// 5 Flush, 6 Full House, 7 Quads, 8 Straight Flush
function scoreFiveCardHand(cards) {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);

  const isFlush = suits.every((s) => s === suits[0]);

  // Count rank occurrences
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const countEntries = Object.entries(counts)
    .map(([r, c]) => [parseInt(r), c])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // Straight check (handles wheel A-2-3-4-5)
  const uniqueRanksDesc = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanksDesc.length >= 5) {
    for (let i = 0; i <= uniqueRanksDesc.length - 5; i++) {
      const window = uniqueRanksDesc.slice(i, i + 5);
      if (window[0] - window[4] === 4) {
        straightHigh = window[0];
        break;
      }
    }
  }
  // Wheel: A,5,4,3,2
  if (
    !straightHigh &&
    uniqueRanksDesc.includes(14) &&
    uniqueRanksDesc.includes(5) &&
    uniqueRanksDesc.includes(4) &&
    uniqueRanksDesc.includes(3) &&
    uniqueRanksDesc.includes(2)
  ) {
    straightHigh = 5; // 5-high straight
  }

  const isStraight = straightHigh !== null;

  const kickerScore = (vals) =>
    vals.reduce((acc, v) => acc * 15 + v, 0);

  if (isStraight && isFlush) {
    return encode(8, [straightHigh]);
  }
  if (countEntries[0][1] === 4) {
    const quad = countEntries[0][0];
    const kicker = countEntries.find(([, c]) => c === 1)?.[0] ??
      ranks.filter((r) => r !== quad)[0];
    return encode(7, [quad, kicker]);
  }
  if (countEntries[0][1] === 3 && countEntries[1] && countEntries[1][1] >= 2) {
    return encode(6, [countEntries[0][0], countEntries[1][0]]);
  }
  if (isFlush) {
    return encode(5, uniqueRanksDesc.slice(0, 5));
  }
  if (isStraight) {
    return encode(4, [straightHigh]);
  }
  if (countEntries[0][1] === 3) {
    const trips = countEntries[0][0];
    const kickers = ranks.filter((r) => r !== trips).slice(0, 2);
    return encode(3, [trips, ...kickers]);
  }
  if (countEntries[0][1] === 2 && countEntries[1] && countEntries[1][1] === 2) {
    const pairs = [countEntries[0][0], countEntries[1][0]].sort((a, b) => b - a);
    const kicker = ranks.find((r) => r !== pairs[0] && r !== pairs[1]);
    return encode(2, [...pairs, kicker]);
  }
  if (countEntries[0][1] === 2) {
    const pair = countEntries[0][0];
    const kickers = ranks.filter((r) => r !== pair).slice(0, 3);
    return encode(1, [pair, ...kickers]);
  }
  return encode(0, uniqueRanksDesc.slice(0, 5));
}

function encode(category, tiebreakers) {
  // Category must always outweigh any combination of kickers.
  // Kickers are folded into a base-15 number (max ~15^5), so multiplying
  // category by a number bigger than that guarantees category dominates.
  let kickerPart = 0;
  for (const t of tiebreakers) {
    kickerPart = kickerPart * 15 + t;
  }
  return category * 1000000 + kickerPart;
}

const HAND_NAMES = [
  "High Card", "Pair", "Two Pair", "Three of a Kind", "Straight",
  "Flush", "Full House", "Four of a Kind", "Straight Flush"
];

function handCategoryName(cards) {
  const combos = kCombinations(cards, Math.min(5, cards.length));
  // find category of the best combo
  let bestCat = 0;
  let bestScore = -1;
  for (const combo of kCombinations(cards, 5)) {
    // recompute category alone (re-derive from scoreFiveCardHand logic quickly)
    const score = scoreFiveCardHand(combo);
    if (score > bestScore) {
      bestScore = score;
      // Decode category by re-running category-only logic
      bestCat = categoryOf(combo);
    }
  }
  return HAND_NAMES[bestCat];
}

function categoryOf(cards) {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const countEntries = Object.entries(counts)
    .map(([r, c]) => [parseInt(r), c])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniqueRanksDesc = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueRanksDesc.length >= 5) {
    for (let i = 0; i <= uniqueRanksDesc.length - 5; i++) {
      const window = uniqueRanksDesc.slice(i, i + 5);
      if (window[0] - window[4] === 4) { straightHigh = window[0]; break; }
    }
  }
  if (!straightHigh && [14,5,4,3,2].every(v => uniqueRanksDesc.includes(v))) straightHigh = 5;
  const isStraight = straightHigh !== null;

  if (isStraight && isFlush) return 8;
  if (countEntries[0][1] === 4) return 7;
  if (countEntries[0][1] === 3 && countEntries[1] && countEntries[1][1] >= 2) return 6;
  if (isFlush) return 5;
  if (isStraight) return 4;
  if (countEntries[0][1] === 3) return 3;
  if (countEntries[0][1] === 2 && countEntries[1] && countEntries[1][1] === 2) return 2;
  if (countEntries[0][1] === 2) return 1;
  return 0;
}

// ---- Monte Carlo equity simulation ----
// heroCards: 2 cards, boardCards: 0/3/4/5 cards, numOpponents: 1-8
function simulateEquity(heroCards, boardCards, numOpponents, iterations = 5000) {
  const known = new Set([...heroCards, ...boardCards]);
  const fullDeck = buildDeck().filter((c) => !known.has(c));

  let wins = 0;
  let ties = 0;

  for (let i = 0; i < iterations; i++) {
    const deck = shuffle(fullDeck.slice());
    let idx = 0;

    const board = boardCards.slice();
    while (board.length < 5) {
      board.push(deck[idx++]);
    }

    const oppHands = [];
    for (let o = 0; o < numOpponents; o++) {
      oppHands.push([deck[idx++], deck[idx++]]);
    }

    const heroScore = evaluateBest([...heroCards, ...board]);
    const oppScores = oppHands.map((h) => evaluateBest([...h, ...board]));
    const maxOppScore = Math.max(...oppScores);

    if (heroScore > maxOppScore) {
      wins++;
    } else if (heroScore === maxOppScore) {
      ties++;
    }
  }

  const winPct = ((wins + ties / 2) / iterations) * 100;
  return winPct;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Preflop ranges, taken directly from the 6-max opening range sheet ----
// (Seat 1 = first to act ... Seat 4 = Button). Each function returns true if
// the given hand is inside that seat's raise range, per the sheet's own rules.
// This does NOT come from equity math -- it's the exact chart already studied,
// so preflop advice here matches that sheet instead of a separately-invented number.
function handShape(card1, card2) {
  const r1 = rankValue(card1);
  const r2 = rankValue(card2);
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = suitOf(card1) === suitOf(card2);
  const pair = r1 === r2;
  return { hi, lo, suited, pair };
}

function inSeat1Range({ hi, lo, suited, pair }) {
  if (pair && hi >= 6) return true; // 66+
  if (suited && hi === 14 && lo >= 10) return true; // ATs-AKs
  if (!suited && hi === 14 && lo >= 12) return true; // AQo, AKo
  if (hi === 13 && lo === 12) return true; // KQ suited or offsuit
  if (suited && hi === 13 && lo === 11) return true; // KJs
  if (suited && hi === 12 && lo === 11) return true; // QJs
  return false;
}

function inSeat2Range(shape) {
  if (inSeat1Range(shape)) return true;
  const { hi, lo, suited, pair } = shape;
  if (pair && hi >= 2) return true; // 22+
  if (suited && hi === 14 && lo >= 9) return true; // A9s+
  if (!suited && hi === 14 && lo >= 10) return true; // ATo+
  if (suited && hi === 13 && lo >= 10) return true; // KTs+
  if (suited && hi === 12 && lo >= 10) return true; // QTs+
  if (suited && hi === 11 && lo === 10) return true; // JTs
  return false;
}

function inSeat3Range(shape) {
  if (inSeat2Range(shape)) return true;
  const { hi, lo, suited } = shape;
  if (suited && hi === 14 && lo >= 2) return true; // any suited ace
  if (!suited && hi === 14 && lo >= 7) return true; // A7o+
  if (suited && hi === 13 && lo >= 9) return true; // K9s+
  if (!suited && hi === 13 && lo >= 10) return true; // KTo+
  if (suited && hi === 12 && lo >= 9) return true; // Q9s+
  if (!suited && hi === 12 && lo === 10) return true; // QTo
  if (suited && hi === 11 && lo === 9) return true; // J9s
  if (!suited && hi === 11 && lo === 10) return true; // JTo
  if (suited && hi - lo === 1 && lo >= 5 && hi <= 10) return true; // 65s-T9s connectors
  return false;
}

function inSeat4Range(shape) {
  if (inSeat3Range(shape)) return true;
  const { hi, lo, suited } = shape;
  if (suited && hi >= 6 && lo >= 6) return true; // any suited hand, both cards 6+
  if (hi >= 10 && lo >= 10) return true; // any two broadway cards, suited or offsuit
  if (suited && hi - lo === 2 && lo >= 4 && hi <= 8) return true; // suited one-gappers
  if (!suited && (hi === 13 || hi === 12) && lo >= 9) return true; // K/Q offsuit + 9 or higher
  return false;
}

const SEAT_RANGE_CHECKERS = {
  seat1: inSeat1Range,
  seat2: inSeat2Range,
  seat3: inSeat3Range,
  seat4: inSeat4Range,
};

// Returns "Raise" or "Fold" straight from the sheet's chart, or null if this
// position isn't covered by that chart (small blind / big blind / no position picked).
function chartBasedPreflopMove(heroCards, position) {
  const checker = SEAT_RANGE_CHECKERS[position];
  if (!checker) return null;
  const shape = handShape(heroCards[0], heroCards[1]);
  return checker(shape) ? "Raise" : "Fold";
}

// ---- Generalized table-size + seat system ----
// The exact Seat 1-4 chart above is for 6-max specifically. This section
// generalizes to ANY table size (3-10 players), using the anchor points from
// the 9-handed and 6-handed range sheets, plus a verified equity ranking of
// all 169 starting hand types computed with this same engine (so it's
// internally consistent, not a separate guess).

// General preflop chart move for ANY table size. Rule-based (like the exact
// Seat 1-4 chart above), NOT equity-percentile-based -- an earlier version of
// this used raw heads-up equity to rank hands, but that undervalues suited
// connectors (their real value is implied odds/big-hand potential, not raw
// win-rate against a random hand), so it disagreed with the studied sheets.
// This version interpolates the SAME KIND of threshold rules the sheets use,
// scaled continuously by how early/late the seat is.
function inRangeGeneral(shape, tightness) {
  // tightness: 0 = tightest (first to act, many-handed) ... 1 = loosest (Button)
  const { hi, lo, suited, pair } = shape;

  const pairMin = tightness < 0.2 ? 6 : tightness < 0.3 ? 4 : 2;
  if (pair && hi >= pairMin) return true;

  const aceSuitedMin = tightness < 0.15 ? 10 : tightness < 0.35 ? 9 : tightness < 0.6 ? 5 : 2;
  if (suited && hi === 14 && lo >= aceSuitedMin) return true;

  const aceOffMin = tightness < 0.15 ? 11 : tightness < 0.35 ? 10 : 7; // sheet: UTG "AJ+" means J(11), not Q
  if (!suited && hi === 14 && lo >= aceOffMin) return true;

  if (hi === 13 && lo === 12) return true; // KQ, suited or offsuit, playable everywhere
  const kSuitedMin = tightness < 0.15 ? 11 : tightness < 0.35 ? 10 : tightness < 0.85 ? 9 : 6;
  if (suited && hi === 13 && lo >= kSuitedMin) return true;
  const kOffMin = tightness < 0.35 ? 12 : tightness < 0.85 ? 10 : 9; // KTo+ through seat 3, K9o+ only at the button
  if (!suited && hi === 13 && lo >= kOffMin) return true;

  const qSuitedMin = tightness < 0.15 ? 11 : tightness < 0.35 ? 10 : tightness < 0.85 ? 9 : 6;
  if (suited && hi === 12 && lo >= qSuitedMin) return true;
  if (!suited && hi === 12 && tightness >= 0.6 && tightness < 0.85 && lo === 10) return true; // QTo exactly, seat 3 only
  if (!suited && hi === 12 && tightness >= 0.85 && lo >= 9) return true; // Q9o+, button only

  if (suited && hi === 11 && lo === 10 && tightness >= 0.2) return true; // JTs -- NOT at the tightest seat
  if (suited && hi === 11 && lo >= 9 && tightness >= 0.6) return true; // J9s+ from seat 3 (cutoff) onward
  if (tightness >= 0.6 && !suited && hi === 11 && lo === 10) return true; // JTo, later positions only

  // Suited connectors and small gappers -- explicitly included at looser
  // positions, exactly as both studied sheets call out by name.
  if (suited && tightness >= 0.35) {
    const gap = hi - lo;
    if (gap === 1 && lo >= 5 && hi <= 10) return true; // 65s-T9s, from mid position onward
    if (tightness >= 0.85 && gap === 2 && lo >= 4 && hi <= 8) return true; // one-gappers, button only
    if (tightness >= 0.85 && hi >= 6 && lo >= 6) return true; // any suited hand, both cards 6+, button only
  }
  if (tightness >= 0.85 && hi >= 10 && lo >= 10) return true; // any two broadway cards, button-wide

  return false;
}

function generalChartMove(heroCards, seatIndex, numPlayers) {
  if (!seatIndex || !numPlayers) return null;
  const nonBlindSeats = Math.max(numPlayers - 2, 1);
  const tightness = nonBlindSeats <= 1 ? 1 : (seatIndex - 1) / (nonBlindSeats - 1);
  const shape = handShape(heroCards[0], heroCards[1]);
  return inRangeGeneral(shape, tightness) ? "Raise" : "Fold";
}

// Position adjustment used for POSTFLOP decisions only (flop/turn/river),
// since the studied sheet only covers preflop opens, not postflop ranges.
// Direction is the same real principle as before: earlier position needs
// more edge to continue, later position can profitably need less.
const POSTFLOP_POSITION_ADJUSTMENT = {
  seat1: 5, seat2: 2, seat3: -1, seat4: -5, sb: 2, bb: -1, none: 0,
};

function getPositionAdjustment(position) {
  return POSTFLOP_POSITION_ADJUSTMENT[position] ?? 0;
}

// Move suggestion. Preflop with a known seat (1-4) uses the exact studied
// chart above -- no equity math involved, matches the sheet directly.
// Small Blind / Big Blind aren't in that chart (the sheet explicitly treats
// blind defense as a separate topic not yet covered), so those and postflop
// streets fall back to the equity/pot-odds engine below.
function suggestMove(winPct, numOpponents, street = "preflop", potSize = null, betToCall = null, position = "none", heroCards = null, numPlayers = null, seatIndex = null) {
  if (street === "preflop" && heroCards) {
    // 6-max table with a named Seat 1-4: use the exact studied chart (highest fidelity)
    if (numPlayers === 6 && position) {
      const chartMove = chartBasedPreflopMove(heroCards, position);
      if (chartMove) return chartMove;
    }
    // Any other table size with a seat index given: use the general table-size system
    if (numPlayers && seatIndex) {
      const generalMove = generalChartMove(heroCards, seatIndex, numPlayers);
      if (generalMove) return generalMove;
    }
  }

  const posAdj = getPositionAdjustment(position);
  const hasPotInfo = potSize !== null && betToCall !== null && betToCall > 0;

  if (hasPotInfo) {
    const requiredEquity = (betToCall / (potSize + betToCall)) * 100;
    const adjustedRequired = requiredEquity + posAdj;
    const cushion = winPct - adjustedRequired;

    if (cushion < 0) return "Fold";
    if (cushion >= 15) return "Raise";
    return "Call";
  }

  const fairShare = 100 / (numOpponents + 1);
  const edge = winPct - fairShare - posAdj;

  const thresholds = {
    preflop: { raiseEdge: 20, callEdge: 5, raiseAbs: 65 },
    flop:    { raiseEdge: 18, callEdge: 3, raiseAbs: 60 },
    turn:    { raiseEdge: 20, callEdge: 5, raiseAbs: 62 },
    river:   { raiseEdge: 25, callEdge: 8, raiseAbs: 68 },
  };
  const t = thresholds[street] || thresholds.preflop;

  if (edge >= t.raiseEdge || winPct >= t.raiseAbs) return "Raise";
  if (edge >= t.callEdge) return "Call";
  return "Fold";
}

// The exact equity % needed to profitably call a given bet -- useful to show
// on its own even before running the full simulation.
function requiredEquityToCall(potSize, betToCall) {
  return (betToCall / (potSize + betToCall)) * 100;
}

function streetFromBoardLength(boardLength) {
  if (boardLength >= 5) return "river";
  if (boardLength === 4) return "turn";
  if (boardLength === 3) return "flop";
  return "preflop";
}
