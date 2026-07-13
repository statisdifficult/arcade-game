// 🏒 에어하키 — 방의 첫 두 명이 1:1 대결, 나머지는 관전. 먼저 5골!
// 물리는 아래쪽 플레이어(A)의 폰이 시뮬레이션하고 퍽 위치를 중계한다.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, nameOf, useForce } from './common';

const WIN = 5;
const PUCK_R = 0.03;
const PAD_R = 0.065;
const GOAL_L = 0.33;
const GOAL_R = 0.67;

export default function AirHockey({ net, me, players, seed, exit }) {
  const force = useForce();
  const idA = players[0].id; // 아래쪽 + 물리 담당
  const idB = players[1] ? players[1].id : null;
  const amA = me === idA;
  const amB = me === idB;

  if (!idB) { // 혼자서는 못 하는 게임
    return (
      <Screen>
        <View style={st.needTwo}>
          <Text style={st.needTwoTxt}>🏒 에어하키는 2명 이상 필요해요!</Text>
          <Text style={{ color: C.sub, marginTop: 8 }}>친구를 초대한 뒤 다시 시작해 주세요</Text>
          <Text style={st.backLink} onPress={exit}>‹ 로비로</Text>
        </View>
      </Screen>
    );
  }
  const S = useRef(null);
  if (!S.current) {
    const rng = mulberry32(seed);
    S.current = {
      phase: 'count',
      puck: { x: 0.5, y: 0.5, vx: (rng() - 0.5) * 0.3, vy: rng() < 0.5 ? 0.3 : -0.3 },
      pads: { [idA]: { x: 0.5, y: 0.85, px: 0.5, py: 0.85 }, ...(idB ? { [idB]: { x: 0.5, y: 0.15, px: 0.5, py: 0.15 } } : {}) },
      score: { a: 0, b: 0 },
      freezeUntil: 0,
      lastT: 0,
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);
  const timers = useRef([]).current;

  // B는 자기 골대가 아래로 보이게 좌표를 180° 뒤집어서 보고/조작한다
  const flip = (v) => (amB ? { x: 1 - v.x, y: 1 - v.y } : v);

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    const aWin = G.score.a > G.score.b;
    G.rows = [
      { id: aWin ? idA : idB, name: nameOf(players, aWin ? idA : idB), text: `승리! ${Math.max(G.score.a, G.score.b)}골 🏆` },
      { id: aWin ? idB : idA, name: nameOf(players, aWin ? idB : idA), text: `${Math.min(G.score.a, G.score.b)}골` },
      ...players.slice(2).map((p) => ({ id: p.id, name: p.name, text: '관전 👀' })),
    ];
    G.phase = 'results';
    force();
  };

  const applyGoal = (side, sa, sb) => {
    G.score = { a: sa, b: sb };
    G.puck = { x: 0.5, y: 0.5, vx: 0, vy: side === 'a' ? 0.3 : -0.3 }; // 먹힌 쪽으로 서브
    G.freezeUntil = Date.now() + 1000;
    vib(120);
    if (sa >= WIN || sb >= WIN) {
      G.phase = 'ending';
      timers.push(setTimeout(buildResults, 900));
    }
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'pad' && G.pads[m.from]) {
        G.pads[m.from].x = d.x;
        G.pads[m.from].y = d.y;
      }
      if (d.a === 'pk' && !amA) Object.assign(G.puck, { x: d.x, y: d.y, vx: d.vx, vy: d.vy });
      if (d.a === 'goal') applyGoal(d.side, d.sa, d.sb);
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); timers.forEach(clearTimeout); };
  }, []);

  const stepPhysics = (dt) => {
    const pk = G.puck;
    if (Date.now() < G.freezeUntil) return;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    // 좌우 벽
    if (pk.x < PUCK_R) { pk.x = PUCK_R; pk.vx = Math.abs(pk.vx); }
    if (pk.x > 1 - PUCK_R) { pk.x = 1 - PUCK_R; pk.vx = -Math.abs(pk.vx); }
    // 위/아래: 골 존이면 골, 아니면 벽
    if (pk.y < PUCK_R) {
      if (pk.x > GOAL_L && pk.x < GOAL_R) {
        const sa = G.score.a + 1;
        net.msg({ a: 'goal', side: 'a', sa, sb: G.score.b });
        applyGoal('a', sa, G.score.b);
        return;
      }
      pk.y = PUCK_R;
      pk.vy = Math.abs(pk.vy);
    }
    if (pk.y > 1 - PUCK_R) {
      if (pk.x > GOAL_L && pk.x < GOAL_R) {
        const sb = G.score.b + 1;
        net.msg({ a: 'goal', side: 'b', sa: G.score.a, sb });
        applyGoal('b', G.score.a, sb);
        return;
      }
      pk.y = 1 - PUCK_R;
      pk.vy = -Math.abs(pk.vy);
    }
    // 패들 충돌
    for (const id of [idA, idB]) {
      if (id == null) continue;
      const pad = G.pads[id];
      const dx = pk.x - pad.x;
      const dy = pk.y - pad.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < PUCK_R + PAD_R) {
        const nx = dx / dist;
        const ny = dy / dist;
        pk.x = pad.x + nx * (PUCK_R + PAD_R + 0.002);
        pk.y = pad.y + ny * (PUCK_R + PAD_R + 0.002);
        const padVx = (pad.x - pad.px) / dt;
        const padVy = (pad.y - pad.py) / dt;
        const sp = Math.max(0.45, Math.hypot(pk.vx, pk.vy) * 1.04);
        pk.vx = nx * sp + padVx * 0.35;
        pk.vy = ny * sp + padVy * 0.35;
        vib(10);
      }
      pad.px = pad.x;
      pad.py = pad.y;
    }
    // 최고 속도 제한 + 마찰 없음(에어하키니까!)
    const sp = Math.hypot(pk.vx, pk.vy);
    if (sp > 1.5) { pk.vx *= 1.5 / sp; pk.vy *= 1.5 / sp; }
  };

  const go = () => {
    G.phase = 'play';
    G.lastT = Date.now();
    loop.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - G.lastT) / 1000);
      G.lastT = now;
      if (amA && (G.phase === 'play' || G.phase === 'ending')) stepPhysics(dt);
      else { G.puck.x += G.puck.vx * dt; G.puck.y += G.puck.vy * dt; } // 다음 중계까지 관성 보간
      force();
    }, 33);
    sender.current = setInterval(() => {
      if (amA) net.msg({ a: 'pk', x: G.puck.x, y: G.puck.y, vx: G.puck.vx, vy: G.puck.vy });
      if (amA || amB) {
        const pad = G.pads[me];
        net.msg({ a: 'pad', x: pad.x, y: pad.y });
      }
    }, 66);
    force();
  };

  const move = (e) => {
    if (!amA && !amB) return;
    const { locationX, locationY } = e.nativeEvent;
    if (!G.aw || !G.ah) return;
    // 화면 좌표(내 시점) → 실제 좌표
    const view = { x: locationX / G.aw, y: locationY / G.ah };
    const real = flip(view);
    const pad = G.pads[me];
    pad.x = Math.min(1 - PAD_R, Math.max(PAD_R, real.x));
    const yMin = amA ? 0.52 : PAD_R; // 자기 진영에서만
    const yMax = amA ? 1 - PAD_R : 0.48;
    pad.y = Math.min(yMax, Math.max(yMin, real.y));
    force();
  };

  const myScore = amB ? G.score.b : G.score.a;
  const oppScore = amB ? G.score.a : G.score.b;
  const puckV = flip(G.puck);

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="🏒 에어하키 결과" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={st.scoreTxt}>
              {amA || amB
                ? `나 ${myScore} : ${oppScore} ${nameOf(players, amA ? idB : idA)}`
                : `${nameOf(players, idA)} ${G.score.a} : ${G.score.b} ${nameOf(players, idB)}`}
            </Text>
            {!amA && !amB && <Text style={st.spec}>👀 관전 중</Text>}
          </View>
          <View
            style={st.table}
            onLayout={(e) => { G.aw = e.nativeEvent.layout.width; G.ah = e.nativeEvent.layout.height; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={move}
            onResponderMove={move}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={st.centerLine} />
              <View style={[st.goal, { top: 0 }]} />
              <View style={[st.goal, { bottom: 0 }]} />
              {[idA, idB].filter((id) => id != null).map((id) => {
                const v = flip(G.pads[id]);
                const mine = id === me;
                return (
                  <View
                    key={id}
                    style={[
                      st.pad,
                      {
                        left: `${v.x * 100}%`,
                        top: `${v.y * 100}%`,
                        backgroundColor: id === idA ? C.p1 : C.p2,
                      },
                      mine && st.padMe,
                    ]}
                  />
                );
              })}
              <View style={[st.puck, { left: `${puckV.x * 100}%`, top: `${puckV.y * 100}%` }]} />
            </View>
          </View>
          <Text style={st.hint}>
            {amA || amB ? '내 진영(아래쪽)에서 드래그 — 먼저 5골!' : `${nameOf(players, idA)} vs ${nameOf(players, idB)} 관전 중`}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  scoreTxt: { color: C.text, fontWeight: '900', fontSize: 18 },
  spec: { color: C.sub, fontWeight: '800', alignSelf: 'center' },
  table: { flex: 1, margin: 10, marginTop: 2, backgroundColor: '#101830', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  centerLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: C.line },
  goal: { position: 'absolute', left: '33%', right: '33%', height: 8, backgroundColor: C.gold, borderRadius: 4 },
  pad: { position: 'absolute', width: 52, height: 52, borderRadius: 26, marginLeft: -26, marginTop: -26, opacity: 0.95 },
  padMe: { borderWidth: 3, borderColor: '#fff' },
  puck: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, marginTop: -12, backgroundColor: C.text },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
  needTwo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  needTwoTxt: { color: C.text, fontSize: 18, fontWeight: '900' },
  backLink: { color: C.gold, fontWeight: '900', fontSize: 16, marginTop: 24 },
});
