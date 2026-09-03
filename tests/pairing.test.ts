import { test } from "node:test";
import assert from "node:assert/strict";

import { originFromRuntimeFile, parsePairing } from "../src/core/pairing.ts";

test("pairing URL from `t3 pair` (token in the fragment)", () => {
  assert.deepEqual(parsePairing(" http://127.0.0.1:3773/pair#token=CNVPEVD934YJ \n"), {
    origin: "http://127.0.0.1:3773",
    token: "CNVPEVD934YJ",
  });
});

test("bare token has no origin; hosted link carries the backend", () => {
  assert.deepEqual(parsePairing("CNVPEVD934YJ"), { origin: null, token: "CNVPEVD934YJ" });
  assert.deepEqual(parsePairing("https://app.t3.codes/pair?server=https%3A%2F%2Fbox.tail.ts.net&token=ABCDEF12"), {
    origin: "https://box.tail.ts.net",
    token: "ABCDEF12",
  });
});

test("garbage is rejected", () => {
  assert.equal(parsePairing(""), null);
  assert.equal(parsePairing("not a url or token!"), null);
  assert.equal(parsePairing("http://127.0.0.1:3773/pair"), null);
});

test("runtime file origin", () => {
  assert.equal(originFromRuntimeFile('{"origin":"http://127.0.0.1:3773","port":3773}'), "http://127.0.0.1:3773");
  assert.equal(originFromRuntimeFile('{"origin":"file:///x"}'), null);
  assert.equal(originFromRuntimeFile("nope"), null);
  assert.equal(originFromRuntimeFile(null), null);
});
