import test from "node:test";
import assert from "node:assert/strict";
process.env.USER_POOL_ID = "us-east-1_LOCALTEST";
process.env.CLIENT_ID = "localtestclient";
process.env.TABLE_NAME = "local-test-table";
process.env.PRIVATE_BUCKET = "local-test-private-bucket";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_EC2_METADATA_DISABLED = "true";
const { handler } = await import("../handler.mjs");
const event = (headers = {}, body = "") => ({
  version: "2.0",
  rawPath: "/admin/payments",
  requestContext: { http: { method: "GET" }, requestId: "local-test" },
  headers,
  body,
});
test("Lambda rejects unauthenticated protected requests before database access", async () => {
  const r = await handler(event());
  assert.equal(r.statusCode, 401);
});
test("Lambda does not trust a forged unsigned token or client-supplied admin claims", async () => {
  const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const fake =
    b64({ alg: "none", typ: "JWT" }) +
    "." +
    b64({
      sub: "attacker",
      token_use: "access",
      client_id: "localtestclient",
      "cognito:groups": ["MadarAdmins"],
      exp: 4102444800,
    }) +
    ".";
  const r = await handler(event({ authorization: "Bearer " + fake }));
  assert.equal(r.statusCode, 401);
});
test("Lambda rejects invalid JSON instead of treating it as a successful request", async () => {
  const r = await handler(event({}, "{broken"));
  assert.equal(r.statusCode, 400);
});
