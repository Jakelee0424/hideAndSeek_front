// 쥐 잡기 — 감방 바닥 구멍에서 나오는 쥐 15마리를 때려잡으면 자물쇠가 풀린다.
//
// 두더지 잡기. 3×3 구멍을 키보드 QWE/ASD/ZXC에 그대로 대응시켰다 —
// 키 배열이 화면 배열과 같은 모양이라 따로 외울 게 없다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const TARGET = 15;
const MAX_ESCAPE = 8; // 이만큼 놓치면 실패

// 화면 3×3 ↔ 키보드 3×3. 순서가 곧 위치다.
const KEYS = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC"];
const KEY_LABEL = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"];

const COLS = 3;
const ROWS = 3;
const CELL_W = ARCADE_W / COLS; // 106.67
const GRID_TOP = 58;
const CELL_H = (ARCADE_H - GRID_TOP - 20) / ROWS; // 107.33

const UP_MS_START = 1150; // 쥐가 나와 있는 시간
const UP_MS_MIN = 620;
const UP_MS_STEP = 34; // 잡을수록 짧아진다
const GAP_MS_START = 620; // 다음 쥐가 나오기까지
const GAP_MS_MIN = 260;
const GAP_MS_STEP = 26;

interface Hole {
  /** 남은 등장 시간(초). 0 이하면 비어 있다. */
  up: number;
  /** 맞은 직후 연출(초). */
  bonk: number;
}

export function createWhack(): ArcadeGame {
  const holes: Hole[] = Array.from({ length: COLS * ROWS }, () => ({ up: 0, bonk: 0 }));
  let caught = 0;
  let escaped = 0;
  let state: ArcadeStatus = "playing";
  let gapAcc = 0;
  let missFlash = 0;

  function upMs(): number {
    return Math.max(UP_MS_MIN, UP_MS_START - caught * UP_MS_STEP);
  }
  function gapMs(): number {
    return Math.max(GAP_MS_MIN, GAP_MS_START - caught * GAP_MS_STEP);
  }

  /** 비어 있는 구멍 하나에 쥐를 올린다. 전부 차 있으면 아무것도 안 한다. */
  function pop(): void {
    const empty: number[] = [];
    for (let i = 0; i < holes.length; i++) {
      if (holes[i].up <= 0) empty.push(i);
    }
    if (empty.length === 0) return;
    holes[empty[Math.floor(Math.random() * empty.length)]].up = upMs() / 1000;
  }

  pop(); // 열자마자 한 마리는 나와 있게

  return {
    status: () => state,
    progress: () => `${Math.min(caught, TARGET)} / ${TARGET}  놓침 ${escaped}/${MAX_ESCAPE}`,

    update(dt, _held, tapped) {
      if (state !== "playing") return;
      if (missFlash > 0) missFlash -= dt;

      // 등장
      gapAcc += dt * 1000;
      if (gapAcc >= gapMs()) {
        gapAcc = 0;
        pop();
      }

      // 시간 경과 → 놓침
      for (const h of holes) {
        if (h.bonk > 0) h.bonk -= dt;
        if (h.up > 0) {
          h.up -= dt;
          if (h.up <= 0) {
            h.up = 0;
            escaped++;
            missFlash = 0.2;
            if (escaped >= MAX_ESCAPE) {
              state = "lost";
              return;
            }
          }
        }
      }

      // 타격
      for (let i = 0; i < KEYS.length; i++) {
        if (!tapped.has(KEYS[i])) continue;
        const h = holes[i];
        if (h.up <= 0) continue; // 빈 구멍을 쳐도 벌은 없다
        h.up = 0;
        h.bonk = 0.18;
        caught++;
        if (caught >= TARGET) {
          state = "won";
          return;
        }
      }
    },

    draw(ctx) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("키 배열이 곧 구멍 위치다", ARCADE_W / 2, 22);
      ctx.fillStyle = "#475569";
      ctx.fillText("Q W E / A S D / Z X C", ARCADE_W / 2, 38);

      for (let i = 0; i < holes.length; i++) {
        const cx = (i % COLS) * CELL_W + CELL_W / 2;
        const cy = GRID_TOP + Math.floor(i / COLS) * CELL_H + CELL_H / 2;
        const h = holes[i];

        // 구멍
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.ellipse(cx, cy + 16, 36, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        if (h.up > 0 || h.bonk > 0) {
          // 남은 시간이 짧을수록 몸을 낮춘다(곧 사라진다는 신호)
          const t = h.bonk > 0 ? 0 : Math.min(1, h.up / (upMs() / 1000));
          const rise = h.bonk > 0 ? 4 : 10 + t * 14;
          ctx.fillStyle = h.bonk > 0 ? "#fca5a5" : "#94a3b8";
          ctx.beginPath();
          ctx.arc(cx, cy + 16 - rise, 19, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(cx - 19, cy + 16 - rise, 38, rise);
          // 눈
          ctx.fillStyle = "#0b0e14";
          ctx.fillRect(cx - 8, cy + 8 - rise, 4, 4);
          ctx.fillRect(cx + 4, cy + 8 - rise, 4, 4);
          if (h.bonk > 0) {
            ctx.fillStyle = "#fde047";
            ctx.font = "bold 18px ui-monospace, monospace";
            ctx.fillText("✷", cx, cy - 6);
          }
        }

        // 키 라벨
        ctx.fillStyle = h.up > 0 ? "#fbbf24" : "#334155";
        ctx.font = "bold 12px ui-monospace, monospace";
        ctx.fillText(KEY_LABEL[i], cx, cy + 42);
      }

      if (missFlash > 0) {
        ctx.fillStyle = `rgba(244,63,94,${Math.max(0, missFlash) * 0.5})`;
        ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
      }

      ctx.textAlign = "left";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const whackDef = {
  id: "whack",
  name: "쥐 잡기",
  goal: "쥐 15마리를 때려잡아라",
  controls: "Q W E / A S D / Z X C — 구멍 위치와 같은 키. 8마리 놓치면 실패",
  create: createWhack,
};
