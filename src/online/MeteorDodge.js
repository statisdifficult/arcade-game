// ☄️ 운석 피하기 — 시드 동기화 운석 소나기(전원 같은 궤적). 최후의 1인 생존전!
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, useForce } from './common';

const LIMIT = 60000;
const MY_R = 0.03;

// 시드로 60초치 운석 궤적을 전부 미리 뽑는다 — 전원 완전히 같은 소나기
function makeMeteors(seed) {
  const rng = mulberry32(seed);
  const ms = [];
  let t = 800;
  while (t < LIMIT) {
    ms.push({
      t,
      x: rng(),
      r: 0.028 + rng() * 0.034,
      vy: 0.00022 + rng() * 0.00018 + (t / LIMIT) * 0.0002, // 갈수록 빨라진다
    });
    const gap = Math.max(140, 550 - (t / LIMIT) * 420);
    t += gap * (0.6 + rng() * 0.8);
  }
  return ms;
}

export default function MeteorDodge({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      phase: 'count',
      meteors: makeMeteors(seed),
      t0: 0,
      el: 0,
      pos: Object.fromEntries(players.map((p, i) => [p.id, { x: (i + 1) / (players.length + 1), y: 0.82 }])),
      dead: {}, // id → 생존시간(ms)
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);
  const timers = useRef([]).current;

  const aliveIds = () => players.map((p) => p.id).filter((id) => G.dead[id] === undefined);

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    G.rows = [...players]
      .map((p) => ({ p, v: G.dead[p.id] ?? Infinity }))
      .sort((a, b) => b.v - a.v)
      .map(({ p, v }) => ({
        id: p.id,
        name: p.name,
        text: v === Infinity ? '생존! 🏆' : `${(v / 1000).toFixed(1)}초 생존`,
      }));
    G.phase = 'results';
    force();
  };

  const maybeEnd = () => {
    if (G.phase === 'play' && (aliveIds().length <= (players.length > 1 ? 1 : 0) || G.el >= LIMIT)) {
      timers.push(setTimeout(buildResults, 800));
      G.phase = 'ending';
    }
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'dead') { G.dead[m.from] = d.v; maybeEnd(); }
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); timers.forEach(clearTimeout); };
  }, []);

  const activeMeteors = () => {
    const out = [];
    for (const m of G.meteors) {
      if (m.t > G.el) break;
      const y = -0.08 + (G.el - m.t) * m.vy;
      if (y < 1.12) out.push({ ...m, y });
    }
    return out;
  };

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    loop.current = setInterval(() => {
      G.el = Date.now() - G.t0;
      if (G.dead[me] === undefined && (G.phase === 'play' || G.phase === 'ending')) {
        const my = G.pos[me];
        for (const m of activeMeteors()) {
          if (Math.hypot(my.x - m.x, my.y - m.y) < m.r + MY_R) {
            G.dead[me] = G.el;
            net.msg({ a: 'dead', v: G.el });
            vib(200);
            maybeEnd();
            break;
          }
        }
      }
      if (G.el >= LIMIT) maybeEnd();
      force();
    }, 33);
    sender.current = setInterval(() => {
      if (G.dead[me] !== undefined) return;
      const my = G.pos[me];
      net.msg({ a: 'p', x: my.x, y: my.y });
    }, 100);
    force();
  };

  const move = (e) => {
    if (G.dead[me] !== undefined) return;
    const { locationX, locationY } = e.nativeEvent;
    if (!G.aw || !G.ah) return;
    G.pos[me] = {
      x: Math.min(0.97, Math.max(0.03, locationX / G.aw)),
      y: Math.min(0.97, Math.max(0.03, locationY / G.ah)),
    };
    force();
  };

  const alive = aliveIds().length;

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="☄️ 운석 피하기 결과" note="오래 버틸수록 위!" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={st.time}>{(Math.max(0, G.el) / 1000).toFixed(1)}s</Text>
            <Text style={st.aliveTxt}>
              {G.dead[me] !== undefined ? '💀 관전 중' : '생존 중!'} · 남은 인원 {alive}
            </Text>
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
              {(G.phase === 'play' || G.phase === 'ending') &&
                activeMeteors().map((m, i) => (
                  <Text
                    key={i}
                    style={[st.meteor, { left: `${m.x * 100}%`, top: `${m.y * 100}%`, fontSize: 700 * m.r }]}
                  >
                    ☄️
                  </Text>
                ))}
              {players.map((p) => {
                const pos = G.pos[p.id];
                const dead = G.dead[p.id] !== undefined;
                return (
                  <View key={p.id} style={[st.avatarBox, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]}>
                    {dead ? (
                      <Text style={{ fontSize: 20 }}>💀</Text>
                    ) : (
                      <View style={[st.avatar, { backgroundColor: colorOf(players, p.id) }, p.id === me && st.avatarMe]} />
                    )}
                    <Text style={st.avatarName} numberOfLines={1}>{p.id === me ? '나' : p.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={st.hint}>드래그로 피해라! 갈수록 소나기가 거세진다 ☄️</Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  time: { color: C.gold, fontWeight: '900', fontSize: 20 },
  aliveTxt: { color: C.sub, fontWeight: '800', fontSize: 13, alignSelf: 'center' },
  arena: { flex: 1, margin: 10, marginTop: 2, backgroundColor: '#10142a', borderRadius: 18, overflow: 'hidden' },
  meteor: { position: 'absolute', marginLeft: -12, marginTop: -12 },
  avatarBox: { position: 'absolute', alignItems: 'center', marginLeft: -16, marginTop: -13, width: 32 },
  avatar: { width: 22, height: 22, borderRadius: 11 },
  avatarMe: { borderWidth: 3, borderColor: '#fff' },
  avatarName: { color: C.sub, fontSize: 9, fontWeight: '700', marginTop: 1 },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
