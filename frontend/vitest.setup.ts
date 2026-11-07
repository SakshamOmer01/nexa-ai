import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 26 exposes an unavailable global localStorage unless started with --localstorage-file, and
// that global can shadow jsdom's implementation. Tests that exercise browser persistence need a
// real Storage, so install a small in-memory one when the environment does not provide it.
// jsdom does not implement element scrolling; the chat surface calls it after every message.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: () => {},
  });
}

if (typeof window !== "undefined") {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }

  if (!storage) {
    const values = new Map<string, string>();
    const memoryStorage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, String(value));
      },
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });
  }
}

// Testing Library only auto-cleans when a global `afterEach` exists, which these tests do not use.
afterEach(() => {
  cleanup();
});
