"use client";
// 퍼즐 UI 오버레이. openId가 있으면 표시.
//   note      → 힌트 문구만
//   lockbox   → 자물쇠 종류별 UI
//                 감방 자물쇠(minigame) → 아케이드 한 판(ArcadeHost)
//                 탈옥문(dial)          → 네 자리 코드 입력
// 풀면 sendSolve(협동 동기화) + markSolved(로컬 즉시 반영) → 감방문이 열린다.
import { useEffect, useRef, useState } from "react";
import ArcadeHost from "./ArcadeHost";
import {
  findInteractable,
  minigameFor,
  useInteraction,
  type ColorKey,
  type Puzzle,
} from "@/game/interactables";
import { sendDoor, sendSolve } from "@/net/stompClient";
import { toolCode } from "@/game/toolCode";
import { liarPuzzle } from "@/game/liarPuzzle";
import { cafeteriaPlan } from "@/game/cafeteriaPlan";
import { symbolIcon } from "@/game/symbols";
import { useGameStore } from "@/store/gameStore";

const COLORS: Record<ColorKey, { bg: string; ring: string; label: string }> = {
  red: { bg: "bg-red-500", ring: "ring-red-300", label: "빨강" },
  yellow: { bg: "bg-yellow-400", ring: "ring-yellow-200", label: "노랑" },
  green: { bg: "bg-green-500", ring: "ring-green-300", label: "초록" },
  blue: { bg: "bg-blue-500", ring: "ring-blue-300", label: "파랑" },
};

export default function PuzzleOverlay() {
  const openId = useInteraction((s) => s.openId);
  const close = useInteraction((s) => s.close);
  const markSolved = useInteraction((s) => s.markSolved);
  const data = findInteractable(openId);
  // 어느 감방에 어느 게임이 걸리는지는 방 코드로 정해진다(같은 방이면 모두 같은 배치).
  const roomId = useGameStore((s) => s.roomId);

  const [error, setError] = useState(false);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => setError(false), [openId]);

  if (!data) return null;

  function solve() {
    const roomId = useGameStore.getState().roomId;
    // 서버에 해결 알림(방 전체 동기화) + 로컬 즉시 반영(오프라인에서도 동작)
    sendSolve(roomId, data!.id);
    markSolved(data!.id);
    // 서버 이동 충돌은 openDoors 기준이라, 그 방 감방문도 서버에서 열어줘야 통과된다.
    // (닫힘 상태에서 1회 요청 → 열림. 해결은 1회뿐이라 토글이 어긋나지 않는다.)
    if (data!.opensDoor) sendDoor(roomId, data!.opensDoor);
  }

  function fail() {
    setError(true);
  }

  return (
    // z-index를 drei <Html> 최댓값(≈16,777,271) 위로 올린다 —
    // 안 그러면 3D 라벨(호실명·닉네임)이 모달 위로 뚫고 나온다.
    <div
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 16777300 }}
    >
      {/* 미니게임은 세로로 길다 — 작은 화면에서 잘리지 않게 모달 안에서 스크롤시킨다. */}
      <div className="max-h-[94vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-[#12161f] p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{data.label}</h2>
          <button
            onClick={close}
            className="rounded px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
          >
            닫기 (Esc)
          </button>
        </div>

        {/* 힌트/안내 문구 */}
        {data.hint && (
          <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            💡 {data.hint}
          </div>
        )}

        {data.type === "note" || !data.puzzle ? (
          <>
            {/* 게시물(배식 순서표·식단표)은 방 코드로 만든 표를 띄운다. */}
            {data.board && <CafeBoard board={data.board} roomId={roomId} />}
            <button
              onClick={close}
              className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              확인
            </button>
          </>
        ) : (
          <PuzzleInput
            // 퍼즐 종류/대상이 바뀌면 입력 상태를 새로 시작
            key={data.id}
            objectId={data.id}
            roomId={roomId}
            puzzle={data.puzzle}
            error={error}
            onSolve={solve}
            onFail={fail}
            clearError={() => setError(false)}
          />
        )}
      </div>
    </div>
  );
}

// 자물쇠 종류별 입력 UI. 정답이면 onSolve, 틀리면 onFail.
function PuzzleInput({
  objectId,
  roomId,
  puzzle,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  objectId: string;
  roomId: string;
  puzzle: Puzzle;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  switch (puzzle.kind) {
    case "minigame": {
      const def = minigameFor(objectId, roomId);
      // 배정에 실패할 일은 없지만(자물쇠는 전부 목록에 있다), 없으면 문을 영영 못 여는
      // 사태가 되므로 조용히 통과시킨다 — 게임이 막히는 것보다 낫다.
      if (!def) return <SubmitRow error={error} onSubmit={onSolve} />;
      return <ArcadeHost def={def} onWin={onSolve} />;
    }
    case "dial":
      return (
        <WheelLock
          length={puzzle.code.length}
          mod={10}
          render={(n) => String(n)}
          check={(vals) => vals.join("") === puzzle.code}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "letters":
      return (
        <WheelLock
          length={puzzle.answer.length}
          mod={26}
          render={(n) => String.fromCharCode(65 + n)}
          check={(vals) =>
            vals.map((n) => String.fromCharCode(65 + n)).join("") ===
            puzzle.answer.toUpperCase()
          }
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "sequence":
      return (
        <SequenceLock
          palette={puzzle.palette}
          answer={puzzle.answer}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "switches":
      return (
        <SwitchLock
          answer={puzzle.answer}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "toolcode":
      return (
        <ToolCodeLock
          // 표·답은 방 코드로 정해진다 — 같은 방이면 모두 같은 문제를 본다.
          tc={toolCode(roomId)}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "hammer":
      // 반사신경 게임 — 방 시드·정답이 없다(각자 제 손으로 자물쇠를 부순다). 성공하면 문이 열린다.
      return <HammerLock onSolve={onSolve} />;
    case "liar":
      return (
        <LiarLock
          // 문제·정답은 방 코드로 정해진다 — 같은 방이면 모두 같은 문제를 본다.
          lp={liarPuzzle(roomId)}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    case "daycode": {
      // 정답 = 오늘 요일의 배식 코드. 오늘 요일은 나레이션이 알려주고, 코드 표는 문 앞 순서표에 있다.
      const code = cafeteriaPlan(roomId).code;
      return (
        <WheelLock
          length={code.length}
          mod={10}
          render={(n) => String(n)}
          check={(vals) => vals.join("") === code}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    }
    case "fridgecode": {
      // 정답 = 반찬 4개 실제 칼로리의 합. 식단표(기준량·칼로리)와 식판(실제량)으로 계산한다.
      const code = cafeteriaPlan(roomId).fridgeCode;
      return (
        <WheelLock
          length={code.length}
          mod={10}
          render={(n) => String(n)}
          check={(vals) => vals.join("") === code}
          error={error}
          onSolve={onSolve}
          onFail={onFail}
          clearError={clearError}
        />
      );
    }
  }
}

// ── 식당 게시물(배식 순서표 / 오늘의 식단표 / 식판) ───────────────
// 방 코드로 만든 표를 그대로 읽어 준다.
//   - cafe-order: 요일→배식 코드(입장). 오늘 요일은 강조하지 않는다(나레이션에서 들은 요일을 스스로 찾는다).
//   - cafe-menu : 오늘 반찬 4개의 기준량·기준칼로리(→ 1g당 칼로리). 간식은 없다.
//   - cafe-tray : 식판 항목의 실제 담긴 양. 반찬 4 + 간식 1(식단표에 없는 항목이 간식 = 계산 제외).
function CafeBoard({
  board,
  roomId,
}: {
  board: "cafe-order" | "cafe-menu" | "cafe-tray";
  roomId: string;
}) {
  const plan = cafeteriaPlan(roomId);
  const head: string[] =
    board === "cafe-order"
      ? ["요일", "배식 코드"]
      : board === "cafe-menu"
        ? ["반찬", "기준량", "기준 칼로리"]
        : ["식판 항목", "담긴 양"];
  const rows: string[][] =
    board === "cafe-order"
      ? plan.order.map((o) => [o.day, o.code])
      : board === "cafe-menu"
        ? plan.menu.map((d) => [d.name, `${d.std} g`, `${d.cal} kcal`])
        : plan.tray.map((t) => [t.name, `${t.amount} g`]);
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-white/5">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-1.5 ${ci === 0 ? "text-slate-200" : "font-mono text-sky-300"}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 거짓말 탐정(배수관 최종 퍼즐) ─────────────────────────────────
// 화자들의 진술 + "진실은 정확히 K명" 제약으로 누가 진실인지 가려, 표식 4개를 진짜 자리에 배열.
function LiarLock({
  lp,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  lp: ReturnType<typeof liarPuzzle>;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  // 각 자리(1~4번째)에 놓인 표식의 인덱스(lp.symbols 기준). 초기값은 후보 순서 그대로.
  const [slots, setSlots] = useState<number[]>(() =>
    lp.symbols.map((_, i) => i),
  );

  function cycle(slot: number, dir: number) {
    clearError();
    setSlots((prev) => {
      const next = [...prev];
      next[slot] = (next[slot] + dir + lp.symbols.length) % lp.symbols.length;
      return next;
    });
  }

  const chosen = slots.map((i) => lp.symbols[i]);
  const dup = new Set(chosen).size !== chosen.length;

  return (
    <>
      {/* 제약 */}
      <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        진실을 말하는 사람은 <b>정확히 {lp.truthCount}명</b>, 나머지는 거짓말쟁이다.
      </div>

      {/* 화자 진술 */}
      <div className="mb-4 space-y-1 rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
        {lp.speakers.map((s) => (
          <div key={s.label} className="flex gap-2">
            <span className="w-4 font-mono font-semibold text-sky-300">
              {s.label}
            </span>
            <span className="text-slate-200">{s.text}</span>
          </div>
        ))}
      </div>

      {/* 배열 입력 */}
      <p className="mb-2 text-xs text-slate-400">표식 4개를 진짜 자리에 배열하라.</p>
      <div className="mb-4 space-y-2">
        {slots.map((symIdx, slot) => {
          const sym = lp.symbols[symIdx];
          const icon = symbolIcon(sym);
          return (
            <div key={slot} className="flex items-center gap-2">
              <span className="w-12 text-xs text-slate-400">{slot + 1}번째</span>
              <button
                onClick={() => cycle(slot, -1)}
                className="h-8 w-8 rounded bg-white/5 text-slate-300 hover:bg-white/10"
              >
                ◀
              </button>
              <div className="flex min-w-[96px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm">
                {icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icon}
                    alt={sym}
                    className="h-5 w-5 object-contain drop-shadow"
                  />
                )}
                <span className="text-slate-100">{sym}</span>
              </div>
              <button
                onClick={() => cycle(slot, +1)}
                className="h-8 w-8 rounded bg-white/5 text-slate-300 hover:bg-white/10"
              >
                ▶
              </button>
            </div>
          );
        })}
      </div>

      {dup && (
        <p className="mb-2 text-center text-xs text-amber-400">
          같은 표식이 중복됐다 — 넷을 서로 다르게 놓아야 한다.
        </p>
      )}
      <SubmitRow
        error={error}
        onSubmit={() => (chosen.join("") === lp.answer.join("") ? onSolve() : onFail())}
      />
    </>
  );
}

// ── 도구 이름→숫자 퀴즈(작업장 비밀번호) ──────────────────────────
// 규칙을 보여줄 표(도구 3개 + 값) + 물음표 도구 + 숫자 휠 입력. 답은 toolCode가 방 코드로 정한다.
function ToolCodeLock({
  tc,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  tc: ReturnType<typeof toolCode>;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  return (
    <>
      <div className="mb-4 space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-base">
        {tc.rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between">
            <span className="text-slate-200">{r.name}</span>
            <span className="text-slate-500">→</span>
            <span className="w-12 text-right text-sky-300">{r.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
          <span className="font-semibold text-amber-200">{tc.target}</span>
          <span className="text-slate-500">→</span>
          <span className="w-12 text-right text-amber-300">?</span>
        </div>
      </div>
      <WheelLock
        length={tc.digits}
        mod={10}
        render={(n) => String(n)}
        check={(vals) => vals.join("") === tc.answer}
        error={error}
        onSolve={onSolve}
        onFail={onFail}
        clearError={clearError}
      />
    </>
  );
}

// ── 망치질로 자물쇠 부수기(작업장 문 잠금장치) ─────────────────────
// 오른쪽 세로 게이지에서 화살표가 위아래로 왕복한다. 가운데 초록 구간에 화살표가 왔을 때
// Space(또는 버튼)로 내려치면 명중. 네 번 명중하면 왼쪽 도어락이 부서지며 문이 열린다(onSolve).
// 빗나가면 진행이 없다(감점 없음). 반사신경 게임이라 방 시드·정답과 무관하다.
// 화살표는 명중할수록 곱셈으로 빨라진다(갈수록 더 빠르게).
const HAMMER_NEED = 4;
const GREEN_LO = 0.38; // 초록 구간(게이지 0=아래 ~ 1=위 기준)
const GREEN_HI = 0.62;
const HAMMER_SPEED0 = 0.9; // 시작 속도(초당 이동량)
const HAMMER_SPEEDUP = 1.32; // 명중마다 속도 배율

// 자물쇠 그래픽(SVG) — hits(균열 진행)·broken(부서짐)에 따라 그려진다.
// 걸쇠는 부서질 때 튕겨 열리고, 몸통은 두 조각으로 쪼개지며 파편이 튄다.
function LockGraphic({ hits, broken }: { hits: number; broken: boolean }) {
  const tr = "transition-transform duration-300 ease-out";
  return (
    <svg viewBox="0 0 140 155" className="h-40 w-40">
      <defs>
        <linearGradient id="lkBrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7dc94" />
          <stop offset="0.5" stopColor="#d8a63e" />
          <stop offset="1" stopColor="#98701d" />
        </linearGradient>
        <linearGradient id="lkSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef2f7" />
          <stop offset="1" stopColor="#96a2af" />
        </linearGradient>
      </defs>

      {/* 걸쇠(shackle) — 부서지면 왼쪽 다리가 끊겨 오른쪽 다리 기준으로 튕겨 열린다. */}
      <g
        className={tr}
        style={{
          transformBox: "fill-box",
          transformOrigin: "100% 100%",
          transform: broken ? "rotate(-42deg) translateY(-4px)" : "none",
        }}
      >
        <path
          d="M46 76 V52 a24 24 0 0 1 48 0 V76"
          fill="none"
          stroke="url(#lkSteel)"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>

      {/* 몸통 = 두 조각(항상 렌더). 붙어 있을 땐 가운데가 겹쳐 한 덩어리, 부서지면 좌우로 갈라진다. */}
      <g
        className={tr}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: broken ? "translate(-11px, 5px) rotate(-9deg)" : "none",
        }}
      >
        <path
          d="M46 72 L72 72 L63 92 L73 106 L61 124 L70 146 L46 146 Q34 146 34 132 L34 86 Q34 72 46 72 Z"
          fill="url(#lkBrass)"
          stroke="#7a5a18"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
      <g
        className={tr}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: broken ? "translate(11px, 7px) rotate(11deg)" : "none",
        }}
      >
        <path
          d="M68 72 L94 72 Q106 72 106 86 L106 132 Q106 146 94 146 L70 146 L61 124 L73 106 L63 92 L68 72 Z"
          fill="url(#lkBrass)"
          stroke="#7a5a18"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* 열쇠구멍 — 부서지면 사라진다(조각으로 흩어지므로). */}
      <g className="transition-opacity duration-200" style={{ opacity: broken ? 0 : 1 }}>
        <circle cx="70" cy="102" r="8" fill="#2a2012" />
        <path d="M70 102 L63 128 H77 Z" fill="#2a2012" />
      </g>

      {/* 균열(명중 1~3회 누적). 부서지기 전까지 점점 늘어난다. */}
      {!broken && (
        <g stroke="#3a2b0f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {hits >= 1 && <path d="M70 73 L61 90 L72 103" />}
          {hits >= 2 && <path d="M72 103 L59 118 L69 138" />}
          {hits >= 3 && <path d="M52 96 L41 108 M88 92 L100 104" />}
        </g>
      )}

      {/* 부서질 때 튀는 파편 */}
      {broken && (
        <g fill="url(#lkBrass)" stroke="#7a5a18" strokeWidth="1">
          <path d="M70 104 l10 -6 l-1 11 Z" />
          <path d="M66 118 l-11 3 l6 7 Z" />
          <path d="M80 120 l9 6 l-8 4 Z" />
        </g>
      )}
    </svg>
  );
}

// 망치 그래픽(SVG) — 명중 시 부모가 회전시켜 내려치는 모션을 준다.
function HammerGraphic() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16">
      <defs>
        <linearGradient id="hgSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe5ec" />
          <stop offset="1" stopColor="#8b97a4" />
        </linearGradient>
      </defs>
      {/* 손잡이(나무) */}
      <rect x="29" y="22" width="6" height="38" rx="3" fill="#8a5a2b" />
      <rect x="29" y="22" width="2.5" height="38" rx="1.2" fill="#a9743c" />
      {/* 머리(강철) */}
      <rect x="14" y="10" width="34" height="15" rx="3" fill="url(#hgSteel)" stroke="#6b7480" strokeWidth="1" />
      <rect x="44" y="7" width="9" height="21" rx="2.5" fill="#7f8a97" />
    </svg>
  );
}

function HammerLock({ onSolve }: { onSolve: () => void }) {
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const [broken, setBroken] = useState(false);

  const posRef = useRef(0.5); // 화살표 위치(0~1)
  const dirRef = useRef(1);
  const speedRef = useRef(HAMMER_SPEED0); // 초당 이동량(칠수록 빨라진다)
  const hitsRef = useRef(0);
  const doneRef = useRef(false);
  const arrowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  // 화살표 상하 왕복 — ref로 DOM top을 직접 갱신한다(매 프레임 setState 금지).
  useEffect(() => {
    function frame(t: number) {
      if (!lastRef.current) lastRef.current = t;
      const dt = Math.min(0.05, (t - lastRef.current) / 1000);
      lastRef.current = t;
      let p = posRef.current + dirRef.current * speedRef.current * dt;
      if (p >= 1) {
        p = 1;
        dirRef.current = -1;
      } else if (p <= 0) {
        p = 0;
        dirRef.current = 1;
      }
      posRef.current = p;
      if (arrowRef.current) arrowRef.current.style.top = `${(1 - p) * 100}%`;
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 최신 strike를 ref로 들고 있는다 — keydown 리스너는 []로 한 번만 등록하기 때문.
  const strikeRef = useRef<() => void>(() => {});
  strikeRef.current = () => {
    if (doneRef.current) return;
    const p = posRef.current;
    if (p >= GREEN_LO && p <= GREEN_HI) {
      const n = hitsRef.current + 1;
      hitsRef.current = n;
      setHits(n);
      setFlash("hit");
      speedRef.current *= HAMMER_SPEEDUP; // 명중할수록 곱으로 빨라진다(갈수록 더 빠르게)
      if (n >= HAMMER_NEED) {
        doneRef.current = true;
        cancelAnimationFrame(rafRef.current);
        setBroken(true);
        window.setTimeout(() => onSolve(), 650); // 부서지는 연출을 잠깐 보여준 뒤 문 열기
      }
    } else {
      setFlash("miss");
    }
    window.setTimeout(() => setFlash(null), 180);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        strikeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mb-3 flex items-stretch justify-center gap-6">
        {/* 왼쪽: 내려치는 망치 + 부서지는 도어락 */}
        <div className="relative flex w-40 flex-col items-center justify-center">
          <div
            className={`z-10 origin-bottom-left transition-transform duration-100 ${
              flash === "hit" ? "translate-x-1 translate-y-3 rotate-[30deg]" : "rotate-0"
            }`}
          >
            <HammerGraphic />
          </div>
          <div className="relative -mt-3">
            <LockGraphic hits={hits} broken={broken} />
            {/* 타격 순간 섬광(명중마다 재생) */}
            {flash === "hit" && (
              <span
                key={hits}
                className="pointer-events-none absolute left-1/2 top-[38%] h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-amber-200/70"
              />
            )}
          </div>
          <div className="mt-1 font-mono text-sm text-slate-300">
            {hits} / {HAMMER_NEED}
          </div>
        </div>

        {/* 오른쪽: 세로 게이지 + 위아래로 움직이는 화살표 */}
        <div className="relative h-48 w-14 self-center">
          <div className="absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 overflow-hidden rounded-full border border-white/20 bg-rose-600/70">
            {/* 가운데 초록 구간 */}
            <div
              className="absolute inset-x-0 bg-emerald-500"
              style={{ top: `${(1 - GREEN_HI) * 100}%`, height: `${(GREEN_HI - GREEN_LO) * 100}%` }}
            />
          </div>
          {/* 화살표(게이지 옆에서 왼쪽을 가리킨다). top은 rAF가 갱신. */}
          <div
            ref={arrowRef}
            className="absolute right-0 -translate-y-1/2 text-xl leading-none text-white drop-shadow"
            style={{ top: "50%" }}
          >
            ◀
          </div>
        </div>
      </div>

      {/* 피드백 */}
      <p className="mb-3 flex h-5 items-center justify-center text-sm font-semibold">
        {broken ? (
          <span className="text-emerald-400">자물쇠가 부서졌다!</span>
        ) : flash === "hit" ? (
          <span className="text-emerald-400">명중! 쾅!</span>
        ) : flash === "miss" ? (
          <span className="text-rose-400">빗나감…</span>
        ) : (
          <span className="text-slate-500">화살표가 초록에 올 때 내려쳐라</span>
        )}
      </p>

      <button
        onClick={() => strikeRef.current()}
        disabled={broken}
        className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
      >
        🔨 망치질 (Space)
      </button>
    </>
  );
}

// ── 회전 휠 자물쇠(숫자·문자 공용) ────────────────────────────────
function WheelLock({
  length,
  mod,
  render,
  check,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  length: number;
  mod: number;
  render: (n: number) => string;
  check: (vals: number[]) => boolean;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  const [vals, setVals] = useState<number[]>(() => Array(length).fill(0));

  function spin(i: number, delta: number) {
    clearError();
    setVals((v) => {
      const next = [...v];
      next[i] = (next[i] + delta + mod) % mod;
      return next;
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-center gap-3">
        {vals.map((n, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <button
              onClick={() => spin(i, +1)}
              className="h-7 w-12 rounded bg-white/5 text-slate-300 hover:bg-white/10"
            >
              ▲
            </button>
            <div className="flex h-14 w-12 items-center justify-center rounded-lg border border-white/15 bg-black/40 font-mono text-2xl">
              {render(n)}
            </div>
            <button
              onClick={() => spin(i, -1)}
              className="h-7 w-12 rounded bg-white/5 text-slate-300 hover:bg-white/10"
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <SubmitRow
        error={error}
        onSubmit={() => (check(vals) ? onSolve() : onFail())}
      />
    </>
  );
}

// ── 색 순서 자물쇠 ────────────────────────────────────────────────
function SequenceLock({
  palette,
  answer,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  palette: ColorKey[];
  answer: ColorKey[];
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  const [seq, setSeq] = useState<ColorKey[]>([]);

  function push(c: ColorKey) {
    clearError();
    setSeq((s) => (s.length >= answer.length ? s : [...s, c]));
  }
  function reset() {
    clearError();
    setSeq([]);
  }
  const same =
    seq.length === answer.length && seq.every((c, i) => c === answer[i]);

  return (
    <>
      {/* 입력한 순서 표시 */}
      <div className="mb-3 flex min-h-9 items-center justify-center gap-2">
        {Array.from({ length: answer.length }, (_, i) => {
          const c = seq[i];
          return (
            <div
              key={i}
              className={`h-8 w-8 rounded-full border border-white/20 ${
                c ? COLORS[c].bg : "bg-white/5"
              }`}
            />
          );
        })}
      </div>

      {/* 색 버튼 */}
      <div className="mb-4 flex justify-center gap-3">
        {palette.map((c) => (
          <button
            key={c}
            onClick={() => push(c)}
            title={COLORS[c].label}
            className={`h-11 w-11 rounded-lg ring-offset-2 ring-offset-[#12161f] transition hover:ring-2 ${COLORS[c].bg} ${COLORS[c].ring}`}
          />
        ))}
      </div>

      <div className="mb-3 text-center">
        <button
          onClick={reset}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          다시 입력
        </button>
      </div>

      <SubmitRow error={error} onSubmit={() => (same ? onSolve() : onFail())} />
    </>
  );
}

// ── 레버 on/off 자물쇠 ────────────────────────────────────────────
function SwitchLock({
  answer,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  answer: boolean[];
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  const [state, setState] = useState<boolean[]>(() =>
    Array(answer.length).fill(false),
  );

  function toggle(i: number) {
    clearError();
    setState((s) => {
      const next = [...s];
      next[i] = !next[i];
      return next;
    });
  }
  const same = state.every((v, i) => v === answer[i]);

  return (
    <>
      <div className="mb-4 flex justify-center gap-3">
        {state.map((on, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500">{i + 1}</span>
            <button
              onClick={() => toggle(i)}
              className={`flex h-16 w-11 flex-col rounded-lg border border-white/15 p-1 ${
                on ? "justify-start bg-emerald-500/25" : "justify-end bg-black/40"
              }`}
            >
              <span
                className={`h-6 w-full rounded ${
                  on ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
            </button>
            <span className="font-mono text-xs text-slate-400">
              {on ? "1" : "0"}
            </span>
          </div>
        ))}
      </div>
      <SubmitRow error={error} onSubmit={() => (same ? onSolve() : onFail())} />
    </>
  );
}

// ── 공통: 오류 메시지 + 확인 버튼 ─────────────────────────────────
function SubmitRow({
  error,
  onSubmit,
}: {
  error: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {error && (
        <p className="mb-3 text-center text-sm text-rose-400">
          틀렸습니다. 다시 시도하세요.
        </p>
      )}
      <button
        onClick={onSubmit}
        className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
      >
        확인
      </button>
    </>
  );
}
