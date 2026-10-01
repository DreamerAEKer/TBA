// Memorial Wall - Application Controller

// Owner selections remain in this browser. Only published-apps.json is public.
const MANAGE = new URLSearchParams(location.search).has('manage');
const OWNER_KEY = 'memorial_wall_owner_v2';
let publishedIds = new Set();
const LOCAL_OWNER = location.hostname === '127.0.0.1' && location.port === '8768';
let ownerToken = '';
let saveChain = Promise.resolve();
async function ownerApi(route, data) {
    const response = await fetch('/api/' + route, { method: data ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-TBA-Owner': ownerToken },
        ...(data ? { body: JSON.stringify(data) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ทำรายการไม่สำเร็จ');
    return result;
}
function isPublicUrl(value) {
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        return ['https:', 'http:'].includes(url.protocol) && !['localhost', '::1', '[::1]'].includes(host)
            && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    } catch { return false; }
}
function publicRecord(app) {
    return { id: app.id, name: app.name, url: app.url, year: app.year,
        category: app.category, hosting: getHosting(app), icon: app.icon,
        color: app.color, description: app.description, clicks: 0 };
}
function refresh() { populateYearFilter(); updateStats(); renderApps(); }
// App State
let apps = [];
let selectedHosting = 'all';

// DOM Elements
const wallGrid = document.getElementById('wall-grid');
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-year');
const filterCategory = document.getElementById('filter-category');
const hostingTabs = document.getElementById('hosting-tabs');
const sortBy = document.getElementById('sort-by');
const btnAddApp = document.getElementById('btn-add-app');
const appModal = document.getElementById('app-modal');
const appForm = document.getElementById('app-form');
const modalTitle = document.getElementById('modal-title');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const fileImport = document.getElementById('file-import');
const btnImportTrigger = document.getElementById('btn-import-trigger');
const btnExport = document.getElementById('btn-export');

// Form Fields
const appIdField = document.getElementById('app-id');
const appNameField = document.getElementById('app-name');
const appUrlField = document.getElementById('app-url');
const appYearField = document.getElementById('app-year');
const appCategoryField = document.getElementById('app-category');
const appHostingField = document.getElementById('app-hosting');
const appIconField = document.getElementById('app-icon');
const appIconColorField = document.getElementById('app-icon-color');
const appDescField = document.getElementById('app-desc');
const appLocalPathField = document.getElementById('app-local-path');

// Statistics Elements
const statTotalApps = document.getElementById('stat-total-apps');
const statTotalClicks = document.getElementById('stat-total-clicks');
const statLatestYear = document.getElementById('stat-latest-year');

// Initial setup
async function init() {
    document.body.classList.toggle('manage-mode', MANAGE);
    document.querySelector('.subtitle').textContent = MANAGE
        ? 'หน้าจัดการส่วนตัว · เลือกแอปแล้วเตรียมรายการเผยแพร่'
        : 'แอปพลิเคชันที่เจ้าของเลือกเผยแพร่';
    document.getElementById('owner-panel').hidden = !MANAGE;
    btnAddApp.hidden = !MANAGE;
    document.querySelector('.backup-restore-group').hidden = !MANAGE;
    appYearField.value = new Date().getFullYear();
    setupEventListeners();
    if (MANAGE) {
        let diskApps = null;
        if (LOCAL_OWNER) {
            try {
                ownerToken = (await ownerApi('session')).token;
                diskApps = (await ownerApi('owner')).apps;
            } catch (err) { wallGrid.textContent = err.message; return; }
        }
        let catalog = [];
        try {
            const response = await fetch(new URL('./published-apps.json', location.href), { cache: 'no-store' });
            if (!response.ok) throw new Error('load failed');
            catalog = await response.json();
            if (!Array.isArray(catalog)) throw new Error('invalid catalog');
            publishedIds = new Set(catalog.map(app => app.id));
        } catch {
            wallGrid.textContent = 'โหลดรายการเผยแพร่ปัจจุบันไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่ก่อนจัดการ';
            return;
        }
        const stored = diskApps ? JSON.stringify(diskApps) : localStorage.getItem(OWNER_KEY) || localStorage.getItem('memorial_wall_apps');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
                apps = (parsed.length > 0 && parsed.every(app => /^sample-\d+$/.test(app.id))
                    ? catalog.map(app => ({ ...app, published: true })) : parsed).map(normalizeApp);
            } catch {
                document.getElementById('owner-status').textContent = 'อ่านข้อมูลเดิมไม่ได้ กรุณานำเข้าไฟล์สำรอง ข้อมูลเดิมยังถูกเก็บไว้';
                return;
            }
        } else apps = catalog.map(app => normalizeApp({ ...app, published: true }));
        document.getElementById('btn-publish-file').addEventListener('click', exportPublished);
        document.getElementById('btn-publish-live').hidden = !LOCAL_OWNER;
        document.getElementById('owner-direct-link').hidden = LOCAL_OWNER;
        document.getElementById('owner-instructions').textContent = LOCAL_OWNER
            ? 'เลือกแสดง/ซ่อน แล้วกดเผยแพร่รายการที่เลือก ผู้ชมใช้ลิงก์เดิมได้ ข้อมูลครบทั้งหมดบันทึกในคอมนี้'
            : 'ใช้หน้าจัดการในคอมเพื่อเผยแพร่ได้โดยตรง เปิดตัวช่วยจัดการก่อน แล้วกดลิงก์ด้านล่าง';
        if (LOCAL_OWNER) document.getElementById('btn-publish-live').addEventListener('click', publishLive);
        document.getElementById('visibility-filter').addEventListener('change', renderApps);
        document.getElementById('btn-preview-public').addEventListener('click', () => {
            publicPreview = !publicPreview;
            document.getElementById('btn-preview-public').textContent = publicPreview ? 'กลับไปจัดการทั้งหมด' : 'ดูตัวอย่างที่ผู้ชมจะเห็น';
            refresh();
        });
    } else {
        try {
            const response = await fetch(new URL('./published-apps.json', location.href), { cache: 'no-store' });
            if (!response.ok) throw new Error('load failed');
            const parsed = await response.json();
            if (!Array.isArray(parsed)) throw new Error('invalid data');
            apps = parsed.filter(app => app && isPublicUrl(app.url)).map(app => normalizeApp({ ...publicRecord(app), published: true }));
        } catch {
            wallGrid.textContent = 'โหลดรายการเผยแพร่ไม่สำเร็จ กรุณาลองใหม่ภายหลัง';
            return;
        }
    }
    refresh();
}
let publicPreview = false;
function visibleApps() {
    return MANAGE && !publicPreview ? apps : apps.filter(app => app.published && isPublicUrl(app.url));
}
function saveToStorage() {
    if (MANAGE) {
        localStorage.setItem(OWNER_KEY, JSON.stringify(apps));
        if (LOCAL_OWNER) {
            const snapshot = JSON.parse(JSON.stringify(apps));
            saveChain = saveChain.catch(() => {}).then(() => ownerApi('owner', { apps: snapshot }));
            saveChain.catch(err => document.getElementById('publication-status').textContent = 'บันทึกในคอมไม่สำเร็จ: ' + err.message);
        }
    }
}
async function publishLive() {
    const button = document.getElementById('btn-publish-live');
    const status = document.getElementById('publication-status');
    const selected = apps.filter(a => a.published && isPublicUrl(a.url));
    if (!confirm('เผยแพร่ ' + selected.length + ' แอปที่เลือกให้ผู้เปิดลิงก์ทุกคนเห็น? รายการที่ซ่อนยังอยู่ครบในคอม')) return;
    button.disabled = true;
    status.textContent = 'กำลังส่งรายการเผยแพร่...';
    try {
        await saveChain;
        let result = await ownerApi('publish', { apps });
        while (result.state === 'deploying') {
            status.textContent = 'ส่ง ' + result.count + ' แอปแล้ว กำลังรอเว็บเผยแพร่ กรุณาเปิดตัวช่วยค้างไว้';
            await new Promise(resolve => setTimeout(resolve, 5000));
            result = await ownerApi('publication');
        }
        if (result.state !== 'success') throw new Error('การเผยแพร่ไม่สำเร็จ กรุณาลองใหม่');
        status.textContent = 'เผยแพร่สำเร็จ ' + result.count + ' แอป ผู้ชมเปิดลิงก์เดิมได้ (หากเห็นชุดเก่าให้รีเฟรช)';
    } catch (err) { status.textContent = err.message; }
    finally { button.disabled = false; }
}
function exportPublished() {
    const selected = apps.filter(app => app.published && isPublicUrl(app.url)).map(publicRecord);
    downloadJson(selected, 'published-apps.json');
    showToast('เตรียม ' + selected.length + ' แอปแล้ว ต้องเผยแพร่ไฟล์นี้ก่อนผู้ชมจะเห็นรายการใหม่');
}
function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function confirmAndCloseModal() {
    if (confirm("คุณต้องการยกเลิกการกรอกข้อมูลและปิดหน้าต่างนี้ใช่หรือไม่? ข้อมูลที่คุณกรอกจะไม่ถูกบันทึก")) {
        closeModal();
    }
}

function setupEventListeners() {
    // Modal controls
    btnAddApp.addEventListener('click', () => openModal());
    btnCancelModal.addEventListener('click', confirmAndCloseModal);
    
    // Close modal on Escape key press with confirmation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && appModal.classList.contains('active')) {
            confirmAndCloseModal();
        }
    });

    // Form submission
    appForm.addEventListener('submit', handleFormSubmit);

    // Search and Filter listeners
    searchInput.addEventListener('input', renderApps);
    filterYear.addEventListener('change', renderApps);
    filterCategory.addEventListener('change', renderApps);
    sortBy.addEventListener('change', renderApps);
    hostingTabs.addEventListener('click', (event) => {
        const button = event.target.closest('.hosting-tab');
        if (!button) return;
        selectedHosting = button.dataset.hosting;
        hostingTabs.querySelectorAll('.hosting-tab').forEach(tab => {
            tab.classList.toggle('active', tab === button);
        });
        renderApps();
    });

    // Backup & Restore
    btnExport.addEventListener('click', exportData);
    btnImportTrigger.addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', importData);
}

// Stats Calculation
function updateStats() {
    const displayed = visibleApps();
    statTotalApps.textContent = displayed.length;
    if (MANAGE) {
        const selected = apps.filter(app => app.published && isPublicUrl(app.url)).length;
        document.getElementById('owner-status').textContent = 'เก็บทั้งหมด ' + apps.length + ' แอป · เลือกแสดง ' + selected + ' · ซ่อน ' + (apps.length - selected) + ' (การเลือกยังเป็นฉบับร่าง)';
    }
    
    const totalClicks = displayed.reduce((sum, app) => sum + (app.clicks || 0), 0);
    statTotalClicks.textContent = totalClicks;

    if (displayed.length > 0) {
        const years = displayed.map(app => parseInt(app.year)).filter(y => !isNaN(y));
        if (years.length > 0) {
            statLatestYear.textContent = Math.max(...years);
        } else {
            statLatestYear.textContent = "-";
        }
    } else {
        statLatestYear.textContent = "-";
    }

    const counts = { all: displayed.length, GitHub: 0, Vercel: 0, Firebase: 0, Other: 0 };
    displayed.forEach(app => counts[getHosting(app)]++);
    Object.entries(counts).forEach(([platform, count]) => {
        const element = document.querySelector(`[data-count="${platform}"]`);
        if (element) element.textContent = count;
    });
}

function detectHosting(url = '') {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.endsWith('github.io')) return 'GitHub';
        if (hostname.endsWith('vercel.app')) return 'Vercel';
        if (hostname.endsWith('web.app') || hostname.endsWith('firebaseapp.com')) return 'Firebase';
    } catch (_) {
        // Local paths and incomplete URLs belong in Other.
    }
    return 'Other';
}

function getHosting(app) {
    return ['GitHub', 'Vercel', 'Firebase', 'Other'].includes(app.hosting)
        ? app.hosting
        : detectHosting(app.url);
}

function normalizeApp(app) {
    return { ...app, hosting: getHosting(app), published: (typeof app.published === 'boolean' ? app.published : publishedIds.has(app.id)) && isPublicUrl(app.url) };
}

// Populate Year Filter options dynamically
function populateYearFilter() {
    const currentVal = filterYear.value;
    
    // Get unique years, sorted descending
    const years = [...new Set(visibleApps().map(app => app.year))]
        .filter(Boolean)
        .sort((a, b) => b - a);

    // Clear old options except first one (All)
    filterYear.innerHTML = '<option value="all">ทุกปีที่สร้าง</option>';
    
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `ปี ${year}`;
        filterYear.appendChild(option);
    });

    // Restore selected value if it still exists
    if (years.includes(parseInt(currentVal))) {
        filterYear.value = currentVal;
    }
}

// Modal handling
function openModal(editAppId = null) {
    if (!MANAGE || publicPreview) return;
    appForm.reset();
    
    if (editAppId) {
        const app = apps.find(a => a.id === editAppId);
        if (app) {
            modalTitle.textContent = "แก้ไขข้อมูลแอปพลิเคชัน";
            appIdField.value = app.id;
            appNameField.value = app.name;
            appUrlField.value = app.url;
            appYearField.value = app.year;
            appCategoryField.value = app.category || 'Web App';
            appHostingField.value = app.hosting || 'auto';
            appIconField.value = app.icon || 'globe';
            appIconColorField.value = app.color || '#a855f7';
            appDescField.value = app.description || '';
            appLocalPathField.value = app.localPath || '';
        }
    } else {
        modalTitle.textContent = "เพิ่มแอปพลิเคชันลงผนังอนุสรณ์";
        appIdField.value = "";
        appYearField.value = new Date().getFullYear();
        appCategoryField.value = "Web App";
        appHostingField.value = "auto";
        appIconField.value = "globe";
        appIconColorField.value = "#a855f7";
        appLocalPathField.value = "";
    }
    
    appModal.classList.add('active');
    appNameField.focus();
}

function closeModal() {
    appModal.classList.remove('active');
}

// Create/Update operation
function handleFormSubmit() {
    if (!MANAGE) return;
    const id = appIdField.value;
    const name = appNameField.value.trim();
    const url = appUrlField.value.trim();
    const year = parseInt(appYearField.value);
    const category = appCategoryField.value;
    const hosting = appHostingField.value === 'auto' ? detectHosting(url) : appHostingField.value;
    const icon = appIconField.value;
    const color = appIconColorField.value;
    const description = appDescField.value.trim();
    const localPath = appLocalPathField.value.trim();

    if (!name || !url || isNaN(year)) {
        showToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", "danger");
        return;
    }

    // Check for duplicate URL or localPath (excluding the current app being edited)
    const duplicateUrlApp = apps.find(a => a.id !== id && a.url.toLowerCase() === url.toLowerCase());
    if (duplicateUrlApp) {
        showToast(`URL นี้ถูกใช้งานแล้วในแอป "${duplicateUrlApp.name}"`, "danger");
        return;
    }

    if (localPath) {
        const duplicatePathApp = apps.find(a => a.id !== id && a.localPath && a.localPath.toLowerCase() === localPath.toLowerCase());
        if (duplicatePathApp) {
            showToast(`โฟลเดอร์นี้ถูกใช้งานแล้วในแอป "${duplicatePathApp.name}"`, "danger");
            return;
        }
    }

    if (id) {
        // Edit Mode
        const index = apps.findIndex(a => a.id === id);
        if (index !== -1) {
            apps[index] = {
                ...apps[index],
                name,
                url,
                year,
                category,
                hosting,
                icon,
                color,
                description,
                localPath
            };
            showToast("แก้ไขข้อมูลแอปพลิเคชันเรียบร้อยแล้ว");
        }
    } else {
        // Create Mode
        const newApp = {
            id: Date.now().toString(),
            name,
            url,
            year,
            category,
            hosting,
            icon,
            color,
            description,
            localPath,
            clicks: 0
        };
        apps.push(newApp);
        showToast("เพิ่มแอปพลิเคชันลงผนังอนุสรณ์สำเร็จ!");
    }

    apps = apps.map(normalizeApp);
    saveToStorage();
    closeModal();
    populateYearFilter();
    updateStats();
    renderApps();
}

// Track application launch clicks
function handleAppLaunch(id, url) {
    if ((!MANAGE || publicPreview) && !isPublicUrl(url)) return;
    const appIndex = apps.findIndex(a => a.id === id);
    if (MANAGE && !publicPreview && appIndex !== -1) {
        apps[appIndex].clicks = (apps[appIndex].clicks || 0) + 1;
        saveToStorage();
        updateStats();
        renderApps();
    }
    const launchUrl = getLaunchUrl(url);
    window.open(launchUrl, '_blank', 'noopener,noreferrer');

    if (isLocalFileUrl(url) || isLocalFileUrl(launchUrl)) {
        // Also copy the direct file URL to clipboard as a convenient fallback
        const directFileUrl = toFileUrl(url);
        navigator.clipboard.writeText(directFileUrl).catch(() => {});
        showToast("เปิดแอปในเครื่อง (คัดลอกที่อยู่ไฟล์แล้ว หรือเปิด start-local-apps.bat)");
    }
}

const LOCAL_APP_SERVER = 'http://127.0.0.1:8765';
const LOCAL_SCRATCH_PREFIX = 'file:///C:/Users/Admin/.gemini/antigravity/scratch/';

function toFileUrl(url = '') {
    const clean = url.trim();
    if (/^[a-zA-Z]:[\\/]/.test(clean)) {
        return 'file:///' + clean.replace(/\\/g, '/');
    }
    return clean;
}

function isLocalFileUrl(url = '') {
    const clean = url.trim().toLowerCase();
    return clean.startsWith('file:///') || /^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith('http://127.0.0.1:8765');
}

function getLaunchUrl(url = '') {
    const fileUrl = toFileUrl(url);
    if (!isLocalFileUrl(fileUrl)) return url;

    // If it's already a local server URL, return as-is
    if (url.trim().startsWith(LOCAL_APP_SERVER)) return url.trim();

    // Browsers block file:// links opened by an https page. The companion
    // server exposes only the configured scratch directory on localhost.
    if (fileUrl.toLowerCase().startsWith(LOCAL_SCRATCH_PREFIX.toLowerCase())) {
        const relativePath = fileUrl.slice(LOCAL_SCRATCH_PREFIX.length)
            .split('/')
            .map(segment => encodeURIComponent(decodeURIComponent(segment)))
            .join('/');
        return `${LOCAL_APP_SERVER}/${relativePath}`;
    }

    showToast("ไฟล์นี้อยู่นอกโฟลเดอร์ scratch ที่อนุญาต", "danger");
    return `${LOCAL_APP_SERVER}/help`;
}

// Delete Operation
function deleteApp(id, name) {
    if (!MANAGE) return;
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการนำแอป "${name}" ออกจากผนังอนุสรณ์?`)) {
        apps = apps.filter(a => a.id !== id);
        saveToStorage();
        showToast("นำแอปพลิเคชันออกสำเร็จ");
        populateYearFilter();
        updateStats();
        renderApps();
    }
}

// Toast notification helper
function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    
    toastMsg.textContent = message;
    
    // Customize icon style based on type
    const icon = toast.querySelector('.toast-icon');
    if (type === "success") {
        icon.setAttribute('data-lucide', 'check-circle');
        icon.style.color = 'var(--clr-success)';
        toast.style.borderColor = 'var(--clr-primary)';
    } else if (type === "danger") {
        icon.setAttribute('data-lucide', 'alert-triangle');
        icon.style.color = 'var(--clr-danger)';
        toast.style.borderColor = 'var(--clr-danger)';
    }
    
    window.lucide?.createIcons();
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Export Database to JSON File
function exportData() {
    if (!MANAGE) return;
    const dataStr = JSON.stringify(apps, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memorial-wall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("ส่งออกไฟล์สำรองข้อมูลเรียบร้อย!");
}

// Import Database from JSON File
function importData(e) {
    if (!MANAGE) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const importedApps = JSON.parse(evt.target.result);
            
            // Basic format validation
            if (Array.isArray(importedApps) && importedApps.every(item => item && typeof item.name === 'string' && typeof item.url === 'string')) {
                if (!confirm('นำเข้า ' + importedApps.length + ' แอปแทนฉบับร่างปัจจุบัน? ควรสำรองข้อมูลปัจจุบันก่อน')) return;
                apps = importedApps.map(item => ({
                    id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: item.name || "Untitled App",
                    url: item.url || "#",
                    year: parseInt(item.year) || new Date().getFullYear(),
                    category: item.category || "Web App",
                    hosting: ['GitHub', 'Vercel', 'Firebase', 'Other'].includes(item.hosting) ? item.hosting : detectHosting(item.url),
                    color: item.color || "#a855f7",
                    description: item.description || "",
                    localPath: item.localPath || "",
                    icon: item.icon || 'globe',
                    published: (typeof item.published === 'boolean' ? item.published : publishedIds.has(item.id)) && isPublicUrl(item.url),
                    clicks: parseInt(item.clicks) || 0
                }));
                
                saveToStorage();
                populateYearFilter();
                updateStats();
                renderApps();
                showToast("นำเข้าฐานข้อมูลอนุสรณ์สำเร็จ!");
            } else {
                showToast("รูปแบบไฟล์สำรองไม่ถูกต้อง", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("การอ่านไฟล์ล้มเหลว", "danger");
        }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
}

// Render dynamic elements to interface
function renderApps() {
    // 1. Filter
    const query = searchInput.value.toLowerCase().trim();
    const selectedYear = filterYear.value;
    const selectedCategory = filterCategory.value;
    const sorting = sortBy.value;

    let filtered = visibleApps().filter(app => {
        const visibility = document.getElementById('visibility-filter').value;
        if (MANAGE && !publicPreview && visibility !== 'all' && ((visibility === 'shown') !== app.published)) return false;
        // Search text match
        const matchesQuery = app.name.toLowerCase().includes(query) || 
                             app.description.toLowerCase().includes(query);
                             
        // Year filter match
        const matchesYear = selectedYear === 'all' || app.year.toString() === selectedYear;
        
        // Category match
        const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
        const matchesHosting = selectedHosting === 'all' || getHosting(app) === selectedHosting;

        return matchesQuery && matchesYear && matchesCategory && matchesHosting;
    });

    // 2. Sort
    filtered.sort((a, b) => {
        if (sorting === 'newest') {
            return b.year - a.year;
        } else if (sorting === 'oldest') {
            return a.year - b.year;
        } else if (sorting === 'frequent') {
            return (b.clicks || 0) - (a.clicks || 0);
        } else if (sorting === 'name') {
            return a.name.localeCompare(b.name, 'th');
        }
        return 0;
    });

    // 3. Clear and draw
    wallGrid.innerHTML = '';

    if (filtered.length === 0) {
        wallGrid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="folder-open" style="width: 3rem; height: 3rem; color: var(--text-muted);"></i>
                <p>ยังไม่มีแอปที่เผยแพร่ หรือไม่พบแอปที่ตรงกับตัวกรอง</p>
            </div>
        `;
        window.lucide?.createIcons();
        return;
    }

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.classList.toggle('is-hidden', MANAGE && !publicPreview && !app.published);
        card.style.setProperty('--theme-color', app.color || '#a855f7');
        card.style.setProperty('--clr-primary-glow', `${app.color || '#a855f7'}4D`); // 30% opacity

        // Escape outputs to prevent XSS
        const safeName = escapeHtml(app.name);
        const safeDesc = escapeHtml(app.description || 'ไม่มีคำอธิบายเพิ่มเติม');
        const safeCategory = escapeHtml(app.category || 'Web App');
        const hosting = getHosting(app);
        const safeHosting = escapeHtml(hosting);
        const hostingIcon = { GitHub: 'github', Vercel: 'triangle', Firebase: 'flame', Other: 'globe-2' }[hosting];
        const safeYear = escapeHtml(app.year.toString());
        const safeLocalPath = app.localPath ? escapeHtml(app.localPath) : '';
        const clicksCount = app.clicks || 0;
        
        const defaultIcons = {
            'Web App': 'globe',
            'Desktop App': 'monitor',
            'Mobile App': 'smartphone',
            'Extension': 'puzzle',
            'Other': 'box'
        };
        const safeIcon = escapeHtml(app.icon || defaultIcons[app.category] || 'globe');

        card.innerHTML = `
            <div>
                <div class="card-top">
                    <div class="card-title-group">
                        <div class="card-title-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <i data-lucide="${safeIcon}" style="width: 1.25rem; height: 1.25rem; color: var(--theme-color); flex-shrink: 0;"></i>
                            <div class="card-title" title="${safeName}" style="margin-bottom: 0; flex-grow: 1;">${safeName}</div>
                        </div>
                        <div class="year-badge">ปี ${safeYear}</div>
                    </div>
                    <div class="card-badges">
                        <span class="hosting-badge hosting-${safeHosting.toLowerCase()}"><i data-lucide="${hostingIcon}"></i>${safeHosting}</span>
                        <span class="card-category">${safeCategory}</span>
                    </div>
                </div>
                <div class="card-desc">${safeDesc}</div>
                ${MANAGE && !publicPreview && safeLocalPath ? `
                <div class="card-local-path" title="${safeLocalPath}">
                    <i data-lucide="folder"></i>
                    <span class="path-text">${safeLocalPath}</span>
                    <button class="btn-copy-path" title="คัดลอกเส้นทางโฟลเดอร์">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
                ` : ''}
            </div>
            
            <div class="card-bottom">
                <div class="clicks-badge" title="เปิดบ่อยที่สุดอิงตามยอดการกดใช้งาน">
                    <i data-lucide="trending-up"></i>
                    <span>เปิดใช้ ${clicksCount} ครั้ง</span>
                </div>
                <div class="actions-group">
                    ${MANAGE && !publicPreview ? `<button class="btn-icon visibility ${app.published ? 'is-shown' : 'is-hidden'}" role="switch" aria-checked="${app.published}" aria-label="การแสดง ${safeName}: ${app.published ? 'แสดง' : 'ซ่อน'}" title="${!isPublicUrl(app.url) ? 'ซ่อน: แอปในเครื่องเผยแพร่ไม่ได้' : app.published ? 'สถานะ: แสดง — กดเพื่อเปลี่ยนเป็นซ่อน' : 'สถานะ: ซ่อน — กดเพื่อเปลี่ยนเป็นแสดง'}" ${!isPublicUrl(app.url) ? 'disabled' : ''}>${app.published ? 'แสดง' : 'ซ่อน'}</button>
                    <button class="btn-icon edit" title="แก้ไข">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="btn-icon delete" title="นำออก">
                        <i data-lucide="trash-2"></i>
                    </button>
                    ` : ''}
                    <button class="btn-launch" title="เปิดลิงก์ผลงาน">
                        <span>เรียกใช้งาน</span>
                        <i data-lucide="external-link"></i>
                    </button>
                </div>
            </div>
        `;

        // Event hooks
        const btnEdit = card.querySelector('.edit');
        const btnDelete = card.querySelector('.delete');
        const btnLaunch = card.querySelector('.btn-launch');
        const btnCopyPath = card.querySelector('.btn-copy-path');

        if (btnCopyPath) {
            btnCopyPath.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(app.localPath);
                showToast("คัดลอกเส้นทางโฟลเดอร์เรียบร้อย!");
            });
        }

        const btnVisibility = card.querySelector('.visibility');
        if (btnVisibility) btnVisibility.addEventListener('click', (e) => {
            e.stopPropagation();
            app.published = !app.published && isPublicUrl(app.url);
            saveToStorage(); refresh();
        });
        if (btnEdit) btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(app.id);
        });

        if (btnDelete) btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteApp(app.id, app.name);
        });

        btnLaunch.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAppLaunch(app.id, app.url);
        });

        // Clicking the card anywhere acts as launch
        card.addEventListener('click', () => {
            handleAppLaunch(app.id, app.url);
        });

        wallGrid.appendChild(card);
    });

    window.lucide?.createIcons();
}

// Utility function to escape HTML characters
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Start the app on page load
window.addEventListener('DOMContentLoaded', init);
