import "@testing-library/jest-dom";

// `setupFiles` runs for every test file regardless of its environment. The
// matchMedia shim is only meaningful in jsdom; guard against `node` env
// (used by scripts/__tests__/* and api/__tests__/* via @vitest-environment).
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
