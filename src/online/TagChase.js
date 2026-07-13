// 👹 술래잡기 — 잡히면 술래를 넘긴다. 60초 뒤 술래 시간이 가장 긴 사람이 벌칙!
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, nameOf, useForce } from './common';

const TIME = 60;
const TAG_R = 0.075;
const TAG_COOLDOWN = 1200;

export default function TagChase({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      phase: 'count',
      it: players[Math.floor(mulberry32(seed)() * players.length)].id,
      itStart: 0,
      itTime: Object.fromEntries(players.map((p) => [p.id, 0])),
      lastTag: 0,
      t0: 0,
      left: TIME,
      pos: Object.fromEntries(players.map((p, i) => [p.id, { x: (i + 1) / (players.length + 1), y: 0.5 }])),
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);

  const applyTag = (target) => {
    const now = Date.now();
    G.itTime[G.it] = (G.itTime[G.it] ?? 0) + (now - G.itStart);
    G.it = target;
    G.itStart = now;
    G.lastTag = now;
    if (target === me) vib(150);
  };

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    G.itTime[G.it] = (G.itTime[G.it] ?? 0) + (Date.now() - G.itStart);
    G.rows = [...players]
      .map((p) => ({ p, v: G.itTime[p.id] ?? 0 }))
      .sort((a, b) => a.v - b.v)
      .map(({ p, v }, i, arr) => ({
        id: p.id,
        name: p.name,
        text: `술래 ${(v / 1000).toFixed(1)}초${i === arr.length - 1 && v > 0 ? ' → 벌칙! 🍺' : ''}`,
      }));
    G.phase = 'results';
    force();
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'tag') applyTag(d.target);
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); };
  }, []);

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    G.itStart = Date.now();
    G.lastTag = Date.now();
    loop.current = setInterval(() => {
      G.left = TIME - (Date.now() - G.t0) / 1000;
      if (G.left <= 0 && G.phase === 'play') return buildResults();
      // 내가 술래일 때만 잡기 판정 → 잡으면 전원에게 알림
      if (G.it === me && Date.now() - G.lastTag > TAG_COOLDOWN) {
        const my = G.pos[me];
        for (const p of players) {
          if (p.id === me) continue;
          const o = G.pos[p.id];
          if (Math.hypot(my.x - o.x, my.y - o.y) < TAG_R) {
            net.msg({ a: 'tag', target: p.id });
            applyTag(p.id);
            break;
          }
        }
      }
      force();
    }, 80);
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

  const myItTime = ((G.itTime[me] ?? 0) + (G.it === me && G.phase === 'play' ? Date.now() - G.itStart : 0)) / 1000;

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="👹 술래잡기 결과" note="술래 시간이 짧을수록 위 — 꼴찌는 벌칙!" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={[st.itTxt, { color: G.it === me ? C.danger : C.text }]} numberOfLines={1}>
              {G.it === me ? '👹 내가 술래다! 잡아라!!' : `👹 술래: ${nameOf(players, G.it)} — 도망쳐!!`}
            </Text>
            <Text style={st.time}>{Math.max(0, Math.ceil(G.left))}s</Text>
          </View>
          <View
            style={[st.arena, G.it === me && { borderColor: C.danger, borderWidth: 2 }]}
            onLayout={(e) => { G.aw = e.nativeEvent.layout.width; G.ah = e.nativeEvent.layout.height; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={move}
            onResponderMove={move}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {players.map((p) => {
                const pos = G.pos[p.id];
                const isIt = G.it === p.id;
                return (
                  <View key={p.id} style={[st.avatarBox, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]}>
                    {isIt && <Text style={st.itMark}>👹</Text>}
                    <View
                      style={[
                        st.avatar,
                        { backgroundColor: colorOf(players, p.id) },
                        p.id === me && st.avatarMe,
                        isIt && { borderWidth: 3, borderColor: C.danger },
                      ]}
                    />
                    <Text style={st.avatarName} numberOfLines={1}>{p.id === me ? '나' : p.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={st.hint}>드래그로 이동 · 내 술래 시간 {myItTime.toFixed(1)}초</Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  itTxt: { flex: 1, fontWeight: '900', fontSize: 15 },
  time: { color: C.gold, fontWeight: '900', fontSize: 20 },
  arena: { flex: 1, margin: 10, marginTop: 2, backgroundColor: '#141a30', borderRadius: 18, overflow: 'hidden' },
  avatarBox: { position: 'absolute', alignItems: 'center', marginLeft: -16, marginTop: -22, width: 32 },
  itMark: { fontSize: 14, marginBottom: -2 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  avatarMe: { borderWidth: 3, borderColor: '#fff' },
  avatarName: { color: C.sub, fontSize: 9, fontWeight: '700', marginTop: 1 },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
