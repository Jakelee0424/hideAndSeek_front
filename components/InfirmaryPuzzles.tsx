"use client";
// 의무실 퍼즐 두 개의 화면. 문제·정답은 game/infirmaryPlan.ts가 방 코드로 만든다.
//   BloodTypeLock — 문 금고(lock-med). 침대 넷의 혈액형을 단서로 복원해 네 자리를 맞춘다.
//   OutbreakQuiz  — 표식(quiz-med). 접촉 기록·발현 시각으로 최초 감염자를 지목한다.
//
// 둘 다 사용자가 만든 HTML 프로토타입을 옮긴 것이라 구성(병동 카드·수혈표·검사 키트 /
// 접촉 도표·규칙·발현 기록·지목)을 그대로 지킨다. 게임 모달은 폭이 좁으므로 배치만 세로로 폈다.
import { useState } from "react";
import {
  BLOOD_TYPES,
  GIVES,
  INCUBATION_H,
  canTransfuse,
  type BloodPlan,
  type BloodType,
  type OutbreakPlan,
} from "@/game/infirmaryPlan";

// ── ① 혈액형 판정(문 금고) ────────────────────────────────────────
export function BloodTypeLock({
  plan,
  error,
  onSolve,
  onFail,
  clearError,
}: {
  plan: BloodPlan;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  // 침대별 메모(정답 판정과 무관 — 종이에 적는 대신 눌러 두는 용도다).
  const [memo, setMemo] = useState<Record<number, BloodType | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [dial, setDial] = useState<string[]>(["", "", "", ""]);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(3);
  const [charges, setCharges] = useState(plan.charges);
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([]);

  /** 같은 혈액형은 한 침대에만 — 다른 곳에 찍혀 있으면 옮겨온다. */
  function mark(bed: number, t: BloodType) {
    setMemo((prev) => {
      const next = { ...prev };
      if (next[bed] === t) {
        next[bed] = null;
        return next;
      }
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === t) next[Number(k)] = null;
      }
      next[bed] = t;
      return next;
    });
  }

  function runKit() {
    if (charges <= 0 || from === to) return;
    const ok = canTransfuse(plan, from, to);
    setCharges((c) => c - 1);
    setLog((l) => [...l, { text: `${from}번 → ${to}번 · ${ok ? "수혈 가능" : "수혈 불가"}`, ok }]);
  }

  function setDigit(i: number, v: string) {
    clearError();
    const d = v.replace(/[^1-4]/g, "").slice(-1);
    setDial((prev) => prev.map((x, k) => (k === i ? d : x)));
  }

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        침대 넷에 환자가 한 명씩 누워 있다. 혈액형은 <b className="text-slate-200">O · A · B · AB</b>가 하나씩이다.
        차트가 젖어 혈액형 칸만 지워졌다.
      </p>

      {/* 병동 — 침대 4개. 버튼은 메모지 대용이다(판정과 무관). */}
      <div className="mb-1 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-lg border border-white/10 bg-black/30 p-1.5">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-mono font-bold text-slate-200">{n}번</span>
              <span className="text-slate-500">{n === 1 ? "창가" : n === 4 ? "문가" : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {BLOOD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => mark(n, t)}
                  className={`rounded py-1 font-mono text-[11px] transition ${
                    memo[n] === t
                      ? "bg-rose-700 text-rose-50"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mb-3 text-center text-[10px] text-slate-600">← 창가 · 문가 →</p>

      {/* 단서 */}
      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400">단서</p>
        <ol className="space-y-1.5 text-xs text-slate-200">
          {plan.clues.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-slate-500">{String(i + 1).padStart(2, "0")}</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 수혈 가능표 */}
      <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-slate-400">
              <th className="px-2 py-1 text-left font-medium">주는 사람</th>
              <th className="px-2 py-1 text-left font-medium">받을 수 있는 사람</th>
            </tr>
          </thead>
          <tbody>
            {BLOOD_TYPES.map((t) => (
              <tr key={t} className="border-t border-white/5">
                <td className="px-2 py-1 font-mono font-semibold text-rose-300">{t}</td>
                <td className="px-2 py-1 text-slate-300">{GIVES[t].join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 혈액 검사 키트 — 수혈 가능 여부만, 2회 한정 */}
      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="mb-2 text-[11px] text-slate-400">
          혈액 검사 키트 — 두 침대 사이 수혈 가능 여부만 알려준다(혈액형은 안 알려준다).
        </p>
        <div className="flex items-center gap-1.5">
          <select
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="rounded border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-xs text-slate-100"
          >
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}번</option>)}
          </select>
          <span className="text-slate-500">→</span>
          <select
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="rounded border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-xs text-slate-100"
          >
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}번</option>)}
          </select>
          <button
            onClick={runKit}
            disabled={charges <= 0 || from === to}
            className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-600 disabled:opacity-40"
          >
            검사
          </button>
          <span className="ml-auto font-mono text-[11px] text-slate-400">잔여 {charges}</span>
        </div>
        {log.length > 0 && (
          <ul className="mt-2 space-y-1">
            {log.map((l, i) => (
              <li
                key={i}
                className={`border-l-2 bg-white/5 px-2 py-1 font-mono text-[11px] ${
                  l.ok ? "border-emerald-500 text-emerald-200" : "border-rose-600 text-rose-200"
                }`}
              >
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 금고 */}
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3">
        <p className="mb-2 text-[11px] leading-relaxed text-emerald-200/80">
          금고 — <b>O · A · B · AB</b> 환자의 침대 번호를 그 순서대로 네 자리.
        </p>
        <div className="flex justify-center gap-2">
          {dial.map((d, i) => (
            <input
              key={i}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              inputMode="numeric"
              maxLength={1}
              aria-label={`${i + 1}번째 자리`}
              className="h-12 w-11 rounded border border-emerald-800 bg-black/50 text-center font-mono text-xl text-emerald-50 outline-none focus:border-emerald-500"
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-rose-400">일치하는 기록이 없다.</p>
      )}
      <button
        onClick={() => (dial.join("") === plan.code ? onSolve() : onFail())}
        className="mt-3 w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
      >
        입력
      </button>
    </>
  );
}

// ── ② 감염 경로 추적(표식) ────────────────────────────────────────

const ROW_H = 26; // 도표 한 행 높이(px)
const T0 = 0; // 도표 왼쪽 끝 시각
const T1 = 24;

/** 접촉 도표 — 행=사람, 세로선=그 시각에 만난 두 사람, 삼각형=증상 발현. */
function ContactChart({ plan }: { plan: OutbreakPlan }) {
  const LEFT = 96;
  const RIGHT = 12;
  const W = 460;
  const H = plan.people.length * ROW_H + 34;
  const x = (hour: number) => LEFT + ((hour - T0) / (T1 - T0)) * (W - LEFT - RIGHT);
  const y = (name: string) => plan.people.findIndex((p) => p.name === name) * ROW_H + 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="접촉 기록 도표">
      <rect x="0" y="0" width={W} height={H} rx="6" fill="#0b1220" stroke="#1e293b" />
      {/* 사람별 가로선 + 이름 */}
      {plan.people.map((p) => (
        <g key={p.name}>
          <line x1={LEFT} y1={y(p.name)} x2={W - RIGHT} y2={y(p.name)} stroke="#1e293b" />
          <text x={LEFT - 6} y={y(p.name) + 3.5} textAnchor="end" fontSize="10" fill="#cbd5e1">
            {p.name}
          </text>
        </g>
      ))}
      {/* 접촉(세로선). 전파 여부는 그리지 않는다 — 그게 추리할 것이다. */}
      {plan.contacts.map((c, i) => (
        <g key={i}>
          <line x1={x(c.hour)} y1={y(c.a)} x2={x(c.hour)} y2={y(c.b)} stroke="#64748b" strokeWidth="1" />
          <circle cx={x(c.hour)} cy={y(c.a)} r="3.4" fill="#38bdf8" />
          <circle cx={x(c.hour)} cy={y(c.b)} r="3.4" fill="#38bdf8" />
          <text x={x(c.hour)} y={Math.min(y(c.a), y(c.b)) - 6} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
            {String(c.hour).padStart(2, "0")}:00
          </text>
        </g>
      ))}
      {/* 발현(붉은 삼각형) */}
      {plan.onsets.map((o) => (
        <g key={o.name}>
          <polygon
            points={`${x(o.hour)},${y(o.name) - 5} ${x(o.hour) - 4.5},${y(o.name) - 13} ${x(o.hour) + 4.5},${y(o.name) - 13}`}
            fill="#f43f5e"
          />
          <text x={x(o.hour)} y={y(o.name) - 16} textAnchor="middle" fontSize="8.5" fill="#fda4af">
            {String(o.hour).padStart(2, "0")}:00
          </text>
        </g>
      ))}
      {/* 시각 축 */}
      <line x1={LEFT} y1={H - 18} x2={W - RIGHT} y2={H - 18} stroke="#334155" />
      {[0, 4, 8, 12, 16, 20, 24].map((h) => (
        <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontSize="9" fill="#64748b">
          {String(h).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );
}

export function OutbreakQuiz({
  plan,
  onSolve,
}: {
  plan: OutbreakPlan;
  onSolve: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function accuse(name: string) {
    if (done) return;
    setPicked(name);
    if (name === plan.answer) {
      setDone(true);
      window.setTimeout(onSolve, 2600); // 전파 경로를 잠깐 보여준 뒤 표식 해금
    }
  }

  return (
    <>
      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-2">
        <p className="mb-1 px-1 text-[11px] text-slate-400">어제의 접촉 기록</p>
        <ContactChart plan={plan} />
        <p className="mt-1 px-1 text-[10px] leading-relaxed text-slate-500">
          세로선 양 끝의 두 사람이 그 시각에 만났다. 선이 지나가는 중간 행은 그 접촉과 무관하다.
          붉은 삼각형은 증상이 나타난 시각이다.
        </p>
      </div>

      <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400">감염 규칙</p>
        <ol className="list-inside list-decimal space-y-1 text-xs text-slate-200">
          <li>감염된 사람과 접촉하면 그 자리에서 감염된다.</li>
          <li>감염된 시각으로부터 정확히 {INCUBATION_H}시간 뒤에 증상이 나타난다.</li>
          <li>감염된 직후부터 남에게 옮길 수 있다. 증상을 기다리지 않는다.</li>
          <li>끝내 증상이 나타나지 않는 사람도 있다. 증상이 없어도 옮기는 것은 똑같다.</li>
          <li>기록에 남은 접촉이라고 해서 모두 전파가 일어난 것은 아니다.</li>
        </ol>
      </div>

      <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-slate-400">
              <th className="px-2 py-1 text-left font-medium">증상이 나타난 대상</th>
              <th className="px-2 py-1 text-left font-medium">발현 시각</th>
            </tr>
          </thead>
          <tbody>
            {plan.onsets.map((o) => (
              <tr key={o.name} className="border-t border-white/5">
                <td className="px-2 py-1 text-slate-200">{o.name}</td>
                <td className="px-2 py-1 font-mono text-rose-300">{String(o.hour).padStart(2, "0")}:00</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 py-1.5 text-[10px] text-slate-500">나머지 세 명은 어제 하루 증상 기록이 없다.</p>
      </div>

      <p className="mb-2 text-xs text-slate-300">감염을 이 병동에 처음 들여온 사람을 지목하라.</p>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {plan.people.map((p) => {
          const hit = done && p.name === plan.answer;
          return (
            <button
              key={p.name}
              onClick={() => accuse(p.name)}
              disabled={done && !hit}
              className={`rounded-lg border px-1 py-2 text-[11px] leading-tight transition ${
                hit
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                  : picked === p.name
                    ? "border-rose-500 bg-rose-500/15 text-rose-100"
                    : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 disabled:opacity-40"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* 판정 — 틀리면 그 사람이 최초일 수 없는 이유를 보여준다(찍기 대신 추리를 시킨다). */}
      {picked && !done && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
          {plan.rebuttals[picked]}
        </p>
      )}
      {done && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          <p className="mb-1.5 font-semibold">격리 구역이 열렸다. {plan.answer}은(는) 끝까지 증상이 없었다.</p>
          {plan.chain.map((c) => (
            <div key={c} className="font-mono text-[11px] text-emerald-200/90">{c}</div>
          ))}
        </div>
      )}
    </>
  );
}
