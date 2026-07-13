// 🔢 숫자 폭풍 — 1~12를 순서대로. 누를 때마다 남은 숫자들이 자리를 바꿔 도망다닌다.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const N = 12;
const SLOTS = 12; // 4x3

function scatter(numbers) {
  // 남은 숫자들을 12칸 중 랜덤 칸에 배치
  const slots = new Array(SLOTS).fill(null);
  const idx = [...Array(SLOTS).keys()];
  for (const n of numbers) {
    const k = idx.splice(Math.floor(Math.random() * idx.length), 1)[0];
    slots[k] = n;
  }
  return slots;
}

export default function NumberStorm({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | play | over
    winner: 0,
    p: {
      1: { next: 1, slots: [], wrong: -1 },
      2: { next: 1, slots: [], wrong: -1 },
    },
  }).current;
  const timers = useRef([]).current;
  useEffect(() => () => timers.forEach(clearTimeout), []);

  const start = () => {
    const nums = [...Array(N).keys()].map((i) => i + 1);
    S.p = {
      1: { next: 1, slots: scatter(nums), wrong: -1 },
      2: { next: 1, slots: scatter(nums), wrong: -1 },
    };
    S.winner = 0;
    S.phase = 'play';
    force();
  };

  const tap = (p, slotIdx) => {
    if (S.phase !== 'play') return;
    const me = S.p[p];
    const n = me.slots[slotIdx];
    if (n == null) return;
    if (n === me.next) {
      vib(15);
      me.next++;
      const remaining = me.slots.filter((x) => x != null && x !== n);
      if (me.next > N) {
        S.phase = 'over';
        S.winner = p;
        vib(200);
      } else {
        me.slots = scatter(remaining); // 숫자들이 도망간다!
      }
    } else {
      vib(60);
      me.wrong = slotIdx;
      timers.push(setTimeout(() => { me.wrong = -1; force(); }, 250));
    }
    force();
  };

  const board = (p) => {
    const me = S.p[p];
    return (
      <View style={[st.half, p === 2 && st.flip, { backgroundColor: p === 1 ? '#131a2e' : '#251523' }]}>
        <View style={st.head}>
          <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p}</Text>
          <Text style={st.next}>다음: {me.next > N ? '완료!' : me.next}</Text>
        </View>
        <View style={st.grid}>
          {me.slots.map((n, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              style={[st.cell, me.wrong === i && st.cellWrong, n == null && st.cellEmpty]}
              onPress={() => tap(p, i)}
            >
              <Text style={st.num}>{n ?? ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      {S.phase !== 'ready' ? board(2) : <View style={[st.half, { backgroundColor: '#251523' }]} />}
      <View style={st.mid} />
      {S.phase !== 'ready' ? board(1) : <View style={[st.half, { backgroundColor: '#131a2e' }]} />}
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🔢 숫자 폭풍</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>{S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! 🏆</Text>
          )}
          <Text style={st.ovDesc}>
            1부터 12까지 순서대로 탭!{'\n'}맞출 때마다 남은 숫자들이 자리를 바꿔 도망감{'\n'}먼저 12까지 끝내면 승리
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  half: { flex: 1, padding: 10 },
  flip: { transform: [{ rotate: '180deg' }] },
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 6 },
  label: { fontWeight: '900', fontSize: 16 },
  next: { color: C.gold, fontWeight: '900', fontSize: 16 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '25%',
    height: '33.33%',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWrong: { backgroundColor: 'rgba(255,93,115,0.35)', borderRadius: 12 },
  cellEmpty: { opacity: 0.25 },
  num: {
    color: C.text,
    fontSize: 26,
    fontWeight: '900',
    backgroundColor: C.card,
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mid: { height: 8, backgroundColor: C.card },
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
