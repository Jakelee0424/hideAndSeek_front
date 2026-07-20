// 배관 두드리기 — 리듬에 맞춰 노트 24개를 쳐 내면 자물쇠가 풀린다.
//
// 노트가 위에서 내려와 판정선에 닿을 때 해당 방향키를 누른다. 놓친 노트가 6개면 실패.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const TARGET = 24;
const MAX_MISS = 6;

const LANES = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"] as const;
const LANE_GLYPH = ["◀", "▼", "▲", "▶"];
const LANE_COLOR = ["#f472b6", "#38bdf8", "#4ade80", "#fbbf24"];

const LANE_W = ARCADE_W / LANES.length; // 80
const HIT_Y = ARCADE_H - 74; // 판정선
const NOTE_R = 16;

const FALL_SPEED = 235; // px/s
const SPAWN_MS = 480; // 노트 간격
const SPAWN_MIN_MS = 330; // 뒤로 갈수록 촘촘해진다
const SPAWN_STEP_MS = 7;

const HIT_WINDOW = 26; // 판정선에서 이만큼 안이면 성공(px)
const MISS_Y = HIT_Y + NOTE_R + 18; // 여기까지 내려오면 놓친 것

interface Note {
  lane: number;
  y: number;
}

export function createRhythm(): ArcadeGame {
  const notes: Note[] = [];
  let hit = 0;
  let miss = 0;
  let combo = 0;
  let state: ArcadeStatus = "playing";
  let spawnAcc = 0;
  let spawned = 0;
  // 레인별 연출: 눌린 순간 밝아짐 / 판정 문구
  const laneFlash = [0, 0, 0, 0];
  let judge = "";
  let judgeT = 0;
  let shake = 0;

  function spawnInterval(): number {
    return Math.max(SPAWN_MIN_MS, SPAWN_MS - spawned * SPAWN_STEP_MS);
  }

  return {
    status: () => state,
    progress: () => `${Math.min(hit, TARGET)} / ${TARGET}  놓침 ${miss}/${MAX_MISS}`,

    update(dt, _held, tapped) {
      if (state !== "playing") return;
      if (judgeT > 0) judgeT -= dt;
      if (shake > 0) shake -= dt;
      for (let i = 0; i < laneFlash.length; i++) {
        if (laneFlash[i] > 0) laneFlash[i] -= dt;
      }

      // 노트 생성. 목표 수만큼만 내보낸다(다 치면 더 안 나온다).
      if (spawned < TARGET + miss) {
        spawnAcc += dt * 1000;
        if (spawnAcc >= spawnInterval()) {
          spawnAcc = 0;
          spawned++;
          notes.push({ lane: Math.floor(Math.random() * LANES.length), y: -NOTE_R });
        }
      }

      // 낙하 + 놓침 판정
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        n.y += FALL_SPEED * dt;
        if (n.y > MISS_Y) {
          notes.splice(i, 1);
          miss++;
          combo = 0;
          judge = "MISS";
          judgeT = 0.4;
          shake = 0.15;
          if (miss >= MAX_MISS) {
            state = "lost";
            return;
          }
        }
      }

      // 입력 판정: 그 레인에서 판정선에 가장 가까운 노트 하나
      for (let lane = 0; lane < LANES.length; lane++) {
        if (!tapped.has(LANES[lane])) continue;
        laneFlash[lane] = 0.12;

        let bestIdx = -1;
        let bestD = HIT_WINDOW;
        for (let i = 0; i < notes.length; i++) {
          if (notes[i].lane !== lane) continue;
          const d = Math.abs(notes[i].y - HIT_Y);
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        if (bestIdx < 0) continue; // 헛손질 — 벌은 없다(놓침만 센다)

        notes.splice(bestIdx, 1);
        hit++;
        combo++;
        judge = bestD < 10 ? "PERFECT" : "GOOD";
        judgeT = 0.35;
        if (hit >= TARGET) {
          state = "won";
          return;
        }
      }
    },

    draw(ctx) {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 10, 0);

      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(-10, 0, ARCADE_W + 20, ARCADE_H);

      // 레인
      for (let i = 0; i < LANES.length; i++) {
        const x = i * LANE_W;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)";
        ctx.fillRect(x, 0, LANE_W, ARCADE_H);
        if (laneFlash[i] > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.max(0, laneFlash[i]) * 0.9})`;
          ctx.fillRect(x, 0, LANE_W, ARCADE_H);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, ARCADE_H);
        ctx.stroke();
      }

      // 판정선 + 레인별 표적
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, HIT_Y - 1, ARCADE_W, 2);
      for (let i = 0; i < LANES.length; i++) {
        const cx = i * LANE_W + LANE_W / 2;
        ctx.strokeStyle = LANE_COLOR[i];
        ctx.globalAlpha = laneFlash[i] > 0 ? 1 : 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, HIT_Y, NOTE_R + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = LANE_COLOR[i];
        ctx.font = "13px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(LANE_GLYPH[i], cx, ARCADE_H - 26);
      }

      // 노트
      for (const n of notes) {
        const cx = n.lane * LANE_W + LANE_W / 2;
        ctx.fillStyle = LANE_COLOR[n.lane];
        ctx.beginPath();
        ctx.arc(cx, n.y, NOTE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.font = "bold 14px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(LANE_GLYPH[n.lane], cx, n.y + 5);
      }

      // 판정 문구 + 콤보
      if (judgeT > 0) {
        ctx.globalAlpha = Math.min(1, judgeT * 3);
        ctx.fillStyle = judge === "MISS" ? "#f43f5e" : judge === "PERFECT" ? "#4ade80" : "#e2e8f0";
        ctx.font = "bold 20px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(judge, ARCADE_W / 2, HIT_Y - 52);
        ctx.globalAlpha = 1;
      }
      if (combo >= 3) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 15px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${combo} COMBO`, ARCADE_W / 2, 30);
      }
      ctx.textAlign = "left";

      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const rhythmDef = {
  id: "rhythm",
  name: "배관 두드리기",
  goal: "박자 맞춰 24번 쳐라",
  controls: "← ↓ ↑ → 노트가 선에 닿을 때 — 6번 놓치면 실패",
  create: createRhythm,
};
