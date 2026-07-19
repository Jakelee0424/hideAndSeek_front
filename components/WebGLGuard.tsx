"use client";
// WebGL 사용 가능 여부를 먼저 확인하고, 안 되면 이유와 해결법을 보여준다.
//
// 이게 없으면 그래픽 가속이 꺼진 브라우저에서 아무 설명 없는 검은 화면만 나온다.
// 원인이 자기 브라우저 설정이라는 걸 알 방법이 없어서 "게임이 고장났다"로 읽힌다.
import { useEffect, useState, type ReactNode } from "react";

type Support = "checking" | "ok" | "software" | "none";

function detect(): Support {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "none";

    // 소프트웨어 렌더러(SwiftShader/llvmpipe)면 돌긴 해도 몇 fps라 사실상 조작이 안 된다.
    // 확장이 막혀 있으면 판별 불가 → ok로 둔다. 멀쩡한 기기에 경고를 띄우는 쪽이 더 나쁘다.
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : "";

    // 판별용으로 만든 컨텍스트는 바로 반납한다(브라우저마다 동시 컨텍스트 수 제한이 있다).
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return /swiftshader|llvmpipe|software|basic render/i.test(renderer)
      ? "software"
      : "ok";
  } catch {
    return "none";
  }
}

export default function WebGLGuard({ children }: { children: ReactNode }) {
  // 서버에서는 canvas가 없다 → 마운트 후에 판별한다(하이드레이션 불일치 방지).
  const [support, setSupport] = useState<Support>("checking");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setSupport(detect()), []);

  if (support === "checking") return null;

  if (support === "none") {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-[#0b0f17] p-6 text-slate-100">
        <div className="max-w-md text-center">
          <p className="mb-2 text-sm font-medium tracking-[0.25em] text-amber-300/80">
            WEBGL UNAVAILABLE
          </p>
          <h1 className="mb-4 text-2xl font-bold">3D 그래픽을 켜야 합니다</h1>
          <p className="mb-5 text-sm leading-relaxed text-slate-300">
            이 게임은 브라우저의 3D 그래픽(WebGL)을 사용합니다. 지금 브라우저에서는
            사용할 수 없는 상태입니다.
          </p>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-left text-sm text-slate-300">
            <p className="mb-2 font-medium text-slate-100">해결 방법</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Chrome 설정 → <span className="text-slate-100">시스템</span>
              </li>
              <li>
                <span className="text-slate-100">
                  “가능한 경우 그래픽 가속 사용”
                </span>{" "}
                켜기
              </li>
              <li>브라우저를 다시 시작한 뒤 새로고침</li>
            </ol>
          </div>
          <button
            onClick={() => setSupport(detect())}
            className="mt-5 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            다시 확인
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {children}
      {support === "software" && !dismissed && (
        <div className="pointer-events-auto absolute inset-x-0 top-0 z-40 flex items-center justify-center gap-3 bg-amber-500/90 px-4 py-2 text-sm text-black">
          <span>
            그래픽 가속이 꺼져 있어 매우 느리게 돌아갑니다. Chrome 설정 → 시스템에서
            켜면 훨씬 부드러워집니다.
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded bg-black/20 px-2 py-0.5 text-xs font-medium"
          >
            닫기
          </button>
        </div>
      )}
    </>
  );
}
