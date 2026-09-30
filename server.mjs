import express from "express";
import { nanoid } from "nanoid";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const app = express();
app.use(express.json({ limit: "1mb" }));

const jobs = new Map();
const token = process.env.RENDER_TOKEN || "";

function auth(req, res, next) {
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_, res) => {
  res.json({ ok: true, service: "WEIRDEAD Living EQ Renderer" });
});

app.post("/render", auth, async (req, res) => {
  const {
    audioUrl,
    coverUrl,
    motionUrl,
    durationSeconds,
    title = "WEIRDEAD",
    width = 1280,
    height = 720
  } = req.body || {};

  if (!audioUrl || !coverUrl || !motionUrl || !durationSeconds) {
    return res.status(400).json({
      error: "audioUrl, coverUrl, motionUrl and durationSeconds are required"
    });
  }

  const id = nanoid(18);

  jobs.set(id, {
    status: "queued",
    progress: 0,
    title
  });

  res.status(202).json({
    jobId: id,
    status: "queued"
  });

  void runRender(id, {
    audioUrl,
    coverUrl,
    motionUrl,
    durationSeconds,
    title,
    width,
    height
  });
});

app.get("/render/:id", auth, (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: "Unknown render job" });
  }

  res.json(job);
});

async function runRender(id, props) {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "weirdead-")
  );

  const output = path.join(dir, "output.mp4");

  try {
    jobs.set(id, {
      ...jobs.get(id),
      status: "bundling",
      progress: 3
    });

    const serveUrl = await bundle({
      entryPoint: path.resolve("src/index.jsx")
    });

    jobs.set(id, {
      ...jobs.get(id),
      status: "rendering",
      progress: 8
    });

    const composition = await selectComposition({
      serveUrl,
      id: "LivingEQ",
      inputProps: props,
      browserExecutable:
        process.env.PUPPETEER_EXECUTABLE_PATH
    });

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: output,
      inputProps: props,
      browserExecutable:
        process.env.PUPPETEER_EXECUTABLE_PATH
    });

    jobs.set(id, {
      ...jobs.get(id),
      status: "uploading",
      progress: 95
    });

    const bytes = await fs.readFile(output);

    const uploadUrl = process.env.FLOOT_UPLOAD_URL;

    if (!uploadUrl) {
      throw new Error("FLOOT_UPLOAD_URL is not configured");
    }

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${process.env.FLOOT_CALLBACK_TOKEN || ""}`
      },
      body: JSON.stringify({
        jobId: id,
        title: props.title,
        contentType: "video/mp4",
        base64: bytes.toString("base64")
      })
    });

    if (!response.ok) {
      throw new Error(
        `Result upload failed: ${response.status}`
      );
    }

    const saved = await response.json();

    jobs.set(id, {
      status: "succeeded",
      progress: 100,
      title: props.title,
      renderUrl: saved.renderUrl
    });
  } catch (error) {
    jobs.set(id, {
      ...jobs.get(id),
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : String(error)
    });
  } finally {
    await fs.rm(dir, {
      recursive: true,
      force: true
    }).catch(() => {});
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log("WEIRDEAD renderer listening");
});
