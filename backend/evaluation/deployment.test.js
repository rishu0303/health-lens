const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Importing the app must not connect to a database or call an AI service.
process.env.GEMINI_API_KEY = "deployment-test-placeholder";
const app = require("../server");
const mongoose = require("mongoose");

test("production routes serve the SPA, preserve API errors, and report database readiness", async (t) => {
  assert.ok(fs.existsSync(path.join(__dirname, "../../frontend/dist/index.html")), "Build the frontend before running deployment tests");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const route of ["/", "/login", "/dashboard"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /<div id="root">/);
  }

  const missing = await fetch(base + "/api/missing");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { message: "API route not found" });
  assert.equal((await fetch(base + "/assets/missing.js")).status, 404);
  const unauthenticated = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "test" }),
  });
  assert.equal(unauthenticated.status, 401);

  const unavailable = await fetch(base + "/api/health");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { status: "unavailable" });

  const previousState = mongoose.connection.readyState;
  t.after(() => { mongoose.connection.readyState = previousState; });
  mongoose.connection.readyState = 1;
  const healthy = await fetch(base + "/api/health");
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { status: "ok" });
});
