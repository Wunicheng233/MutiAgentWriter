# Design System for MutiAgentWriter  
*A warm, bookish, and serene design language for an AI-powered novel creation suite.*

## 1. Visual Theme & Atmosphere

MutiAgentWriter is a sanctuary for storytelling—a place where human creativity and artificial intelligence collaborate in quiet harmony. The interface must feel like settling into a favorite reading nook: soft, focused, and utterly devoid of distraction. The visual language draws from the timeless comfort of libraries, the tactile warmth of paper, and the gentle rhythm of ink on a page.

The canvas opens on **Warm Parchment** (`#faf7f2`)—a creamy off-white that is never sterile. Headings are rendered in **Inkwell Brown** (`#3a2c1f`), a deep, literary hue that reads like aged leather bindings. The primary accent is **Sage Green** (`#5b7f6e`), a muted botanical tone that evokes the quiet of a study with potted plants and antique brass lamps. Secondary accents appear as soft **Terracotta** (`#c06b4e`) and **Faded Rose** (`#a8685c`)—colors borrowed from well‑worn book covers and pressed flowers.

The type system is built around **Crimson Pro**, a Garamond‑inspired serif that carries the gravity and grace of literary tradition. At display sizes, it appears in **weight 400** with generous letter‑spacing, never shouting but always commanding a gentle authority. Body text uses weight 400 with a comfortable line‑height that invites sustained reading. For UI elements and captions, **Inter** steps in as a clean, neutral sans‑serif, weight 400, ensuring legibility without disturbing the quiet atmosphere.

The shadow system is **paper‑soft**. Rather than the digital‑blue shadows of fintech, MutiAgentWriter uses warm, sepia‑tinted shadows that mimic the way light falls across a desk. Shadows are single‑layer and diffused, using `rgba(60, 40, 20, 0.06)` for ambient lift and `rgba(60, 40, 20, 0.12)` for deeper, book‑stack elevation. There is a deliberate absence of harsh borders—cards float on subtle, organic elevations.

**Key Characteristics:**
- **Crimson Pro** with generous letter‑spacing at display sizes—literary, timeless, serene
- **Weight 400** as the sole weight for all serif text—quiet consistency
- **Warm Parchment** (`#faf7f2`) backgrounds—paper‑like, never clinical
- **Sage Green** (`#5b7f6e`) accents—calm, grounded, alive
- **Paper‑soft sepia shadows** using `rgba(60, 40, 20, ...)`—elevation without digital harshness
- **Generous border‑radius** (12px–24px) on cards and containers—organic, friendly, book‑like
- **Inter** as the clean sans‑serif companion for UI and data
- Subtle **divider lines** (`1px solid #e8ddd0`) that echo the ruled lines of a notebook

## 2. Color Palette & Roles

### Primary
- **Inkwell Brown** (`#3a2c1f`): `--color-heading`. Primary heading color. A deep, warm brown that feels like aged ink or leather—never black, always literary.
- **Warm Parchment** (`#faf7f2`): `--color-background`. Page background, card surfaces. Creamy and soft.
- **Sage Green** (`#5b7f6e`): `--color-accent`. Primary CTA backgrounds, links, interactive highlights. A muted botanical that calms rather than demands.

### Accent Colors
- **Terracotta** (`#c06b4e`): `--color-accent-warm`. Used sparingly for highlights, progress indicators, and decorative flourishes. Like a dried flower bookmark.
- **Faded Rose** (`#a8685c`): `--color-accent-soft`. Secondary decorative elements, hover states on light backgrounds.
- **Muted Gold** (`#a38b5a`): `--color-accent-gold`. Subtle accents for premium features or status—tarnished brass, not shiny.

### Neutral Scale
- **Body Text** (`#4a3f35`): `--color-body`. Primary reading text. A soft, warm charcoal with low contrast against parchment—easy on the eyes.
- **Secondary Text** (`#7a6f62`): `--color-secondary`. Descriptions, captions, metadata.
- **Muted Text** (`#a69a8d`): `--color-muted`. Placeholder text, disabled states.
- **Divider Line** (`#e8ddd0`): `--color-border`. Subtle, warm beige for borders and separators. Like the edge of a page.

### Surface & Borders
- **Card Background** (`#ffffff` with 0.6 opacity): Cards use a semi‑transparent white over the parchment base, creating a layered, vellum‑like effect.
- **Border Default** (`1px solid #e8ddd0`): Standard card border.
- **Border Focus** (`2px solid #5b7f6e`): Sage green focus ring for accessibility.
- **Border Accent** (`1px solid rgba(91, 127, 110, 0.25)`): Soft sage border for selected or highlighted elements.

### Shadow Colors (Paper-Soft System)
- **Ambient Lift** (`0px 4px 12px rgba(60, 40, 20, 0.06)`): Subtle elevation for cards and containers.
- **Standard Card** (`0px 8px 20px rgba(60, 40, 20, 0.08)`): Default card elevation—like a single sheet of paper.
- **Elevated Panel** (`0px 16px 32px rgba(60, 40, 20, 0.12)`): Dropdowns, modals, floating panels—a small stack of pages.
- **Deep Focus** (`0px 24px 48px rgba(60, 40, 20, 0.16)`): Highest elevation, used sparingly for modal dialogs.

### Gradient Accents
- **Parchment Fade**: Linear gradient from `#faf7f2` to `rgba(250, 247, 242, 0)` for scrolling fades.
- **Sage Glow**: Soft radial gradient using `rgba(91, 127, 110, 0.08)` for background atmosphere.

## 3. Typography Rules

### Font Families
- **Primary Serif**: `"Crimson Pro"`, fallback: `Georgia, serif`
- **UI Sans**: `"Inter"`, fallback: `-apple-system, BlinkMacSystemFont, sans-serif`
- **Monospace**: `"JetBrains Mono"`, fallback: `"SF Mono", monospace` *(used sparingly for agent‑status or snippet displays)*

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Display | Crimson Pro | 48px (3rem) | 400 | 1.2 | -0.02em | Maximum size; gentle authority |
| Page Heading | Crimson Pro | 36px (2.25rem) | 400 | 1.25 | -0.01em | Section titles |
| Section Heading | Crimson Pro | 28px (1.75rem) | 400 | 1.3 | normal | Feature headlines |
| Card Heading | Crimson Pro | 22px (1.375rem) | 400 | 1.35 | normal | Card titles, sub‑sections |
| Body Large | Crimson Pro | 18px (1.125rem) | 400 | 1.5 | normal | Feature descriptions, introductory text |
| Body | Crimson Pro | 16px (1rem) | 400 | 1.6 | normal | Standard reading text—generous for comfort |
| Body Small | Crimson Pro | 14px (0.875rem) | 400 | 1.5 | normal | Secondary paragraphs, extended metadata |
| Button | Inter | 16px (1rem) | 500 | 1.0 | normal | Primary button text (slightly bolder for clarity) |
| Button Small | Inter | 14px (0.875rem) | 500 | 1.0 | normal | Compact buttons |
| Navigation Link | Inter | 15px (0.9375rem) | 400 | 1.0 | normal | Clean, legible navigation |
| Caption | Inter | 13px (0.8125rem) | 400 | 1.4 | normal | Labels, metadata, timestamps |
| Caption Small | Inter | 12px (0.75rem) | 400 | 1.4 | normal | Fine print |
| Code / Agent | JetBrains Mono | 13px (0.8125rem) | 400 | 1.5 | normal | Agent logs, snippet display |
| Micro | Inter | 10px (0.625rem) | 500 | 1.2 | 0.02em | Tiny UI labels, all‑caps tracking |

### Principles
- **Crimson Pro for all narrative content**—the serif presence grounds the experience in literary tradition.
- **Inter exclusively for UI**—buttons, navigation, forms, captions. This separation reinforces that the interface is the tool, while the serif text is the story.
- **Single weight consistency**: Crimson Pro uses weight 400 throughout. Inter uses 400 (regular) and 500 (medium) for buttons and emphasis.
- **Generous line‑height**: Body text at 1.6 is intentional—it reduces eye strain and invites long‑form reading.
- **Subtle negative tracking at display sizes** tightens headlines slightly without losing the airy, literary feel.
- **No bold weights**—emphasis is conveyed through size, color, or italics (in Crimson Pro, italic is a true italic variant, not faux).

## 4. Component Stylings

### Buttons

**Primary Sage**
- Background: `#5b7f6e`
- Text: `#faf7f2` (parchment)
- Padding: 12px 24px
- Radius: 24px (fully rounded, organic)
- Font: 16px Inter weight 500
- Border: none
- Hover: `#4a6b5c` (deeper sage)
- Shadow: `0px 4px 12px rgba(60, 40, 20, 0.08)`
- Use: Primary CTA (“Begin Writing”, “Start New Novel”)

**Secondary Outline**
- Background: transparent
- Text: `#3a2c1f` (inkwell)
- Padding: 12px 24px
- Radius: 24px
- Font: 16px Inter weight 500
- Border: `1.5px solid #e8ddd0`
- Hover: background `rgba(91, 127, 110, 0.05)`, border `#5b7f6e`
- Use: Secondary actions (“View Outline”, “Configure Agents”)

**Tertiary Text Button**
- Background: transparent
- Text: `#5b7f6e`
- Padding: 8px 16px
- Radius: 24px
- Font: 15px Inter weight 400
- Hover: background `rgba(91, 127, 110, 0.05)`
- Use: Subtle navigation, “Learn more” links

**Ghost / Icon Button**
- Background: transparent
- Text / Icon: `#7a6f62`
- Padding: 8px
- Radius: 50% (circular)
- Hover: background `rgba(60, 40, 20, 0.04)`, icon `#3a2c1f`
- Use: Toolbar icons, close buttons

### Cards & Containers

**Standard Card**
- Background: `rgba(255, 255, 255, 0.6)` layered over `#faf7f2`
- Backdrop Filter: `blur(8px)` *(optional, for a modern vellum feel)*
- Border: `1px solid #e8ddd0`
- Radius: 16px
- Shadow: `0px 8px 20px rgba(60, 40, 20, 0.06)`
- Padding: 24px
- Hover: shadow deepens to `0px 12px 28px rgba(60, 40, 20, 0.10)`, border `#d4c5b5`

**Chapter Card / Manuscript Block**
- Background: `#ffffff` (solid, for maximum contrast)
- Border: `1px solid #e8ddd0`
- Radius: 12px
- Shadow: `0px 4px 12px rgba(60, 40, 20, 0.04)`
- Padding: 20px
- Inner typography: Crimson Pro 16px/1.6, `#4a3f35`

**Agent Status Card**
- Background: `rgba(255, 255, 255, 0.8)`
- Border-left: `4px solid #5b7f6e`
- Radius: 12px
- Padding: 16px 20px
- Font: Inter 14px for metadata; Crimson Pro for agent‑generated summary text

### Badges / Tags

**Agent Badge**
- Background: `rgba(91, 127, 110, 0.12)`
- Text: `#4a6b5c`
- Padding: 4px 12px
- Radius: 20px (pill)
- Font: 12px Inter weight 500, uppercase tracking 0.02em
- Border: `1px solid rgba(91, 127, 110, 0.2)`
- Use: “Planner”, “Writer”, “Critic” agent labels

**Status Pill**
- Background: `rgba(192, 107, 78, 0.10)` (terracotta tint)
- Text: `#a0523a`
- Padding: 2px 10px
- Radius: 16px
- Font: 11px Inter weight 500
- Use: “Drafting”, “Reviewing”, “Complete”

**Genre Tag**
- Background: `rgba(168, 104, 92, 0.08)` (faded rose)
- Text: `#8a5246`
- Padding: 4px 12px
- Radius: 20px
- Font: 13px Inter weight 400
- Use: “Fantasy”, “Mystery”, “Romance”

### Inputs & Forms

- Background: `#ffffff`
- Border: `1.5px solid #e8ddd0`
- Radius: 12px
- Padding: 12px 16px
- Font: 16px Inter weight 400
- Text color: `#3a2c1f`
- Placeholder: `#a69a8d`
- Focus: Border `#5b7f6e`, shadow `0px 0px 0px 4px rgba(91, 127, 110, 0.15)`
- Label: `#4a3f35`, 14px Inter weight 500, margin-bottom 6px

### Navigation

- **Top Bar**: Sticky, background `rgba(250, 247, 242, 0.85)` with `backdrop-filter: blur(12px)`
- **Height**: 72px
- **Brand**: Crimson Pro 24px, weight 400, `#3a2c1f`, with a subtle book icon or quill mark in Sage Green
- **Links**: Inter 15px weight 400, `#4a3f35`, padding 8px 16px, radius 24px
- **Link Hover**: Background `rgba(91, 127, 110, 0.08)`, text `#3a2c1f`
- **Active Link**: Text `#5b7f6e`, with a 2px underline offset 8px
- **CTA Button**: “New Project” in Primary Sage, placed right‑aligned

### Decorative Elements

**Divider Lines**
- `1px solid #e8ddd0` for horizontal rules between sections—like a typesetter’s rule.
- **Ornamental Divider**: A subtle `~ • ~` symbol in `#a69a8d`, centered, used sparingly between major sections.

**Background Texture (Optional)**
- A very subtle noise or paper texture overlay (`opacity: 0.02`) to reinforce the analog, bookish feel. This should be a global background effect, not applied to text containers.

**Scroll Fade**
- Top and bottom fades using a linear gradient from `#faf7f2` to transparent, applied to scrollable text areas.

## 5. Layout Principles

### Spacing System
- Base unit: **8px**
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
- **Generous padding**: Containers default to 24px padding on desktop, 20px on tablet, 16px on mobile.
- **Section Spacing**: 80px vertical rhythm between major sections.

### Grid & Container
- **Max Content Width**: 1280px, centered.
- **Manuscript Area**: For the novel‑writing interface, a two‑column layout: left column (agent panel, ~320px) and right column (writing canvas, ~720px). The canvas uses a fixed width of 720px to mimic a standard paperback page width.
- **Agent Panel**: A vertical stack of agent cards with subtle dividers.

### Whitespace Philosophy
- **Breathing Room**: Text is never cramped. Margins around paragraphs are generous. The writing canvas has 48px horizontal padding on desktop.
- **Focused Writing Mode**: When in “focus mode”, the agent panel collapses and the canvas expands to 800px, centered, with ample side margins. All UI chrome fades to near‑transparency.

### Border Radius Scale
- **Micro (4px)**: Input focus rings, tiny badges.
- **Standard (12px)**: Buttons, input fields, small cards.
- **Comfortable (16px)**: Standard cards, chapter blocks.
- **Large (24px)**: Primary CTA buttons, hero image containers.
- **Full Round (9999px)**: Pill‑shaped badges, toggle switches.

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Page background, inline text |
| Ambient | `0px 4px 12px rgba(60, 40, 20, 0.04)` | Subtle lift for non‑interactive cards |
| Standard | `0px 8px 20px rgba(60, 40, 20, 0.06)` | Interactive cards, chapter blocks |
| Elevated | `0px 16px 32px rgba(60, 40, 20, 0.10)` | Dropdowns, popovers, floating panels |
| Modal | `0px 24px 48px rgba(60, 40, 20, 0.14)` | Modal dialogs, focus overlays |
| Focus Ring | `0px 0px 0px 4px rgba(91, 127, 110, 0.25)` | Keyboard focus outline |

**Shadow Philosophy**: Shadows are warm and diffused, never sharp or blue. The goal is to emulate the gentle depth of stacked paper, not the crisp elevation of a digital interface. All shadows use a single layer with a soft spread.

## 7. Do's and Don'ts

### Do
- **Use Crimson Pro for all narrative text**—chapters, descriptions, agent‑generated prose.
- **Use Inter for all UI elements**—buttons, navigation, forms, captions, agent metadata.
- **Maintain generous line‑height (1.5–1.6) for reading text**—comfort is paramount.
- **Use Sage Green (`#5b7f6e`) as the primary interactive accent**—it is calm and grounding.
- **Apply paper‑soft sepia shadows** (`rgba(60, 40, 20, ...)`) for all elevations.
- **Keep border‑radius organic**—12px to 24px, with pill shapes for badges.
- **Use `#faf7f2` (Warm Parchment) as the base background**—never pure white.
- **Include subtle dividers (`1px solid #e8ddd0`)** to separate sections gently.
- **Respect the two‑font system**: Serif for content, Sans for interface.

### Don't
- **Don't use Crimson Pro for UI labels or buttons**—it loses legibility at small sizes and undermines the literary focus.
- **Don't use pure black (`#000000`) for text**—always `#3a2c1f` (headings) or `#4a3f35` (body).
- **Don't use harsh drop shadows** (e.g., `0px 10px 25px rgba(0,0,0,0.2)`)—avoid digital aggression.
- **Don't use bright, saturated accent colors** (neon green, electric blue)—stick to muted, botanical tones.
- **Don't apply bold weights to Crimson Pro**—weight 400 is the system; use italics for emphasis.
- **Don't use sharp corner radii (0px–2px)**—everything should feel soft and approachable.
- **Don't overcrowd the writing canvas**—leave generous margins.
- **Don't mix sans‑serif and serif in the same block of narrative text**—keep the separation clear.

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | Single column, stacked agent cards, reduced heading sizes |
| Tablet | 640–1024px | Agent panel collapses to a horizontal scrollable strip above canvas |
| Desktop | 1024–1280px | Two‑column layout: fixed agent sidebar (320px) + flexible canvas |
| Wide | >1280px | Centered content, canvas fixed at 720px, agent panel at 320px |

### Touch Targets
- Buttons: minimum 44px × 44px touch area (padding ensures this).
- Navigation links: 44px height, 16px horizontal padding.
- Agent cards: entire card is clickable for expand/collapse.

### Collapsing Strategy
- **Agent Panel on Mobile**: Transforms into a horizontal scrollable “agent strip” above the writing area. Each agent appears as a compact pill with icon and name.
- **Typography Scale**: Hero 48px → 36px on tablet → 32px on mobile. Body remains 16px/1.6.
- **Canvas Padding**: 48px desktop → 24px tablet → 16px mobile.

### Image Behavior
- **Cover Art Placeholders**: Use `border-radius: 12px`, with a soft sepia overlay (`rgba(60, 40, 20, 0.1)`) to harmonize with the palette.
- **Icons**: Use outlined, 24px × 24px, colored with `#5b7f6e` or `#7a6f62`.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary Background: **Warm Parchment** (`#faf7f2`)
- Card Background: **Vellum White** (`rgba(255, 255, 255, 0.6)`)
- Heading Text: **Inkwell Brown** (`#3a2c1f`)
- Body Text: **Soft Charcoal** (`#4a3f35`)
- Primary Accent: **Sage Green** (`#5b7f6e`)
- Secondary Accent: **Terracotta** (`#c06b4e`)
- Border: **Divider Beige** (`#e8ddd0`)
- Shadow: **Paper Sepia** (`rgba(60, 40, 20, 0.06)`)

### Example Component Prompts
- *"Create a hero section for a novel‑writing dashboard. Background #faf7f2. Headline at 48px Crimson Pro weight 400, color #3a2c1f, letter-spacing -0.02em. Subtitle at 18px Crimson Pro weight 400, color #4a3f35, line-height 1.5. Primary button: 'Begin Writing', #5b7f6e background, #faf7f2 text, 24px border-radius, 12px 24px padding, Inter 16px weight 500. Soft shadow 0px 8px 20px rgba(60,40,20,0.06)."*
- *"Design a card for an AI agent (the 'Planner'). Background rgba(255,255,255,0.6), border 1px solid #e8ddd0, border-radius 16px, padding 20px. Agent name in Inter 14px weight 500, uppercase tracking 0.02em, color #5b7f6e. Agent output text in Crimson Pro 15px/1.5, color #4a3f35. Include a Sage Green left border accent (4px solid #5b7f6e)."*
- *"Build a chapter card for the manuscript list. Solid white background (#ffffff), border 1px solid #e8ddd0, radius 12px, padding 20px. Chapter title: Crimson Pro 22px weight 400, color #3a2c1f. Excerpt: Crimson Pro 14px/1.5, color #7a6f62. Status badge: 'Draft' in Terracotta pill (rgba(192,107,78,0.10) bg, #a0523a text, 12px Inter, 16px radius)."*
- *"Create a navigation bar. Sticky, background rgba(250,247,242,0.85) with backdrop-filter blur(12px). Height 72px. Brand: 'MutiAgentWriter' in Crimson Pro 24px weight 400, color #3a2c1f. Links: Inter 15px weight 400, color #4a3f35, padding 8px 16px, border-radius 24px. Hover background rgba(91,127,110,0.08). 'New Project' button: #5b7f6e bg, #faf7f2 text, 24px radius, 12px 24px padding."*
- *"Design the writing canvas area. Background #faf7f2. A fixed‑width container of 720px centered. Inner padding 48px. Text area uses Crimson Pro 16px/1.6, color #4a3f35. Placeholder text: 'Begin your story...' in #a69a8d. Bottom toolbar with icon buttons (Ghost style)."*

### Iteration Guide
1. **Always pair Crimson Pro with narrative, Inter with UI**—this is the core typographic rule.
2. **Use weight 400 for all serif text**; weight 500 for Inter buttons only.
3. **Shadows are sepia‑tinted and single‑layer**: `rgba(60, 40, 20, X)` with X between 0.04 and 0.14.
4. **Headings are `#3a2c1f`, body is `#4a3f35`**—never pure black.
5. **Border‑radius is generous (12px–24px)**; avoid sharp corners.
6. **Background is `#faf7f2`**, cards are semi‑transparent white over it.
7. **Sage Green (`#5b7f6e`) is the only interactive accent color**; use Terracotta and Faded Rose sparingly for decoration.
8. **Respect the reading experience**: line‑height of 1.6 for body text, ample margins, and a calm, distraction‑free canvas.