(function () {
  document.documentElement.classList.add("js");

  const postContainer = document.getElementById("post-content");
  if (!postContainer) return;

  const postViewer = document.getElementById("post-viewer");
  const postLayout = document.querySelector(".post-layout");
  const postSidebar = document.getElementById("post-sidebar");
  const titleEl = document.getElementById("post-title");
  const dateEl = document.getElementById("post-date");
  const categoryEl = document.getElementById("post-category");
  const tocContainer = document.getElementById("post-toc");
  const nextStepContainer = document.getElementById("next-step-cards");
  const progressBar = document.getElementById("reading-progress-bar");

  const manifestPath =
    postContainer.dataset.manifest || "posts/manifest.json";
  const defaultSlug = postContainer.dataset.defaultSlug;

  let posts = [];
  let postMap = new Map();
  let currentSlug = null;
  let mermaidLoader = null;
  let tocHeadings = [];
  let tocButtons = [];
  let requestToken = 0;
  let scrollSyncScheduled = false;

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  function normalizePostType(post) {
    return post?.type === "insight" ? "insight" : "technical";
  }

  function getPostMetric(post) {
    return post.readTime || "";
  }

  function getPostCta(post) {
    return "Read more";
  }

  function getTagLabel(post) {
    if (Array.isArray(post.tags) && post.tags.length) {
      return post.tags.slice(0, 2).join(" · ");
    }
    return post.category || "기타";
  }

  function compareDateDesc(a, b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    if (a.date === b.date) return 0;
    return a.date > b.date ? -1 : 1;
  }

  function getSuggestedPosts(currentPost, limit) {
    return posts
      .filter((post) => post.slug !== currentPost.slug)
      .map((post) => {
        let score = 0;
        if (post.category && post.category === currentPost.category) score += 4;
        if (normalizePostType(post) === normalizePostType(currentPost)) score += 2;
        if (post.pinned) score += 1;
        return { post, score };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const dateOrder = compareDateDesc(a.post, b.post);
        if (dateOrder !== 0) return dateOrder;
        return a.post.title.localeCompare(b.post.title, "ko");
      })
      .slice(0, limit)
      .map((entry) => entry.post);
  }

  function navigateToPost(slug) {
    loadPost(slug, { updateHash: true, scrollToTop: true });
  }

  function renderNextSteps(currentPost) {
    if (!nextStepContainer) return;
    const nextCandidates = getSuggestedPosts(currentPost, 6);

    if (!nextCandidates.length) {
      nextStepContainer.innerHTML =
        "<p class=\"sidebar-empty\">다음에 읽을 글을 준비 중입니다.</p>";
      return;
    }

    nextStepContainer.innerHTML = "";
    const fragment = document.createDocumentFragment();

    nextCandidates.forEach((post) => {
      const card = document.createElement("article");
      card.className = "next-step-card";
      card.setAttribute("role", "listitem");

      const link = document.createElement("a");
      link.className = "next-step-link";
      link.href = `#${post.slug}`;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        navigateToPost(post.slug);
      });

      const tag = document.createElement("p");
      tag.className = "next-step-tag";
      tag.textContent = getTagLabel(post);

      const title = document.createElement("h4");
      title.className = "next-step-title";
      title.textContent = post.title;

      const summary = document.createElement("p");
      summary.className = "next-step-summary";
      summary.textContent =
        post.description || "핵심 포인트를 간결하게 정리한 글입니다.";

      const cta = document.createElement("span");
      cta.className = "next-step-cta";
      cta.textContent = getPostCta(post);

      const metric = getPostMetric(post);
      if (metric) {
        const meta = document.createElement("p");
        meta.className = "next-step-meta";
        meta.textContent = metric;
        link.append(tag, title, summary, meta, cta);
      } else {
        link.append(tag, title, summary, cta);
      }
      card.appendChild(link);
      fragment.appendChild(card);
    });

    nextStepContainer.appendChild(fragment);
  }

  function updateMeta(post) {
    if (titleEl) {
      titleEl.textContent = post.title;
    }
    if (dateEl) {
      const formatted = formatDate(post.date);
      dateEl.textContent = formatted;
      if (post.date) {
        dateEl.setAttribute("datetime", post.date);
      }
    }
    if (categoryEl) {
      categoryEl.textContent = post.category || "";
    }
  }

  function slugifyHeading(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\u3131-\u318e\uac00-\ud7a3\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function buildToc() {
    if (!tocContainer) return;

    const headings = Array.from(postContainer.querySelectorAll("h2, h3"));
    tocHeadings = headings.map((heading, index) => {
      if (!heading.id) {
        const slug = slugifyHeading(heading.textContent) || "section";
        heading.id = `${slug}-${index + 1}`;
      }
      return heading;
    });

    tocButtons = [];

    if (!tocHeadings.length) {
      tocContainer.innerHTML =
        "<p class=\"sidebar-empty\">짧은 글이라 목차를 생략했습니다.</p>";
      return;
    }

    const list = document.createElement("ol");
    list.className = "toc-list";

    tocHeadings.forEach((heading) => {
      const item = document.createElement("li");
      item.className = "toc-item";
      if (heading.tagName === "H3") {
        item.classList.add("depth-3");
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "toc-link";
      button.dataset.target = heading.id;
      button.textContent = heading.textContent.trim();
      button.addEventListener("click", () => {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      item.appendChild(button);
      list.appendChild(item);
      tocButtons.push(button);
    });

    tocContainer.innerHTML = "";
    tocContainer.appendChild(list);
  }

  function updateActiveTocLink() {
    if (!tocHeadings.length || !tocButtons.length) return;

    const anchorOffset = 150;
    let activeId = tocHeadings[0].id;

    tocHeadings.forEach((heading) => {
      if (heading.getBoundingClientRect().top - anchorOffset <= 0) {
        activeId = heading.id;
      }
    });

    tocButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.target === activeId);
    });
  }

  function updateSidebarVisibility() {
    if (!postLayout || !postSidebar) return;
    const showSidebar = tocHeadings.length >= 2;
    postLayout.classList.toggle("is-sidebar-visible", showSidebar);
    postSidebar.hidden = !showSidebar;
  }

  function getAbsoluteTop(element) {
    const rect = element.getBoundingClientRect();
    return window.scrollY + rect.top;
  }

  function updateReadingProgress() {
    if (!progressBar || !postViewer) return;

    const start = getAbsoluteTop(postViewer) - 120;
    const end = getAbsoluteTop(postViewer) + postViewer.offsetHeight - window.innerHeight * 0.65;
    const ratio = end <= start ? 1 : (window.scrollY - start) / (end - start);
    const bounded = Math.min(1, Math.max(0, ratio));
    progressBar.style.transform = `scaleX(${bounded})`;
  }

  function syncScrollIndicators() {
    if (scrollSyncScheduled) return;
    scrollSyncScheduled = true;
    window.requestAnimationFrame(() => {
      scrollSyncScheduled = false;
      updateActiveTocLink();
      updateReadingProgress();
    });
  }

  function renderMarkdown(markdown, post) {
    if (typeof marked === "undefined") {
      postContainer.innerHTML =
        "<p class=\"error\">Markdown 엔진을 불러오지 못했습니다.</p>";
      return;
    }

    marked.setOptions({
      breaks: true,
      mangle: false,
      headerIds: false,
    });

    const html = marked.parse(markdown, { breaks: true });
    postContainer.innerHTML = html;

    const heading = postContainer.querySelector("h1");
    const currentTitle = titleEl?.textContent?.trim();
    if (heading && heading.textContent.trim() === currentTitle) {
      heading.remove();
    }

    hydrateMermaid();
    highlightCode();
    buildToc();
    renderNextSteps(post);
    updateSidebarVisibility();
    syncScrollIndicators();
  }

  function showError(message) {
    postContainer.innerHTML = `<p class="error">${message}</p>`;
  }

  function loadPost(
    slug,
    { updateHash = true, scrollToTop = true } = {}
  ) {
    const post = postMap.get(slug);
    if (!post) {
      showError("선택한 글을 찾을 수 없습니다.");
      return;
    }

    currentSlug = slug;
    if (updateHash) {
      const newHash = `#${slug}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }

    updateMeta(post);
    postContainer.innerHTML = "<p class=\"loading\">포스트를 불러오는 중입니다…</p>";
    if (scrollToTop && postViewer) {
      const top = Math.max(0, getAbsoluteTop(postViewer) - 96);
      window.scrollTo({ top, behavior: "smooth" });
    }

    const currentToken = ++requestToken;

    fetch(post.file)
      .then((response) => {
        if (!response.ok) {
          throw new Error("포스트를 찾을 수 없습니다.");
        }
        return response.text();
      })
      .then((markdown) => {
        if (currentToken !== requestToken) return;
        renderMarkdown(markdown, post);
      })
      .catch((error) => {
        if (currentToken !== requestToken) return;
        showError(error.message);
      });
  }

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (!mermaidLoader) {
      mermaidLoader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
        script.async = true;
        script.onload = () => {
          if (window.mermaid) {
            window.mermaid.initialize({
              startOnLoad: false,
              securityLevel: "loose",
              theme: "neutral",
            });
            resolve(window.mermaid);
          } else {
            reject(new Error("Mermaid 엔진이 로드되지 않았습니다."));
          }
        };
        script.onerror = () =>
          reject(new Error("Mermaid 스크립트를 불러오지 못했습니다."));
        document.head.appendChild(script);
      });
    }
    return mermaidLoader;
  }

  function hydrateMermaid() {
    const codeBlocks = postContainer.querySelectorAll("pre code.language-mermaid");
    if (!codeBlocks.length) return;

    loadMermaid()
      .then((mermaid) => {
        const targets = [];
        codeBlocks.forEach((code) => {
          const pre = code.parentElement;
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-diagram";
          wrapper.textContent = code.textContent;
          pre.replaceWith(wrapper);
          targets.push(wrapper);
        });
        mermaid.init(undefined, targets);
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }

  function highlightCode() {
    if (typeof hljs === "undefined") return;

    const codeBlocks = postContainer.querySelectorAll("pre code");
    codeBlocks.forEach((block) => {
      if (block.classList.contains("language-mermaid")) return;

      const languageClass = Array.from(block.classList).find((cls) =>
        cls.startsWith("language-")
      );

      if (languageClass) {
        const language = languageClass.replace("language-", "");
        if (language && hljs.getLanguage(language)) {
          hljs.highlightElement(block);
          return;
        }
      }

      block.classList.add("hljs");
      hljs.highlightElement(block);
    });
  }

  function onHashChange() {
    const slug = window.location.hash.replace(/^#/, "");
    if (slug && slug !== currentSlug && postMap.has(slug)) {
      loadPost(slug, { updateHash: false, scrollToTop: true });
    }
  }

  function hydrate(manifest) {
    posts = Array.isArray(manifest) ? manifest : [];
    postMap = new Map(posts.map((post) => [post.slug, post]));

    const initialSlug =
      window.location.hash.replace(/^#/, "") || defaultSlug || posts[0]?.slug;

    if (initialSlug) {
      loadPost(initialSlug, { updateHash: false, scrollToTop: false });
    }
  }

  fetch(manifestPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error("글 목록을 불러오지 못했습니다.");
      }
      return response.json();
    })
    .then(hydrate)
    .catch((error) => {
      if (tocContainer) {
        tocContainer.innerHTML = `<p class="error">${error.message}</p>`;
      }
      if (nextStepContainer) {
        nextStepContainer.innerHTML = `<p class="error">${error.message}</p>`;
      }
      showError(error.message);
    });

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("scroll", syncScrollIndicators, { passive: true });
  window.addEventListener("resize", syncScrollIndicators);
})();
