const districts = [
  { name: 'Thiruvananthapuram', ml: 'തിരുവനന്തപുരം', icon: '🌴' },
  { name: 'Kollam', ml: 'കൊല്ലം', icon: '🌊' },
  { name: 'Pathanamthitta', ml: 'പത്തനംതിട്ട', icon: '🌿' },
  { name: 'Alappuzha', ml: 'ആലപ്പുഴ', icon: '🚤' },
  { name: 'Kottayam', ml: 'കോട്ടയം', icon: '🪵' },
  { name: 'Idukki', ml: 'ഇടുക്കി', icon: '🏞️' },
  { name: 'Ernakulam', ml: 'എറണാകുളം', icon: '🏙️' },
  { name: 'Thrissur', ml: 'തൃശ്ശൂര്', icon: '🎉' },
  { name: 'Palakkad', ml: 'പാലക്കാട്', icon: '🌾' },
  { name: 'Malappuram', ml: 'മലപ്പുറം', icon: '🌧️' },
  { name: 'Kozhikode', ml: 'കോഴിക്കോട്', icon: '🌅' },
  { name: 'Wayanad', ml: 'വയനം', icon: '🌲' },
  { name: 'Kannur', ml: 'കണ്ണൂര്', icon: '🏖️' },
  { name: 'Kasaragod', ml: 'കാസര്‍ഗോഡ്', icon: '🌊' }
];

const state = {
  selectedDistrict: '',
  selectedSeverity: 'low',
  reports: [],
  previewImages: [],
  currentLocation: '',
  isAdmin: false,
  adminFilterDistrict: '',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeGet(id) {
  return document.getElementById(id);
}

function showToast(message) {
  const toast = safeGet('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

function scrollToReports() {
  const section = safeGet('reports-section') || safeGet('reports-grid');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ─── Severity ──────────────────────────────────────────────────────────────

const severityLabels = { low: 'Minor', medium: 'Moderate', high: 'Severe', critical: 'Critical' };
const severityClasses = { low: 'sev-low', medium: 'sev-medium', high: 'sev-high', critical: 'sev-critical' };

function selectSev(btn, level) {
  state.selectedSeverity = level;
  document.querySelectorAll('.sev-btn').forEach(b => {
    b.classList.remove('active-low', 'active-medium', 'active-high', 'active-critical');
  });
  if (btn) {
    btn.classList.add(`active-${level}`);
  } else {
    const fallback = document.querySelector(`.sev-btn[onclick*="'${level}'"]`);
    if (fallback) fallback.classList.add(`active-${level}`);
  }
}

function getSelectedSeverity() {
  return state.selectedSeverity || 'low';
}

// ─── Load / Save Reports ───────────────────────────────────────────────────

async function loadReports() {
  try {
    const response = await fetch('/api/reports');
    const rawText = await response.text();
    let payload = [];
    try {
      payload = rawText ? JSON.parse(rawText) : [];
    } catch {
      throw new Error(rawText || 'Invalid response from server');
    }
    if (!response.ok) throw new Error(payload?.error || 'Failed to fetch reports');
    if (!Array.isArray(payload)) throw new Error('Unexpected report data format');
    state.reports = payload.map(r => ({
      ...r,
      id: r._id || r.id,
      images: Array.isArray(r.images) ? r.images : []
    }));
  } catch (error) {
    console.error('Unable to load reports:', error);
    state.reports = [];
    showToast(error.message || 'Unable to load reports. Please refresh.');
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  await loadReports();

  // Bind form submit (prevents native GET submission)
  const reportForm = safeGet('report-form-element');
  if (reportForm && !reportForm.dataset.bound) {
    reportForm.addEventListener('submit', e => { e.preventDefault(); submitReport(); });
    reportForm.dataset.bound = 'true';
  }

  const districtGrid = safeGet('district-grid');
  if (districtGrid) {
    populateDistricts();
    selectSev(null, 'low');
    renderDistricts();
    updateHeroStats();
    const locDisplay = safeGet('loc-display');
    if (locDisplay) locDisplay.style.display = 'none';
  }

  // Hide admin panel on load
  const adminPanel = safeGet('admin-panel');
  if (adminPanel) adminPanel.style.display = 'none';
}

// ─── Districts ─────────────────────────────────────────────────────────────

function populateDistricts() {
  const districtGrid = safeGet('district-grid');
  if (!districtGrid) return;

  // Only add to selects that actually exist in the HTML
  const selDistrict = safeGet('sel-district');

  districts.forEach(district => {
    // District card
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'district-card';
    card.dataset.district = district.name;
    card.innerHTML = `
      <span class="district-icon">${district.icon}</span>
      <span class="district-name">${district.name}</span>
      <span class="district-ml">${district.ml}</span>
      <span class="district-count ok">No issues</span>
      <div class="severity-bar"><span class="severity-fill" style="width:0%;background:#E8F5EE"></span></div>
    `;
    card.onclick = () => selectDistrict(district.name);
    districtGrid.appendChild(card);

    // Populate district dropdown in form
    if (selDistrict) {
      const option = document.createElement('option');
      option.value = district.name;
      option.textContent = district.name;
      selDistrict.appendChild(option);
    }
  });
}

function selectDistrict(name) {
  state.selectedDistrict = name;
  document.querySelectorAll('.district-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.district === name);
  });
  const selDistrict = safeGet('sel-district');
  if (selDistrict) selDistrict.value = name;
}

function renderDistricts() {
  const districtCards = document.querySelectorAll('.district-card');
  if (!districtCards.length) return;

  districts.forEach(d => {
    const count = state.reports.filter(r => r.district === d.name && r.status !== 'fixed').length;
    const card = document.querySelector(`.district-card[data-district="${d.name}"]`);
    if (!card) return;
    const countEl = card.querySelector('.district-count');
    if (countEl) {
      countEl.textContent = count ? `${count} open` : 'No issues';
      countEl.className = `district-count ${count <= 1 ? 'ok' : 'low'}`;
    }
    const fill = card.querySelector('.severity-fill');
    if (fill) {
      fill.style.width = `${Math.min(100, count * 18)}%`;
      fill.style.background = count === 0 ? '#E8F5EE' : count < 3 ? '#FDECEA' : '#E65100';
    }
  });
}

// ─── Image Upload ──────────────────────────────────────────────────────────

function handleImgUpload(event) {
  const files = Array.from(event.target.files);
  const previewGrid = safeGet('preview-grid');
  if (previewGrid) previewGrid.innerHTML = '';
  state.previewImages = [];

  files.slice(0, 5).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      state.previewImages.push(e.target.result);
      if (previewGrid) {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-wrapper';
        wrapper.innerHTML = `<img class="preview-img" src="${e.target.result}" alt="Preview">`;
        previewGrid.appendChild(wrapper);
      }
    };
    reader.readAsDataURL(file);
  });
}

function triggerPhotoUpload() {
  const input = safeGet('img-upload');
  if (input) { input.value = ''; input.removeAttribute('capture'); input.click(); }
}

function triggerCameraUpload() {
  const input = safeGet('img-upload-camera');
  if (!input) return;
  input.value = '';
  input.setAttribute('capture', 'environment');
  input.setAttribute('accept', 'image/*');
  setTimeout(() => input.click(), 0);
}

// ─── Location ──────────────────────────────────────────────────────────────

function getLocation() {
  const display = safeGet('loc-display');
  if (!display) return;
  if (!navigator.geolocation) {
    display.textContent = 'Geolocation not supported.';
    display.style.display = 'block';
    return;
  }
  display.textContent = 'Capturing location…';
  display.style.display = 'block';
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.currentLocation = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      display.textContent = `📍 ${state.currentLocation}`;
    },
    () => {
      display.textContent = 'Unable to capture location.';
    }
  );
}

// ─── Submit Report ─────────────────────────────────────────────────────────

async function submitReport() {
  const district = (safeGet('sel-district')?.value || '').trim();
  const road = (safeGet('inp-road')?.value || '').trim();
  const desc = (safeGet('inp-desc')?.value || '').trim();
  const name = (safeGet('inp-name')?.value || '').trim() || 'Anonymous';
  const severity = getSelectedSeverity();

  if (!district || !road || !desc) {
    showToast('Please fill in district, road, and description before submitting.');
    return;
  }

  const payload = {
    district,
    road,
    description: desc,
    severity,
    status: 'open',
    votes: 0,
    reporter: name,
    date: new Date().toLocaleDateString('en-GB'),
    location: state.currentLocation || 'Not available',
    images: [...state.previewImages]
  };

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }

    if (!response.ok) {
      throw new Error(data?.error || rawText || `Server returned ${response.status}`);
    }

    state.reports.unshift({ ...data, id: data._id });
    resetReportForm();
    renderDistricts();
    updateHeroStats();
    showToast('Report submitted successfully! 🎉');
  } catch (error) {
    console.error('submitReport error:', error);
    showToast(error.message || 'Failed to submit report. Please try again.');
  }
}

// ─── Reset Form ────────────────────────────────────────────────────────────

function resetReportForm() {
  ['sel-district', 'inp-road', 'inp-desc', 'inp-name', 'img-upload'].forEach(id => {
    const el = safeGet(id);
    if (el) el.value = '';
  });
  const previewGrid = safeGet('preview-grid');
  if (previewGrid) previewGrid.innerHTML = '';
  const locDisplay = safeGet('loc-display');
  if (locDisplay) locDisplay.style.display = 'none';

  state.previewImages = [];
  state.currentLocation = '';
  state.selectedDistrict = '';
  state.selectedSeverity = 'low';
  selectSev(null, 'low');
  document.querySelectorAll('.district-card').forEach(c => c.classList.remove('selected'));
}

// ─── Hero Stats ────────────────────────────────────────────────────────────

function updateHeroStats() {
  const totalEl = safeGet('total-reports');
  const fixedEl = safeGet('fixed-count');
  if (totalEl) totalEl.textContent = state.reports.length;
  if (fixedEl) fixedEl.textContent = state.reports.filter(r => r.status === 'fixed').length;
}

// ─── Update Report Status ──────────────────────────────────────────────────

async function updateReportStatus(id, status) {
  try {
    const response = await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Unable to update report');
    const updated = await response.json();
    state.reports = state.reports.map(r => r.id === id ? { ...updated, id: updated._id } : r);
    renderDistricts();
    updateHeroStats();
    if (state.isAdmin) renderAdmin();
    showToast(`Marked as ${status}.`);
  } catch (error) {
    console.error(error);
    showToast('Failed to update report status.');
  }
}

// ─── Delete Report ─────────────────────────────────────────────────────────

async function deleteReport(id) {
  try {
    const response = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to delete report');
    state.reports = state.reports.filter(r => r.id !== id);
    renderDistricts();
    updateHeroStats();
    if (state.isAdmin) renderAdmin();
    showToast('Report deleted.');
  } catch (error) {
    console.error(error);
    showToast('Failed to delete report.');
  }
}

// ─── Admin ─────────────────────────────────────────────────────────────────

function showPage(page) {
  const publicPage = safeGet('public-page');
  const adminPanel = safeGet('admin-panel');
  const adminModal = safeGet('admin-modal');

  if (page === 'home') {
    if (publicPage) publicPage.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
    if (adminModal) adminModal.classList.add('hidden');
  }
}

function showAdminLogin() {
  const modal = safeGet('admin-modal');
  if (modal) modal.classList.remove('hidden');
}

function adminLogin() {
  const user = (safeGet('admin-user')?.value || '').trim();
  const pass = (safeGet('admin-pass')?.value || '').trim();

  if (user === 'admin' && pass === '1234') {
    state.isAdmin = true;
    const loginPage = safeGet('admin-login-page');
    const adminPanel = safeGet('admin-panel');
    if (loginPage) loginPage.classList.add('hidden');
    if (adminPanel) { adminPanel.classList.remove('hidden'); adminPanel.style.display = 'block'; }
    const adminModal = safeGet('admin-modal');
    if (adminModal) adminModal.classList.add('hidden');
    const publicPage = safeGet('public-page');
    if (publicPage) publicPage.style.display = 'none';
    renderAdmin();
    activateAdminTab('overview');
  } else {
    showToast('Incorrect admin credentials.');
  }
}

function activateAdminTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);
  if (btn) btn.classList.add('active');
  const pane = safeGet(`tab-${tabId}`);
  if (pane) pane.classList.add('active');
  if (tabId === 'districts') renderDistrictChart();
}

function switchTab(event, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  const pane = safeGet(`tab-${tabId}`);
  if (pane) pane.classList.add('active');
  if (tabId === 'districts') renderDistrictChart();
}

function setAdminDistrictFilter(district) {
  state.adminFilterDistrict = district;
  renderAdminTable();
  updateAdminReportFilterLabel();
  activateAdminTab('reports');
}

function updateAdminReportFilterLabel() {
  const label = safeGet('admin-report-filter-label');
  if (!label) return;
  label.textContent = state.adminFilterDistrict
    ? `Showing reports for ${state.adminFilterDistrict}`
    : 'Showing all reports';
}

function renderAdmin() {
  if (!state.isAdmin) return;
  renderAdminStats();
  renderAdminTable();
  renderAdminDistrictGrid();
  updateAdminReportFilterLabel();
  renderDistrictChart();
}

function renderAdminStats() {
  const adminStats = safeGet('admin-stats');
  if (!adminStats) return;
  const open = state.reports.filter(r => r.status === 'open').length;
  const review = state.reports.filter(r => r.status === 'review').length;
  const fixed = state.reports.filter(r => r.status === 'fixed').length;
  adminStats.innerHTML = `
    ${createStatCard('Total Reports', state.reports.length)}
    ${createStatCard('Open Issues', open)}
    ${createStatCard('Under Review', review)}
    ${createStatCard('Fixed', fixed)}
  `;
}

function createStatCard(label, value) {
  return `<div class="stat-card"><div class="stat-num">${value}</div><div class="stat-label">${label}</div></div>`;
}

function renderAdminTable() {
  const tbody = safeGet('admin-tbody');
  if (!tbody) return;
  let reports = [...state.reports];
  if (state.adminFilterDistrict) reports = reports.filter(r => r.district === state.adminFilterDistrict);
  tbody.innerHTML = reports.map((report, i) => `
    <tr>
      <td class="td-id">${i + 1}</td>
      <td>${report.district}</td>
      <td class="td-road">${report.road}</td>
      <td>${severityLabels[report.severity] || report.severity}</td>
      <td><span class="status-pill status-${report.status}">${report.status}</span></td>
      <td class="td-votes">${report.votes}</td>
      <td class="td-date">${report.date}</td>
      <td>
        <button class="action-btn btn-fixed" onclick="updateReportStatus('${report.id}', 'fixed')">Fix</button>
        <button class="action-btn btn-delete" onclick="deleteReport('${report.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderAdminDistrictGrid() {
  const grid = safeGet('admin-district-grid');
  if (!grid) return;
  grid.innerHTML = districts.map(district => {
    const count = state.reports.filter(r => r.district === district.name && r.status !== 'fixed').length;
    const width = Math.min(100, count * 15);
    const color = count === 0 ? '#E8F5EE' : count < 3 ? '#FDECEA' : '#E65100';
    return `
      <button type="button" class="district-card" onclick="setAdminDistrictFilter('${district.name}')">
        <span class="district-icon">${district.icon}</span>
        <span class="district-name">${district.name}</span>
        <span class="district-ml">${district.ml}</span>
        <span class="district-count ${count <= 1 ? 'ok' : 'low'}">${count} open</span>
        <div class="severity-bar"><span class="severity-fill" style="width:${width}%;background:${color}"></span></div>
      </button>
    `;
  }).join('');
}

function renderDistrictChart() {
  const chart = safeGet('district-chart');
  if (!chart) return;
  const totals = districts.map(d => ({
    name: d.name,
    count: state.reports.filter(r => r.district === d.name && r.status !== 'fixed').length
  })).sort((a, b) => b.count - a.count);
  chart.innerHTML = totals.map(entry => `
    <div class="bar-row">
      <div class="bar-label">${entry.name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.min(100, entry.count * 10)}%">${entry.count}</div>
      </div>
    </div>
  `).join('');
}

// ─── Boot ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', init);