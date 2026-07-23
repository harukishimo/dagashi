import { randomBytes, scrypt } from "node:crypto";

const pin = process.argv[2] ?? "";
if (!/^\d{4,8}$/.test(pin)) {
  console.error("Usage: node scripts/hash-pin.mjs <4-8 digit PIN>");
  process.exit(1);
}

const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const salt = randomBytes(16);
scrypt(pin, salt, 32, { N: cost, r: blockSize, p: parallelization, maxmem: 32 * 1024 * 1024 }, (error, derived) => {
  if (error) {
    console.error("PIN hash generation failed");
    process.exit(1);
  }
  console.log(["scrypt", cost, blockSize, parallelization, salt.toString("base64url"), derived.toString("base64url")].join("$"));
});
