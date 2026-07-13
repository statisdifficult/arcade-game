// ⚽ 공 몰이 축구 — 자동 팀 배정(참가 순서 홀짝), 몸으로 공을 밀어서 골! 먼저 3골 or 90초.
// 공 물리는 방장 폰이 시뮬레이션하고 위치를 중계한다.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { Countdown, Results, useForce } from './common';

const TIME = 90;
const WIN = 3;
const BALL_R = 0.028;
const BODY_R = 0.038;
const GOAL_L = 0.3;
const GOAL_R = 0.7;
const TEAM_COLOR = [C.p1, C.p2];
const TEAM_NAME = ['🔵 파랑팀', '🔴 빨강팀'];

export default function BallSoccer({ net, me, players, hostId, exit }) {
  const force = useForce();
  const amHost = me === hostId;
  const teamOf = (id) => Math.max(0, players.findIndex((p) => p.id === id)) % 2; // 짝수번째=파랑(위 골대 공격)
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      phase: 'count',
      ball: { x: 0.5, y: 0.5, vx: 0, vy: 0 },
      score: [0, 0],
      t0: 0,
      left: TIME,
      freezeUntil: 0,
      lastT: 0,
      pos: Object.fromEntries(
        players.map((p, i) => [
          p.id,
          { x: (Math.floor(i / 2) + 1) / (Math.ceil(players.length / 2) + 1), y: i % 2 === 0 ? 0.75 : 0.25 },
        ])
      ),
      rows: [],
    };
  }
  const G = S.current;
  const loop = useRef(null);
  const sender = useRef(null);
  const timers = useRef([]).current;

  const buildResults = () => {
    clearInterval(loop.current);
    clearInterval(sender.current);
    const winner = G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : -1;
    G.rows = [...players]
      .map((p) => ({ p, t: teamOf(p.id) }))
      .sort((a, b) => (a.t === winner ? -1 : 1) - (b.t === winner ? -1 : 1))
      .map(({ p, t }) => ({
        id: p.id,
        name: p.name,
        text: winner === -1 ? `${TEAM_NAME[t]} 무승부` : t === winner ? `${TEAM_NAME[t]} 승리! 🏆` : `${TEAM_NAME[t]} 패배`,
      }));
    G.phase = 'results';
    force();
  };

  const applyGoal = (team, s0, s1) => {
    G.score = [s0, s1];
    G.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    G.freezeUntil = Date.now() + 1200;
    vib(150);
    if (s0 >= WIN || s1 >= WIN) {
      G.phase = 'ending';
      timers.push(setTimeout(buildResults, 1000));
    }
  };

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      const d = m.d;
      if (d.a === 'p') G.pos[m.from] = { x: d.x, y: d.y };
      if (d.a === 'ball' && !amHost) { G.ball.x = d.x; G.ball.y = d.y; }
      if (d.a === 'goal') applyGoal(d.team, d.s0, d.s1);
      force();
    });
    return () => { off(); clearInterval(loop.current); clearInterval(sender.current); timers.forEach(clearTimeout); };
  }, []);

  const stepBall = (dt) => {
    if (Date.now() < G.freezeUntil) return;
    const b = G.ball;
    // 선수 몸에 밀린다
    for (const p of players) {
      const o = G.pos[p.id];
      const dx = b.x - o.x;
      const dy = b.y - o.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < BALL_R + BODY_R) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = o.x + nx * (BALL_R + BODY_R + 0.002);
        b.y = o.y + ny * (BALL_R + BODY_R + 0.002);
        b.vx = nx * 0.55;
        b.vy = ny * 0.55;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.985;
    b.vy *= 0.985;
    // 벽
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.8; }
    if (b.x > 1 - BALL_R) { b.x = 1 - BALL_R; b.vx = -Math.abs(b.vx) * 0.8; }
    // 골 판정: 위 골대 = 팀0 득점, 아래 골대 = 팀1 득점
    if (b.y < BALL_R) {
      if (b.x > GOAL_L && b.x < GOAL_R) {
        const s0 = G.score[0] + 1;
        net.msg({ a: 'goal', team: 0, s0, s1: G.score[1] });
        applyGoal(0, s0, G.score[1]);
        return;
      }
      b.y = BALL_R;
      b.vy = Math.abs(b.vy) * 0.8;
    }
    if (b.y > 1 - BALL_R) {
      if (b.x > GOAL_L && b.x < GOAL_R) {
        const s1 = G.score[1] + 1;
        net.msg({ a: 'goal', team: 1, s0: G.score[0], s1 });
        applyGoal(1, G.score[0], s1);
        return;
      }
      b.y = 1 - BALL_R;
      b.vy = -Math.abs(b.vy) * 0.8;
    }
  };

  const go = () => {
    G.phase = 'play';
    G.t0 = Date.now();
    G.lastT = Date.now();
    loop.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - G.lastT) / 1000);
      G.lastT = now;
      G.left = TIME - (now - G.t0) / 1000;
      if (G.left <= 0 && G.phase === 'play') return buildResults();
      if (amHost && (G.phase === 'play' || G.phase === 'ending')) stepBall(dt);
      force();
    }, 33);
    sender.current = setInterval(() => {
      const my = G.pos[me];
      net.msg({ a: 'p', x: my.x, y: my.y });
      if (amHost) net.msg({ a: 'ball', x: G.ball.x, y: G.ball.y });
    }, 80);
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

  const myTeam = teamOf(me);

  return (
    <Screen>
      {G.phase === 'count' && <Countdown onDone={go} />}
      {G.phase === 'results' ? (
        <Results title="⚽ 공 몰이 축구 결과" rows={G.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={st.head}>
            <Text style={[st.teamTxt, { color: TEAM_COLOR[myTeam] }]}>
              {TEAM_NAME[myTeam]} · {myTeam === 0 ? '위쪽 골대를 노려라!' : '아래쪽 골대를 노려라!'}
            </Text>
            <Text style={st.scoreTxt}>🔵 {G.score[0]} : {G.score[1]} 🔴</Text>
            <Text style={st.time}>{Math.max(0, Math.ceil(G.left))}s</Text>
          </View>
          <View
            style={st.field}
            onLayout={(e) => { G.aw = e.nativeEvent.layout.width; G.ah = e.nativeEvent.layout.height; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={move}
            onResponderMove={move}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={st.centerLine} />
              <View style={st.centerCircle} />
              <View style={[st.goal, { top: 0, backgroundColor: C.p1 }]} />
              <View style={[st.goal, { bottom: 0, backgroundColor: C.p2 }]} />
              {players.map((p) => {
                const pos = G.pos[p.id];
                return (
                  <View key={p.id} style={[st.playerBox, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]}>
                    <View style={[st.body, { backgroundColor: TEAM_COLOR[teamOf(p.id)] }, p.id === me && st.bodyMe]} />
                    <Text style={st.pname} numberOfLines={1}>{p.id === me ? '나' : p.name}</Text>
                  </View>
                );
              })}
              <Text style={[st.ball, { left: `${G.ball.x * 100}%`, top: `${G.ball.y * 100}%` }]}>⚽</Text>
            </View>
          </View>
          <Text style={st.hint}>드래그로 이동 — 몸으로 공을 밀어 넣어라! 먼저 {WIN}골</Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: 14, paddingVertical: 6, gap: 2 },
  teamTxt: { fontWeight: '900', fontSize: 13 },
  scoreTxt: { color: C.text, fontWeight: '900', fontSize: 20, textAlign: 'center' },
  time: { color: C.gold, fontWeight: '900', fontSize: 14, position: 'absolute', right: 16, top: 10 },
  field: { flex: 1, margin: 10, marginTop: 4, backgroundColor: '#12261a', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#1e3a2a' },
  centerLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: '#1e3a2a' },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#1e3a2a',
  },
  goal: { position: 'absolute', left: '30%', right: '30%', height: 10, borderRadius: 5, opacity: 0.9 },
  playerBox: { position: 'absolute', alignItems: 'center', marginLeft: -18, marginTop: -15, width: 36 },
  body: { width: 28, height: 28, borderRadius: 14 },
  bodyMe: { borderWidth: 3, borderColor: '#fff' },
  pname: { color: C.sub, fontSize: 9, fontWeight: '700', marginTop: 1 },
  ball: { position: 'absolute', fontSize: 22, marginLeft: -11, marginTop: -11 },
  hint: { color: C.sub, fontSize: 12, textAlign: 'center', paddingBottom: 10 },
});
