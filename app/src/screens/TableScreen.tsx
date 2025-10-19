import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import CardPicker, { PlayingCard, cardToShort } from '../components/CardPicker';
import { computeWin, Stage, ComputeResult } from '../logic/computeWin';

type Seat = 2 | 3 | 4 | 5 | 6;

export default function TableScreen() {
  // Sélecteur de cartes
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<{ type: 'hero' | 'board'; idx: number } | null>(null);

  // Tes cartes + board
  const [hero, setHero] = useState<[PlayingCard | null, PlayingCard | null]>([null, null]);
  const [board, setBoard] = useState<(PlayingCard | null)[]>([null, null, null, null, null]);

  // Joueurs 2..6 en jeu/fold (adversaires)
  const [active, setActive] = useState<Record<Seat, boolean>>({
    2: true, 3: true, 4: true, 5: true, 6: true,
  });

  const leftSeats:  Seat[] = [2, 3, 4];
  const rightSeats: Seat[] = [5, 6];

  // Compteurs & étape
  const oppCount = useMemo(() => Object.values(active).filter(Boolean).length, [active]);
  const stage: Stage = useMemo(
    () => (board[4] ? 'RIVER' : board[3] ? 'TURN' : board[0] ? 'FLOP' : 'PREFLOP'),
    [board]
  );

  // Empêcher les doublons
  const exclude = useMemo(() => {
    const set = new Set<string>();
    [hero[0], hero[1], ...board].forEach((c) => c && set.add(cardToShort(c)));
    return set;
  }, [hero, board]);

  const openSlot = (type: 'hero' | 'board', idx: number) => {
    setPickerSlot({ type, idx });
    setPickerVisible(true);
  };

  const onPick = (c: PlayingCard) => {
    if (!pickerSlot) return;
    if (pickerSlot.type === 'hero') {
      setHero((h) => {
        const n = [...h] as [PlayingCard | null, PlayingCard | null];
        n[pickerSlot.idx] = c;
        return n;
      });
    } else {
      setBoard((b) => {
        const n = [...b];
        n[pickerSlot.idx] = c;
        return n;
      });
    }
  };

  // Équité (Monte-Carlo exact depuis computeWin)
  const [equity, setEquity] = useState<ComputeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await computeWin(hero, board, oppCount, stage);
      if (!cancelled) setEquity(res);
    })();
    return () => { cancelled = true; };
  }, [hero, board, oppCount, stage]);

  return (
    <View style={{ flex: 1 }}>
      <View style={S.table}>
        {/* Cartes du board */}
        <View style={S.boardRow}>
          {board.map((c, i) => (
            <Pressable key={i} style={S.card} onPress={() => openSlot('board', i)}>
              <Text style={S.cardLbl}>
                {c ? `${c.rank}${c.suit}` : i < 3 ? `F${i + 1}` : i === 3 ? 'T1' : 'R1'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* États des sièges */}
        <View style={S.seatsRow}>
          {leftSeats.map((s) => (
            <SeatToggle
              key={s}
              seat={s}
              value={active[s]}
              onChange={(v) => setActive((a) => ({ ...a, [s]: v }))}
            />
          ))}
          <View style={{ flex: 1 }} />
          {rightSeats.map((s) => (
            <SeatToggle
              key={s}
              seat={s}
              value={active[s]}
              onChange={(v) => setActive((a) => ({ ...a, [s]: v }))}
            />
          ))}
        </View>

        {/* Tes cartes */}
        <View style={S.heroRow}>
          <Text style={{ marginRight: 12 }}>Joueur 1 :</Text>
          {[0, 1].map((i) => (
            <Pressable key={i} style={S.cardHero} onPress={() => openSlot('hero', i)}>
              <Text style={S.cardLbl}>
                {hero[i] ? `${hero[i]!.rank}${hero[i]!.suit}` : i === 0 ? 'C1' : 'C2'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={S.infoBar}>
        <Text style={{ fontWeight: '700' }}>Étape : {stage}</Text>
        <Text>Adversaires actifs : {oppCount}</Text>
        <Text>
          {equity?.status === 'ok'
            ? `Équité estimée : ${equity.winPct.toFixed(1)} %  (ties ~ ${equity.tiePct.toFixed(1)} %, n=${equity.samples})`
            : 'Équité : —'}
        </Text>
      </View>

      <CardPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={onPick}
        exclude={exclude}
      />
    </View>
  );
}

function SeatToggle({
  seat, value, onChange,
}: {
  seat: Seat;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[S.seatBtn, !value && S.seatOff]}>
      <Text>Joueur {seat}</Text>
      <Text style={{ fontSize: 12, opacity: 0.7 }}>{value ? 'En jeu' : 'Fold'}</Text>
    </Pressable>
  );
}

const S = StyleSheet.create({
  table:   { margin: 16, padding: 16, borderWidth: 2, borderColor: '#0a8f4a',
             backgroundColor: '#06b862', borderRadius: 240 },
  boardRow:{ flexDirection: 'row', justifyContent: 'space-evenly', marginVertical: 24 },
  heroRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  card:    { width: 56, height: 84, backgroundColor: '#17485A', borderRadius: 6,
             alignItems: 'center', justifyContent: 'center' },
  cardHero:{ width: 64, height: 96, backgroundColor: '#17485A', borderRadius: 8,
             alignItems: 'center', justifyContent: 'center' },
  cardLbl: { color: '#fff', fontWeight: '700' },
  seatsRow:{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, gap: 8 },
  seatBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
             backgroundColor: 'rgba(255,255,255,0.85)' },
  seatOff: { backgroundColor: 'rgba(0,0,0,0.08)' },
  infoBar: { padding: 12, borderTopWidth: 1, borderColor: '#eee', gap: 4 },
});
