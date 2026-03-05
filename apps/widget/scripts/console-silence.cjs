// Loaded via NODE_OPTIONS=--require to reduce dev-console noise.
// Keep this file CommonJS so Node can preload it without transpilation.

const originalWarn = console.warn.bind(console);

function shouldSuppressWarning(args) {
  const first = args && args[0];
  if (typeof first !== "string") return false;

  // Browserslist old-data reminder (harmless in dev).
  if (first.startsWith("Browserslist: browsers data (caniuse-lite) is")) return true;

  // Supabase Node<=18 deprecation warning can spam (Next dev spawns workers).
  if (first.includes("Node.js 18 and below are deprecated") && first.includes("@supabase/supabase-js")) {
    return true;
  }

  return false;
}

console.warn = (...args) => {
  if (shouldSuppressWarning(args)) return;
  return originalWarn(...args);
};
