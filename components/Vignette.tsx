"use client";
// 시네마틱 밤 프레이밍. 포스트프로세싱 라이브러리 없이(의존성 0) 캔버스 위에 얹는 CSS 레이어다.
//   - 비네트: 가장자리를 어둡게 눌러 시선을 가운데로 모으고 밤 무게감을 준다.
//   - 필름 그레인: 아주 옅은 노이즈로 디지털 평면감을 줄인다.
// pointer-events-none이라 조작을 막지 않는다. Scene(캔버스)과 HUD 사이에 둔다.
export default function Vignette() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 비네트 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* 필름 그레인(옅은 SVG 노이즈) */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />
    </div>
  );
}
