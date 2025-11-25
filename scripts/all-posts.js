(function () {
  const grid = document.getElementById("post-grid");
  if (!grid) return;

  const manifestPath = grid.dataset.manifest || "posts/manifest.json";

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function createCard(post) {
    const article = document.createElement("article");
    article.className = "post-card";
    article.setAttribute("role", "listitem");

    const header = document.createElement("header");
    header.className = "post-card-header";

    const category = document.createElement("span");
    category.className = "post-card-category";
    category.textContent = post.category || "기타";

    const date = document.createElement("time");
    date.className = "post-card-date";
    if (post.date) {
      date.setAttribute("datetime", post.date);
    }
    date.textContent = formatDate(post.date);

    header.append(category, date);

    const title = document.createElement("h2");
    title.className = "post-card-title";
    title.textContent = post.title;

    const description = document.createElement("p");
    description.className = "post-card-description";
    description.textContent = post.description || "요약 정보가 곧 채워질 예정입니다.";

    const footer = document.createElement("div");
    footer.className = "post-card-footer";

    const link = document.createElement("a");
    link.className = "post-card-link";
    link.href = `posts.html#${post.slug}`;
    link.textContent = "자세히 보기";

    footer.appendChild(link);

    article.append(header, title, description, footer);
    return article;
  }

  function render(posts) {
    if (!posts.length) {
      grid.innerHTML = "<p class=\"error\">등록된 글이 없습니다.</p>";
      return;
    }

    const sorted = posts
      .slice()
      .sort((a, b) => {
        if (!a.date && !b.date) return a.title.localeCompare(b.title, "ko");
        if (!a.date) return 1;
        if (!b.date) return -1;
        if (a.date === b.date) return a.title.localeCompare(b.title, "ko");
        return a.date > b.date ? -1 : 1;
      });

    grid.innerHTML = "";
    sorted.forEach((post) => grid.appendChild(createCard(post)));
  }

  fetch(manifestPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error("글 목록을 불러오지 못했습니다.");
      }
      return response.json();
    })
    .then((manifest) => {
      const posts = Array.isArray(manifest) ? manifest : [];
      render(posts);
    })
    .catch((error) => {
      grid.innerHTML = `<p class="error">${error.message}</p>`;
    });
})();
