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
3. In Gabia DNS settings, **remove any existing A/CNAME records** that still point `www` (or the root) to your previous hosting service.
4. Create a new CNAME record:
   - **Host**: `www`
   - **Type**: `CNAME`
   - **Value**: `<github-username>.github.io.` (replace the placeholder with your GitHub username)
   - **TTL**: keep the default value (e.g. 600 seconds)
5. Wait for DNS propagation (can take up to 24 hours). You can check progress with `dig www.tinawiki.com` or an online DNS checker.

If you also want the apex domain (`tinawiki.com`) to redirect, add **four** `A` records pointing to GitHub Pages IPs (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) or configure forwarding within Gabia.

### Troubleshooting: still seeing the old site

- Double-check that no other DNS records conflict with the new `www` CNAME (old A records are common culprits).
- Clear your local DNS cache or test from a different network to avoid cached results.
- Use `dig www.tinawiki.com +trace` to confirm the CNAME now resolves to `<github-username>.github.io.`.
- In the GitHub repository → Settings → Pages, re-save the custom domain to trigger certificate provisioning once DNS is correct.

## Writing new posts

1. Create a Markdown file inside `posts/` (e.g. `posts/my-new-post.md`).
2. Append an entry to `posts/manifest.json` with the post metadata:

   ```json
   {
     "slug": "my-new-post",
     "title": "포스트 제목",
     "date": "2025-02-10",
     "category": "카테고리 이름",
     "description": "짧은 요약 문장",
     "file": "posts/my-new-post.md"
   }
   ```

   - **slug**: used for deep-linking via `/#slug`.
   - **date**: ISO `YYYY-MM-DD` format so the archive can sort correctly.
   - **category**: posts are grouped by this value in the archive sidebar.
   - **description**: shown under the title to help readers scan.

3. Commit both the Markdown and manifest updates. The homepage will automatically list the new post under the matching category and load it when selected.
