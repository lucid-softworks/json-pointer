# `@lucid-softworks/json-pointer`

RFC 6901 JSON Pointer parsing, formatting, reads, existence checks, immutable
writes, and immutable removals.

```ts
import { getJsonPointer, setJsonPointer } from "@lucid-softworks/json-pointer";

const document = { users: [{ name: "Ada" }] };
getJsonPointer({ users: [{ name: "Ada" }] }, "/users/0/name"); // "Ada"
setJsonPointer(document, "/users/0/name", "Grace");
```

Traversal uses own properties only. Object writes use property descriptors, so
tokens such as `__proto__` cannot pollute prototypes.
