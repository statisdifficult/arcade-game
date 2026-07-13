// 🏃 연타 레이스 — 연타로 달리기! 🔴 빨간불에 누르면 미끄러진다 (전원 같은 신호등).
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, useForce } from './common';

const GOAL = 60;
const TIME = 45;

function makeLights(seed) {
  const rng = mulberry32(seed);
  const evs = [];
  let t = 0;
  let red = false;
  while (t < TIME * 1000 + 5000) {
    const dur = red ? 700 + rng() * 900 : 1800 + rng() * 2000;
    evs.push({ from: t, to: t + dur, red });
    t += dur;
    red = !red;
  }
  return evs;
}

export default function TapRace({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count', // count | play | results
    lights: makeLights(seed),
    t0: 0,
    left: TIME,
    prog: Object.fromEntries(players.map((p) => [p.id, 0])),
    finOrder: [],
    lastSend: 0,
    slip: 0, // 미끄러짐 연출용
    rows: [],
  }).current;
  const loop = useRef(null);

  const isRed = () => {
    const el = Date.now() - S.t0;
    const ev = S.lights.find((e) => el >= e.from && el < e.to);
    return ev ? ev.red : false;
  };

  const buildResults = () => {
    clearInterval(loop.current);
    const rows = [...players]
      .map((p) => ({ p, fin: S.finOrder.indexOf(p.id), v: S.prog[p.id] ?? 0 }))
      .sort((a, b) => {
        if (a.fin >= 0 && b.fin >= 0) return a.fin - b.fin;
        if (a.fin >= 0) return -1;
        if (b.fin >= 0) return 1;
        return b.v - a.v;
      })
      .map(({ p, fin, v }) => ({
        id: p.id,
        name: p.name,
        text: fin >= 0 ? '완주! 🏁' : `${v}/${GOAL}`,
      }));
    S.rows = rows;
    S.phase = 'results';
    force();
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'prog') S.prog[m.from] = d.v;
      if (d.a === 'fin') {
        S.prog[m.from] = GOAL;
        if (!S.finOrder.includes(m.from)) S.finOrder.push(m.from);
        if (S.phase === 'play') buildResults();
      }
      force();
    });
    return () => { off(); clearInterval(loop.current); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    loop.current = setInterval(() => {
      S.left = TIME - (Date.now() - S.t0) / 1000;
      if (S.left <= 0 && S.phase === 'play') buildResults();
      force();
    }, 100);
    force();
  };

  const tap = () => {
    if (S.phase !== 'play') return;
    if (isRed()) {
      S.prog[me] = Math.max(0, (S.prog[me] ?? 0) - 5);
      S.slip = Date.now();
      vib(120);
    } else {
      S.prog[me] = (S.prog[me] ?? 0) + 1;
      if (S.prog[me] >= GOAL) {
        S.finOrder.push(me);
        net.msg({ a: 'fin' });
        buildResults();
        return;
      }
    }
    const now = Date.now();
    if (now - S.lastSend > 150) {
      S.lastSend = now;
      net.msg({ a: 'prog', v: S.prog[me] });
    }
    force();
  };

  const red = S.phase === 'play' && isRed();
  const slipping = Date.now() - S.slip < 600;

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="🏃 연타 레이스 결과" rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={[st.light, { color: red ? C.danger : C.green }]}>{red ? '🔴 멈춰!!' : '🟢 달려!!'}</Text>
            <Text style={st.time}>{Math.max(0, Math.ceil(S.left))}s</Text>
          </View>
          <View style={st.track}>
            {players.map((p) => {
              const v = Math.min(GOAL, S.prog[p.id] ?? 0);
              return (
                <View key={p.id} style={st.laneRow}>
                  <Text style={[st.laneName, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                    {p.name}{p.id === me ? ' (나)' : ''}
                  </Text>
                  <View style={st.laneBar}>
                    <View style={[st.laneFill, { width: `${(v / GOAL) * 100}%`, backgroundColor: colorOf(players, p.id) }]} />
                    <Text style={[st.runner, { left: `${(v / GOAL) * 92}%` }]}>🏃</Text>
                  </View>
                  <Text style={st.laneGoal}>🏁</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity
            style={[st.tapBtn, red && { borderColor: C.danger, backgroundColor: '#2a1420' }]}
            activeOpacity={0.85}
            onPress={tap}
          >
            <Text style={{ fontSize: 44 }}>{slipping ? '🫠' : '👟'}</Text>
            <Text style={st.tapHint}>{slipping ? '미끄러졌다!! -5' : red ? '누르면 미끄러진다!' : '연타!!!'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  light: { fontSize: 24, fontWeight: '900' },
  time: { color: C.gold, fontSize: 22, fontWeight: '900' },
  track: { paddingHorizontal: 14 },
  laneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  laneName: { width: 74, fontSize: 12, fontWeight: '800' },
  laneBar: { flex: 1, height: 26, backgroundColor: C.card, borderRadius: 13, overflow: 'hidden' },
  laneFill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.35 },
  runner: { position: 'absolute', top: 1, fontSize: 18 },
  laneGoal: { fontSize: 16, marginLeft: 6 },
  tapBtn: {
    flex: 1,
    margin: 16,
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: { color: C.sub, fontSize: 15, fontWeight: '800', marginTop: 6 },
});
