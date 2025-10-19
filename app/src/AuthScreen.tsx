import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { supabase } from './supabase';

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'email'|'code'|'profile'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [age, setAge] = useState('');

  async function sendCode() {
    if (!email.includes('@')) return Alert.alert('Email invalide');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: undefined }
    });
    if (error) return Alert.alert('Erreur', error.message);
    Alert.alert('Code envoyé', 'Consulte ta boîte mail et recopie le code à 6 chiffres.');
    setStep('code');
  }

  async function verifyCode() {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email'
    });
    if (error || !data.session) return Alert.alert('Code invalide', error?.message ?? '');
    // Si profil incomplet, on affiche le formulaire
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', data.session.user.id).single();
    if (!prof?.first_name || !prof?.last_name || !prof?.age) {
      setStep('profile');
    } else {
      onDone();
    }
  }

  async function saveProfile() {
    const a = parseInt(age, 10);
    if (!first || !last || !a || a < 18) {
      return Alert.alert('Info manquante', 'Renseigne prénom, nom et un âge ≥ 18.');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Session perdue');
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, email: email.toLowerCase(), first_name: first, last_name: last, age: a
    });
    if (error) return Alert.alert('Erreur profil', error.message);
    onDone();
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      {step === 'email' && (
        <>
          <Text style={{ fontWeight: '700', fontSize: 20 }}>Créer un compte</Text>
          <Text>Email (obligatoire)</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" style={s.input} placeholder="toi@exemple.com" />
          <Pressable onPress={sendCode} style={s.btn}><Text style={s.btnTxt}>Recevoir le code</Text></Pressable>
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={{ fontWeight: '700', fontSize: 20 }}>Entrez le code reçu</Text>
          <Text>Code à 6 chiffres envoyé à {email}</Text>
          <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" style={s.input} placeholder="123456" />
          <Pressable onPress={verifyCode} style={s.btn}><Text style={s.btnTxt}>Valider</Text></Pressable>
          <Pressable onPress={sendCode} style={s.link}><Text>Renvoyer le code</Text></Pressable>
        </>
      )}

      {step === 'profile' && (
        <>
          <Text style={{ fontWeight: '700', fontSize: 20 }}>Ton profil</Text>
          <Text>Prénom</Text>
          <TextInput value={first} onChangeText={setFirst} style={s.input} />
          <Text>Nom</Text>
          <TextInput value={last} onChangeText={setLast} style={s.input} />
          <Text>Âge (≥ 18)</Text>
          <TextInput value={age} onChangeText={setAge} style={s.input} keyboardType="number-pad" />
          <Pressable onPress={saveProfile} style={s.btn}><Text style={s.btnTxt}>Continuer</Text></Pressable>
          <Text style={{ opacity: .6, marginTop: 8 }}>En continuant, tu acceptes la politique de confidentialité.</Text>
        </>
      )}
    </View>
  );
}
const s = {
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 10, borderRadius: 10 },
  btn: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: '700' },
  link: { paddingVertical: 8, alignItems: 'center' },
} as const;

