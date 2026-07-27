"use client";
// 퍼즐 UI 오버레이. openId가 있으면 표시.
//   note      → 힌트 문구만
//   lockbox   → 자물쇠 종류별 UI
//                 감방 자물쇠(minigame) → 아케이드 한 판(ArcadeHost)
//                 탈옥문(dial)          → 네 자리 코드 입력
// 풀면 sendSolve(협동 동기화) + markSolved(로컬 즉시 반영) → 감방문이 열린다.
import { useEffect, useState } from "react";
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
          <button
            onClick={close}
            className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            확인
          </button>
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
  }
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
