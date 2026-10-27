import { spawnSync } from "node:child_process";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";

if (ffmpegPath === null) {
  throw new Error("ffmpeg-static does not provide a binary for this platform");
}

const repositoryRoot = process.cwd();
const source = path.join(repositoryRoot, "docs/assets/zmind-plus-demo.webm");
const destination = path.join(
  repositoryRoot,
  "docs/assets/zmind-plus-demo.mp4",
);

const result = spawnSync(
  ffmpegPath,
  [
    "-y",
    "-i",
    source,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    destination,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error(`Video transcoding failed with status ${result.status}`);
}
