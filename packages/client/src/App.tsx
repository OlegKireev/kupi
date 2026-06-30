import type { List } from "@kupi/shared";

export function App() {
  const demo: List = {
    id: "demo",
    name: "Список покупок",
    ownerAccountId: "me",
    seq: 0,
    createdAt: Date.now(),
  };

  return <h1>{demo.name}</h1>;
}
