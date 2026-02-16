(function () {
	const grid = document.getElementById('post-grid');
	if (!grid) return;

	const manifestPath = grid.dataset.manifest || 'posts/manifest.json';
	const searchInput = document.getElementById('post-search');
	const categoryFilter = document.getElementById('post-category-filter');
	const viewButtons = Array.from(document.querySelectorAll('.view-toggle'));
	const resultCount = document.getElementById('post-result-count');
	const viewStorageKey = 'tinawiki-post-grid-view';

	let allPosts = [];
	const state = {
		search: '',
		category: '',
		view: 'card',
	};

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

	function getCardMetric(post) {
		return post.readTime || '';
	}

	function getCardCta(post) {
		return 'Read more';
	}

	function getCardTag(post) {
		if (Array.isArray(post.tags) && post.tags.length) {
			return post.tags.slice(0, 2).join(' · ');
		}
		return post.category || '기타';
	}

	function normalize(value) {
		return String(value || '').toLocaleLowerCase('ko-KR').trim();
	}

	function sortPosts(posts) {
		return posts.slice().sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			if (!a.date && !b.date) return a.title.localeCompare(b.title, 'ko');
			if (!a.date) return 1;
			if (!b.date) return -1;
			if (a.date === b.date) return a.title.localeCompare(b.title, 'ko');
			return a.date > b.date ? -1 : 1;
		});
	}

	function createCard(post) {
		const article = document.createElement('article');
		article.className = 'post-card';
		article.setAttribute('role', 'listitem');

		const cardLink = document.createElement('a');
		cardLink.className = 'post-card-link';
		cardLink.href = `posts.html#${post.slug}`;
		cardLink.setAttribute('aria-label', `${post.title} 상세 보기`);

		const header = document.createElement('header');
		header.className = 'post-card-header';

		if (post.pinned) {
			article.classList.add('is-pinned');
			const pin = document.createElement('span');
			pin.className = 'post-card-pin';
			pin.setAttribute('aria-label', 'Pinned post');
			pin.textContent = '📌';
			header.appendChild(pin);
		}

		const category = document.createElement('span');
		category.className = 'post-card-category';
		category.textContent = getCardTag(post);

		const date = document.createElement('time');
		date.className = 'post-card-date';
		if (post.date) date.setAttribute('datetime', post.date);
		date.textContent = formatDate(post.date) || '날짜 미기입';

		header.append(category, date);

		const title = document.createElement('h2');
		title.className = 'post-card-title';
		title.textContent = post.title;

		const description = document.createElement('p');
		description.className = 'post-card-description';
		description.textContent = post.description || '요약 정보가 곧 채워질 예정입니다.';

		const footer = document.createElement('div');
		footer.className = 'post-card-footer';
		const metricText = getCardMetric(post);
		const cta = document.createElement('span');
		cta.className = 'post-card-cta';
		cta.textContent = getCardCta(post);

		if (metricText) {
			const metric = document.createElement('span');
			metric.className = 'post-card-metric';
			metric.textContent = metricText;
			footer.append(metric, cta);
		} else {
			footer.append(cta);
		}

		cardLink.append(header, title, description, footer);
		article.appendChild(cardLink);
		return article;
	}

	function updateCategoryFilter(posts) {
		if (!categoryFilter) return;
		const categories = Array.from(
			new Set(posts.map((post) => post.category).filter((category) => Boolean(category)))
		).sort((a, b) => a.localeCompare(b, 'ko'));

		const previousValue = state.category;
		categoryFilter.innerHTML = '<option value="">전체 카테고리</option>';

		categories.forEach((category) => {
			const option = document.createElement('option');
			option.value = category;
			option.textContent = category;
			categoryFilter.appendChild(option);
		});

		if (previousValue && categories.includes(previousValue)) {
			categoryFilter.value = previousValue;
			return;
		}

		categoryFilter.value = '';
		state.category = '';
	}

	function updateResultCount(visible, total) {
		if (!resultCount) return;
		if (!total) {
			resultCount.textContent = '표시할 글이 없습니다.';
			return;
		}
		resultCount.textContent = visible === total ? `총 ${total}개 글` : `${visible}개 / 총 ${total}개`;
	}

	function applyView(view) {
		const nextView = view === 'compact' ? 'compact' : 'card';
		state.view = nextView;
		grid.dataset.view = nextView;

		viewButtons.forEach((button) => {
			const isActive = button.dataset.view === nextView;
			button.classList.toggle('is-active', isActive);
			button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
		});

		try {
			localStorage.setItem(viewStorageKey, nextView);
		} catch (error) {
			// localStorage가 차단된 환경에서는 상태 저장을 생략한다.
		}
	}

	function getFilteredPosts() {
		const query = normalize(state.search);
		return allPosts.filter((post) => {
			const matchesCategory = !state.category || post.category === state.category;
			if (!matchesCategory) return false;
			if (!query) return true;

			const searchTarget = normalize([
				post.title,
				post.description,
				post.category,
				post.slug,
				post.type,
				Array.isArray(post.tags) ? post.tags.join(' ') : '',
			].join(' '));
			return searchTarget.includes(query);
		});
	}

	function renderList(posts) {
		if (!posts.length) {
			grid.innerHTML = '<p class="error">등록된 글이 없습니다.</p>';
			return;
		}

		grid.innerHTML = '';
		const fragment = document.createDocumentFragment();
		sortPosts(posts).forEach((post) => fragment.appendChild(createCard(post)));
		grid.appendChild(fragment);
	}

	function render() {
		const filteredPosts = getFilteredPosts();
		renderList(filteredPosts);
		updateResultCount(filteredPosts.length, allPosts.length);
	}

	function bindEvents() {
		if (searchInput) {
			searchInput.addEventListener('input', (event) => {
				state.search = event.target.value || '';
				render();
			});
		}

		if (categoryFilter) {
			categoryFilter.addEventListener('change', (event) => {
				state.category = event.target.value || '';
				render();
			});
		}

		viewButtons.forEach((button) => {
			button.addEventListener('click', () => applyView(button.dataset.view));
		});
	}

	function restoreView() {
		try {
			const savedView = localStorage.getItem(viewStorageKey);
			applyView(savedView === 'compact' ? 'compact' : 'card');
		} catch (error) {
			applyView('card');
		}
	}

	fetch(manifestPath)
		.then((response) => {
			if (!response.ok) {
				throw new Error('글 목록을 불러오지 못했습니다.');
			}
			return response.json();
		})
		.then((manifest) => {
			allPosts = Array.isArray(manifest) ? manifest : [];
			updateCategoryFilter(allPosts);
			restoreView();
			bindEvents();
			render();
		})
		.catch((error) => {
			grid.innerHTML = `<p class="error">${error.message}</p>`;
			updateResultCount(0, 0);
			restoreView();
		});
})();
