import crypto from "crypto";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SPECIAL = "@#$!%&*";

const pick = (chars) => chars[crypto.randomInt(0, chars.length)];

export const generateSecurePassword = () => {
  const characters = [pick(UPPER), pick(SPECIAL), pick(DIGITS), pick(LOWER)];
  const pool = LOWER + UPPER + DIGITS;
  for (let i = 0; i < 8; i++) characters.push(pick(pool));
  for (let i = characters.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join("");
};

export const generateOfficerEmail = (name) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${slug}${crypto.randomInt(100, 999)}@akhuwat.org`;
};
