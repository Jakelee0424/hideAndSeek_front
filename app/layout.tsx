import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BgmHost from "@/components/BgmHost";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 브라우저 탭·공유 링크에 뜨는 이름. 로비 제목(Lobby.tsx)과 같은 표기를 쓴다.
  title: "시야 밖으로 : Escape",
  description: "실시간 멀티플레이 3D 협동 방탈출",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 배경음. 라우팅으로 화면이 바뀌어도 곡이 끊기지 않게 최상단에 하나만 둔다. */}
        <BgmHost />
        {children}
      </body>
    </html>
  );
}
