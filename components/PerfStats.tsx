"use client";
// 성능 계기판(F3). 프레임 드랍을 **눈이 아니라 숫자로** 보기 위한 것.
//
// 왜 필요한가 — "프레임이 드랍된다"는 신고는 원인 후보가 너무 많다(드로우콜 과다 / 셰이더
// 컴파일 정지 / GC / 리렌더 폭발 / 에셋 로드). 어느 쪽인지는 세 숫자로 갈린다:
//   · 드로우콜이 크고 FPS가 **꾸준히** 낮다      → 물체 수 문제(인스턴싱·그림자 대상 정리)
//   · 평균은 멀쩡한데 worst만 크게 튄다          → 정지형(셰이더 컴파일·GC·리렌더·로드)
//   · 특정 장소에서만 나빠진다                    → 그 구역 소품
// 그래서 평균 FPS와 함께 **최근 2초 최악 프레임 시간**을 같이 띄운다.
//
// 캔버스 안(Probe)에서 재고 캔버스 밖(Overlay)에서 그린다. 재는 쪽은 리렌더를 만들지 않고
// 모듈 변수에만 적어 두고, 그리는 쪽이 4Hz로 읽어 간다 — 계기판이 계기판을 방해하지 않게.
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const stats = {
  fps: 0,
  worstMs: 0, // 최근 창(WINDOW_MS)에서 가장 오래 걸린 프레임
  calls: 0,
  tris: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
};

const WINDOW_MS = 2000;

/** 캔버스 **안**에 둔다(useFrame·gl 접근). 아무것도 그리지 않는다. */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t0: performance.now(), frames: 0, worst: 0 });

  useFrame((_, dt) => {
    const a = acc.current;
    a.frames++;
    const ms = dt * 1000;
    if (ms > a.worst) a.worst = ms;
    const now = performance.now();
    if (now - a.t0 >= WINDOW_MS) {
      stats.fps = Math.round((a.frames * 1000) / (now - a.t0));
      stats.worstMs = Math.round(a.worst);
      a.t0 = now;
      a.frames = 0;
      a.worst = 0;
    }
    // render.calls는 프레임마다 자동 리셋된다 — 여기서 읽는 값은 직전 프레임 것이다.
    stats.calls = gl.info.render.calls;
    stats.tris = gl.info.render.triangles;
    stats.geometries = gl.info.memory.geometries;
    stats.textures = gl.info.memory.textures;
    stats.programs = gl.info.programs?.length ?? 0;
  });

  return null;
}

/** 캔버스 **밖**(DOM)에 둔다. F3로 켜고 끈다 — 기본은 꺼짐이라 발표 화면을 건드리지 않는다. */
export default function PerfStats() {
  const [on, setOn] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "F3") return;
      e.preventDefault(); // F3은 브라우저 "페이지 내 검색"이라 막아야 한다
      setOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => tick((v) => v + 1), 250);
    return () => window.clearInterval(id);
  }, [on]);

  if (!on) return null;
  const bad = stats.worstMs >= 50; // 20fps 아래로 떨어진 프레임이 있었다
  return (
    <div className="pointer-events-none fixed left-2 top-2 z-50 rounded bg-black/75 px-2 py-1 font-mono text-[11px] leading-4 text-emerald-300">
      <div>
        {stats.fps} fps · 최악{" "}
        <span className={bad ? "text-red-400" : "text-emerald-300"}>{stats.worstMs}ms</span>
      </div>
      <div>
        드로우콜 {stats.calls} · 삼각형 {(stats.tris / 1000).toFixed(0)}k
      </div>
      <div>
        지오메트리 {stats.geometries} · 텍스처 {stats.textures} · 셰이더 {stats.programs}
      </div>
    </div>
  );
}
