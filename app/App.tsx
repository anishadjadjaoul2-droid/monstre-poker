import React, { useMemo, useState } from "react";
import { SafeAreaView, View, Text, TextInput, Pressable, ScrollView, Linking, Platform } from "react-native";
import TableScreen from "./src/screens/TableScreen";

// Palette commune (identique aux maquettes)
const COLORS = {
  bg: "#F5F7FA",
  dark: "#111827",
  muted: "#788390",
  green: "#07B36E",
  teal: "#0E5466",
  blue: "#1A568B",
  white: "#ffffff",
  fieldBorder: "#E6EBF0",
};

type Route = "auth" | "table";

export default function App() {
  const [route, setRoute] = useState<Route>("auth");

  // “Etat global” minimal
  const [user, setUser] = useState({
    email: "",
    first: "",
    last: "",
    age: "",
  });
  const [isPro, setIsPro] = useState(false);
  const [handsUsed, setHandsUsed] = useState(0);

  const canCreate = useMemo(() => {
    const ok =
      user.email.includes("@") &&
      user.first.trim().length > 0 &&
      user.last.trim().length > 0 &&
      /^\d+$/.test(user.age) &&
      Number(user.age) >= 18;
    return ok;
  }, [user]);

  if (route === "auth") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {/* “Barre” style maquette */}
          <View style={{ height: 80, backgroundColor: COLORS.white, borderRadius: 8, marginBottom: 24, justifyContent: "center" }}>
            <Text style={{ color: COLORS.dark, fontSize: 18, marginLeft: 16 }}>Monstre Poker — Créer un compte</Text>
          </View>

          {/* Logo carré teal */}
          <View style={{ alignSelf: "center", width: 200, height: 260, backgroundColor: COLORS.teal, borderRadius: 32, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 72, color: COLORS.white }}>🂠</Text>
          </View>

          <Text style={{ marginTop: 24, fontSize: 34, fontWeight: "700", color: COLORS.dark, textAlign: "center" }}>
            Monstre Poker
          </Text>

          {/* Onglets stylés (maquette) */}
          <View style={{ marginTop: 24, flexDirection: "row", gap: 12, alignSelf: "center" }}>
            <PillBtn label="Connexion" onPress={() => {}} inverted />
            <PillBtn label="Créer un compte" onPress={() => {}} />
          </View>

          {/* Champs */}
          <View style={{ marginTop: 24, gap: 16 }}>
            <Field value={user.email} placeholder="Adresse e-mail" onChangeText={(v) => setUser((s) => ({ ...s, email: v }))} />
            <Field value={user.first} placeholder="Prénom" onChangeText={(v) => setUser((s) => ({ ...s, first: v }))} />
            <Field value={user.last} placeholder="Nom" onChangeText={(v) => setUser((s) => ({ ...s, last: v }))} />
            <Field value={user.age} placeholder="Âge (18+)" keyboardType="number-pad" onChangeText={(v) => setUser((s) => ({ ...s, age: v }))} />
            <BigBtn
              label="CRÉER MON COMPTE"
              disabled={!canCreate}
              onPress={() => setRoute("table")}
            />
            <Text
              onPress={() =>
                Linking.openURL("https://anishadjadjaoul2-droid.github.io/monstre-poker/privacy.html")
              }
              style={{ color: COLORS.muted, textAlign: "center", marginTop: 8 }}
            >
              En continuant vous acceptez la politique de confidentialité.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ROUTE = TABLE
  return (
    <TableScreen
      theme={COLORS}
      isPro={isPro}
      handsUsed={handsUsed}
      onUseHand={() => setHandsUsed((n) => n + 1)}
      onBuyPro={() => setIsPro(true)}
      onLogout={() => {
        setRoute("auth");
        setIsPro(false);
        setHandsUsed(0);
      }}
    />
  );
}

// ———————————————————————— UI helpers ————————————————————————
function PillBtn({
  label,
  onPress,
  inverted,
}: {
  label: string;
  onPress: () => void;
  inverted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: inverted ? COLORS.white : COLORS.green,
        borderRadius: 24,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderWidth: inverted ? 2 : 0,
        borderColor: COLORS.teal,
      }}
    >
      <Text style={{ color: inverted ? COLORS.teal : COLORS.white, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Field({
  value,
  placeholder,
  onChangeText,
  keyboardType,
}: {
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad" | "email-address";
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: COLORS.fieldBorder,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0AAB4"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
        style={{
          paddingHorizontal: 16,
          paddingVertical: Platform.select({ ios: 16, android: 12 }),
          fontSize: 16,
          color: COLORS.dark,
        }}
      />
    </View>
  );
}

function BigBtn({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "#9BDDC3" : COLORS.green,
        borderRadius: 24,
        paddingVertical: 16,
        alignItems: "center",
      }}
    >
      <Text style={{ color: COLORS.white, fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
