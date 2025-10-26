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

## Content intelligence & editing principles
These guidelines apply when the agent edits text content such as `about.html`, `index.html`, or Markdown posts.

### 1. Audience-aware writing
- Write for **both technical and non-technical readers.**  
  Technical terms are acceptable, but every paragraph must make it clear *what problem was solved and how*.
- When using jargon, provide contextual grounding.  
  Example: “Observability” → “an integrated monitoring system combining logs, alerts, and metrics.”

### 2. Think in STAR structure
When rewriting or generating new text, follow this logical flow:
- **S (Situation):** What situation or problem existed?  
- **T (Task):** What goal was defined?  
- **A (Action):** What actions were taken (methods, tools, or designs)?  
- **R (Result):** What measurable impact or improvement followed?

Avoid vague statements; emphasize transformation and concrete results.

### 3. Enforce specificity
- Avoid abstract verbs like “visualized,” “automated,” or “optimized” without details.  
  Always specify **what** was improved and **how**.  
  Example:  
  ❌ “Improved data visibility.”  
  ✅ “Created Metabase dashboards to visualize transaction error rates and throughput.”

### 4. Tone & style
- Maintain a **technical yet explanatory** tone—precise, confident, and minimal.  
- Favor short, active sentences: *“Built,” “Redesigned,” “Automated.”*  
- Limit adjectives like “innovative” or “efficient”; replace them with evidence or metrics.  
- Use `<br>` line breaks or short paragraphs to improve rhythm and readability.

### 5. Example transformation
> Original:  
> “Visualized batch scheduling and data consistency.”  
>
> After applying these principles:  
> “Automated batch scheduling with Jenkins and GitHub Actions, and visualized job throughput and error rates through dashboards.”

### 6. Validation checklist
Before committing text changes, confirm:
- [ ] Technical accuracy is preserved.  
- [ ] The problem–action–result flow is clear.  
- [ ] A non-engineer could understand the value.  
- [ ] The content fits the site’s calm, typographic aesthetic.

---

Following these principles ensures the agent enhances not only structural and stylistic quality,  
but also **content clarity, narrative coherence, and persuasive impact.**
