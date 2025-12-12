import path from "path";

import glsl from "vite-plugin-glsl";
import { replaceCodePlugin } from "vite-plugin-replace";

/** @type {import('vite').UserConfig} */
export default {
  optimizeDeps: {
    force: true,
  },
  server: {
    fs: {
      // Allow serving files from the workspace root and parent directory
      // This fixes issues when pnpm workspace links resolve to different paths
      allow: [
        path.resolve(__dirname, "../.."), // voxelize-brisingr
        path.resolve(__dirname, "../../.."), // /Users/princezuk0/projects
      ],
    },
  },
  plugins: [
    glsl(),
    replaceCodePlugin({
      replacements: [
        {
          from: "__VOXELIZE_VERSION__",
          to: "(dev)",
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      // hacky way to point to styles.css
      "@voxelize/core/styles.css": path.resolve(
        __dirname,
        "../../packages/core/src/styles.css"
      ),
      "@voxelize/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts"
      ),
    },
  },
};
