// 🧟 좀비 감염전 — 물리면 좀비팀 합류! 인간이 40초 버티면 인간 승.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, nameOf, useForce } from './common';

const TIME = 40;
const BITE_R = 0.07;

export default function ZombieInfect({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef(null);
  if (!S.current) {
    const zero = players[Math.floor(mulberry32(seed)() * players.length)].id;
    S.current = {
      phase: 'count',
      zero,
      infectedAt: { [zero]: 0 }, // id → 감염 시각(ms). 없으면 인간
      t0: 0,
      left: TIME,
      pos: Object.fromEntries(players.map((p, i) => [p.id, { x: (i + 1) / (players.length + 1), y: 0.5 }])),
      lastBite: 0,
      humanWin: null,
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);
  const timers = useRef([]).current;

  const isZombie = (id) => G.infectedAt[id] !== undefined;
  const humans = () => players.filter((p) => !isZombie(p.id));

  const buildResults = (humanWin) => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    G.humanWin = humanWin;
    G.rows = [...players]
      .map((p) => ({ p, v: G.infectedAt[p.id] }))
      .sort((a, b) => { // 생존자 → 늦게 감염된 순 → 최초 감염원
        const av = a.v === undefined ? Infinity : a.v;
        const bv = b.v === undefined ? Infinity : b.v;
        return bv - av;
      })
      .map(({ p, v }) => ({
        id: p.id,
        name: p.name,
        text:
          v === undefined
            ? '생존! 🏆'
            : p.id === G.zero
            ? '최초 감염원 🧟'
            : `${(v / 1000).toFixed(1)}초에 감염`,
      }));
    G.phase = 'results';
    force();
  };

  const applyBite = (target) => {
    if (isZombie(target)) return;
    G.infectedAt[target] = Date.now() - G.t0;
    if (target === me) vib(200);
    if (humans().length === 0 && G.phase === 'play') {
      G.phase = 'ending';
      timers.push(setTimeout(() => buildResults(false), 800));
    }
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'bite') applyBite(d.target);
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    loop.current = setInterval(() => {
      G.left = TIME - (Date.now() - G.t0) / 1000;
      if (G.left <= 0 && G.phase === 'play') return buildResults(true);
      // 내가 좀비면 물기 판정
      if (isZombie(me) && Date.now() - G.lastBite > 400 && G.phase === 'play') {
        const my = G.pos[me];
        for (const p of humans()) {
          const o = G.pos[p.id];
          if (Math.hypot(my.x - o.x, my.y - o.y) < BITE_R) {
            G.lastBite = Date.now();
            net.msg({ a: 'bite', target: p.id });
            applyBite(p.id);
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
    if (G.phase !== 'play' && G.phase !== 'ending') return;
    const { locationX, locationY } = e.nativeEvent;
    if (!G.aw || !G.ah) return;
    G.pos[me] = {
      x: Math.min(0.97, Math.max(0.03, locationX / G.aw)),
      y: Math.min(0.97, Math.max(0.03, locationY / G.ah)),
    };
    force();
  };

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results
          title="🧟 좀비 감염전 결과"
          note={G.humanWin ? '인간 팀이 버텨냈다! 🎉' : '전원 감염... 좀비 승리 🧟'}
          rows={G.rows}
          me={me}
          exit={exit}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={[st.roleTxt, { color: isZombie(me) ? C.green : C.text }]}>
              {isZombie(me) ? '🧟 나는 좀비! 물어라!!' : '🏃 인간 — 도망쳐!!'}
            </Text>
            <Text style={st.time}>{Math.max(0, Math.ceil(G.left))}s</Text>
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
              {players.map((p) => {
                const pos = G.pos[p.id];
                const z = isZombie(p.id);
                return (
                  <View key={p.id} style={[st.avatarBox, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]}>
                    <Text style={{ fontSize: 22 }}>{z ? '🧟' : '🏃'}</Text>
                    <Text
                      style={[st.avatarName, { color: p.id === me ? C.gold : colorOf(players, p.id) }]}
                      numberOfLines={1}
                    >
                      {p.id === me ? '나' : p.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={st.hint}>
            드래그로 이동 · 인간 {humans().length}명 남음 — {TIME}초 버티면 인간 승!
          </Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  roleTxt: { flex: 1, fontWeight: '900', fontSize: 15 },
  time: { color: C.gold, fontWeight: '900', fontSize: 20 },
  arena: { flex: 1, margin: 10, marginTop: 2, backgroundColor: '#12201a', borderRadius: 18, overflow: 'hidden' },
  avatarBox: { position: 'absolute', alignItems: 'center', marginLeft: -16, marginTop: -16, width: 32 },
  avatarName: { fontSize: 9, fontWeight: '700', marginTop: 0 },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
