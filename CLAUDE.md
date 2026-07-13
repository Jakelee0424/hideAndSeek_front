# CLAUDE.md — game3d-client (프론트엔드)

실시간 멀티플레이 3D 게임의 **웹 클라이언트**. Next.js + React Three Fiber(R3F)로 3D 렌더링·캐릭터 보간·카메라·입력을 담당하고, 서버(`game3d-server`, Spring Boot)와 **WebSocket/STOMP**로 통신한다.

> 짝 프로젝트(백엔드): `C:\Users\jung\project\game3d-server` — 서버가 **권위(authoritative)** 를 가진다. 클라이언트는 입력을 보내고, 서버 스냅샷을 받아 렌더링한다.

---

## 기술 스택
- **Next.js** (App Router) + **React 19** + **TypeScript**
- **React Three Fiber** (`@react-three/fiber`) + **three.js**
- **@react-three/drei** (헬퍼: 카메라·컨트롤·로더 등)
- 실시간 통신: **`@stomp/stompjs`** (+ 필요 시 `sockjs-client`)
- 상태관리: 경량으로 **zustand** 권장 (전역 세션/룸 상태). **3D 트랜스폼 상태는 store에 넣지 말 것** — 아래 렌더링 규칙 참고.
- 패키지 매니저: pnpm (또는 npm) — 하나로 통일

## 로컬 실행
```bash
pnpm install
pnpm dev        # http://localhost:3000
```
- 백엔드가 `http://localhost:8080` 에 떠 있어야 실시간 기능 동작 (WS 엔드포인트 `ws://localhost:8080/ws`)
- API/WS 주소는 `.env.local` 의 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` 로 관리 (하드코딩 금지)

---

## ⚠️ R3F 렌더링 핵심 규칙 (성능 직결 — 반드시 준수)
1. **매 프레임 `setState` 금지.** 위치·회전 등 프레임마다 바뀌는 값은 React state가 아니라 **`useRef`** 로 들고 `useFrame` 안에서 `mesh.position`/`quaternion` 을 직접 수정한다. state로 넣으면 매 프레임 리렌더 → 프레임 드랍.
2. **게임 루프는 `useFrame` 하나에 모은다.** 보간·카메라 추적·입력 반영을 프레임 콜백에서 처리.
3. 원격 플레이어 위치는 **서버 스냅샷 사이를 보간**해서 부드럽게 그린다:
   - 이동: `THREE.Vector3.lerp` (또는 damp)
   - 회전: `THREE.Quaternion.slerp`
   - 서버 tick 간격(예: 50~100ms)만큼 **한 스냅샷 뒤(interpolation delay)** 를 그려 지터를 흡수한다.
4. **로컬 플레이어**는 입력 즉시 반영(client-side prediction)하고, 서버 확정값과 어긋나면 부드럽게 보정(reconciliation). MVP 단계에선 예측 없이 서버 스냅샷 렌더링부터 시작해도 됨 — 단순함 우선.
5. 재사용 객체(`Vector3`, `Quaternion`)는 **컴포넌트 밖 또는 ref로 1회 생성**해 프레임마다 `new` 하지 않는다 (GC 압박 방지).
6. 리스트 렌더(다른 플레이어들)는 **안정적인 key = playerId** 사용. 입퇴장은 store에서만 관리.

## 입력 처리
- 키보드(WASD/방향키)·포인터락 카메라는 window 이벤트 리스너 → **ref 플래그**에 기록, `useFrame`에서 읽어 반영.
- 입력을 매 프레임 서버로 보내지 말고 **고정 주기(예: 20~30Hz)로 배치 전송**하거나, 이동 의도(방향 벡터)만 전송한다.

## 카메라
- 3인칭 팔로우 카메라: 타깃(로컬 플레이어) 뒤를 `lerp`로 부드럽게 추적. `drei`의 카메라 헬퍼 활용 가능하나, 게임 카메라는 직접 `useFrame` 제어가 자연스럽다.

---

## 네트워킹 (STOMP)
- 연결: `ws://localhost:8080/ws` (백엔드 STOMP 엔드포인트와 일치시킬 것)
- 구독/발행 규약은 **백엔드 CLAUDE.md의 STOMP 목적지 표와 반드시 일치**시킨다. (예시)
  - 구독: `/topic/rooms/{roomId}/state` — 월드 스냅샷 수신
  - 발행: `/app/rooms/{roomId}/input` — 내 입력/이동 전송
- 재연결 로직 필수(`reconnectDelay`). 연결 상태를 store에 두고 UI로 표시.
- 메시지 payload는 작게. 좌표는 필요한 정밀도만.

## 디렉터리 컨벤션(권장)
```
app/                 # Next.js 라우트
components/           # 일반 UI (로비, HUD, 접속 상태)
game/                # 3D/게임 로직
  Scene.tsx          # <Canvas> 루트
  Player.tsx         # 원격 플레이어
  LocalPlayer.tsx    # 로컬(입력·예측)
  useGameLoop.ts     # useFrame 기반 루프
net/                 # STOMP 클라이언트, 구독/발행 래퍼
store/               # zustand (세션/룸/연결상태)
```

## 코드 스타일
- TypeScript strict. 서버와 주고받는 메시지는 **타입(인터페이스)로 명시**하고 백엔드 DTO와 필드명을 맞춘다.
- 3D 좌표계·단위는 백엔드와 합의된 규약 사용(예: y-up, 미터 단위).
- 커밋/푸시는 **사용자가 요청할 때만**. **커밋 메시지는 한글로 작성**한다.
