/**
 * Dev server: builds worklet + React app into public/, watches, serves.
 * Run from repo root: bun run apps/web/server.ts
 */
import { watch } from "fs";

const PORT = Number(process.env.PORT ?? 5173);

async function buildAll() {
  console.log("[build] worklet + app…");

  const worklet = await Bun.build({
    entrypoints: ["./packages/worklet/src/processor.ts"],
    outdir: "./public",
    target: "browser",
    format: "esm",
    minify: false,
    naming: "processor.js",
  });
  if (!worklet.success) {
    console.error(worklet.logs);
    throw new Error("worklet build failed");
  }

  const app = await Bun.build({
    entrypoints: ["./apps/web/src/main.tsx"],
    outdir: "./public",
    target: "browser",
    format: "esm",
    minify: false,
    naming: "app.js",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
  });
  if (!app.success) {
    console.error(app.logs);
    throw new Error("app build failed");
  }

  await Bun.write("./public/styles.css", await Bun.file("./apps/web/src/ui/styles.css").text());

  await Bun.write(
    "./public/index.html",
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>KoolSynth Mini</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
`,
  );
  console.log("[build] ok");
}

await buildAll();

const roots = ["apps/web", "packages/dsp", "packages/worklet"];
for (const r of roots) {
  try {
    watch(r, { recursive: true }, () => {
      buildAll().catch(console.error);
    });
  } catch {
    /* ignore */
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    path = path.replace(/\.\./g, "");
    const file = Bun.file(`./public${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`KoolSynth Mini → http://localhost:${server.port}`);
