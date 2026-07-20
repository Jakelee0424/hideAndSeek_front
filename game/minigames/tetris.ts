// 테트리스 — 4줄을 지우면 자물쇠가 풀린다.
//
// 정식 규격(SRS 회전·홀드·고스트)은 일부러 따르지 않았다. 감방 하나를 여는 데 1분을 넘기면
// 안 되는 관문이라, 조각 7종·간단한 벽차기·4줄 목표까지만 남겼다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const COLS = 10;
const ROWS = 20;
const CELL = 20;
const BOARD_X = 10; // 판 왼쪽 여백 → 판은 10..210
const BOARD_Y = 0;
const PANEL_X = BOARD_X + COLS * CELL + 12; // 다음 조각·진행도

const TARGET_LINES = 4;

const FALL_MS = 620; // 기본 낙하 간격
const FALL_STEP_MS = 60; // 한 줄 지울 때마다 빨라지는 양
const FALL_MIN_MS = 320;
const SOFT_DROP_MS = 45; // ↓ 꾹 눌렀을 때
const DAS_MS = 170; // 좌우 첫 반복까지
const ARR_MS = 55; // 그 뒤 반복 간격

/** 조각 정의: N×N 격자 안의 채워진 칸. 회전은 (x,y) → (N-1-y, x)로 계산한다. */
interface Shape {
  n: number;
  cells: ReadonlyArray<readonly [number, number]>;
  color: string;
}

const SHAPES: Shape[] = [
  { n: 4, color: "#22d3ee", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] }, // I
  { n: 2, color: "#facc15", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
  { n: 3, color: "#c084fc", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] }, // T
  { n: 3, color: "#4ade80", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // S
  { n: 3, color: "#f87171", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // Z
  { n: 3, color: "#60a5fa", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // J
  { n: 3, color: "#fb923c", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // L
];

interface Piece {
  shape: Shape;
  /** 회전 상태(0~3). 실제 좌표는 rotated()가 계산한다. */
  rot: number;
  x: number;
  y: number;
}

/** 회전 상태를 적용한 칸 목록. */
function rotated(p: Piece): Array<[number, number]> {
  const { n, cells } = p.shape;
  return cells.map(([x, y]) => {
    let cx = x;
    let cy = y;
    for (let r = 0; r < p.rot; r++) {
      const nx = n - 1 - cy;
      cy = cx;
      cx = nx;
    }
    return [cx, cy] as [number, number];
  });
}

export function createTetris(): ArcadeGame {
  // null = 빈 칸, 문자열 = 굳은 블록의 색
  const grid: (string | null)[][] = Array.from({ length: ROWS }, () =>
    Array<string | null>(COLS).fill(null),
  );

  let bag: Shape[] = [];
  let piece: Piece = spawn();
  let next: Shape = draw();
  let lines = 0;
  let state: ArcadeStatus = "playing";

  let fallAcc = 0;
  let moveAcc = 0;
  let moveDir = 0; // 좌우 자동반복 상태
  let moveCharged = false; // DAS 대기를 넘겨 빠른 반복 구간에 들어갔는가
  let flash = 0; // 줄이 지워진 직후 잠깐 번쩍이는 연출

  // 7-bag: 같은 조각이 연달아 쏟아져 운으로 지는 판을 막는다.
  function draw(): Shape {
    if (bag.length === 0) {
      bag = [...SHAPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  }

  // y=0에서 시작한다. 위로 걸치게 하면(y=-1) 3×3 조각의 윗칸이 화면 밖이라
  // 무슨 조각이 나왔는지 안 보인다.
  function spawn(shape?: Shape): Piece {
    const s = shape ?? draw();
    return { shape: s, rot: 0, x: Math.floor((COLS - s.n) / 2), y: 0 };
  }

  /** 그 자리에 놓을 수 있는가(벽·바닥·굳은 블록과 겹치지 않는가). */
  function fits(p: Piece): boolean {
    for (const [cx, cy] of rotated(p)) {
      const x = p.x + cx;
      const y = p.y + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && grid[y][x]) return false; // y<0은 아직 천장 위 — 통과시킨다
    }
    return true;
  }

  function move(dx: number, dy: number): boolean {
    const t = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (!fits(t)) return false;
    piece = t;
    return true;
  }

  // 벽 옆이나 조각 옆에서 회전하면 겹치는데, 한두 칸 밀어 보고 되면 그 자리에 넣는다.
  // (정식 SRS 킥 테이블 대신 쓰는 근사 — 손맛 차이는 이 규모에선 드러나지 않는다)
  function rotate(): void {
    const t = { ...piece, rot: (piece.rot + 1) % 4 };
    for (const dx of [0, -1, 1, -2, 2]) {
      const k = { ...t, x: t.x + dx };
      if (fits(k)) {
        piece = k;
        return;
      }
    }
  }

  /** 조각을 굳히고 완성된 줄을 지운 뒤 다음 조각을 낸다. */
  function lock(): void {
    for (const [cx, cy] of rotated(piece)) {
      const y = piece.y + cy;
      // 천장 위에서 굳었다 = 쌓임이 판을 넘었다
      if (y < 0) {
        state = "lost";
        return;
      }
      grid[y][piece.x + cx] = piece.shape.color;
    }

    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; ) {
      if (grid[y].every((c) => c !== null)) {
        grid.splice(y, 1);
        grid.unshift(Array<string | null>(COLS).fill(null));
        cleared++;
        // y를 내리지 않는다 — 내려온 윗줄을 같은 자리에서 다시 검사해야 한다
      } else {
        y--;
      }
    }
    if (cleared > 0) {
      lines += cleared;
      flash = 0.18;
      if (lines >= TARGET_LINES) {
        state = "won";
        return;
      }
    }

    piece = spawn(next);
    next = draw();
    if (!fits(piece)) state = "lost";
  }

  return {
    status: () => state,
    progress: () => `${Math.min(lines, TARGET_LINES)} / ${TARGET_LINES}줄`,

    update(dt, held, tapped) {
      if (state !== "playing") return;
      if (flash > 0) flash -= dt;

      // 좌우: 처음 누르면 즉시 한 칸, 계속 누르면 DAS 뒤 빠르게 반복
      const dir = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0);
      if (dir !== moveDir) {
        moveDir = dir;
        moveAcc = 0;
        moveCharged = false;
        if (dir !== 0) move(dir, 0);
      } else if (dir !== 0) {
        moveAcc += dt * 1000;
        if (moveAcc >= (moveCharged ? ARR_MS : DAS_MS)) {
          moveAcc = 0;
          moveCharged = true;
          move(dir, 0);
        }
      }

      if (tapped.has("ArrowUp") || tapped.has("KeyX")) rotate();

      // 하드드롭: 바닥까지 내리고 바로 굳힌다
      if (tapped.has("Space")) {
        while (move(0, 1)) {
          /* 바닥까지 */
        }
        lock();
        fallAcc = 0;
        return;
      }

      const interval = held.has("ArrowDown")
        ? SOFT_DROP_MS
        : Math.max(FALL_MIN_MS, FALL_MS - lines * FALL_STEP_MS);
      fallAcc += dt * 1000;
      while (fallAcc >= interval && state === "playing") {
        fallAcc -= interval;
        if (!move(0, 1)) lock();
      }
    },

    draw(ctx) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

      // 판 배경 + 격자
      ctx.fillStyle = "#11151d";
      ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X + x * CELL + 0.5, BOARD_Y);
        ctx.lineTo(BOARD_X + x * CELL + 0.5, BOARD_Y + ROWS * CELL);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X, BOARD_Y + y * CELL + 0.5);
        ctx.lineTo(BOARD_X + COLS * CELL, BOARD_Y + y * CELL + 0.5);
        ctx.stroke();
      }

      const block = (gx: number, gy: number, color: string, alpha = 1) => {
        if (gy < 0) return;
        const px = BOARD_X + gx * CELL;
        const py = BOARD_Y + gy * CELL;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(255,255,255,0.22)"; // 위쪽 하이라이트로 입체감
        ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
        ctx.globalAlpha = 1;
      };

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = grid[y][x];
          if (c) block(x, y, c);
        }
      }

      if (state === "playing") {
        // 착지 예상 위치(고스트) — 하드드롭을 감으로 쓰게 해 준다
        const ghost = { ...piece };
        while (fits({ ...ghost, y: ghost.y + 1 })) ghost.y++;
        for (const [cx, cy] of rotated(ghost)) {
          block(ghost.x + cx, ghost.y + cy, piece.shape.color, 0.18);
        }
        for (const [cx, cy] of rotated(piece)) {
          block(piece.x + cx, piece.y + cy, piece.shape.color);
        }
      }

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, flash) * 0.9})`;
        ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(BOARD_X + 0.5, BOARD_Y + 0.5, COLS * CELL - 1, ROWS * CELL - 1);

      // 우측 패널: 다음 조각
      ctx.fillStyle = "#64748b";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("NEXT", PANEL_X, 16);
      ctx.fillStyle = next.color;
      const nb = 12;
      for (const [cx, cy] of next.cells) {
        ctx.fillRect(PANEL_X + cx * nb, 24 + cy * nb, nb - 2, nb - 2);
      }

      ctx.fillStyle = "#64748b";
      ctx.fillText("LINES", PANEL_X, 92);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 20px ui-monospace, monospace";
      ctx.fillText(`${Math.min(lines, TARGET_LINES)}`, PANEL_X, 114);
      ctx.fillStyle = "#475569";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(`/ ${TARGET_LINES}`, PANEL_X, 128);
    },
  };
}

export const tetrisDef = {
  id: "tetris",
  name: "테트리스",
  goal: "4줄을 지워라",
  controls: "← → 이동 · ↑ 회전 · ↓ 빨리 · Space 즉시 낙하",
  create: createTetris,
};
