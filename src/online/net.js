// WebSocket 래퍼 + 서버 주소 자동감지 + 시드 난수
import Constants from 'expo-constants';

// 전원 동일한 판을 만들기 위한 시드 난수 (서버가 준 seed 사용)
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Expo Metro 호스트 IP를 그대로 사용 — 폰과 PC가 같은 와이파이면 이 주소로 바로 붙는다
export function guessServerUrl() {
  const host =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';
  const ip = String(host).split(':')[0];
  return ip ? `ws://${ip}:8790` : 'ws://localhost:8790';
}

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Set();
    this.connected = false;
  }

  connect(url) {
    this.close();
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        return reject(new Error('주소가 이상해요: ' + url));
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { ws.close(); } catch (e) {}
          reject(new Error('서버 연결 시간 초과 — 서버가 켜져 있는지, 주소가 맞는지 확인!'));
        }
      }, 6000);
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connected = true;
        resolve();
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        this._emit(m);
      };
      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('서버에 연결할 수 없어요'));
        }
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        if (was) this._emit({ t: 'closed' });
      };
    });
  }

  _emit(m) {
    for (const fn of [...this.handlers]) fn(m);
  }

  // 리스너 등록 — 반환값을 호출하면 해제 (useEffect cleanup에 그대로 쓰면 됨)
  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  // 게임 메시지 릴레이 — 같은 방 전원에게 {t:'msg', from, d}로 전달됨 (나 제외)
  msg(d) {
    this.send({ t: 'msg', d });
  }

  close() {
    if (this.ws) {
      this.connected = false;
      const ws = this.ws;
      this.ws = null;
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (e) {}
    }
  }
}
