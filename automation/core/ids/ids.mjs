import { randomBytes } from "node:crypto";

export const CROCKFORD32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RECORD_TYPES = Object.freeze({
  subject: "SUB",
  life_file: "LIF",
  story: "STY",
  story_object: "STO",
  source: "SRC",
  claim: "CLM",
  quote: "QTE",
  asset: "AST",
  manifest: "MAN",
  output: "OUT",
  review: "REV",
  publishing: "PUB",
  performance: "PRF",
  run: "RUN",
  render_job: "RND",
  decision: "DEC",
  experiment: "EXP"
});

const TYPE_NAMES = Object.freeze(Object.fromEntries(Object.entries(RECORD_TYPES).map(([name, code]) => [code, name])));
const MAX_TIMESTAMP = (1n << 48n) - 1n;
const CANONICAL_PATTERN = /^INT-([A-Z]{3})-([0-9A-HJKMNP-TV-Z]{26})$/;
const LEGACY_PATTERNS = Object.freeze([
  /^SUBJ-[0-9]{3,}$/,
  /^(SRC|CLM|AST|VID|MUS|DOC|AUD|REF|UNK)-[0-9]{3,}$/,
  /^[a-z0-9]+(?:-[a-z0-9]+)+$/
]);

function encodeBase32(value, length) {
  let remaining = BigInt(value);
  let encoded = "";
  for (let index = 0; index < length; index += 1) {
    encoded = CROCKFORD32[Number(remaining & 31n)] + encoded;
    remaining >>= 5n;
  }
  if (remaining !== 0n) throw new RangeError(`Value does not fit in ${length} Crockford Base32 characters.`);
  return encoded;
}

function decodeBase32(value) {
  let decoded = 0n;
  for (const character of value) {
    const index = CROCKFORD32.indexOf(character);
    if (index < 0) throw new TypeError(`Invalid Crockford Base32 character: ${character}`);
    decoded = (decoded << 5n) | BigInt(index);
  }
  return decoded;
}

function entropyToBigInt(entropy) {
  if (!(entropy instanceof Uint8Array) || entropy.length !== 10) {
    throw new TypeError("ULID entropy must be exactly 10 bytes (80 bits).");
  }
  let value = 0n;
  for (const byte of entropy) value = (value << 8n) | BigInt(byte);
  return value;
}

export function createUlid({ timestamp = Date.now(), entropy = randomBytes(10) } = {}) {
  if (!Number.isInteger(timestamp) || timestamp < 0 || BigInt(timestamp) > MAX_TIMESTAMP) {
    throw new RangeError("ULID timestamp must be an integer between 0 and 2^48-1 milliseconds.");
  }
  return `${encodeBase32(BigInt(timestamp), 10)}${encodeBase32(entropyToBigInt(entropy), 16)}`;
}

export function createId(type, options = {}) {
  const code = RECORD_TYPES[type] ?? (TYPE_NAMES[type] ? type : null);
  if (!code) throw new TypeError(`Unknown INTRST record type: ${type}`);
  return `INT-${code}-${createUlid(options)}`;
}

export function parseId(id) {
  if (typeof id !== "string") throw new TypeError("INTRST ID must be a string.");
  const match = CANONICAL_PATTERN.exec(id);
  if (!match) throw new TypeError("ID does not match INT-{TYPE}-{ULID}.");
  const [, code, ulid] = match;
  const type = TYPE_NAMES[code];
  if (!type) throw new TypeError(`Unknown INTRST record type code: ${code}`);
  const timestamp = decodeBase32(ulid.slice(0, 10));
  if (timestamp > MAX_TIMESTAMP) throw new RangeError("ULID timestamp exceeds 48 bits.");
  return Object.freeze({ id, code, type, ulid, timestamp: Number(timestamp), created_at: new Date(Number(timestamp)).toISOString() });
}

export function isCanonicalId(id, expectedType = null) {
  try {
    const parsed = parseId(id);
    return expectedType === null || parsed.type === expectedType || parsed.code === expectedType;
  } catch {
    return false;
  }
}

export function isLegacyId(id) {
  return typeof id === "string" && LEGACY_PATTERNS.some((pattern) => pattern.test(id));
}

export function resolveSubjectIdentity({ subject_id = null, person_id = null } = {}) {
  const resolved = subject_id ?? person_id;
  if (!resolved) throw new TypeError("subject_id or Life File v1 person_id is required.");
  if (subject_id && person_id && subject_id !== person_id) {
    throw new Error("Life File v1 person_id must equal operational subject_id.");
  }
  if (!isCanonicalId(resolved, "subject")) throw new TypeError("Subject identity must use a canonical INT-SUB ULID.");
  return resolved;
}
