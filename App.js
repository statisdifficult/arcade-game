// 맞짱 오락실 — 홈 화면 + 게임 라우팅
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from './src/components/ui';
import { C } from './src/theme';

import ReactionDuel from './src/games/ReactionDuel';
import TugOfWar from './src/games/TugOfWar';
import NumberStorm from './src/games/NumberStorm';
import ColorClash from './src/games/ColorClash';
import TimingPunch from './src/games/TimingPunch';
import LandGrab from './src/games/LandGrab';
import WhackMole from './src/games/WhackMole';
import RhythmBattle from './src/games/RhythmBattle';
import OnlineLobby from './src/online/OnlineLobby';

// 로컬 2인 대전 게임 목록 — 여기에 한 줄 추가/삭제하면 끝
const GAMES = [
  { key: 'reaction', icon: '⚡', title: '번개 반응 대결', desc: '진짜 신호에만 반응! 🎣 낚이면 상대 득점', comp: ReactionDuel },
  { key: 'tug', icon: '🪢', title: '화면 줄다리기', desc: '연타로 영역 밀어붙이기 + 돌발 이벤트', comp: TugOfWar },
  { key: 'numstorm', icon: '🔢', title: '숫자 폭풍', desc: '1~12 순서대로! 근데 숫자가 도망다님', comp: NumberStorm },
  { key: 'color', icon: '🎨', title: '컬러 클래시', desc: '색≠뜻 스트룹 함정 + 🔄 반전 라운드', comp: ColorClash },
  { key: 'punch', icon: '🥊', title: '타이밍 펀치', desc: '노란 존에 게이지 멈추기, 갈수록 빨라짐', comp: TimingPunch },
  { key: 'land', icon: '🗺️', title: '미니 땅따먹기', desc: '내 땅에 붙은 칸만 확장, 만나면 💥분쟁', comp: LandGrab },
  { key: 'mole', icon: '🔨', title: '두더지 잡기 대전', desc: '🐹+1 ⭐+3 💣-2 — 30초 다득점', comp: WhackMole },
  { key: 'rhythm', icon: '🎵', title: '리듬 배틀', desc: '같은 차트, PERFECT/GOOD 판정 + 콤보', comp: RhythmBattle },
];

export default function App() {
  const [screen, setScreen] = useState('home');

  if (screen === 'online') {
    return (
      <>
        <StatusBar style="light" />
        <OnlineLobby onExit={() => setScreen('home')} />
      </>
    );
  }

  const game = GAMES.find((g) => g.key === screen);
  if (game) {
    const Comp = game.comp;
    return (
      <>
        <StatusBar style="light" />
        <Comp onExit={() => setScreen('home')} />
      </>
    );
  }

  return (
    <Screen>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.logo}>🕹️ 맞짱 오락실</Text>
        <Text style={styles.tag}>폰 하나로 맞짱 8종 + 온라인 다인전 14종</Text>

        <TouchableOpacity style={styles.online} activeOpacity={0.85} onPress={() => setScreen('online')}>
          <Text style={styles.onlineIcon}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>온라인 대전</Text>
            <Text style={styles.onlineDesc}>방 코드로 최대 6명 — 아레나 8종 + 랭킹전 6종</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.section}>🤼 폰 하나로 2인 대전</Text>
        <Text style={styles.sectionSub}>마주 보고 잡으세요 — 위쪽 화면은 상대 방향으로 돌아가요</Text>

        {GAMES.map((g) => (
          <TouchableOpacity key={g.key} style={styles.card} activeOpacity={0.85} onPress={() => setScreen(g.key)}>
            <Text style={styles.icon}>{g.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{g.title}</Text>
              <Text style={styles.desc}>{g.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.footer}>즐겁게, 적당히, 안전하게 🥂</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 },
  logo: { color: C.text, fontSize: 30, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  tag: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22315c',
    borderColor: C.p1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  onlineIcon: { fontSize: 32, marginRight: 12 },
  onlineTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  onlineDesc: { color: C.sub, fontSize: 12, marginTop: 3 },
  section: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 18 },
  sectionSub: { color: C.sub, fontSize: 12, marginTop: 4, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 8,
  },
  icon: { fontSize: 28, marginRight: 12 },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  desc: { color: C.sub, fontSize: 12, marginTop: 3 },
  arrow: { color: C.sub, fontSize: 26, marginLeft: 8 },
  footer: { color: C.sub, fontSize: 12, textAlign: 'center', marginTop: 22 },
});
