import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const deployTarget = process.env.DEPLOY_TARGET ?? "node";

if (deployTarget !== "node" && deployTarget !== "cloudflare") {
  throw new Error(
    `Unsupported DEPLOY_TARGET "${deployTarget}". Use "node" or "cloudflare".`,
  );
}

export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ];

  if (command === "build" && deployTarget === "cloudflare") {
    plugins.push(
      cloudflare({
        viteEnvironment: {
          name: "ssr",
        },
      }),
    );
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
      server: {
        entry: "server",
      },
    }),
  );

  if (command === "build" && deployTarget === "node") {
    const isVercelBuild = process.env.VERCEL === "1";

    plugins.push(
      nitro({
        preset: isVercelBuild ? "vercel" : "node-server",
        minify: false,
      }),
    );
  }

  plugins.push(viteReact());

  return {
    plugins,

    server: {
      host: "::",
      port: 8080,
    },

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
