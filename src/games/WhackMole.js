// 🔨 두더지 잡기 대전 — 🐹+1 ⭐+3 💣-2. 양쪽 다 똑같은 순서로 나오니 순수 손속 대결. 30초.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const TIME = 30;
const TYPES = {
  mole: { emoji: '🐹', val: 1, life: 900 },
  star: { emoji: '⭐', val: 3, life: 650 },
  bomb: { emoji: '💣', val: -2, life: 1400 },
};

// 30초치 등장 스케줄을 미리 뽑아 양쪽에 동일하게 적용 (공평!)
function makeSchedule() {
  const ev = [];
  let t = 800;
  while (t < TIME * 1000 - 700) {
    const r = Math.random();
    const type = r < 0.68 ? 'mole' : r < 0.85 ? 'star' : 'bomb';
    ev.push({ t, hole: Math.floor(Math.random() * 9), type });
    t += 380 + Math.random() * 420;
  }
  return ev;
}

export default function WhackMole({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | play | over
    sched: [],
    nextEv: 0,
    t0: 0,
    left: TIME,
    p: { 1: { cells: [], score: 0 }, 2: { cells: [], score: 0 } },
    winner: 0,
  }).current;
  const loop = useRef(null);
  useEffect(() => () => clearInterval(loop.current), []);

  const start = () => {
    S.sched = makeSchedule();
    S.nextEv = 0;
    S.t0 = Date.now();
    S.left = TIME;
    S.p = { 1: { cells: new Array(9).fill(null), score: 0 }, 2: { cells: new Array(9).fill(null), score: 0 } };
    S.winner = 0;
    S.phase = 'play';
    force();
    clearInterval(loop.current);
    loop.current = setInterval(() => {
      const el = Date.now() - S.t0;
      S.left = TIME - el / 1000;
      while (S.nextEv < S.sched.length && S.sched[S.nextEv].t <= el) {
        const e = S.sched[S.nextEv++];
        for (const p of [1, 2]) {
          S.p[p].cells[e.hole] = { type: e.type, until: el + TYPES[e.type].life };
        }
      }
      for (const p of [1, 2]) {
        S.p[p].cells = S.p[p].cells.map((c) => (c && c.until <= el ? null : c));
      }
      if (S.left <= 0) {
        clearInterval(loop.current);
        S.phase = 'over';
        S.winner =
          S.p[1].score > S.p[2].score ? 1 : S.p[2].score > S.p[1].score ? 2 : 0;
      }
      force();
    }, 50);
  };

  const tap = (p, i) => {
    if (S.phase !== 'play') return;
    const c = S.p[p].cells[i];
    if (!c) return;
    S.p[p].score += TYPES[c.type].val;
    S.p[p].cells[i] = null;
    vib(c.type === 'bomb' ? 90 : 18);
    force();
  };

  const half = (p) => (
    <View style={[st.half, p === 2 && st.flip, { backgroundColor: p === 1 ? '#131a2e' : '#251523' }]}>
      <View style={st.head}>
        <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p}</Text>
        <Text style={st.scoreTxt}>{S.p[p].score}점</Text>
        <Text style={st.time}>{Math.max(0, Math.ceil(S.left))}s</Text>
      </View>
      <View style={st.grid}>
        {S.p[p].cells.map((c, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8} style={st.hole} onPress={() => tap(p, i)}>
            <Text style={st.entity}>{c ? TYPES[c.type].emoji : ''}</Text>
          </TouchableOpacity>
        ))}
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
          <Text style={st.ovTitle}>🔨 두더지 잡기 대전</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>
              {S.winner === 0
                ? `무승부! ${S.p[1].score}:${S.p[2].score}`
                : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! ${S.p[1].score}:${S.p[2].score} 🏆`}
            </Text>
          )}
          <Text style={st.ovDesc}>
            🐹 +1점 · ⭐ +3점 · 💣 −2점{'\n'}둘 다 완전히 똑같은 순서로 나온다 — 순수 손속 대결!{'\n'}{TIME}초 동안 다득점
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
  scoreTxt: { color: C.gold, fontWeight: '900', fontSize: 16 },
  time: { color: C.sub, fontWeight: '800', fontSize: 16 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  hole: {
    width: '33.33%',
    height: '33.33%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  entity: {
    fontSize: 34,
    backgroundColor: C.card,
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    lineHeight: 62,
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
  ovWin: { color: C.gold, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
