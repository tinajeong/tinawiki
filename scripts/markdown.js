(function () {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function sanitizeUrl(raw) {
    try {
      const parsed = new URL(raw, window.location.origin);
      return parsed.href;
    } catch (error) {
      console.warn('Invalid URL skipped in markdown link:', raw);
      return '#';
    }
  }

  function renderInline(text) {
    if (!text) return '';

    const codeSpans = [];
    const placeholder = (index) => `@@CODE${index}@@`;

    text = text.replace(/`([^`]+)`/g, (_, code) => {
      const index = codeSpans.length;
      codeSpans.push(escapeHtml(code));
      return placeholder(index);
    });

    text = escapeHtml(text);

    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const safeSrc = sanitizeUrl(src.trim());
      const safeAlt = escapeAttribute(alt.trim());
      return `<img src="${safeSrc}" alt="${safeAlt}">`;
    });

    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeHref = sanitizeUrl(href.trim());
      const safeLabel = label.trim();
      return `<a href="${safeHref}">${safeLabel}</a>`;
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    codeSpans.forEach((code, index) => {
      text = text.replace(placeholder(index), `<code>${code}</code>`);
    });

    return text;
  }

  function renderBlockquote(lines, startIndex) {
    const content = [];
    let index = startIndex;
    while (index < lines.length && /^>/.test(lines[index])) {
      const stripped = lines[index].replace(/^>\s?/, '');
      content.push(stripped);
      index += 1;
    }

    return {
      html: `<blockquote>\n${renderMarkdown(content.join('\n'))}</blockquote>\n`,
      nextIndex: index,
    };
  }

  function renderMarkdown(input) {
    const lines = input.replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let paragraph = [];
    let inCode = false;
    let codeFence = null;
    let codeLang = '';
    let codeBuffer = [];
    let listType = null;

    const closeParagraph = () => {
      if (!paragraph.length) return;
      const text = paragraph.join(' ');
      html += `<p>${renderInline(text)}</p>\n`;
      paragraph = [];
    };

    const closeList = () => {
      if (!listType) return;
      html += `</${listType}>\n`;
      listType = null;
    };

    const closeCode = () => {
      if (!inCode) return;
      const languageClass = codeLang ? ` class="language-${escapeAttribute(codeLang)}"` : '';
      html += `<pre><code${languageClass}>${escapeHtml(codeBuffer.join('\n'))}</code></pre>\n`;
      inCode = false;
      codeFence = null;
      codeLang = '';
      codeBuffer = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (inCode) {
        if (line.startsWith(codeFence)) {
          closeCode();
          continue;
        }
        codeBuffer.push(line);
        continue;
      }

      const codeMatch = line.match(/^(```|~~~)\s*(\S+)?\s*$/);
      if (codeMatch) {
        closeParagraph();
        closeList();
        inCode = true;
        codeFence = codeMatch[1];
        codeLang = codeMatch[2] || '';
        continue;
      }

      if (!line.trim()) {
        closeParagraph();
        closeList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        closeParagraph();
        closeList();
        const depth = headingMatch[1].length;
        html += `<h${depth}>${renderInline(headingMatch[2].trim())}</h${depth}>\n`;
        continue;
      }

      if (/^ {0,3}([-*_])\1{2,}\s*$/.test(line)) {
        closeParagraph();
        closeList();
        html += '<hr>\n';
        continue;
      }

      if (/^>/.test(line)) {
        closeParagraph();
        closeList();
        const result = renderBlockquote(lines, i);
        html += result.html;
        i = result.nextIndex - 1;
        continue;
      }

      const ulMatch = line.match(/^[-*+]\s+(.*)$/);
      const olMatch = line.match(/^\d+[.)]\s+(.*)$/);

      if (ulMatch || olMatch) {
        closeParagraph();
        const nextListType = olMatch ? 'ol' : 'ul';
        if (listType && listType !== nextListType) {
          closeList();
        }
        if (!listType) {
          listType = nextListType;
          html += `<${listType}>\n`;
        }
        const content = renderInline((ulMatch || olMatch)[1].trim());
        html += `<li>${content}</li>\n`;
        continue;
      }

      paragraph.push(line.trim());
    }

    closeParagraph();
    closeList();
    closeCode();

    return html;
  }

  window.simpleMarkdown = renderMarkdown;
})();
