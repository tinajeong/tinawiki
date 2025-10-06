(function () {
  const postContainer = document.getElementById("post-content");
  if (!postContainer) return;

  const postPath = postContainer.dataset.src || "posts/first-post.md";

  function renderMarkdown(markdown) {
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

    const html = marked.parse(markdown, {
      breaks: true,
    });

    postContainer.innerHTML = html;
  }

  fetch(postPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error("포스트를 찾을 수 없습니다.");
      }
      return response.text();
    })
    .then(renderMarkdown)
    .catch((error) => {
      postContainer.innerHTML = `<p class="error">${error.message}</p>`;
    });
})();
