// 벽돌깨기 — 벽돌 21개를 전부 부수면 자물쇠가 풀린다.
//
// 공을 놓치면 목숨 하나. 세 번 놓치면 실패다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const COLS = 7;
const ROWS = 3;
const BRICK_W = 42;
const BRICK_H = 16;
const BRICK_GAP = 2;
const BRICK_X0 = (ARCADE_W - (COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
const BRICK_Y0 = 56;

const PADDLE_W = 66;
const PADDLE_H = 10;
const PADDLE_Y = ARCADE_H - 28;
const PADDLE_SPEED = 360; // px/s

const BALL_R = 5;
const BALL_SPEED = 250; // px/s
const BALL_SPEEDUP = 1.02; // 벽돌을 깰 때마다 조금씩 빨라진다
const BALL_MAX = 400;

const LIVES = 3;
const ROW_COLORS = ["#f87171", "#fbbf24", "#4ade80"];

interface Brick {
  x: number;
  y: number;
  color: string;
  alive: boolean;
}

export function createBreakout(): ArcadeGame {
  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: BRICK_X0 + c * (BRICK_W + BRICK_GAP),
        y: BRICK_Y0 + r * (BRICK_H + BRICK_GAP),
        color: ROW_COLORS[r % ROW_COLORS.length],
        alive: true,
      });
    }
  }

  let paddleX = (ARCADE_W - PADDLE_W) / 2;
  let ballX = ARCADE_W / 2;
  let ballY = PADDLE_Y - BALL_R - 1;
  let vx = 0;
  let vy = 0;
  let stuck = true; // 패들에 붙어 있음 — Space로 발사
  let lives = LIVES;
  let broken = 0;
  let state: ArcadeStatus = "playing";
  let shake = 0;

  const total = bricks.length;

  function launch(): void {
    stuck = false;
    // 살짝 비스듬히 위로. 매번 같은 각도면 판이 똑같이 흘러가 지루하다.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    vx = Math.cos(angle) * BALL_SPEED;
    vy = Math.sin(angle) * BALL_SPEED;
  }

  function loseLife(): void {
    lives--;
    if (lives <= 0) {
      state = "lost";
      return;
    }
    stuck = true;
    vx = 0;
    vy = 0;
    shake = 0.25;
  }

  return {
    status: () => state,
    progress: () => `${broken} / ${total}  ♥${Math.max(0, lives)}`,

    update(dt, held, tapped) {
      if (state !== "playing") return;
      if (shake > 0) shake -= dt;

      const dir = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0);
      paddleX += dir * PADDLE_SPEED * dt;
      if (paddleX < 0) paddleX = 0;
      else if (paddleX > ARCADE_W - PADDLE_W) paddleX = ARCADE_W - PADDLE_W;

      if (stuck) {
        ballX = paddleX + PADDLE_W / 2;
        ballY = PADDLE_Y - BALL_R - 1;
        if (tapped.has("Space") || tapped.has("ArrowUp")) launch();
        return;
      }

      // 빠른 공이 벽돌을 뚫고 지나가지 않게 한 프레임을 잘게 나눠 굴린다.
      const speed = Math.hypot(vx, vy);
      const steps = Math.max(1, Math.ceil((speed * dt) / (BALL_R * 1.5)));
      const sdt = dt / steps;

      for (let s = 0; s < steps && state === "playing" && !stuck; s++) {
        ballX += vx * sdt;
        ballY += vy * sdt;

        // 좌우·천장
        if (ballX < BALL_R) {
          ballX = BALL_R;
          vx = Math.abs(vx);
        } else if (ballX > ARCADE_W - BALL_R) {
          ballX = ARCADE_W - BALL_R;
          vx = -Math.abs(vx);
        }
        if (ballY < BALL_R) {
          ballY = BALL_R;
          vy = Math.abs(vy);
        }

        // 바닥 아래로 빠짐
        if (ballY > ARCADE_H + BALL_R) {
          loseLife();
          break;
        }

        // 패들 — 맞은 지점이 바깥일수록 크게 꺾인다(조준할 수 있게)
        if (
          vy > 0 &&
          ballY + BALL_R >= PADDLE_Y &&
          ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
          ballX >= paddleX - BALL_R &&
          ballX <= paddleX + PADDLE_W + BALL_R
        ) {
          ballY = PADDLE_Y - BALL_R;
          const hit = (ballX - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2); // -1..1
          const angle = -Math.PI / 2 + hit * 1.0;
          const sp = Math.min(BALL_MAX, Math.hypot(vx, vy));
          vx = Math.cos(angle) * sp;
          vy = Math.sin(angle) * sp;
        }

        // 벽돌 — 파고든 깊이가 얕은 축으로 튕긴다(모서리에서 어색하게 뚫리지 않는다)
        for (const b of bricks) {
          if (!b.alive) continue;
          if (
            ballX + BALL_R < b.x ||
            ballX - BALL_R > b.x + BRICK_W ||
            ballY + BALL_R < b.y ||
            ballY - BALL_R > b.y + BRICK_H
          ) {
            continue;
          }
          b.alive = false;
          broken++;
          shake = 0.08;

          const overlapX = Math.min(ballX + BALL_R - b.x, b.x + BRICK_W - (ballX - BALL_R));
          const overlapY = Math.min(ballY + BALL_R - b.y, b.y + BRICK_H - (ballY - BALL_R));
          if (overlapX < overlapY) vx = -vx;
          else vy = -vy;

          const sp = Math.min(BALL_MAX, Math.hypot(vx, vy) * BALL_SPEEDUP);
          const a = Math.atan2(vy, vx);
          vx = Math.cos(a) * sp;
          vy = Math.sin(a) * sp;

          if (broken >= total) state = "won";
          break; // 한 스텝에 벽돌 하나만
        }
      }
    },

    draw(ctx) {
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
      }

      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(-20, -20, ARCADE_W + 40, ARCADE_H + 40);

      for (const b of bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(b.x, b.y, BRICK_W, 3);
      }

      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);

      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      if (stuck) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("SPACE 로 발사", ARCADE_W / 2, PADDLE_Y - 26);
        ctx.textAlign = "left";
      }

      // 남은 목숨
      for (let i = 0; i < lives; i++) {
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.arc(12 + i * 14, ARCADE_H - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const breakoutDef = {
  id: "breakout",
  name: "벽돌깨기",
  goal: "벽돌 21개를 모두 부숴라",
  controls: "← → 패들 이동 · Space 발사 (3번 놓치면 실패)",
  create: createBreakout,
};
