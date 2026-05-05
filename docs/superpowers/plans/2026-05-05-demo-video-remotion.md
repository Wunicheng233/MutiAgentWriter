# StoryForge Demo Video Remotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained Remotion video project that renders a polished 90-second StoryForge AI product demo MP4.

**Architecture:** The video lives outside the product runtime in `tools/demo-video/`, with its own package, lockfile, Remotion entrypoint, reusable product-shot components, scene components, and export scripts. The first render uses faithful product UI recreations that match the current frontend visual language; real screenshots or clips can later replace any product-shot scene through a small asset manifest without changing the timeline.

**Tech Stack:** Remotion `4.0.457`, React `19.2.4`, TypeScript `6.0.2`, npm scripts, local SVG/CSS-style product mockups, optional PNG/MP4 assets under `tools/demo-video/assets/`.

---

## File Structure

Create a new isolated video workspace:

```
tools/demo-video/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── README.md
├── assets/
│   ├── screenshots/
│   └── clips/
└── src/
    ├── index.ts
    ├── Root.tsx
    ├── StoryForgeDemo.tsx
    ├── content.ts
    ├── theme.ts
    ├── components/
    │   ├── BrowserFrame.tsx
    │   ├── Caption.tsx
    │   ├── ProductShot.tsx
    │   ├── ProgressBadge.tsx
    │   └── SceneShell.tsx
    └── scenes/
        ├── OpeningScene.tsx
        ├── BookshelfScene.tsx
        ├── CreateProjectScene.tsx
        ├── SkillScene.tsx
        ├── PlanningScene.tsx
        ├── WorkflowScene.tsx
        ├── ReaderScene.tsx
        ├── QualityScene.tsx
        └── ClosingScene.tsx
```

Modify root ignore rules:

```
.gitignore
```

Add generated video outputs and nested dependencies:

```
tools/demo-video/node_modules/
tools/demo-video/out/
tools/demo-video/.remotion/
```

---

## Task 1: Scaffold the Remotion Workspace

**Files:**
- Create: `tools/demo-video/package.json`
- Create: `tools/demo-video/tsconfig.json`
- Create: `tools/demo-video/remotion.config.ts`
- Create: `tools/demo-video/src/index.ts`
- Create: `tools/demo-video/src/Root.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Create package scripts and dependencies**

Create `tools/demo-video/package.json`:

```json
{
  "name": "storyforge-demo-video",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "preview": "remotion studio src/index.ts",
    "typecheck": "tsc --noEmit",
    "render": "remotion render src/index.ts StoryForgeDemo out/storyforge-demo.mp4",
    "render:still": "remotion still src/index.ts StoryForgeDemo out/storyforge-demo-still.png --frame=450"
  },
  "dependencies": {
    "@remotion/cli": "4.0.457",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "remotion": "4.0.457"
  },
  "devDependencies": {
    "@types/node": "24.12.2",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "typescript": "6.0.2"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tools/demo-video/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "remotion.config.ts"]
}
```

- [ ] **Step 3: Create Remotion config**

Create `tools/demo-video/remotion.config.ts`:

```ts
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
```

- [ ] **Step 4: Create Remotion entrypoint**

Create `tools/demo-video/src/index.ts`:

```ts
import {registerRoot} from 'remotion';
import {RemotionRoot} from './Root';

registerRoot(RemotionRoot);
```

Create `tools/demo-video/src/Root.tsx`:

```tsx
import {Composition} from 'remotion';
import {StoryForgeDemo} from './StoryForgeDemo';

export const RemotionRoot = () => {
  return (
    <Composition
      id="StoryForgeDemo"
      component={StoryForgeDemo}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
```

- [ ] **Step 5: Ignore generated video artifacts**

Append to `.gitignore`:

```gitignore
# Remotion demo video workspace
tools/demo-video/node_modules/
tools/demo-video/out/
tools/demo-video/.remotion/
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
cd tools/demo-video && npm install
```

Expected: `package-lock.json` is created in `tools/demo-video/` and dependencies install without errors.

- [ ] **Step 7: Verify scaffold typechecks after later source files exist**

This command will be run after Task 2 adds source files:

```bash
cd tools/demo-video && npm run typecheck
```

Expected after Task 2: `tsc --noEmit` exits with code 0.

- [ ] **Step 8: Commit scaffold**

```bash
git add .gitignore tools/demo-video/package.json tools/demo-video/package-lock.json tools/demo-video/tsconfig.json tools/demo-video/remotion.config.ts tools/demo-video/src/index.ts tools/demo-video/src/Root.tsx
git commit -m "feat: scaffold demo video remotion project"
```

---

## Task 2: Add Theme, Timeline Content, and Shared Components

**Files:**
- Create: `tools/demo-video/src/theme.ts`
- Create: `tools/demo-video/src/content.ts`
- Create: `tools/demo-video/src/components/SceneShell.tsx`
- Create: `tools/demo-video/src/components/Caption.tsx`
- Create: `tools/demo-video/src/components/BrowserFrame.tsx`
- Create: `tools/demo-video/src/components/ProgressBadge.tsx`
- Create: `tools/demo-video/src/components/ProductShot.tsx`

- [ ] **Step 1: Create theme tokens**

Create `tools/demo-video/src/theme.ts`:

```ts
export const theme = {
  colors: {
    paper: '#f8f2ea',
    paperWarm: '#fffaf4',
    paperMist: '#eef4ef',
    ink: '#3e342c',
    muted: '#74685e',
    faint: '#9d9288',
    pine: '#5f876f',
    pineDark: '#456956',
    pineSoft: 'rgba(95, 135, 111, 0.14)',
    orange: '#df7f58',
    orangeSoft: '#fff0df',
    line: 'rgba(95, 135, 111, 0.22)',
    white: '#fffdf8'
  },
  fonts: {
    serif: '"Songti SC", "Noto Serif SC", "STSong", serif',
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif'
  },
  shadow: '0 28px 82px rgba(58, 46, 36, 0.13)'
} as const;
```

- [ ] **Step 2: Create timeline copy**

Create `tools/demo-video/src/content.ts`:

```ts
export const scenes = [
  {id: 'opening', start: 0, duration: 180, caption: '让 AI 写小说，不止生成一段文字。'},
  {id: 'bookshelf', start: 180, duration: 240, caption: '从一个想法开始。'},
  {id: 'create', start: 420, duration: 300, caption: '选择题材、协作方式和作家风格。'},
  {id: 'skill', start: 720, duration: 300, caption: '风格成为可注入的创作能力。'},
  {id: 'planning', start: 1020, duration: 360, caption: '先策划，再写作。方向由人确认。'},
  {id: 'workflow', start: 1380, duration: 420, caption: '每一章，都经过写作、评审与修订。'},
  {id: 'confirm', start: 1800, duration: 300, caption: '人在关键节点把关。'},
  {id: 'reader', start: 2100, duration: 420, caption: '最终回到阅读本身。'},
  {id: 'closing', start: 2520, duration: 180, caption: '多智能体小说创作工作台。'}
] as const;

export const totalFrames = 2700;
```

- [ ] **Step 3: Create scene shell**

Create `tools/demo-video/src/components/SceneShell.tsx`:

```tsx
import type {ReactNode} from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../theme';

type SceneShellProps = {
  children: ReactNode;
  tone?: 'light' | 'green';
};

export const SceneShell = ({children, tone = 'light'}: SceneShellProps) => (
  <AbsoluteFill
    style={{
      background:
        tone === 'green'
          ? `radial-gradient(circle at 80% 18%, rgba(95, 135, 111, 0.26), transparent 34%), linear-gradient(135deg, ${theme.colors.paperWarm}, ${theme.colors.paperMist})`
          : `radial-gradient(circle at 18% 18%, rgba(223, 127, 88, 0.11), transparent 28%), radial-gradient(circle at 84% 18%, rgba(95, 135, 111, 0.20), transparent 34%), linear-gradient(135deg, ${theme.colors.paper}, ${theme.colors.paperWarm} 54%, ${theme.colors.paperMist})`,
      color: theme.colors.ink,
      fontFamily: theme.fonts.serif,
      overflow: 'hidden'
    }}
  >
    {children}
  </AbsoluteFill>
);
```

- [ ] **Step 4: Create caption component**

Create `tools/demo-video/src/components/Caption.tsx`:

```tsx
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

type CaptionProps = {
  children: string;
  bottom?: number;
};

export const Caption = ({children, bottom = 84}: CaptionProps) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const translateY = interpolate(frame, [0, 20], [20, 0], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom,
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: theme.fonts.serif,
        fontSize: 48,
        lineHeight: 1.28,
        color: theme.colors.ink,
        textShadow: '0 1px 0 rgba(255,255,255,0.5)'
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **Step 5: Create browser frame**

Create `tools/demo-video/src/components/BrowserFrame.tsx`:

```tsx
import type {ReactNode} from 'react';
import {theme} from '../theme';

type BrowserFrameProps = {
  children: ReactNode;
  title?: string;
  scale?: number;
};

export const BrowserFrame = ({children, title = 'StoryForge AI', scale = 1}: BrowserFrameProps) => (
  <div
    style={{
      width: 1440,
      height: 810,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: 28,
      background: theme.colors.white,
      border: `1px solid ${theme.colors.line}`,
      boxShadow: theme.shadow,
      overflow: 'hidden'
    }}
  >
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 26px',
        gap: 14,
        borderBottom: `1px solid ${theme.colors.line}`,
        background: 'rgba(255, 250, 244, 0.92)',
        fontFamily: theme.fonts.sans,
        color: theme.colors.muted,
        fontSize: 18
      }}
    >
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#df7f58'}} />
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#e7c96d'}} />
      <span style={{width: 13, height: 13, borderRadius: 999, background: '#78a986'}} />
      <span style={{marginLeft: 14, fontWeight: 700}}>{title}</span>
    </div>
    <div style={{height: 746}}>{children}</div>
  </div>
);
```

- [ ] **Step 6: Create progress badge**

Create `tools/demo-video/src/components/ProgressBadge.tsx`:

```tsx
import {theme} from '../theme';

type ProgressBadgeProps = {
  label: string;
  progress?: number;
  tone?: 'orange' | 'green';
};

export const ProgressBadge = ({label, progress, tone = 'orange'}: ProgressBadgeProps) => {
  const color = tone === 'green' ? theme.colors.pine : theme.colors.orange;
  const background = tone === 'green' ? 'rgba(95, 135, 111, 0.10)' : theme.colors.orangeSoft;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px',
        borderRadius: 9,
        border: `1px solid ${color}33`,
        background,
        color,
        fontFamily: theme.fonts.sans,
        fontSize: 18,
        fontWeight: 700
      }}
    >
      <span style={{width: 10, height: 10, borderRadius: 999, background: color}} />
      <span>{label}</span>
      {typeof progress === 'number' ? <span>{Math.round(progress)}%</span> : null}
    </div>
  );
};
```

- [ ] **Step 7: Create product shot primitives**

Create `tools/demo-video/src/components/ProductShot.tsx` with exported functions `BookshelfShot`, `CreateProjectShot`, `SkillShot`, `PlanningShot`, `WorkflowShot`, `ReaderShot`, `QualityShot`, and `ExportShot`. These functions should render faithful static UI compositions using the shared theme. Each function returns JSX and accepts no props for the first version.

Implementation outline:

```tsx
import {ProgressBadge} from './ProgressBadge';
import {theme} from '../theme';

const card = {
  border: `1px solid ${theme.colors.line}`,
  borderRadius: 18,
  background: 'rgba(255, 253, 248, 0.86)',
  boxShadow: '0 20px 58px rgba(58, 46, 36, 0.08)'
};

export const BookshelfShot = () => (
  <div style={{height: '100%', padding: 72, background: theme.colors.paperWarm}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
      <h1 style={{fontFamily: theme.fonts.serif, fontSize: 58, margin: 0}}>我的书架</h1>
      <button style={{border: 0, borderRadius: 13, background: theme.colors.pine, color: theme.colors.white, fontSize: 26, padding: '20px 34px'}}>新建作品</button>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 34, marginTop: 72}}>
      {['时间余额不足', '镜中海', '远星回声'].map((title, index) => (
        <div key={title} style={{...card, height: 260, padding: 34}}>
          <h2 style={{fontFamily: theme.fonts.serif, fontSize: 38, margin: '0 0 22px'}}>{title}</h2>
          <ProgressBadge label={index === 0 ? '生成中' : '已完成'} progress={index === 0 ? 55 : undefined} tone={index === 0 ? 'orange' : 'green'} />
          <p style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 22, marginTop: 34}}>逐章共创模式</p>
        </div>
      ))}
    </div>
  </div>
);
```

Expected after completing the file: all exported shot names compile and can be imported by scene components.

- [ ] **Step 8: Typecheck shared components**

Run:

```bash
cd tools/demo-video && npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit shared components**

```bash
git add tools/demo-video/src tools/demo-video/package.json tools/demo-video/package-lock.json
git commit -m "feat: add demo video shared components"
```

---

## Task 3: Build the 90-Second Scene Timeline

**Files:**
- Create: `tools/demo-video/src/StoryForgeDemo.tsx`
- Create: all files under `tools/demo-video/src/scenes/`
- Modify: `tools/demo-video/src/content.ts` if scene timings need exact adjustment

- [ ] **Step 1: Compose the full timeline**

Create `tools/demo-video/src/StoryForgeDemo.tsx`:

```tsx
import {AbsoluteFill, Sequence} from 'remotion';
import {OpeningScene} from './scenes/OpeningScene';
import {BookshelfScene} from './scenes/BookshelfScene';
import {CreateProjectScene} from './scenes/CreateProjectScene';
import {SkillScene} from './scenes/SkillScene';
import {PlanningScene} from './scenes/PlanningScene';
import {WorkflowScene} from './scenes/WorkflowScene';
import {ReaderScene} from './scenes/ReaderScene';
import {QualityScene} from './scenes/QualityScene';
import {ClosingScene} from './scenes/ClosingScene';

export const StoryForgeDemo = () => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={180}><OpeningScene /></Sequence>
    <Sequence from={180} durationInFrames={240}><BookshelfScene /></Sequence>
    <Sequence from={420} durationInFrames={300}><CreateProjectScene /></Sequence>
    <Sequence from={720} durationInFrames={300}><SkillScene /></Sequence>
    <Sequence from={1020} durationInFrames={360}><PlanningScene /></Sequence>
    <Sequence from={1380} durationInFrames={420}><WorkflowScene /></Sequence>
    <Sequence from={1800} durationInFrames={300}><WorkflowScene confirmMode /></Sequence>
    <Sequence from={2100} durationInFrames={300}><ReaderScene /></Sequence>
    <Sequence from={2400} durationInFrames={120}><QualityScene /></Sequence>
    <Sequence from={2520} durationInFrames={180}><ClosingScene /></Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Create scene files**

Each scene file should wrap one product shot in `SceneShell`, `BrowserFrame`, and `Caption`. Use Remotion `interpolate()` for gentle camera motion.

Example for `tools/demo-video/src/scenes/BookshelfScene.tsx`:

```tsx
import {interpolate, useCurrentFrame} from 'remotion';
import {BrowserFrame} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {BookshelfShot} from '../components/ProductShot';
import {SceneShell} from '../components/SceneShell';

export const BookshelfScene = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 220], [0.88, 0.96], {extrapolateRight: 'clamp'});

  return (
    <SceneShell>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <BrowserFrame scale={scale}><BookshelfShot /></BrowserFrame>
      </div>
      <Caption>从一个想法开始。</Caption>
    </SceneShell>
  );
};
```

Repeat the same structure with these shot/caption pairs:

| File | Shot | Caption |
|------|------|---------|
| `OpeningScene.tsx` | opening typography, no browser frame for first 80 frames, then abstract frame | `让 AI 写小说，不止生成一段文字。` |
| `CreateProjectScene.tsx` | `CreateProjectShot` | `选择题材、协作方式和作家风格。` |
| `SkillScene.tsx` | `SkillShot` | `风格成为可注入的创作能力。` |
| `PlanningScene.tsx` | `PlanningShot` | `先策划，再写作。方向由人确认。` |
| `WorkflowScene.tsx` | `WorkflowShot` | `每一章，都经过写作、评审与修订。` or `人在关键节点把关。` when `confirmMode` is true |
| `ReaderScene.tsx` | `ReaderShot` | `最终回到阅读本身。` |
| `QualityScene.tsx` | `QualityShot` and `ExportShot` side-by-side | `质量可检查，过程可追踪。` |
| `ClosingScene.tsx` | logo/title composition | `StoryForge AI：多智能体小说创作工作台。` |

- [ ] **Step 3: Add confirmMode prop**

`WorkflowScene.tsx` must accept:

```ts
type WorkflowSceneProps = {
  confirmMode?: boolean;
};
```

When `confirmMode` is true, render a centered confirmation modal inside the product shot and use the caption `人在关键节点把关。`.

- [ ] **Step 4: Typecheck timeline**

Run:

```bash
cd tools/demo-video && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Render a still frame**

Run:

```bash
cd tools/demo-video && npm run render:still
```

Expected: `tools/demo-video/out/storyforge-demo-still.png` exists and shows a nonblank product scene.

- [ ] **Step 6: Commit timeline**

```bash
git add tools/demo-video/src
git commit -m "feat: compose storyforge demo video timeline"
```

Generated still images stay in ignored output folders and are not committed.

---

## Task 4: Render and Verify the MP4

**Files:**
- Generated: `tools/demo-video/out/storyforge-demo.mp4`
- Modify: `tools/demo-video/README.md`

- [ ] **Step 1: Add usage documentation**

Create `tools/demo-video/README.md`:

```md
# StoryForge AI Demo Video

This folder contains a self-contained Remotion project for rendering the 90-second StoryForge AI product demo.

## Commands

```bash
npm install
npm run preview
npm run render:still
npm run render
```

## Output

The rendered MP4 is written to:

```text
tools/demo-video/out/storyforge-demo.mp4
```

The video is 1920x1080, 30fps, and approximately 90 seconds long.
```

- [ ] **Step 2: Render MP4**

Run:

```bash
cd tools/demo-video && npm run render
```

Expected: `tools/demo-video/out/storyforge-demo.mp4` exists.

- [ ] **Step 3: Inspect output metadata**

Run:

```bash
cd tools/demo-video && node -e "const fs=require('fs'); const p='out/storyforge-demo.mp4'; const s=fs.statSync(p); console.log({file:p, bytes:s.size}); if (s.size < 1000000) process.exit(1);"
```

Expected: prints a size greater than 1,000,000 bytes.

- [ ] **Step 4: Render stills at key beats**

Run:

```bash
cd tools/demo-video && npx remotion still src/index.ts StoryForgeDemo out/opening.png --frame=90
cd tools/demo-video && npx remotion still src/index.ts StoryForgeDemo out/skill.png --frame=840
cd tools/demo-video && npx remotion still src/index.ts StoryForgeDemo out/reader.png --frame=2220
cd tools/demo-video && npx remotion still src/index.ts StoryForgeDemo out/closing.png --frame=2620
```

Expected: four nonblank PNG files exist in `tools/demo-video/out/`.

- [ ] **Step 5: Commit source and docs**

```bash
git add tools/demo-video/package.json tools/demo-video/package-lock.json tools/demo-video/tsconfig.json tools/demo-video/remotion.config.ts tools/demo-video/README.md tools/demo-video/src .gitignore
git commit -m "docs: add demo video usage notes"
```

Do not commit generated MP4 or generated stills unless the user explicitly requests tracked binary artifacts.

---

## Task 5: Final Delivery Check

**Files:**
- Read: `tools/demo-video/out/storyforge-demo.mp4`
- Read: `tools/demo-video/out/*.png`

- [ ] **Step 1: Confirm required scenes**

Open the generated stills and verify:

```text
opening.png  -> product title and opening caption
skill.png    -> author skill selection / style injection beat
reader.png   -> readable novel text / paper-like reader
closing.png  -> final StoryForge AI close
```

- [ ] **Step 2: Confirm no forbidden states**

Check the rendered video/stills for:

```text
No empty chapter page
No broken editor
No floating-point progress
No unreadable green-on-green text
No browser address bar
No terminal/debug logs
No long explanatory paragraphs
```

- [ ] **Step 3: Final command summary**

Record final commands in the response:

```bash
cd tools/demo-video
npm run preview
npm run render
```

- [ ] **Step 4: Final git status**

Run:

```bash
git status --short --branch
```

Expected: only intentional source changes are tracked; generated `out/` files remain ignored.

---

## Self-Review

### Spec Coverage

- 90-second 16:9 1080p output: Task 1 root composition and Task 4 render.
- Route C mixed approach: Task 2 product shots plus future asset folders.
- Minimal product-style text: Task 2 `content.ts` and captions.
- Required functions: Task 3 scene list covers create, Skill, planning, chapter workflow, reader, quality, export, closing.
- Project visual language: Task 2 `theme.ts` and shared components.
- Render verification: Task 4 stills and MP4 size check.

### Completeness Scan

The plan uses concrete file paths, concrete commands, named component exports, and explicit render checks. Generated stills and MP4 files remain local artifacts unless the user asks to track them.

### Type Consistency

Export names in `ProductShot.tsx` match scene imports:

```text
BookshelfShot, CreateProjectShot, SkillShot, PlanningShot, WorkflowShot, ReaderShot, QualityShot, ExportShot
```

The timeline component name `StoryForgeDemo` matches the Remotion composition id `StoryForgeDemo`.
