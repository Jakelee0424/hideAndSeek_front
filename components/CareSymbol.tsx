"use client";
// 세탁 관리 기호(ISO 방식) SVG 아이콘. 세탁실 퍼즐의 "오늘 세탁 일정"(벽)과 옷 라벨(건조대)이
// **같은 그림**을 써야 대조가 성립하므로 한 곳에서 그린다.
//
//   세탁   = 세탁조(사다리꼴 통) 안에 온도/손
//   표백   = 삼각형(빈 것=가능 / 빗금=산소계만 / X=금지)
//   건조   = 사각형(안의 원=기계건조, 점 개수=온도 / 세로줄=옷걸이 / 가로줄=뉘어서)
//   다림질 = 다리미(점 개수=온도 / X=금지)
//
// 기호 key는 laundryPlan.CARE_VARIANTS와 짝이다 — 한쪽만 늘리면 그림이 빠진다.
import type { CareCat } from "@/game/laundryPlan";

const STROKE = 3.4;

/** 금지 표시(기호 위에 크게 긋는 X). */
function Ban() {
  return (
    <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
      <line x1="7" y1="7" x2="41" y2="41" />
      <line x1="41" y1="7" x2="7" y2="41" />
    </g>
  );
}

function Wash({ v }: { v: string }) {
  return (
    <g>
      {/* 세탁조: 윗변이 물결인 사다리꼴 통 */}
      <path
        d="M7 15 L41 15 L37 41 L11 41 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M7 15 q4.2 -5 8.5 0 t8.5 0 t8.5 0 t8.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE * 0.7}
        strokeLinecap="round"
      />
      <text
        x="24"
        y="35"
        textAnchor="middle"
        fill="currentColor"
        fontSize={v === "hand" ? 14 : 15}
        fontWeight="700"
      >
        {v === "hand" ? "손" : v}
      </text>
    </g>
  );
}

function Bleach({ v }: { v: string }) {
  return (
    <g>
      <path
        d="M24 6 L43 42 L5 42 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* 산소계만: 삼각형 안 빗금 두 줄 */}
      {v === "oxygen" && (
        <g stroke="currentColor" strokeWidth={STROKE * 0.8} strokeLinecap="round">
          <line x1="17" y1="38" x2="27" y2="20" />
          <line x1="25" y1="38" x2="35" y2="20" />
        </g>
      )}
      {v === "none" && <Ban />}
    </g>
  );
}

function Dry({ v }: { v: string }) {
  return (
    <g>
      <rect
        x="6"
        y="9"
        width="36"
        height="33"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {(v === "tumbleLow" || v === "tumbleNone") && (
        <circle cx="24" cy="25.5" r="11" fill="none" stroke="currentColor" strokeWidth={STROKE} />
      )}
      {v === "tumbleLow" && <circle cx="24" cy="25.5" r="2.6" fill="currentColor" />}
      {v === "tumbleNone" && <Ban />}
      {/* 옷걸이 건조 = 세로줄 / 뉘어서 건조 = 가로줄 */}
      {v === "line" && (
        <line x1="24" y1="14" x2="24" y2="37" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      )}
      {v === "flat" && (
        <line x1="13" y1="25.5" x2="35" y2="25.5" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      )}
    </g>
  );
}

function Iron({ v }: { v: string }) {
  const dots = v === "110" ? 1 : v === "150" ? 2 : v === "200" ? 3 : 0;
  return (
    <g>
      {/* 다리미 옆모습: 바닥판 + 위로 좁아지는 몸통 */}
      <path
        d="M5 38 L43 38 L36 17 Q34 14 31 14 L14 14 Q10 14 8 20 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} cx={24 + (i - (dots - 1) / 2) * 8} cy="29" r="2.6" fill="currentColor" />
      ))}
      {v === "none" && <Ban />}
    </g>
  );
}

/**
 * 관리 기호 하나. 색은 currentColor라 감싸는 쪽에서 text-* 클래스로 정한다
 * (일정표=호박색 / 라벨=회색 계열로 구분해 쓴다).
 */
export default function CareSymbol({
  cat,
  value,
  size = 34,
  className = "",
}: {
  cat: CareCat;
  value: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-label={value}>
      {cat === "wash" ? (
        <Wash v={value} />
      ) : cat === "bleach" ? (
        <Bleach v={value} />
      ) : cat === "dry" ? (
        <Dry v={value} />
      ) : (
        <Iron v={value} />
      )}
    </svg>
  );
}
