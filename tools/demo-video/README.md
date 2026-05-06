# StoryForge AI Demo Video

This folder contains a self-contained Remotion project for rendering the StoryForge AI product demo.

The current cut is a product-style edit built from real frontend stills plus a Remotion motion layer. Real UI screenshots provide product fidelity; cursor motion, zoom windows, selection rewrite, and version history are rendered in Remotion for a cleaner promotional rhythm.

## Commands

```bash
npm install
npx playwright install ffmpeg
npm run capture:real-ui
npm run capture:stills
npm run preview
npm run render:still
npm run render
```

`capture:real-ui` records fallback UI clips. `capture:stills` captures the stills used by the current rendered cut. Both commands expect either `STORYFORGE_DEMO_TOKEN` or `STORYFORGE_DEMO_USERNAME` / `STORYFORGE_DEMO_PASSWORD`. Optional environment variables:

```bash
STORYFORGE_DEMO_APP_URL=http://localhost:5173
STORYFORGE_DEMO_PROJECT_ID=8
```

## Output

The rendered MP4 is written to:

```text
tools/demo-video/out/storyforge-demo.mp4
```

The video is 1920x1080, 30fps, and approximately 42 seconds long.
