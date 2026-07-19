import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this; wrangler.jsonc main alone is insufficient.
const isVercelBuild = process.env.VERCEL === "1";

export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [tailwindcss(), tsConfigPaths({ projects: ["./tsconfig.json"] })];

  if (command === "build" && !isVercelBuild) {
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

  if (isVercelBuild) {
    plugins.push(nitro());
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
