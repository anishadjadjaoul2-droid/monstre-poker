import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

export type Suit = 'c' | 'd' | 'h' | 's';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type PlayingCard = { rank: Rank; suit: Suit };

const SUITS: { id: Suit; name: string; symbol: string }[] = [
  { id: 'c', name: 'trèfle',  symbol: '♣' },
  { id: 'd', name: 'carreau', symbol: '♦' },
  { id: 's', name: 'pique',   symbol: '♠' },
  { id: 'h', name: 'cœur',    symbol: '♥' },
];
const RANKS: Rank[] = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

export default function CardPicker({
  visible, onClose, onPick, exclude,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: PlayingCard) => void;
  exclude?: Set<string>;           // pour empêcher les doublons (ex: Ah déjà posé)
}) {
  const [suit, setSuit] = useState<Suit | '?'>('?');

  const pick = (rank: Rank) => {
    if (suit === '?') return;
    const card = { rank, suit } as PlayingCard;
    const key = rank + suit;
    if (exclude?.has(key)) return;
    onPick(card);
    setSuit('?');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.sheet}>
          <Text style={S.title}>Choisis une carte</Text>

          {suit === '?' ? (
            <View style={S.row}>
              {SUITS.map(s => (
                <Pressable key={s.id} style={S.suit} onPress={() => setSuit(s.id)}>
                  <Text style={S.suitTxt}>{s.symbol}</Text>
                  <Text style={S.suitLabel}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Text style={{ textAlign: 'center', marginBottom: 8 }}>
                Couleur : {SUITS.find(x => x.id === suit)?.symbol}
              </Text>
              <View style={S.grid}>
                {RANKS.map(r => {
                  const key = r + suit;
                  const disabled = exclude?.has(key);
                  return (
                    <Pressable
                      key={r}
                      style={[S.rank, disabled && { opacity: 0.3 }]}
                      disabled={disabled}
                      onPress={() => pick(r)}
                    >
                      <Text style={S.rankTxt}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => setSuit('?')} style={S.back}>
                <Text>← Changer de couleur</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={onClose} style={S.cancel}><Text>Annuler</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const cardToShort = (c?: PlayingCard | null) => (c ? `${c.rank}${c.suit}` : '');

const S = StyleSheet.create({
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-end' },
  sheet:{ backgroundColor:'#fff', padding:16, borderTopLeftRadius:16, borderTopRightRadius:16 },
  title:{ fontWeight:'700', fontSize:18, marginBottom:8 },
  row:{ flexDirection:'row', justifyContent:'space-around', marginVertical:8 },
  suit:{ alignItems:'center' },
  suitTxt:{ fontSize:40 },
  suitLabel:{ fontSize:12, opacity:0.6 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center' },
  rank:{ width:48, height:48, borderWidth:1, borderColor:'#ddd', borderRadius:8, alignItems:'center', justifyContent:'center' },
  rankTxt:{ fontSize:18, fontWeight:'700' },
  back:{ alignSelf:'center', marginTop:8 },
  cancel:{ alignSelf:'center', marginTop:12 },
});
