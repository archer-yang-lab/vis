# Visualization library

A clean, GitHub-inspired home for interactive mathematics and statistics examples. The home page is a catalog; every visualization has its own URL, description, and explanation.

## Preview locally

Requires Node.js 20 or newer. No package installation is needed.

```sh
npm run build
npm run preview
```

Open the local URL printed by the preview command. After an edit, rebuild and refresh the page. The built website is in `dist/`.

## Project structure

```text
catalog.json                 Titles, descriptions, topics, and file paths
content/previews/            Small previews for the home page
content/visualizations/      Standalone interactive HTML and explanation text
assets/                     Shared website styles and embed resizing
scripts/build.mjs           Generates the home page and individual pages
scripts/preview.mjs         Local preview server
.github/workflows/pages.yml GitHub Pages publishing workflow
dist/                       Generated website (not source)
```

The original exported visualization is preserved in `content/visualizations/rotations-and-columns/interactive.html`. It runs without Codex. The surrounding site adds the library navigation and explanation.

## Add a visualization

1. Create `content/visualizations/<slug>/` and add a standalone `interactive.html`.
2. Add an `explanation.html` fragment in that folder. Write for the reader, define mathematical notation before use, and use familiar terminology.
3. Add a small preview image under `content/previews/`.
4. Add an entry to the `visualizations` array in `catalog.json`, following the existing entry. Use a unique lowercase slug with hyphens.
5. Run `npm run build` and review the new page locally.

The home page, topic groups, counts, and detail pages are generated from the catalog. Links are relative, so the website can live at a GitHub Pages repository path as well as at the root of a domain. Bundle any assets used by a visualization beside its `interactive.html`.

Use trusted HTML for visualizations and explanations: these files are code maintained as part of the project, not visitor uploads.

## Publish to GitHub Pages

The project repository is [archer-yang-lab/vis](https://github.com/archer-yang-lab/vis). Only this project belongs in that repository; keep the surrounding teaching workspace separate.

1. Push the source files to the repository's `main` branch. If you use a different branch, update the trigger in `.github/workflows/pages.yml`.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Open **Actions → Publish visualization library → Run workflow**, or push another change to `main`.

The workflow builds and publishes only `dist/`. Subsequent pushes to `main` publish updates automatically.

The home page is at [archer-yang-lab.github.io/vis/](https://archer-yang-lab.github.io/vis/). The first visualization has its own URL: [Rotations and column orthogonality](https://archer-yang-lab.github.io/vis/visualizations/rotations-and-columns/).

For an existing website, the built files can instead be placed in a dedicated subdirectory and linked from that site's navigation. Integrate with its existing publishing process rather than replacing its home page or workflow.

## Design

Neutral surfaces, thin borders, system typography, blue links, and a compact catalog follow the visual language of [GitHub's Primer design system](https://primer.style/product/primitives/color/). The layout supports small screens and follows the device's light or dark appearance. There are no placeholder visualizations or inactive navigation items.

Publishing follows the official [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
