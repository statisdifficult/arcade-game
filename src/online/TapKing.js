// 👆 10초 연타왕 — 실시간 순위를 보면서 10초 동안 미친 듯이 연타!
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { Countdown, Results, colorOf, doneTracker, useForce } from './common';

const TIME = 10;

export default function TapKing({ net, me, players, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count', // count | play | waiting | results
    t0: 0,
    left: TIME,
    myTaps: 0,
    prog: {}, // id → 실시간 탭 수
    lastSend: 0,
    rows: [],
  }).current;
  const loop = useRef(null);
  const timers = useRef([]).current;

  const tracker = useRef(
    doneTracker(players, (done) => {
      S.rows = [...players]
        .map((p) => ({ p, v: done[p.id] ?? S.prog[p.id] ?? 0 }))
        .sort((a, b) => b.v - a.v)
        .map(({ p, v }) => ({ id: p.id, name: p.name, text: `${v}타` }));
      S.phase = 'results';
      clearInterval(loop.current);
      force();
    })
  ).current;

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      if (m.d.a === 'prog') { S.prog[m.from] = m.d.v; force(); }
      if (m.d.a === 'done') { S.prog[m.from] = m.d.v; tracker.set(m.from, m.d.v); force(); }
      if (m.d.a === 'left') tracker.left(m.from);
    });
    return () => { off(); clearInterval(loop.current); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    loop.current = setInterval(() => {
      S.left = TIME - (Date.now() - S.t0) / 1000;
      if (S.left <= 0) {
        S.left = 0;
        S.phase = 'waiting';
        clearInterval(loop.current);
        net.msg({ a: 'done', v: S.myTaps });
        tracker.set(me, S.myTaps);
        timers.push(setTimeout(() => tracker.forceAll(), 15000));
      }
      force();
    }, 100);
    force();
  };

  const tap = () => {
    if (S.phase !== 'play') return;
    S.myTaps++;
    S.prog[me] = S.myTaps;
    const now = Date.now();
    if (now - S.lastSend > 200) {
      S.lastSend = now;
      net.msg({ a: 'prog', v: S.myTaps });
    }
    force();
  };

  const standings = [...players]
    .map((p) => ({ p, v: S.prog[p.id] ?? 0 }))
    .sort((a, b) => b.v - a.v);

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="👆 연타왕 결과" rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.board}>
            <Text style={st.time}>{Math.ceil(S.left)}s</Text>
            {standings.map(({ p, v }, i) => (
              <View key={p.id} style={st.row}>
                <Text style={st.rowRank}>{i + 1}</Text>
                <Text style={[st.rowName, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name}{p.id === me ? ' (나)' : ''}
                </Text>
                <Text style={st.rowVal}>{v}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={st.tapBtn} activeOpacity={0.85} onPress={tap}>
            <Text style={st.tapTxt}>👆</Text>
            <Text style={st.tapCount}>{S.myTaps}</Text>
            <Text style={st.tapHint}>{S.phase === 'waiting' ? '집계 중...' : '연타!!!'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  board: { padding: 16 },
  time: { color: C.gold, fontSize: 34, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowRank: { color: C.sub, width: 24, fontWeight: '900' },
  rowName: { flex: 1, fontWeight: '800', fontSize: 15 },
  rowVal: { color: C.text, fontWeight: '900', fontSize: 16 },
  tapBtn: {
    flex: 1,
    margin: 16,
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapTxt: { fontSize: 56 },
  tapCount: { color: C.gold, fontSize: 48, fontWeight: '900' },
  tapHint: { color: C.sub, fontSize: 14, marginTop: 4 },
});
