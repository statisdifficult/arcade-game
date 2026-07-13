// ⏱ 감각 타이머 — 시계 없이 정확히 7.00초에 STOP! 오차가 가장 작은 사람이 승리.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { Countdown, Results, doneTracker, secTxt, useForce } from './common';

const TARGET = 7000;
const SHOW_MS = 1000; // 처음 1초만 시계를 보여준다

export default function SenseTimer({ net, me, players, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count', // count | play | waiting | results
    t0: 0,
    now: 0,
    myRaw: null,
    rows: [],
  }).current;
  const loop = useRef(null);
  const timers = useRef([]).current;

  const tracker = useRef(
    doneTracker(players, (done) => {
      const rows = [...players]
        .map((p) => ({ p, v: done[p.id] }))
        .sort((a, b) => (a.v?.d ?? 1e9) - (b.v?.d ?? 1e9))
        .map(({ p, v }) => ({
          id: p.id,
          name: p.name,
          text: v ? `${secTxt(v.r)} (오차 ${secTxt(v.d)})` : '미도착',
        }));
      S.rows = rows;
      S.phase = 'results';
      clearInterval(loop.current);
      force();
    })
  ).current;

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      if (m.d.a === 'done') { tracker.set(m.from, m.d.v); force(); }
      if (m.d.a === 'left') tracker.left(m.from);
    });
    return () => { off(); clearInterval(loop.current); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    loop.current = setInterval(() => {
      S.now = Date.now() - S.t0;
      if (S.now > 15000 && S.myRaw == null) stop(); // 너무 오래 붙잡으면 자동 스톱
      force();
    }, 50);
    force();
  };

  const stop = () => {
    if (S.phase !== 'play' || S.myRaw != null) return;
    const raw = Date.now() - S.t0;
    S.myRaw = raw;
    const v = { r: raw, d: Math.abs(raw - TARGET) };
    S.phase = 'waiting';
    vib(30);
    net.msg({ a: 'done', v });
    tracker.set(me, v);
    timers.push(setTimeout(() => tracker.forceAll(), 20000));
    force();
  };

  const doneCount = Object.keys(tracker.done).length;

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="⏱ 감각 타이머 결과" note={`목표 ${secTxt(TARGET)} — 오차가 작을수록 위!`} rows={S.rows} me={me} exit={exit} />
      ) : (
        <TouchableOpacity style={st.body} activeOpacity={0.9} onPress={stop}>
          <Text style={st.title}>⏱ 감각 타이머</Text>
          <Text style={st.target}>목표: 7.00초</Text>
          <Text style={st.clock}>
            {S.phase !== 'play' ? '준비...' : S.now <= SHOW_MS ? secTxt(S.now) : S.myRaw != null ? secTxt(S.myRaw) : '? ? ?'}
          </Text>
          <Text style={st.hint}>
            {S.phase === 'waiting'
              ? `다른 사람 기다리는 중... (${doneCount}/${players.length})`
              : S.now <= SHOW_MS
              ? '1초 뒤 시계가 사라진다!'
              : '감이 왔을 때 화면 탭 = STOP'}
          </Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: C.text, fontSize: 24, fontWeight: '900' },
  target: { color: C.gold, fontSize: 16, fontWeight: '800', marginTop: 8 },
  clock: { color: C.text, fontSize: 64, fontWeight: '900', marginVertical: 34, fontVariant: ['tabular-nums'] },
  hint: { color: C.sub, fontSize: 14, textAlign: 'center' },
});
