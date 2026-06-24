// Memorial Wall - Application Controller

// Sample/Preloaded Apps to showcase on first load
const SAMPLE_APPS = [
    {
        id: "sample-1",
        name: "Grocer POS",
        url: "https://example.com/grocer-pos",
        year: 2026,
        category: "Web App",
        color: "#06b6d4",
        description: "ระบบ Point of Sale สำหรับร้านขายของชำ รองรับออฟไลน์เต็มรูปแบบผ่าน PWA และเซฟข้อมูลใน IndexedDB มีระบบการขาย คุมคลังสินค้า และรายงานยอดรายวัน",
        clicks: 34
    },
    {
        id: "sample-2",
        name: "Shift Calendar App",
        url: "https://example.com/shift-calendar",
        year: 2025,
        category: "Mobile App",
        color: "#a855f7",
        description: "แอปพลิเคชันจัดตารางงาน กะการทำงานสำหรับพนักงาน รองรับระบบแจ้งเตือนแบบพุช ออกรายงานการสลับกะ และคำนวณโอทีอิงตามเวลาจริง",
        clicks: 18
    },
    {
        id: "sample-3",
        name: "Voice Calculator",
        url: "https://example.com/voice-calc",
        year: 2026,
        category: "Web App",
        color: "#10b981",
        description: "เครื่องคิดเลขสั่งการด้วยเสียงภาษาไทยและอังกฤษ พัฒนาขึ้นโดยใช้ Web Speech API ช่วยอำนวยความสะดวกให้ผู้พิการทางสายตาหรือการใช้งานขณะมือไม่ว่าง",
        clicks: 25
    },
    {
        id: "sample-4",
        name: "Thai Postage Rate Calculator",
        url: "https://example.com/thp-rates",
        year: 2024,
        category: "Desktop App",
        color: "#ef4444",
        description: "เครื่องมือคำนวณอัตราค่าบริการฝากส่งไปรษณีย์ในประเทศและต่างประเทศ คำนวณรวดเร็วตามน้ำหนักและประเภทพัสดุ",
        clicks: 9
    }
];

// App State
let apps = [];

// DOM Elements
const wallGrid = document.getElementById('wall-grid');
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-year');
const filterCategory = document.getElementById('filter-category');
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
const appIconColorField = document.getElementById('app-icon-color');
const appDescField = document.getElementById('app-desc');
const appLocalPathField = document.getElementById('app-local-path');

// Statistics Elements
const statTotalApps = document.getElementById('stat-total-apps');
const statTotalClicks = document.getElementById('stat-total-clicks');
const statLatestYear = document.getElementById('stat-latest-year');

// Initial setup
function init() {
    // Load apps from localStorage or set defaults
    const stored = localStorage.getItem('memorial_wall_apps');
    if (stored) {
        try {
            apps = JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing stored apps", e);
            apps = [...SAMPLE_APPS];
        }
    } else {
        apps = [...SAMPLE_APPS];
        saveToStorage();
    }

    // Set default year input to current year
    appYearField.value = new Date().getFullYear();

    // Attach Event Listeners
    setupEventListeners();

    // Render interface elements
    populateYearFilter();
    updateStats();
    renderApps();
}

function saveToStorage() {
    localStorage.setItem('memorial_wall_apps', JSON.stringify(apps));
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

    // Backup & Restore
    btnExport.addEventListener('click', exportData);
    btnImportTrigger.addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', importData);
}

// Stats Calculation
function updateStats() {
    statTotalApps.textContent = apps.length;
    
    const totalClicks = apps.reduce((sum, app) => sum + (app.clicks || 0), 0);
    statTotalClicks.textContent = totalClicks;

    if (apps.length > 0) {
        const years = apps.map(app => parseInt(app.year)).filter(y => !isNaN(y));
        if (years.length > 0) {
            statLatestYear.textContent = Math.max(...years);
        } else {
            statLatestYear.textContent = "-";
        }
    } else {
        statLatestYear.textContent = "-";
    }
}

// Populate Year Filter options dynamically
function populateYearFilter() {
    const currentVal = filterYear.value;
    
    // Get unique years, sorted descending
    const years = [...new Set(apps.map(app => app.year))]
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
            appIconColorField.value = app.color || '#a855f7';
            appDescField.value = app.description || '';
            appLocalPathField.value = app.localPath || '';
        }
    } else {
        modalTitle.textContent = "เพิ่มแอปพลิเคชันลงผนังอนุสรณ์";
        appIdField.value = "";
        appYearField.value = new Date().getFullYear();
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
    const id = appIdField.value;
    const name = appNameField.value.trim();
    const url = appUrlField.value.trim();
    const year = parseInt(appYearField.value);
    const category = appCategoryField.value;
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
            color,
            description,
            localPath,
            clicks: 0
        };
        apps.push(newApp);
        showToast("เพิ่มแอปพลิเคชันลงผนังอนุสรณ์สำเร็จ!");
    }

    saveToStorage();
    closeModal();
    populateYearFilter();
    updateStats();
    renderApps();
}

// Track application launch clicks
function handleAppLaunch(id, url) {
    const appIndex = apps.findIndex(a => a.id === id);
    if (appIndex !== -1) {
        apps[appIndex].clicks = (apps[appIndex].clicks || 0) + 1;
        saveToStorage();
        updateStats();
        renderApps();
    }
    window.open(url, '_blank');
}

// Delete Operation
function deleteApp(id, name) {
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
    
    lucide.createIcons();
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Export Database to JSON File
function exportData() {
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
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const importedApps = JSON.parse(evt.target.result);
            
            // Basic format validation
            if (Array.isArray(importedApps)) {
                apps = importedApps.map(item => ({
                    id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: item.name || "Untitled App",
                    url: item.url || "#",
                    year: parseInt(item.year) || new Date().getFullYear(),
                    category: item.category || "Web App",
                    color: item.color || "#a855f7",
                    description: item.description || "",
                    localPath: item.localPath || "",
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

    let filtered = apps.filter(app => {
        // Search text match
        const matchesQuery = app.name.toLowerCase().includes(query) || 
                             app.description.toLowerCase().includes(query);
                             
        // Year filter match
        const matchesYear = selectedYear === 'all' || app.year.toString() === selectedYear;
        
        // Category match
        const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;

        return matchesQuery && matchesYear && matchesCategory;
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
                <p>ไม่พบแอปพลิเคชันที่ตรงกับเงื่อนไขการค้นหา</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.style.setProperty('--theme-color', app.color || '#a855f7');
        card.style.setProperty('--clr-primary-glow', `${app.color || '#a855f7'}4D`); // 30% opacity

        // Escape outputs to prevent XSS
        const safeName = escapeHtml(app.name);
        const safeDesc = escapeHtml(app.description || 'ไม่มีคำอธิบายเพิ่มเติม');
        const safeCategory = escapeHtml(app.category || 'Web App');
        const safeYear = escapeHtml(app.year.toString());
        const safeLocalPath = app.localPath ? escapeHtml(app.localPath) : '';
        const clicksCount = app.clicks || 0;

        card.innerHTML = `
            <div>
                <div class="card-top">
                    <div class="card-title-group">
                        <div class="card-title" title="${safeName}">${safeName}</div>
                        <div class="year-badge">ปี ${safeYear}</div>
                    </div>
                    <span class="card-category">${safeCategory}</span>
                </div>
                <div class="card-desc">${safeDesc}</div>
                ${safeLocalPath ? `
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
                    <button class="btn-icon edit" title="แก้ไข">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="btn-icon delete" title="นำออก">
                        <i data-lucide="trash-2"></i>
                    </button>
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

        btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(app.id);
        });

        btnDelete.addEventListener('click', (e) => {
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

    lucide.createIcons();
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
