import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // EC2 배포용: 실행에 필요한 최소 파일만 뽑는 독립 실행 번들
  output: "standalone",
};

export default nextConfig;
