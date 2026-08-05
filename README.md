# PALWERK

Private, offline-first Palworld optimization tool for iPhone.

PALWERK is not a wiki or tier list. It is designed to turn the user's actual game state into feasible, explainable next actions.

## Current bootstrap

- installable progressive web app
- iPhone-first dark glass interface
- local player profile
- local Pal, equipment and material inventory
- deterministic next-step logic
- JSON backup export
- service-worker offline cache
- automatic GitHub Pages deployment

No canonical Palworld values are included yet. This is intentional: the project does not use placeholders, invented values or opaque scores.

## Test locally

Serve the repository through any static web server. A service worker does not work reliably from `file://` URLs.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys every push to `main`. In the repository settings, choose **Pages → Source → GitHub Actions** once if it is not already selected.

The expected site address is:

`https://floh89.github.io/palwerk/`

Availability depends on the GitHub Pages settings and plan of the private repository.

## Development principles

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Next engineering milestone

Introduce versioned IndexedDB persistence and the canonical game-data schema before integrating confirmed Palworld datasets and calculation formulas.
