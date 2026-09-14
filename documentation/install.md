# Install and run locally

RallyLab runs on an Apple-silicon Mac. Use a laptop or desktop browser to view it. Phone recordings are supported as input, but the video must be at least **1080p and 60 fps**. Lower-spec videos are rejected, including when a frame-rate override is set.

## Prerequisites

Install Bun, uv, FFmpeg, and Xcode Command Line Tools. Keep enough local disk space for original videos, playback copies, models, and saved analyses.

## Setup

```sh
git clone https://github.com/cgasgarth/ping-pong-replay.git
cd ping-pong-replay
bun install --frozen-lockfile
bun run setup
bun run samples
bun run dev
```

Open [the local app](http://127.0.0.1:5173). Model and example downloads need internet access during setup. Video analysis runs locally. `bun run samples` is optional and downloads the example clips; it requires FFmpeg.

## Use

1. Import a qualifying recording with the plus button in the replay library.
2. Name the players and check the table calibration. Select the tabletop corners in order, starting along a long edge.
3. Analyze the video. Saved replays open without rerunning the models.
4. Use **Reprocess video** after changing analysis settings or to run a newer analysis pipeline.

The original video is hidden by default. Use **Compare** or **Original video** to inspect the tracking. Themes and speed-unit preferences are saved locally. Review uncertain serve markers and scores before treating them as final.

## Data and development

Local data lives in `.data/`, which is excluded from Git. Back up this folder to preserve videos and analyses. Stop the development process with Ctrl+C.

```sh
bun run check
bun run build
```

The validation command runs structural limits, strict type checking, linting, and behavioral tests. The project uses one repository and pinned dependency lockfiles.
