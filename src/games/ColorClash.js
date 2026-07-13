// 🎨 컬러 클래시 — 스트룹 함정: 글자의 '뜻'과 '색'이 같은지 판단. 🔄 반전 라운드는 반대로!
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, STROOP_COLORS } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const ROUNDS = 10;

function makeRounds() {
  const rs = [];
  for (let i = 0; i < ROUNDS; i++) {
    const word = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
    const match = Math.random() < 0.5;
    const ink = match
      ? word
      : STROOP_COLORS.filter((c) => c.name !== word.name)[Math.floor(Math.random() * (STROOP_COLORS.length - 1))];
    const reverse = i >= 4 && Math.random() < 0.4; // 후반부에 🔄 반전 등장
    rs.push({ word, ink, match: word.name === ink.name, reverse });
  }
  return rs;
}

export default function ColorClash({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | show | resolved | over
    rounds: [],
    i: 0,
    score: { 1: 0, 2: 0 },
    note: '',
    winner: 0,
  }).current;
  const timers = useRef([]).current;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  useEffect(() => () => timers.forEach(clearTimeout), []);

  const start = () => {
    S.rounds = makeRounds();
    S.i = 0;
    S.score = { 1: 0, 2: 0 };
    S.winner = 0;
    S.phase = 'show';
    force();
  };

  const answer = (p, saidMatch) => {
    if (S.phase !== 'show') return;
    const r = S.rounds[S.i];
    let correct = saidMatch === r.match;
    if (r.reverse) correct = !correct;
    const scorer = correct ? p : p === 1 ? 2 : 1;
    S.score[scorer]++;
    S.note = correct ? `P${p} 정답! +1` : `P${p} 함정에 빠짐! 상대 +1`;
    S.phase = 'resolved';
    vib(correct ? 20 : 80);
    force();
    later(() => {
      S.i++;
      if (S.i >= ROUNDS) {
        S.phase = 'over';
        S.winner = S.score[1] > S.score[2] ? 1 : S.score[2] > S.score[1] ? 2 : 0;
      } else {
        S.phase = 'show';
      }
      force();
    }, 1000);
  };

  const r = S.rounds[S.i];

  const card = () =>
    r && (
      <View style={st.cardBox}>
        {r.reverse && <Text style={st.reverse}>🔄 반전! 반대로 답해!</Text>}
        <Text style={[st.word, { color: r.ink.hex }]}>{r.word.name}</Text>
        <Text style={st.q}>글자의 "뜻"과 "색"이 같다?</Text>
      </View>
    );

  const half = (p) => (
    <View style={[st.half, p === 2 && st.flip, { backgroundColor: p === 1 ? '#131a2e' : '#251523' }]}>
      <View style={st.head}>
        <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p}</Text>
        <Text style={st.scoreTxt}>{S.score[p]}점 · {S.i + 1}/{ROUNDS}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {S.phase === 'show' ? card() : <Text style={st.note}>{S.note}</Text>}
      </View>
      <View style={st.btnRow}>
        <TouchableOpacity style={[st.oxBtn, { backgroundColor: '#1b3320' }]} onPress={() => answer(p, true)}>
          <Text style={st.oxTxt}>⭕ 같다</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.oxBtn, { backgroundColor: '#33261a' }]} onPress={() => answer(p, false)}>
          <Text style={st.oxTxt}>❌ 다르다</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Screen>
      {half(2)}
      <View style={st.mid} />
      {half(1)}
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🎨 컬러 클래시</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>
              {S.winner === 0 ? `무승부! ${S.score[1]}:${S.score[2]}` : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! ${S.score[1]}:${S.score[2]} 🏆`}
            </Text>
          )}
          <Text style={st.ovDesc}>
            "파랑"이라는 글자가 빨간색이면 → ❌다르다{'\n'}먼저 누른 사람 판정! 맞으면 +1, 틀리면 상대 +1{'\n'}🔄 반전 라운드는 반대로 답하기 — 총 {ROUNDS}라운드
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  half: { flex: 1, padding: 12 },
  flip: { transform: [{ rotate: '180deg' }] },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontWeight: '900', fontSize: 16 },
  scoreTxt: { color: C.gold, fontWeight: '800', fontSize: 14 },
  cardBox: { alignItems: 'center' },
  reverse: { color: C.gold, fontWeight: '900', fontSize: 16, marginBottom: 6 },
  word: { fontSize: 54, fontWeight: '900' },
  q: { color: C.sub, fontSize: 13, marginTop: 8 },
  note: { color: C.text, fontSize: 18, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 10 },
  oxBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  oxTxt: { color: C.text, fontSize: 18, fontWeight: '900' },
  mid: { height: 8, backgroundColor: C.card },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ovTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  ovWin: { color: C.gold, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
