"use client";
// 로컬 플레이어 컨트롤러:
//  - WASD 이동(카메라 기준, client-side prediction) + 포인터락 마우스룩 3인칭 카메라
//  - GLB 캐릭터 + idle/walk 애니메이션 상태 전환
//  - 근접 오브젝트 감지 → 하이라이트, E키로 상호작용(퍼즐 열기)
//  - 입력을 20Hz로 서버 전송(월드 방향 벡터로 변환해 전송 → 서버 권위 로직 무변경)
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "./useKeyboard";
import { useMouseLook } from "./useMouseLook";
import Character, { type AnimState } from "./Character";
import { sendInput, sendPunch } from "@/net/stompClient";
import { worldState, INTERP_DELAY_MS } from "@/net/worldState";
import { punches } from "@/net/punches";
import { sfxPunch } from "./sfx";
import {
  KNOCKBACK_SPEED,
  KNOCKBACK_TAU,
  PUNCH_ANIM_MS,
  PUNCH_COOLDOWN_MS,
} from "./punchConfig";
import { useGameStore } from "@/store/gameStore";
import {
  INTERACTABLES,
  INTERACT_RANGE,
  canInteract,
  openDoorsFromSolved,
  useInteraction,
} from "./interactables";
import { STEP_UP, groundHeightAt, randomCellSpawn } from "./prisonLayout";
import { pushOutOfPlayer, resolveCollision } from "./collision";
import { localPos } from "./localPos";

// ⚠️ 아래 넷은 백엔드 application.yml의 game.* 와 이중 관리다. 어긋나면 예측이 서버와 벌어져
//    러버밴딩이 생긴다(특히 점프는 착지 시점이 눈에 띄게 튄다).
//    SPEED ↔ speed / SPRINT_MULT ↔ sprint-multiplier / JUMP_SPEED ↔ jump-speed / GRAVITY ↔ gravity
const SPEED = 6; // m/s
const SPRINT_MULT = 1.8; // 달리기 배수 → 10.8 m/s
const JUMP_SPEED = 6; // 점프 초기 수직 속도(m/s). 최고 높이 = v²/2g = 1.0m
const GRAVITY = 18; // m/s². 9.8은 게임에선 너무 붕 뜬다
const CAM_DIST = 6.5; // 카메라~캐릭터 거리(m)
const CAM_LOOK_H = 1.4; // 시선 높이(캐릭터 머리 부근)
const INPUT_HZ = 20;

// 소음 게이지(0~100): 달리면 차오르고, 안 달리면(걷기·정지) 0으로 빠진다.
const NOISE_MAX = 100;
const NOISE_RISE = 40; // 달릴 때 초당 상승량 → 0→100 약 2.5초
const NOISE_FALL = 55; // 안 달릴 때 초당 하강량 → 100→0 약 1.8초
const NOISE_HZ = 15; // 게이지 표시 갱신 주기(매 프레임 setState 방지)

const _camDesired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export default function LocalPlayer() {
  const ref = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const look = useMouseLook();
  const seq = useRef(0);
  const acc = useRef(0);
  const noise = useRef(0); // 소음 실수값(프레임마다 누적). 표시값은 반올림해 스토어로
  const noiseAcc = useRef(0); // 소음 표시 갱신 throttle
  const vy = useRef(0); // 수직 속도(예측). 접지 중엔 0
  const kx = useRef(0); // 넉백 수평 속도(예측). 맞으면 실리고 지수 감쇠
  const kz = useRef(0);
  const punchUntil = useRef(0); // 이 시각(perf.now)까지 펀치 모션 재생
  const punchCdUntil = useRef(0); // 이 시각 전엔 펀치 재발동 억제(쿨다운)
  const punchReq = useRef(false); // 클릭이 펀치를 요청했다(useFrame에서 소비)
  const lastAnim = useRef<AnimState>("idle");
  const spawned = useRef(false); // 첫 서버 스냅샷 때 배정된 감방 위치로 스냅
  // 프론트 단독 실행 시 초기 위치: 랜덤 감방 안. 서버 연결 시 첫 스냅샷이 덮어쓴다.
  const initPos = useMemo(() => {
    const [x, z] = randomCellSpawn();
    return [x, 0, z] as [number, number, number];
  }, []);
  const [anim, setAnim] = useState<AnimState>("idle");
  const myNick = useGameStore((s) => s.myNick);

  // E키: 근접 오브젝트 상호작용(자물쇠/힌트 열기). 자물쇠를 풀면 그 방 감방문이 열린다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const st = useInteraction.getState();
      if (st.openId || !st.nearId || st.solved[st.nearId]) return;
      st.open(st.nearId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 좌클릭: 펀치. 단, 포인터락을 <b>거는</b> 첫 클릭은 펀치가 아니다(그때는 아직 락이 안 걸려 있다).
  // 오버레이(퍼즐 등) 조작 중에도 펀치하지 않는다 — 실제 발동/쿨다운 판정은 useFrame에서.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement === null) return;
      if (useInteraction.getState().openId !== null) return;
      punchReq.current = true;
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;

    // 서버가 배정한 감방으로 최초 1회 스냅(예측은 그 뒤 이어받는다).
    if (!spawned.current) {
      const myId = useGameStore.getState().myId;
      const t = myId ? worldState.sample(myId, performance.now()) : null;
      if (t) {
        g.position.x = t.x;
        g.position.y = t.y;
        g.position.z = t.z;
        g.rotation.y = t.rotationY;
        spawned.current = true;
      }
    }

    const locked = useInteraction.getState().openId !== null;
    const { yaw, pitch } = look.current;

    // 카메라가 보는 방향을 기준으로 입력을 월드 방향 벡터로 변환.
    //   forward(yaw=0) = -Z (기존 카메라 뒤 배치와 동일 규약)
    //   right = cross(forward, up) = (-forward.z, 0, forward.x)
    const k = keys.current;
    const fwdAmt = locked ? 0 : (k.w ? 1 : 0) - (k.s ? 1 : 0);
    const rightAmt = locked ? 0 : (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let mx = fx * fwdAmt - fz * rightAmt;
    let mz = fz * fwdAmt + fx * rightAmt;
    const len = Math.hypot(mx, mz);
    const moving = len > 0;

    const sprinting = !locked && k.sprint && moving;

    // 소음: 달리는 동안 차오르고, 그 외(걷기·정지)엔 0으로 빠진다. 0~100 clamp.
    noise.current += (sprinting ? NOISE_RISE : -NOISE_FALL) * dt;
    if (noise.current < 0) noise.current = 0;
    else if (noise.current > NOISE_MAX) noise.current = NOISE_MAX;
    noiseAcc.current += dt;
    if (noiseAcc.current >= 1 / NOISE_HZ) {
      noiseAcc.current = 0;
      useGameStore.getState().setNoise(Math.round(noise.current));
    }

    // 넉백 임펄스 수령(맞은 사람 본인만). 서버가 보낸 방향에 KNOCKBACK_SPEED를 곱해 속도로.
    const kb = punches.takeKnockback();
    if (kb) {
      kx.current += KNOCKBACK_SPEED * kb.x;
      kz.current += KNOCKBACK_SPEED * kb.z;
    }
    const knocked = kx.current !== 0 || kz.current !== 0;

    if (moving) {
      mx /= len;
      mz /= len;
      const speed = sprinting ? SPEED * SPRINT_MULT : SPEED;
      g.position.x += mx * speed * dt;
      g.position.z += mz * speed * dt;
      g.rotation.y = Math.atan2(mx, mz); // 캐릭터는 이동 방향을 바라봄
    }

    // 넉백 적분 + 지수 감쇠(서버 Room.tick과 동일 식 → 결정론적 복제). 아주 작아지면 0으로 끊는다.
    if (knocked) {
      g.position.x += kx.current * dt;
      g.position.z += kz.current * dt;
      const decay = Math.exp(-dt / KNOCKBACK_TAU);
      kx.current *= decay;
      kz.current *= decay;
      if (Math.abs(kx.current) < 0.01 && Math.abs(kz.current) < 0.01) {
        kx.current = 0;
        kz.current = 0;
      }
    }

    // 다른 플레이어와의 충돌(실체). 같은 층에 있는 상대만 — 2층에 있으면 1층 사람과 겹쳐도 된다.
    // 상대 위치는 보간 재생 시점(서버 좌표)이라, 내 쪽만 밀어도 서버 판정과 수렴한다.
    const renderTime = performance.now() - INTERP_DELAY_MS;
    const myId = useGameStore.getState().myId;
    for (const oid of worldState.ids()) {
      if (oid === myId) continue;
      const o = worldState.sample(oid, renderTime);
      if (!o || Math.abs(o.y - g.position.y) > 1.6) continue;
      const [px, pz] = pushOutOfPlayer(g.position.x, g.position.z, o.x, o.z);
      g.position.x = px;
      g.position.z = pz;
    }

    // 벽/소품 충돌 해석(서버와 동일 로직). 미션을 푼 방의 감방문은 통과.
    // 충돌은 XZ 밀어내기 + 발높이 층 판정 — 점프해도 장애물은 못 넘는다(서버 Room.tick과 같은 규약).
    {
      const openDoors = openDoorsFromSolved(useInteraction.getState().solved);
      const [rx, rz] = resolveCollision(g.position.x, g.position.z, g.position.y, openDoors);
      g.position.x = rx;
      g.position.z = rz;
    }

    // 수직 예측(서버 Room.tick과 같은 식). 바닥은 그 좌표의 지지면(1층 0 / 계단 램프 / 2층 4.5).
    // STEP_UP 이하의 턱은 걸어서 스냅해 오르내린다 — 계단을 내려갈 때 통통 튀지 않게 한다.
    const floorY = groundHeightAt(g.position.x, g.position.z, g.position.y);
    const grounded = vy.current <= 0 && g.position.y - floorY <= STEP_UP;
    if (grounded) {
      g.position.y = floorY; // 계단·턱 스냅
      if (!locked && k.jump) {
        vy.current = JUMP_SPEED;
      }
    }
    if (!grounded || vy.current > 0) {
      vy.current -= GRAVITY * dt;
      g.position.y += vy.current * dt;
      if (g.position.y <= floorY) {
        g.position.y = floorY;
        vy.current = 0;
      }
    }
    const airborne = g.position.y > floorY + 1e-6;

    // 펀치 발동: 클릭 요청을 쿨다운·오버레이 조건에서 소비. 서버엔 "쳤다"만 보내고(대상·넉백은
    // 서버가 위치로 정한다), 내 모션·소리는 즉시 재생한다. 서버 연결 전이면 연출만 로컬로.
    const now = performance.now();
    if (punchReq.current) {
      punchReq.current = false;
      if (!locked && now >= punchCdUntil.current) {
        punchCdUntil.current = now + PUNCH_COOLDOWN_MS;
        punchUntil.current = now + PUNCH_ANIM_MS;
        sfxPunch();
        const gs = useGameStore.getState();
        if (gs.status === "connected") sendPunch(gs.roomId);
      }
    }
    const punching = now < punchUntil.current;

    // 애니메이션은 상태가 바뀔 때만 setState(매 프레임 리렌더 방지). 펀치가 최우선.
    const nextAnim: AnimState = punching
      ? "punch"
      : airborne
        ? "jump"
        : sprinting
          ? "run"
          : moving
            ? "walk"
            : "idle";
    if (nextAnim !== lastAnim.current) {
      lastAnim.current = nextAnim;
      setAnim(nextAnim);
    }

    // 3인칭 오빗 카메라: yaw/pitch 구면좌표로 캐릭터 주위에 배치(거리 일정).
    const cosP = Math.cos(pitch);
    _camDesired.set(
      g.position.x + Math.sin(yaw) * cosP * CAM_DIST,
      g.position.y + Math.sin(pitch) * CAM_DIST,
      g.position.z + Math.cos(yaw) * cosP * CAM_DIST,
    );
    state.camera.position.copy(_camDesired); // 마우스룩은 지연 없이 즉시 반영
    _lookAt.set(g.position.x, g.position.y + CAM_LOOK_H, g.position.z);
    state.camera.lookAt(_lookAt);

    // 다른 컴포넌트(농구공 등)가 근접 판정에 쓸 수 있게 위치를 흘려 준다.
    localPos.x = g.position.x;
    localPos.y = g.position.y;
    localPos.z = g.position.z;

    // 근접 오브젝트 감지(사거리 내 최근접). 남의 감방 자물쇠는 후보에서 뺀다 —
    // 사거리만 보면 복도에서 창살 너머로 닿는다(canInteract 참고).
    // 상호작용 오브젝트는 전부 1층에 있다 — 2층(감방 위 슬래브)에서 XZ가 겹쳐도 닿지 않아야 한다.
    let nearId: string | null = null;
    if (g.position.y < 2) {
      let best = INTERACT_RANGE * INTERACT_RANGE;
      for (const it of INTERACTABLES) {
        const ex = it.position[0] - g.position.x;
        const ez = it.position[2] - g.position.z;
        const d2 = ex * ex + ez * ez;
        if (d2 < best && canInteract(it, g.position.x, g.position.z)) {
          best = d2;
          nearId = it.id;
        }
      }
    }
    useInteraction.getState().setNear(nearId);

    // 서버 전송(20Hz)
    acc.current += dt;
    if (acc.current >= 1 / INPUT_HZ) {
      acc.current = 0;
      const gs = useGameStore.getState();
      if (gs.status === "connected") {
        sendInput(gs.roomId, {
          seq: seq.current++,
          move: { x: moving ? mx : 0, y: 0, z: moving ? mz : 0 },
          rotationY: g.rotation.y,
          sprint: sprinting,
          // 접지 판정은 서버가 한다. 여기선 누르고 있다는 사실만 보낸다.
          jump: !locked && k.jump,
        });
      }
    }
  });

  return (
    <group ref={ref} position={initPos}>
      <Character anim={anim} ringColor="#38bdf8" nick={myNick} />
    </group>
  );
}
