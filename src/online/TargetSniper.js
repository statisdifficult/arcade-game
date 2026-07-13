// 🎯 과녁 스나이퍼 — 전원 같은 위치에 뜨는 과녁 15개, 최속 클리어 랭킹전.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, doneTracker, secTxt, useForce } from './common';

const N = 15;
const LIMIT = 40000; // 40초 넘으면 포기 처리

export default function TargetSniper({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count',
    targets: (() => {
      const rng = mulberry32(seed);
      return [...Array(N)].map(() => ({ x: 8 + rng() * 78, y: 8 + rng() * 78 }));
    })(),
    k: 0,
    t0: 0,
    prog: {},
    rows: [],
  }).current;
  const timers = useRef([]).current;

  const tracker = useRef(
    doneTracker(players, (done) => {
      S.rows = [...players]
        .map((p) => ({ p, v: done[p.id] }))
        .sort((a, b) => (a.v ?? 1e9) - (b.v ?? 1e9))
        .map(({ p, v }) => ({
          id: p.id,
          name: p.name,
          text: v == null ? '미도착' : v >= LIMIT ? 'DNF' : secTxt(v),
        }));
      S.phase = 'results';
      force();
    })
  ).current;

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      if (m.d.a === 'prog') { S.prog[m.from] = m.d.v; force(); }
      if (m.d.a === 'done') { tracker.set(m.from, m.d.v); force(); }
      if (m.d.a === 'left') tracker.left(m.from);
    });
    return () => { off(); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    timers.push(setTimeout(() => { if (S.phase === 'play') finish(LIMIT); }, LIMIT));
    force();
  };

  const finish = (v) => {
    S.phase = 'waiting';
    net.msg({ a: 'done', v });
    tracker.set(me, v);
    timers.push(setTimeout(() => tracker.forceAll(), 20000));
    force();
  };

  const hit = () => {
    if (S.phase !== 'play') return;
    vib(12);
    S.k++;
    net.msg({ a: 'prog', v: S.k });
    if (S.k >= N) finish(Date.now() - S.t0);
    else force();
  };

  const t = S.targets[S.k];

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="🎯 과녁 스나이퍼 결과" note={`과녁 ${N}개 최속 클리어`} rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={st.headTxt}>🎯 {S.k}/{N}</Text>
            <View style={st.others}>
              {players.filter((p) => p.id !== me).map((p) => (
                <Text key={p.id} style={[st.otherTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {S.prog[p.id] ?? 0}
                </Text>
              ))}
            </View>
          </View>
          <View style={st.arena}>
            {S.phase === 'play' && t && (
              <TouchableOpacity
                style={[st.target, { left: `${t.x}%`, top: `${t.y}%` }]}
                activeOpacity={0.6}
                onPress={hit}
              >
                <Text style={{ fontSize: 44 }}>🎯</Text>
              </TouchableOpacity>
            )}
            {S.phase === 'waiting' && (
              <Text style={st.waitTxt}>완료! 다른 스나이퍼 기다리는 중...</Text>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headTxt: { color: C.gold, fontWeight: '900', fontSize: 18 },
  others: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  otherTxt: { fontSize: 12, fontWeight: '800' },
  arena: { flex: 1, margin: 10, backgroundColor: '#141a30', borderRadius: 18, overflow: 'hidden' },
  target: { position: 'absolute', marginLeft: -22, marginTop: -22 },
  waitTxt: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
