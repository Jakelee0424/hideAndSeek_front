// 철창 사이 날기 — 창살 틈 12개를 통과하면 자물쇠가 풀린다.
//
// 플래피 버드. 세로로 긴 캔버스에 제일 잘 맞는 형태라 넣었다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const TARGET = 12;

const BIRD_X = 78;
const BIRD_R = 9;
const GRAVITY = 1250; // px/s²
const FLAP_V = -390; // 한 번 칠 때 위로 받는 속도

const GAP = 108; // 위아래 창살 사이 틈
const GAP_MIN_Y = 70; // 틈 중심이 올 수 있는 범위(천장·바닥에 붙지 않게)
const GAP_MAX_Y = ARCADE_H - 110;
const PIPE_W = 46;
const PIPE_GAP_X = 168; // 기둥 사이 가로 간격
const SPEED = 108; // px/s

interface Pipe {
  x: number;
  gapY: number;
  passed: boolean;
}

export function createFlappy(): ArcadeGame {
  let y = ARCADE_H / 2;
  let vy = 0;
  let started = false; // 첫 입력 전에는 떨어지지 않는다(열자마자 죽으면 억울하다)
  let passed = 0;
  let state: ArcadeStatus = "playing";
  let flapAnim = 0;
  let scroll = 0; // 배경 흐름

  const pipes: Pipe[] = [];
  for (let i = 0; i < 4; i++) {
    pipes.push({ x: ARCADE_W + 60 + i * PIPE_GAP_X, gapY: randGapY(), passed: false });
  }

  function randGapY(): number {
    return GAP_MIN_Y + Math.random() * (GAP_MAX_Y - GAP_MIN_Y);
  }

  return {
    status: () => state,
    progress: () => `${Math.min(passed, TARGET)} / ${TARGET}칸`,

    update(dt, _held, tapped) {
      if (state !== "playing") return;
      if (flapAnim > 0) flapAnim -= dt;

      if (tapped.has("Space") || tapped.has("ArrowUp")) {
        started = true;
        vy = FLAP_V;
        flapAnim = 0.14;
      }
      if (!started) return;

      scroll += SPEED * dt;
      vy += GRAVITY * dt;
      y += vy * dt;

      // 천장·바닥
      if (y - BIRD_R < 0 || y + BIRD_R > ARCADE_H) {
        state = "lost";
        return;
      }

      for (const p of pipes) {
        p.x -= SPEED * dt;

        // 통과 판정: 기둥 오른쪽 끝을 지나친 순간 한 번만
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          passed++;
          if (passed >= TARGET) {
            state = "won";
            return;
          }
        }

        // 충돌: 가로로 겹치는 동안 틈 밖이면 부딪힌 것
        if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
          if (y - BIRD_R < p.gapY - GAP / 2 || y + BIRD_R > p.gapY + GAP / 2) {
            state = "lost";
            return;
          }
        }

        // 왼쪽으로 나간 기둥은 오른쪽 끝으로 되돌려 재사용한다(할당 없이 무한 스크롤)
        if (p.x + PIPE_W < -10) {
          const rightmost = pipes.reduce((m, q) => Math.max(m, q.x), 0);
          p.x = rightmost + PIPE_GAP_X;
          p.gapY = randGapY();
          p.passed = false;
        }
      }
    },

    draw(ctx) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

      // 배경 벽돌 줄(흐르는 느낌만)
      ctx.fillStyle = "rgba(148,163,184,0.05)";
      for (let i = -1; i < 12; i++) {
        const by = ((i * 40 + ((scroll * 0.3) % 40)) + 400) % 440 - 20;
        ctx.fillRect(0, by, ARCADE_W, 18);
      }

      for (const p of pipes) {
        const top = p.gapY - GAP / 2;
        const bot = p.gapY + GAP / 2;
        // 창살 기둥
        ctx.fillStyle = "#475569";
        ctx.fillRect(p.x, 0, PIPE_W, top);
        ctx.fillRect(p.x, bot, PIPE_W, ARCADE_H - bot);
        ctx.fillStyle = "#64748b";
        ctx.fillRect(p.x, top - 10, PIPE_W, 10); // 틈 가장자리 턱
        ctx.fillRect(p.x, bot, PIPE_W, 10);
        // 세로 창살 무늬
        ctx.fillStyle = "rgba(15,23,42,0.5)";
        for (let i = 1; i < 4; i++) {
          ctx.fillRect(p.x + i * 11, 0, 3, top - 10);
          ctx.fillRect(p.x + i * 11, bot + 10, 3, ARCADE_H - bot - 10);
        }
      }

      // 죄수(공)
      ctx.save();
      ctx.translate(BIRD_X, y);
      ctx.rotate(Math.max(-0.5, Math.min(0.9, vy / 700)));
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(-BIRD_R, -3, BIRD_R * 2, 2); // 줄무늬
      ctx.fillRect(-BIRD_R, 2, BIRD_R * 2, 2);
      ctx.fillStyle = flapAnim > 0 ? "#fde047" : "#fed7aa"; // 칠 때 반짝
      ctx.fillRect(2, -6, 4, 4); // 눈
      ctx.restore();

      if (!started) {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 13px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("SPACE 로 날아라", ARCADE_W / 2, ARCADE_H / 2 - 60);
        ctx.textAlign = "left";
      }

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const flappyDef = {
  id: "flappy",
  name: "철창 사이 날기",
  goal: "창살 틈 12칸을 통과하라",
  controls: "Space(또는 ↑) 로 날갯짓 — 창살에 닿으면 실패",
  create: createFlappy,
};
