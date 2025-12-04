const textarea = document.getElementById('markdown-input');
const preview = document.getElementById('preview');

const starterContent = `# Handmade Web Starter Kit

이 키트는 마크다운 기반 글쓰기와 심플한 레이아웃, 유지보수가 쉬운 디자인 시스템 토큰으로 구성됩니다.

## 기본 사용법
- 좌측 입력창에서 마크다운을 작성합니다.
- 코드를 작성할 때는 백틱을 사용해 강조하거나, 세 개의 백틱으로 블록을 감쌉니다.
- 우측에서 HTML 결과를 확인하며 간격과 서체 리듬을 조정합니다.

### 디자인 토큰
- 색상, 간격, 모서리 값은 **CSS 변수**로 정의되어 있습니다.
- 코드와 본문 서체를 분리해 가독성을 높였습니다.

> 자바스크립트 없이도 원문을 복사해 활용할 수 있습니다.

\`\`\`
const designTokens = {
  accent: '#1f6feb',
  surface: '#ffffff',
};
\`\`\``;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  return safe;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').trimEnd().split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let inCode = false;
  let codeBuffer = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
        inCode = false;
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (/^> /.test(line)) {
      if (!inBlockquote) {
        html += '<blockquote>';
        inBlockquote = true;
      }
      const content = line.replace(/^> /, '');
      html += `<p>${renderInline(content)}</p>`;
      return;
    }

    if (inBlockquote) {
      html += '</blockquote>';
      inBlockquote = false;
    }

    if (/^[*-] /.test(line)) {
      if (!inUl) {
        if (inOl) {
          html += '</ol>';
          inOl = false;
        }
        html += '<ul>';
        inUl = true;
      }
      html += `<li>${renderInline(line.slice(2))}</li>`;
      return;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      if (!inOl) {
        if (inUl) {
          html += '</ul>';
          inUl = false;
        }
        html += '<ol>';
        inOl = true;
      }
      html += `<li>${renderInline(orderedMatch[2])}</li>`;
      return;
    }

    if (line === '') {
      if (inUl) {
        html += '</ul>';
        inUl = false;
      }
      if (inOl) {
        html += '</ol>';
        inOl = false;
      }
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      html += `<h${level}>${content}</h${level}>`;
      return;
    }

    html += `<p>${renderInline(line)}</p>`;
  });

  if (inUl) html += '</ul>';
  if (inOl) html += '</ol>';
  if (inBlockquote) html += '</blockquote>';
  if (inCode) {
    html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
  }

  return html || '<p>마크다운을 입력해보세요.</p>';
}

function updatePreview() {
  const markdown = textarea.value;
  preview.innerHTML = renderMarkdown(markdown);
}

function init() {
  textarea.value = starterContent;
  updatePreview();
  textarea.addEventListener('input', updatePreview);
}

if (textarea && preview) {
  init();
}
