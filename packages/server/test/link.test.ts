import { test } from "node:test";
import assert from "node:assert/strict";
import { COOKIE } from "@/auth";
import { makeApp, signup } from "./helpers";
import type { Bootstrap } from "@kupi/shared";

test("device B links to account A and sees the same list", async () => {
  const app = makeApp();
  const a = await signup(app);

  const codeRes = await app.inject({
    method: "POST",
    url: "/link-codes",
    headers: { cookie: a.cookie },
  });
  const { code } = codeRes.json() as { code: string };
  assert.equal(code.length, 6);

  const linkRes = await app.inject({ method: "POST", url: "/link", payload: { code } });
  assert.equal(linkRes.statusCode, 200);

  const bBootstrap = linkRes.json() as Bootstrap;
  assert.equal(bBootstrap.account.id, a.bootstrap.account.id);
  assert.equal(bBootstrap.lists[0]?.id, a.bootstrap.lists[0]?.id);

  const bCookie = linkRes.cookies.find((c) => c.name === COOKIE);
  assert.ok(bCookie); // B получил собственный device-токен

  await app.close();
});

test("a link code cannot be redeemed twice", async () => {
  const app = makeApp();
  const a = await signup(app);
  const codeRes = await app.inject({
    method: "POST",
    url: "/link-codes",
    headers: { cookie: a.cookie },
  });
  const { code } = codeRes.json() as { code: string };

  const first = await app.inject({ method: "POST", url: "/link", payload: { code } });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({ method: "POST", url: "/link", payload: { code } });
  assert.equal(second.statusCode, 400);

  await app.close();
});

test("POST /link with a missing code is rejected by validation (400)", async () => {
  const app = makeApp();
  const res = await app.inject({ method: "POST", url: "/link", payload: {} });
  assert.equal(res.statusCode, 400);
  await app.close();
});
