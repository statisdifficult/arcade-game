# 🤖 클로드 코드 지시서 — 이 리눅스 머신을 맞짱 오락실 서버로 만들기

> 사용자가 이 파일을 보여주면서 "이대로 세팅해줘"라고 하면, 아래 절차를 순서대로 수행하고
> 마지막의 **완료 보고** 형식으로 결과를 알려줄 것.

## 이 서버가 하는 일

"맞짱 오락실" 앱(React Native)의 온라인 대전용 릴레이 서버.
방 코드 기반 WebSocket 중계 + 일부 게임 판정. 의존성은 `ws` 하나, 단일 파일(`server/index.js`), 기본 포트 **8790**.
DB 없음, 상태는 전부 메모리 — 재시작해도 문제없음 (진행 중이던 방만 사라짐).

## 1. 사전 확인

```bash
node -v   # v20 이상이어야 함. 없거나 낮으면 nvm 또는 배포판 패키지로 Node 20+ 설치
```

## 2. 코드 받기 + 설치 + 검증

```bash
git clone https://github.com/statisdifficult/arcade-game.git
cd arcade-game/server
npm install
npm test          # 스모크 테스트 10항목 — 전부 ✅ 나와야 정상
```

`npm test`가 실패하면 진행하지 말고 원인(포트 충돌, Node 버전)을 먼저 해결할 것.

## 3. 상시 실행 등록 (재부팅해도 자동 시작)

systemd 사용 가능하면 이 방식을 우선할 것:

```bash
sudo tee /etc/systemd/system/tenten-arcade.service << 'EOF'
[Unit]
Description=tenten-arcade relay server
After=network.target

[Service]
Type=simple
WorkingDirectory=<클론한 절대경로>/arcade-game/server
ExecStart=/usr/bin/env node index.js
Restart=always
RestartSec=3
Environment=PORT=8790

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now tenten-arcade
systemctl status tenten-arcade --no-pager   # active (running) 확인
```

- `WorkingDirectory`는 실제 클론 경로로 치환할 것.
- systemd를 못 쓰는 환경(컨테이너 등)이면 pm2(`pm2 start index.js --name tenten-arcade && pm2 save && pm2 startup`)나 최후에는 `nohup`으로 대체.

## 4. 방화벽 열기

```bash
# ufw 사용 시
sudo ufw allow 8790/tcp
# firewalld 사용 시
sudo firewall-cmd --permanent --add-port=8790/tcp && sudo firewall-cmd --reload
```

공유기 뒤에 있는 머신이고 외부(LTE 등)에서도 접속시키려면, 공유기에서 **8790 포트포워딩**이 필요하다는 것을 사용자에게 안내할 것 (클로드가 직접 못 하는 부분).

## 5. 동작 확인

```bash
curl -s http://localhost:8790
# → "🕹️ 맞짱 오락실 릴레이 서버 작동 중 ..." 이 나오면 성공
```

서버 주소 파악:

```bash
hostname -I        # LAN 내부 IP (예: 192.168.0.42)
curl -s ifconfig.me # 공인 IP (외부 접속용, 포트포워딩 했을 때만 의미 있음)
```

## 6. (선택) wss:// 가 필요할 때

앱은 평문 `ws://`를 지원하므로 LAN/공인 IP 접속엔 TLS가 필요 없다.
도메인이 있고 `wss://`로 쓰고 싶을 때만 Caddy 리버스 프록시를 얹으면 된다:

```
# /etc/caddy/Caddyfile
arcade.example.com {
    reverse_proxy localhost:8790
}
```

## ✅ 완료 보고 (사용자에게 이렇게 알려줄 것)

1. 서버 상태: `systemctl status` 결과 요약 (active 여부, 재부팅 자동시작 여부)
2. **앱에 입력할 서버 주소**를 딱 집어서:
   - 같은 와이파이에서: `ws://<LAN IP>:8790`
   - 외부에서 (포트포워딩 완료 시): `ws://<공인 IP>:8790`
3. 사용법 리마인드: 앱 → 🌐 온라인 대전 → 서버 주소 칸에 위 주소 입력 → 방 만들기 → 친구들은 QR 스캔이면 끝
4. 포트포워딩이 안 된 상태면 그 사실과 공유기에서 해야 할 일(외부 8790 → 이 머신 8790)을 명시

## 🔧 자주 나는 문제

| 증상 | 원인/해결 |
|---|---|
| `EADDRINUSE` | 8790 포트 사용 중 → `ss -tlnp \| grep 8790`으로 확인 후 정리, 또는 `Environment=PORT=다른포트`로 변경 (앱 서버 주소도 같이 바꿔야 함) |
| npm install 실패 | Node 20 미만 → Node 업그레이드 |
| 앱에서 "연결 시간 초과" | 방화벽/포트포워딩 미개방, 또는 IP 오타. 같은 와이파이인지부터 확인 |
| 서버 코드 업데이트 | `cd arcade-game && git pull && sudo systemctl restart tenten-arcade` |
