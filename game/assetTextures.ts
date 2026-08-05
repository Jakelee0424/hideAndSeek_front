// OBJ/MTL 왕복에서 유실된 캔버스 텍스처를 런타임에 다시 그린다.
//
// 왜 필요한가 — OBJ/MTL 형식은 텍스처 맵을 못 싣는다(`map_Kd`로 **파일 경로**만 가리킬 수 있고,
// 원본이 코드로 그린 캔버스 텍스처는 파일이 아니다). 그런데 아래 재질들은 **생김새 전부가
// 텍스처에 있고 color를 아예 지정하지 않는다**(= three 기본값 흰색). 그래서 맵이 빠지면
// 순백 판이 된다. 게다가 `transparent: true`도 MTL이 못 실어서(d=1.0000) 불투명해진다.
// 실제로 감방 벽 낙서가 1.5×1.1m 순백 불투명 사각형으로, 거울 얼룩이 거울을 덮는 흰
// 사각형으로 렌더되고 있었다.
//
// 해법: **게임은 브라우저에서 돌아가니 캔버스가 있다.** 원본 아티팩트(prison-rooms.html ·
// prison-locks.html)의 그리기 코드는 순수 2D 캔버스 API로 자립돼 있어 그대로 옮기면 된다.
// (예전에 "GLB만이 해법"이라고 정리했던 건 Node 헤드리스에서 굽는 걸 전제한 이야기였다.)
//
// ⚠️ 그리기 코드는 원본과 **한 획도 다르지 않아야 한다.** 여기서 손대면 아티팩트를 다시
//    받았을 때 무엇이 원본이고 무엇이 우리 수정인지 구분할 수 없어진다.
// ⚠️ OBJ에 UV(vt)는 실려 있다 — 확인함(prison-rooms.obj의 vt 32,571줄, 면이 v/vt/vn 형식).
//    그래서 맵만 붙이면 원본 자리에 그대로 찍힌다.
//
// 재질을 추가하려면: 아래 TEXTURES에 한 줄 넣으면 된다. prisonAssets의 toStd()가 이름으로
// 조회해 자동으로 붙인다.
import * as THREE from "three";

type Draw = (x: CanvasRenderingContext2D, w: number, h: number) => void;

interface TexDef {
  w: number;
  h: number;
  draw: Draw;
  /** 원본이 transparent:true였는가. MTL이 못 싣는 값이라 여기서 되살린다. */
  transparent?: boolean;
  /** 원본이 반복시킨 경우의 repeat (u, v). */
  repeat?: [number, number];
  /** 원본이 DoubleSide였는가(철망처럼 얇은 판). */
  doubleSide?: boolean;
}

// ── prison-rooms.html ────────────────────────────────────────────
// 감방 벽 낙서: 정(正)자 표시 + 긁어 새긴 그림(새·해) + 마구잡이 긁힘.
const graffiti: Draw = (x, w, h) => {
  x.clearRect(0, 0, w, h);
  // 다섯씩 묶은 정(正)자 표시
  x.strokeStyle = "rgba(28,30,34,0.62)";
  for (let grp = 0; grp < 7; grp++) {
    const gx = 40 + grp * 88;
    const gy = 60;
    for (let i = 0; i < 4; i++) {
      x.lineWidth = 3 + Math.random() * 2;
      x.beginPath();
      x.moveTo(gx + i * 14, gy);
      x.lineTo(gx + i * 14 + (Math.random() - 0.5) * 6, gy + 62);
      x.stroke();
    }
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(gx - 6, gy + 56);
    x.lineTo(gx + 50, gy + 6);
    x.stroke();
  }
  // 둘째 줄(세다 만 것)
  for (let grp = 0; grp < 3; grp++) {
    const gx = 40 + grp * 88;
    const gy = 150;
    for (let i = 0; i < 3; i++) {
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(gx + i * 14, gy);
      x.lineTo(gx + i * 14 + (Math.random() - 0.5) * 5, gy + 58);
      x.stroke();
    }
  }
  // 긁어 새긴 그림: 새 + 해 (표식 세트와 이어진다)
  x.lineWidth = 4;
  x.strokeStyle = "rgba(28,30,34,0.55)";
  x.beginPath();
  x.moveTo(430, 300);
  x.quadraticCurveTo(470, 265, 508, 300);
  x.quadraticCurveTo(546, 265, 586, 300);
  x.stroke();
  x.beginPath();
  x.arc(180, 320, 30, 0, 7);
  x.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 7;
    x.beginPath();
    x.moveTo(180 + Math.cos(a) * 40, 320 + Math.sin(a) * 40);
    x.lineTo(180 + Math.cos(a) * 54, 320 + Math.sin(a) * 54);
    x.stroke();
  }
  // 마구 그은 자국
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(28,30,34,${0.2 + Math.random() * 0.3})`;
    x.lineWidth = 0.8 + Math.random() * 2;
    const sx = Math.random() * w;
    const sy = 380 + Math.random() * 100;
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(sx + (Math.random() - 0.5) * 120, sy + (Math.random() - 0.5) * 40);
    x.stroke();
  }
  // 파인 자국으로 읽히게 하는 밝은 모서리 하이라이트
  x.strokeStyle = "rgba(225,230,238,0.25)";
  for (let i = 0; i < 40; i++) {
    x.lineWidth = 0.8;
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    x.beginPath();
    x.moveTo(sx, sy - 1);
    x.lineTo(sx + (Math.random() - 0.5) * 90, sy - 1 + (Math.random() - 0.5) * 30);
    x.stroke();
  }
};

// 거울 얼룩: 손자국 같은 선 + 뿌연 반점.
const mirrorSmudge: Draw = (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.strokeStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 26; i++) {
    x.lineWidth = 0.6 + Math.random() * 1.6;
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(sx + (Math.random() - 0.5) * 70, sy + (Math.random() - 0.5) * 70);
    x.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const r = 20 + Math.random() * 40;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, "rgba(210,220,228,0.16)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr;
    x.beginPath();
    x.arc(cx, cy, r, 0, 7);
    x.fill();
  }
};

// 철망(마름모 그물코). 투명 + 양면 + 6×6 반복.
const chainlink: Draw = (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.strokeStyle = "rgba(150,156,164,0.95)";
  x.lineWidth = 5;
  x.lineCap = "round";
  const s = 64;
  for (let i = -1; i < w / s + 1; i++) {
    x.beginPath();
    for (let y = 0; y <= h; y += s) {
      const xx = i * s + ((y / s) % 2 ? s * 0.5 : 0);
      if (y) x.lineTo(xx + s * 0.5, y);
      else x.moveTo(xx, 0);
    }
    x.stroke();
  }
  for (let i = -1; i < w / s + 1; i++) {
    x.beginPath();
    x.moveTo(i * s, 0);
    for (let y = 0; y <= h; y += s) {
      x.lineTo(i * s + ((y / s) % 2 ? -s * 0.5 : s * 0.5), y);
    }
    x.stroke();
  }
  // 깊이감을 주는 어두운 겹줄
  x.strokeStyle = "rgba(70,76,84,0.5)";
  x.lineWidth = 2;
  for (let i = -1; i < w / s + 1; i++) {
    x.beginPath();
    x.moveTo(i * s + 2, 2);
    for (let y = 0; y <= h; y += s) {
      x.lineTo(i * s + 2 + ((y / s) % 2 ? -s * 0.5 : s * 0.5), y + 2);
    }
    x.stroke();
  }
};

// 경고판 글자면(노란 바탕 + 삼각형 + 느낌표).
const warningSign: Draw = (x, w, h) => {
  x.fillStyle = "#e8c34a";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#1c1e22";
  x.beginPath();
  x.moveTo(w / 2, 34);
  x.lineTo(w - 40, h - 52);
  x.lineTo(40, h - 52);
  x.closePath();
  x.fill();
  x.fillStyle = "#e8c34a";
  x.font = "bold 88px Arial";
  x.textAlign = "center";
  x.fillText("!", w / 2, h - 72);
  x.fillStyle = "#1c1e22";
  x.fillRect(30, h - 40, w - 60, 8);
};

// 작업장 공구 걸이판: 구멍 격자 + 없어진 공구의 페인트 자국(단서).
const pegboard: Draw = (x, w, h) => {
  x.fillStyle = "#8f6836";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(30,22,12,0.5)";
  for (let gy = 0; gy < 10; gy++)
    for (let gx = 0; gx < 15; gx++) {
      x.beginPath();
      x.arc(24 + gx * 38, 24 + gy * 38, 4, 0, 7);
      x.fill();
    }
  // 공구가 빠진 자리의 실루엣 = 단서
  x.fillStyle = "rgba(20,20,24,0.42)";
  x.fillRect(430, 60, 16, 130);
  x.fillRect(400, 50, 76, 26); // 없어진 망치
  x.beginPath();
  x.arc(520, 250, 34, 0, 7);
  x.fill(); // 없어진 렌치
};

// ── prison-locks.html ────────────────────────────────────────────
// 자물쇠는 **글자·숫자가 전부 텍스처에 있다.** 맵이 빠지면 문자 휠도 숫자 다이얼도
// 콤비네이션 휠도 전부 민무늬 원통이 된다 — 원본과 가장 크게 벌어지던 지점이다.

// 원본 dialTex(chars, bg, fg). 1024×128 띠에 글자를 균등 분할해 찍고 칸 경계를 긋는다.
// 원통을 감싸므로 map.offset.x로 어느 글자가 앞에 오는지 정해진다(콤비네이션 휠 넷이
// 각자 다른 숫자를 보이는 원리 — 적용은 prisonAssets의 toStd가 한다).
const dial =
  (chars: string, bg: string, fg: string): Draw =>
  (x, w, h) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = fg;
    x.font = "bold 78px Arial";
    x.textAlign = "center";
    x.textBaseline = "middle";
    const n = chars.length;
    for (let i = 0; i < n; i++) x.fillText(chars[i], ((i + 0.5) * w) / n, h / 2);
    x.strokeStyle = "rgba(0,0,0,0.3)";
    x.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      x.beginPath();
      x.moveTo((i * w) / n, 0);
      x.lineTo((i * w) / n, h);
      x.stroke();
    }
  };

// 의무실·식당·작업장 자물쇠의 회전식 숫자판(원판을 정면에서 본다).
const numberDial: Draw = (x, w, h) => {
  x.fillStyle = "#c2ccd6";
  x.fillRect(0, 0, w, h);
  x.strokeStyle = "#2a2d33";
  x.lineWidth = 4;
  x.beginPath();
  x.arc(w / 2, h / 2, w / 2 - 20, 0, 7);
  x.stroke();
  x.fillStyle = "#2a2d33";
  x.font = "bold 44px Arial";
  x.textAlign = "center";
  x.textBaseline = "middle";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 7 - Math.PI / 2;
    const r = w / 2 - 58;
    x.fillText(String(i), w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
  }
  x.fillStyle = "#d24545"; // 기준 표시(빨간 삼각)
  x.beginPath();
  x.moveTo(w / 2, 40);
  x.lineTo(w / 2 - 14, 70);
  x.lineTo(w / 2 + 14, 70);
  x.fill();
};

// 감방 자물쇠에 박힌 압수된 휴대용 게임기 화면(초록 줄). 원본도 매 로드마다 줄 길이가
// 무작위다 — 한 번 구워 재사용하므로 판마다 같은 화면이 나온다.
const consoleScreen: Draw = (x, w, h) => {
  x.fillStyle = "#0d1b12";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#3fae5a";
  for (let i = 0; i < 6; i++) x.fillRect(30, 30 + i * 24, 40 + Math.random() * 160, 10);
  x.fillStyle = "#57e07a";
  x.fillRect(30, 30, 60, 10);
};

const TEXTURES: Record<string, TexDef> = {
  graffiti_decal: { w: 680, h: 500, draw: graffiti, transparent: true },
  mirror_smudge: { w: 256, h: 360, draw: mirrorSmudge, transparent: true },
  chainlink_mesh: {
    w: 512,
    h: 512,
    draw: chainlink,
    transparent: true,
    doubleSide: true,
    repeat: [6, 6],
  },
  warning_sign_face: { w: 300, h: 220, draw: warningSign },
  pegboard_face: { w: 600, h: 400, draw: pegboard },

  // 자물쇠(prison-locks). 이름은 MTL 재질명과 같아야 한다 — `_0`~`_3` 꼬리는 baseName이 떼어
  // 여기 키와 맞춘다(콤비네이션 휠 넷이 한 정의를 공유하고 offset으로 갈린다).
  letter_wheel_face: { w: 1024, h: 128, draw: dial("ABCDEFGH", "#2a2d33", "#e7ebef") },
  front_gate_lock_wheel: { w: 1024, h: 128, draw: dial("0123456789", "#2a2d33", "#f2f5f8") },
  drain_lock_wheel: { w: 1024, h: 128, draw: dial("0123456789", "#4a4038", "#c9b99a") }, // 녹슨 배수관용 색
  number_dial_face: { w: 512, h: 512, draw: numberDial },
  console_screen: { w: 256, h: 200, draw: consoleScreen },
};

// 재질 이름은 여러 프리팹에서 되풀이된다(감방 4개가 같은 낙서를 쓴다) — 한 번만 그린다.
const cache = new Map<string, THREE.CanvasTexture>();

/** 원본 아티팩트의 tex() 헬퍼와 동일한 설정으로 캔버스를 굽는다. */
function bake(def: TexDef): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = def.w;
  c.height = def.h;
  const x = c.getContext("2d")!;
  def.draw(x, def.w, def.h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (def.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(def.repeat[0], def.repeat[1]);
  }
  return t;
}

export interface AssetTexture {
  map: THREE.CanvasTexture;
  transparent: boolean;
  doubleSide: boolean;
}

/**
 * 이 재질에 유실된 텍스처가 있으면 돌려준다. 없으면 null(= 그냥 두면 되는 재질).
 * 서버 렌더에선 캔버스가 없으므로 항상 null.
 */
export function assetTexture(name: string): AssetTexture | null {
  const def = TEXTURES[name];
  if (!def || typeof document === "undefined") return null;
  let map = cache.get(name);
  if (!map) {
    map = bake(def);
    cache.set(name, map);
  }
  return { map, transparent: !!def.transparent, doubleSide: !!def.doubleSide };
}
