# Tina Wiki

A minimalist, Markdown-driven blog inspired by handmade web aesthetics. Posts are written in Markdown and rendered client-side using `marked`.

## Local preview

You can open `index.html` directly in a browser or serve the site with any static server:

```bash
npx serve .
```

## Custom domain setup

The site is configured to use **www.tinawiki.com** through GitHub Pages.

1. The `CNAME` file at the project root declares the custom domain so GitHub Pages knows which hostname to serve.
2. In the GitHub repository settings, add `www.tinawiki.com` as the custom domain (Pages → Custom domain).
3. In Gabia DNS settings, create a CNAME record:
   - **Host**: `www`
   - **Type**: `CNAME`
   - **Value**: `USERNAME.github.io.` (replace `USERNAME` with your GitHub username)
   - **TTL**: keep the default value (e.g. 600 seconds)
4. Wait for DNS propagation (can take up to 24 hours). You can check progress with `dig www.tinawiki.com`.

If you also want the apex domain (`tinawiki.com`) to redirect, add an `A` record pointing to GitHub Pages IPs or configure forwarding within Gabia.

## Writing new posts

Add new Markdown files under `posts/` and update the `data-src` attribute in `index.html` or extend the loader in `scripts/app.js` to support multiple entries.
