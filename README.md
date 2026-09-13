# RIS-Aided Dual Antenna for Obstacle Detection
### Engineering Project Website — 22EC711

A complete, multi-page engineering research showcase website for the project:
**"RIS Aided Dual Antenna for Obstacle Detection"**

Course: Professional Readiness for Innovation, Employability and Entrepreneurship

---

## Team

| Name | Roll Number |
|------|-------------|
| Sai Rithikaa V | 111723109044 |
| Pooja V | 111723109037 |
| Keerthy JK | 111723109022 |

---

## Project Structure

```
/
├── index.html          — Home page (hero, metrics, LOS/NLOS comparison)
├── problem.html        — The Problem (NLOS, limitations, visual storytelling)
├── system.html         — Proposed System (interactive architecture diagram)
├── simulation.html     — CST Simulation (reference S11/S21/phase plots)
├── detection.html      — Detection Lab (interactive sensing console)
├── results.html        — Results & Applications (comparison + use cases)
├── about.html          — About / References (team, objectives, IEEE refs)
├── styles.css          — Master design system stylesheet
├── app.js              — Shared JavaScript (navigation, charts, animations)
└── README.md           — This file
```

---

## How to Run Locally

This is a pure HTML/CSS/JavaScript website with no build step required.

### Option 1 — Direct browser open
Simply open `index.html` in any modern browser.

### Option 2 — Local dev server (recommended, avoids CORS issues)

Using Python:
```bash
python -m http.server 3000
# then open http://localhost:3000
```

Using Node.js (with `npx serve`):
```bash
npx serve .
# then open http://localhost:3000
```

Using VS Code:
Install the **Live Server** extension, right-click `index.html` → Open with Live Server.

---

## Page Overview

| Page | Path | Description |
|------|------|-------------|
| Home | `index.html` | Cinematic dark hero with animated SVG schematic, metrics, LOS/NLOS comparison, objectives |
| Problem | `problem.html` | Editorial layout, 4 core challenges, visual comparison diagrams |
| System | `system.html` | Interactive architecture diagram with LOS/NLOS toggle and path visibility controls |
| Simulation | `simulation.html` | CST-style workspace with animated S11/S21/phase plots |
| Detection Lab | `detection.html` | Interactive sensing console — full controls + live SVG visualization |
| Results | `results.html` | Qualitative comparison table, 4 application illustrations |
| About | `about.html` | Team, objectives, novelty, IEEE references, transparency disclosure |

---

## How the Detection Lab Works

The Detection Lab (`detection.html`) is a **conceptual interactive demonstration**, not live hardware.

### Controls
| Control | Range | Effect |
|---------|-------|--------|
| Frequency slider | 8–12 GHz | Updates frequency readout; visual label updates |
| RIS Phase slider | 0–360° | Updates phase display and RIS panel label |
| Obstacle toggle | ON/OFF | Shows/hides obstacle; drives detection state |
| LOS/NLOS toggle | LOS → NLOS | Blocks direct path in NLOS mode |
| Direct Path toggle | ON/OFF | Enables/disables direct path visibility |
| RIS Path toggle | ON/OFF | Enables/disables RIS-reflected path |

### Detection Logic (Deterministic)

```
obstacle OFF                          → CLEAR
obstacle ON + direct path available   → OBSTACLE DETECTED (direct)
obstacle ON + RIS path available      → OBSTACLE DETECTED (RIS / dual)
obstacle ON + both paths unavailable  → SIGNAL DEGRADED / NO RELIABLE PATH
```

This logic is implemented in JavaScript in `detection.html` within the `computeDetection()` function.

**Signal pulses** (animated circles) travel along:
- The direct path (red, 8 GHz → 12 GHz-colored)
- The RIS-reflected arc (blue)

These are CSS/JS animations for visualization — not actual signal measurements.

---

## Simulation Plots — Important Note

All plots on `simulation.html` are **illustrative reference curves** generated from the project design parameters:

| Parameter | Value |
|-----------|-------|
| Operating frequency | 8–12 GHz |
| Design point | 10 GHz |
| S11 reference | < −30 dB @ 10 GHz |
| S21 reference | ≈ −3 dB @ 10 GHz |

The curves are generated mathematically in `app.js` (`genS11Data()`, `genS21Data()`, `genPhaseData()`) using Gaussian and tanh functions centered on the design frequency. **These are NOT measured CST Microwave Studio results.**

Every simulation plot is labeled `ILLUSTRATIVE REFERENCE` or `CST-STYLE VISUALIZATION`.

---

## Design System

The website uses a shared design system defined in `styles.css`:

- **Colors**: Warm off-white (`#f5f4f1`) + charcoal dark (`#1a1917`) + accent red-orange (`#c94f2a`)
- **Fonts**: Space Grotesk (headings), DM Serif Display (display), Inter (body), JetBrains Mono (technical data)
- **No gradients**: Premium look achieved through typography, spacing, and borders
- **No glassmorphism**: Clean, engineered aesthetic

---

## How to Deploy to Vercel

### Method 1 — Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your repository or drag the project folder
4. Framework Preset: **Other**
5. Root Directory: `/` (no build command needed)
6. Click Deploy

### Method 2 — Vercel CLI
```bash
npm install -g vercel
cd path/to/project
vercel
# Follow the prompts
```

### Method 3 — GitHub + Vercel
1. Push the project to a GitHub repository
2. Connect the repository to Vercel
3. Vercel detects static files automatically — no configuration needed

No `vercel.json` is required for a plain HTML/CSS/JS project.

---

## Browser Compatibility

Tested and functional in:
- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires:
- CSS Custom Properties (variables)
- SVG support
- IntersectionObserver API (for scroll reveals)
- CSS Grid + Flexbox

---

## Accessibility

- Semantic HTML5 elements throughout
- ARIA labels on interactive elements
- Keyboard-navigable controls
- Visible focus states
- `aria-live` regions for dynamic detection state
- `prefers-reduced-motion` supported (all animations disabled)
- Sufficient color contrast ratios

---

## Technical Parameters Used

All technical values on the website match the provided project specifications:

| Parameter | Value |
|-----------|-------|
| Operating Band | 8–12 GHz |
| Unit Cell Period | 10 × 10 mm |
| Patch Dimension | 8 × 8 mm |
| Substrate Material | FR-4 |
| Relative Permittivity (εr) | 4.4 |
| Substrate Height | 1.6 mm |
| Copper Thickness | 0.035 mm |

No parameters have been invented or modified from the provided specifications.

---

## License

This project is for academic/educational purposes.
