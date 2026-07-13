// 🟡 점 먹기 아레나 — 드래그로 움직여 점 쟁탈전. 동시에 먹으면 서버가 선착순 판정.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, nameOf, useForce } from './common';

const TIME = 45;
const DOT_N = 14;
const EAT_R = 0.06;

export default function DotsArena({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef(null);
  if (!S.current) {
    const rng = mulberry32(seed);
    const dots = new Map();
    for (let i = 0; i < DOT_N; i++) dots.set(i, { x: 0.06 + rng() * 0.88, y: 0.06 + rng() * 0.88 });
    S.current = {
      phase: 'count',
      rng,
      dots,
      nextId: DOT_N,
      t0: 0,
      left: TIME,
      pos: Object.fromEntries(players.map((p, i) => [p.id, { x: (i + 1) / (players.length + 1), y: 0.5 }])),
      score: Object.fromEntries(players.map((p) => [p.id, 0])),
      pending: new Set(),
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    G.rows = [...players]
      .map((p) => ({ p, v: G.score[p.id] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .map(({ p, v }) => ({ id: p.id, name: p.name, text: `${v}개` }));
    G.phase = 'results';
    force();
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'eaten') { // 서버 판정 확정 — 전원 같은 순서로 받아서 같은 판이 유지된다
        if (G.dots.has(d.id)) {
          G.dots.delete(d.id);
          G.score[m.from] = (G.score[m.from] ?? 0) + 1;
          G.dots.set(G.nextId++, { x: 0.06 + G.rng() * 0.88, y: 0.06 + G.rng() * 0.88 });
          if (m.from === me) vib(15);
        }
        G.pending.delete(d.id);
      }
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); };
  }, []);

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    loop.current = setInterval(() => {
      G.left = TIME - (Date.now() - G.t0) / 1000;
      if (G.left <= 0 && G.phase === 'play') return buildResults();
      // 내 아바타 근처의 점 → 서버에 먹기 요청 (판정은 서버가)
      const my = G.pos[me];
      for (const [id, dot] of G.dots) {
        if (G.pending.has(id)) continue;
        if (Math.hypot(my.x - dot.x, my.y - dot.y) < EAT_R) {
          G.pending.add(id);
          net.msg({ a: 'eat', id });
        }
      }
      force();
    }, 66);
    sender.current = setInterval(() => {
      const my = G.pos[me];
      net.msg({ a: 'p', x: my.x, y: my.y });
    }, 100);
    force();
  };

  const move = (e) => {
    if (G.phase !== 'play') return;
    const { locationX, locationY } = e.nativeEvent;
    if (!G.aw || !G.ah) return;
    G.pos[me] = {
      x: Math.min(0.97, Math.max(0.03, locationX / G.aw)),
      y: Math.min(0.97, Math.max(0.03, locationY / G.ah)),
    };
    force();
  };

  const standings = [...players].sort((a, b) => (G.score[b.id] ?? 0) - (G.score[a.id] ?? 0));

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="🟡 점 먹기 결과" note="동시 획득은 서버가 선착순 판정" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={st.time}>{Math.max(0, Math.ceil(G.left))}s</Text>
            <View style={st.scores}>
              {standings.map((p) => (
                <Text key={p.id} style={[st.scoreTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {G.score[p.id] ?? 0}
                </Text>
              ))}
            </View>
          </View>
          <View
            style={st.arena}
            onLayout={(e) => { G.aw = e.nativeEvent.layout.width; G.ah = e.nativeEvent.layout.height; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={move}
            onResponderMove={move}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {[...G.dots.entries()].map(([id, d]) => (
                <Text key={id} style={[st.dot, { left: `${d.x * 100}%`, top: `${d.y * 100}%` }]}>🟡</Text>
              ))}
              {players.map((p) => {
                const pos = G.pos[p.id];
                return (
                  <View key={p.id} style={[st.avatarBox, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]}>
                    <View style={[st.avatar, { backgroundColor: colorOf(players, p.id) }, p.id === me && st.avatarMe]} />
                    <Text style={st.avatarName} numberOfLines={1}>{p.id === me ? '나' : p.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={st.hint}>화면을 드래그해서 이동 — 🟡에 닿으면 먹는다!</Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  time: { color: C.gold, fontWeight: '900', fontSize: 20 },
  scores: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  scoreTxt: { fontSize: 12, fontWeight: '800' },
  arena: { flex: 1, margin: 10, marginTop: 2, backgroundColor: '#141a30', borderRadius: 18, overflow: 'hidden' },
  dot: { position: 'absolute', fontSize: 18, marginLeft: -9, marginTop: -9 },
  avatarBox: { position: 'absolute', alignItems: 'center', marginLeft: -16, marginTop: -16, width: 32 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  avatarMe: { borderWidth: 3, borderColor: '#fff' },
  avatarName: { color: C.sub, fontSize: 9, fontWeight: '700', marginTop: 1 },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
