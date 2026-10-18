import { hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string) {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(hashValue: string, password: string) {
  return verify(hashValue, password);
}
