import assert from "node:assert/strict";
import { it } from "node:test";
import { rootCertificates } from "node:tls";
import { corpusDatabaseTls } from "./policy-corpus-connection.mjs";
it("requires a trusted CA and never downgrades remote certificate verification", () => {
  const url =
    "postgresql://postgres@db.example.invalid/postgres?sslmode=verify-full";
  assert.throws(() => corpusDatabaseTls(url, { certificate: "" }));
  const options = corpusDatabaseTls(url, { certificate: rootCertificates[0] });
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.ca, rootCertificates[0]);
  assert.throws(() =>
    corpusDatabaseTls(url.replace("verify-full", "require"), {
      certificate: rootCertificates[0],
    }),
  );
});
it("reads the explicitly configured CA file without overriding verification", () => {
  const options = corpusDatabaseTls(
    "postgresql://postgres@db.example.invalid/postgres?sslmode=verify-full&sslrootcert=fixture.pem",
    {
      certificate: "",
      readCertificate: (path, encoding) => {
        assert.equal(path, "fixture.pem");
        assert.equal(encoding, "utf8");
        return rootCertificates[0];
      },
    },
  );
  assert.equal(options.rejectUnauthorized, true);
});
it("limits the plaintext exception to explicit local inspection", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    const url = `postgresql://postgres@${host}:54322/postgres`;
    assert.equal(corpusDatabaseTls(url, { allowLoopback: true }), false);
    assert.throws(() => corpusDatabaseTls(url));
  }
  assert.throws(() =>
    corpusDatabaseTls("postgresql://postgres@localhost.evil.invalid/postgres", {
      allowLoopback: true,
      certificate: "",
    }),
  );
});
