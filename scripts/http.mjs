#!/usr/bin/env node
// Tiny curl replacement for smoke.sh (portable; some Windows curl builds break on -w).
// usage: node scripts/http.mjs METHOD URL [--bearer TOKEN] [--json BODY] [--header "Name: value"]...
// prints "<status> <seconds>" on the first line, then the response body.
const [method, url, ...rest] = process.argv.slice(2);
const headers = {};
let body;
for (let i = 0; i < rest.length; i += 2) {
  const [flag, val] = [rest[i], rest[i + 1]];
  if (flag === "--bearer") headers.authorization = `Bearer ${val}`;
  else if (flag === "--json") { body = val; headers["content-type"] = "application/json"; }
  else if (flag === "--header") { const k = val.indexOf(":"); headers[val.slice(0, k).trim()] = val.slice(k + 1).trim(); }
}
const start = Date.now();
try {
  const res = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  console.log(`${res.status} ${Math.round((Date.now() - start) / 1000)}`);
  process.stdout.write(text);
} catch (e) {
  console.log(`000 ${Math.round((Date.now() - start) / 1000)}`);
  console.log(String(e?.message ?? e));
  process.exitCode = 1;
}
