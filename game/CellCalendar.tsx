"use client";
// 감방 벽걸이 달력 — 오늘 요일을 in-world로 알려 준다.
//
// 오늘 요일은 방 시드로 정해진다(cafeteriaPlan.today). 나레이션·식당 배식 순서표와 **같은 값**을
// 보여줘야 해서, 표시할 요일은 호출부(PrisonProps)가 cafeteriaPlan(roomId).today로 넘긴다.
// 식당 문(daycode)을 풀 때 쓰는 요일이 바로 이것 — 스폰 감방에서 미리 읽어 두라는 힌트다.
//
// 텍스처는 요일(0~6)마다 한 번만 굽는다(감방 4개가 같은 요일을 공유하므로 캐시가 맞아떨어진다).
import { useMemo } from "react";
import type { JSX } from "react";
import * as THREE from "three";
import { DAYS } from "./cafeteriaPlan";

// 요일 한 글자(헤더용). DAYS와 같은 순서(0=월 … 6=일).
const WD = ["월", "화", "수", "목", "금", "토", "일"];

const calCache = new Map<number, THREE.CanvasTexture>();

/** 요일 하나를 강조한 달력 종이를 캔버스에 굽는다. */
function bakeCalendar(day: number): THREE.CanvasTexture {
  const W = 512;
  const H = 660;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;

  // 종이 바탕 + 테두리
  x.fillStyle = "#f4efe3";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#3a3a3a";
  x.lineWidth = 6;
  x.strokeRect(12, 12, W - 24, H - 24);

  // 상단 붉은 띠 + 제목
  x.fillStyle = "#b23a3a";
  x.fillRect(12, 12, W - 24, 108);
  x.fillStyle = "#ffffff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "bold 58px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  x.fillText("달  력", W / 2, 66);

  // 요일 헤더 7칸(일=빨강, 토=파랑)
  const gx = 34;
  const gw = W - 68;
  const cellW = gw / 7;
  const headY = 190;
  x.font = "bold 42px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  for (let i = 0; i < 7; i++) {
    const cx = gx + cellW * i + cellW / 2;
    x.fillStyle = i === 6 ? "#c0392b" : i === 5 ? "#2f6fb0" : "#333333";
    x.fillText(WD[i], cx, headY);
  }
  // 헤더 밑줄
  x.strokeStyle = "#9a9a9a";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(gx, headY + 36);
  x.lineTo(gx + gw, headY + 36);
  x.stroke();

  // 오늘 요일 칸에 빨간 동그라미
  const tcx = gx + cellW * day + cellW / 2;
  x.strokeStyle = "#c0392b";
  x.lineWidth = 6;
  x.beginPath();
  x.arc(tcx, headY, 40, 0, Math.PI * 2);
  x.stroke();
  // 그 칸에서 아래로 내려오는 화살표
  x.beginPath();
  x.moveTo(tcx, headY + 52);
  x.lineTo(tcx, headY + 150);
  x.moveTo(tcx, headY + 150);
  x.lineTo(tcx - 14, headY + 128);
  x.moveTo(tcx, headY + 150);
  x.lineTo(tcx + 14, headY + 128);
  x.stroke();

  // 큰 판독부: "오늘" + 요일(예: 수요일)
  x.fillStyle = "#1f2a37";
  x.font = "bold 66px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  x.fillText("오 늘", W / 2, 430);
  x.fillStyle = "#c0392b";
  x.font = "bold 116px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  x.fillText(DAYS[day], W / 2, 540);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const PW = 0.62; // 달력 종이 폭(m)
const PH = 0.8; // 높이(m)

/**
 * 벽걸이 달력. 텍스처 면은 로컬 +z를 향하므로, 방 안을 보도록 rotationY(=PrisonProps의 faceIn)를 넘긴다.
 * 감옥 밤이 어두우니 텍스트가 읽히게 은은한 emissive를 얹는다(쪽지·자물쇠와 같은 유도 방식).
 */
export default function CellCalendar({
  day,
  position,
  rotationY = 0,
}: {
  day: number;
  position: [number, number, number];
  rotationY?: number;
}): JSX.Element {
  const tex = useMemo(() => {
    let t = calCache.get(day);
    if (!t) {
      t = bakeCalendar(day);
      calCache.set(day, t);
    }
    return t;
  }, [day]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 나무 백보드(종이보다 살짝 크게, 뒤쪽으로) */}
      <mesh castShadow>
        <boxGeometry args={[PW + 0.06, PH + 0.06, 0.03]} />
        <meshStandardMaterial color="#6b4f2a" roughness={0.85} />
      </mesh>
      {/* 달력 종이(방 안을 향하는 +z 면에 텍스처) */}
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[PW, PH]} />
        <meshStandardMaterial
          map={tex}
          emissive="#ffffff"
          emissiveMap={tex}
          emissiveIntensity={0.35}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}
