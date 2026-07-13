// ⚡ 번개 반응 대결 — 진짜 신호(⚡)에만 반응, 가짜 신호(🎣)에 낚이면 상대 득점. 먼저 5점.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const WIN = 5;

export default function ReactionDuel({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | wait | signal | resolved | over
    fake: false,
    score: { 1: 0, 2: 0 },
    note: '',
    winner: 0,
  }).current;
  const timers = useRef([]).current;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  useEffect(() => () => timers.forEach(clearTimeout), []);

  const start = () => {
    S.score = { 1: 0, 2: 0 };
    S.winner = 0;
    nextRound();
  };

  const nextRound = () => {
    S.phase = 'wait';
    S.note = '';
    force();
    later(() => {
      if (S.phase !== 'wait') return;
      S.fake = Math.random() < 0.35;
      S.phase = 'signal';
      force();
      if (S.fake) {
        const myRound = S.score[1] + S.score[2];
        later(() => {
          if (S.phase === 'signal' && S.fake && S.score[1] + S.score[2] === myRound) {
            resolve(0, '둘 다 안 낚였다! 🧘');
          }
        }, 1500);
      }
    }, 1200 + Math.random() * 2800);
  };

  const resolve = (scorer, note) => {
    S.phase = 'resolved';
    S.note = note;
    if (scorer) S.score[scorer]++;
    if (scorer && S.score[scorer] >= WIN) {
      S.phase = 'over';
      S.winner = scorer;
      force();
      return;
    }
    force();
    later(nextRound, 1300);
  };

  const tap = (p) => {
    const o = p === 1 ? 2 : 1;
    if (S.phase === 'wait') {
      vib(80);
      resolve(o, `P${p} 성급했다! 😵 신호 전에 탭`);
    } else if (S.phase === 'signal') {
      vib(30);
      if (S.fake) resolve(o, `P${p} 낚였다!! 🎣`);
      else resolve(p, `P${p} 번개 캐치! ⚡`);
    }
  };

  const half = (p) => {
    const mine = S.winner === p;
    let body = null;
    if (S.phase === 'ready') body = <Text style={st.hint}>준비...</Text>;
    else if (S.phase === 'wait') body = <Text style={st.dots}>· · ·</Text>;
    else if (S.phase === 'signal')
      body = <Text style={st.signal}>{S.fake ? '🎣' : '⚡'}</Text>;
    else if (S.phase === 'resolved') body = <Text style={st.note}>{S.note}</Text>;
    else if (S.phase === 'over')
      body = <Text style={st.note}>{mine ? '🏆 승리!' : '패배...'}</Text>;
    const bg =
      S.phase === 'signal' ? (S.fake ? '#33261a' : '#1b3320') : p === 1 ? '#131a2e' : '#251523';
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[st.half, { backgroundColor: bg }, p === 2 && st.flip]}
        onPress={() => tap(p)}
      >
        <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p}</Text>
        {body}
        <Text style={st.score}>{S.score[p]} / {WIN}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      {half(2)}
      <View style={st.mid}>
        <Text style={st.midText}>⚡ 잡기 · 🎣 무시</Text>
      </View>
      {half(1)}
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>⚡ 번개 반응 대결</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>{S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! 🏆</Text>
          )}
          <Text style={st.ovDesc}>
            ⚡가 뜨면 최대한 빨리 탭!{'\n'}🎣 가짜 신호를 누르면 상대 득점{'\n'}신호 전에 눌러도 상대 득점 — 먼저 {WIN}점
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ rotate: '180deg' }] },
  label: { position: 'absolute', top: 14, left: 16, fontWeight: '900', fontSize: 16 },
  score: { position: 'absolute', top: 14, right: 16, color: C.sub, fontWeight: '800', fontSize: 16 },
  hint: { color: C.sub, fontSize: 18 },
  dots: { color: C.sub, fontSize: 44, fontWeight: '900' },
  signal: { fontSize: 96 },
  note: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  mid: { height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  midText: { color: C.sub, fontSize: 12, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ovTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  ovWin: { color: C.gold, fontSize: 22, fontWeight: '900', marginBottom: 12 },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
