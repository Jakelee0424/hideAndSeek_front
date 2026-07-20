// 스네이크 — 먹이 10개를 먹으면 자물쇠가 풀린다.
//
// 벽에 닿거나 제 몸을 물면 실패. 먹을수록 조금씩 빨라져 뒤로 갈수록 조여 온다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const CELL = 20;
const COLS = ARCADE_W / CELL; // 16
const ROWS = ARCADE_H / CELL; // 20

const TARGET = 10;
const STEP_MS = 135; // 한 칸 나아가는 간격
const STEP_STEP_MS = 5; // 하나 먹을 때마다 빨라지는 양
const STEP_MIN_MS = 85;

interface Cell {
  x: number;
  y: number;
}

const DIRS: Record<string, Cell> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
};

export function createSnake(): ArcadeGame {
  // 머리가 [0]. 가운데에서 오른쪽을 보고 길이 3으로 시작한다.
  const body: Cell[] = [
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ];
  let dir: Cell = { x: 1, y: 0 };
  // 이번 스텝에 실제로 적용될 방향. 한 스텝 안에 두 번 꺾어 제 몸으로 들어가는 걸 막는다.
  let pendingDir: Cell = dir;
  let food: Cell = placeFood();
  let eaten = 0;
  let state: ArcadeStatus = "playing";
  let acc = 0;
  let pop = 0; // 먹은 직후 먹이가 튀는 연출

  function placeFood(): Cell {
    // 몸이 20칸을 넘지 않으므로 빈 칸을 찾을 때까지 다시 뽑아도 충분히 싸다
    for (;;) {
      const c = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      if (!body.some((b) => b.x === c.x && b.y === c.y)) return c;
    }
  }

  function step(): void {
    dir = pendingDir;
    const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      state = "lost";
      return;
    }
    // 꼬리 끝은 이번 스텝에 비켜나므로 충돌로 세지 않는다(바짝 붙어 따라가기가 가능해진다).
    const tailIdx = body.length - 1;
    if (body.some((b, i) => i !== tailIdx && b.x === head.x && b.y === head.y)) {
      state = "lost";
      return;
    }

    body.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      eaten++;
      pop = 0.2;
      if (eaten >= TARGET) {
        state = "won";
        return;
      }
      food = placeFood();
    } else {
      body.pop();
    }
  }

  return {
    status: () => state,
    progress: () => `${Math.min(eaten, TARGET)} / ${TARGET}개`,

    update(dt, held, tapped) {
      if (state !== "playing") return;
      if (pop > 0) pop -= dt;

      for (const code of tapped) {
        const d = DIRS[code];
        // 180° 반전은 무시 — 누르는 즉시 제 목을 물어 억울하게 진다
        if (d && !(d.x === -dir.x && d.y === -dir.y)) {
          pendingDir = d;
          break;
        }
      }

      const interval = Math.max(STEP_MIN_MS, STEP_MS - eaten * STEP_STEP_MS);
      acc += dt * 1000;
      while (acc >= interval && state === "playing") {
        acc -= interval;
        step();
      }
    },

    draw(ctx) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, ARCADE_H);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(ARCADE_W, y * CELL + 0.5);
        ctx.stroke();
      }

      // 먹이
      const r = 6 + Math.max(0, pop) * 12;
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, r, 0, Math.PI * 2);
      ctx.fill();

      // 몸통 — 머리에서 멀어질수록 어두워진다
      body.forEach((b, i) => {
        const t = i / Math.max(1, body.length);
        ctx.fillStyle = i === 0 ? "#a7f3d0" : `rgba(52,211,153,${0.95 - t * 0.5})`;
        ctx.fillRect(b.x * CELL + 2, b.y * CELL + 2, CELL - 4, CELL - 4);
      });

      // 진행 방향 쪽 눈
      const h = body[0];
      ctx.fillStyle = "#0b0e14";
      const ex = h.x * CELL + CELL / 2 + dir.x * 4;
      const ey = h.y * CELL + CELL / 2 + dir.y * 4;
      ctx.fillRect(ex - 4, ey - 2, 3, 3);
      ctx.fillRect(ex + 1, ey - 2, 3, 3);

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const snakeDef = {
  id: "snake",
  name: "스네이크",
  goal: "먹이 10개를 먹어라",
  controls: "← → ↑ ↓ 방향 전환 (벽·제 몸에 닿으면 실패)",
  create: createSnake,
};
