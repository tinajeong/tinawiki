# AGENT GUIDELINES

These instructions apply to the entire repository.

## Project character
- This site is a hand-crafted, static blog. Keep dependencies to plain HTML, CSS, and minimal vanilla JavaScript. Do **not** introduce front-end frameworks or build tooling without explicit direction.
- Maintain the calm, type-driven aesthetic inspired by Apple Human Interface Guidelines and Toss Product Principles: plenty of whitespace, balanced typography, and clear hierarchy.
- Favor progressive enhancement and graceful degradation so the site remains readable even if JavaScript is unavailable.

## Content structure
- Blog posts live under `posts/` as Markdown files. When adding or renaming a post, update `posts/manifest.json` to keep metadata in sync.
- Use semantic headings inside Markdown and keep tone professional but friendly. Provide short Korean summaries when appropriate.
- Avoid embedding heavy assets. Prefer lightweight SVG or optimized images when absolutely necessary.

## Styling
- Primary styling lives in `styles.css`. Keep selectors simple, rely on CSS custom properties already defined, and document any new tokens with inline comments.
- Ensure the layout remains responsive down to 320px wide viewports. Test typography and spacing adjustments for small screens.

## Accessibility & performance
- Use semantic HTML elements (`main`, `nav`, `article`, etc.) and ensure sufficient color contrast.
- Any interactive behavior implemented in `scripts/` must be keyboard accessible and free of blocking animations.
- Defer non-critical JavaScript and avoid layout thrashing.

## Git & PR hygiene
- When tests or build steps are not applicable, explicitly state that in the testing section of commit/PR summaries.
- Keep commit messages meaningful (present tense, short summary). Group related changes together.

