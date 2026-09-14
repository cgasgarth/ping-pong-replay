# Verification

Run `bun run check` and `bun run build` before publishing changes. The checks cover strict TypeScript/Python types, linting, source layout limits, video decoding, tracking persistence, mechanics, scoring evidence, and saved review edits.

## Real recordings

The local review uses three 1080p/60 fps clips from the source in [the sample manifest](../../config/samples.json): a rally, a serve-and-rally sequence, and an occlusion/re-entry stress clip. Source videos remain local.

```sh
PYTHONPATH=backend uv run python -m replay.quality.audit
bun scripts/verify/replays.ts path/to/exported-replay.json
bun scripts/verify/identity.ts path/to/first-rally-export.json
```

The first command audits completed local replays and writes `.data/verification/audit.json`. The render audit checks every player pose for table collisions and head attachment. The identity check compares six torso observations with regions manually marked on original frames at 1, 5, and 9 seconds. It checks participant identity and coarse image position, not joint accuracy.

## Browser review

- Import through the library plus button; accept 1080p/60 fps and reject 30 fps.
- Select table corners, save names, reject a 30 fps override, and reprocess locally.
- Check frame stepping, playback speed, serve navigation, scoring, marker removal, and persistence after reload.
- Inspect all six themes, camera rotation, hidden original-video default, and mph/km/h conversion.
- Open saved screenshots and check their native dimensions and complete edges.

One measured live playback window on the development Mac reached about 119 fps with 194 draw calls in the Neon environment. This is a local observation, not a hardware-wide benchmark. The latest renderer sample is available in browser Performance entries under `rallylab-render`.

## Limits of the evidence

Kinematic consistency does not establish ground-truth 3D accuracy. Camera focal length, hidden body depth, and ball height are inferred. Avatar gaze points toward the table. Joint summaries require at least ten supported poses; sparse 3D ball tracks do not produce a displayed speed. Serve markers are candidates, and unsupported point outcomes remain uncertain.

Use the original-video overlay to review a result. These clips do not establish general accuracy across all camera angles, clothing, lighting, or match conditions.

The body conversion follows Apple's distinction between hip-relative joint coordinates and the camera transform ([Vision documentation](https://developer.apple.com/documentation/vision/identifying-3d-human-body-poses-in-images)). Image-projection checks detect gross orientation errors after cleanup; low projection error is a consistency check, not proof of correct depth.
