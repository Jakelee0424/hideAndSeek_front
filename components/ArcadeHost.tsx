"use client";
// 미니게임 한 판을 돌리는 껍데기. 캔버스·rAF 루프·키 입력·성공/실패 화면을 전부 맡는다.
//
// 게임 로직(ArcadeGame)은 React를 모르는 순수 객체다. 여기서만 훅을 쓰므로 게임을 추가할 때
// 리렌더나 훅 규칙을 신경 쓸 일이 없다.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARCADE_H,
  ARCADE_W,
  type ArcadeGame,
  type ArcadeStatus,
  type MinigameDef,
} from "@/game/minigames/types";
import { sfxClear, sfxGameOver } from "@/game/sfx";

/** 클리어를 보여 주고 자물쇠를 여는 데까지 두는 시간(ms). 바로 닫으면 이긴 줄도 모른다. */
const WIN_HOLD_MS = 900;

/** 브라우저 기본 동작(스크롤 등)을 막을 키. 게임에 쓰는 키들이다. */
const SWALLOW = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export default function ArcadeHost({
  def,
  onWin,
}: {
  def: MinigameDef;
  onWin: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ArcadeGame | null>(null);
  const [run, setRun] = useState(0); // 재도전할 때마다 증가 → 새 판
  const [status, setStatus] = useState<ArcadeStatus>("playing");
  const [progress, setProgress] = useState("");

  // onWin이 매 렌더 새 함수여도 루프를 다시 걸지 않도록 ref로 잡아 둔다.
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const retry = useCallback(() => {
    setStatus("playing");
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 고해상도 화면에서 도트가 뭉개지지 않게 픽셀 밀도를 반영한다.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = ARCADE_W * dpr;
    canvas.height = ARCADE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const game = def.create();
    gameRef.current = game;

    const held = new Set<string>();
    const tapped = new Set<string>();

    const onDown = (e: KeyboardEvent) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      if (e.code === "Escape") return; // 모달 닫기는 PuzzleOverlay 담당
      if (!e.repeat) tapped.add(e.code); // 꾹 누른 자동반복은 "새로 눌림"이 아니다
      held.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.code);
    // 창을 벗어나면 눌린 채로 남는다(alt+tab 하면 캐릭터가 계속 달리는 그 현상)
    const onBlur = () => held.clear();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);

    let raf = 0;
    let prev = performance.now();
    let last: ArcadeStatus = "playing";
    let lastProgress = "";
    let winTimer: ReturnType<typeof setTimeout> | null = null;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // 탭을 다시 켜면 dt가 몇 초씩 튄다 — 그대로 넣으면 공이 벽을 뚫고 뱀이 순식간에 죽는다.
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      game.update(dt, held, tapped);
      tapped.clear();
      game.draw(ctx);

      const p = game.progress();
      if (p !== lastProgress) {
        lastProgress = p;
        setProgress(p);
      }

      const s = game.status();
      if (s !== last) {
        last = s;
        setStatus(s);
        if (s === "won") {
          sfxClear();
          winTimer = setTimeout(() => onWinRef.current(), WIN_HOLD_MS);
        } else if (s === "lost") {
          sfxGameOver();
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      if (winTimer) clearTimeout(winTimer);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [def, run]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between text-xs">
        <span className="font-medium text-amber-300">🎮 {def.name}</span>
        <span className="font-mono text-slate-400">{progress}</span>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ aspectRatio: `${ARCADE_W} / ${ARCADE_H}`, imageRendering: "pixelated" }}
        />

        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 backdrop-blur-[2px]">
            {status === "won" ? (
              <>
                <p className="text-2xl font-black tracking-widest text-emerald-400">
                  CLEAR!
                </p>
                <p className="text-sm text-slate-300">자물쇠가 풀렸다</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black tracking-widest text-rose-400">
                  GAME OVER
                </p>
                <button
                  onClick={retry}
                  className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  다시 도전
                </button>
                <p className="text-xs text-slate-500">Esc로 나갔다가 와도 된다</p>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        {def.goal}
        <br />
        <span className="text-slate-500">{def.controls}</span>
      </p>
    </div>
  );
}
