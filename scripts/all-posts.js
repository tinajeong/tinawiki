(function () {
        const grid = document.getElementById('post-grid');
        if (!grid) return;

        const manifestPath = grid.dataset.manifest || 'posts/manifest.json';
        const defaultThumbnail = 'assets/images/default-post-thumbnail.svg';

        function formatDate(dateString) {
                if (!dateString) return '';
                const date = new Date(`${dateString}T00:00:00`);
                if (Number.isNaN(date.getTime())) return dateString;
                return new Intl.DateTimeFormat('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                }).format(date);
        }

        function createCard(post) {
                const article = document.createElement('article');
                article.className = 'post-card';
                article.setAttribute('role', 'listitem');

                const cardLink = document.createElement('a');
                cardLink.className = 'post-card-link';
                cardLink.href = `posts.html#${post.slug}`;
                cardLink.setAttribute('aria-label', `${post.title} 상세 보기`);

                const media = document.createElement('div');
                media.className = 'post-card-media';

                const thumbnail = document.createElement('img');
                thumbnail.className = 'post-card-thumb';
                thumbnail.loading = 'lazy';
                thumbnail.decoding = 'async';
                thumbnail.src = post.thumbnail || defaultThumbnail;
                thumbnail.alt = post.thumbnailAlt || `${post.title} 대표 이미지`;

                media.appendChild(thumbnail);

                const header = document.createElement('header');
                header.className = 'post-card-header';

                const category = document.createElement('span');
                category.className = 'post-card-category';
                category.textContent = post.category || '기타';

                const date = document.createElement('time');
                date.className = 'post-card-date';
                if (post.date) {
                        date.setAttribute('datetime', post.date);
                }
                date.textContent = formatDate(post.date);

                header.append(category, date);

                const title = document.createElement('h2');
                title.className = 'post-card-title';
                title.textContent = post.title;

                const description = document.createElement('p');
                description.className = 'post-card-description';
                description.textContent = post.description || '요약 정보가 곧 채워질 예정입니다.';

                const footer = document.createElement('div');
                footer.className = 'post-card-footer';

                const action = document.createElement('span');
                action.className = 'post-card-cta';
                action.textContent = '글로 이동하기 →';

                footer.appendChild(action);

                cardLink.append(media, header, title, description, footer);
                article.appendChild(cardLink);
                return article;
        }

        function render(posts) {
                if (!posts.length) {
                        grid.innerHTML = '<p class="error">등록된 글이 없습니다.</p>';
                        return;
                }

                const sorted = posts.slice().sort((a, b) => {
                        if (!a.date && !b.date) return a.title.localeCompare(b.title, 'ko');
                        if (!a.date) return 1;
                        if (!b.date) return -1;
                        if (a.date === b.date) return a.title.localeCompare(b.title, 'ko');
                        return a.date > b.date ? -1 : 1;
                });

                grid.innerHTML = '';
                sorted.forEach((post) => grid.appendChild(createCard(post)));
        }

        fetch(manifestPath)
                .then((response) => {
                        if (!response.ok) {
                                throw new Error('글 목록을 불러오지 못했습니다.');
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
