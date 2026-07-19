import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Render uses the Node target. Cloudflare remains available only as an explicit opt-in.
const deployTarget = process.env.DEPLOY_TARGET ?? "node";

if (deployTarget !== "node" && deployTarget !== "cloudflare") {
  throw new Error(`Unsupported DEPLOY_TARGET "${deployTarget}". Use "node" or "cloudflare".`);
}

export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [tailwindcss(), tsConfigPaths({ projects: ["./tsconfig.json"] })];

  if (command === "build" && deployTarget === "cloudflare") {
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  plugins.push(
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
  );

  if (command === "build" && deployTarget === "node") {
    plugins.push(
      nitro({
        preset: "node-server",
        // Keep peak memory predictable on Windows and small Render build instances.
        minify: false,
      }),
    );
  }

  plugins.push(viteReact());

  return {
    plugins,
    server: { host: "::", port: 8080 },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
