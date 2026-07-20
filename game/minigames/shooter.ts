// 런앤건 슈터 — 간수 3웨이브(3·4·5명)를 전부 쓰러뜨리면 자물쇠가 풀린다.
//
// 화면이 세로라 사이드뷰가 좁다. 그래서 전진 대신 "왼쪽 구역에서 버티며 쏜다"로 잡았다.
// 간수 총알은 낮게 날아오므로 점프로 넘고, 점프 중엔 내 총알이 머리 위로 지나간다 —
// 쏘는 타이밍과 피하는 타이밍이 갈리는 게 이 판의 전부다.
import { ARCADE_H, ARCADE_W, type ArcadeGame, type ArcadeStatus } from "./types";

const GROUND_Y = 330; // 발이 닿는 높이
const WAVES = [3, 4, 5];
const TOTAL = WAVES.reduce((a, b) => a + b, 0);

const P_W = 14;
const P_H = 26;
const P_SPEED = 130;
const P_X_MIN = 12;
const P_X_MAX = 150; // 오른쪽 절반은 간수 몫
const P_HP = 3;
const P_INVULN = 1.1; // 피격 후 무적(초)

const JUMP_V = 270;
const GRAVITY = 900;

const SHOT_CD = 0.26;
const SHOT_SPEED = 430;
const SHOT_Y = 16; // 발 기준 총구 높이

const E_W = 14;
const E_H = 24;
const E_SPEED = 46;
const E_SHOT_SPEED = 205;
const E_SHOT_Y = 9; // 낮게 온다 — 점프로 넘을 수 있는 높이
const E_CD_MIN = 1.5;
const E_CD_MAX = 2.8;
const E_SPAWN_GAP = 0.7; // 같은 웨이브 안에서 한 명씩 들어오는 간격
const WAVE_GAP = 0.9;

interface Enemy {
  x: number;
  hp: number;
  cd: number;
  flash: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
}

export function createShooter(): ArcadeGame {
  let px = 40;
  let py = GROUND_Y; // 발 위치
  let vy = 0;
  let hp = P_HP;
  let invuln = 0;
  let shotCd = 0;
  let facing = 1;

  const enemies: Enemy[] = [];
  const myShots: Bullet[] = [];
  const theirShots: Bullet[] = [];

  let wave = 0;
  let toSpawn = 0; // 이번 웨이브에 남은 등장 인원
  let spawnCd = 0;
  let waveCd = 0.6; // 시작 직후 잠깐 숨 돌릴 시간
  let killed = 0;
  let state: ArcadeStatus = "playing";
  let hitFlash = 0;

  function rand(a: number, b: number): number {
    return a + Math.random() * (b - a);
  }

  return {
    status: () => state,
    progress: () =>
      `WAVE ${Math.max(1, wave)}/${WAVES.length}  처치 ${killed}/${TOTAL}  ♥${Math.max(0, hp)}`,

    update(dt, held, tapped) {
      if (state !== "playing") return;
      if (invuln > 0) invuln -= dt;
      if (hitFlash > 0) hitFlash -= dt;
      if (shotCd > 0) shotCd -= dt;

      // ── 이동/점프 ──
      const dir = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0);
      if (dir !== 0) {
        px += dir * P_SPEED * dt;
        facing = dir;
        if (px < P_X_MIN) px = P_X_MIN;
        else if (px > P_X_MAX) px = P_X_MAX;
      }
      const grounded = py >= GROUND_Y - 1e-6 && vy >= 0;
      if (grounded && (tapped.has("ArrowUp") || tapped.has("KeyW"))) {
        vy = -JUMP_V;
        py -= 1e-3; // 즉시 뜬 것으로 쳐 같은 프레임에 다시 착지 판정되지 않게
      }
      if (!grounded || vy < 0) {
        vy += GRAVITY * dt;
        py += vy * dt;
        if (py >= GROUND_Y) {
          py = GROUND_Y;
          vy = 0;
        }
      }

      // ── 사격 ──
      if (held.has("Space") && shotCd <= 0) {
        shotCd = SHOT_CD;
        myShots.push({ x: px + facing * (P_W / 2 + 2), y: py - SHOT_Y, vx: facing * SHOT_SPEED });
      }

      // ── 등장 ──
      if (enemies.length === 0 && toSpawn === 0) {
        if (wave >= WAVES.length) {
          state = "won";
          return;
        }
        waveCd -= dt;
        if (waveCd <= 0) {
          toSpawn = WAVES[wave];
          wave++;
          spawnCd = 0;
        }
      }
      if (toSpawn > 0) {
        spawnCd -= dt;
        if (spawnCd <= 0) {
          spawnCd = E_SPAWN_GAP;
          toSpawn--;
          enemies.push({ x: ARCADE_W + rand(10, 60), hp: 2, cd: rand(0.6, 1.6), flash: 0 });
        }
      }

      // ── 간수 ──
      for (const e of enemies) {
        if (e.flash > 0) e.flash -= dt;
        e.x -= E_SPEED * dt;
        e.cd -= dt;
        if (e.cd <= 0 && e.x < ARCADE_W) {
          e.cd = rand(E_CD_MIN, E_CD_MAX);
          theirShots.push({ x: e.x - E_W / 2, y: GROUND_Y - E_SHOT_Y, vx: -E_SHOT_SPEED });
        }
      }

      // ── 총알 이동 + 명중 ──
      for (let i = myShots.length - 1; i >= 0; i--) {
        const b = myShots[i];
        b.x += b.vx * dt;
        if (b.x < -10 || b.x > ARCADE_W + 10) {
          myShots.splice(i, 1);
          continue;
        }
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (
            b.x > e.x - E_W / 2 &&
            b.x < e.x + E_W / 2 &&
            b.y > GROUND_Y - E_H &&
            b.y < GROUND_Y
          ) {
            myShots.splice(i, 1);
            e.hp--;
            e.flash = 0.12;
            if (e.hp <= 0) {
              enemies.splice(j, 1);
              killed++;
              // 마지막 하나를 잡았으면 다음 웨이브까지 한 박자 쉰다
              if (enemies.length === 0 && toSpawn === 0) waveCd = WAVE_GAP;
            }
            break;
          }
        }
      }

      const hurt = () => {
        if (invuln > 0) return;
        hp--;
        invuln = P_INVULN;
        hitFlash = 0.25;
        if (hp <= 0) state = "lost";
      };

      for (let i = theirShots.length - 1; i >= 0; i--) {
        const b = theirShots[i];
        b.x += b.vx * dt;
        if (b.x < -10) {
          theirShots.splice(i, 1);
          continue;
        }
        if (b.x > px - P_W / 2 && b.x < px + P_W / 2 && b.y > py - P_H && b.y < py) {
          theirShots.splice(i, 1);
          hurt();
          if (state !== "playing") return;
        }
      }

      // 몸통 박치기 — 붙으면 한 대 주고 사라진다(뒤에 눌러앉아 벽이 되지 않게)
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(e.x - px) < (E_W + P_W) / 2 && py > GROUND_Y - E_H) {
          enemies.splice(j, 1);
          hurt();
          if (state !== "playing") return;
        } else if (e.x < -20) {
          // 뛰어넘어 흘려보낸 간수. 처치로 세지는 않지만 웨이브는 넘어간다 —
          // 안 그러면 점프로 다 피한 판이 영원히 안 끝난다(승리 판정은 웨이브 소진 기준).
          enemies.splice(j, 1);
        }
      }
    },

    draw(ctx) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

      // 배경: 감옥 창살 실루엣
      ctx.fillStyle = "rgba(148,163,184,0.07)";
      for (let x = 8; x < ARCADE_W; x += 26) ctx.fillRect(x, 60, 5, GROUND_Y - 60);
      ctx.fillStyle = "rgba(148,163,184,0.05)";
      ctx.fillRect(0, 56, ARCADE_W, 5);

      // 바닥
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, GROUND_Y, ARCADE_W, ARCADE_H - GROUND_Y);
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, GROUND_Y, ARCADE_W, 3);

      // 간수
      for (const e of enemies) {
        ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#1d4ed8";
        ctx.fillRect(e.x - E_W / 2, GROUND_Y - E_H, E_W, E_H);
        ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#0f172a";
        ctx.fillRect(e.x - E_W / 2, GROUND_Y - E_H, E_W, 6); // 모자
      }

      // 나(죄수복) — 무적 동안 깜빡인다
      const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
      if (!blink) {
        ctx.fillStyle = "#f97316";
        ctx.fillRect(px - P_W / 2, py - P_H, P_W, P_H);
        ctx.fillStyle = "#fed7aa";
        ctx.fillRect(px - P_W / 2, py - P_H, P_W, 7); // 머리
        ctx.fillStyle = "#0b0e14";
        for (let i = 0; i < 3; i++) ctx.fillRect(px - P_W / 2, py - 16 + i * 5, P_W, 2); // 줄무늬
      }

      ctx.fillStyle = "#fde047";
      for (const b of myShots) ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
      ctx.fillStyle = "#f43f5e";
      for (const b of theirShots) ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);

      if (hitFlash > 0) {
        ctx.fillStyle = `rgba(244,63,94,${Math.max(0, hitFlash) * 0.8})`;
        ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
      }

      // 웨이브 사이 안내
      if (enemies.length === 0 && toSpawn === 0 && wave < WAVES.length && state === "playing") {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 16px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`WAVE ${wave + 1}`, ARCADE_W / 2, 150);
        ctx.textAlign = "left";
      }

      // 남은 체력
      for (let i = 0; i < hp; i++) {
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.arc(12 + i * 14, 14, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(0.5, 0.5, ARCADE_W - 1, ARCADE_H - 1);
    },
  };
}

export const shooterDef = {
  id: "shooter",
  name: "탈옥 슈터",
  goal: "간수 3웨이브를 돌파하라",
  controls: "← → 이동 · ↑ 점프 · Space 발사 (총알은 낮게 온다 — 뛰어넘어라)",
  create: createShooter,
};
