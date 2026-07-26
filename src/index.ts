export class JsonPointerError extends Error {
  override readonly name = "JsonPointerError";
  constructor(
    message: string,
    readonly pointer: string,
  ) {
    super(message);
  }
}

export function escapeJsonPointerToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function unescapeJsonPointerToken(token: string): string {
  if (/~(?:[^01]|$)/u.test(token)) {
    throw new JsonPointerError(
      `Invalid escape in JSON Pointer token: ${token}`,
      token,
    );
  }
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

/** Parses an RFC 6901 JSON Pointer into unescaped tokens. */
export function parseJsonPointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new JsonPointerError(
      "JSON Pointer must be empty or start with /",
      pointer,
    );
  }
  return pointer.slice(1).split("/").map(unescapeJsonPointerToken);
}

export function formatJsonPointer(tokens: readonly string[]): string {
  return tokens.length === 0
    ? ""
    : `/${tokens.map(escapeJsonPointerToken).join("/")}`;
}

/** Reads an own property addressed by an RFC 6901 JSON Pointer. */
export function getJsonPointer(document: unknown, pointer: string): unknown {
  let current = document;
  for (const token of parseJsonPointer(pointer)) {
    if (
      current === null ||
      (typeof current !== "object" && typeof current !== "function") ||
      !Object.hasOwn(current, token)
    ) {
      throw new JsonPointerError(
        `JSON Pointer does not exist: ${pointer}`,
        pointer,
      );
    }
    current = Reflect.get(current, token) as unknown;
  }
  return current;
}

export function hasJsonPointer(document: unknown, pointer: string): boolean {
  try {
    getJsonPointer(document, pointer);
    return true;
  } catch (error) {
    if (error instanceof JsonPointerError) return false;
    throw error;
  }
}

/** Immutably creates or replaces the value at a pointer. */
export function setJsonPointer(
  document: unknown,
  pointer: string,
  value: unknown,
): unknown {
  return setAt(document, parseJsonPointer(pointer), 0, value);
}

/** Immutably removes an existing pointer. Removing the root returns undefined. */
export function removeJsonPointer(document: unknown, pointer: string): unknown {
  const tokens = parseJsonPointer(pointer);
  if (tokens.length === 0) return undefined;
  getJsonPointer(document, pointer);
  return removeAt(document, tokens, 0);
}

function setAt(
  current: unknown,
  tokens: readonly string[],
  index: number,
  value: unknown,
): unknown {
  if (index === tokens.length) return value;
  const token = tokens[index] as string;
  const copy = copyContainer(current, token);
  const existing =
    current !== null &&
    typeof current === "object" &&
    Object.hasOwn(current, token)
      ? Reflect.get(current, token)
      : undefined;
  define(copy, token, setAt(existing, tokens, index + 1, value));
  return copy;
}

function removeAt(
  current: unknown,
  tokens: readonly string[],
  index: number,
): unknown {
  const copy = copyContainer(current, tokens[index] as string);
  const token = tokens[index] as string;
  if (index === tokens.length - 1) {
    if (Array.isArray(copy)) copy.splice(arrayIndex(token, copy.length - 1), 1);
    else Reflect.deleteProperty(copy, token);
    return copy;
  }
  define(
    copy,
    token,
    removeAt(Reflect.get(current as object, token), tokens, index + 1),
  );
  return copy;
}

function copyContainer(
  current: unknown,
  token: string,
): Record<string, unknown> | unknown[] {
  if (Array.isArray(current)) return [...current];
  if (current !== null && typeof current === "object") {
    return Object.defineProperties(
      {},
      Object.getOwnPropertyDescriptors(current),
    ) as Record<string, unknown>;
  }
  return /^(?:0|[1-9]\d*)$/u.test(token) ? [] : {};
}

function define(target: object, token: string, value: unknown): void {
  if (Array.isArray(target)) {
    target[arrayIndex(token, target.length)] = value;
  } else {
    Object.defineProperty(target, token, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
}

function arrayIndex(token: string, maximum: number): number {
  if (!/^(?:0|[1-9]\d*)$/u.test(token)) {
    throw new JsonPointerError(`Invalid array index: ${token}`, token);
  }
  const index = Number(token);
  if (!Number.isSafeInteger(index) || index > maximum) {
    throw new JsonPointerError(`Array index is out of bounds: ${token}`, token);
  }
  return index;
}
