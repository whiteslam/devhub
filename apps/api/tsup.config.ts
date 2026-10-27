import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  splitting: false,
  sourcemap: true,
  // Bundle everything (workspace TS packages and npm deps) into one file so the
  // runtime image needs no node_modules.
  noExternal: [/.*/],
});
