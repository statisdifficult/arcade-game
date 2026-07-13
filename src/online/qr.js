// QR 참가 — 방 화면의 QR을 앱 내 스캐너로 찍으면 서버 주소+방 코드가 자동 입력되어 바로 참가된다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import qrcode from 'qrcode-generator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { C } from '../theme';
import { BigButton } from '../components/ui';

export function makeJoinPayload(server, code) {
  return JSON.stringify({ t: 'tenten-join', s: server, c: String(code) });
}

export function parseJoinPayload(data) {
  try {
    const o = JSON.parse(data);
    if (o.t === 'tenten-join' && o.s && o.c) return { server: String(o.s), code: String(o.c) };
  } catch (e) {}
  return null;
}

// 순수 JS로 QR 매트릭스를 만들어 View로 그린다 (같은 줄의 연속 칸은 하나로 합쳐서 가볍게)
export function QRCode({ value, size = 190 }) {
  const rows = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const cell = size / n;
    const out = [];
    for (let r = 0; r < n; r++) {
      const runs = [];
      let c = 0;
      while (c < n) {
        if (qr.isDark(r, c)) {
          let len = 1;
          while (c + len < n && qr.isDark(r, c + len)) len++;
          runs.push({ left: c * cell, width: len * cell });
          c += len;
        } else c++;
      }
      out.push({ top: r * cell, height: cell, runs });
    }
    return out;
  }, [value, size]);

  return (
    <View style={[st.qrBox, { width: size, height: size }]}>
      {rows.map((row, i) => (
        <View key={i} style={{ position: 'absolute', top: row.top, left: 0, right: 0, height: row.height }}>
          {row.runs.map((run, j) => (
            <View key={j} style={{ position: 'absolute', left: run.left, width: run.width, height: row.height, backgroundColor: '#000' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function QRScanner({ onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [bad, setBad] = useState(false);
  const lockRef = useRef(false);
  const timers = useRef([]).current;
  useEffect(() => () => timers.forEach(clearTimeout), []);

  const handle = ({ data }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const p = parseJoinPayload(data);
    if (p) {
      onScan(p);
    } else {
      setBad(true); // 다른 QR을 찍었다 — 잠깐 알려주고 계속 스캔
      timers.push(setTimeout(() => { setBad(false); lockRef.current = false; }, 1500));
    }
  };

  if (!permission) return <View style={st.dark} />;

  if (!permission.granted) {
    return (
      <View style={st.dark}>
        <Text style={st.permTxt}>📷 QR을 찍으려면{'\n'}카메라 권한이 필요해요</Text>
        <BigButton label="권한 허용" onPress={requestPermission} color={C.gold} style={{ minWidth: 200 }} />
        <BigButton label="‹ 뒤로" onPress={onClose} color={C.card} small style={{ marginTop: 10 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handle}
      />
      <View style={st.scanOverlay} pointerEvents="box-none">
        <Text style={st.scanHint}>{bad ? '⚠️ 오락실 QR이 아니에요' : '방장 화면의 QR을 비추세요'}</Text>
        <View style={st.frame} />
        <TouchableOpacity style={st.closeBtn} onPress={onClose}>
          <Text style={st.closeTxt}>‹ 뒤로</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  qrBox: { backgroundColor: '#fff', overflow: 'hidden' },
  dark: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permTxt: { color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 26, marginBottom: 20 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanHint: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  frame: { width: 230, height: 230, borderWidth: 3, borderColor: C.gold, borderRadius: 24 },
  closeBtn: {
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  closeTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
