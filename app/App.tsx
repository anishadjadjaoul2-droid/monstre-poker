import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, Alert, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { computeDecision, HandState } from '/workspaces/monstre-poker/app/assets/src/src/engine';

const ENTITLEMENT_ID = 'monstre_pro';
const HANDS_TRIAL = 7;

export default function App() {
  const [isLoading, setLoading] = useState(true);
  const [isPro, setPro] = useState(false);
  const [handsLeft, setHandsLeft] = useState<number>(HANDS_TRIAL);

  const [players, setPlayers] = useState('3');
  const [stackBB, setStackBB] = useState('25');
  const [bbSize, setBbSize] = useState('100');
  const [cards, setCards] = useState('Ah7s');
  const [street, setStreet] = useState<'preflop'|'flop'|'turn'|'river'>('preflop');
  const [board, setBoard] = useState('');
  const [lastDecision, setLastDecision] = useState<string>('');

  // Configure RevenueCat (remplace les clés par les tiennes)
  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({
      apiKey: Platform.OS === 'ios'
        ? 'appl_xxx_your_rc_ios_key'
        : 'goog_xxx_your_rc_android_key'
    });
  }, []);

  const refreshCustomer = useCallback(async () => {
    try {
      const info: CustomerInfo = await Purchases.getCustomerInfo();
      const proActive = Boolean(info.entitlements.active[ENTITLEMENT_ID]);
      setPro(proActive);
      const stored = await AsyncStorage.getItem('handsLeft');
      const parsed = stored ? parseInt(stored, 10) : HANDS_TRIAL;
      setHandsLeft(proActive ? Number.POSITIVE_INFINITY : (isNaN(parsed) ? HANDS_TRIAL : parsed));
    } catch {
      // offline : on garde l'état local
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshCustomer(); }, [refreshCustomer]);

  const saveHandsLeft = async (n: number) => {
    setHandsLeft(n);
    await AsyncStorage.setItem('handsLeft', String(n));
  };

  const presentPaywall = async () => {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshCustomer();
        Alert.alert('Merci !', 'Accès Monstre Pro débloqué.');
      }
    } catch (e: any) {
      Alert.alert('Achat', e?.message ?? 'Erreur de paiement');
    }
  };

  const restore = async () => {
    try {
      await Purchases.restorePurchases();
      await refreshCustomer();
      Alert.alert('Restauration', 'Achats restaurés si disponibles.');
    } catch (e: any) {
      Alert.alert('Restauration', e?.message ?? 'Erreur');
    }
  };

  const runHand = async () => {
    if (!isPro && handsLeft <= 0) {
      await presentPaywall();
      return;
    }
    const state: HandState = {
      players: Number(players || 2),
      stackBB: Number(stackBB || 20),
      bbSize: Number(bbSize || 100),
      cards,
      street,
      board: board || undefined,
    };
    const d = computeDecision(state);
    setLastDecision(`${d.action}${d.note ? ' — ' + d.note : ''}`);
    if (!isPro) await saveHandsLeft(handsLeft - 1);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <Text>Chargement…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Monstre Poker</Text>
        <Text style={{ marginTop: 4 }}>
          Statut : {isPro ? 'PRO (illimité)' : `ESSAI (${handsLeft === Number.POSITIVE_INFINITY ? '∞' : handsLeft} mains restantes)`}
        </Text>

        <View style={{ marginTop: 16 }}>
          <Text>Joueurs</Text>
          <TextInput value={players} onChangeText={setPlayers} keyboardType='number-pad' style={styles.input}/>
          <Text>Stack (en BB)</Text>
          <TextInput value={stackBB} onChangeText={setStackBB} keyboardType='number-pad' style={styles.input}/>
          <Text>Taille BB (jetons)</Text>
          <TextInput value={bbSize} onChangeText={setBbSize} keyboardType='number-pad' style={styles.input}/>
          <Text>Cartes (ex: Ah7s)</Text>
          <TextInput value={cards} onChangeText={setCards} autoCapitalize='characters' style={styles.input}/>
          <Text>Street (preflop/flop/turn/river)</Text>
          <TextInput value={street} onChangeText={(t)=>setStreet((t as any)||'preflop')} style={styles.input}/>
          <Text>Board (ex: 6d7h9h)</Text>
          <TextInput value={board} onChangeText={setBoard} autoCapitalize='characters' style={styles.input}/>
        </View>

        <View style={{ flexDirection:'row', gap:12, marginTop: 12, flexWrap: 'wrap' }}>
          <Pressable style={styles.btn} onPress={runHand}>
            <Text style={styles.btnTxt}>Décider cette main</Text>
          </Pressable>
          <Pressable style={styles.btnOutline} onPress={presentPaywall}>
            <Text style={styles.btnOutlineTxt}>Débloquer PRO</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={restore}>
            <Text style={{textDecorationLine:'underline'}}>Restaurer achats</Text>
          </Pressable>
        </View>

        {lastDecision ? (
          <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#f3f4f6' }}>
            <Text style={{ fontWeight: '600' }}>Décision :</Text>
            <Text>{lastDecision}</Text>
          </View>
        ) : null}

        <Text style={{ marginTop: 24, opacity: 0.7 }}>
          ⚠️ Outil d’entraînement. Aucun lien avec des jeux d’argent.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 10, borderRadius: 10, marginTop: 6, marginBottom: 10 },
  btn: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  btnTxt: { color: 'white', fontWeight: '700' },
  btnOutline: { borderWidth: 2, borderColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  btnOutlineTxt: { color: '#111827', fontWeight: '700' },
  link: { justifyContent:'center', paddingHorizontal: 6 }
} as const;




