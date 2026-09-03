import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = "com.t3code.controller.sdPlugin";

// One Node ESM file OpenDeck launches directly; the SDK is bundled in so the
// .sdPlugin folder needs no node_modules beside it.
export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "es",
    sourcemap: false,
    banner: "#!/usr/bin/env node",
  },
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
    nodeResolve({ exportConditions: ["node"], preferBuiltins: true }),
    commonjs(),
  ],
  onwarn(warning, warn) {
    // `.ts` import specifiers need allowImportingTsExtensions, which cannot pair
    // with emit; the bundle is produced correctly regardless.
    if (typeof warning.message === "string" && warning.message.includes("TS5096")) return;
    warn(warning);
  },
};
