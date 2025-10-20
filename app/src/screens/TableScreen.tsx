import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, SafeAreaView, ScrollView, Alert } from "react-native";
import CardPicker from "../components/CardPicker";
import type { PlayingCard } from "../components/CardPicker";
import { computeWin, type Stage, type ComputeResult } from "../logic/computeWin";

// Thème depuis App.tsx
type Theme = {
  bg: string;
  dark: string;
  muted: string;
  green: string;
  teal: string;
  blue: string;
  white: string;
  fieldBorder: string;
};

type Props = {
  theme: Theme;
  isPro: boolean;
  handsUsed: number;
  onUseHand: () => void;
  onBuyPro: () => void;
  onLogout: () => void;
};

type Seat = { active: boolean };
const initSeats = (): Seat[] => [{ active: true }, { active: true }, { active: true }, { active: true }];

const rankLabel = (r: PlayingCard["rank"]) => (r === "T" ? "10" : r);
const suitGlyph: Record<PlayingCard["suit"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const labelFromCard = (c: PlayingCard | null) => (c ? `${rankLabel(c.rank)}${suitGlyph[c.suit]}` : "");

export default function TableScreen({
  theme: C,
  isPro,
  handsUsed,
  onUseHand,
  onBuyPro,
  onLogout,
}: Props) {
  // états cartes au format PlayingCard
  const [hero, setHero] = useState<[PlayingCard | null, PlayingCard | null]>([null, null]);
  const [board, setBoard] = useState<(PlayingCard | null)[]>([null, null, null, null, null]);
  const [seats, setSeats] = useState<Seat[]>(initSeats());
  const [equity, setEquity] = useState<number | null>(null);

  // sélecteur
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<"C1" | "C2" | "F1" | "F2" | "F3" | "T1" | "R1">("C1");

  const oppCount = useMemo(() => seats.filter((s) => s.active).length, [seats]);

  function handlePick(c: PlayingCard) {
    switch (pickerSlot) {
      case "C1": setHero(([_, c2]) => [c, c2]); break;
      case "C2": setHero(([c1, _]) => [c1, c]); break;
      case "F1": setBoard(([_, b2, b3, t1, r1]) => [c, b2, b3, t1, r1]); break;
      case "F2": setBoard(([b1, _, b3, t1, r1]) => [b1, c, b3, t1, r1]); break;
      case "F3": setBoard(([b1, b2, _, t1, r1]) => [b1, b2, c, t1, r1]); break;
      case "T1": setBoard(([b1, b2, b3, _, r1]) => [b1, b2, b3, c, r1]); break;
      case "R1": setBoard(([b1, b2, b3, t1, _]) => [b1, b2, b3, t1, c]); break;
    }
    setPickerOpen(false);
  }

  async function doCompute() {
    // → chaque calcul consomme 1 main d’essai si non PRO
    if (!isPro) {
      if (handsUsed >= 7) { setShowPaywall(true); return; }
      onUseHand();
    }
    if (!hero[0] || !hero[1]) {
      Alert.alert("Cartes manquantes", "Renseigne C1 et C2.");
      return;
    }

    const shown = board.filter(Boolean).length;
    const stage: Stage = (shown >= 5 ? "river" : shown === 4 ? "turn" : shown >= 3 ? "flop" : "preflop") as Stage;

    try {
      const res: ComputeResult = await computeWin(hero, board, oppCount, stage);
      setEquity(res.winPct);
    } catch (e) {
      console.warn(e);
      Alert.alert("Calcul", "Impossible de calculer l’équité pour ce spot.");
    }
  }

  // RESET = nouvelle main (compte 1 main d’essai et remet tout à zéro)
  function resetHand() {
    if (!isPro) {
      if (handsUsed >= 7) { setShowPaywall(true); return; }
      onUseHand(); // ✅ considère la main comme “jouée”
    }
    setHero([null, null]);
    setBoard([null, null, null, null, null]);
    setSeats(initSeats());
    setEquity(null);
  }

  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ height: 80, backgroundColor: C.white, justifyContent: "center", paddingHorizontal: 16 }}>
        <Text style={{ color: C.dark, fontSize: 18, fontWeight: "700" }}>Table d'entraînement</Text>
        <View style={{ position: "absolute", right: 16, top: 22, backgroundColor: "#E8F5EF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
          <Text style={{ color: C.green, fontWeight: "700" }}>
            Essai : {Math.min(handsUsed, 7)} / 7 {isPro ? "• PRO" : ""}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Table ovale */}
        <View style={{ width: "100%", aspectRatio: 1.35, backgroundColor: "#029E62", borderColor: "#096A54", borderWidth: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
          {/* Board */}
          <View style={{ flexDirection: "row", gap: 18, marginBottom: 24 }}>
            {(["F1","F2","F3","T1","R1"] as const).map((slot, idx) => (
              <CardBox
                key={slot}
                label={board[idx] ? labelFromCard(board[idx]) : slot}
                onPress={() => { setPickerSlot(slot); setPickerOpen(true); }}
              />
            ))}
          </View>

          {/* Hero */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <CardBox label={hero[0] ? labelFromCard(hero[0]) : "C1"} onPress={() => { setPickerSlot("C1"); setPickerOpen(true); }} />
            <CardBox label={hero[1] ? labelFromCard(hero[1]) : "C2"} onPress={() => { setPickerSlot("C2"); setPickerOpen(true); }} />
          </View>
        </View>

        {/* Sièges */}
        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between" }}>
          {seats.map((s, i) => (
            <Pressable
              key={i}
              onPress={() =>
                setSeats((arr) => {
                  const cp = [...arr];
                  cp[i] = { active: !cp[i].active };
                  return cp;
                })
              }
              style={{
                padding: 10,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: s.active ? C.fieldBorder : "#F0F0F0",
                backgroundColor: s.active ? "#0B5C70" : "#DCE7EE",
                minWidth: 110,
                alignItems: "center",
              }}
            >
              <Text style={{ color: s.active ? C.white : C.dark, fontWeight: "700" }}>Joueur {i + 2}</Text>
              <Text style={{ color: s.active ? C.white : C.muted, fontSize: 12 }}>{s.active ? "En jeu" : "Fold"}</Text>
            </Pressable>
          ))}
        </View>

        {/* Résumé/équité */}
        <View style={{ marginTop: 20, borderRadius: 16, borderColor: C.fieldBorder, borderWidth: 2, backgroundColor: C.white, padding: 16 }}>
          <Text style={{ color: C.dark, fontWeight: "700", fontSize: 16 }}>
            Équité estimée : {equity == null ? "--" : `${equity.toFixed(0)} %`}
          </Text>
          <Text style={{ color: C.muted, marginTop: 8, fontSize: 12 }}>Outil éducatif. Aucun jeu d’argent réel.</Text>
        </View>

        {/* Actions */}
        <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
          <BigBtn label="Choisir cartes" color={C.blue} onPress={() => { setPickerSlot("C1"); setPickerOpen(true); }} />
          <BigBtn label="Calculer l'équité" color={C.green} onPress={doCompute} />
        </View>
        <View style={{ marginTop: 10 }}>
          <GhostBtn label="Nouvelle main (Reset)" onPress={resetHand} />
        </View>

        <Pressable onPress={onLogout} style={{ marginTop: 12 }}>
          <Text style={{ color: C.muted, textAlign: "center" }}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>

      {/* Paywall */}
      <Modal visible={showPaywall} transparent animationType="slide" onRequestClose={() => setShowPaywall(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 20, width: "100%" }}>
            <View style={{ backgroundColor: C.dark, borderRadius: 12, padding: 16 }}>
              <Text style={{ color: C.white, fontWeight: "800", fontSize: 22 }}>Accès PRO à vie</Text>
            </View>
            <Text style={{ marginTop: 14, color: C.dark, fontSize: 16 }}>Essai terminé — 7/7 mains utilisées</Text>

            {[
              "Équité illimitée, préflop → river",
              "Aucune publicité",
              "Achat unique — pas d’abonnement",
            ].map((b, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
                <Text style={{ color: C.dark }}>{b}</Text>
              </View>
            ))}

            <View style={{ marginTop: 14, borderRadius: 12, borderColor: C.fieldBorder, borderWidth: 2, padding: 12 }}>
              <Text style={{ color: C.dark, fontWeight: "700" }}>Prix : 29,99 € (TTC) • Achats Google Play</Text>
            </View>

            <Pressable
              onPress={() => { setShowPaywall(false); onBuyPro(); }}
              style={{ marginTop: 12, backgroundColor: C.green, borderRadius: 24, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Débloquer l'accès PRO</Text>
            </Pressable>

            <Pressable onPress={() => setShowPaywall(false)} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.muted }}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* CardPicker */}
      <CardPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />
    </SafeAreaView>
  );
}

// —————————————————————— UI locaux ——————————————————————
function CardBox({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 70,
        height: 100,
        backgroundColor: "#1A4E60",
        borderColor: "#082F49",
        borderWidth: 3,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#ffffff", fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function BigBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: color,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function GhostBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "#E6EBF0",
        paddingVertical: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#111827", fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}
