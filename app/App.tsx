// app/App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform, ScrollView } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';
import { computeDecision, HandState } from './src/engine';
import AuthScreen from './src/AuthScreen';
import { supabase } from './src/supabase';

const ENTITLEMENT_ID = 'monstre_pro';
const HANDS_TRIAL = 7;

// --- Helpers essai par utilisateur (Supabase) ---
async function getHandsUsed(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.from('profiles').select('hands_used').eq('id', user.id).single();
  return data?.hands_used ?? 0;
}
async function incHandsUsed(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // 1) Essaye la RPC (recommandé)
  const rpc = await supabase.rpc('inc_hands_used', { uid: user.id });
  if (!rpc.error && typeof rpc.data === 'number') {
    return rpc.data as number;
  }

  // 2) Fallback: update manuel
  const { data: current } = await supabase
    .from('profiles').select('hands_used').eq('id', user.id).single();
  const next = (current?.hands_used ?? 0) + 1;
  await supabase.from('profiles').update({ hands_used: next }).eq('id', user.id);
  return next;
}

// --- Clé publique RevenueCat (remplace si besoin par les tiennes) ---
const RC_KEY = Platform.select({
  ios:    'appl_YOUR_IOS_PUBLIC_KEY',
  android:'goog_YOUR_ANDROID_PUBLIC_KEY',
})!;

export default function App() {
  // Auth / RC
  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setPro] = useState(false);

  // UI / logique poker
  const [isLoading, setLoading] = useState(false);
  const [handsLeft, setHandsLeft] = useState<number>(HANDS_TRIAL);
  const [players, setPlayers] = useState('3');
  const [stackBB, setStackBB] = useState('25');
  const [bbSize, setBbSize] = useState('100');
  const [cards, setCards] = useState('Ah7s');
  const [lastDecision, setLastDecision] = useState('');

  // 1) Session Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, ses) => {
      setUserId(ses?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
  Purchases.setLogLevel(LOG_LEVEL.INFO);
  Purchases.configure({ apiKey: RC_KEY });

  Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
    const active = info.entitlements.active[ENTITLEMENT_ID];
    setPro(!!active);
  });

  (async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      const active = info.entitlements.active[ENTITLEMENT_ID];
      setPro(!!active);
    } catch {}
  })();

  // pas de remove() typé -> cleanup no-op
  return () => {};
}, []);

  // 3) Lier l’utilisateur RC + charger compteur d’essai
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try { await Purchases.logIn(userId); } catch {}
      const used = await getHandsUsed();
      setHandsLeft(Math.max(0, HANDS_TRIAL - used));
    })();
  }, [userId]);

  const openPaywall = useCallback(async () => {
    try {
      const result = await RevenueCatUI.presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        const info = await Purchases.getCustomerInfo();
        setPro(!!info.entitlements.active[ENTITLEMENT_ID]);
      }
    } catch (e: any) {
      Alert.alert('Achat', e?.message ?? 'Impossible d’ouvrir le paywall');
    }
  }, []);

  const decide = useCallback(async () => {
    try {
      setLoading(true);

      // essai / paywall
      if (!isPro) {
        const used = await getHandsUsed();
        if (used >= HANDS_TRIAL) {
          setHandsLeft(0);
          await openPaywall();
          setLoading(false);
          return;
        }
      }

      const st: HandState = {
        players: Number(players),
        stackBB: Number(stackBB),
        bbSize: Number(bbSize),
        cards: cards.trim(),
      };
      const d = computeDecision(st);
      setLastDecision(String(d));


      if (!isPro) {
        const newUsed = await incHandsUsed();
        setHandsLeft(Math.max(0, HANDS_TRIAL - newUsed));
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Calcul impossible');
    } finally {
      setLoading(false);
    }
  }, [players, stackBB, bbSize, cards, isPro, openPaywall]);

  // Écran d’auth si pas connecté
  if (!sessionReady) return null;
  if (!userId) return <AuthScreen onDone={async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUserId(session?.user?.id ?? null);
  }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Monstre Poker</Text>
      <Text style={{ opacity: 0.6 }}>
        {isPro ? 'PRO illimité' : `Essai : ${handsLeft} main${handsLeft>1?'s':''} restantes`}
      </Text>

      <Text>Joueurs (2–6)</Text>
      <TextInput value={players} onChangeText={setPlayers} style={styles.input} keyboardType="number-pad" />

      <Text>Stack (BB)</Text>
      <TextInput value={stackBB} onChangeText={setStackBB} style={styles.input} keyboardType="number-pad" />

      <Text>Taille de la BB</Text>
      <TextInput value={bbSize} onChangeText={setBbSize} style={styles.input} keyboardType="number-pad" />

      <Text>Cartes (ex: Ah7s)</Text>
      <TextInput value={cards} onChangeText={setCards} style={styles.input} autoCapitalize="none" />

      <Pressable onPress={decide} disabled={isLoading} style={styles.btn}>
        <Text style={styles.btnTxt}>{isLoading ? 'Calcul…' : 'Décider cette main'}</Text>
      </Pressable>

      {!isPro && (
        <Pressable onPress={openPaywall} style={styles.btnOutline}>
          <Text style={styles.btnOutlineTxt}>Débloquer illimité</Text>
        </Pressable>
      )}

      {lastDecision ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '700' }}>Décision :</Text>
          <Text>{lastDecision}</Text>
        </View>
      ) : null}

      <Text style={{ marginTop: 24, opacity: 0.6 }}>
        ⚠️ Outil d’entraînement. Aucun lien avec les jeux d’argent réels.
      </Text>
    </ScrollView>
  );
}

const styles = {
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 10, borderRadius: 10 },
  btn: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: '700' },
  btnOutline: { borderWidth: 2, borderColor: '#111827', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnOutlineTxt: { color: '#111827', fontWeight: '700' },
} as const;
