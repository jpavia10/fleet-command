# Fleet Command

The ops bridge on Prometheus Hub. Cool midnight field, pearl glass, held report. The role is still open, so the bridge stays paused.

https://jpavia10.github.io/fleet-command/

Back to the desk: https://jpavia10.github.io/prometheus-hub/

Discord, the public door already published from the desk: https://discord.gg/YCam2NEkv9

This page reads `data/registry.json` and the feed files once, then sits. It does not poll, schedule, or sign in. A feed is shown as a held snapshot, including a report that is newer than 45 minutes. Placeholder files stay awaiting. Status words inside a house are the words saved in that file.

## Paused

Do not put a schedule back on the workflows. `sync-fleet.yml` used to fetch Drive every five minutes, and `sync-fleet-history.yml` used to roll the history file daily. Both are hand-only now (`workflow_dispatch`). The page has no refresh loop. Leave it that way until the role of the bridge is decided.

## Particles

The field is the hub’s morph-particles desk, in the Midas cool-midnight palette, adapted from [MisterPrada/morph-particles](https://github.com/MisterPrada/morph-particles). Scroll mixes nebula, fleet, hold, and ring. The pointer leans the cloud. Shapes are drawn here.

## Pages

Publish the root of this repo to **jpavia10/fleet-command**, branch **main**, folder **/ (root)**. `.nojekyll` is included. GitHub Pages does not run a build; `fleet.js` is already bundled.

Build it again after editing `src/`:

```bash
npm install
npm run build
npm run check
```

`npm run build` bundles `src/main.js` to `fleet.js` with esbuild, copies the Outfit faces into `fonts/`, and paints the thin-square icons. Three.js `0.164.1` matches the hub.

Locally:

```bash
npm install
npm run build
python3 -m http.server 8742
```

## Home screen

iPhone: Safari → Share → Add to Home Screen. Android: Chrome → Install app. The icon is the thin square. The name is Fleet Command.
