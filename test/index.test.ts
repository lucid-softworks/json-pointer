import { describe, expect, it } from "vitest";

import {
  escapeJsonPointerToken,
  formatJsonPointer,
  getJsonPointer,
  hasJsonPointer,
  JsonPointerError,
  parseJsonPointer,
  removeJsonPointer,
  setJsonPointer,
  unescapeJsonPointerToken,
} from "../src/index.js";

describe("JSON Pointer", () => {
  it("parses, formats, escapes, and unescapes RFC tokens", () => {
    expect(parseJsonPointer("")).toEqual([]);
    expect(parseJsonPointer("/a~1b/m~0n/")).toEqual(["a/b", "m~n", ""]);
    expect(formatJsonPointer(["a/b", "m~n"])).toBe("/a~1b/m~0n");
    expect(formatJsonPointer([])).toBe("");
    expect(escapeJsonPointerToken("~/")).toBe("~0~1");
    expect(unescapeJsonPointerToken("~0~1")).toBe("~/");
    expect(() => parseJsonPointer("a")).toThrow(JsonPointerError);
    expect(() => unescapeJsonPointerToken("~2")).toThrow(JsonPointerError);
  });

  it("reads and checks own properties only", () => {
    const document = { a: [{ b: 1 }] };
    expect(getJsonPointer(document, "/a/0/b")).toBe(1);
    expect(getJsonPointer(document, "")).toBe(document);
    const callable = Object.assign(() => undefined, { value: 2 });
    expect(getJsonPointer(callable, "/value")).toBe(2);
    expect(hasJsonPointer(document, "/a/0/b")).toBe(true);
    expect(hasJsonPointer(document, "/a/1")).toBe(false);
    expect(hasJsonPointer(Object.create({ inherited: 1 }), "/inherited")).toBe(
      false,
    );
    const proxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("proxy failed");
        },
      },
    );
    expect(() => hasJsonPointer(proxy, "/value")).toThrow("proxy failed");
  });

  it("sets object and array paths immutably", () => {
    const source = { items: [{ value: 1 }], retained: {} };
    const result = setJsonPointer(source, "/items/0/value", 2) as typeof source;
    expect(result).toEqual({ items: [{ value: 2 }], retained: {} });
    expect(result).not.toBe(source);
    expect(result.retained).toBe(source.retained);
    expect(setJsonPointer({}, "/items/0", "a")).toEqual({ items: ["a"] });
    expect(setJsonPointer(null, "/0", "a")).toEqual(["a"]);
    expect(setJsonPointer({}, "/__proto__/safe", true)).toEqual({
      ["__proto__"]: { safe: true },
    });
    expect(({} as { safe?: boolean }).safe).toBeUndefined();
  });

  it("removes object, array, and root values immutably", () => {
    const source = { items: ["a", "b"], kept: true };
    expect(removeJsonPointer(source, "/items/0")).toEqual({
      items: ["b"],
      kept: true,
    });
    expect(removeJsonPointer(source, "/kept")).toEqual({ items: ["a", "b"] });
    expect(removeJsonPointer(source, "")).toBeUndefined();
    expect(() => removeJsonPointer(source, "/missing")).toThrow(
      JsonPointerError,
    );
  });

  it("rejects malformed or out-of-bounds array indexes", () => {
    expect(() => setJsonPointer([], "/x", 1)).toThrow("Invalid array index");
    expect(() => setJsonPointer([], "/2", 1)).toThrow("out of bounds");
    expect(() =>
      setJsonPointer([], `/${Number.MAX_SAFE_INTEGER + 1}`, 1),
    ).toThrow("out of bounds");
    expect(() => removeJsonPointer(["a"], "/2")).toThrow(JsonPointerError);
  });
});
