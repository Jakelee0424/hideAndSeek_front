"use client";
// 의무실 퍼즐 두 개의 화면. 문제·정답은 game/infirmaryPlan.ts가 방 코드로 만든다.
//   BloodTypeLock — 문 금고(lock-med). 침대 여섯의 혈액형을 단서로 복원해 차트에 그대로 적는다.
//   OutbreakQuiz  — 표식(quiz-med). 접촉 기록·발현 시각으로 감염 경로표를 채운다.
//
// 둘 다 사용자가 만든 HTML 프로토타입을 옮긴 것이라 구성(병동 카드·수혈표·검사 키트 /
// 접촉 도표·규칙·발현 기록)을 그대로 지킨다. 게임 모달은 폭이 좁으므로 배치만 세로로 폈다.
//
// ⚠️ 2026-08-01에 둘 다 **찍기 방지**로 답 내는 방식을 바꿨다(고르기 → 채워 넣기).
//    자세한 배경은 game/infirmaryPlan.ts 머리말 참고.
import { useState } from "react";
import {
  BED_COUNT,
  BLOOD_TYPES,
  GIVES,
  INCUBATION_H,
  SRC_NONE,
  SRC_OUTSIDE,
  canTransfuse,
  type BloodPlan,
  type BloodType,
  type OutbreakPlan,
} from "@/game/infirmaryPlan";

const BEDS = Array.from({ length: BED_COUNT }, (_, i) => i + 1);

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
  // ⚠️ 이 표가 곧 **정답 입력**이다. 예전엔 메모지(판정과 무관)였고 답은 따로 네 자리를
  // 눌렀는데, 그 요약값이 순열 24가지뿐이라 찍기가 통했다.
  const [chart, setChart] = useState<Record<number, BloodType | null>>(() =>
    Object.fromEntries(BEDS.map((n) => [n, null])),
  );
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(3);
  const [charges, setCharges] = useState(plan.charges);
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([]);

  /** 한 침대에 한 형. 중복은 허용된다(같은 형이 여럿일 수 있다). 같은 걸 다시 누르면 지운다. */
  function mark(bed: number, t: BloodType) {
    clearError();
    setChart((prev) => ({ ...prev, [bed]: prev[bed] === t ? null : t }));
  }

  function runKit() {
    if (charges <= 0 || from === to) return;
    const ok = canTransfuse(plan, from, to);
    setCharges((c) => c - 1);
    setLog((l) => [...l, { text: `${from}번 → ${to}번 · ${ok ? "수혈 가능" : "수혈 불가"}`, ok }]);
  }

  const filled = BEDS.every((n) => chart[n] !== null);

  function submit() {
    if (!filled) return;
    BEDS.every((n) => chart[n] === plan.beds[n]) ? onSolve() : onFail();
  }

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        침대 여섯에 환자가 한 명씩 누워 있다. 차트가 젖어 혈액형 칸만 지워졌다.
        <b className="text-slate-200"> 같은 혈액형이 여럿일 수 있다.</b> 단서로 복원해 차트를 채워라.
      </p>

      {/* 병동 — 침대 6개. 여기 찍은 것이 그대로 제출된다. */}
      <div className="mb-1 grid grid-cols-3 gap-1.5">
        {BEDS.map((n) => (
          <div key={n} className="rounded-lg border border-white/10 bg-black/30 p-1.5">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-mono font-bold text-slate-200">{n}번</span>
              <span className="text-slate-500">{n === 1 ? "창가" : n === BED_COUNT ? "문가" : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {BLOOD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => mark(n, t)}
                  className={`rounded py-1 font-mono text-[11px] transition ${
                    chart[n] === t
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
            {BEDS.map((n) => <option key={n} value={n}>{n}번</option>)}
          </select>
          <span className="text-slate-500">→</span>
          <select
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="rounded border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-xs text-slate-100"
          >
            {BEDS.map((n) => <option key={n} value={n}>{n}번</option>)}
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

      {/* 제출 — 차트 여섯 칸이 전부 채워져야 넣을 수 있다. */}
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3">
        <p className="text-[11px] leading-relaxed text-emerald-200/80">
          금고 — 복원한 차트를 그대로 밀어 넣는다. 여섯 칸이 <b>전부</b> 맞아야 열린다.
        </p>
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-rose-400">
          차트가 기록과 맞지 않는다. 어긋난 칸이 어디인지는 알려주지 않는다.
        </p>
      )}
      <button
        onClick={submit}
        disabled={!filled}
        className="mt-3 w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
      >
        {filled ? "차트를 금고에 넣는다" : `아직 ${BEDS.filter((n) => chart[n] === null).length}칸 비었다`}
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
  error,
  onSolve,
  onFail,
  clearError,
}: {
  plan: OutbreakPlan;
  error: boolean;
  onSolve: () => void;
  onFail: () => void;
  clearError: () => void;
}) {
  // 사람 → 고른 감염원. 여섯 줄을 **전부** 맞춰야 열린다(예전엔 최초 감염자 하나만 찍었다).
  const [pick, setPick] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const filled = plan.people.every((p) => pick[p.name]);

  function choose(name: string, src: string) {
    if (done) return;
    clearError();
    setPick((prev) => ({ ...prev, [name]: src }));
  }

  function submit() {
    if (done || !filled) return;
    if (plan.people.every((p) => pick[p.name] === plan.sourceOf[p.name])) {
      setDone(true);
      window.setTimeout(onSolve, 2600); // 전파 경로를 잠깐 보여준 뒤 표식 해금
    } else {
      onFail();
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
          <li>기록에 남은 접촉이라고 해서 모두 전파가 일어난 것은 아니다(상대가 아직 감염 전이면 아무 일도 없다).</li>
          {/* ⚠️ 아래 줄은 장식이 아니라 **유일해의 전제**다. 지우면 사슬을 거꾸로 읽는 해석이
              또 하나 성립해 정답이 둘이 된다(infirmaryPlan.ts sourceOf 주석 참고). */}
          <li>감염을 이 병동에 처음 들여온 사람은 <b className="text-amber-200">한 명</b>이고, 그는 끝내 증상이 없었다.</li>
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

      <p className="mb-2 text-xs text-slate-300">
        여섯 명이 각각 <b className="text-amber-200">누구에게서 옮았는지</b> 전부 채워라.
      </p>
      <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-slate-400">
              <th className="px-2 py-1 text-left font-medium">대상</th>
              <th className="px-2 py-1 text-left font-medium">감염원</th>
            </tr>
          </thead>
          <tbody>
            {plan.people.map((p) => (
              <tr key={p.name} className="border-t border-white/5">
                <td className="whitespace-nowrap px-2 py-1 text-slate-200">{p.name}</td>
                <td className="px-1 py-1">
                  <select
                    value={pick[p.name] ?? ""}
                    disabled={done}
                    onChange={(e) => choose(p.name, e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/40 px-1.5 py-1 text-xs text-slate-100 disabled:opacity-60"
                  >
                    <option value="">— 고르라 —</option>
                    <option value={SRC_OUTSIDE}>{SRC_OUTSIDE}</option>
                    <option value={SRC_NONE}>{SRC_NONE}</option>
                    {plan.people
                      .filter((o) => o.name !== p.name)
                      .map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 판정 — 어느 줄이 틀렸는지는 알려주지 않는다(알려주면 한 줄씩 찍어 맞출 수 있다). */}
      {!done && (
        <>
          {error && (
            <p className="mb-2 text-center text-sm text-rose-400">
              경로가 기록과 맞지 않는다. 발현 시각에서 {INCUBATION_H}시간을 거슬러 보라.
            </p>
          )}
          <button
            onClick={submit}
            disabled={!filled}
            className="mb-3 w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
          >
            {filled ? "역학 조사서를 제출한다" : "표를 모두 채워라"}
          </button>
        </>
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
