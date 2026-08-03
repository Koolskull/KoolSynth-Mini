/** One-shot production build into public/ — run from repo root */
export {};

const worklet = await Bun.build({
  entrypoints: ["./packages/worklet/src/processor.ts"],
  outdir: "./public",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "processor.js",
});
if (!worklet.success) {
  console.error(worklet.logs);
  process.exit(1);
}

const app = await Bun.build({
  entrypoints: ["./apps/web/src/main.tsx"],
  outdir: "./public",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "app.js",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
if (!app.success) {
  console.error(app.logs);
  process.exit(1);
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

console.log("Built → public/");
