const createRenderer = () => {
  if (!window.markdownit) return null;
  return window.markdownit({
    linkify: true,
    breaks: true
  });
};

const md = createRenderer();

const renderBlocks = () => {
  if (!md) return;

  document.querySelectorAll('[data-markdown-source]').forEach((source) => {
    const target = source.parentElement?.querySelector('[data-markdown-target]');
    if (!target) return;

    const rendered = md.render(source.textContent.trim());
    target.innerHTML = rendered;
    target.hidden = false;
    source.setAttribute('aria-hidden', 'true');
    source.classList.add('visually-hidden');
  });
};

document.addEventListener('DOMContentLoaded', renderBlocks);
