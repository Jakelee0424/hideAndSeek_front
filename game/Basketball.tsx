"use client";
// 운동장 농구공(이스터에그). 가까이 가서 E를 누르면 골대로 슛을 던진다.
//
// 서버와 동기화하지 않는다 — 이스터에그 하나 때문에 DTO와 POI 이중 관리를 늘릴 이유가 없다.
// 남에게는 공이 제자리에 있는 것으로 보이지만, 그 대가로 서버 쪽 위험이 0이다.
//
// 상호작용도 INTERACTABLES에 넣지 않고 여기서 자체 처리한다. 그 목록은 서버
// Interactables.java와 짝이 맞아야 해서(봇이 그걸 보고 움직인다) 클라 전용 항목을 끼우면
// 그 규약이 깨진다.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { YARD } from "./prisonLayout";
import { localPos } from "./localPos";
import { sfxSwish, sfxThud } from "./sfx";

/** 공이 놓여 있는 자리(운동장, 골대 앞). Map.tsx의 농구골대 위치에서 잡았다. */
const REST: [number, number, number] = [YARD.cx + 5.8, 0.24, YARD.cz - 1.6];
/** 제자리와의 거리 비교용. 프레임 루프에서 매번 new 하지 않으려고 미리 만들어 둔다. */
const REST_VEC = new THREE.Vector3(...REST);

/** 림 중심과 반지름. Map.tsx의 골대 그룹(cx+7.5) 안 torus 위치에서 계산. */
const RIM: [number, number, number] = [YARD.cx + 6.75, 2.7, YARD.cz];
const RIM_R = 0.34;

const BALL_R = 0.24;
const GRAVITY = 14; // 게임 중력(18)보다 약하게 — 공이 더 느긋하게 뜬다
const FLIGHT = 0.95; // 목표까지 걸리는 시간(s). 이 값으로 초기 속도를 역산한다
const REACH = 2.6; // 이 거리 안이면 슛 가능
const RESET_AFTER = 2.2; // 착지 후 제자리로 돌아가기까지(s)

export default function Basketball({ mat }: { mat: THREE.Material }) {
  const ball = useRef<THREE.Mesh>(null);
  const vel = useRef(new THREE.Vector3());
  const flying = useRef(false);
  const restTimer = useRef(0);
  const prevY = useRef(REST[1]);
  const scoredThisShot = useRef(false);

  const [near, setNear] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashUntil = useRef(0);

  // 슛 한 번 = 이벤트 하나. 키 핸들러는 프레임 루프 밖에 둔다.
  const shoot = useCallback(() => {
    const b = ball.current;
    if (!b || flying.current) return;

    // 매번 똑같이 들어가면 재미가 없다. 목표를 조금씩 흔든다.
    const jx = (Math.random() - 0.5) * 0.55;
    const jz = (Math.random() - 0.5) * 0.55;
    const tx = RIM[0] + jx;
    const ty = RIM[1] + 0.25; // 림보다 살짝 위를 겨눠 위에서 떨어지게
    const tz = RIM[2] + jz;

    // 포물선 역산: 수평은 등속, 수직은 중력만 받는다고 보고 초기 속도를 구한다.
    vel.current.set(
      (tx - b.position.x) / FLIGHT,
      (ty - b.position.y + 0.5 * GRAVITY * FLIGHT * FLIGHT) / FLIGHT,
      (tz - b.position.z) / FLIGHT,
    );
    flying.current = true;
    scoredThisShot.current = false;
    prevY.current = b.position.y;
  }, []);

  useFrame((state, dt) => {
    const b = ball.current;
    if (!b) return;
    const now = state.clock.elapsedTime;

    // 근접 판정 — 공이 굴러가 있으면 원래 자리가 아니라 현재 위치 기준
    const dx = b.position.x - localPos.x;
    const dz = b.position.z - localPos.z;
    const inReach = dx * dx + dz * dz < REACH * REACH && !flying.current;
    if (inReach !== near) setNear(inReach);

    if (flash && now > flashUntil.current) setFlash(null);

    if (!flying.current) {
      // 착지해 있으면 잠시 뒤 제자리로 돌려놓는다(계속 던질 수 있게)
      if (b.position.distanceToSquared(REST_VEC) > 0.01) {
        restTimer.current += dt;
        if (restTimer.current > RESET_AFTER) {
          b.position.set(...REST);
          restTimer.current = 0;
        }
      }
      return;
    }

    // 비행 중: 중력 적분
    vel.current.y -= GRAVITY * dt;
    b.position.addScaledVector(vel.current, dt);
    b.rotation.x += dt * 6; // 굴러가는 느낌

    // 골인 판정 — 림 높이를 "위에서 아래로" 지나갔고 그때 림 안쪽이면 성공.
    // 아래에서 위로 통과하는 건 골이 아니므로 방향을 반드시 봐야 한다.
    if (
      !scoredThisShot.current &&
      prevY.current > RIM[1] &&
      b.position.y <= RIM[1] &&
      vel.current.y < 0
    ) {
      const hx = b.position.x - RIM[0];
      const hz = b.position.z - RIM[2];
      if (Math.hypot(hx, hz) < RIM_R) {
        scoredThisShot.current = true;
        sfxSwish();
        setFlash("골인!");
        flashUntil.current = now + 1.6;
      }
    }
    prevY.current = b.position.y;

    // 바닥에 닿으면 한 번 튕기고 멈춘다
    if (b.position.y <= BALL_R) {
      b.position.y = BALL_R;
      if (vel.current.y < -2.5) {
        vel.current.y = -vel.current.y * 0.42; // 반발
        vel.current.x *= 0.7;
        vel.current.z *= 0.7;
        sfxThud();
      } else {
        flying.current = false;
        vel.current.set(0, 0, 0);
        restTimer.current = 0;
        if (!scoredThisShot.current) {
          setFlash("빗나감");
          flashUntil.current = now + 1.2;
        }
      }
    }
  });

  // E키 — 사거리 안에서만. LocalPlayer의 E 처리와 겹치지 않는다(공은 INTERACTABLES에 없어
  // 그쪽 nearId가 null이라 조기 반환된다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && near) shoot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [near, shoot]);

  return (
    <mesh ref={ball} position={REST} material={mat} castShadow>
      <sphereGeometry args={[BALL_R, 16, 12]} />
      {(near || flash) && (
        <Html center distanceFactor={10} position={[0, 0.7, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {flash ?? "[E] 슛"}
          </div>
        </Html>
      )}
    </mesh>
  );
}
