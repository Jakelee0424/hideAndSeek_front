"use client";
// ⚠️ 클라이언트 컴포넌트여야 한다. QueueBoundary에 children을 "함수"로 넘기는데(render prop),
//    함수는 직렬화가 안 돼서 Server Component → Client Component 경계를 넘지 못한다
//    ("Functions are not valid as a child of Client Components").
import Lobby from "@/components/Lobby";
import QueueBoundary from "@/components/QueueBoundary";

export default function Home() {
  // 사이트에 들어오는 순간 대기열을 태운다. 정원이 차 있으면 로비 대신 순번 화면이 뜬다.
  return (
    <QueueBoundary>
      {({ playerId, token }) => <Lobby playerId={playerId} token={token} />}
    </QueueBoundary>
  );
}
