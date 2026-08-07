"use client";
// 대기방 오른편에 크게 띄우는 교도소 도면(게임 내 미니맵과 같은 그림).
//
// 실시간 미니맵(Minimap)은 worldState·localPos·rAF에 묶여 있어 게임 밖(대기방)에선 쓸 수 없다.
// 여기서는 그 정적 레이어(방 바닥색·벽·정문)만 캔버스에 한 번 그리고, 정문 입구와 진짜
// 탈출구인 배수관 자리에 깜빡이는 물음표를 얹어 "여기가 열쇠"라는 걸 미리 흘려 준다.
//
// ⚠️ 좌표·투영은 Minimap과 같은 규칙이다(x축 반전 = 동쪽이 화면 오른쪽). 한쪽을 바꾸면 같이 볼 것.
import { useEffect, useRef } from "react";
import { FLOORS, WALL_BOXES, GATE, PIPE } from "@/game/prisonLayout";

// 맵 월드 경계(외벽 바깥 사각).
const X0 = -42, X1 = 42, Z0 = -30, Z1 = 30;
// 내부 렌더 해상도(CSS로 100% 축소 표시). 맵 종횡비 84:60.
const W = 1200;
const H = Math.round((W * (Z1 - Z0)) / (X1 - X0)); // 857
const PAD = 34;

const IW = W - 2 * PAD;
const IH = H - 2 * PAD;
const sx = (x: number) => PAD + ((X1 - x) / (X1 - X0)) * IW; // x축 반전
const sy = (z: number) => PAD + ((Z1 - z) / (Z1 - Z0)) * IH; // z+ = 북 = 위
const SCALE_X = IW / (X1 - X0);
const SCALE_Z = IH / (Z1 - Z0);

// 물음표 마커 위치(캔버스 대비 %). 렌더 크기와 무관하게 비율로 얹는다.
const GATE_MARK = { left: (sx(GATE.x) / W) * 100, top: (sy(GATE.z) / H) * 100 };
const PIPE_MARK = { left: (sx(PIPE.x) / W) * 100, top: (sy(PIPE.z) / H) * 100 };

export default function LobbyMap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0e14"; // 맵 밖(어두운 바탕)
    ctx.fillRect(0, 0, W, H);

    // 방 바닥(각자의 색을 옅게).
    for (const f of FLOORS) {
      const { x0, z0, x1, z1 } = f.rect;
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(sx(x1), sy(z1), (x1 - x0) * SCALE_X, (z1 - z0) * SCALE_Z);
    }
    ctx.globalAlpha = 1;

    // 벽(WALL_BOXES): 어두운 사각.
    ctx.fillStyle = "#05070b";
    for (const w of WALL_BOXES) {
      const px = sx(w.cx + w.hx);
      const py = sy(w.cz + w.hz);
      ctx.fillRect(px, py, Math.max(1, w.hx * 2 * SCALE_X), Math.max(1, w.hz * 2 * SCALE_Z));
    }

    // 외곽선 + 정문(파란 표식) — 미니맵과 같은 표시.
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD, PAD, IW, IH);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(sx(GATE.x + GATE.width / 2), sy(GATE.z) - 2.5, GATE.width * SCALE_X, 5);
  }, []);

  // 바깥은 overflow를 자르지 않는다(가장자리의 물음표 마커가 잘리지 않게). 도면만 안쪽
  // 박스에서 rounded로 클립한다. 마커는 이 바깥 컨테이너 기준으로 얹혀 경계 밖으로 나가도 보인다.
  //
  // 크기: 모바일(세로 스크롤)은 폭 기준, lg(대기방이 화면 높이에 잠김)에서는 부모가 주는
  // 높이에 맞춰 줄어든다(h-full + w-auto + aspect-ratio). 마커 %는 컨테이너가 캔버스를
  // 딱 감싸는(w-fit) 한 그대로 맞는다.
  return (
    <div className="relative mx-auto w-full lg:h-full lg:w-fit lg:max-w-full">
      <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 lg:h-full lg:w-fit">
        {/* 폭은 그대로, 높이만 늘린다: 실제 맵 종횡비(84:60)보다 세로로 긴 박스에 그려 넣는다. */}
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="block w-full lg:h-full lg:w-auto lg:max-w-full"
          style={{ aspectRatio: "84 / 72" }}
        />
      </div>
      <div className="pointer-events-none absolute left-3 top-2 text-xs font-semibold text-white/60">
        N ↑
      </div>
      <QMark left={GATE_MARK.left} top={GATE_MARK.top} label="정문" labelAbove color="sky" />
      <QMark left={PIPE_MARK.left} top={PIPE_MARK.top} label="배수관" color="amber" />
    </div>
  );
}

// 깜빡이는 물음표 + 라벨. left/top은 맵 대비 %.
function QMark({
  left,
  top,
  label,
  labelAbove,
  color,
}: {
  left: number;
  top: number;
  label: string;
  labelAbove?: boolean;
  color: "sky" | "amber";
}) {
  const ring =
    color === "amber"
      ? "border-amber-300/70 bg-amber-400/20 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
      : "border-sky-300/70 bg-sky-400/20 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.55)]";
  const chip =
    color === "amber" ? "bg-amber-400/20 text-amber-100" : "bg-sky-400/20 text-sky-100";

  // Tailwind/CSS keyframes 의존 없이 Web Animations API로 확실히 깜빡이게 한다.
  const dotRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = dotRef.current;
    if (!el) return;
    const anim = el.animate([{ opacity: 1 }, { opacity: 0.12 }, { opacity: 1 }], {
      duration: 1100,
      iterations: Infinity,
      easing: "ease-in-out",
    });
    return () => anim.cancel();
  }, []);

  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {labelAbove && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${chip}`}>{label}</span>
      )}
      <span
        ref={dotRef}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg font-black ${ring}`}
      >
        ?
      </span>
      {!labelAbove && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${chip}`}>{label}</span>
      )}
    </div>
  );
}
