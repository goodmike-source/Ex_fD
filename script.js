// ================================================================
//  КЛЮЧИ ДЛЯ ХРАНЕНИЯ
// ================================================================
const KEYS = {
    EMPLOYEES: 'app_employees',
    POSITIONS: 'app_positions',
    SHIFTS: 'app_shifts',
    MONTHLY_SCHEDULES: 'app_monthly_schedules'
};

// ================================================================
//  СОСТОЯНИЕ
// ================================================================
let employees = [];
let positions = {};
let shifts = {};
let monthlySchedules = {};
let currentScheduleKey = null;
let editingScheduleCell = null;
let editingScheduleColors = null;
let selectedScheduleCells = new Set();
let scheduleSelectionAnchor = null;
let scheduleDragAnchor = null;
let scheduleSelectionBase = new Set();
let isScheduleCellSelecting = false;
let currentShiftId = null;
let currentSort = { field: 'name', direction: 'asc' };
let currentFilters = { time: '', position: '', status: '' };
let sortableInstance = null;
let quickSearchTimeout = null;

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ================================================================
function init() {
    loadData();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('shiftDate').value = today;
    const dashboardDateText = document.getElementById('dashboardDateText');
    if (dashboardDateText) {
        const now = new Date();
        const formatted = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        dashboardDateText.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1) + ' · план и фактическое присутствие';
    }

    populatePositionSelects();
    renderEmployees();
    renderPositions();
    renderShiftsList();
    renderRecentShifts();
    updateStats();
    updateNavBadges();
    initScheduleUI();
    renderDashboardScheduleSummary();

    const shiftIds = Object.keys(shifts);
    if (shiftIds.length > 0) {
        currentShiftId = shiftIds[0];
        renderShift();
        renderShiftDisplay();
    }

    // Theme
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    if (localStorage.getItem('app_theme') === 'dark') {
        document.body.classList.add('dark');
    }

    // Navigation
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Employees
    document.getElementById('addEmployeeForm').addEventListener('submit', addEmployee);
    document.getElementById('empSearch').addEventListener('input', renderEmployees);
    document.getElementById('empFilterPosition').addEventListener('change', renderEmployees);

    // Positions
    document.getElementById('addPositionBtn').addEventListener('click', addPosition);

    // Monthly schedule
    const scheduleImportBtn = document.getElementById('scheduleImportBtn');
    if (scheduleImportBtn) scheduleImportBtn.addEventListener('click', importMonthlySchedule);
    const scheduleMonthSelect = document.getElementById('scheduleMonthSelect');
    if (scheduleMonthSelect) scheduleMonthSelect.addEventListener('change', () => selectScheduleMonth(scheduleMonthSelect.value));
    const scheduleDeleteMonthBtn = document.getElementById('scheduleDeleteMonthBtn');
    if (scheduleDeleteMonthBtn) scheduleDeleteMonthBtn.addEventListener('click', deleteScheduleMonth);
    const scheduleDate = document.getElementById('scheduleDate');
    if (scheduleDate) scheduleDate.addEventListener('change', renderScheduleDay);
    const scheduleTodayBtn = document.getElementById('scheduleTodayBtn');
    if (scheduleTodayBtn) scheduleTodayBtn.addEventListener('click', selectTodayInSchedule);
    const scheduleSearch = document.getElementById('scheduleSearch');
    if (scheduleSearch) scheduleSearch.addEventListener('input', renderScheduleDay);
    const schedulePositionFilter = document.getElementById('schedulePositionFilter');
    if (schedulePositionFilter) schedulePositionFilter.addEventListener('change', renderScheduleDay);
    const scheduleStatusFilter = document.getElementById('scheduleStatusFilter');
    if (scheduleStatusFilter) scheduleStatusFilter.addEventListener('change', renderScheduleDay);
    const scheduleCreateShiftBtn = document.getElementById('scheduleCreateShiftBtn');
    if (scheduleCreateShiftBtn) scheduleCreateShiftBtn.addEventListener('click', createShiftFromSchedule);
    const scheduleExportBtn = document.getElementById('scheduleExportBtn');
    if (scheduleExportBtn) scheduleExportBtn.addEventListener('click', exportScheduleDay);
    const schedulePrintBtn = document.getElementById('schedulePrintBtn');
    if (schedulePrintBtn) schedulePrintBtn.addEventListener('click', printScheduleDay);
    const scheduleCreateManualBtn = document.getElementById('scheduleCreateManualBtn');
    if (scheduleCreateManualBtn) scheduleCreateManualBtn.addEventListener('click', createManualSchedule);
    const scheduleSyncEmployeesBtn = document.getElementById('scheduleSyncEmployeesBtn');
    if (scheduleSyncEmployeesBtn) scheduleSyncEmployeesBtn.addEventListener('click', syncCurrentScheduleEmployees);
    const scheduleCellCloseModal = document.getElementById('scheduleCellCloseModal');
    if (scheduleCellCloseModal) scheduleCellCloseModal.addEventListener('click', closeScheduleCellEditor);
    const scheduleCellClearBtn = document.getElementById('scheduleCellClearBtn');
    if (scheduleCellClearBtn) scheduleCellClearBtn.addEventListener('click', clearEditingScheduleCell);
    const scheduleCustomApplyBtn = document.getElementById('scheduleCustomApplyBtn');
    if (scheduleCustomApplyBtn) scheduleCustomApplyBtn.addEventListener('click', applyCustomScheduleTime);
    const scheduleCellModal = document.getElementById('scheduleCellModal');
    if (scheduleCellModal) scheduleCellModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeScheduleCellEditor();
    });

    const scheduleBulkApplyShiftBtn = document.getElementById('scheduleBulkApplyShiftBtn');
    if (scheduleBulkApplyShiftBtn) scheduleBulkApplyShiftBtn.addEventListener('click', () => {
        const value = document.getElementById('scheduleBulkShiftSelect')?.value || '';
        if (!value) { showToast('Выберите смену', 'warning'); return; }
        applyScheduleSelectionWork(value);
    });
    const scheduleBulkOffBtn = document.getElementById('scheduleBulkOffBtn');
    if (scheduleBulkOffBtn) scheduleBulkOffBtn.addEventListener('click', () => applyScheduleSelectionAbsence('В'));
    const scheduleBulkVacationBtn = document.getElementById('scheduleBulkVacationBtn');
    if (scheduleBulkVacationBtn) scheduleBulkVacationBtn.addEventListener('click', () => applyScheduleSelectionAbsence('ОТ'));
    const scheduleBulkSickBtn = document.getElementById('scheduleBulkSickBtn');
    if (scheduleBulkSickBtn) scheduleBulkSickBtn.addEventListener('click', () => applyScheduleSelectionAbsence('Б'));
    const scheduleBulkMoreBtn = document.getElementById('scheduleBulkMoreBtn');
    if (scheduleBulkMoreBtn) scheduleBulkMoreBtn.addEventListener('click', openSelectedScheduleCellsEditor);
    const scheduleBulkClearBtn = document.getElementById('scheduleBulkClearBtn');
    if (scheduleBulkClearBtn) scheduleBulkClearBtn.addEventListener('click', clearSelectedScheduleCells);
    const scheduleClearSelectionBtn = document.getElementById('scheduleClearSelectionBtn');
    if (scheduleClearSelectionBtn) scheduleClearSelectionBtn.addEventListener('click', clearScheduleCellSelection);
    const scheduleEditColorsBtn = document.getElementById('scheduleEditColorsBtn');
    if (scheduleEditColorsBtn) scheduleEditColorsBtn.addEventListener('click', openScheduleColorsEditor);
    const scheduleColorsCloseModal = document.getElementById('scheduleColorsCloseModal');
    if (scheduleColorsCloseModal) scheduleColorsCloseModal.addEventListener('click', closeScheduleColorsEditor);
    const scheduleColorsApplyBtn = document.getElementById('scheduleColorsApplyBtn');
    if (scheduleColorsApplyBtn) scheduleColorsApplyBtn.addEventListener('click', applyScheduleColorsEditor);
    const scheduleColorsResetBtn = document.getElementById('scheduleColorsResetBtn');
    if (scheduleColorsResetBtn) scheduleColorsResetBtn.addEventListener('click', resetScheduleColorsEditor);
    const scheduleColorsModal = document.getElementById('scheduleColorsModal');
    if (scheduleColorsModal) scheduleColorsModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeScheduleColorsEditor();
    });
    document.addEventListener('mouseup', finishScheduleCellSelection);

    // Shifts
    document.getElementById('createShiftBtn').addEventListener('click', createShift);
    document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
    document.getElementById('clearShiftBtn').addEventListener('click', clearShift);
    document.getElementById('deleteShiftBtn').addEventListener('click', deleteShift);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('addSelectedBtn').addEventListener('click', addSelectedToShift);
    document.getElementById('selectAllBtn').addEventListener('click', selectAllInModal);
    document.getElementById('modalSearch').addEventListener('input', renderModalList);
    document.getElementById('modalFilterPosition').addEventListener('change', renderModalList);
    document.getElementById('copyShiftBtn').addEventListener('click', copyShift);

    // Export
    document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
    document.getElementById('printShiftBtn').addEventListener('click', printShift);

    // Backup
    document.getElementById('backupDownloadBtn').addEventListener('click', downloadBackup);
    document.getElementById('backupRestoreBtn').addEventListener('click', restoreBackup);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);

    // Modal close on outside click
    document.getElementById('addModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        if (e.key === 'Escape') {
            closeModal();
            closeScheduleCellEditor();
            if (selectedScheduleCells.size) clearScheduleCellSelection();
        }
        if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selectedScheduleCells.size && document.getElementById('tab-schedule')?.classList.contains('active')) {
            e.preventDefault();
            clearSelectedScheduleCells();
        }
    });

    // Init filters
    initShiftFilters();
    initQuickAdd();

    console.log('✅ Evacuation Control Center loaded');
}

// ================================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ================================================================
function loadData() {
    try {
        employees = JSON.parse(localStorage.getItem(KEYS.EMPLOYEES)) || [];
        positions = JSON.parse(localStorage.getItem(KEYS.POSITIONS)) || {};
        shifts = JSON.parse(localStorage.getItem(KEYS.SHIFTS)) || {};
        monthlySchedules = JSON.parse(localStorage.getItem(KEYS.MONTHLY_SCHEDULES)) || {};
    } catch {
        employees = [];
        positions = {};
        shifts = {};
        monthlySchedules = {};
    }
}

function saveData() {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
    localStorage.setItem(KEYS.POSITIONS, JSON.stringify(positions));
    localStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
    localStorage.setItem(KEYS.MONTHLY_SCHEDULES, JSON.stringify(monthlySchedules));
    updateStats();
    updateNavBadges();
}

// ================================================================
//  ТЕМА
// ================================================================
function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('app_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// ================================================================
//  НАВИГАЦИЯ
// ================================================================
function switchTab(tab) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab').forEach(el => {
        el.classList.toggle('active', el.id === 'tab-' + tab);
    });

    if (tab === 'employees') renderEmployees();
    if (tab === 'positions') renderPositions();
    if (tab === 'schedule') renderScheduleTab();
    if (tab === 'shifts') {
        renderShiftsList();
        if (currentShiftId && shifts[currentShiftId]) {
            renderShift();
            renderShiftDisplay();
        }
        setTimeout(initSortable, 300);
    }
    if (tab === 'dashboard') {
        renderRecentShifts();
        updateStats();
        renderDashboardScheduleSummary();
    }
}

// ================================================================
//  ВСПОМОГАТЕЛЬНЫЕ
// ================================================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

function getEmployeeById(id) {
    return employees.find(e => e.id === id);
}

function getRelativesString(empId) {
    const emp = getEmployeeById(empId);
    if (!emp || !emp.relatives || emp.relatives.length === 0) return '';
    return emp.relatives.map(r => `${r.name} (${r.phone})`).join('; ');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(text, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.className = 'toast ' + type;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

function getSchedulesForPosition(position) {
    return positions[position] || [];
}

function updateNavBadges() {
    const empCount = document.getElementById('navEmployeeCount');
    const shiftCount = document.getElementById('navShiftCount');
    const scheduleCount = document.getElementById('navScheduleCount');
    if (empCount) empCount.textContent = employees.length;
    if (shiftCount) shiftCount.textContent = Object.keys(shifts).length;
    if (scheduleCount) scheduleCount.textContent = Object.keys(monthlySchedules).length;
    const total = document.getElementById('employeeTotalCount');
    if (total) total.textContent = employees.length + ' чел.';
}

// ================================================================
//  ПОЗИЦИИ
// ================================================================
function populatePositionSelects() {
    const selects = ['empPosition', 'empFilterPosition', 'modalFilterPosition'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">-- Без должности --</option>';
        Object.keys(positions).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
        if (current && positions[current]) select.value = current;
    });
}

function addPosition() {
    const name = document.getElementById('posName').value.trim();
    const schedules = document.getElementById('posSchedules').value.trim();

    if (!name) { showToast('Введите название должности!', 'warning'); return; }
    if (positions[name]) { showToast('Такая должность уже существует', 'warning'); return; }

    const scheduleList = schedules ? schedules.split(',').map(s => s.trim()).filter(s => s) : [];
    positions[name] = scheduleList;
    saveData();

    document.getElementById('posName').value = '';
    document.getElementById('posSchedules').value = '';

    populatePositionSelects();
    renderPositions();
    showToast(`✅ Должность "${name}" добавлена`, 'success');
}

function deletePosition(name) {
    if (!confirm(`Удалить должность "${name}"?`)) return;
    delete positions[name];
    saveData();
    populatePositionSelects();
    renderPositions();
    showToast('🗑 Должность удалена', 'error');
}

function renderPositions() {
    const container = document.getElementById('positionList');
    const names = Object.keys(positions);

    if (names.length === 0) {
        container.innerHTML = '<div class="empty-text">Нет добавленных должностей</div>';
        return;
    }

    container.innerHTML = names.sort().map(name => `
        <div class="position-card">
            <div class="pos-name">${escapeHtml(name)}</div>
            <div class="pos-schedules">${positions[name].length > 0 ? positions[name].join(' • ') : 'Нет графиков'}</div>
            <div class="pos-actions">
                <button onclick="deletePosition('${name}')" title="Удалить"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ================================================================
//  СОТРУДНИКИ
// ================================================================
function addEmployee(e) {
    e.preventDefault();

    const fullName = document.getElementById('empName').value.trim();
    const position = document.getElementById('empPosition').value;
    const phone = document.getElementById('empPhone').value.trim();
    const relName = document.getElementById('empRelName').value.trim();
    const relPhone = document.getElementById('empRelPhone').value.trim();

    if (!fullName || !phone) {
        showToast('Заполните ФИО и телефон!', 'error');
        return;
    }

    if (employees.find(e => e.fullName === fullName && e.phone === phone)) {
        showToast('Такой сотрудник уже есть', 'warning');
        return;
    }

    const newEmployee = {
        id: generateId(),
        fullName,
        position: position || '',
        phone,
        relatives: []
    };

    if (relName && relPhone) {
        newEmployee.relatives.push({ name: relName, phone: relPhone });
    }

    employees.push(newEmployee);
    saveData();

    document.getElementById('empName').value = '';
    document.getElementById('empPhone').value = '';
    document.getElementById('empRelName').value = '';
    document.getElementById('empRelPhone').value = '';

    renderEmployees();
    showToast('✅ Сотрудник добавлен', 'success');
}

function deleteEmployee(id) {
    let inUse = false;
    Object.keys(shifts).forEach(key => {
        if (shifts[key].people.find(p => p.id === id)) inUse = true;
    });

    if (inUse) {
        if (!confirm('Сотрудник используется в сменах. Удалить из базы и из всех смен?')) return;
        Object.keys(shifts).forEach(key => {
            shifts[key].people = shifts[key].people.filter(p => p.id !== id);
        });
    } else {
        if (!confirm('Удалить сотрудника из базы?')) return;
    }

    employees = employees.filter(e => e.id !== id);
    saveData();

    renderEmployees();
    renderShift();
    renderShiftsList();
    showToast('🗑 Сотрудник удалён', 'error');
}

function renderEmployees() {
    const search = document.getElementById('empSearch').value.toLowerCase().trim();
    const filterPos = document.getElementById('empFilterPosition').value;

    let filtered = employees;
    if (search) {
        filtered = filtered.filter(e =>
            e.fullName.toLowerCase().includes(search) ||
            e.phone.includes(search) ||
            (e.position && e.position.toLowerCase().includes(search))
        );
    }
    if (filterPos) {
        filtered = filtered.filter(e => e.position === filterPos);
    }

    const container = document.getElementById('employeeList');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-text">Нет сотрудников</div>';
        return;
    }

    container.innerHTML = filtered.map(e => `
        <div class="employee-card">
            <div class="info">
                <div class="name">${escapeHtml(e.fullName)}</div>
                <div class="details">${escapeHtml(e.position || 'Без должности')} — ${escapeHtml(e.phone)}</div>
                ${e.relatives.length > 0 ? `<div class="relatives">👤 ${e.relatives.map(r => escapeHtml(r.name) + ' (' + escapeHtml(r.phone) + ')').join('; ')}</div>` : ''}
            </div>
            <div class="actions">
                <button class="edit-btn" onclick="editEmployee('${e.id}')" title="Редактировать"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn" onclick="deleteEmployee('${e.id}')" title="Удалить"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function editEmployee(id) {
    const emp = getEmployeeById(id);
    if (!emp) return;

    document.getElementById('empName').value = emp.fullName;
    document.getElementById('empPosition').value = emp.position || '';
    document.getElementById('empPhone').value = emp.phone;
    document.getElementById('empRelName').value = emp.relatives.length > 0 ? emp.relatives[0].name : '';
    document.getElementById('empRelPhone').value = emp.relatives.length > 0 ? emp.relatives[0].phone : '';

    employees = employees.filter(e => e.id !== id);
    saveData();
    renderEmployees();

    document.getElementById('empName').focus();
    showToast('✏️ Редактируйте и нажмите "Добавить"', 'info');
}

// ================================================================
//  СМЕНЫ
// ================================================================
function createShift() {
    const date = document.getElementById('shiftDate').value;
    const name = document.getElementById('shiftName').value.trim() || 'Основная';

    if (!date) { showToast('Выберите дату!', 'warning'); return; }

    const shiftId = date + '_' + name;
    if (shifts[shiftId]) { showToast('Такая смена уже существует', 'warning'); return; }

    shifts[shiftId] = { id: shiftId, date, name, people: [] };
    saveData();
    currentShiftId = shiftId;
    resetFilters();

    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast('✅ Смена создана', 'success');
}

function loadShift(id) {
    if (!shifts[id]) return;
    currentShiftId = id;
    resetFilters();
    renderShift();
    renderShiftDisplay();
    renderShiftsList();
    populateCopyFromSelect();
    setTimeout(initSortable, 300);
}

function renderShiftsList() {
    const container = document.getElementById('shiftsList');
    const ids = Object.keys(shifts);

    if (ids.length === 0) {
        container.innerHTML = '<span class="empty-text">Нет смен</span>';
        return;
    }

    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));

    container.innerHTML = ids.map(id => {
        const s = shifts[id];
        const isActive = id === currentShiftId;
        return `<div class="shift-tab ${isActive ? 'active' : ''}" onclick="loadShift('${id}')">
            <span>📅 ${s.date}</span>
            <span>${s.name}</span>
            <span class="count">${s.people.length}</span>
        </div>`;
    }).join('');
}

function renderShiftDisplay() {
    const el = document.getElementById('shiftDisplay');
    if (!currentShiftId || !shifts[currentShiftId]) {
        el.innerHTML = '<span class="shift-placeholder">Выберите смену</span>';
        return;
    }
    const s = shifts[currentShiftId];
    el.innerHTML = `
        <span class="date">📅 ${s.date}</span>
        <span class="name">${s.name}</span>
        <span style="color:var(--text-secondary);font-weight:400;">— ${s.people.length} чел.</span>
    `;
    document.getElementById('shiftPeopleCount').textContent = s.people.length + ' чел.';
}

// ================================================================
//  RENDER SHIFT
// ================================================================
function renderShift() {
    const body = document.getElementById('shiftBody');

    if (!currentShiftId || !shifts[currentShiftId]) {
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">Нет активной смены</td></tr>`;
        return;
    }

    const people = getFilteredAndSortedPeople();

    if (people.length === 0) {
        const hasFilters = Object.values(currentFilters).some(v => v !== '');
        const msg = hasFilters ? 'Нет сотрудников, соответствующих фильтрам' : 'Нет сотрудников. Нажмите "Добавить сотрудников"';
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">${msg}</td></tr>`;
        updateFilteredCount();
        return;
    }

    populateTimeFilter();
    populatePositionFilterForShifts();

    body.innerHTML = people.map((p, i) => {
        const rels = getRelativesString(p.id);
        const schedules = getSchedulesForPosition(p.position);
        const timeOptions = schedules.length > 0 ?
            schedules.map(t => `<option value="${t}" ${p.time === t ? 'selected' : ''}>${t}</option>`).join('') : '';

        return `<tr class="${p.present ? 'present' : 'absent'}" data-id="${p.id}">
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(p.fullName)}</strong></td>
            <td>${escapeHtml(p.position || '-')}</td>
            <td><a href="tel:${p.phone}" class="phone-link">${escapeHtml(p.phone)}</a></td>
            <td class="relatives-cell">${rels || '-'}</td>
            <td>
                ${schedules.length > 0 ?
                    `<select class="time-input" onchange="updateShiftTime('${p.id}', this.value)">
                        <option value="">-- Выберите --</option>
                        ${timeOptions}
                    </select>` :
                    `<input type="text" class="time-input" value="${p.time || ''}" placeholder="08:00-20:00" onchange="updateShiftTime('${p.id}', this.value)">`
                }
            </td>
            <td>
                <button class="status-btn ${p.present ? 'present' : 'absent'} small" onclick="togglePresent('${p.id}')">
                    ${p.present ? '✅ На месте' : '❌ Отсутствует'}
                </button>
            </td>
            <td>
                <span class="remove-from-shift" onclick="removeFromShift('${p.id}')" title="Убрать">&times;</span>
            </td>
        </tr>`;
    }).join('');

    updateFilteredCount();
    document.getElementById('shiftPeopleCount').textContent = shifts[currentShiftId].people.length + ' чел.';
    setTimeout(initSortable, 100);
}

// ================================================================
//  ФИЛЬТРЫ И СОРТИРОВКА
// ================================================================
function getFilteredAndSortedPeople() {
    if (!currentShiftId || !shifts[currentShiftId]) return [];

    let people = [...shifts[currentShiftId].people];
    const { time, position, status } = currentFilters;

    if (time) people = people.filter(p => p.time === time);
    if (position) people = people.filter(p => p.position === position);
    if (status) {
        people = people.filter(p => status === 'present' ? p.present : !p.present);
    }

    const { field, direction } = currentSort;
    const multiplier = direction === 'asc' ? 1 : -1;

    people.sort((a, b) => {
        let valA, valB;
        switch(field) {
            case 'name': valA = a.fullName || ''; valB = b.fullName || ''; break;
            case 'position': valA = a.position || ''; valB = b.position || ''; break;
            case 'time': valA = a.time || ''; valB = b.time || ''; break;
            case 'status': valA = a.present ? 1 : 0; valB = b.present ? 1 : 0; break;
            default: valA = a.fullName || ''; valB = b.fullName || '';
        }
        if (valA < valB) return -1 * multiplier;
        if (valA > valB) return 1 * multiplier;
        return 0;
    });

    return people;
}

function updateFilteredCount() {
    const countEl = document.getElementById('filteredCount');
    if (!countEl) return;
    if (!currentShiftId || !shifts[currentShiftId]) {
        countEl.textContent = 'Нет смены';
        return;
    }
    const people = getFilteredAndSortedPeople();
    const total = shifts[currentShiftId].people.length;
    countEl.textContent = `Показано: ${people.length} из ${total}`;
}

function resetFilters() {
    currentFilters = { time: '', position: '', status: '' };
    document.getElementById('filterTime').value = '';
    document.getElementById('filterPosition').value = '';
    document.getElementById('filterStatus').value = '';
    currentSort = { field: 'name', direction: 'asc' };
    document.getElementById('sortBy').value = 'name';
    document.getElementById('sortDirectionBtn').classList.remove('desc');
    document.querySelectorAll('.shift-table th.sortable').forEach(h => h.classList.remove('active', 'asc', 'desc'));
    const nameHeader = document.querySelector('.shift-table th.sortable[data-sort="name"]');
    if (nameHeader) nameHeader.classList.add('active', 'asc');
    renderShift();
}

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
// ================================================================
function initShiftFilters() {
    populateTimeFilter();
    populatePositionFilterForShifts();
    populateCopyFromSelect();

    ['filterTime', 'filterPosition', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                const key = id.replace('filter', '').toLowerCase();
                currentFilters[key] = this.value;
                renderShift();
            });
        }
    });

    document.getElementById('sortBy').addEventListener('change', function() {
        currentSort.field = this.value;
        renderShift();
    });

    document.getElementById('sortDirectionBtn').addEventListener('click', function() {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        this.classList.toggle('desc');
        renderShift();
    });

    document.querySelectorAll('.shift-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const field = this.dataset.sort;
            if (field === 'index') return;

            if (currentSort.field === field) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = field;
                currentSort.direction = 'asc';
            }

            document.querySelectorAll('.shift-table th.sortable').forEach(h => h.classList.remove('active', 'asc', 'desc'));
            this.classList.add('active', currentSort.direction);
            document.getElementById('sortBy').value = field;

            renderShift();
        });
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', function() {
        resetFilters();
        showToast('Фильтры сброшены', 'info');
    });
}

function populateTimeFilter() {
    const select = document.getElementById('filterTime');
    if (!select) return;
    const times = new Set();
    if (currentShiftId && shifts[currentShiftId]) {
        shifts[currentShiftId].people.forEach(p => { if (p.time) times.add(p.time); });
    }
    const currentValue = select.value;
    select.innerHTML = '<option value="">Все время</option>';
    [...times].sort().forEach(time => {
        const opt = document.createElement('option');
        opt.value = time;
        opt.textContent = time;
        select.appendChild(opt);
    });
    if (currentValue && times.has(currentValue)) select.value = currentValue;
}

function populatePositionFilterForShifts() {
    const select = document.getElementById('filterPosition');
    if (!select) return;
    const posSet = new Set();
    if (currentShiftId && shifts[currentShiftId]) {
        shifts[currentShiftId].people.forEach(p => { if (p.position) posSet.add(p.position); });
    }
    const currentValue = select.value;
    select.innerHTML = '<option value="">Все должности</option>';
    [...posSet].sort().forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        select.appendChild(opt);
    });
    if (currentValue && posSet.has(currentValue)) select.value = currentValue;
}

function populateCopyFromSelect() {
    const select = document.getElementById('copyFromShift');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Выберите смену для копирования --</option>';
    const ids = Object.keys(shifts).filter(id => id !== currentShiftId);
    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));
    ids.forEach(id => {
        const s = shifts[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${s.date} — ${s.name} (${s.people.length} чел.)`;
        select.appendChild(opt);
    });
    if (currentValue && shifts[currentValue]) select.value = currentValue;
}

function copyShift() {
    const select = document.getElementById('copyFromShift');
    const sourceId = select.value;
    if (!sourceId) { showToast('Выберите смену для копирования!', 'warning'); return; }
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Сначала создайте целевую смену!', 'warning'); return; }

    const sourceShift = shifts[sourceId];
    const targetShift = shifts[currentShiftId];

    if (targetShift.people.length > 0 && !confirm('В текущей смене уже есть сотрудники. Заменить их?')) return;

    targetShift.people = [];
    let copied = 0;
    sourceShift.people.forEach(sourcePerson => {
        const emp = getEmployeeById(sourcePerson.id);
        if (emp) {
            targetShift.people.push({
                id: emp.id,
                fullName: emp.fullName,
                position: emp.position || '',
                phone: emp.phone,
                time: sourcePerson.time || '',
                present: false
            });
            copied++;
        }
    });

    saveData();
    renderShift();
    renderShiftsList();
    renderShiftDisplay();
    populateCopyFromSelect();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast(`✅ Скопировано ${copied} сотрудников`, 'success');
}

// ================================================================
//  УПРАВЛЕНИЕ СОТРУДНИКАМИ В СМЕНЕ
// ================================================================
function updateShiftTime(id, value) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    const person = shifts[currentShiftId].people.find(p => p.id === id);
    if (person) { person.time = value; saveData(); populateTimeFilter(); }
}

function togglePresent(id) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    const person = shifts[currentShiftId].people.find(p => p.id === id);
    if (person) { person.present = !person.present; saveData(); renderShift(); updateStats(); }
}

function removeFromShift(id) {
    if (!currentShiftId || !shifts[currentShiftId]) return;
    shifts[currentShiftId].people = shifts[currentShiftId].people.filter(p => p.id !== id);
    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast('Удалён из смены', 'warning');
}

function clearShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены', 'warning'); return; }
    if (!confirm('Очистить смену?')) return;
    shifts[currentShiftId].people = [];
    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast('🗑 Смена очищена', 'warning');
}

function deleteShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены', 'warning'); return; }
    if (!confirm(`Удалить смену "${shifts[currentShiftId].name}"?`)) return;
    delete shifts[currentShiftId];
    const ids = Object.keys(shifts);
    currentShiftId = ids.length > 0 ? ids[0] : null;
    saveData();
    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast('🗑 Смена удалена', 'error');
}

// ================================================================
//  SORTABLE (DRAG & DROP)
// ================================================================
function initSortable() {
    const tbody = document.getElementById('shiftBody');
    if (!tbody) return;
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    if (tbody.querySelectorAll('tr').length < 2) return;

    sortableInstance = new Sortable(tbody, {
        animation: 150,
        handle: 'tr',
        onEnd: function(evt) {
            if (!currentShiftId || !shifts[currentShiftId]) return;
            const people = shifts[currentShiftId].people;
            const [moved] = people.splice(evt.oldIndex, 1);
            people.splice(evt.newIndex, 0, moved);
            saveData();
            renderShift();
        }
    });
}

// ================================================================
//  БЫСТРЫЙ ПОИСК
// ================================================================
function initQuickAdd() {
    const input = document.getElementById('quickAddInput');
    const results = document.getElementById('quickAddResults');
    if (!input) return;

    input.addEventListener('input', function() {
        clearTimeout(quickSearchTimeout);
        const query = this.value.trim();
        if (query.length < 1) { results.classList.remove('show'); return; }
        quickSearchTimeout = setTimeout(() => searchAndShowResults(query), 200);
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstAddBtn = results.querySelector('.result-item:not(.already-added) .add-btn');
            if (firstAddBtn) firstAddBtn.click();
            this.value = '';
            results.classList.remove('show');
            this.focus();
        }
        if (e.key === 'Escape') { results.classList.remove('show'); this.blur(); }
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.quick-add-area')) results.classList.remove('show');
    });
}

function searchAndShowResults(query) {
    const results = document.getElementById('quickAddResults');
    if (!currentShiftId || !shifts[currentShiftId]) {
        results.innerHTML = `<div class="empty-result"><i class="fa-solid fa-calendar-xmark"></i>Сначала создайте смену</div>`;
        results.classList.add('show');
        return;
    }

    const inShift = shifts[currentShiftId].people.map(p => p.id);
    const searchLower = query.toLowerCase();
    const filtered = employees.filter(e =>
        e.fullName.toLowerCase().includes(searchLower) ||
        e.phone.includes(searchLower) ||
        (e.position && e.position.toLowerCase().includes(searchLower))
    ).slice(0, 8);

    if (filtered.length === 0) {
        results.innerHTML = `<div class="empty-result"><i class="fa-solid fa-user-slash"></i>Сотрудник не найден</div>`;
        results.classList.add('show');
        return;
    }

    results.innerHTML = filtered.map(e => {
        const already = inShift.includes(e.id);
        const relCount = e.relatives ? e.relatives.length : 0;
        const schedules = getSchedulesForPosition(e.position);

        let timeHtml = '';
        if (schedules.length > 0) {
            timeHtml = `<select class="quick-time-select" data-id="${e.id}">
                <option value="">-- Время --</option>
                ${schedules.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>`;
        } else {
            timeHtml = `<input type="text" class="quick-time-input" data-id="${e.id}" placeholder="08:00-20:00" style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text);">`;
        }

        const badge = relCount > 0 ? `<span class="badge">👤 ${relCount}</span>` : '';

        return `<div class="result-item ${already ? 'already-added' : ''}" data-id="${e.id}">
            <div class="info">
                <span class="name">${escapeHtml(e.fullName)} ${badge}</span>
                <span class="details">${escapeHtml(e.position || 'Без должности')} — ${escapeHtml(e.phone)}</span>
            </div>
            <div class="time-select-wrapper">
                ${timeHtml}
                <button class="add-btn" ${already ? 'disabled' : ''} data-id="${e.id}">
                    ${already ? '✅ В смене' : '➕ Добавить'}
                </button>
            </div>
        </div>`;
    }).join('');

    results.classList.add('show');

    results.querySelectorAll('.add-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const item = this.closest('.result-item');
            const select = item.querySelector('.quick-time-select');
            const input = item.querySelector('.quick-time-input');
            let time = select ? select.value : (input ? input.value.trim() : '');
            addEmployeeToShiftFromQuick(id, time);
        });
    });
}

function addEmployeeToShiftFromQuick(id, time) {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }
    const emp = getEmployeeById(id);
    if (!emp) { showToast('Сотрудник не найден!', 'error'); return; }
    if (shifts[currentShiftId].people.find(p => p.id === id)) { showToast('Сотрудник уже в смене', 'warning'); return; }

    shifts[currentShiftId].people.push({
        id: emp.id,
        fullName: emp.fullName,
        position: emp.position || '',
        phone: emp.phone,
        time: time || '',
        present: false
    });

    saveData();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();

    document.getElementById('quickAddResults').classList.remove('show');
    document.getElementById('quickAddInput').value = '';
    document.getElementById('quickAddInput').focus();
    showToast(`✅ ${emp.fullName} добавлен${time ? ' (' + time + ')' : ''}`, 'success');
}

// ================================================================
//  МОДАЛКА
// ================================================================
function openAddModal() {
    if (employees.length === 0) { showToast('Сначала добавьте сотрудников в базу!', 'warning'); return; }
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Сначала создайте смену!', 'warning'); return; }

    populateModalFilter();
    document.getElementById('modalSearch').value = '';
    renderModalList();
    document.getElementById('addModal').classList.add('active');
}

function populateModalFilter() {
    const select = document.getElementById('modalFilterPosition');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Все должности</option>';
    const posSet = new Set();
    employees.forEach(e => { if (e.position) posSet.add(e.position); });
    [...posSet].sort().forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        select.appendChild(opt);
    });
    if (current && posSet.has(current)) select.value = current;
}

function renderModalList() {
    const search = document.getElementById('modalSearch').value.toLowerCase().trim();
    const positionFilter = document.getElementById('modalFilterPosition').value || '';
    const inShift = shifts[currentShiftId]?.people.map(p => p.id) || [];

    let filtered = employees;
    if (search) filtered = filtered.filter(e => e.fullName.toLowerCase().includes(search) || e.phone.includes(search));
    if (positionFilter) filtered = filtered.filter(e => e.position === positionFilter);

    const container = document.getElementById('modalList');
    const countEl = document.getElementById('modalCount');
    const available = filtered.filter(e => !inShift.includes(e.id)).length;
    if (countEl) countEl.textContent = `${filtered.length} сотрудников (${available} доступно)`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;">Ничего не найдено</div>';
        return;
    }

    container.innerHTML = filtered.map(e => {
        const already = inShift.includes(e.id);
        const relCount = e.relatives ? e.relatives.length : 0;
        const schedules = getSchedulesForPosition(e.position);

        let timeHtml = '';
        if (schedules.length > 0) {
            timeHtml = `<select class="modal-time-select" data-id="${e.id}" style="padding:2px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg);color:var(--text);">
                <option value="">--</option>
                ${schedules.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>`;
        }

        return `<div class="employee-item ${already ? 'already' : ''}">
            <div class="info">
                <span class="name">${escapeHtml(e.fullName)}</span>
                ${e.position ? `<span class="position">(${escapeHtml(e.position)})</span>` : ''}
                <span class="phone">${escapeHtml(e.phone)}</span>
                ${relCount > 0 ? `<span class="relatives-indicator">👤 ${relCount}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                ${timeHtml}
                <input type="checkbox" class="checkbox" data-id="${e.id}" ${already ? 'disabled' : ''}>
            </div>
        </div>`;
    }).join('');
}

function selectAllInModal() {
    document.querySelectorAll('#modalList .checkbox:not(:disabled)').forEach(cb => cb.checked = true);
}

function addSelectedToShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }

    const selected = document.querySelectorAll('#modalList .checkbox:checked');
    if (selected.length === 0) { showToast('Выберите сотрудников!', 'warning'); return; }

    let added = 0;
    selected.forEach(cb => {
        const emp = getEmployeeById(cb.dataset.id);
        if (emp && !shifts[currentShiftId].people.find(p => p.id === emp.id)) {
            const item = cb.closest('.employee-item');
            const timeSelect = item?.querySelector('.modal-time-select');
            const time = timeSelect ? timeSelect.value : '';
            shifts[currentShiftId].people.push({
                id: emp.id,
                fullName: emp.fullName,
                position: emp.position || '',
                phone: emp.phone,
                time: time || '',
                present: false
            });
            added++;
        }
    });

    if (added === 0) { showToast('Все выбранные уже в смене', 'warning'); return; }

    saveData();
    closeModal();
    renderShift();
    renderShiftsList();
    populateTimeFilter();
    populatePositionFilterForShifts();
    showToast(`✅ Добавлено ${added} сотрудников`, 'success');
}

function closeModal() {
    document.getElementById('addModal').classList.remove('active');
}

// ================================================================
//  МЕСЯЧНЫЙ ГРАФИК ИЗ EXCEL
// ================================================================
const RU_MONTHS = {
    'январь': 1, 'января': 1,
    'февраль': 2, 'февраля': 2,
    'март': 3, 'марта': 3,
    'апрель': 4, 'апреля': 4,
    'май': 5, 'мая': 5,
    'июнь': 6, 'июня': 6,
    'июль': 7, 'июля': 7,
    'август': 8, 'августа': 8,
    'сентябрь': 9, 'сентября': 9,
    'октябрь': 10, 'октября': 10,
    'ноябрь': 11, 'ноября': 11,
    'декабрь': 12, 'декабря': 12
};
const RU_MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];


const DEFAULT_SHIFT_COLORS = {
    '06:00-18:00': 'FFF200',
    '07:00-19:00': 'F4B183',
    '08:00-20:00': '00B0F0',
    '09:00-19:00': '7030A0',
    '10:00-22:00': '92D050',
    '11:00-23:00': '00B050',
    '12:00-00:00': 'FF66CC',
    '20:00-08:00': 'F79646'
};

const DEFAULT_MANUAL_SHIFTS = [
    '06:00-18:00', '07:00-19:00', '08:00-20:00', '09:00-19:00',
    '10:00-22:00', '11:00-23:00', '12:00-00:00', '20:00-08:00'
];

const SCHEDULE_ABSENCE_OPTIONS = [
    { raw: 'В', status: 'Выходной', color: 'E2E8F0' },
    { raw: 'ОТ', status: 'Отпуск', color: 'FFE699' },
    { raw: 'Б', status: 'Больничный', color: 'F4CCCC' },
    { raw: 'ДО', status: 'Доп. отсутствие', color: 'D9EAD3' },
    { raw: 'УВ', status: 'УВ', color: 'D9D2E9' },
    { raw: 'НН', status: 'НН', color: 'D0E0E3' },
    { raw: 'О8', status: 'Обучение', color: 'CFE2F3' },
    { raw: 'КУ', status: 'Корпоративный университет', color: 'C9DAF8' },
    { raw: 'КТЗ', status: 'КТЗ', color: 'B4A7D6' }
];

const SCHEDULE_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function emptyScheduleDayInfo() {
    return { raw: '', color: '', kind: 'off', status: 'Выходной', working: false, time: '' };
}

function getDefaultScheduleLegend() {
    const legend = {};
    Object.entries(DEFAULT_SHIFT_COLORS).forEach(([time, color]) => { legend[color] = time; });
    return legend;
}

function getColorForShiftTime(time) {
    if (DEFAULT_SHIFT_COLORS[time]) return DEFAULT_SHIFT_COLORS[time];
    const palette = ['5B9BD5', '70AD47', 'FFC000', 'ED7D31', 'A5A5A5', '4472C4', 'C55A11', '8064A2'];
    let hash = 0;
    for (const ch of String(time || '')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
}


function normalizeHexColor(value, fallback = 'CBD5E1') {
    const hex = String(value || '').trim().replace('#', '').toUpperCase();
    return /^[0-9A-F]{6}$/.test(hex) ? hex : fallback;
}

function getDefaultAbsenceColor(raw) {
    return normalizeHexColor(SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw)?.color || 'CBD5E1');
}

function ensureScheduleColorSettings(schedule) {
    if (!schedule) return { work: {}, absence: {} };
    if (!schedule.colorSettings || typeof schedule.colorSettings !== 'object') schedule.colorSettings = { work: {}, absence: {} };
    if (!schedule.colorSettings.work || typeof schedule.colorSettings.work !== 'object') schedule.colorSettings.work = {};
    if (!schedule.colorSettings.absence || typeof schedule.colorSettings.absence !== 'object') schedule.colorSettings.absence = {};

    Object.values(schedule.legend || {}).forEach(time => {
        if (parseTimeRange(time) && !schedule.colorSettings.work[time]) {
            const legendEntry = Object.entries(schedule.legend || {}).find(([, t]) => t === time);
            schedule.colorSettings.work[time] = normalizeHexColor((legendEntry && legendEntry[0]) || getColorForShiftTime(time));
        }
    });

    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time && !schedule.colorSettings.work[info.time]) {
                schedule.colorSettings.work[info.time] = normalizeHexColor(info.color || getColorForShiftTime(info.time));
            }
            if (!info.working && info.raw && !schedule.colorSettings.absence[info.raw]) {
                schedule.colorSettings.absence[info.raw] = normalizeHexColor(info.color || getDefaultAbsenceColor(info.raw));
            }
        });
    });

    DEFAULT_MANUAL_SHIFTS.forEach(time => {
        if (!schedule.colorSettings.work[time]) schedule.colorSettings.work[time] = normalizeHexColor(getColorForShiftTime(time));
    });
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        if (!schedule.colorSettings.absence[option.raw]) schedule.colorSettings.absence[option.raw] = normalizeHexColor(option.color);
    });
    return schedule.colorSettings;
}

function getScheduleShiftColor(schedule, time) {
    if (!parseTimeRange(time)) return normalizeHexColor(getColorForShiftTime(time));
    const settings = ensureScheduleColorSettings(schedule);
    return normalizeHexColor(settings.work[time] || getColorForShiftTime(time));
}

function getScheduleAbsenceColor(schedule, raw) {
    const settings = ensureScheduleColorSettings(schedule);
    return normalizeHexColor(settings.absence[raw] || getDefaultAbsenceColor(raw));
}

function minutesFromClock(clock) {
    const match = String(clock || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function getPaidHoursForTime(time) {
    const parsed = parseTimeRange(time);
    if (!parsed) return 0;
    let start = parsed.start;
    let end = parsed.end;
    if (end <= start) end += 24 * 60;
    const total = (end - start) / 60;
    return Math.max(0, total - 1);
}

function getWorkCodeForTime(time) {
    if (time === '20:00-08:00') return '20,8';
    const hours = getPaidHoursForTime(time);
    if (!hours) return time;
    return Number.isInteger(hours) ? String(hours) : String(hours).replace('.', ',');
}

function getScheduleWorkHours(info) {
    if (!info || !info.working) return 0;
    if (info.time) return getPaidHoursForTime(info.time);
    const numeric = Number(String(info.raw || '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
}

function buildManualScheduleEmployee(base, dayCount) {
    const days = {};
    for (let d = 1; d <= dayCount; d++) days[d] = emptyScheduleDayInfo();
    return {
        sourceRow: `manual_${base.id || generateId()}`,
        baseId: base.id || '',
        fullName: base.fullName,
        position: base.position || 'Без должности',
        days
    };
}

function createManualSchedule() {
    const input = document.getElementById('scheduleManualMonth');
    const key = input?.value || toLocalISODate().slice(0, 7);
    const match = key.match(/^(20\d{2})-(\d{2})$/);
    if (!match) {
        showToast('Выберите месяц для графика', 'warning');
        return;
    }
    if (monthlySchedules[key]) {
        currentScheduleKey = key;
        selectScheduleMonth(key);
        showToast('График на этот месяц уже существует — открыл его без удаления данных', 'info');
        return;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const dayCount = new Date(year, month, 0).getDate();
    const schedule = {
        key,
        year,
        month,
        dayCount,
        title: `${RU_MONTH_NAMES[month]} ${year}`,
        sourceTitle: 'Создано на сайте',
        sourceName: 'Создано на сайте',
        sheetName: '',
        importedAt: new Date().toISOString(),
        createdManually: true,
        legend: getDefaultScheduleLegend(),
        colorSettings: {
            work: Object.fromEntries(DEFAULT_MANUAL_SHIFTS.map(time => [time, normalizeHexColor(getColorForShiftTime(time))])),
            absence: Object.fromEntries(SCHEDULE_ABSENCE_OPTIONS.map(option => [option.raw, normalizeHexColor(option.color)]))
        },
        employees: employees.map(emp => buildManualScheduleEmployee(emp, dayCount))
    };

    monthlySchedules[key] = schedule;
    currentScheduleKey = key;
    saveData();
    populateScheduleMonthSelect();
    selectScheduleMonth(key);
    renderDashboardScheduleSummary();
    showToast(`✅ Создан график ${schedule.title}: ${schedule.employees.length} сотрудников`, 'success');
}

function syncCurrentScheduleEmployees() {
    const schedule = getCurrentSchedule();
    if (!schedule) {
        showToast('Сначала создайте или откройте график', 'warning');
        return;
    }
    let added = 0;
    let updated = 0;

    employees.forEach(base => {
        let target = schedule.employees.find(e => e.baseId && e.baseId === base.id);
        if (!target) target = schedule.employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === normalizeEmployeeNameForMatch(base.fullName));
        if (target) {
            if (target.fullName !== base.fullName || target.position !== (base.position || 'Без должности')) updated++;
            target.baseId = base.id;
            target.fullName = base.fullName;
            target.position = base.position || 'Без должности';
        } else {
            schedule.employees.push(buildManualScheduleEmployee(base, schedule.dayCount));
            added++;
        }
    });

    schedule.updatedAt = new Date().toISOString();
    saveData();
    renderScheduleTab();
    renderDashboardScheduleSummary();
    showToast(`✅ Синхронизация: добавлено ${added}, обновлено ${updated}`, 'success');
}

function getSchedulePositionOrder(schedule) {
    const configured = Object.keys(positions || {});
    const used = [...new Set((schedule?.employees || []).map(e => e.position || 'Без должности'))];
    const result = configured.filter(p => used.includes(p));
    used.filter(p => !result.includes(p)).sort((a, b) => a.localeCompare(b, 'ru')).forEach(p => result.push(p));
    return result;
}

function groupScheduleEmployees(schedule, entries = null) {
    const list = entries || (schedule?.employees || []);
    const order = getSchedulePositionOrder({ employees: list });
    const groups = new Map(order.map(p => [p, []]));
    list.forEach(item => {
        const position = item.position || 'Без должности';
        if (!groups.has(position)) groups.set(position, []);
        groups.get(position).push(item);
    });
    return [...groups.entries()]
        .filter(([, group]) => group.length)
        .map(([position, group]) => ({
            position,
            employees: group.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ru'))
        }));
}

function getScheduleDayHeaderInfo(schedule, day) {
    const date = new Date(schedule.year, schedule.month - 1, day);
    const weekday = SCHEDULE_WEEKDAYS[date.getDay()];
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return { weekday, weekend };
}

function toLocalISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function initScheduleUI() {
    const manualMonth = document.getElementById('scheduleManualMonth');
    if (manualMonth && !manualMonth.value) manualMonth.value = toLocalISODate().slice(0, 7);
    const keys = Object.keys(monthlySchedules).sort().reverse();
    if (!currentScheduleKey || !monthlySchedules[currentScheduleKey]) {
        const todayKey = toLocalISODate().slice(0, 7);
        currentScheduleKey = monthlySchedules[todayKey] ? todayKey : (keys[0] || null);
    }
    populateScheduleMonthSelect();
    if (currentScheduleKey) selectScheduleMonth(currentScheduleKey, false);
    else renderScheduleTab();
}

function populateScheduleMonthSelect() {
    const select = document.getElementById('scheduleMonthSelect');
    if (!select) return;
    const keys = Object.keys(monthlySchedules).sort().reverse();
    select.innerHTML = keys.length
        ? keys.map(key => `<option value="${key}">${escapeHtml(monthlySchedules[key].title || key)}</option>`).join('')
        : '<option value="">-- Нет загруженных графиков --</option>';
    if (currentScheduleKey && monthlySchedules[currentScheduleKey]) select.value = currentScheduleKey;
}

function selectScheduleMonth(key, render = true) {
    if (key !== currentScheduleKey) clearScheduleCellSelection();
    if (!key || !monthlySchedules[key]) {
        currentScheduleKey = null;
        if (render) renderScheduleTab();
        return;
    }
    currentScheduleKey = key;
    const select = document.getElementById('scheduleMonthSelect');
    if (select) select.value = key;
    const manualMonth = document.getElementById('scheduleManualMonth');
    if (manualMonth) manualMonth.value = key;

    const schedule = monthlySchedules[key];
    const dateInput = document.getElementById('scheduleDate');
    if (dateInput) {
        const maxDay = schedule.dayCount || new Date(schedule.year, schedule.month, 0).getDate();
        const first = `${key}-01`;
        const last = `${key}-${String(maxDay).padStart(2, '0')}`;
        dateInput.min = first;
        dateInput.max = last;
        const today = toLocalISODate();
        dateInput.value = today.startsWith(key) ? today : first;
    }
    if (render) renderScheduleTab();
}

function renderScheduleTab() {
    populateScheduleMonthSelect();
    const badge = document.getElementById('scheduleMonthBadge');
    const info = document.getElementById('scheduleImportInfo');
    const schedule = currentScheduleKey ? monthlySchedules[currentScheduleKey] : null;

    populateScheduleBulkShiftSelect(schedule);

    if (!schedule) {
        if (badge) badge.textContent = 'Нет графика';
        if (info) info.innerHTML = '<span class="empty-text">Создайте график на сайте или импортируйте Excel.</span>';
        renderScheduleLegend(null);
        renderScheduleMonthTable(null);
        renderScheduleDay();
        return;
    }

    if (badge) badge.textContent = schedule.title;
    if (info) {
        const parsedAt = schedule.updatedAt || schedule.importedAt ? new Date(schedule.updatedAt || schedule.importedAt).toLocaleString('ru-RU') : '';
        info.innerHTML = `<div class="schedule-import-ok"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(schedule.sourceName || (schedule.createdManually ? 'Создано на сайте' : 'Excel'))} — ${schedule.employees.length} сотрудников${parsedAt ? ` · ${parsedAt}` : ''}</div>`;
    }
    renderScheduleLegend(schedule);
    populateSchedulePositionFilter(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
}

function importMonthlySchedule() {
    const input = document.getElementById('scheduleFileInput');
    if (!input || !input.files.length) {
        showToast('Выберите Excel-файл графика!', 'warning');
        return;
    }
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = parseMonthlyScheduleWorkbook(e.target.result, file.name);
            const existed = !!monthlySchedules[parsed.key];
            if (existed && !confirm(`График за ${parsed.title} уже загружен. Заменить его?`)) return;
            monthlySchedules[parsed.key] = parsed;
            currentScheduleKey = parsed.key;
            saveData();
            populateScheduleMonthSelect();
            selectScheduleMonth(parsed.key);
            renderDashboardScheduleSummary();
            input.value = '';
            showToast(`✅ График ${parsed.title} загружен: ${parsed.employees.length} сотрудников`, 'success');
        } catch (error) {
            console.error(error);
            showToast('Не удалось распознать график: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseMonthlyScheduleWorkbook(arrayBuffer, sourceName) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) throw new Error('В книге нет данных');

    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerInfo = detectScheduleHeader(ws, range);
    if (!headerInfo) throw new Error('Не найдена строка с днями месяца');

    const { headerRow, dayColumns, titleText, year, month } = headerInfo;
    if (!year || !month) throw new Error('Не удалось определить месяц и год из заголовка');

    const legend = detectShiftLegend(ws, range);
    const employeeRows = [];
    const summaryNames = new Set(['факт', 'фот', 'итого', 'итого оп:', 'итого отпс:', 'итог оп + отпс:']);

    for (let r = headerRow + 1; r <= range.e.r; r++) {
        const indexCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        const nameCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
        const posCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
        const fullName = cellText(nameCell).trim();
        const position = cellText(posCell).trim();
        const idxValue = indexCell ? indexCell.v : null;
        const indexIsNumber = typeof idxValue === 'number' || /^\d+$/.test(String(idxValue || '').trim());

        if (!indexIsNumber || !fullName || !position) continue;
        if (summaryNames.has(fullName.toLowerCase())) continue;

        const days = {};
        dayColumns.forEach(({ day, col }) => {
            const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
            days[day] = classifyScheduleCell(cell, legend);
        });

        employeeRows.push({
            sourceRow: r + 1,
            fullName,
            position,
            days
        });
    }

    if (employeeRows.length === 0) throw new Error('Не найдено ни одной строки сотрудника');

    const dayCount = Math.max(...dayColumns.map(d => d.day));
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return {
        key,
        year,
        month,
        dayCount,
        title: `${RU_MONTH_NAMES[month]} ${year}`,
        sourceTitle: titleText,
        sourceName,
        sheetName,
        importedAt: new Date().toISOString(),
        legend,
        employees: employeeRows
    };
}

function detectScheduleHeader(ws, range) {
    let best = null;
    const maxScanRow = Math.min(range.e.r, 30);
    for (let r = range.s.r; r <= maxScanRow; r++) {
        const dayCells = [];
        let rowText = '';
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            const text = cellText(cell).trim();
            if (text) rowText += ' ' + text;
            const n = Number(text.replace(',', '.'));
            if (Number.isInteger(n) && n >= 1 && n <= 31 && c >= 3) dayCells.push({ day: n, col: c });
        }
        const uniqueDays = [...new Map(dayCells.map(x => [x.day, x])).values()].sort((a, b) => a.day - b.day);
        if (uniqueDays.length >= 20 && (!best || uniqueDays.length > best.dayColumns.length)) {
            best = { headerRow: r, dayColumns: uniqueDays, rowText: rowText.trim() };
        }
    }
    if (!best) return null;

    let titleText = best.rowText;
    for (let c = range.s.c; c <= range.e.c; c++) {
        const text = cellText(ws[XLSX.utils.encode_cell({ r: best.headerRow, c })]).trim();
        if (/20\d{2}/.test(text) && Object.keys(RU_MONTHS).some(m => text.toLowerCase().includes(m))) {
            titleText = text;
            break;
        }
    }
    const parsed = parseRussianMonthYear(titleText);
    return { ...best, titleText, ...parsed };
}

function parseRussianMonthYear(text) {
    const lower = String(text || '').toLowerCase();
    const yearMatch = lower.match(/(20\d{2})/);
    let month = null;
    Object.keys(RU_MONTHS).some(name => {
        if (lower.includes(name)) {
            month = RU_MONTHS[name];
            return true;
        }
        return false;
    });
    return { year: yearMatch ? Number(yearMatch[1]) : null, month };
}

function detectShiftLegend(ws, range) {
    const legend = {};
    const timeRe = /смена\s+с\s+(\d{1,2}:\d{2})\s+до\s+(\d{1,2}:\d{2})/i;
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            const text = cellText(cell).trim();
            const match = text.match(timeRe);
            if (!match) continue;
            const time = `${normalizeClock(match[1])}-${normalizeClock(match[2])}`;
            for (let left = c - 1; left >= Math.max(range.s.c, c - 4); left--) {
                const sample = ws[XLSX.utils.encode_cell({ r, c: left })];
                if (!sample) continue;
                const color = getSheetJsFillColor(sample);
                if (color) {
                    legend[color] = time;
                    break;
                }
            }
        }
    }
    return legend;
}

function getSheetJsFillColor(cell) {
    if (!cell || !cell.s) return '';
    const style = cell.s;
    const fg = style.fgColor || (style.fill && style.fill.fgColor) || null;
    let rgb = fg && fg.rgb ? String(fg.rgb) : '';
    if (!rgb) return '';
    rgb = rgb.replace('#', '').toUpperCase();
    if (rgb.length === 8) rgb = rgb.slice(2);
    return rgb;
}

function normalizeClock(value) {
    const [h, m] = String(value).split(':');
    return `${String(Number(h)).padStart(2, '0')}:${String(Number(m || 0)).padStart(2, '0')}`;
}

function cellText(cell) {
    if (!cell || cell.v === undefined || cell.v === null) return '';
    if (cell.w !== undefined && cell.w !== null) return String(cell.w);
    return String(cell.v);
}

function classifyScheduleCell(cell, legend) {
    const raw = cellText(cell).trim();
    const color = getSheetJsFillColor(cell);
    const normalized = raw.toLowerCase().replace(/\s+/g, '');

    if (!raw) {
        return { raw: '', color, kind: 'off', status: 'Выходной', working: false, time: '' };
    }

    if (/^20([_,.])8$/.test(normalized) || /^20[:.]?00[-–]08[:.]?00$/.test(normalized)) {
        return { raw, color, kind: 'working', status: 'Ночная смена', working: true, time: '20:00-08:00' };
    }

    const numeric = Number(normalized.replace(',', '.'));
    if (!Number.isNaN(numeric) && numeric > 0) {
        return {
            raw,
            color,
            kind: 'working',
            status: 'Рабочая смена',
            working: true,
            time: legend[color] || ''
        };
    }

    const labels = {
        'от': 'Отпуск',
        'б': 'Больничный',
        'до': 'Доп. отсутствие',
        'ув': 'УВ',
        'нн': 'НН',
        'о8': 'Обучение',
        'ку': 'Корпоративный университет',
        'ктз': 'КТЗ'
    };
    return {
        raw,
        color,
        kind: labels[normalized] ? 'other' : 'other',
        status: labels[normalized] || raw,
        working: false,
        time: ''
    };
}

function getCurrentSchedule() {
    return currentScheduleKey && monthlySchedules[currentScheduleKey] ? monthlySchedules[currentScheduleKey] : null;
}

function getScheduleSelectedDate() {
    const input = document.getElementById('scheduleDate');
    return input && input.value ? input.value : null;
}

function getScheduleDayNumber() {
    const date = getScheduleSelectedDate();
    if (!date) return null;
    return Number(date.slice(8, 10));
}

function getScheduleEntriesForSelectedDay() {
    const schedule = getCurrentSchedule();
    const day = getScheduleDayNumber();
    if (!schedule || !day) return [];
    return schedule.employees.map(emp => ({ ...emp, dayInfo: emp.days[day] || { raw: '', kind: 'off', status: 'Выходной', working: false, time: '' } }));
}

function normalizeEmployeeNameForMatch(name) {
    return String(name || '')
        .replace(/\([^)]*\)\s*$/g, '')
        .replace(/ё/gi, 'е')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function findBaseEmployeeByScheduleName(name) {
    const exact = employees.find(e => e.fullName.trim().toLowerCase() === String(name).trim().toLowerCase());
    if (exact) return exact;
    const key = normalizeEmployeeNameForMatch(name);
    return employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === key) || null;
}

function parseTimeRange(time) {
    const match = String(time || '').match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return null;
    return {
        start: Number(match[1]) * 60 + Number(match[2]),
        end: Number(match[3]) * 60 + Number(match[4])
    };
}

function isEntryActiveNow(entry, selectedDate) {
    if (!entry.dayInfo.working) return false;
    if (selectedDate !== toLocalISODate()) return false;
    if (!entry.dayInfo.time) return true; // безопаснее не исключать сотрудника при неизвестном времени
    const range = parseTimeRange(entry.dayInfo.time);
    if (!range) return true;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (range.start === range.end) return true;
    if (range.start < range.end) return minutes >= range.start && minutes < range.end;
    return minutes >= range.start || minutes < range.end;
}

function renderScheduleDay() {
    const body = document.getElementById('scheduleDayBody');
    if (!body) return;
    const schedule = getCurrentSchedule();
    if (!schedule) {
        body.innerHTML = '<tr><td colspan="7" class="schedule-empty-cell">Создайте график на сайте или импортируйте Excel</td></tr>';
        setScheduleStats(0, 0, 0, 0);
        return;
    }

    const selectedDate = getScheduleSelectedDate();
    if (!selectedDate || !selectedDate.startsWith(schedule.key)) {
        selectScheduleMonth(schedule.key, false);
    }

    let entries = getScheduleEntriesForSelectedDay();
    const total = entries.length;
    const working = entries.filter(e => e.dayInfo.working).length;
    const nowCount = entries.filter(e => isEntryActiveNow(e, getScheduleSelectedDate())).length;
    const off = total - working;
    setScheduleStats(total, working, nowCount, off);

    const search = (document.getElementById('scheduleSearch')?.value || '').toLowerCase().trim();
    const position = document.getElementById('schedulePositionFilter')?.value || '';
    const status = document.getElementById('scheduleStatusFilter')?.value || 'working';
    const date = getScheduleSelectedDate();

    if (search) entries = entries.filter(e => e.fullName.toLowerCase().includes(search) || String(e.position || '').toLowerCase().includes(search));
    if (position) entries = entries.filter(e => e.position === position);
    if (status === 'working') entries = entries.filter(e => e.dayInfo.working);
    if (status === 'now') entries = entries.filter(e => isEntryActiveNow(e, date));
    if (status === 'off') entries = entries.filter(e => !e.dayInfo.working);

    const countEl = document.getElementById('scheduleFilteredCount');
    if (countEl) countEl.textContent = `Показано: ${entries.length} из ${total}`;

    if (!entries.length) {
        body.innerHTML = '<tr><td colspan="7" class="schedule-empty-cell">Нет сотрудников по выбранному фильтру</td></tr>';
        return;
    }

    const groups = groupScheduleEmployees(schedule, entries);
    let counter = 0;
    body.innerHTML = groups.map(group => {
        const groupHeader = `<tr class="schedule-day-position-row"><td colspan="7"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)} <span>${group.employees.length} чел.</span></td></tr>`;
        const rows = group.employees
            .sort((a, b) => (a.dayInfo.time || '99:99').localeCompare(b.dayInfo.time || '99:99') || a.fullName.localeCompare(b.fullName, 'ru'))
            .map(entry => {
                counter++;
                const base = findBaseEmployeeByScheduleName(entry.fullName);
                const phone = base?.phone || '';
                const active = isEntryActiveNow(entry, date);
                const statusClass = entry.dayInfo.working ? (active && date === toLocalISODate() ? 'schedule-status-now' : 'schedule-status-work') : 'schedule-status-off';
                let statusText = entry.dayInfo.status;
                if (entry.dayInfo.working && active && date === toLocalISODate()) statusText = 'Сейчас по графику';
                const time = entry.dayInfo.time || (entry.dayInfo.working ? 'Время не определено' : '—');
                return `<tr class="${entry.dayInfo.working ? 'schedule-row-working' : 'schedule-row-off'}">
                    <td>${counter}</td>
                    <td><strong>${escapeHtml(entry.fullName)}</strong>${base ? '' : '<span class="schedule-unmatched" title="Нет точного совпадения в базе сотрудников">не в базе</span>'}</td>
                    <td>${escapeHtml(entry.position)}</td>
                    <td>${phone ? `<a href="tel:${escapeHtml(phone)}" class="phone-link">${escapeHtml(phone)}</a>` : '—'}</td>
                    <td><span class="schedule-code">${escapeHtml(entry.dayInfo.raw || '—')}</span></td>
                    <td>${escapeHtml(time)}</td>
                    <td><span class="schedule-status ${statusClass}">${escapeHtml(statusText)}</span></td>
                </tr>`;
            }).join('');
        return groupHeader + rows;
    }).join('');
}

function setScheduleStats(total, working, now, absent) {
    const map = {
        scheduleStatTotal: total,
        scheduleStatWorking: working,
        scheduleStatNow: now,
        scheduleStatAbsent: absent
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function populateSchedulePositionFilter(schedule) {
    const select = document.getElementById('schedulePositionFilter');
    if (!select) return;
    const current = select.value;
    const positionsList = getSchedulePositionOrder(schedule);
    select.innerHTML = '<option value="">Все должности</option>' + positionsList.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if (positionsList.includes(current)) select.value = current;
}

function renderScheduleLegend(schedule) {
    const el = document.getElementById('scheduleLegend');
    if (!el) return;
    if (!schedule) {
        el.innerHTML = '<span class="empty-text">Легенда появится после создания графика</span>';
        return;
    }
    const colorSettings = ensureScheduleColorSettings(schedule);
    const configured = Object.keys(colorSettings.work || {}).filter(t => parseTimeRange(t));
    const legendTimes = Object.values(schedule.legend || {}).filter(t => parseTimeRange(t));
    const times = [...new Set([...DEFAULT_MANUAL_SHIFTS, ...legendTimes, ...configured])];
    el.innerHTML = times.length
        ? times.map(time => `<span class="legend-chip"><i style="background:#${getScheduleShiftColor(schedule, time)}"></i>${escapeHtml(getWorkCodeForTime(time))} · ${escapeHtml(time)}</span>`).join('')
        : '<span class="empty-text">Добавьте рабочую смену — её цвет появится здесь.</span>';
}

function renderScheduleMonthTable(schedule) {
    const wrap = document.getElementById('scheduleMonthTableWrap');
    if (!wrap) return;
    if (!schedule) {
        selectedScheduleCells.clear();
        wrap.innerHTML = '<div class="schedule-editor-empty"><i class="fa-solid fa-table-cells-large"></i><strong>График ещё не создан</strong><span>Выберите месяц выше и нажмите «Создать график».</span></div>';
        updateScheduleSelectionUI();
        return;
    }

    const days = Array.from({ length: schedule.dayCount }, (_, i) => i + 1);
    const employeeList = schedule.employees.map((emp, index) => ({ ...emp, _scheduleIndex: index }));
    const groups = groupScheduleEmployees(schedule, employeeList);
    const dayHeaders = days.map(d => {
        const info = getScheduleDayHeaderInfo(schedule, d);
        return `<th class="schedule-day-head ${info.weekend ? 'weekend' : ''}"><span>${d}</span><small>${info.weekday}</small></th>`;
    }).join('');

    const header = `<tr>
        <th class="schedule-sticky-name schedule-name-head">ФИО</th>
        ${dayHeaders}
        <th class="schedule-total-head">Часы</th>
        <th class="schedule-total-head">Смены</th>
    </tr>`;

    let visualRow = 0;
    const body = groups.map(group => {
        const groupHours = group.employees.reduce((sum, emp) => sum + days.reduce((s, d) => s + getScheduleWorkHours(emp.days[d]), 0), 0);
        const groupShifts = group.employees.reduce((sum, emp) => sum + days.filter(d => emp.days[d]?.working).length, 0);
        const groupHeader = `<tr class="schedule-position-row">
            <td colspan="${schedule.dayCount + 3}">
                <div class="schedule-position-title">
                    <span><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)}</span>
                    <small>${group.employees.length} чел. · ${formatScheduleHours(groupHours)} ч. · ${groupShifts} смен</small>
                </div>
            </td>
        </tr>`;

        const rows = group.employees.map(emp => {
            const rowIndex = visualRow++;
            const totalHours = days.reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
            const totalShifts = days.filter(d => emp.days[d]?.working).length;
            const cells = days.map(d => {
                const info = emp.days[d] || emptyScheduleDayInfo();
                const dateInfo = getScheduleDayHeaderInfo(schedule, d);
                const style = info.color ? ` style="--cell-color:#${info.color}"` : '';
                const cls = info.working ? 'm-work' : (info.raw ? 'm-other' : 'm-off');
                const title = [info.status, info.time].filter(Boolean).join(' · ') || 'Пустая ячейка';
                const key = getScheduleCellKey(emp._scheduleIndex, d);
                const selectedClass = selectedScheduleCells.has(key) ? 'selected' : '';
                return `<td class="schedule-month-cell schedule-cell-editable ${cls} ${dateInfo.weekend ? 'weekend' : ''} ${selectedClass}"${style}
                    data-employee-index="${emp._scheduleIndex}" data-day="${d}" data-row="${rowIndex}"
                    title="${escapeHtml(title)} — протяните мышкой для выделения, двойной клик для редактирования"
                    onmousedown="startScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    onmouseenter="extendScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    ondblclick="openScheduleCellEditor(${emp._scheduleIndex}, ${d})">${escapeHtml(info.raw || '')}</td>`;
            }).join('');
            return `<tr class="schedule-employee-row">
                <td class="schedule-sticky-name schedule-employee-name"><strong>${escapeHtml(emp.fullName)}</strong></td>
                ${cells}
                <td class="schedule-total-cell">${formatScheduleHours(totalHours)}</td>
                <td class="schedule-total-cell">${totalShifts}</td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');

    wrap.innerHTML = `<table class="schedule-month-table schedule-editor-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    updateScheduleSelectionUI();
}

function getScheduleCellKey(employeeIndex, day) {
    return `${employeeIndex}:${day}`;
}

function parseScheduleCellKey(key) {
    const [employeeIndex, day] = String(key).split(':').map(Number);
    return Number.isInteger(employeeIndex) && Number.isInteger(day) ? { employeeIndex, day } : null;
}

function startScheduleCellSelection(event, employeeIndex, day, row) {
    if (event.button !== 0) return;
    event.preventDefault();
    isScheduleCellSelecting = true;

    const keepExisting = event.ctrlKey || event.metaKey;
    scheduleSelectionBase = keepExisting ? new Set(selectedScheduleCells) : new Set();

    if (event.shiftKey && scheduleSelectionAnchor) {
        scheduleDragAnchor = { ...scheduleSelectionAnchor };
    } else {
        scheduleSelectionAnchor = { employeeIndex, day, row };
        scheduleDragAnchor = { employeeIndex, day, row };
    }

    applyScheduleSelectionRectangle(scheduleDragAnchor, { employeeIndex, day, row });
}

function extendScheduleCellSelection(event, employeeIndex, day, row) {
    if (!isScheduleCellSelecting || !scheduleDragAnchor) return;
    if (event.buttons !== undefined && (event.buttons & 1) !== 1) return;
    applyScheduleSelectionRectangle(scheduleDragAnchor, { employeeIndex, day, row });
}

function finishScheduleCellSelection() {
    if (!isScheduleCellSelecting) return;
    isScheduleCellSelecting = false;
    scheduleDragAnchor = null;
    updateScheduleSelectionUI();
}

function applyScheduleSelectionRectangle(anchor, current) {
    const minRow = Math.min(anchor.row, current.row);
    const maxRow = Math.max(anchor.row, current.row);
    const minDay = Math.min(anchor.day, current.day);
    const maxDay = Math.max(anchor.day, current.day);
    const next = new Set(scheduleSelectionBase);

    document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable').forEach(cell => {
        const row = Number(cell.dataset.row);
        const day = Number(cell.dataset.day);
        if (row >= minRow && row <= maxRow && day >= minDay && day <= maxDay) {
            next.add(getScheduleCellKey(Number(cell.dataset.employeeIndex), day));
        }
    });

    selectedScheduleCells = next;
    updateScheduleSelectionUI();
}

function clearScheduleCellSelection() {
    selectedScheduleCells.clear();
    scheduleSelectionAnchor = null;
    scheduleDragAnchor = null;
    scheduleSelectionBase = new Set();
    isScheduleCellSelecting = false;
    updateScheduleSelectionUI();
}

function updateScheduleSelectionUI() {
    document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable').forEach(cell => {
        const key = getScheduleCellKey(Number(cell.dataset.employeeIndex), Number(cell.dataset.day));
        cell.classList.toggle('selected', selectedScheduleCells.has(key));
    });

    const bar = document.getElementById('scheduleSelectionBar');
    const count = document.getElementById('scheduleSelectionCount');
    const details = document.getElementById('scheduleSelectionDetails');
    const size = selectedScheduleCells.size;
    if (bar) bar.classList.toggle('active', size > 0);
    if (count) count.textContent = `${size} ${pluralizeRu(size, 'ячейка', 'ячейки', 'ячеек')}`;

    if (details) {
        if (!size) {
            details.textContent = 'Выделите ячейки мышкой';
        } else {
            const parsed = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
            const employeesCount = new Set(parsed.map(x => x.employeeIndex)).size;
            const daysCount = new Set(parsed.map(x => x.day)).size;
            details.textContent = `${employeesCount} ${pluralizeRu(employeesCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${daysCount} ${pluralizeRu(daysCount, 'день', 'дня', 'дней')}`;
        }
    }
}

function pluralizeRu(value, one, few, many) {
    const n = Math.abs(Number(value)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
}

function getSelectedScheduleContexts() {
    const schedule = getCurrentSchedule();
    if (!schedule) return [];
    return [...selectedScheduleCells]
        .map(parseScheduleCellKey)
        .filter(Boolean)
        .map(({ employeeIndex, day }) => ({ schedule, employee: schedule.employees[employeeIndex], employeeIndex, day }))
        .filter(ctx => ctx.employee && ctx.day >= 1 && ctx.day <= schedule.dayCount);
}

function populateScheduleBulkShiftSelect(schedule) {
    const select = document.getElementById('scheduleBulkShiftSelect');
    if (!select) return;
    const current = select.value;
    const configured = Object.values(positions || {}).flat().filter(t => parseTimeRange(t));
    const legendTimes = Object.values(schedule?.legend || {}).filter(t => parseTimeRange(t));
    const shiftsList = [...new Set([...DEFAULT_MANUAL_SHIFTS, ...configured, ...legendTimes])];
    select.innerHTML = '<option value="">Выберите смену…</option>' + shiftsList.map(time => `<option value="${escapeHtml(time)}">${escapeHtml(getWorkCodeForTime(time))} · ${escapeHtml(time)}</option>`).join('');
    if (current && shiftsList.includes(current)) select.value = current;
    else if (shiftsList.includes('11:00-23:00')) select.value = '11:00-23:00';
}

function applyScheduleWorkToContexts(contexts, time) {
    if (!contexts.length || !parseTimeRange(time)) return false;
    const schedule = contexts[0].schedule;
    const color = getScheduleShiftColor(schedule, time);
    contexts.forEach(ctx => {
        ctx.employee.days[ctx.day] = {
            raw: getWorkCodeForTime(time),
            color,
            kind: 'working',
            status: time === '20:00-08:00' ? 'Ночная смена' : 'Рабочая смена',
            working: true,
            time
        };
    });
    schedule.legend = schedule.legend || {};
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.work[time] = color;
    Object.keys(schedule.legend).forEach(key => { if (schedule.legend[key] === time) delete schedule.legend[key]; });
    schedule.legend[color] = time;
    return true;
}

function applyScheduleAbsenceToContexts(contexts, option) {
    if (!contexts.length || !option) return false;
    const schedule = contexts[0].schedule;
    const color = getScheduleAbsenceColor(schedule, option.raw);
    contexts.forEach(ctx => {
        ctx.employee.days[ctx.day] = {
            raw: option.raw,
            color,
            kind: 'other',
            status: option.status,
            working: false,
            time: ''
        };
    });
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.absence[option.raw] = color;
    return true;
}

function applyScheduleSelectionWork(time) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    if (!applyScheduleWorkToContexts(contexts, time)) return;
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, `Смена ${time}`);
}

function applyScheduleSelectionAbsence(raw) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    if (!option || !applyScheduleAbsenceToContexts(contexts, option)) return;
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, option.status);
}

function clearSelectedScheduleCells() {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    contexts.forEach(ctx => { ctx.employee.days[ctx.day] = emptyScheduleDayInfo(); });
    persistScheduleBulkEdit(contexts[0].schedule, contexts.length, 'Очищено');
}

function persistScheduleBulkEdit(schedule, count, label) {
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    saveData();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    showToast(`✅ ${label}: обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`, 'success');
}

function formatScheduleHours(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}


function openScheduleCellEditor(employeeIndex, day) {
    const schedule = getCurrentSchedule();
    if (!schedule?.employees?.[employeeIndex] || !day) return;
    selectedScheduleCells = new Set([getScheduleCellKey(employeeIndex, day)]);
    scheduleSelectionAnchor = null;
    updateScheduleSelectionUI();
    openScheduleCellsEditor([{ employeeIndex, day }]);
}

function openSelectedScheduleCellsEditor() {
    const cells = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
    if (!cells.length) {
        showToast('Сначала выделите ячейки', 'warning');
        return;
    }
    openScheduleCellsEditor(cells);
}

function openScheduleCellsEditor(cells) {
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) return;
    const validCells = cells.filter(cell => schedule.employees[cell.employeeIndex] && cell.day >= 1 && cell.day <= schedule.dayCount);
    if (!validCells.length) return;

    editingScheduleCell = { scheduleKey: schedule.key, cells: validCells };
    const contexts = getEditingScheduleContexts();
    const subtitle = document.getElementById('scheduleCellModalSubtitle');
    if (subtitle) {
        if (contexts.length === 1) {
            const ctx = contexts[0];
            subtitle.innerHTML = `<strong>${escapeHtml(ctx.employee.fullName)}</strong><span>${escapeHtml(ctx.employee.position || 'Без должности')} · ${ctx.day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}</span>`;
        } else {
            const employeeCount = new Set(contexts.map(ctx => ctx.employeeIndex)).size;
            const days = [...new Set(contexts.map(ctx => ctx.day))].sort((a, b) => a - b);
            const dayText = days.length === 1 ? `${days[0]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}` : `${days[0]}–${days[days.length - 1]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}`;
            subtitle.innerHTML = `<strong>${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')} выбрано</strong><span>${employeeCount} ${pluralizeRu(employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${dayText}</span>`;
        }
    }

    const positionShifts = contexts.flatMap(ctx => getSchedulesForPosition(ctx.employee.position)).filter(t => parseTimeRange(t));
    const shiftsList = [...new Set([...positionShifts, ...DEFAULT_MANUAL_SHIFTS])];
    const currentInfos = contexts.map(ctx => ctx.employee.days[ctx.day] || emptyScheduleDayInfo());
    const workOptions = document.getElementById('scheduleCellWorkOptions');
    if (workOptions) {
        workOptions.innerHTML = shiftsList.map(time => {
            const color = getScheduleShiftColor(schedule, time);
            const code = getWorkCodeForTime(time);
            const active = currentInfos.length > 0 && currentInfos.every(info => info.working && info.time === time);
            return `<button class="schedule-cell-option work ${active ? 'active' : ''}" onclick="setEditingScheduleWork('${time}')">
                <i style="background:#${color}"></i>
                <span><strong>${escapeHtml(code)}</strong><small>${escapeHtml(time)}</small></span>
            </button>`;
        }).join('');
    }

    const absenceOptions = document.getElementById('scheduleCellAbsenceOptions');
    if (absenceOptions) {
        absenceOptions.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map((option, index) => {
            const active = currentInfos.length > 0 && currentInfos.every(info => !info.working && info.raw === option.raw);
            return `<button class="schedule-cell-option absence-option ${active ? 'active' : ''}" onclick="setEditingScheduleAbsence(${index})">
                <i style="background:#${getScheduleAbsenceColor(schedule, option.raw)}"></i>
                <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
            </button>`;
        }).join('');
    }

    const sameTime = currentInfos.length > 0 && currentInfos.every(info => info.time && info.time === currentInfos[0].time) ? currentInfos[0].time : '';
    if (sameTime) {
        const parsed = sameTime.split('-');
        if (parsed.length === 2) {
            const start = document.getElementById('scheduleCustomStart');
            const end = document.getElementById('scheduleCustomEnd');
            if (start) start.value = parsed[0];
            if (end) end.value = parsed[1];
        }
    }

        document.getElementById('scheduleCellModal')?.classList.add('active');
}

function closeScheduleCellEditor() {
    const modal = document.getElementById('scheduleCellModal');
    if (modal) modal.classList.remove('active');
    editingScheduleCell = null;
}

function getEditingScheduleContexts() {
    if (!editingScheduleCell) return [];
    const schedule = monthlySchedules[editingScheduleCell.scheduleKey];
    if (!schedule) return [];
    const cells = editingScheduleCell.cells || (editingScheduleCell.employeeIndex !== undefined ? [{ employeeIndex: editingScheduleCell.employeeIndex, day: editingScheduleCell.day }] : []);
    return cells.map(cell => ({
        schedule,
        employee: schedule.employees[cell.employeeIndex],
        employeeIndex: cell.employeeIndex,
        day: cell.day
    })).filter(ctx => ctx.employee && ctx.day >= 1 && ctx.day <= schedule.dayCount);
}

function setEditingScheduleWork(time) {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length || !parseTimeRange(time)) return;
    if (!applyScheduleWorkToContexts(contexts, time)) return;
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function setEditingScheduleAbsence(optionIndex) {
    const contexts = getEditingScheduleContexts();
    const option = SCHEDULE_ABSENCE_OPTIONS[optionIndex];
    if (!contexts.length || !option) return;
    if (!applyScheduleAbsenceToContexts(contexts, option)) return;
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function clearEditingScheduleCell() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    contexts.forEach(ctx => { ctx.employee.days[ctx.day] = emptyScheduleDayInfo(); });
    persistScheduleCellEdit(contexts[0].schedule, contexts.length);
}

function applyCustomScheduleTime() {
    const start = document.getElementById('scheduleCustomStart')?.value;
    const end = document.getElementById('scheduleCustomEnd')?.value;
    if (!start || !end) {
        showToast('Укажите начало и окончание смены', 'warning');
        return;
    }
    setEditingScheduleWork(`${normalizeClock(start)}-${normalizeClock(end)}`);
}

function persistScheduleCellEdit(schedule, count = 1) {
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    saveData();
    closeScheduleCellEditor();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    if (count > 1) showToast(`✅ Обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`, 'success');
}


function getAvailableScheduleWorkTimes(schedule) {
    if (!schedule) return [];
    const fromPositions = Object.values(positions || {}).flat().filter(t => parseTimeRange(t));
    const fromLegend = Object.values(schedule.legend || {}).filter(t => parseTimeRange(t));
    const fromCells = [];
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (info?.working && info.time && parseTimeRange(info.time)) fromCells.push(info.time);
        });
    });
    const fromSettings = Object.keys(ensureScheduleColorSettings(schedule).work || {}).filter(t => parseTimeRange(t));
    return [...new Set([...DEFAULT_MANUAL_SHIFTS, ...fromPositions, ...fromLegend, ...fromCells, ...fromSettings])];
}

function openScheduleColorsEditor() {
    const schedule = getCurrentSchedule();
    if (!schedule) {
        showToast('Сначала создайте или откройте график', 'warning');
        return;
    }
    const settings = ensureScheduleColorSettings(schedule);
    editingScheduleColors = {
        scheduleKey: schedule.key,
        work: { ...settings.work },
        absence: { ...settings.absence }
    };

    const subtitle = document.getElementById('scheduleColorsModalSubtitle');
    if (subtitle) subtitle.textContent = `Настройте цвета для месяца «${schedule.title}». Изменения сразу применятся ко всем таким сменам в этом месяце.`;

    renderScheduleColorsEditor();
    document.getElementById('scheduleColorsModal')?.classList.add('active');
}

function renderScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    const workList = document.getElementById('scheduleColorsWorkList');
    const absenceList = document.getElementById('scheduleColorsAbsenceList');
    const times = getAvailableScheduleWorkTimes(schedule);
    if (workList) {
        workList.innerHTML = times.map(time => {
            const color = normalizeHexColor(editingScheduleColors.work[time] || getScheduleShiftColor(schedule, time));
            return `<label class="schedule-color-editor-item">
                <span class="schedule-color-editor-main">
                    <i style="background:#${color}"></i>
                    <span><strong>${escapeHtml(getWorkCodeForTime(time))}</strong><small>${escapeHtml(time)}</small></span>
                </span>
                <input type="color" value="#${color}" data-type="work" data-key="${escapeHtml(time)}" onchange="updateScheduleColorDraft(this)" />
            </label>`;
        }).join('');
    }
    if (absenceList) {
        absenceList.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map(option => {
            const color = normalizeHexColor(editingScheduleColors.absence[option.raw] || getScheduleAbsenceColor(schedule, option.raw));
            return `<label class="schedule-color-editor-item">
                <span class="schedule-color-editor-main">
                    <i style="background:#${color}"></i>
                    <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
                </span>
                <input type="color" value="#${color}" data-type="absence" data-key="${escapeHtml(option.raw)}" onchange="updateScheduleColorDraft(this)" />
            </label>`;
        }).join('');
    }
}

function updateScheduleColorDraft(input) {
    if (!editingScheduleColors || !input) return;
    const type = input.dataset.type;
    const key = input.dataset.key;
    const value = normalizeHexColor(input.value);
    if (!key || !['work', 'absence'].includes(type)) return;
    editingScheduleColors[type][key] = value;
    const preview = input.closest('.schedule-color-editor-item')?.querySelector('i');
    if (preview) preview.style.background = `#${value}`;
}

function resetScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    editingScheduleColors.work = {};
    getAvailableScheduleWorkTimes(schedule).forEach(time => {
        editingScheduleColors.work[time] = normalizeHexColor(getColorForShiftTime(time));
    });
    editingScheduleColors.absence = {};
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        editingScheduleColors.absence[option.raw] = normalizeHexColor(option.color);
    });
    renderScheduleColorsEditor();
}

function applyScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    ensureScheduleColorSettings(schedule);
    schedule.colorSettings.work = { ...schedule.colorSettings.work, ...editingScheduleColors.work };
    schedule.colorSettings.absence = { ...schedule.colorSettings.absence, ...editingScheduleColors.absence };

    const nextLegend = {};
    Object.keys(schedule.colorSettings.work).forEach(time => {
        if (parseTimeRange(time)) nextLegend[normalizeHexColor(schedule.colorSettings.work[time])] = time;
    });
    schedule.legend = nextLegend;

    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time) info.color = getScheduleShiftColor(schedule, info.time);
            if (!info.working && info.raw) info.color = getScheduleAbsenceColor(schedule, info.raw);
        });
    });

    schedule.updatedAt = new Date().toISOString();
    saveData();
    closeScheduleColorsEditor();
    renderScheduleLegend(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    showToast('✅ Цвета смен обновлены', 'success');
}

function closeScheduleColorsEditor() {
    const modal = document.getElementById('scheduleColorsModal');
    if (modal) modal.classList.remove('active');
    editingScheduleColors = null;
}

function selectTodayInSchedule() {
    const today = toLocalISODate();
    const key = today.slice(0, 7);
    if (monthlySchedules[key]) {
        selectScheduleMonth(key, false);
        const input = document.getElementById('scheduleDate');
        if (input) input.value = today;
        renderScheduleTab();
    } else {
        showToast('На текущий месяц график не загружен', 'warning');
    }
}

function deleteScheduleMonth() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    if (!confirm(`Удалить загруженный график за ${schedule.title}?`)) return;
    delete monthlySchedules[schedule.key];
    currentScheduleKey = Object.keys(monthlySchedules).sort().reverse()[0] || null;
    saveData();
    initScheduleUI();
    renderDashboardScheduleSummary();
    showToast('График удалён', 'warning');
}

function createShiftFromSchedule() {
    const schedule = getCurrentSchedule();
    const date = getScheduleSelectedDate();
    if (!schedule || !date) {
        showToast('Сначала загрузите график и выберите дату', 'warning');
        return;
    }
    const entries = getScheduleEntriesForSelectedDay().filter(e => e.dayInfo.working);
    if (!entries.length) {
        showToast('В выбранный день нет рабочих смен', 'warning');
        return;
    }

    const name = 'По графику';
    const shiftId = `${date}_${name}`;
    if (shifts[shiftId] && !confirm('Смена «По графику» на эту дату уже есть. Заменить её?')) return;

    shifts[shiftId] = {
        id: shiftId,
        date,
        name,
        people: entries.map((entry, i) => {
            const base = findBaseEmployeeByScheduleName(entry.fullName);
            return {
                id: base?.id || `schedule_${schedule.key}_${entry.sourceRow}_${i}`,
                fullName: entry.fullName,
                position: entry.position,
                phone: base?.phone || '',
                time: entry.dayInfo.time || (entry.dayInfo.raw ? `${entry.dayInfo.raw} ч.` : ''),
                present: false
            };
        })
    };
    currentShiftId = shiftId;
    saveData();
    renderShiftsList();
    renderShift();
    renderShiftDisplay();
    populateCopyFromSelect();
    showToast(`✅ Смена создана: ${entries.length} сотрудников`, 'success');
    switchTab('shifts');
}

function exportScheduleDay() {
    const schedule = getCurrentSchedule();
    const date = getScheduleSelectedDate();
    if (!schedule || !date) { showToast('Нет данных для экспорта', 'warning'); return; }
    const entries = getScheduleEntriesForSelectedDay().filter(e => e.dayInfo.working);
    if (!entries.length) { showToast('В этот день нет рабочих смен', 'warning'); return; }

    const data = [
        ['СПИСОК СОТРУДНИКОВ ПО ГРАФИКУ'],
        [`Дата: ${date}`],
        [],
        ['№', 'ФИО', 'Должность', 'Телефон', 'Значение в графике', 'Время']
    ];
    let n = 0;
    groupScheduleEmployees(schedule, entries).forEach(group => {
        data.push([]);
        data.push([group.position.toUpperCase()]);
        group.employees
            .sort((a, b) => (a.dayInfo.time || '').localeCompare(b.dayInfo.time || '') || a.fullName.localeCompare(b.fullName, 'ru'))
            .forEach(entry => {
                n++;
                const base = findBaseEmployeeByScheduleName(entry.fullName);
                data.push([n, entry.fullName, entry.position, base?.phone || '', entry.dayInfo.raw || '', entry.dayInfo.time || 'Время не определено']);
            });
    });
    const outWb = XLSX.utils.book_new();
    const outWs = XLSX.utils.aoa_to_sheet(data);
    outWs['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(outWb, outWs, 'По графику');
    XLSX.writeFile(outWb, `график_${date}.xlsx`);
    showToast('📥 Список Excel скачан', 'success');
}

function printScheduleDay() {
    const tab = document.getElementById('tab-schedule');
    if (!tab) return;
    document.body.classList.add('print-schedule-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('print-schedule-mode'), 300);
}

function renderDashboardScheduleSummary() {
    const container = document.getElementById('dashboardScheduleSummary');
    if (!container) return;
    const today = toLocalISODate();
    const key = today.slice(0, 7);
    const schedule = monthlySchedules[key];
    if (!schedule) {
        container.innerHTML = '<span class="empty-text">На текущий месяц график ещё не создан. Откройте раздел «График» и создайте его прямо на сайте.</span>';
        return;
    }
    const day = Number(today.slice(8, 10));
    const entries = schedule.employees.map(emp => ({ ...emp, dayInfo: emp.days[day] || { working: false } }));
    const working = entries.filter(e => e.dayInfo.working);
    const now = working.filter(e => isEntryActiveNow(e, today));
    const knownTime = working.filter(e => e.dayInfo.time).length;
    container.innerHTML = `<div class="dashboard-schedule-kpis">
        <div><span>Работают сегодня</span><strong>${working.length}</strong></div>
        <div><span>Сейчас по графику</span><strong>${now.length}</strong></div>
        <div><span>Время распознано</span><strong>${knownTime}/${working.length}</strong></div>
    </div>
    <div class="dashboard-schedule-actions">
        <span>${escapeHtml(schedule.title)} · ${day} число</span>
        <button class="btn btn-primary btn-sm" onclick="switchTab('schedule');selectTodayInSchedule()"><i class="fa-solid fa-list-check"></i> Показать список</button>
    </div>`;
}

// ================================================================
//  СТАТИСТИКА
// ================================================================
function updateStats() {
    document.getElementById('statEmployees').textContent = employees.length;
    document.getElementById('statShifts').textContent = Object.keys(shifts).length;

    let present = 0, absent = 0;
    Object.keys(shifts).forEach(key => {
        const people = shifts[key].people || [];
        present += people.filter(p => p.present).length;
        absent += people.filter(p => !p.present).length;
    });

    document.getElementById('statPresent').textContent = present;
    document.getElementById('statAbsent').textContent = absent;
    updateNavBadges();
}

function renderRecentShifts() {
    const container = document.getElementById('recentShifts');
    const ids = Object.keys(shifts);
    if (ids.length === 0) {
        container.innerHTML = '<span class="empty-text">Нет созданных смен</span>';
        return;
    }
    ids.sort((a, b) => (shifts[b].date || '').localeCompare(shifts[a].date || ''));
    const recent = ids.slice(0, 5);
    container.innerHTML = recent.map(id => {
        const s = shifts[id];
        return `<div class="recent-item" onclick="loadShift('${id}');switchTab('shifts')">
            <span class="date">📅 ${s.date}</span>
            <span>${s.name}</span>
            <span class="count">${s.people.length} чел.</span>
        </div>`;
    }).join('');
}

// ================================================================
//  ЭКСПОРТ
// ================================================================
function exportExcel() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'error'); return; }
    const shift = shifts[currentShiftId];
    if (shift.people.length === 0) { showToast('Нет данных для экспорта!', 'error'); return; }

    const data = [
        ['СПИСОК ВЫХОДА СОТРУДНИКОВ НА РАБОТУ', '', '', '', '', '', ''],
        [`Дата: ${shift.date}, Смена: ${shift.name}`, '', '', '', '', '', ''],
        [],
        ['№', 'ФИО', 'Должность', 'Телефон', 'Родственники', 'Время', 'Статус']
    ];

    shift.people.forEach((p, i) => {
        data.push([i + 1, p.fullName, p.position || '', p.phone, getRelativesString(p.id) || '', p.time || '', p.present ? 'На месте' : 'Отсутствует']);
    });

    const present = shift.people.filter(p => p.present).length;
    data.push([]);
    data.push([`Всего: ${shift.people.length}, На месте: ${present}, Отсутствуют: ${shift.people.length - present}`]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Смена');
    XLSX.writeFile(wb, `табель_${shift.date}_${shift.name}.xlsx`);
    showToast('📥 Excel скачан!', 'success');
}

function printShift() {
    if (!currentShiftId || !shifts[currentShiftId]) { showToast('Нет активной смены!', 'warning'); return; }
    window.print();
}

// ================================================================
//  БЭКАП
// ================================================================
function downloadBackup() {
    const data = { version: '2.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evacuation_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Бэкап скачан', 'success');
}

function restoreBackup() {
    const input = document.getElementById('backupFileInput');
    if (!input.files.length) { showToast('Выберите файл!', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.employees || !data.positions || !data.shifts) {
                showToast('Неверный формат файла!', 'error');
                return;
            }
            if (!confirm('Восстановить данные из бэкапа? Текущие данные будут заменены.')) return;

            employees = data.employees || [];
            positions = data.positions || {};
            shifts = data.shifts || {};
            monthlySchedules = data.monthlySchedules || {};

            saveData();
            populatePositionSelects();
            renderEmployees();
            renderPositions();
            renderShiftsList();
            renderRecentShifts();
            updateStats();
            initScheduleUI();
            renderDashboardScheduleSummary();

            if (Object.keys(shifts).length > 0) {
                currentShiftId = Object.keys(shifts)[0];
                renderShift();
                renderShiftDisplay();
            }

            input.value = '';
            showToast('✅ Данные восстановлены', 'success');
        } catch (error) {
            showToast('Ошибка чтения файла: ' + error.message, 'error');
        }
    };
    reader.readAsText(input.files[0]);
}

function exportCsv() {
    if (employees.length === 0) { showToast('Нет данных для экспорта', 'warning'); return; }
    let csv = 'ФИО,Должность,Телефон,Родственник,Телефон родственника\n';
    employees.forEach(e => {
        const rel = e.relatives.length > 0 ? e.relatives[0] : { name: '', phone: '' };
        csv += `"${e.fullName}","${e.position || ''}","${e.phone}","${rel.name}","${rel.phone}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 CSV скачан', 'success');
}

function exportJson() {
    const data = { version: '2.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 JSON скачан', 'success');
}

// ================================================================
//  ЗАПУСК
// ================================================================
document.addEventListener('DOMContentLoaded', init);
// ================================================================
//  SCHEDULE PRO V6 — advanced editor
// ================================================================
const SCHEDULE_TEMPLATES_KEY_V6 = 'app_schedule_cycle_templates_v6';
let scheduleTemplatesV6 = {};
let scheduleHistoryV6 = {};
let scheduleClipboardV6 = null;
let editingShiftTypesV6 = null;
let removedShiftTypeIdsV6 = new Set();
let scheduleValidationIssuesV6 = [];

function v6Clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function v6ScheduleEmployeeKey(emp) {
    return emp?.baseId || normalizeEmployeeNameForMatch(emp?.fullName || '');
}

function v6DefaultSettings() {
    return {
        defaultMonthlyHours: 176,
        absenceReductionHours: 11,
        maxConsecutive: 4,
        minOffBlock: 2,
        maxOffBlock: 4,
        overtimeTolerance: 11,
        absenceReduceCodes: ['ОТ', 'Б', 'ДО']
    };
}

function v6MakeShiftId(time) {
    const cleaned = String(time || '').replace(/[^0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `shift_${cleaned || generateId()}`;
}

function v6IsNightTime(time) {
    const range = parseTimeRange(time);
    if (!range) return false;
    return range.start >= 18 * 60 || range.end <= range.start;
}

function v6BuildShiftType(time, sample = {}) {
    const parsed = String(time || '').split('-');
    const start = parsed[0] || '08:00';
    const end = parsed[1] || '20:00';
    const code = sample.code || sample.raw || getWorkCodeForTime(time);
    return {
        id: sample.id || v6MakeShiftId(time),
        code: String(code || '').trim() || getWorkCodeForTime(time),
        name: sample.name || (v6IsNightTime(time) ? 'Ночная смена' : 'Рабочая смена'),
        start,
        end,
        time,
        paidHours: Number.isFinite(Number(sample.paidHours)) ? Number(sample.paidHours) : getPaidHoursForTime(time),
        color: normalizeHexColor(sample.color || getColorForShiftTime(time))
    };
}

function v6EnsureSchedule(schedule) {
    if (!schedule) return null;
    schedule.settings = { ...v6DefaultSettings(), ...(schedule.settings || {}) };
    schedule.positionNorms = schedule.positionNorms || {};
    schedule.employeeTargets = schedule.employeeTargets || {};
    schedule.collapsedPositions = schedule.collapsedPositions || {};
    schedule.colorSettings = schedule.colorSettings || { work: {}, absence: {} };
    schedule.colorSettings.work = schedule.colorSettings.work || {};
    schedule.colorSettings.absence = schedule.colorSettings.absence || {};

    const sources = new Map();
    const hasExplicitShiftTypes = Array.isArray(schedule.shiftTypes) && schedule.shiftTypes.length > 0;
    if (hasExplicitShiftTypes) {
        schedule.shiftTypes.forEach(type => {
            const time = type.time || `${type.start || '08:00'}-${type.end || '20:00'}`;
            if (parseTimeRange(time)) sources.set(time, { ...type, time });
        });
    } else {
        DEFAULT_MANUAL_SHIFTS.forEach(time => sources.set(time, { time, color: getColorForShiftTime(time) }));
        Object.values(positions || {}).flat().filter(t => parseTimeRange(t)).forEach(time => {
            if (!sources.has(time)) sources.set(time, { time, color: getColorForShiftTime(time) });
        });
    }
    Object.entries(schedule.legend || {}).forEach(([color, time]) => {
        if (parseTimeRange(time) && (!hasExplicitShiftTypes || !sources.has(time))) sources.set(time, { ...(sources.get(time) || {}), time, color });
    });
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (info?.working && info.time && parseTimeRange(info.time)) {
                const prev = sources.get(info.time) || {};
                sources.set(info.time, {
                    ...prev,
                    time: info.time,
                    raw: prev.raw || info.raw,
                    color: prev.color || info.color,
                    paidHours: Number.isFinite(Number(info.paidHours)) ? Number(info.paidHours) : prev.paidHours,
                    id: info.shiftId || prev.id,
                    name: info.shiftName || prev.name
                });
            }
        });
    });

    const existing = new Map((schedule.shiftTypes || []).map(type => [type.id, { ...type }]));
    const existingByTime = new Map((schedule.shiftTypes || []).map(type => [type.time, { ...type }]));
    const shiftTypes = [];
    sources.forEach((sample, time) => {
        const old = existingByTime.get(time) || (sample.id ? existing.get(sample.id) : null) || {};
        const type = v6BuildShiftType(time, { ...sample, ...old });
        type.id = old.id || sample.id || v6MakeShiftId(time);
        type.code = old.code || sample.raw || getWorkCodeForTime(time);
        type.name = old.name || sample.name || (v6IsNightTime(time) ? 'Ночная смена' : 'Рабочая смена');
        type.paidHours = Number.isFinite(Number(old.paidHours)) ? Number(old.paidHours) : (Number.isFinite(Number(sample.paidHours)) ? Number(sample.paidHours) : getPaidHoursForTime(time));
        type.color = normalizeHexColor(old.color || sample.color || schedule.colorSettings.work?.[time] || getColorForShiftTime(time));
        shiftTypes.push(type);
    });
    // Keep explicitly created custom types even if not yet used.
    (schedule.shiftTypes || []).forEach(type => {
        if (!shiftTypes.some(item => item.id === type.id)) {
            const time = type.time || `${type.start}-${type.end}`;
            if (parseTimeRange(time)) shiftTypes.push(v6BuildShiftType(time, type));
        }
    });
    schedule.shiftTypes = shiftTypes;

    schedule.shiftTypes.forEach(type => {
        schedule.colorSettings.work[type.time] = normalizeHexColor(type.color);
    });
    SCHEDULE_ABSENCE_OPTIONS.forEach(option => {
        if (!schedule.colorSettings.absence[option.raw]) schedule.colorSettings.absence[option.raw] = normalizeHexColor(option.color);
    });

    const typeByTime = new Map(schedule.shiftTypes.map(type => [type.time, type]));
    const typeById = new Map(schedule.shiftTypes.map(type => [type.id, type]));
    (schedule.employees || []).forEach(emp => {
        emp.days = emp.days || {};
        for (let d = 1; d <= schedule.dayCount; d++) {
            if (!emp.days[d]) emp.days[d] = emptyScheduleDayInfo();
            const info = emp.days[d];
            if (info?.working) {
                let type = info.shiftId ? typeById.get(info.shiftId) : null;
                if (!type && info.time) type = typeByTime.get(info.time);
                if (type) {
                    info.shiftId = type.id;
                    info.shiftName = type.name;
                    info.time = type.time;
                    info.color = type.color;
                    info.paidHours = type.paidHours;
                    if (!info.raw || info.raw === getWorkCodeForTime(info.time)) info.raw = type.code;
                }
            }
        }
    });

    getSchedulePositionOrder(schedule).forEach(pos => {
        if (!schedule.positionNorms[pos]) schedule.positionNorms[pos] = { totalMin: 0, dayMin: 0, nightMin: 0 };
    });
    return schedule;
}

function v6GetShiftTypes(schedule = getCurrentSchedule()) {
    v6EnsureSchedule(schedule);
    return schedule?.shiftTypes || [];
}

function v6FindShiftType(schedule, value) {
    if (!schedule || !value) return null;
    v6EnsureSchedule(schedule);
    return schedule.shiftTypes.find(type => type.id === value || type.time === value || type.code === value) || null;
}

// Override: shift color follows editable shift definition first.
function getScheduleShiftColor(schedule, time) {
    if (!schedule) return normalizeHexColor(getColorForShiftTime(time));
    const direct = (schedule.shiftTypes || []).find(type => type.time === time);
    if (direct?.color) return normalizeHexColor(direct.color);
    const color = schedule.colorSettings?.work?.[time];
    return normalizeHexColor(color || getColorForShiftTime(time));
}

// Override: paid hours can be explicitly edited in shift settings.
function getScheduleWorkHours(info) {
    if (!info || !info.working) return 0;
    if (Number.isFinite(Number(info.paidHours))) return Number(info.paidHours);
    if (info.time) return getPaidHoursForTime(info.time);
    const numeric = Number(String(info.raw || '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
}

function v6PushHistory(schedule) {
    if (!schedule) return;
    const key = schedule.key;
    if (!scheduleHistoryV6[key]) scheduleHistoryV6[key] = { undo: [], redo: [] };
    const history = scheduleHistoryV6[key];
    history.undo.push(v6Clone(schedule));
    if (history.undo.length > 50) history.undo.shift();
    history.redo = [];
    v6UpdateHistoryButtons();
}

function v6UndoSchedule() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const history = scheduleHistoryV6[schedule.key];
    if (!history?.undo?.length) { showToast('Нет действий для отмены', 'info'); return; }
    history.redo.push(v6Clone(schedule));
    const previous = history.undo.pop();
    monthlySchedules[schedule.key] = previous;
    currentScheduleKey = previous.key;
    saveData();
    renderScheduleTab();
    v6UpdateHistoryButtons();
    showToast('↩️ Последнее действие отменено', 'info');
}

function v6RedoSchedule() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const history = scheduleHistoryV6[schedule.key];
    if (!history?.redo?.length) { showToast('Нет действий для возврата', 'info'); return; }
    history.undo.push(v6Clone(schedule));
    const next = history.redo.pop();
    monthlySchedules[schedule.key] = next;
    currentScheduleKey = next.key;
    saveData();
    renderScheduleTab();
    v6UpdateHistoryButtons();
    showToast('↪️ Действие возвращено', 'info');
}

function v6UpdateHistoryButtons() {
    const schedule = getCurrentSchedule();
    const history = schedule ? scheduleHistoryV6[schedule.key] : null;
    const undo = document.getElementById('scheduleUndoBtn');
    const redo = document.getElementById('scheduleRedoBtn');
    if (undo) undo.disabled = !history?.undo?.length;
    if (redo) redo.disabled = !history?.redo?.length;
}

function v6AfterMutation(schedule, message = '') {
    if (!schedule) return;
    schedule.updatedAt = new Date().toISOString();
    schedule.sourceName = schedule.createdManually ? 'Создано на сайте' : (schedule.sourceName || 'Excel');
    v6EnsureSchedule(schedule);
    saveData();
    renderScheduleLegend(schedule);
    populateScheduleBulkShiftSelect(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    renderDashboardScheduleSummary();
    v6RenderCoverageSummary(schedule);
    v6UpdateHistoryButtons();
    const panel = document.getElementById('scheduleValidationPanel');
    if (panel) panel.style.display = 'none';
    if (message) showToast(message, 'success');
}

function v6AdjustedTargetHours(schedule, emp) {
    v6EnsureSchedule(schedule);
    const key = v6ScheduleEmployeeKey(emp);
    const base = Number(schedule.employeeTargets?.[key] ?? schedule.settings.defaultMonthlyHours ?? 176);
    const reduction = Number(schedule.settings.absenceReductionHours || 0);
    const codes = new Set(schedule.settings.absenceReduceCodes || ['ОТ', 'Б', 'ДО']);
    let days = 0;
    for (let d = 1; d <= schedule.dayCount; d++) {
        const info = emp.days?.[d];
        if (info && !info.working && codes.has(info.raw)) days++;
    }
    return Math.max(0, base - days * reduction);
}

function editScheduleEmployeeTarget(employeeIndex) {
    const schedule = getCurrentSchedule();
    const emp = schedule?.employees?.[employeeIndex];
    if (!schedule || !emp) return;
    const key = v6ScheduleEmployeeKey(emp);
    const current = Number(schedule.employeeTargets?.[key] ?? schedule.settings.defaultMonthlyHours ?? 176);
    const value = window.prompt(`Базовая норма часов для ${emp.fullName}:`, String(current));
    if (value === null) return;
    const num = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) { showToast('Введите корректное число часов', 'warning'); return; }
    v6PushHistory(schedule);
    schedule.employeeTargets[key] = num;
    v6AfterMutation(schedule, '✅ Норма часов обновлена');
}

function toggleSchedulePosition(position) {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    v6EnsureSchedule(schedule);
    schedule.collapsedPositions[position] = !schedule.collapsedPositions[position];
    saveData();
    renderScheduleMonthTable(schedule);
}

function v6CoverageForDay(schedule, day) {
    v6EnsureSchedule(schedule);
    const groups = groupScheduleEmployees(schedule);
    return groups.map(group => {
        const norm = schedule.positionNorms[group.position] || { totalMin: 0, dayMin: 0, nightMin: 0 };
        const work = group.employees.filter(emp => emp.days?.[day]?.working);
        const night = work.filter(emp => v6IsNightTime(emp.days[day]?.time)).length;
        const dayCount = work.length - night;
        const total = work.length;
        const violations = [];
        if (Number(norm.totalMin) > 0 && total < Number(norm.totalMin)) violations.push(`всего ${total}/${norm.totalMin}`);
        if (Number(norm.dayMin) > 0 && dayCount < Number(norm.dayMin)) violations.push(`день ${dayCount}/${norm.dayMin}`);
        if (Number(norm.nightMin) > 0 && night < Number(norm.nightMin)) violations.push(`ночь ${night}/${norm.nightMin}`);
        return { position: group.position, total, day: dayCount, night, norm, violations };
    });
}

function v6DayCoverageBadge(schedule, day) {
    const coverage = v6CoverageForDay(schedule, day);
    const configured = coverage.some(item => Number(item.norm.totalMin) > 0 || Number(item.norm.dayMin) > 0 || Number(item.norm.nightMin) > 0);
    if (!configured) return { cls: 'none', text: '•', title: 'Нормативы не заданы' };
    const bad = coverage.filter(item => item.violations.length);
    if (!bad.length) return { cls: 'ok', text: '✓', title: 'Все нормативы выполнены' };
    return {
        cls: 'bad',
        text: String(bad.length),
        title: bad.map(item => `${item.position}: ${item.violations.join(', ')}`).join('; ')
    };
}

function v6RenderCoverageSummary(schedule) {
    const el = document.getElementById('scheduleCoverageSummary');
    if (!el) return;
    if (!schedule) { el.innerHTML = ''; return; }
    let day = getScheduleDayNumber();
    if (!day || day > schedule.dayCount) day = 1;
    const coverage = v6CoverageForDay(schedule, day);
    el.innerHTML = coverage.map(item => {
        const normSet = Number(item.norm.totalMin) || Number(item.norm.dayMin) || Number(item.norm.nightMin);
        const bad = item.violations.length > 0;
        return `<div class="schedule-coverage-card">
            <strong>${escapeHtml(item.position)} · ${day} число</strong>
            <div class="schedule-coverage-line"><span>Всего</span><span class="schedule-coverage-value ${bad && Number(item.norm.totalMin) > item.total ? 'bad' : 'good'}">${item.total}${Number(item.norm.totalMin) ? ` / ${item.norm.totalMin}` : ''}</span></div>
            <div class="schedule-coverage-line"><span>День</span><span class="schedule-coverage-value ${bad && Number(item.norm.dayMin) > item.day ? 'bad' : ''}">${item.day}${Number(item.norm.dayMin) ? ` / ${item.norm.dayMin}` : ''}</span></div>
            <div class="schedule-coverage-line"><span>Ночь</span><span class="schedule-coverage-value ${bad && Number(item.norm.nightMin) > item.night ? 'bad' : ''}">${item.night}${Number(item.norm.nightMin) ? ` / ${item.norm.nightMin}` : ''}</span></div>
            ${!normSet ? '<div class="schedule-coverage-line"><span>Норматив</span><span>не задан</span></div>' : ''}
        </div>`;
    }).join('');
}

// Override monthly table: day health badges, collapsible positions, target hours and comments.
function renderScheduleMonthTable(schedule) {
    const wrap = document.getElementById('scheduleMonthTableWrap');
    if (!wrap) return;
    if (!schedule) {
        selectedScheduleCells.clear();
        wrap.innerHTML = '<div class="schedule-editor-empty"><i class="fa-solid fa-table-cells-large"></i><strong>График ещё не создан</strong><span>Выберите месяц выше и нажмите «Создать график».</span></div>';
        updateScheduleSelectionUI();
        v6RenderCoverageSummary(null);
        return;
    }
    v6EnsureSchedule(schedule);

    const days = Array.from({ length: schedule.dayCount }, (_, i) => i + 1);
    const employeeList = schedule.employees.map((emp, index) => ({ ...emp, _scheduleIndex: index }));
    const groups = groupScheduleEmployees(schedule, employeeList);
    const dayHeaders = days.map(d => {
        const info = getScheduleDayHeaderInfo(schedule, d);
        const badge = v6DayCoverageBadge(schedule, d);
        return `<th class="schedule-day-head ${info.weekend ? 'weekend' : ''}" onclick="openScheduleDayDetails(${d})" title="${escapeHtml(badge.title)}"><span>${d}</span><small>${info.weekday}</small><b class="coverage-badge ${badge.cls}">${badge.text}</b></th>`;
    }).join('');

    const header = `<tr>
        <th class="schedule-sticky-name schedule-name-head">ФИО</th>
        ${dayHeaders}
        <th class="schedule-total-head">Часы</th>
        <th class="schedule-total-head">Норма</th>
        <th class="schedule-total-head">Δ</th>
        <th class="schedule-total-head">Смены</th>
    </tr>`;

    let visualRow = 0;
    const body = groups.map(group => {
        const collapsed = !!schedule.collapsedPositions[group.position];
        const groupHours = group.employees.reduce((sum, emp) => sum + days.reduce((s, d) => s + getScheduleWorkHours(emp.days[d]), 0), 0);
        const groupTarget = group.employees.reduce((sum, emp) => sum + v6AdjustedTargetHours(schedule, emp), 0);
        const groupShifts = group.employees.reduce((sum, emp) => sum + days.filter(d => emp.days[d]?.working).length, 0);
        const groupDelta = groupHours - groupTarget;
        const groupHeader = `<tr class="schedule-position-row ${collapsed ? 'collapsed' : ''}" onclick="toggleSchedulePosition('${String(group.position).replace(/'/g, "\\'")}')">
            <td colspan="${schedule.dayCount + 5}">
                <div class="schedule-position-title">
                    <span><b class="collapse-icon"><i class="fa-solid fa-chevron-down"></i></b><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)}</span>
                    <small>${group.employees.length} чел. · ${formatScheduleHours(groupHours)} / ${formatScheduleHours(groupTarget)} ч. · Δ ${groupDelta >= 0 ? '+' : ''}${formatScheduleHours(groupDelta)} · ${groupShifts} смен</small>
                </div>
            </td>
        </tr>`;
        if (collapsed) {
            visualRow += group.employees.length;
            return groupHeader;
        }

        const rows = group.employees.map(emp => {
            const rowIndex = visualRow++;
            const totalHours = days.reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
            const target = v6AdjustedTargetHours(schedule, emp);
            const delta = totalHours - target;
            const totalShifts = days.filter(d => emp.days[d]?.working).length;
            const deltaClass = Math.abs(delta) < 0.01 ? 'hours-diff-good' : (Math.abs(delta) <= Number(schedule.settings.overtimeTolerance || 11) ? 'hours-diff-warn' : 'hours-diff-bad');
            const cells = days.map(d => {
                const info = emp.days[d] || emptyScheduleDayInfo();
                const dateInfo = getScheduleDayHeaderInfo(schedule, d);
                const style = info.color ? ` style="--cell-color:#${normalizeHexColor(info.color)}"` : '';
                const cls = info.working ? 'm-work' : (info.raw ? 'm-other' : 'm-off');
                const comment = String(info.comment || '').trim();
                const title = [info.shiftName || info.status, info.time, comment ? `Комментарий: ${comment}` : ''].filter(Boolean).join(' · ') || 'Пустая ячейка';
                const key = getScheduleCellKey(emp._scheduleIndex, d);
                const selectedClass = selectedScheduleCells.has(key) ? 'selected' : '';
                return `<td class="schedule-month-cell schedule-cell-editable ${cls} ${dateInfo.weekend ? 'weekend' : ''} ${selectedClass} ${comment ? 'schedule-cell-comment-mark' : ''}"${style}
                    data-employee-index="${emp._scheduleIndex}" data-day="${d}" data-row="${rowIndex}"
                    title="${escapeHtml(title)} — протяните мышкой для выделения, двойной клик для редактирования"
                    onmousedown="startScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    onmouseenter="extendScheduleCellSelection(event, ${emp._scheduleIndex}, ${d}, ${rowIndex})"
                    ondblclick="openScheduleCellEditor(${emp._scheduleIndex}, ${d})">${escapeHtml(info.raw || '')}</td>`;
            }).join('');
            return `<tr class="schedule-employee-row" data-employee-index="${emp._scheduleIndex}">
                <td class="schedule-sticky-name schedule-employee-name"><strong>${escapeHtml(emp.fullName)}</strong></td>
                ${cells}
                <td class="schedule-total-cell">${formatScheduleHours(totalHours)}</td>
                <td class="schedule-total-cell schedule-target-cell" ondblclick="editScheduleEmployeeTarget(${emp._scheduleIndex})" title="Двойной клик — изменить базовую норму">${formatScheduleHours(target)}<small>двойной клик</small></td>
                <td class="schedule-total-cell ${deltaClass}">${delta >= 0 ? '+' : ''}${formatScheduleHours(delta)}</td>
                <td class="schedule-total-cell">${totalShifts}</td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');

    wrap.innerHTML = `<table class="schedule-month-table schedule-editor-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    updateScheduleSelectionUI();
    v6RenderCoverageSummary(schedule);
}

function populateScheduleBulkShiftSelect(schedule) {
    const select = document.getElementById('scheduleBulkShiftSelect');
    if (!select) return;
    const current = select.value;
    const types = v6GetShiftTypes(schedule);
    select.innerHTML = '<option value="">Выберите смену…</option>' + types.map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.code)} · ${escapeHtml(type.name)} · ${escapeHtml(type.time)}</option>`).join('');
    if (current && types.some(type => type.id === current)) select.value = current;
    else {
        const preferred = types.find(type => type.time === '11:00-23:00') || types[0];
        if (preferred) select.value = preferred.id;
    }
}

function v6ApplyShiftToContexts(contexts, value) {
    if (!contexts.length) return false;
    const schedule = contexts[0].schedule;
    v6EnsureSchedule(schedule);
    let type = v6FindShiftType(schedule, value);
    if (!type && parseTimeRange(value)) {
        type = v6BuildShiftType(value, { color: getScheduleShiftColor(schedule, value) });
        if (!schedule.shiftTypes.some(item => item.id === type.id)) schedule.shiftTypes.push(type);
    }
    if (!type) return false;
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = {
            raw: type.code,
            color: type.color,
            kind: 'working',
            status: type.name || (v6IsNightTime(type.time) ? 'Ночная смена' : 'Рабочая смена'),
            working: true,
            time: type.time,
            shiftId: type.id,
            shiftName: type.name,
            paidHours: Number(type.paidHours || 0),
            comment
        };
    });
    schedule.colorSettings.work[type.time] = type.color;
    schedule.legend = schedule.legend || {};
    Object.keys(schedule.legend).forEach(color => { if (schedule.legend[color] === type.time) delete schedule.legend[color]; });
    schedule.legend[type.color] = type.time;
    return true;
}

function applyScheduleWorkToContexts(contexts, value) {
    return v6ApplyShiftToContexts(contexts, value);
}

function applyScheduleAbsenceToContexts(contexts, option) {
    if (!contexts.length || !option) return false;
    const schedule = contexts[0].schedule;
    v6EnsureSchedule(schedule);
    const color = getScheduleAbsenceColor(schedule, option.raw);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = {
            raw: option.raw,
            color,
            kind: 'other',
            status: option.status,
            working: false,
            time: '',
            comment
        };
    });
    schedule.colorSettings.absence[option.raw] = color;
    return true;
}

function applyScheduleSelectionWork(value) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    if (!v6ApplyShiftToContexts(contexts, value)) { scheduleHistoryV6[schedule.key].undo.pop(); return; }
    const type = v6FindShiftType(schedule, value);
    v6AfterMutation(schedule, `✅ ${type?.name || 'Смена'}: обновлено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function applyScheduleSelectionAbsence(raw) {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    if (!option) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    applyScheduleAbsenceToContexts(contexts, option);
    v6AfterMutation(schedule, `✅ ${option.status}: обновлено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function clearSelectedScheduleCells() {
    const contexts = getSelectedScheduleContexts();
    if (!contexts.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = { ...emptyScheduleDayInfo(), comment };
    });
    v6AfterMutation(schedule, `✅ Очищено ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
}

function persistScheduleBulkEdit(schedule, count, label) {
    v6AfterMutation(schedule, `✅ ${label}: обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}`);
}

function persistScheduleCellEdit(schedule, count = 1) {
    closeScheduleCellEditor();
    v6AfterMutation(schedule, count > 1 ? `✅ Обновлено ${count} ${pluralizeRu(count, 'ячейка', 'ячейки', 'ячеек')}` : '');
}

// Override detailed cell editor to use editable shift presets and comments.
function openScheduleCellsEditor(cells) {
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) return;
    v6EnsureSchedule(schedule);
    const validCells = cells.filter(cell => schedule.employees[cell.employeeIndex] && cell.day >= 1 && cell.day <= schedule.dayCount);
    if (!validCells.length) return;
    editingScheduleCell = { scheduleKey: schedule.key, cells: validCells };
    const contexts = getEditingScheduleContexts();
    const subtitle = document.getElementById('scheduleCellModalSubtitle');
    if (subtitle) {
        if (contexts.length === 1) {
            const ctx = contexts[0];
            subtitle.innerHTML = `<strong>${escapeHtml(ctx.employee.fullName)}</strong><span>${escapeHtml(ctx.employee.position || 'Без должности')} · ${ctx.day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}</span>`;
        } else {
            const employeeCount = new Set(contexts.map(ctx => ctx.employeeIndex)).size;
            const days = [...new Set(contexts.map(ctx => ctx.day))].sort((a, b) => a - b);
            const dayText = days.length === 1 ? `${days[0]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}` : `${days[0]}–${days[days.length - 1]} ${RU_MONTH_NAMES[schedule.month].toLowerCase()}`;
            subtitle.innerHTML = `<strong>${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')} выбрано</strong><span>${employeeCount} ${pluralizeRu(employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${dayText}</span>`;
        }
    }

    const currentInfos = contexts.map(ctx => ctx.employee.days[ctx.day] || emptyScheduleDayInfo());
    const workOptions = document.getElementById('scheduleCellWorkOptions');
    if (workOptions) {
        workOptions.innerHTML = v6GetShiftTypes(schedule).map(type => {
            const active = currentInfos.length > 0 && currentInfos.every(info => info.working && (info.shiftId === type.id || (!info.shiftId && info.time === type.time)));
            return `<button class="schedule-cell-option work ${active ? 'active' : ''}" onclick="setEditingScheduleWork('${type.id}')">
                <i style="background:#${type.color}"></i>
                <span><strong>${escapeHtml(type.code)}</strong><small>${escapeHtml(type.name)} · ${escapeHtml(type.time)} · ${formatScheduleHours(type.paidHours)} ч.</small></span>
            </button>`;
        }).join('');
    }

    const absenceOptions = document.getElementById('scheduleCellAbsenceOptions');
    if (absenceOptions) {
        absenceOptions.innerHTML = SCHEDULE_ABSENCE_OPTIONS.map((option, index) => {
            const active = currentInfos.length > 0 && currentInfos.every(info => !info.working && info.raw === option.raw);
            return `<button class="schedule-cell-option absence-option ${active ? 'active' : ''}" onclick="setEditingScheduleAbsence(${index})">
                <i style="background:#${getScheduleAbsenceColor(schedule, option.raw)}"></i>
                <span><strong>${escapeHtml(option.raw)}</strong><small>${escapeHtml(option.status)}</small></span>
            </button>`;
        }).join('');
    }

    const sameTime = currentInfos.length > 0 && currentInfos.every(info => info.time && info.time === currentInfos[0].time) ? currentInfos[0].time : '';
    if (sameTime) {
        const parsed = sameTime.split('-');
        if (parsed.length === 2) {
            const start = document.getElementById('scheduleCustomStart');
            const end = document.getElementById('scheduleCustomEnd');
            if (start) start.value = parsed[0];
            if (end) end.value = parsed[1];
        }
    }
    const commentBox = document.getElementById('scheduleCellComment');
    if (commentBox) {
        const comments = currentInfos.map(info => String(info.comment || ''));
        commentBox.value = comments.length && comments.every(c => c === comments[0]) ? comments[0] : '';
        commentBox.placeholder = comments.length > 1 && new Set(comments).size > 1 ? 'У выбранных ячеек разные комментарии. Введите новый, чтобы заменить во всех.' : 'Например: замена сотрудника, согласовано с руководителем…';
    }
    document.getElementById('scheduleCellModal')?.classList.add('active');
}

function setEditingScheduleWork(value) {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    if (!v6ApplyShiftToContexts(contexts, value)) { scheduleHistoryV6[schedule.key].undo.pop(); return; }
    persistScheduleCellEdit(schedule, contexts.length);
}

function setEditingScheduleAbsence(optionIndex) {
    const contexts = getEditingScheduleContexts();
    const option = SCHEDULE_ABSENCE_OPTIONS[optionIndex];
    if (!contexts.length || !option) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    applyScheduleAbsenceToContexts(contexts, option);
    persistScheduleCellEdit(schedule, contexts.length);
}

function clearEditingScheduleCell() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        const comment = ctx.employee.days?.[ctx.day]?.comment || '';
        ctx.employee.days[ctx.day] = { ...emptyScheduleDayInfo(), comment };
    });
    persistScheduleCellEdit(schedule, contexts.length);
}

function applyCustomScheduleTime() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    const start = document.getElementById('scheduleCustomStart')?.value;
    const end = document.getElementById('scheduleCustomEnd')?.value;
    if (!start || !end) { showToast('Укажите начало и окончание смены', 'warning'); return; }
    const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
    let type = v6FindShiftType(schedule, time);
    if (!type) {
        type = v6BuildShiftType(time, { name: 'Своя смена', color: getColorForShiftTime(time) });
        let baseId = type.id;
        let n = 2;
        while (schedule.shiftTypes.some(item => item.id === type.id)) type.id = `${baseId}_${n++}`;
        schedule.shiftTypes.push(type);
    }
    v6PushHistory(schedule);
    v6ApplyShiftToContexts(contexts, type.id);
    persistScheduleCellEdit(schedule, contexts.length);
}

function saveEditingScheduleComment() {
    const contexts = getEditingScheduleContexts();
    if (!contexts.length) return;
    const schedule = contexts[0].schedule;
    const text = document.getElementById('scheduleCellComment')?.value?.trim() || '';
    v6PushHistory(schedule);
    contexts.forEach(ctx => {
        if (!ctx.employee.days[ctx.day]) ctx.employee.days[ctx.day] = emptyScheduleDayInfo();
        ctx.employee.days[ctx.day].comment = text;
    });
    v6AfterMutation(schedule, `✅ Комментарий сохранён для ${contexts.length} ${pluralizeRu(contexts.length, 'ячейка', 'ячейки', 'ячеек')}`);
    closeScheduleCellEditor();
}

// ------------------------ Shift presets editor -------------------
function openScheduleShiftsEditor() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6EnsureSchedule(schedule);
    editingShiftTypesV6 = v6Clone(schedule.shiftTypes);
    removedShiftTypeIdsV6 = new Set();
    renderScheduleShiftsEditor();
    document.getElementById('scheduleShiftsModal')?.classList.add('active');
}

function closeScheduleShiftsEditor() {
    document.getElementById('scheduleShiftsModal')?.classList.remove('active');
    editingShiftTypesV6 = null;
    removedShiftTypeIdsV6 = new Set();
}

function renderScheduleShiftsEditor() {
    const list = document.getElementById('scheduleShiftTypesList');
    if (!list || !editingShiftTypesV6) return;
    list.innerHTML = editingShiftTypesV6.map(type => {
        const removed = removedShiftTypeIdsV6.has(type.id);
        return `<div class="schedule-shift-type-row ${removed ? 'removed' : ''}" data-id="${escapeHtml(type.id)}">
            <div class="schedule-shift-edit-grid">
                <div class="form-group"><label>Код</label><input class="v6-shift-code" value="${escapeHtml(type.code)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Название</label><input class="v6-shift-name" value="${escapeHtml(type.name)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>С</label><input class="v6-shift-start" type="time" value="${escapeHtml(type.start)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>До</label><input class="v6-shift-end" type="time" value="${escapeHtml(type.end)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Оплач. часов</label><input class="v6-shift-paid" type="number" min="0" step="0.5" value="${Number(type.paidHours)}" ${removed ? 'disabled' : ''}></div>
                <div class="form-group"><label>Цвет</label><input class="v6-shift-color" type="color" value="#${normalizeHexColor(type.color)}" ${removed ? 'disabled' : ''}></div>
                <button class="schedule-shift-delete-btn" onclick="toggleRemoveShiftTypeV6('${type.id}')" title="${removed ? 'Вернуть смену' : 'Удалить смену (ячейки этой смены будут очищены)'}"><i class="fa-solid ${removed ? 'fa-rotate-left' : 'fa-trash'}"></i></button>
            </div>
        </div>`;
    }).join('');
}

function toggleRemoveShiftTypeV6(id) {
    if (removedShiftTypeIdsV6.has(id)) removedShiftTypeIdsV6.delete(id); else removedShiftTypeIdsV6.add(id);
    renderScheduleShiftsEditor();
}

function addShiftTypeV6() {
    const schedule = getCurrentSchedule();
    if (!schedule || !editingShiftTypesV6) return;
    const code = document.getElementById('newShiftCode')?.value?.trim();
    const name = document.getElementById('newShiftName')?.value?.trim() || 'Рабочая смена';
    const start = document.getElementById('newShiftStart')?.value || '08:00';
    const end = document.getElementById('newShiftEnd')?.value || '20:00';
    const paid = Number(document.getElementById('newShiftPaidHours')?.value);
    const color = normalizeHexColor(document.getElementById('newShiftColor')?.value || '00B0F0');
    const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
    if (!parseTimeRange(time)) { showToast('Некорректное время смены', 'warning'); return; }
    let id = v6MakeShiftId(time);
    let n = 2;
    while (editingShiftTypesV6.some(type => type.id === id)) id = `${v6MakeShiftId(time)}_${n++}`;
    const type = v6BuildShiftType(time, { id, code: code || getWorkCodeForTime(time), name, paidHours: Number.isFinite(paid) ? paid : getPaidHoursForTime(time), color });
    editingShiftTypesV6.push(type);
    renderScheduleShiftsEditor();
    showToast('Смена добавлена в список. Нажмите «Сохранить изменения».', 'info');
}

function saveShiftTypesV6() {
    const schedule = getCurrentSchedule();
    if (!schedule || !editingShiftTypesV6) return;
    const oldTypes = v6Clone(schedule.shiftTypes || []);
    const rows = [...document.querySelectorAll('#scheduleShiftTypesList .schedule-shift-type-row')];
    const nextTypes = [];
    for (const row of rows) {
        const id = row.dataset.id;
        if (removedShiftTypeIdsV6.has(id)) continue;
        const start = row.querySelector('.v6-shift-start')?.value;
        const end = row.querySelector('.v6-shift-end')?.value;
        const time = `${normalizeClock(start)}-${normalizeClock(end)}`;
        if (!parseTimeRange(time)) { showToast('Проверьте время в настройках смен', 'warning'); return; }
        const paid = Number(row.querySelector('.v6-shift-paid')?.value);
        nextTypes.push({
            id,
            code: row.querySelector('.v6-shift-code')?.value?.trim() || getWorkCodeForTime(time),
            name: row.querySelector('.v6-shift-name')?.value?.trim() || 'Рабочая смена',
            start: normalizeClock(start),
            end: normalizeClock(end),
            time,
            paidHours: Number.isFinite(paid) ? paid : getPaidHoursForTime(time),
            color: normalizeHexColor(row.querySelector('.v6-shift-color')?.value || '00B0F0')
        });
    }
    // Include newly added rows not yet represented in DOM draft? render already includes them.
    if (!nextTypes.length) { showToast('Должна остаться хотя бы одна рабочая смена', 'warning'); return; }
    if (removedShiftTypeIdsV6.size) {
        const removedOld = oldTypes.filter(type => removedShiftTypeIdsV6.has(type.id));
        let affected = 0;
        (schedule.employees || []).forEach(emp => {
            Object.values(emp.days || {}).forEach(info => {
                if (info?.working && removedOld.some(type => info.shiftId === type.id || (!info.shiftId && info.time === type.time))) affected++;
            });
        });
        if (affected && !confirm(`Удаляемые смены используются в ${affected} ячейках. Эти ячейки будут очищены. Продолжить?`)) return;
    }
    const duplicateTime = nextTypes.find((type, i) => nextTypes.some((other, j) => i !== j && other.time === type.time));
    if (duplicateTime) { showToast(`Две смены не могут иметь одинаковое время ${duplicateTime.time}`, 'warning'); return; }

    v6PushHistory(schedule);
    const oldById = new Map(oldTypes.map(type => [type.id, type]));
    const nextById = new Map(nextTypes.map(type => [type.id, type]));
    (schedule.employees || []).forEach(emp => {
        for (let d = 1; d <= schedule.dayCount; d++) {
            const info = emp.days?.[d];
            if (!info?.working) continue;
            let old = info.shiftId ? oldById.get(info.shiftId) : null;
            if (!old && info.time) old = oldTypes.find(type => type.time === info.time);
            if (!old) continue;
            const next = nextById.get(old.id);
            if (!next) {
                const comment = info.comment || '';
                emp.days[d] = { ...emptyScheduleDayInfo(), comment };
                continue;
            }
            info.shiftId = next.id;
            info.raw = next.code;
            info.shiftName = next.name;
            info.status = next.name;
            info.time = next.time;
            info.paidHours = next.paidHours;
            info.color = next.color;
        }
    });
    schedule.shiftTypes = nextTypes;
    const nextByOldTime = new Map();
    oldTypes.forEach(old => { const next = nextById.get(old.id); if (next) nextByOldTime.set(old.time, next.time); });
    Object.values(scheduleTemplatesV6).forEach(template => {
        if (template.shiftTime && nextByOldTime.has(template.shiftTime)) template.shiftTime = nextByOldTime.get(template.shiftTime);
    });
    v6SaveTemplates();
    schedule.legend = {};
    schedule.colorSettings.work = {};
    nextTypes.forEach(type => {
        schedule.legend[type.color] = type.time;
        schedule.colorSettings.work[type.time] = type.color;
    });
    closeScheduleShiftsEditor();
    v6AfterMutation(schedule, '✅ Настройки смен сохранены');
}

// Override color editor apply so colors stay synchronized with shift presets.
function applyScheduleColorsEditor() {
    if (!editingScheduleColors) return;
    const schedule = monthlySchedules[editingScheduleColors.scheduleKey];
    if (!schedule) return;
    v6EnsureSchedule(schedule);
    v6PushHistory(schedule);
    schedule.colorSettings.work = { ...schedule.colorSettings.work, ...editingScheduleColors.work };
    schedule.colorSettings.absence = { ...schedule.colorSettings.absence, ...editingScheduleColors.absence };
    schedule.shiftTypes.forEach(type => {
        const color = editingScheduleColors.work[type.time];
        if (color) type.color = normalizeHexColor(color);
    });
    schedule.colorSettings.work = Object.fromEntries(schedule.shiftTypes.map(type => [type.time, type.color]));
    schedule.legend = {};
    schedule.shiftTypes.forEach(type => { schedule.legend[type.color] = type.time; });
    (schedule.employees || []).forEach(emp => {
        Object.values(emp.days || {}).forEach(info => {
            if (!info) return;
            if (info.working && info.time) {
                const type = v6FindShiftType(schedule, info.shiftId || info.time);
                info.color = type?.color || normalizeHexColor(schedule.colorSettings.work[info.time]);
            }
            if (!info.working && info.raw) info.color = normalizeHexColor(schedule.colorSettings.absence[info.raw] || getDefaultAbsenceColor(info.raw));
        });
    });
    closeScheduleColorsEditor();
    v6AfterMutation(schedule, '✅ Цвета смен обновлены');
}

// ------------------------ Cycles and templates -------------------
function v6LoadTemplates() {
    try { scheduleTemplatesV6 = JSON.parse(localStorage.getItem(SCHEDULE_TEMPLATES_KEY_V6)) || {}; }
    catch { scheduleTemplatesV6 = {}; }
}
function v6SaveTemplates() {
    localStorage.setItem(SCHEDULE_TEMPLATES_KEY_V6, JSON.stringify(scheduleTemplatesV6));
}

function v6PopulateEmployeeSelect(selectId) {
    const schedule = getCurrentSchedule();
    const select = document.getElementById(selectId);
    if (!schedule || !select) return;
    select.innerHTML = schedule.employees.map((emp, index) => `<option value="${index}">${escapeHtml(emp.position)} · ${escapeHtml(emp.fullName)}</option>`).join('');
}

function v6PopulateShiftSelect(selectId) {
    const schedule = getCurrentSchedule();
    const select = document.getElementById(selectId);
    if (!schedule || !select) return;
    select.innerHTML = v6GetShiftTypes(schedule).map(type => `<option value="${type.id}">${escapeHtml(type.code)} · ${escapeHtml(type.name)} · ${escapeHtml(type.time)}</option>`).join('');
}

function openScheduleCycleModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PopulateEmployeeSelect('scheduleCycleEmployee');
    v6PopulateShiftSelect('scheduleCycleShift');
    const employeeSelect = document.getElementById('scheduleCycleEmployee');
    const selected = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean)[0];
    if (selected && employeeSelect) employeeSelect.value = String(selected.employeeIndex);
    document.getElementById('scheduleCycleStartDay').max = String(schedule.dayCount);
    document.getElementById('scheduleCycleModal')?.classList.add('active');
}
function closeScheduleCycleModalV6() { document.getElementById('scheduleCycleModal')?.classList.remove('active'); }

function v6ApplyCycleToEmployee(schedule, emp, template, onlyEmpty = true) {
    const type = v6FindShiftType(schedule, template.shiftId || template.shiftTime);
    if (!type) return 0;
    const workDays = Math.max(1, Number(template.workDays || 3));
    const offDays = Math.max(1, Number(template.offDays || 3));
    const startDay = Math.max(1, Math.min(schedule.dayCount, Number(template.startDay || 1)));
    const phase = template.phase === 'off' ? 'off' : 'work';
    const cycle = phase === 'work'
        ? [...Array(workDays).fill('work'), ...Array(offDays).fill('off')]
        : [...Array(offDays).fill('off'), ...Array(workDays).fill('work')];
    let changed = 0;
    for (let day = startDay; day <= schedule.dayCount; day++) {
        const current = emp.days?.[day] || emptyScheduleDayInfo();
        if (onlyEmpty && current.raw) continue;
        const state = cycle[(day - startDay) % cycle.length];
        if (state === 'work') {
            v6ApplyShiftToContexts([{ schedule, employee: emp, day }], type.id);
        } else {
            const off = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === 'В');
            applyScheduleAbsenceToContexts([{ schedule, employee: emp, day }], off);
        }
        changed++;
    }
    return changed;
}

function applyScheduleCycleV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const employeeIndex = Number(document.getElementById('scheduleCycleEmployee')?.value);
    const employee = schedule.employees[employeeIndex];
    if (!employee) return;
    const template = {
        workDays: Number(document.getElementById('scheduleCycleWorkDays')?.value || 3),
        offDays: Number(document.getElementById('scheduleCycleOffDays')?.value || 3),
        startDay: Number(document.getElementById('scheduleCycleStartDay')?.value || 1),
        phase: document.getElementById('scheduleCyclePhase')?.value || 'work',
        shiftId: document.getElementById('scheduleCycleShift')?.value || '',
        shiftTime: v6FindShiftType(schedule, document.getElementById('scheduleCycleShift')?.value || '')?.time || ''
    };
    const onlyEmpty = !!document.getElementById('scheduleCycleOnlyEmpty')?.checked;
    const wholePosition = !!document.getElementById('scheduleCycleWholePosition')?.checked;
    const targets = wholePosition ? schedule.employees.filter(emp => emp.position === employee.position) : [employee];
    v6PushHistory(schedule);
    let changed = 0;
    targets.forEach(emp => {
        changed += v6ApplyCycleToEmployee(schedule, emp, template, onlyEmpty);
        if (document.getElementById('scheduleCycleSaveTemplate')?.checked) {
            scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)] = { ...template, shiftId: '', shiftTime: template.shiftTime };
        }
    });
    v6SaveTemplates();
    closeScheduleCycleModalV6();
    v6AfterMutation(schedule, `✅ Цикл применён: ${changed} ${pluralizeRu(changed, 'ячейка', 'ячейки', 'ячеек')}`);
}

function applyScheduleTemplatesV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const withTemplates = schedule.employees.filter(emp => scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)]);
    if (!withTemplates.length) { showToast('Сохранённых шаблонов сотрудников пока нет', 'warning'); return; }
    v6PushHistory(schedule);
    let changed = 0;
    withTemplates.forEach(emp => {
        const template = scheduleTemplatesV6[v6ScheduleEmployeeKey(emp)];
        changed += v6ApplyCycleToEmployee(schedule, emp, template, true);
    });
    v6AfterMutation(schedule, `✅ По шаблонам заполнено ${changed} ${pluralizeRu(changed, 'ячейка', 'ячейки', 'ячеек')}`);
}

// ------------------------ Absence ranges -------------------------
function openScheduleAbsenceModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PopulateEmployeeSelect('scheduleAbsenceEmployee');
    const type = document.getElementById('scheduleAbsenceType');
    if (type) type.innerHTML = SCHEDULE_ABSENCE_OPTIONS.filter(item => item.raw !== 'В').map(item => `<option value="${escapeHtml(item.raw)}">${escapeHtml(item.raw)} · ${escapeHtml(item.status)}</option>`).join('');
    const selected = [...selectedScheduleCells].map(parseScheduleCellKey).filter(Boolean);
    if (selected.length) {
        document.getElementById('scheduleAbsenceEmployee').value = String(selected[0].employeeIndex);
        const days = selected.map(item => item.day);
        document.getElementById('scheduleAbsenceStartDay').value = String(Math.min(...days));
        document.getElementById('scheduleAbsenceEndDay').value = String(Math.max(...days));
    }
    document.getElementById('scheduleAbsenceStartDay').max = String(schedule.dayCount);
    document.getElementById('scheduleAbsenceEndDay').max = String(schedule.dayCount);
    document.getElementById('scheduleAbsenceModal')?.classList.add('active');
}
function closeScheduleAbsenceModalV6() { document.getElementById('scheduleAbsenceModal')?.classList.remove('active'); }
function applyScheduleAbsenceRangeV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    const employeeIndex = Number(document.getElementById('scheduleAbsenceEmployee')?.value);
    const emp = schedule.employees[employeeIndex];
    const raw = document.getElementById('scheduleAbsenceType')?.value;
    const option = SCHEDULE_ABSENCE_OPTIONS.find(item => item.raw === raw);
    let start = Number(document.getElementById('scheduleAbsenceStartDay')?.value);
    let end = Number(document.getElementById('scheduleAbsenceEndDay')?.value);
    if (!emp || !option || !start || !end) return;
    if (start > end) [start, end] = [end, start];
    start = Math.max(1, start); end = Math.min(schedule.dayCount, end);
    v6PushHistory(schedule);
    const contexts = [];
    for (let day = start; day <= end; day++) contexts.push({ schedule, employee: emp, employeeIndex, day });
    applyScheduleAbsenceToContexts(contexts, option);
    closeScheduleAbsenceModalV6();
    v6AfterMutation(schedule, `✅ ${option.status}: ${emp.fullName}, ${start}–${end} число`);
}

// ------------------------ Norms & validation ---------------------
function openScheduleNormsModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6EnsureSchedule(schedule);
    document.getElementById('scheduleDefaultMonthlyHours').value = schedule.settings.defaultMonthlyHours;
    document.getElementById('scheduleAbsenceReductionHours').value = schedule.settings.absenceReductionHours;
    document.getElementById('scheduleMaxConsecutive').value = schedule.settings.maxConsecutive;
    document.getElementById('scheduleMinOffBlock').value = schedule.settings.minOffBlock;
    document.getElementById('scheduleMaxOffBlock').value = schedule.settings.maxOffBlock;
    document.getElementById('scheduleOvertimeTolerance').value = schedule.settings.overtimeTolerance;
    const list = document.getElementById('schedulePositionNormsList');
    if (list) {
        list.innerHTML = getSchedulePositionOrder(schedule).map(pos => {
            const norm = schedule.positionNorms[pos] || { totalMin: 0, dayMin: 0, nightMin: 0 };
            return `<div class="schedule-position-norm-row" data-position="${escapeHtml(pos)}">
                <div class="pos-label">${escapeHtml(pos)}</div>
                <div class="form-group"><label>Всего минимум</label><input class="v6-norm-total" type="number" min="0" value="${Number(norm.totalMin || 0)}"></div>
                <div class="form-group"><label>День минимум</label><input class="v6-norm-day" type="number" min="0" value="${Number(norm.dayMin || 0)}"></div>
                <div class="form-group"><label>Ночь минимум</label><input class="v6-norm-night" type="number" min="0" value="${Number(norm.nightMin || 0)}"></div>
            </div>`;
        }).join('');
    }
    document.getElementById('scheduleNormsModal')?.classList.add('active');
}
function closeScheduleNormsModalV6() { document.getElementById('scheduleNormsModal')?.classList.remove('active'); }
function saveScheduleNormsV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    v6PushHistory(schedule);
    schedule.settings.defaultMonthlyHours = Math.max(0, Number(document.getElementById('scheduleDefaultMonthlyHours')?.value || 0));
    schedule.settings.absenceReductionHours = Math.max(0, Number(document.getElementById('scheduleAbsenceReductionHours')?.value || 0));
    schedule.settings.maxConsecutive = Math.max(1, Number(document.getElementById('scheduleMaxConsecutive')?.value || 4));
    schedule.settings.minOffBlock = Math.max(1, Number(document.getElementById('scheduleMinOffBlock')?.value || 2));
    schedule.settings.maxOffBlock = Math.max(schedule.settings.minOffBlock, Number(document.getElementById('scheduleMaxOffBlock')?.value || 4));
    schedule.settings.overtimeTolerance = Math.max(0, Number(document.getElementById('scheduleOvertimeTolerance')?.value || 0));
    document.querySelectorAll('#schedulePositionNormsList .schedule-position-norm-row').forEach(row => {
        const pos = row.dataset.position;
        schedule.positionNorms[pos] = {
            totalMin: Math.max(0, Number(row.querySelector('.v6-norm-total')?.value || 0)),
            dayMin: Math.max(0, Number(row.querySelector('.v6-norm-day')?.value || 0)),
            nightMin: Math.max(0, Number(row.querySelector('.v6-norm-night')?.value || 0))
        };
    });
    closeScheduleNormsModalV6();
    v6AfterMutation(schedule, '✅ Нормативы сохранены');
}

function v6ValidateSchedule(schedule) {
    v6EnsureSchedule(schedule);
    const issues = [];
    // Coverage norms.
    for (let day = 1; day <= schedule.dayCount; day++) {
        v6CoverageForDay(schedule, day).forEach(item => {
            item.violations.forEach(text => issues.push({
                severity: 'error', type: 'coverage', day, employeeIndex: null,
                title: `${item.position}: не хватает сотрудников`, detail: `${day} число · ${text}`
            }));
        });
    }
    // Employee rules.
    schedule.employees.forEach((emp, employeeIndex) => {
        let runStart = null;
        let runLen = 0;
        let offStart = null;
        let offLen = 0;
        const finishOffBlock = (endDay) => {
            if (!offLen) return;
            const minOff = Number(schedule.settings.minOffBlock || 2);
            const maxOff = Number(schedule.settings.maxOffBlock || 4);
            const touchesMonthBoundary = offStart === 1 || endDay === schedule.dayCount;
            if (offLen < minOff && !touchesMonthBoundary) issues.push({ severity: 'warn', type: 'off-short', employeeIndex, day: offStart, title: `${emp.fullName}: только ${offLen} выходн. подряд`, detail: `${offStart}–${endDay} число · минимум ${minOff}` });
            if (offLen > maxOff) issues.push({ severity: 'warn', type: 'off-long', employeeIndex, day: offStart, title: `${emp.fullName}: ${offLen} выходн. подряд`, detail: `${offStart}–${endDay} число · максимум ${maxOff}` });
            offStart = null; offLen = 0;
        };
        for (let day = 1; day <= schedule.dayCount; day++) {
            const info = emp.days?.[day] || emptyScheduleDayInfo();
            if (info.working) {
                finishOffBlock(day - 1);
                if (runStart === null) runStart = day;
                runLen++;
                if (!info.time) issues.push({ severity: 'warn', type: 'time', employeeIndex, day, title: `${emp.fullName}: не указано время`, detail: `${day} число · рабочая ячейка «${info.raw || 'смена'}»` });
                const next = emp.days?.[day + 1];
                if (next?.working && v6IsNightTime(info.time) && !v6IsNightTime(next.time)) {
                    issues.push({ severity: 'error', type: 'night-day', employeeIndex, day: day + 1, title: `${emp.fullName}: день после ночи`, detail: `Ночная ${day} числа → дневная ${day + 1} числа` });
                }
            } else {
                if (runLen > Number(schedule.settings.maxConsecutive || 4)) {
                    issues.push({ severity: 'error', type: 'consecutive', employeeIndex, day: runStart, title: `${emp.fullName}: ${runLen} смен подряд`, detail: `${runStart}–${day - 1} число · максимум ${schedule.settings.maxConsecutive}` });
                }
                runStart = null; runLen = 0;
                if (offStart === null) offStart = day;
                offLen++;
            }
        }
        finishOffBlock(schedule.dayCount);
        if (runLen > Number(schedule.settings.maxConsecutive || 4)) {
            issues.push({ severity: 'error', type: 'consecutive', employeeIndex, day: runStart, title: `${emp.fullName}: ${runLen} смен подряд`, detail: `${runStart}–${schedule.dayCount} число · максимум ${schedule.settings.maxConsecutive}` });
        }
        const hours = Array.from({ length: schedule.dayCount }, (_, i) => i + 1).reduce((sum, d) => sum + getScheduleWorkHours(emp.days[d]), 0);
        const target = v6AdjustedTargetHours(schedule, emp);
        const diff = hours - target;
        const tolerance = Number(schedule.settings.overtimeTolerance || 0);
        if (diff > tolerance) issues.push({ severity: 'warn', type: 'hours-high', employeeIndex, day: null, title: `${emp.fullName}: переработка +${formatScheduleHours(diff)} ч.`, detail: `${formatScheduleHours(hours)} ч. при норме ${formatScheduleHours(target)} ч.` });
        if (diff < -tolerance) issues.push({ severity: 'warn', type: 'hours-low', employeeIndex, day: null, title: `${emp.fullName}: недобор ${formatScheduleHours(Math.abs(diff))} ч.`, detail: `${formatScheduleHours(hours)} ч. при норме ${formatScheduleHours(target)} ч.` });
    });
    return issues;
}

function runScheduleValidationV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) return;
    scheduleValidationIssuesV6 = v6ValidateSchedule(schedule);
    const panel = document.getElementById('scheduleValidationPanel');
    if (!panel) return;
    const errors = scheduleValidationIssuesV6.filter(i => i.severity === 'error').length;
    const warnings = scheduleValidationIssuesV6.filter(i => i.severity === 'warn').length;
    panel.style.display = 'block';
    panel.innerHTML = `<div class="schedule-validation-head">
        <strong><i class="fa-solid fa-list-check"></i> Проверка графика</strong>
        <div class="schedule-validation-kpis">
            ${!scheduleValidationIssuesV6.length ? '<span class="schedule-validation-kpi ok">Ошибок нет</span>' : ''}
            ${errors ? `<span class="schedule-validation-kpi error">Ошибки: ${errors}</span>` : ''}
            ${warnings ? `<span class="schedule-validation-kpi warn">Предупреждения: ${warnings}</span>` : ''}
        </div>
    </div>
    <div class="schedule-validation-list">
        ${scheduleValidationIssuesV6.length ? scheduleValidationIssuesV6.slice(0, 200).map((issue, index) => `<button class="schedule-validation-item ${issue.severity}" onclick="goToScheduleValidationIssueV6(${index})">
            <i class="fa-solid ${issue.severity === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
            <span><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.detail)}</small></span>
        </button>`).join('') : '<div class="schedule-editor-empty" style="min-height:90px"><i class="fa-solid fa-circle-check"></i><strong>График прошёл проверку</strong><span>По текущим нормативам проблем не найдено.</span></div>'}
    </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function goToScheduleValidationIssueV6(index) {
    const issue = scheduleValidationIssuesV6[index];
    if (!issue) return;
    if (issue.day) {
        const schedule = getCurrentSchedule();
        const date = `${schedule.key}-${String(issue.day).padStart(2, '0')}`;
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput) dateInput.value = date;
    }
    if (issue.employeeIndex !== null && issue.employeeIndex !== undefined) v6ScrollToEmployee(issue.employeeIndex, issue.day || 1);
    else if (issue.day) openScheduleDayDetails(issue.day);
}

// ------------------------ Copy month -----------------------------
function openScheduleCopyMonthModalV6() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала откройте месяц, который хотите копировать', 'warning'); return; }
    const next = new Date(schedule.year, schedule.month, 1);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('scheduleCopyTargetMonth').value = key;
    document.getElementById('scheduleCopyMonthModal')?.classList.add('active');
}
function closeScheduleCopyMonthModalV6() { document.getElementById('scheduleCopyMonthModal')?.classList.remove('active'); }
function applyScheduleCopyMonthV6() {
    const source = getCurrentSchedule();
    const key = document.getElementById('scheduleCopyTargetMonth')?.value;
    const match = String(key || '').match(/^(20\d{2})-(\d{2})$/);
    if (!source || !match) { showToast('Выберите новый месяц', 'warning'); return; }
    if (monthlySchedules[key] && !confirm('График на этот месяц уже существует. Заменить его?')) return;
    v6EnsureSchedule(source);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const dayCount = new Date(year, month, 0).getDate();
    const copyCells = !!document.getElementById('scheduleCopyCells')?.checked;
    const copySettings = !!document.getElementById('scheduleCopySettings')?.checked;
    const target = {
        key, year, month, dayCount,
        title: `${RU_MONTH_NAMES[month]} ${year}`,
        sourceTitle: `Копия ${source.title}`,
        sourceName: `Копия ${source.title}`,
        sheetName: '', importedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdManually: true,
        employees: source.employees.map(emp => {
            const days = {};
            for (let d = 1; d <= dayCount; d++) days[d] = copyCells && d <= source.dayCount ? v6Clone(emp.days[d] || emptyScheduleDayInfo()) : emptyScheduleDayInfo();
            return { sourceRow: emp.sourceRow || `copy_${generateId()}`, baseId: emp.baseId || '', fullName: emp.fullName, position: emp.position, days };
        })
    };
    if (copySettings) {
        target.legend = v6Clone(source.legend || {});
        target.colorSettings = v6Clone(source.colorSettings || {});
        target.shiftTypes = v6Clone(source.shiftTypes || []);
        target.settings = v6Clone(source.settings || v6DefaultSettings());
        target.positionNorms = v6Clone(source.positionNorms || {});
        target.employeeTargets = v6Clone(source.employeeTargets || {});
    }
    v6EnsureSchedule(target);
    monthlySchedules[key] = target;
    currentScheduleKey = key;
    saveData();
    populateScheduleMonthSelect();
    closeScheduleCopyMonthModalV6();
    selectScheduleMonth(key);
    showToast(`✅ Создан график ${target.title}`, 'success');
}

// ------------------------ Search, copy/paste ---------------------
function v6ScrollToEmployee(employeeIndex, day = 1) {
    const schedule = getCurrentSchedule();
    const emp = schedule?.employees?.[employeeIndex];
    if (!schedule || !emp) return;
    if (schedule.collapsedPositions?.[emp.position]) {
        schedule.collapsedPositions[emp.position] = false;
        renderScheduleMonthTable(schedule);
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('#scheduleMonthTableWrap .schedule-employee-row').forEach(row => row.classList.remove('grid-search-match'));
        const row = document.querySelector(`#scheduleMonthTableWrap .schedule-employee-row[data-employee-index="${employeeIndex}"]`);
        if (row) {
            row.classList.add('grid-search-match');
            row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
        const cell = document.querySelector(`#scheduleMonthTableWrap .schedule-cell-editable[data-employee-index="${employeeIndex}"][data-day="${day}"]`);
        if (cell) {
            selectedScheduleCells = new Set([getScheduleCellKey(employeeIndex, day)]);
            updateScheduleSelectionUI();
            cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    });
}

function findScheduleEmployeeV6() {
    const schedule = getCurrentSchedule();
    const q = document.getElementById('scheduleGridSearch')?.value?.trim().toLowerCase();
    if (!schedule || !q) return;
    const index = schedule.employees.findIndex(emp => emp.fullName.toLowerCase().includes(q) || String(emp.position || '').toLowerCase().includes(q));
    if (index < 0) { showToast('Сотрудник не найден', 'warning'); return; }
    v6ScrollToEmployee(index, 1);
}

function copySelectedScheduleCellsV6() {
    const cells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    const schedule = getCurrentSchedule();
    if (!schedule || !cells.length) { showToast('Сначала выделите ячейки', 'warning'); return; }
    const parsed = cells.map(cell => ({
        row: Number(cell.dataset.row), day: Number(cell.dataset.day), employeeIndex: Number(cell.dataset.employeeIndex),
        info: v6Clone(schedule.employees[Number(cell.dataset.employeeIndex)]?.days?.[Number(cell.dataset.day)] || emptyScheduleDayInfo())
    }));
    const minRow = Math.min(...parsed.map(x => x.row));
    const maxRow = Math.max(...parsed.map(x => x.row));
    const minDay = Math.min(...parsed.map(x => x.day));
    const maxDay = Math.max(...parsed.map(x => x.day));
    scheduleClipboardV6 = parsed.map(item => ({ dr: item.row - minRow, dd: item.day - minDay, info: item.info }));

    // Also put the visible cell values into the normal OS clipboard.
    // This makes Ctrl+C / Ctrl+V compatible with Google Sheets and Excel.
    const valueMap = new Map(parsed.map(item => [`${item.row}:${item.day}`, item.info?.raw || '']));
    const rows = [];
    for (let row = minRow; row <= maxRow; row++) {
        const values = [];
        for (let day = minDay; day <= maxDay; day++) values.push(valueMap.get(`${row}:${day}`) ?? '');
        rows.push(values.join('\t'));
    }
    const clipboardText = rows.join('\n');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(clipboardText).catch(() => {});

    showToast(`📋 Скопировано ${parsed.length} ${pluralizeRu(parsed.length, 'ячейка', 'ячейки', 'ячеек')}`, 'info');
}

function pasteScheduleCellsV6() {
    const schedule = getCurrentSchedule();
    if (!scheduleClipboardV6?.length || !schedule) { showToast('Буфер графика пуст', 'warning'); return; }
    const selected = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    if (!selected.length) { showToast('Выберите ячейку, с которой начинать вставку', 'warning'); return; }
    selected.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row) || Number(a.dataset.day) - Number(b.dataset.day));
    const anchor = selected[0];
    const anchorRow = Number(anchor.dataset.row);
    const anchorDay = Number(anchor.dataset.day);
    const tableCells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable')];
    const byCoord = new Map(tableCells.map(cell => [`${cell.dataset.row}:${cell.dataset.day}`, cell]));
    v6PushHistory(schedule);
    let pasted = 0;
    const nextSelection = new Set();
    scheduleClipboardV6.forEach(item => {
        const target = byCoord.get(`${anchorRow + item.dr}:${anchorDay + item.dd}`);
        if (!target) return;
        const employeeIndex = Number(target.dataset.employeeIndex);
        const day = Number(target.dataset.day);
        schedule.employees[employeeIndex].days[day] = v6Clone(item.info);
        nextSelection.add(getScheduleCellKey(employeeIndex, day));
        pasted++;
    });
    if (!pasted) { scheduleHistoryV6[schedule.key].undo.pop(); showToast('Вставка выходит за границы таблицы', 'warning'); return; }
    selectedScheduleCells = nextSelection;
    v6AfterMutation(schedule, `✅ Вставлено ${pasted} ${pluralizeRu(pasted, 'ячейка', 'ячейки', 'ячеек')}`);
}


// ------------------------ V7: paste from Google Sheets / Excel ---------------------
function v7ParseClipboardGrid(text) {
    const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
    let rows = normalized.split('\n').map(line => line.split('\t'));
    while (rows.length && rows[rows.length - 1].every(cell => String(cell ?? '') === '')) rows.pop();
    let maxCols = rows.reduce((m, row) => Math.max(m, row.length), 0);
    while (maxCols > 0 && rows.every(row => String(row[maxCols - 1] ?? '') === '')) maxCols--;
    rows = rows.map(row => Array.from({ length: maxCols }, (_, i) => String(row[i] ?? '')));
    return rows;
}

function v7NormalizeClipboardToken(value) {
    return String(value ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/[–—−]/g, '-')
        .replace(/\s*-\s*/g, '-')
        .trim();
}

function v7ParseClipboardDay(value) {
    const s = v7NormalizeClipboardToken(value);
    if (!s) return null;
    if (/^(?:[1-9]|[12]\d|3[01])$/.test(s)) return Number(s);
    const dateMatch = s.match(/^([0-3]?\d)[./-]([01]?\d)(?:[./-](?:\d{2}|\d{4}))?$/);
    if (dateMatch) {
        const day = Number(dateMatch[1]);
        return day >= 1 && day <= 31 ? day : null;
    }
    const leadingDay = s.match(/^([1-9]|[12]\d|3[01])(?:\s|\.|,|$)/);
    return leadingDay ? Number(leadingDay[1]) : null;
}

function v7CompactPersonName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function v7FindScheduleEmployeeIndex(schedule, value) {
    const raw = String(value || '').trim();
    if (!schedule || raw.length < 2) return -1;
    const compact = v7CompactPersonName(raw);
    if (!compact) return -1;

    let index = schedule.employees.findIndex(emp => v7CompactPersonName(emp.fullName) === compact);
    if (index >= 0) return index;

    const tokens = compact.split(' ').filter(Boolean);
    const surname = tokens[0] || '';
    if (!surname || surname.length < 3) return -1;
    const candidates = schedule.employees
        .map((emp, i) => ({ i, name: v7CompactPersonName(emp.fullName), emp }))
        .filter(item => item.name.split(' ')[0] === surname);
    if (candidates.length === 1) return candidates[0].i;

    // Supports variants like "Иванов И.И." against a full name in the employee base.
    const initials = tokens.slice(1).join('').replace(/[^a-zа-я]/gi, '');
    if (initials && candidates.length) {
        const matched = candidates.filter(item => {
            const parts = item.name.split(' ').filter(Boolean);
            const empInitials = parts.slice(1).map(part => part[0] || '').join('');
            return empInitials.startsWith(initials) || initials.startsWith(empInitials);
        });
        if (matched.length === 1) return matched[0].i;
    }
    return -1;
}

function v7FindShiftTypeFromClipboard(schedule, rawValue) {
    const token = v7NormalizeClipboardToken(rawValue);
    if (!token) return null;
    v6EnsureSchedule(schedule);
    const lower = token.toLowerCase();
    let type = schedule.shiftTypes.find(item =>
        [item.id, item.code, item.time, item.name].some(value => String(value || '').trim().toLowerCase() === lower)
    );
    if (type) return type;

    // Normalize copied clock ranges: 8:00 - 20:00, 08.00–20.00, etc.
    const timeMatch = token.match(/^(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})$/);
    if (timeMatch) {
        const start = normalizeClock(`${timeMatch[1]}:${timeMatch[2]}`);
        const end = normalizeClock(`${timeMatch[3]}:${timeMatch[4]}`);
        const time = `${start}-${end}`;
        type = v6FindShiftType(schedule, time);
        if (!type) {
            type = v6BuildShiftType(time, { name: 'Вставлено из таблицы', color: getColorForShiftTime(time) });
            let id = type.id;
            let n = 2;
            while (schedule.shiftTypes.some(item => item.id === id)) id = `${type.id}_${n++}`;
            type.id = id;
            schedule.shiftTypes.push(type);
        }
        return type;
    }
    return null;
}

function v7FindAbsenceFromClipboard(rawValue) {
    const token = v7NormalizeClipboardToken(rawValue);
    if (!token) return null;
    const upper = token.toUpperCase();
    const direct = SCHEDULE_ABSENCE_OPTIONS.find(option => String(option.raw).toUpperCase() === upper || String(option.status).toUpperCase() === upper);
    if (direct) return direct;
    const aliases = {
        'ВЫХ': 'В', 'ВЫХ.': 'В', 'ВЫХОДНОЙ': 'В',
        'ОТПУСК': 'ОТ', 'ОТП': 'ОТ',
        'БОЛЬНИЧНЫЙ': 'Б', 'БЛ': 'Б',
        'ДОП ОТПУСК': 'ДО', 'ДОП. ОТПУСК': 'ДО',
        'КОРПОРАТИВНЫЙ УНИВЕРСИТЕТ': 'КУ'
    };
    const raw = aliases[upper];
    return raw ? SCHEDULE_ABSENCE_OPTIONS.find(option => option.raw === raw) || null : null;
}

function v7ApplyClipboardToken(schedule, employeeIndex, day, rawValue, stats) {
    const employee = schedule?.employees?.[employeeIndex];
    if (!employee || day < 1 || day > schedule.dayCount) return false;
    const token = v7NormalizeClipboardToken(rawValue);

    if (!token || token === '-' || token === '—') {
        employee.days[day] = emptyScheduleDayInfo();
        stats.cleared++;
        return true;
    }

    const type = v7FindShiftTypeFromClipboard(schedule, token);
    if (type) {
        v6ApplyShiftToContexts([{ schedule, employee, employeeIndex, day }], type.id);
        stats.working++;
        return true;
    }

    const absence = v7FindAbsenceFromClipboard(token);
    if (absence) {
        applyScheduleAbsenceToContexts([{ schedule, employee, employeeIndex, day }], absence);
        stats.absence++;
        return true;
    }

    // Keep unknown codes instead of losing them. They can later be edited normally in the cell editor.
    employee.days[day] = {
        raw: token,
        color: 'CBD5E1',
        kind: 'other',
        status: 'Обозначение из таблицы',
        working: false,
        time: ''
    };
    stats.unknown.push(token);
    return true;
}

function v7TrySmartWholeSchedulePaste(schedule, grid, stats) {
    if (!schedule || !grid.length) return { used: false, pasted: 0, selection: new Set() };

    // Detect a header row containing day numbers (1..31). This allows copying a whole Google Sheets block
    // with FIO + days, not only the shift cells themselves.
    let headerRow = -1;
    let dayColumns = new Map();
    let bestCount = 0;
    grid.slice(0, Math.min(grid.length, 12)).forEach((row, r) => {
        const map = new Map();
        row.forEach((value, c) => {
            const day = v7ParseClipboardDay(value);
            if (day && day <= schedule.dayCount && ![...map.values()].includes(day)) map.set(c, day);
        });
        if (map.size > bestCount) {
            bestCount = map.size;
            headerRow = r;
            dayColumns = map;
        }
    });
    if (headerRow < 0 || bestCount < 5) return { used: false, pasted: 0, selection: new Set() };

    const firstDayCol = Math.min(...dayColumns.keys());
    let matchedEmployees = 0;
    let pasted = 0;
    const selection = new Set();

    for (let r = headerRow + 1; r < grid.length; r++) {
        const row = grid[r];
        let employeeIndex = -1;
        // FIO is usually somewhere before the first day column; scan those cells first.
        for (let c = 0; c < Math.max(1, firstDayCol); c++) {
            employeeIndex = v7FindScheduleEmployeeIndex(schedule, row[c]);
            if (employeeIndex >= 0) break;
        }
        if (employeeIndex < 0) continue;
        matchedEmployees++;
        dayColumns.forEach((day, c) => {
            if (c >= row.length) return;
            if (v7ApplyClipboardToken(schedule, employeeIndex, day, row[c], stats)) {
                selection.add(getScheduleCellKey(employeeIndex, day));
                pasted++;
            }
        });
    }

    if (!matchedEmployees || !pasted) return { used: false, pasted: 0, selection: new Set() };
    return { used: true, pasted, selection, matchedEmployees };
}

function v7PasteClipboardGridAtSelection(schedule, grid, stats) {
    const selected = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable.selected')];
    if (!selected.length) return { pasted: 0, selection: new Set(), noAnchor: true };
    selected.sort((a, b) => Number(a.dataset.row) - Number(b.dataset.row) || Number(a.dataset.day) - Number(b.dataset.day));
    const anchor = selected[0];
    const anchorRow = Number(anchor.dataset.row);
    const anchorDay = Number(anchor.dataset.day);
    const tableCells = [...document.querySelectorAll('#scheduleMonthTableWrap .schedule-cell-editable')];
    const byCoord = new Map(tableCells.map(cell => [`${cell.dataset.row}:${cell.dataset.day}`, cell]));
    let pasted = 0;
    const selection = new Set();

    grid.forEach((row, dr) => {
        row.forEach((value, dc) => {
            const target = byCoord.get(`${anchorRow + dr}:${anchorDay + dc}`);
            if (!target) return;
            const employeeIndex = Number(target.dataset.employeeIndex);
            const day = Number(target.dataset.day);
            if (v7ApplyClipboardToken(schedule, employeeIndex, day, value, stats)) {
                selection.add(getScheduleCellKey(employeeIndex, day));
                pasted++;
            }
        });
    });
    return { pasted, selection, noAnchor: false };
}

function pasteScheduleTextV7(text) {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала откройте график', 'warning'); return false; }
    const grid = v7ParseClipboardGrid(text);
    if (!grid.length || !grid[0]?.length) return false;

    const stats = { working: 0, absence: 0, cleared: 0, unknown: [] };
    v6PushHistory(schedule);

    let result = v7TrySmartWholeSchedulePaste(schedule, grid, stats);
    let mode = 'smart';
    if (!result.used) {
        result = v7PasteClipboardGridAtSelection(schedule, grid, stats);
        mode = 'range';
    }

    if (!result.pasted) {
        scheduleHistoryV6[schedule.key]?.undo?.pop();
        v6UpdateHistoryButtons();
        if (result.noAnchor) showToast('Выберите первую ячейку графика и нажмите Ctrl+V', 'warning');
        else showToast('Не удалось вставить диапазон', 'warning');
        return false;
    }

    selectedScheduleCells = result.selection;
    const unknownUnique = [...new Set(stats.unknown)];
    const label = mode === 'smart'
        ? `✅ Google Таблица: сопоставлено ${result.matchedEmployees || 0} сотрудников, вставлено ${result.pasted} ячеек`
        : `✅ Вставлено из таблицы ${result.pasted} ${pluralizeRu(result.pasted, 'ячейка', 'ячейки', 'ячеек')}`;
    v6AfterMutation(schedule, label);
    if (unknownUnique.length) {
        const preview = unknownUnique.slice(0, 5).join(', ');
        showToast(`⚠️ Не распознано как смены: ${preview}${unknownUnique.length > 5 ? '…' : ''}. Значения сохранены как обозначения.`, 'warning');
    }
    return true;
}

function handleSchedulePasteV7(event) {
    const scheduleTabActive = document.getElementById('tab-schedule')?.classList.contains('active');
    if (!scheduleTabActive) return;
    const typing = event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
    if (typing) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text) {
        // Fallback for browsers where clipboard text is unavailable but the internal schedule buffer exists.
        if (scheduleClipboardV6?.length) {
            event.preventDefault();
            pasteScheduleCellsV6();
        }
        return;
    }
    event.preventDefault();
    pasteScheduleTextV7(text);
}

// ------------------------ Plan / Fact ----------------------------
function v6FactDataForDate(date) {
    const relevant = Object.values(shifts || {}).filter(shift => shift.date === date);
    const map = new Map();
    relevant.forEach(shift => {
        (shift.people || []).forEach(person => {
            const key = normalizeEmployeeNameForMatch(person.fullName || '');
            const prev = map.get(key) || { present: false, included: false, shifts: [] };
            prev.included = true;
            prev.present = prev.present || !!person.present;
            prev.shifts.push({ name: shift.name, time: person.time || '' });
            map.set(key, prev);
        });
    });
    return { hasAny: relevant.length > 0, shifts: relevant, map };
}

function v6FactForEntry(entry, factData) {
    if (!factData.hasAny) return { state: 'no-data', text: 'Нет отметок' };
    const key = normalizeEmployeeNameForMatch(entry.fullName || '');
    const fact = factData.map.get(key);
    if (fact?.present) return { state: 'present', text: 'На месте' };
    if (fact?.included) return { state: 'missing', text: 'Не отмечен' };
    return { state: 'missing', text: 'Нет в смене' };
}

// Override day list to show actual presence and additional stats.
function renderScheduleDay() {
    const body = document.getElementById('scheduleDayBody');
    if (!body) return;
    const schedule = getCurrentSchedule();
    if (!schedule) {
        body.innerHTML = '<tr><td colspan="8" class="schedule-empty-cell">Создайте график на сайте или импортируйте Excel</td></tr>';
        setScheduleStats(0, 0, 0, 0, null, null);
        return;
    }
    v6EnsureSchedule(schedule);
    const selectedDate = getScheduleSelectedDate();
    if (!selectedDate || !selectedDate.startsWith(schedule.key)) selectScheduleMonth(schedule.key, false);
    const date = getScheduleSelectedDate();
    const factData = v6FactDataForDate(date);

    let entries = getScheduleEntriesForSelectedDay();
    const total = entries.length;
    const workingEntries = entries.filter(e => e.dayInfo.working);
    const working = workingEntries.length;
    const nowCount = entries.filter(e => isEntryActiveNow(e, date)).length;
    const off = total - working;
    const present = factData.hasAny ? workingEntries.filter(e => v6FactForEntry(e, factData).state === 'present').length : null;
    const missing = factData.hasAny ? working - present : null;
    setScheduleStats(total, working, nowCount, off, present, missing);

    const search = (document.getElementById('scheduleSearch')?.value || '').toLowerCase().trim();
    const position = document.getElementById('schedulePositionFilter')?.value || '';
    const status = document.getElementById('scheduleStatusFilter')?.value || 'working';
    if (search) entries = entries.filter(e => e.fullName.toLowerCase().includes(search) || String(e.position || '').toLowerCase().includes(search));
    if (position) entries = entries.filter(e => e.position === position);
    if (status === 'working') entries = entries.filter(e => e.dayInfo.working);
    if (status === 'now') entries = entries.filter(e => isEntryActiveNow(e, date));
    if (status === 'off') entries = entries.filter(e => !e.dayInfo.working);
    const countEl = document.getElementById('scheduleFilteredCount');
    if (countEl) countEl.textContent = `Показано: ${entries.length} из ${total}`;
    if (!entries.length) { body.innerHTML = '<tr><td colspan="8" class="schedule-empty-cell">Нет сотрудников по выбранному фильтру</td></tr>'; v6RenderCoverageSummary(schedule); return; }

    const groups = groupScheduleEmployees(schedule, entries);
    let counter = 0;
    body.innerHTML = groups.map(group => {
        const groupHeader = `<tr class="schedule-day-position-row"><td colspan="8"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(group.position)} <span>${group.employees.length} чел.</span></td></tr>`;
        const rows = group.employees.sort((a, b) => (a.dayInfo.time || '99:99').localeCompare(b.dayInfo.time || '99:99') || a.fullName.localeCompare(b.fullName, 'ru')).map(entry => {
            counter++;
            const base = findBaseEmployeeByScheduleName(entry.fullName);
            const phone = base?.phone || '';
            const active = isEntryActiveNow(entry, date);
            const statusClass = entry.dayInfo.working ? (active && date === toLocalISODate() ? 'schedule-status-now' : 'schedule-status-work') : 'schedule-status-off';
            let statusText = entry.dayInfo.shiftName || entry.dayInfo.status;
            if (entry.dayInfo.working && active && date === toLocalISODate()) statusText = 'Сейчас по графику';
            const time = entry.dayInfo.time || (entry.dayInfo.working ? 'Время не определено' : '—');
            const fact = v6FactForEntry(entry, factData);
            return `<tr class="${entry.dayInfo.working ? 'schedule-row-working' : 'schedule-row-off'}">
                <td>${counter}</td>
                <td><strong>${escapeHtml(entry.fullName)}</strong>${base ? '' : '<span class="schedule-unmatched" title="Нет точного совпадения в базе сотрудников">не в базе</span>'}</td>
                <td>${escapeHtml(entry.position)}</td>
                <td>${phone ? `<a href="tel:${escapeHtml(phone)}" class="phone-link">${escapeHtml(phone)}</a>` : '—'}</td>
                <td><span class="schedule-code">${escapeHtml(entry.dayInfo.raw || '—')}</span></td>
                <td>${escapeHtml(time)}</td>
                <td><span class="schedule-status ${statusClass}">${escapeHtml(statusText)}</span></td>
                <td><span class="schedule-fact-badge ${fact.state}">${escapeHtml(fact.text)}</span></td>
            </tr>`;
        }).join('');
        return groupHeader + rows;
    }).join('');
    v6RenderCoverageSummary(schedule);
}

function setScheduleStats(total, working, now, absent, present = null, missing = null) {
    const map = { scheduleStatTotal: total, scheduleStatWorking: working, scheduleStatNow: now, scheduleStatAbsent: absent };
    Object.entries(map).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
    const presentEl = document.getElementById('scheduleStatPresent');
    const missingEl = document.getElementById('scheduleStatMissing');
    if (presentEl) presentEl.textContent = present === null ? '—' : present;
    if (missingEl) missingEl.textContent = missing === null ? '—' : missing;
}

function openScheduleDayDetails(day) {
    const schedule = getCurrentSchedule();
    if (!schedule || day < 1 || day > schedule.dayCount) return;
    const date = `${schedule.key}-${String(day).padStart(2, '0')}`;
    const dateInput = document.getElementById('scheduleDate');
    if (dateInput) dateInput.value = date;
    renderScheduleDay();
    const entries = schedule.employees.map(emp => ({ ...emp, dayInfo: emp.days?.[day] || emptyScheduleDayInfo() }));
    const planned = entries.filter(e => e.dayInfo.working);
    const factData = v6FactDataForDate(date);
    const present = factData.hasAny ? planned.filter(e => v6FactForEntry(e, factData).state === 'present').length : 0;
    const missing = factData.hasAny ? planned.length - present : 0;
    const extraPresent = factData.hasAny ? [...factData.map.entries()].filter(([name, fact]) => fact.present && !planned.some(e => normalizeEmployeeNameForMatch(e.fullName) === name)).length : 0;
    const title = document.getElementById('scheduleDayDetailsTitle');
    if (title) title.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${day} ${RU_MONTH_NAMES[schedule.month].toLowerCase()} ${schedule.year}`;
    const subtitle = document.getElementById('scheduleDayDetailsSubtitle');
    if (subtitle) subtitle.textContent = factData.hasAny ? `План и факт · найдено фактических смен: ${factData.shifts.length}` : 'Фактическая смена на эту дату ещё не создана';
    const content = document.getElementById('scheduleDayDetailsContent');
    const coverage = v6CoverageForDay(schedule, day);
    if (content) {
        content.innerHTML = `<div class="schedule-day-detail-kpis">
            <div class="schedule-day-detail-kpi"><span>По плану</span><strong>${planned.length}</strong></div>
            <div class="schedule-day-detail-kpi"><span>Фактически на месте</span><strong>${factData.hasAny ? present : '—'}</strong></div>
            <div class="schedule-day-detail-kpi"><span>Не отмечены</span><strong>${factData.hasAny ? missing : '—'}</strong></div>
            <div class="schedule-day-detail-kpi"><span>На месте вне плана</span><strong>${factData.hasAny ? extraPresent : '—'}</strong></div>
        </div>
        ${coverage.map(item => {
            const groupEntries = planned.filter(e => e.position === item.position);
            return `<div class="schedule-day-detail-position">
                <h3>${escapeHtml(item.position)} · день ${item.day}${Number(item.norm.dayMin) ? `/${item.norm.dayMin}` : ''} · ночь ${item.night}${Number(item.norm.nightMin) ? `/${item.norm.nightMin}` : ''}${item.violations.length ? ` · ⚠ ${escapeHtml(item.violations.join(', '))}` : ''}</h3>
                <table class="schedule-day-detail-table"><thead><tr><th>ФИО</th><th>Смена</th><th>Время</th><th>Факт</th></tr></thead><tbody>
                    ${groupEntries.length ? groupEntries.map(entry => {
                        const fact = v6FactForEntry(entry, factData);
                        return `<tr><td>${escapeHtml(entry.fullName)}</td><td>${escapeHtml(entry.dayInfo.raw || '')}</td><td>${escapeHtml(entry.dayInfo.time || '—')}</td><td><span class="schedule-fact-badge ${fact.state}">${escapeHtml(fact.text)}</span></td></tr>`;
                    }).join('') : '<tr><td colspan="4">Нет работающих сотрудников</td></tr>'}
                </tbody></table>
            </div>`;
        }).join('')}`;
    }
    document.getElementById('scheduleDayDetailsModal')?.classList.add('active');
}
function closeScheduleDayDetailsV6() { document.getElementById('scheduleDayDetailsModal')?.classList.remove('active'); }

// Override schedule tab to ensure V6 data and toolbar state.
function renderScheduleTab() {
    populateScheduleMonthSelect();
    const badge = document.getElementById('scheduleMonthBadge');
    const info = document.getElementById('scheduleImportInfo');
    const schedule = currentScheduleKey ? monthlySchedules[currentScheduleKey] : null;
    if (!schedule) {
        if (badge) badge.textContent = 'Нет графика';
        if (info) info.innerHTML = '<span class="empty-text">Создайте график на сайте или импортируйте Excel</span>';
        renderScheduleLegend(null);
        populateSchedulePositionFilter({ employees: [] });
        renderScheduleMonthTable(null);
        renderScheduleDay();
        v6UpdateHistoryButtons();
        return;
    }
    v6EnsureSchedule(schedule);
    if (badge) badge.textContent = schedule.title;
    if (info) {
        const parsedAt = schedule.updatedAt || schedule.importedAt ? new Date(schedule.updatedAt || schedule.importedAt).toLocaleString('ru-RU') : '';
        info.innerHTML = `<div class="schedule-import-ok"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(schedule.sourceName || (schedule.createdManually ? 'Создано на сайте' : 'Excel'))} — ${schedule.employees.length} сотрудников${parsedAt ? ` · ${parsedAt}` : ''}</div>`;
    }
    renderScheduleLegend(schedule);
    populateSchedulePositionFilter(schedule);
    populateScheduleBulkShiftSelect(schedule);
    renderScheduleMonthTable(schedule);
    renderScheduleDay();
    v6UpdateHistoryButtons();
}

// Override legend to show editable shift names, code and color.
function renderScheduleLegend(schedule) {
    const el = document.getElementById('scheduleLegend');
    if (!el) return;
    if (!schedule) { el.innerHTML = '<span class="empty-text">Легенда появится после создания графика</span>'; return; }
    v6EnsureSchedule(schedule);
    el.innerHTML = schedule.shiftTypes.map(type => `<span class="legend-chip" title="${escapeHtml(type.name)} · ${formatScheduleHours(type.paidHours)} оплач. ч."><i style="background:#${type.color}"></i>${escapeHtml(type.code)} · ${escapeHtml(type.time)}</span>`).join('');
}

// Backup/export with cycle templates.
function downloadBackup() {
    const data = { version: '3.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules, scheduleTemplates: scheduleTemplatesV6 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evacuation_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url); showToast('📥 Бэкап скачан', 'success');
}
function restoreBackup() {
    const input = document.getElementById('backupFileInput');
    if (!input.files.length) { showToast('Выберите файл!', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.employees || !data.positions || !data.shifts) { showToast('Неверный формат файла!', 'error'); return; }
            if (!confirm('Восстановить данные из бэкапа? Текущие данные будут заменены.')) return;
            employees = data.employees || []; positions = data.positions || {}; shifts = data.shifts || {}; monthlySchedules = data.monthlySchedules || {};
            scheduleTemplatesV6 = data.scheduleTemplates || {}; v6SaveTemplates();
            Object.values(monthlySchedules).forEach(v6EnsureSchedule);
            saveData(); populatePositionSelects(); renderEmployees(); renderPositions(); renderShiftsList(); renderRecentShifts(); updateStats(); initScheduleUI(); renderDashboardScheduleSummary();
            if (Object.keys(shifts).length > 0) { currentShiftId = Object.keys(shifts)[0]; renderShift(); renderShiftDisplay(); }
            input.value = ''; showToast('✅ Данные восстановлены', 'success');
        } catch (error) { showToast('Ошибка чтения файла: ' + error.message, 'error'); }
    };
    reader.readAsText(input.files[0]);
}
function exportJson() {
    const data = { version: '3.0', date: new Date().toISOString(), employees, positions, shifts, monthlySchedules, scheduleTemplates: scheduleTemplatesV6 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `export_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url); showToast('📥 JSON скачан', 'success');
}

function closeScheduleProModalsV6() {
    ['scheduleShiftsModal','scheduleCycleModal','scheduleAbsenceModal','scheduleNormsModal','scheduleCopyMonthModal','scheduleDayDetailsModal'].forEach(id => document.getElementById(id)?.classList.remove('active'));
}

function initScheduleV6Enhancements() {
    v6LoadTemplates();
    Object.values(monthlySchedules || {}).forEach(v6EnsureSchedule);

    const on = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };
    on('scheduleEditShiftsBtn', 'click', openScheduleShiftsEditor);
    on('scheduleShiftsCloseModal', 'click', closeScheduleShiftsEditor);
    on('scheduleAddShiftTypeBtn', 'click', addShiftTypeV6);
    on('scheduleSaveShiftTypesBtn', 'click', saveShiftTypesV6);
    on('scheduleCycleBtn', 'click', openScheduleCycleModalV6);
    on('scheduleCycleCloseModal', 'click', closeScheduleCycleModalV6);
    on('scheduleCycleApplyBtn', 'click', applyScheduleCycleV6);
    on('scheduleApplyTemplatesBtn', 'click', applyScheduleTemplatesV6);
    on('scheduleAbsenceRangeBtn', 'click', openScheduleAbsenceModalV6);
    on('scheduleAbsenceCloseModal', 'click', closeScheduleAbsenceModalV6);
    on('scheduleAbsenceApplyBtn', 'click', applyScheduleAbsenceRangeV6);
    on('scheduleNormsBtn', 'click', openScheduleNormsModalV6);
    on('scheduleNormsCloseModal', 'click', closeScheduleNormsModalV6);
    on('scheduleNormsSaveBtn', 'click', saveScheduleNormsV6);
    on('scheduleValidateBtn', 'click', runScheduleValidationV6);
    on('scheduleUndoBtn', 'click', v6UndoSchedule);
    on('scheduleRedoBtn', 'click', v6RedoSchedule);
    on('scheduleGridSearchBtn', 'click', findScheduleEmployeeV6);
    on('scheduleGridSearch', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findScheduleEmployeeV6(); } });
    on('scheduleCopyMonthBtn', 'click', openScheduleCopyMonthModalV6);
    on('scheduleCopyMonthCloseModal', 'click', closeScheduleCopyMonthModalV6);
    on('scheduleCopyMonthApplyBtn', 'click', applyScheduleCopyMonthV6);
    on('scheduleDayDetailsCloseModal', 'click', closeScheduleDayDetailsV6);
    on('scheduleCellCommentSaveBtn', 'click', saveEditingScheduleComment);
    document.querySelectorAll('.schedule-cycle-presets [data-cycle]').forEach(btn => btn.addEventListener('click', () => {
        const [work, off] = String(btn.dataset.cycle || '3,3').split(',');
        const workInput = document.getElementById('scheduleCycleWorkDays');
        const offInput = document.getElementById('scheduleCycleOffDays');
        if (workInput) workInput.value = work;
        if (offInput) offInput.value = off;
    }));

    ['scheduleShiftsModal','scheduleCycleModal','scheduleAbsenceModal','scheduleNormsModal','scheduleCopyMonthModal','scheduleDayDetailsModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) modal.classList.remove('active'); });
    });

    document.addEventListener('paste', handleSchedulePasteV7);

    document.addEventListener('keydown', e => {
        const scheduleTabActive = document.getElementById('tab-schedule')?.classList.contains('active');
        if (!scheduleTabActive) return;
        const typing = e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
        if (e.key === 'Escape') closeScheduleProModalsV6();
        if (typing) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === 'c' && selectedScheduleCells.size) { e.preventDefault(); copySelectedScheduleCellsV6(); }
        // Ctrl+V is handled by the real 'paste' event so external clipboard data from Google Sheets / Excel is available.
        if (mod && e.key.toLowerCase() === 'v') return;
        if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); v6UndoSchedule(); }
        if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); v6RedoSchedule(); }
    });

    if (getCurrentSchedule()) renderScheduleTab();
}

document.addEventListener('DOMContentLoaded', initScheduleV6Enhancements);

// V6 override: synchronization participates in undo history.
function syncCurrentScheduleEmployees() {
    const schedule = getCurrentSchedule();
    if (!schedule) { showToast('Сначала создайте или откройте график', 'warning'); return; }
    v6PushHistory(schedule);
    let added = 0, updated = 0;
    employees.forEach(base => {
        let target = schedule.employees.find(e => e.baseId && e.baseId === base.id);
        if (!target) target = schedule.employees.find(e => normalizeEmployeeNameForMatch(e.fullName) === normalizeEmployeeNameForMatch(base.fullName));
        if (target) {
            if (target.fullName !== base.fullName || target.position !== (base.position || 'Без должности')) updated++;
            target.baseId = base.id;
            target.fullName = base.fullName;
            target.position = base.position || 'Без должности';
        } else {
            schedule.employees.push(buildManualScheduleEmployee(base, schedule.dayCount));
            added++;
        }
    });
    if (!added && !updated) {
        scheduleHistoryV6[schedule.key]?.undo?.pop();
        v6UpdateHistoryButtons();
        showToast('Сотрудники уже синхронизированы', 'info');
        return;
    }
    v6EnsureSchedule(schedule);
    v6AfterMutation(schedule, `✅ Синхронизация: добавлено ${added}, обновлено ${updated}`);
}


// V6 override: the color editor shows only actual editable shift presets of the month.
function getAvailableScheduleWorkTimes(schedule) {
    return v6GetShiftTypes(schedule).map(type => type.time);
}
