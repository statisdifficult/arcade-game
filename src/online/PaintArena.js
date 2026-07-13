// 🎨 페인트 아레나 — 지나간 자리를 내 색으로! 마지막 8초는 🔥피버(십자 칠하기). 서버가 순서 판정.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { Countdown, Results, colorOf, useForce } from './common';

const COLS = 12;
const ROWS = 18;
const TIME = 40;
const FEVER = 8; // 마지막 8초

export default function PaintArena({ net, me, players, exit }) {
  const force = useForce();
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      phase: 'count',
      grid: new Array(COLS * ROWS).fill(0), // 0 = 안 칠함, 그 외 = playerId
      t0: 0,
      left: TIME,
      pos: Object.fromEntries(players.map((p, i) => [p.id, { x: (i + 1) / (players.length + 1), y: 0.5 }])),
      batch: new Set(),
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);

  const fever = () => G.phase === 'play' && G.left <= FEVER;

  const counts = () => {
    const c = {};
    for (const o of G.grid) if (o) c[o] = (c[o] ?? 0) + 1;
    return c;
  };

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    const c = counts();
    G.rows = [...players]
      .map((p) => ({ p, v: c[p.id] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .map(({ p, v }) => ({ id: p.id, name: p.name, text: `${v}칸 (${Math.round((v / (COLS * ROWS)) * 100)}%)` }));
    G.phase = 'results';
    force();
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'painted') for (const c of d.cells) G.grid[c] = m.from; // 서버 확정 순서
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); };
  }, []);

  const paintAt = (x, y) => {
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(x * COLS)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(y * ROWS)));
    const cells = [row * COLS + col];
    if (fever()) { // 🔥 십자로 칠해진다
      if (col > 0) cells.push(row * COLS + col - 1);
      if (col < COLS - 1) cells.push(row * COLS + col + 1);
      if (row > 0) cells.push((row - 1) * COLS + col);
      if (row < ROWS - 1) cells.push((row + 1) * COLS + col);
    }
    for (const c of cells) {
      if (G.grid[c] !== me) {
        G.grid[c] = me; // 일단 내 화면에 바로 — 최종 판정은 서버 순서
        G.batch.add(c);
      }
    }
  };

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    let wasFever = false;
    loop.current = setInterval(() => {
      G.left = TIME - (Date.now() - G.t0) / 1000;
      if (!wasFever && fever()) { wasFever = true; vib(200); }
      if (G.left <= 0 && G.phase === 'play') return buildResults();
      force();
    }, 100);
    sender.current = setInterval(() => {
      const my = G.pos[me];
      net.msg({ a: 'p', x: my.x, y: my.y });
      if (G.batch.size > 0) {
        net.msg({ a: 'paint', cells: [...G.batch] });
        G.batch.clear();
      }
    }, 120);
    force();
  };

  const move = (e) => {
    if (G.phase !== 'play') return;
    const { locationX, locationY } = e.nativeEvent;
    if (!G.aw || !G.ah) return;
    const x = Math.min(0.99, Math.max(0.01, locationX / G.aw));
    const y = Math.min(0.99, Math.max(0.01, locationY / G.ah));
    G.pos[me] = { x, y };
    paintAt(x, y);
    force();
  };

  const c = counts();
  const standings = [...players].sort((a, b) => (c[b.id] ?? 0) - (c[a.id] ?? 0));

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="🎨 페인트 아레나 결과" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={[st.time, fever() && { color: '#ff8c42' }]}>
              {fever() ? '🔥피버! ' : ''}{Math.max(0, Math.ceil(G.left))}s
            </Text>
            <View style={st.scores}>
              {standings.map((p) => (
                <Text key={p.id} style={[st.scoreTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {c[p.id] ?? 0}
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
            <View pointerEvents="none" style={st.gridWrap}>
              {G.grid.map((o, i) => (
                <View
                  key={i}
                  style={[
                    st.cell,
                    o ? { backgroundColor: colorOf(players, o), opacity: 0.85 } : null,
                  ]}
                />
              ))}
            </View>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {players.map((p) => {
                const pos = G.pos[p.id];
                return (
                  <View
                    key={p.id}
                    style={[
                      st.brush,
                      { left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, backgroundColor: colorOf(players, p.id) },
                      p.id === me && st.brushMe,
                    ]}
                  />
                );
              })}
            </View>
          </View>
          <Text style={st.hint}>드래그한 자리가 칠해진다 — 마지막 {FEVER}초는 🔥십자 피버!</Text>
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
  gridWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / COLS}%`, height: `${100 / ROWS}%` },
  brush: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, marginTop: -12 },
  brushMe: { borderWidth: 3, borderColor: '#fff' },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
