"use client";
// 맵 전체 개요 미니맵 + 내 위치/시선 표시.
//
// 교도소 도면(prisonLayout의 BUILDINGS/WALL_BOXES에서 자동 생성)을 오프스크린 캔버스에 한 번만
// 그려 두고(맵은 매 판 고정), 매 프레임에는 그 정적 레이어를 blit한 뒤 플레이어 점만 얹는다.
// 위치는 localPos·worldState에서 직접 읽는다(React state가 아니라 리렌더 없이 rAF로만 갱신).
//
// ⚠️ 단서(POI)는 일부러 표시하지 않는다 — 탐색·채팅 공유를 강제하는 탈옥 시나리오를 무너뜨린다.
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { worldState, INTERP_DELAY_MS } from "@/net/worldState";
import { localPos } from "@/game/localPos";
import { FLOORS, WALL_BOXES, GATE, FLOOR2_Y } from "@/game/prisonLayout";

// 맵 월드 경계(외벽 바깥 사각). perimeter rect와 동일.
const X0 = -42, X1 = 42, Z0 = -30, Z1 = 30;
const PAD = 5; // 캔버스 안쪽 여백(px) — 가장자리 벽이 잘리지 않게
const CSS_W = 176; // 표시 폭(px). 높이는 맵 종횡비(84:60)로 파생
const CSS_H = Math.round((CSS_W * (Z1 - Z0)) / (X1 - X0)); // ≈126

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);
  const [onFloor2, setOnFloor2] = useState(false);

  // M키로 접기/펴기(시야를 가릴 때 끌 수 있게). 채팅 입력 중에는 무시.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM") return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CSS_W * dpr;
    canvas.height = CSS_H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 월드(x,z) → 캔버스(px). z+ = 북 = 화면 위, 동(-x) = 화면 오른쪽.
    // three.js 좌표계에선 +Z를 위로 놓으면 +X가 서쪽이라, x축을 뒤집어야 실제 방위(동=오른쪽)와 맞는다.
    const iw = CSS_W - 2 * PAD;
    const ih = CSS_H - 2 * PAD;
    const sx = (x: number) => PAD + ((X1 - x) / (X1 - X0)) * iw;
    const sy = (z: number) => PAD + ((Z1 - z) / (Z1 - Z0)) * ih;
    const scaleX = iw / (X1 - X0);
    const scaleZ = ih / (Z1 - Z0);

    // ── 정적 레이어(도면)를 오프스크린에 1회 렌더 ──
    const bg = document.createElement("canvas");
    bg.width = CSS_W;
    bg.height = CSS_H;
    const b = bg.getContext("2d")!;
    b.fillStyle = "#0b0e14"; // 맵 밖(어두운 바탕)
    b.fillRect(0, 0, CSS_W, CSS_H);
    // 방 바닥(각자의 색을 옅게). 배열 순서대로 — 연병장은 남쪽이라 방과 겹치지 않는다.
    for (const f of FLOORS) {
      const { x0, z0, x1, z1 } = f.rect;
      b.fillStyle = f.color;
      b.globalAlpha = 0.55;
      // x축 반전이라 화면 왼쪽 모서리는 큰 x(x1) 쪽.
      b.fillRect(sx(x1), sy(z1), (x1 - x0) * scaleX, (z1 - z0) * scaleZ);
    }
    b.globalAlpha = 1;
    // 벽(WALL_BOXES): 어두운 선으로. cx,cz,hx,hz → 사각.
    b.fillStyle = "#05070b";
    for (const w of WALL_BOXES) {
      const px = sx(w.cx + w.hx); // x축 반전 → 왼쪽 모서리는 +hx 쪽
      const py = sy(w.cz + w.hz);
      const pw = Math.max(1, w.hx * 2 * scaleX);
      const ph = Math.max(1, w.hz * 2 * scaleZ);
      b.fillRect(px, py, pw, ph);
    }
    // 외곽선 + 정문(파란 표식).
    b.strokeStyle = "rgba(255,255,255,0.18)";
    b.lineWidth = 1;
    b.strokeRect(PAD, PAD, iw, ih);
    b.fillStyle = "#38bdf8";
    b.fillRect(sx(GATE.x + GATE.width / 2), sy(GATE.z) - 1.5, GATE.width * scaleX, 3);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, CSS_W, CSS_H);
      ctx.drawImage(bg, 0, 0);

      // 다른 플레이어(정체는 숨김 — 무채색 점만). 봇도 일반 플레이어로 섞여 보인다.
      const myId = useGameStore.getState().myId;
      const renderTime = performance.now() - INTERP_DELAY_MS;
      ctx.fillStyle = "#e2e8f0";
      for (const id of worldState.ids()) {
        if (id === myId) continue;
        const t = worldState.sample(id, renderTime);
        if (!t) continue;
        ctx.beginPath();
        ctx.arc(sx(t.x), sy(t.z), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 나(하늘색) + 시선 화살표. 월드 방향 (sin,cos) → 화면 (-sin,-cos)(x축 반전 반영).
      const mx = sx(localPos.x);
      const my = sy(localPos.z);
      const dx = Math.sin(localPos.rot);
      const dz = Math.cos(localPos.rot);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(mx - dx * 6, my - dz * 6); // 앞끝
      ctx.lineTo(mx + dz * 3.2, my - dx * 3.2); // 좌
      ctx.lineTo(mx - dz * 3.2, my + dx * 3.2); // 우
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const f2 = localPos.y > FLOOR2_Y - 1;
      setOnFloor2((v) => (v === f2 ? v : f2));
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) {
    return (
      <div className="absolute right-4 top-16 rounded-md bg-black/40 px-2 py-1 text-[11px] text-slate-400 backdrop-blur">
        <kbd className="font-mono">M</kbd> 지도
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-16 rounded-lg border border-white/10 bg-black/40 p-1.5 backdrop-blur">
      <canvas
        ref={canvasRef}
        style={{ width: CSS_W, height: CSS_H }}
        className="block rounded"
      />
      <div className="pointer-events-none absolute left-2.5 top-2.5 text-[10px] font-semibold text-white/60">
        N ↑
      </div>
      {onFloor2 && (
        <div className="pointer-events-none absolute right-2.5 top-2.5 rounded bg-sky-500/70 px-1 text-[10px] font-semibold text-white">
          2층
        </div>
      )}
    </div>
  );
}
