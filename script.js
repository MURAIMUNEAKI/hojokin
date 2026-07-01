const BASE_URL = 'https://api.jgrants-portal.go.jp/exp';

// DOM Elements
const searchBtn = document.getElementById('search-btn');
const keywordInput = document.getElementById('keyword');
const acceptanceSelect = document.getElementById('acceptance');
const sortSelect = document.getElementById('sort');
const orderSelect = document.getElementById('order');
const toggleAdvancedBtn = document.getElementById('toggle-advanced');
const advancedFilters = document.getElementById('advanced-filters');
const resultsGrid = document.getElementById('results-grid');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');
const resultsCount = document.getElementById('results-count');
const countValue = document.getElementById('count-value');

const detailModal = document.getElementById('detail-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalBody = document.getElementById('modal-body');

// State
let isAdvancedOpen = false;

// Event Listeners
searchBtn.addEventListener('click', () => searchSubsidies());
keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchSubsidies();
});

// Quick Tags Logic
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked
        btn.classList.add('active');

        // Set keyword and search
        keywordInput.value = btn.dataset.keyword;
        searchSubsidies();
    });
});
// Reset active tags when typing manually
keywordInput.addEventListener('input', () => {
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
});

toggleAdvancedBtn.addEventListener('click', () => {
    isAdvancedOpen = !isAdvancedOpen;
    advancedFilters.classList.toggle('hidden', !isAdvancedOpen);
    toggleAdvancedBtn.textContent = isAdvancedOpen ? '詳細条件を隠す' : '詳細条件を表示';
});

closeModalBtn.addEventListener('click', () => {
    detailModal.close();
});

detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.close();
});

// Functions
async function searchSubsidies() {
    const keyword = keywordInput.value.trim();
    if (!keyword) {
        showError('キーワードを入力してください');
        return;
    }

    if (keyword.length < 2) {
        showError('検索キーワードは2文字以上で入力してください。（APIの仕様による制限です）');
        return;
    }

    // No API Key needed for public access

    showLoader();
    hideError();
    resultsGrid.innerHTML = '';
    resultsCount.classList.add('hidden');

    // Build Query Params
    const params = new URLSearchParams();
    params.append('keyword', keyword);
    params.append('sort', sortSelect.value);
    params.append('order', orderSelect.value);
    params.append('acceptance', acceptanceSelect.value);

    // Advanced
    const area = document.getElementById('target_area').value;
    if (area && isAdvancedOpen) params.append('target_area_search', area);

    const employees = document.getElementById('employees').value;
    if (employees && isAdvancedOpen) params.append('target_number_of_employees', employees);

    // Pagination defaults
    params.append('page', '1');
    params.append('count', '100'); // Maximize results for now

    try {
        const headers = {
            'Accept': 'application/json'
        };

        // Use local proxy to avoid CORS
        const targetUrl = `${BASE_URL}/v1/public/subsidies?${params.toString()}`;
        const proxyUrl = `proxy.php?url=${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            let errorDetail = '';
            try {
                const errData = await response.json();
                // Check if error is from J-Grants API or Proxy
                errorDetail = errData.error || errData.message || JSON.stringify(errData);
            } catch (e) {
                errorDetail = response.statusText;
            }

            if (response.status === 401) {
                throw new Error('認証エラー: APIへのアクセスが許可されていません。');
            }
            throw new Error(`APIエラー (${response.status}): ${errorDetail}`);
        }

        const data = await response.json();
        renderResults(data);

    } catch (err) {
        showError(err.message);
    } finally {
        hideLoader();
    }
}

function renderResults(data) {
    if (!data.result || data.result.length === 0) {
        resultsCount.classList.remove('hidden');
        countValue.textContent = '0';
        resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">該当する補助金が見つかりませんでした。</p>';
        return;
    }

    // Fix: resultset is inside metadata
    const totalCount = (data.metadata && data.metadata.resultset && data.metadata.resultset.count)
        || (data.result ? data.result.length : 0);

    countValue.textContent = totalCount;
    resultsCount.classList.remove('hidden');

    resultsGrid.innerHTML = data.result.map(item => {
        const isAccepting = isDateAccepting(item.acceptance_end_datetime);
        const statusClass = isAccepting ? 'status-open' : 'status-closed';
        const statusText = isAccepting ? '募集中' : '募集終了';

        // Handling possibly missing fields
        const title = item.title || '名称不明';
        const name = item.name || ''; // ID like S-000...
        const maxLimit = item.subsidy_max_limit ? formatCurrency(item.subsidy_max_limit) : '上限なし/不明';
        const area = item.target_area_search || '全国';
        const deadline = item.acceptance_end_datetime ? formatDate(item.acceptance_end_datetime) : '不明';

        return `
            <div class="subsidy-card" onclick="openDetail('${item.id}')">
                <div class="card-header">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <h3 class="card-title">${title}</h3>
                    <p class="card-catchphrase">${name}</p> 
                </div>
                <div class="card-body">
                    <div class="meta-item" style="margin-bottom: 8px;">
                        <ion-icon name="location-outline"></ion-icon>
                        <span>${area}</span>
                    </div>
                    <div class="meta-item">
                        <ion-icon name="calendar-outline"></ion-icon>
                        <span>締切: ${deadline}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="amount">${maxLimit}</span>
                    <ion-icon name="chevron-forward-circle-outline" style="font-size: 1.5rem; color: var(--primary); margin-left: auto;"></ion-icon>
                </div>
            </div>
        `;
    }).join('');

    // Auto-scroll to results for all devices
    setTimeout(() => {
        resultsCount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

async function openDetail(id) {
    // Show loading state in modal
    modalBody.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    detailModal.showModal();

    try {
        const targetUrl = `${BASE_URL}/v2/public/subsidies/id/${id}`;
        const proxyUrl = `proxy.php?url=${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) throw new Error('詳細情報の取得に失敗しました');

        const data = await response.json();
        const detail = data.result[0]; // Usually returns a list with 1 item

        renderDetailModal(detail);

    } catch (err) {
        modalBody.innerHTML = `<p style="color: var(--danger)">エラー: ${err.message}</p>`;
    }
}

function renderDetailModal(item) {
    const title = item.title || '名称不明';
    const catchPhrase = item.subsidy_catch_phrase || '';
    const detailText = item.detail || '詳細情報はありません。';
    const purpose = item.use_purpose || '未指定';
    const industry = item.industry || '未指定';
    const employees = item.target_number_of_employees || '未指定';
    const maxLimit = item.subsidy_max_limit ? formatCurrency(item.subsidy_max_limit) : '-';
    const rate = item.subsidy_rate || '-';

    // Pdf links usually in item.application_guidelines, item.outline_of_grant etc
    // In sample: "application_guidelines": {"name": "...", "data": "..."} NO, data is base64?
    // Wait, the sample showed "data": "JVBER..." which is base64.
    // If it's base64, we can create a download link.
    // But typically public API returns URLs. The sample showed "data" but the V2 sample field "front_subsidy_detail_page_url" is also there.
    // Let's check "front_subsidy_detail_page_url".
    const frontUrl = item.front_subsidy_detail_page_url || '#';
    const frontLink = frontUrl !== '#' ? `<a href="${frontUrl}" target="_blank" class="link-box">公式ページで見る <ion-icon name="open-outline"></ion-icon></a>` : '';

    modalBody.innerHTML = `
        <div class="detail-header">
            <h2 class="detail-title">${title}</h2>
            <p style="color: var(--text-muted); font-size: 1.1rem;">${catchPhrase}</p>
            <div class="detail-tags">
                <span class="tag">${purpose}</span>
                <span class="tag">${industry}</span>
                <span class="tag">従業員: ${employees}</span>
            </div>
        </div>

        <div class="detail-section">
            <h3>概要</h3>
            <p>${detailText}</p>
        </div>

        <div class="detail-section">
            <h3>補助条件</h3>
            <p><strong>補助率:</strong> ${rate}</p>
            <p><strong>上限額:</strong> ${maxLimit}</p>
        </div>
        
        <div class="detail-section">
             ${frontLink}
        </div>
    `;
}

// Helpers
function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showError(msg) {
    errorMessage.classList.remove('hidden');
    document.getElementById('error-text').textContent = msg;
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function isDateAccepting(endDateStr) {
    if (!endDateStr) return false;
    const end = new Date(endDateStr);
    const now = new Date();
    return end > now;
}
