import "server-only";

import { randomInt } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALPHABET = `${LETTERS}${DIGITS}`;
const LENGTH = 20;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)] ?? "";
}

/** Creates a provider-compatible credential without ambiguous characters. */
export function createTemporaryPasscode(): string {
  const characters = [pick(LETTERS), pick(DIGITS)];
  while (characters.length < LENGTH) characters.push(pick(ALPHABET));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex] ?? "",
      characters[index] ?? "",
    ];
  }
  return characters.join("");
}
