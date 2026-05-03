# MuonVis

An interactive visualization tool for understanding the [Muon optimizer](https://github.com/KellerJordan/Muon) — a momentum-based optimizer that applies Newton-Schulz orthogonalization to gradient updates, enabling better-conditioned weight steps than standard SGD or Adam.

View the visualizer [here](https://dhruvpendharkar.github.io/MuonVis/)

## Live Demo

Deployable to GitHub Pages via the included workflow (`/.github/workflows/deploy.yml`). Run locally with:

```bash
npx serve .
```

## Tech Stack

- **Vanilla JS (ES modules)** — no framework, no build step, no bundler
- **HTML5 Canvas** — all animations and plots rendered with the 2D canvas API
- **Plain CSS** — layout and theming in `style.css`
- **Static site** — single `index.html` entry point, deployable anywhere

All math is implemented from scratch in pure JS (small 2×2/3×3 matrices; no BLAS, no NumPy, no external math library).

## Sections

| # | Title | What it shows |
|---|-------|---------------|
| 1 | **Polar Decomposition** | Animated decomposition W = UΣVᵀ on the unit circle |
| 2 | **Newton-Schulz Iteration** | Cobweb diagram, singular value convergence, log-scale plot |
| 3 | **SVD Geometry** | How gradient singular values affect the step direction |
| 4 | **Loss Landscape** *(main demo)* | GD vs Adam vs Muon on a 2D parametric loss surface |
| 5 | **Muon Pipeline** | Animated step-by-step walkthrough of the full algorithm |

## Project Structure

```
index.html          # Entry point
style.css           # Global styles
src/
  main.js           # Section routing
  math/
    linalg.js       # Matrix ops (multiply, transpose, etc.)
    svd.js          # Jacobi one-sided SVD; analytic 2×2 formula
    newton_schulz.js # NS quintic iteration
    optimizers.js   # GD, Adam, and Muon update rules
  ui/
    canvas_utils.js # Contour fill (ImageData), marching squares iso-lines
    controls.js     # Interactive sliders / buttons
    nav.js          # Section navigation
  sections/
    section_polar.js
    section_ns.js
    section_svd.js
    section_landscape.js
    section_pipeline.js
```

## Key Implementation Notes

- **Matrices**: plain JS arrays-of-arrays, row-major
- **SVD**: Jacobi one-sided algorithm; analytic 2×2 path for speed
- **NS quintic update**: `X_{k+1} = X_k @ (15/8·I − 10/8·XᵀX + 3/8·(XᵀX)²)`
- **2D reduction**: In 2D, Muon reduces to normalized gradient descent (NS of a 2×1 vector yields a unit vector)
- **Contour rendering**: pixel-grid sampling into `ImageData`; iso-contour lines via marching squares
- **Loss function**: `L(x,y) = 0.5(ax² + by²) + c·sin(dx)·cos(ey)` with tunable coefficients
