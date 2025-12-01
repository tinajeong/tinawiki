(function () {
  const postContainer = document.getElementById("post-content");
  if (!postContainer) return;

  const listContainer = document.getElementById("post-list");
  const titleEl = document.getElementById("post-title");
  const dateEl = document.getElementById("post-date");
  const categoryEl = document.getElementById("post-category");
  const archive = document.querySelector(".post-archive");
  const archiveToggle = document.getElementById("archive-toggle");
  const mobileMedia = window.matchMedia("(max-width: 960px)");

  const manifestPath =
    postContainer.dataset.manifest || "posts/manifest.json";
  const defaultSlug = postContainer.dataset.defaultSlug;

  let posts = [];
  let postMap = new Map();
  let currentSlug = null;
  let mermaidLoader = null;

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

  function setActiveLink(slug) {
    if (!listContainer) return;
    listContainer
      .querySelectorAll(".post-link")
      .forEach((button) => {
        const isActive = button.dataset.slug === slug;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-current", isActive ? "true" : "false");
      });
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

  function renderMarkdown(markdown) {
    if (typeof window.simpleMarkdown !== "function") {
      postContainer.innerHTML =
        "<p class=\"error\">Markdown 엔진을 불러오지 못했습니다.</p>";
      return;
    }

    const html = window.simpleMarkdown(markdown);
    postContainer.innerHTML = html;

    const heading = postContainer.querySelector("h1");
    const currentTitle = titleEl?.textContent?.trim();
    if (heading && heading.textContent.trim() === currentTitle) {
      heading.remove();
    }

    hydrateMermaid();
    highlightCode();
  }

  function showError(message) {
    postContainer.innerHTML = `<p class="error">${message}</p>`;
  }

  function loadPost(slug, { updateHash = true } = {}) {
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
    setActiveLink(slug);
    postContainer.innerHTML = "<p class=\"loading\">포스트를 불러오는 중입니다…</p>";

    fetch(post.file)
      .then((response) => {
        if (!response.ok) {
          throw new Error("포스트를 찾을 수 없습니다.");
        }
        return response.text();
      })
      .then(renderMarkdown)
      .catch((error) => {
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
      loadPost(slug, { updateHash: false });
    }
  }

  function renderPostList() {
    if (!listContainer) return;

    if (!posts.length) {
      listContainer.innerHTML =
        "<p class=\"error\">아직 등록된 글이 없습니다.</p>";
      return;
    }

    listContainer.innerHTML = "";

    const categoryOrder = [];
    const grouped = posts.reduce((acc, post) => {
      const key = post.category || "기타";
      if (!acc[key]) {
        acc[key] = [];
        categoryOrder.push(key);
      }
      acc[key].push(post);
      return acc;
    }, {});

    categoryOrder.forEach((category, index) => {
      const section = document.createElement("section");
      section.className = "category-group";
      const categoryId = `category-${index + 1}`;
      section.setAttribute("role", "group");
      section.setAttribute("aria-labelledby", categoryId);

      const heading = document.createElement("h3");
      heading.className = "category-title";
      heading.id = categoryId;
      heading.textContent = category;

      const list = document.createElement("ul");
      list.className = "category-list";
      list.setAttribute("role", "list");

      grouped[category]
        .slice()
        .sort((a, b) => {
          if (!a.date && !b.date) return a.title.localeCompare(b.title, "ko");
          if (!a.date) return 1;
          if (!b.date) return -1;
          if (a.date === b.date) return a.title.localeCompare(b.title, "ko");
          return a.date > b.date ? -1 : 1;
        })
        .forEach((post) => {
          const item = document.createElement("li");
          item.className = "category-list-item";

          const button = document.createElement("button");
          button.type = "button";
          button.className = "post-link";
          button.dataset.slug = post.slug;
          const title = document.createElement("span");
          title.className = "post-link-title";
          title.textContent = post.title;

          const meta = document.createElement("span");
          meta.className = "post-link-meta";
          meta.textContent = formatDate(post.date);

          button.append(title, meta);
          button.addEventListener("click", () => loadPost(post.slug));

          item.appendChild(button);
          list.appendChild(item);
        });

      section.appendChild(heading);
      section.appendChild(list);
      listContainer.appendChild(section);
    });
  }

  function hydrate(manifest) {
    posts = Array.isArray(manifest) ? manifest : [];
    postMap = new Map(posts.map((post) => [post.slug, post]));
    renderPostList();

    const initialSlug =
      window.location.hash.replace(/^#/, "") || defaultSlug || posts[0]?.slug;

    if (initialSlug) {
      loadPost(initialSlug, { updateHash: false });
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
      if (listContainer) {
        listContainer.innerHTML = `<p class="error">${error.message}</p>`;
      }
      showError(error.message);
    });

  window.addEventListener("hashchange", onHashChange);

  function setArchiveExpanded(expanded) {
    if (!archive) return;
    archive.classList.toggle("is-collapsed", !expanded);
    if (archiveToggle) {
      archiveToggle.setAttribute("aria-expanded", expanded);
      archiveToggle.textContent = expanded ? "목록 닫기" : "목록 열기";
    }
  }

  function handleBreakpoint(event) {
    setArchiveExpanded(!event.matches);
  }

  if (archiveToggle) {
    archiveToggle.addEventListener("click", () => {
      const isExpanded = archiveToggle.getAttribute("aria-expanded") === "true";
      setArchiveExpanded(!isExpanded);
    });

    setArchiveExpanded(!mobileMedia.matches);
    mobileMedia.addEventListener("change", handleBreakpoint);
  }
})();
