// 🗺️ 미니 땅따먹기 — 내 땅에 붙은 칸만 확장. 두 영역이 만나는 칸은 💥분쟁지역이 되어 아무도 못 가진다.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const COLS = 7;
const ROWS = 10;
const TIME = 40;

export default function LandGrab({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | play | over
    cells: [], // 0 중립 | 1 P1 | 2 P2 | 3 💥분쟁
    left: TIME,
    lastTap: 0,
    winner: 0,
    count: { 1: 0, 2: 0 },
  }).current;
  const loop = useRef(null);
  useEffect(() => () => clearInterval(loop.current), []);

  const start = () => {
    S.cells = new Array(COLS * ROWS).fill(0);
    S.cells[Math.floor(COLS / 2)] = 2; // 위쪽 중앙 = P2 시작
    S.cells[(ROWS - 1) * COLS + Math.floor(COLS / 2)] = 1; // 아래쪽 중앙 = P1 시작
    S.left = TIME;
    S.winner = 0;
    S.phase = 'play';
    force();
    clearInterval(loop.current);
    loop.current = setInterval(() => {
      S.left -= 0.1;
      if (S.left <= 0) finish();
      force();
    }, 100);
  };

  const finish = () => {
    clearInterval(loop.current);
    S.count = {
      1: S.cells.filter((c) => c === 1).length,
      2: S.cells.filter((c) => c === 2).length,
    };
    S.winner = S.count[1] > S.count[2] ? 1 : S.count[2] > S.count[1] ? 2 : 0;
    S.phase = 'over';
    force();
  };

  const neighbors = (i) => {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const out = [];
    if (r > 0) out.push(i - COLS);
    if (r < ROWS - 1) out.push(i + COLS);
    if (c > 0) out.push(i - 1);
    if (c < COLS - 1) out.push(i + 1);
    return out;
  };

  // 탭한 사람이 누군지 몰라도 규칙이 판정해준다:
  // 내 땅에만 붙은 칸 → 내 땅. 양쪽 땅에 모두 붙은 칸 → 💥분쟁지역(벽).
  const tap = (i) => {
    if (S.phase !== 'play' || S.cells[i] !== 0) return;
    const now = Date.now();
    if (now - S.lastTap < 90) return;
    S.lastTap = now;
    const ns = neighbors(i).map((n) => S.cells[n]);
    const a1 = ns.includes(1);
    const a2 = ns.includes(2);
    if (a1 && a2) {
      S.cells[i] = 3; // 💥 분쟁지역 — 영구 봉쇄
      vib(90);
    } else if (a1) {
      S.cells[i] = 1;
      vib(12);
    } else if (a2) {
      S.cells[i] = 2;
      vib(12);
    } else return;
    force();
  };

  const c1 = S.cells.filter((c) => c === 1).length;
  const c2 = S.cells.filter((c) => c === 2).length;

  return (
    <Screen>
      <View style={[st.bar, st.flip]}>
        <Text style={[st.barTxt, { color: C.p2 }]}>🔴 P2 — {c2}칸</Text>
        <Text style={st.time}>{Math.max(0, Math.ceil(S.left))}s</Text>
      </View>
      <View style={st.board}>
        {S.cells.map((c, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => tap(i)}
            style={[
              st.cell,
              c === 1 && { backgroundColor: C.p1 },
              c === 2 && { backgroundColor: C.p2 },
              c === 3 && { backgroundColor: '#3a3320' },
            ]}
          >
            {c === 3 && <Text style={{ fontSize: 14 }}>💥</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <View style={st.bar}>
        <Text style={[st.barTxt, { color: C.p1 }]}>🔵 P1 — {c1}칸</Text>
        <Text style={st.time}>{Math.max(0, Math.ceil(S.left))}s</Text>
      </View>
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🗺️ 미니 땅따먹기</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>
              {S.winner === 0 ? `무승부! ${S.count[1]}:${S.count[2]}` : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! ${S.count[1]}:${S.count[2]} 🏆`}
            </Text>
          )}
          <Text style={st.ovDesc}>
            내 땅(색칸)에 붙은 중립 칸을 탭해서 확장!{'\n'}양쪽 땅에 동시에 붙은 칸을 누르면 💥분쟁지역이 되어{'\n'}아무도 못 가짐 — 길막 전략 가능. {TIME}초 뒤 많은 쪽 승리
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  flip: { transform: [{ rotate: '180deg' }] },
  barTxt: { fontWeight: '900', fontSize: 15 },
  time: { color: C.gold, fontWeight: '900', fontSize: 15 },
  board: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: {
    width: `${100 / COLS}%`,
    height: `${100 / ROWS}%`,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.bg,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ovTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  ovWin: { color: C.gold, fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
