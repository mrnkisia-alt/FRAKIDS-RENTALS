/**
 * ==========================================
 * APARTTRACK — CORE LOGIC
 * ==========================================
 */

// ----- INITIAL DATA & STATE ----- //
const DEFAULT_UNITS = [
  { id: 'Shop 1', type: 'Shop', defaultExpected: 3500 },
  { id: 'Shop 2', type: 'Shop', defaultExpected: 3500 },
  { id: 'Shop 3', type: 'Shop', defaultExpected: 3500 },
  { id: 'Shop 4', type: 'Shop', defaultExpected: 3500 },
  { id: 'Unit 1A', type: 'House Block 1', defaultExpected: 4000 },
  { id: 'Unit 1B', type: 'House Block 1', defaultExpected: 4000 },
  { id: 'Unit 1C', type: 'House Block 1', defaultExpected: 4000 },
  { id: 'Unit 1D', type: 'House Block 1', defaultExpected: 4000 },
  { id: 'Unit 2A', type: 'House Block 2', defaultExpected: 2000 },
  { id: 'Unit 2B', type: 'House Block 2', defaultExpected: 2000 },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let appData = {
  version: '1.0',
  currentYear: new Date().getFullYear(),
  payments: {}, // Format: { "2026-January-Shop 1": { tenant: "John", expected: 15000, paid: 15000, date: "2026-01-05", notes: "" } }
  expenses: [] // Format: [ { id: "123", date: "2026-01-10", category: "Water", desc: "AWSC bill", amount: 2000 } ]
};

let currentMonthIndex = new Date().getMonth();
let currentPage = 'dashboard';
let incomeChartInstance = null;
let statusChartInstance = null;

// ----- INITIALIZATION ----- //
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupUI();
  setupEventListeners();
  renderPage(currentPage);
});

function loadData() {
  const stored = localStorage.getItem('aparttrack_data');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      appData = { ...appData, ...parsed };
    } catch(e) { console.error("Error loading data", e); }
  }
}

function saveData() {
  localStorage.setItem('aparttrack_data', JSON.stringify(appData));
  showToast('Data saved locally');
}

// ----- UI SETUP ----- //
function setupUI() {
  // Theme
  const isDark = localStorage.getItem('aparttrack_theme') === 'dark' || (!localStorage.getItem('aparttrack_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeIcon').innerText = '☀️';
    document.getElementById('themeToggle').innerHTML = '<span id="themeIcon">☀️</span> Light Mode';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeToggle').innerHTML = '<span id="themeIcon">🌙</span> Dark Mode';
  }

  // Populate Selectors
  const currYear = appData.currentYear;
  const yearOptions = [currYear-1, currYear, currYear+1, currYear+2];
  
  populateSelect('globalYear', yearOptions, currYear);
  populateSelect('chartYear', yearOptions, currYear);
  populateSelect('dashMonth', MONTHS, MONTHS[currentMonthIndex], true);
  populateSelect('unitMonthFilter', MONTHS, MONTHS[currentMonthIndex], true);
  
  // Custom for expense and report month
  const mOptions = ['All Months', ...MONTHS];
  populateSelect('expenseMonth', mOptions, MONTHS[currentMonthIndex]);
  populateSelect('reportMonth', MONTHS, MONTHS[currentMonthIndex]);

  // Generate Month Tabs
  const tabsWrap = document.getElementById('monthTabs');
  MONTHS.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.className = `month-tab ${i === currentMonthIndex ? 'active' : ''}`;
    btn.innerText = m;
    btn.dataset.index = i;
    btn.onclick = () => {
      document.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentMonthIndex = i;
      renderMonthlyTable();
    };
    tabsWrap.appendChild(btn);
  });
}

function populateSelect(id, array, selectedValue, isIndex = false) {
  const select = document.getElementById(id);
  if(!select) return;
  select.innerHTML = '';
  array.forEach((item, idx) => {
    const val = isIndex ? idx : item;
    const txt = item;
    const opt = document.createElement('option');
    opt.value = val;
    opt.innerText = txt;
    if (txt == selectedValue || val == selectedValue) opt.selected = true;
    select.appendChild(opt);
  });
}

// ----- EVENT LISTENERS ----- //
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentPage = item.dataset.page;
      renderPage(currentPage);
      if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Mobile Menu
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
  });
  document.getElementById('mainContent').addEventListener('click', () => {
    if(window.innerWidth <= 768) sidebar.classList.remove('open');
  });

  // Theme Toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    if(isDark) {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('aparttrack_theme', 'light');
      document.getElementById('themeToggle').innerHTML = '<span id="themeIcon">🌙</span> Dark Mode';
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('aparttrack_theme', 'dark');
      document.getElementById('themeToggle').innerHTML = '<span id="themeIcon">☀️</span> Light Mode';
    }
    if (incomeChartInstance) incomeChartInstance.update();
    if (statusChartInstance) statusChartInstance.update();
  });

  // Global Year Change
  document.getElementById('globalYear').addEventListener('change', (e) => {
    appData.currentYear = parseInt(e.target.value);
    document.getElementById('chartYear').value = appData.currentYear;
    saveData();
    renderPage(currentPage);
  });

  // Dashboard Selectors
  document.getElementById('dashMonth').addEventListener('change', renderDashboardCards);
  document.getElementById('chartYear').addEventListener('change', (e) => { renderDashboardCharts(parseInt(e.target.value)); });

  // Add Payment Button
  document.getElementById('topActionBtn').addEventListener('click', () => {
    document.querySelector('.nav-item[data-page="monthly"]').click();
  });

  // Unit Search & Filter
  document.getElementById('unitSearch').addEventListener('input', renderUnitsPage);
  document.getElementById('unitFilter').addEventListener('change', renderUnitsPage);
  document.getElementById('unitMonthFilter').addEventListener('change', renderUnitsPage);
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    if(e.target.value.length > 0 && currentPage !== 'units') {
      document.querySelector('.nav-item[data-page="units"]').click();
    }
    document.getElementById('unitSearch').value = e.target.value;
    renderUnitsPage();
  });

  // Expenses
  document.getElementById('expenseMonth').addEventListener('change', renderExpensesPage);
  document.getElementById('addExpenseBtn').addEventListener('click', openExpenseModal);

  // Reports Tabs
  document.querySelectorAll('.tab-btn[data-report]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn[data-report]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.report-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`report-${btn.dataset.report}`).classList.add('active');
      if (btn.dataset.report === 'monthly') renderMonthlyReport();
      else renderYearlyReport();
    });
  });
  document.getElementById('reportMonth').addEventListener('change', renderMonthlyReport);

  // Modals
  document.getElementById('modalClose').addEventListener('click', () => closePaymentModal());
  document.getElementById('modalCancel').addEventListener('click', () => closePaymentModal());
  document.getElementById('expModalClose').addEventListener('click', () => closeExpenseModal());
  document.getElementById('expModalCancel').addEventListener('click', () => closeExpenseModal());

  // Form submits
  document.getElementById('modalSave').addEventListener('click', savePaymentRecord);
  document.getElementById('expModalSave').addEventListener('click', saveExpenseRecord);

  // Exports (Using native window.print for PDF and simple CSV export as basic option, leveraging jsPDF if wanted)
  document.getElementById('exportMonthCSV').addEventListener('click', () => exportToCSV('monthly'));
  document.getElementById('exportReportCSV').addEventListener('click', () => exportToCSV('monthlyReport'));
  document.getElementById('exportYearlyCSV').addEventListener('click', () => exportToCSV('yearlyReport'));
  
  // Basic PDF export relying on window.print for simplicity, or we can use jsPDF plugin
  document.getElementById('exportMonthPDF').addEventListener('click', () => generatePDF('monthlyTable', `Monthly_Report_${MONTHS[currentMonthIndex]}_${appData.currentYear}`));
  document.getElementById('exportReportPDF').addEventListener('click', () => generatePDF('reportTable', `Detailed_Monthly_${document.getElementById('reportMonth').value}_${appData.currentYear}`));
  document.getElementById('exportYearlyPDF').addEventListener('click', () => generatePDF('yearlyTable', `Yearly_Report_${appData.currentYear}`));
}


// ----- ROUTING & RENDERING ----- //

function renderPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');

  const titles = { dashboard: 'Dashboard', monthly: 'Monthly Tracking', units: 'Units Directory', expenses: 'Expenses Tracker', reports: 'Financial Reports' };
  document.getElementById('pageTitle').innerText = titles[pageId];

  switch(pageId) {
    case 'dashboard': renderDashboard(); break;
    case 'monthly': renderMonthlyTable(); break;
    case 'units': renderUnitsPage(); break;
    case 'expenses': renderExpensesPage(); break;
    case 'reports': 
      const activeTab = document.querySelector('.tab-btn.active').dataset.report;
      if(activeTab === 'monthly') renderMonthlyReport(); else renderYearlyReport();
      break;
  }
}

// ----- HELPERS ----- //

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount);
}

function getPaymentKey(year, monthName, unitId) {
  return `${year}-${monthName}-${unitId}`;
}

function getPaymentRecord(year, monthName, unit) {
  const key = getPaymentKey(year, monthName, unit.id);
  const record = appData.payments[key];
  if (record) return record;
  // Make a temp one for display
  return { tenant: '-', expected: unit.defaultExpected, paid: 0, date: '', notes: '' };
}

function calculateStatus(expected, paid) {
  paid = Number(paid); expected = Number(expected);
  if (expected === 0 && paid === 0) return 'unpaid';
  if (paid >= expected) return 'paid';
  if (paid > 0 && paid < expected) return 'partial';
  return 'unpaid';
}

function getStatusBadgeHtml(status) {
  if (status === 'paid') return `<span class="badge badge-paid">Paid</span>`;
  if (status === 'partial') return `<span class="badge badge-partial">Partial</span>`;
  return `<span class="badge badge-unpaid">Unpaid</span>`;
}


// ----- PAGES RENDERING ----- //

// DASHBOARD
function renderDashboard() {
  renderDashboardCards();
  renderDashboardCharts(appData.currentYear);
}

function renderDashboardCards() {
  const monthIndex = document.getElementById('dashMonth').value;
  const monthName = MONTHS[monthIndex];
  document.getElementById('dashMonthLabel').innerText = monthName;

  let totalIncomeMonth = 0;
  let totalIncomeYear = 0;
  let totalUnpaidMonth = 0;
  let totalExpensesMonth = 0;

  // Month stats
  DEFAULT_UNITS.forEach(unit => {
    const rec = getPaymentRecord(appData.currentYear, monthName, unit);
    totalIncomeMonth += Number(rec.paid || 0);
    const balance = Number(rec.expected || 0) - Number(rec.paid || 0);
    if(balance > 0) totalUnpaidMonth += balance;
  });

  // Year stats
  MONTHS.forEach(m => {
    DEFAULT_UNITS.forEach(unit => {
      const rec = getPaymentRecord(appData.currentYear, m, unit);
      totalIncomeYear += Number(rec.paid || 0);
    });
  });

  // Expense stats
  appData.expenses.forEach(exp => {
    if(exp.date){
      const parts = exp.date.split('-');
      if (parseInt(parts[0]) == appData.currentYear && (parseInt(parts[1]) - 1) == monthIndex) {
        totalExpensesMonth += Number(exp.amount || 0);
      }
    }
  });

  const cardsHtml = `
    <div class="stat-card blue">
      <div class="stat-icon">💰</div>
      <div class="stat-label">Total Monthly Income (${monthName})</div>
      <div class="stat-value">${formatCurrency(totalIncomeMonth)}</div>
      <div class="stat-sub">Current Month Collections</div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon">📅</div>
      <div class="stat-label">Total Yearly Income (${appData.currentYear})</div>
      <div class="stat-value">${formatCurrency(totalIncomeYear)}</div>
      <div class="stat-sub">All months combined</div>
    </div>
    <div class="stat-card red">
      <div class="stat-icon">⚠️</div>
      <div class="stat-label">Unpaid Balances (${monthName})</div>
      <div class="stat-value">${formatCurrency(totalUnpaidMonth)}</div>
      <div class="stat-sub">Expected but not collected</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-icon">💸</div>
      <div class="stat-label">Monthly Expenses (${monthName})</div>
      <div class="stat-value">${formatCurrency(totalExpensesMonth)}</div>
      <div class="stat-sub">Net Profit: ${formatCurrency(totalIncomeMonth - totalExpensesMonth)}</div>
    </div>
  `;
  document.getElementById('summaryCards').innerHTML = cardsHtml;

  // Render Unit Grid
  const gridHtml = DEFAULT_UNITS.map(unit => {
    const rec = getPaymentRecord(appData.currentYear, monthName, unit);
    const status = calculateStatus(rec.expected, rec.paid);
    return `
      <div class="unit-card ${status}" onclick="handleUnitClick('${unit.id}', '${monthName}')">
        <div class="unit-badge">${status}</div>
        <div class="unit-card-name">${unit.id}</div>
        <div class="unit-card-tenant">${rec.tenant}</div>
        <div class="unit-card-amount">${formatCurrency(rec.paid)}</div>
      </div>
    `;
  }).join('');
  document.getElementById('unitStatusGrid').innerHTML = gridHtml;
}

function handleUnitClick(unitId, monthName) {
  // Jump to monthly page and open edit modal
  currentMonthIndex = MONTHS.indexOf(monthName);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-page="monthly"]').classList.add('active');
  currentPage = 'monthly';
  renderPage('monthly');
  openPaymentModal(unitId, monthName, appData.currentYear);
}


function renderDashboardCharts(year) {
  const chartColorText = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#64748b';
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)';

  Chart.defaults.color = chartColorText;
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Data Gathering
  const monthlyIncomes = [];
  const monthlyExpenses = [];
  let counts = { paid: 0, partial: 0, unpaid: 0 };

  const currentDashMonth = MONTHS[document.getElementById('dashMonth').value] || MONTHS[currentMonthIndex];

  MONTHS.forEach((m, idx) => {
    let inc = 0, exp = 0;
    DEFAULT_UNITS.forEach(u => inc += Number(getPaymentRecord(year, m, u).paid || 0));
    
    appData.expenses.forEach(e => {
      if(e.date) {
        const parts = e.date.split('-');
        if(parseInt(parts[0]) === year && (parseInt(parts[1]) - 1) === idx) exp += Number(e.amount || 0);
      }
    });

    monthlyIncomes.push(inc);
    monthlyExpenses.push(exp);

    // Status mapping for current dash month only
    if (m === currentDashMonth) {
      DEFAULT_UNITS.forEach(u => {
        const r = getPaymentRecord(year, currentDashMonth, u);
        counts[calculateStatus(r.expected, r.paid)]++;
      });
    }
  });


  // Bar Chart
  const ctxInc = document.getElementById('incomeChart');
  if (incomeChartInstance) incomeChartInstance.destroy();
  incomeChartInstance = new Chart(ctxInc, {
    type: 'bar',
    data: {
      labels: MONTHS.map(m=>m.substring(0,3)),
      datasets: [
        { label: 'Income', data: monthlyIncomes, backgroundColor: '#6366f1', borderRadius: 4 },
        { label: 'Expenses', data: monthlyExpenses, backgroundColor: '#f59e0b', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { border: { display: false }, grid: { color: gridColor }, beginAtZero: true }
      },
      plugins: { legend: { position: 'top' } }
    }
  });

  // Pie Chart
  const ctxStat = document.getElementById('statusChart');
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctxStat, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Partial', 'Unpaid'],
      datasets: [{
        data: [counts.paid, counts.partial, counts.unpaid],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '60%'
    }
  });
}


// MONTHLY TRACKING
function renderMonthlyTable() {
  const monthName = MONTHS[currentMonthIndex];
  document.getElementById('monthlyTableTitle').innerText = `${monthName} ${appData.currentYear} Tracking`;

  const tbody = document.getElementById('monthlyTableBody');
  const tfoot = document.getElementById('monthlyTableFoot');
  
  let html = '';
  let sumExpected = 0, sumPaid = 0, sumBalance = 0;

  DEFAULT_UNITS.forEach(unit => {
    const rec = getPaymentRecord(appData.currentYear, monthName, unit);
    const expected = Number(rec.expected);
    const paid = Number(rec.paid);
    const balance = expected - paid;
    const status = calculateStatus(expected, paid);
    
    sumExpected += expected; sumPaid += paid; sumBalance += balance;

    html += `
      <tr class="${status === 'unpaid' ? 'unpaid-row' : ''}">
        <td class="fw-bold">${unit.id}</td>
        <td>${rec.tenant || '<span class="text-muted">Vacant</span>'}</td>
        <td>${formatCurrency(expected)}</td>
        <td>${formatCurrency(paid)}</td>
        <td class="${balance > 0 ? 'text-danger fw-bold' : ''}">${formatCurrency(balance)}</td>
        <td>${getStatusBadgeHtml(status)}</td>
        <td>${rec.date ? rec.date.split('-').reverse().join('/') : '-'}</td>
        <td>
          <button class="btn-icon" onclick="openPaymentModal('${unit.id}', '${monthName}', ${appData.currentYear})" title="Edit Payment">✏️</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  tfoot.innerHTML = `
    <tr>
      <td colspan="2" class="text-right">TOTAL</td>
      <td>${formatCurrency(sumExpected)}</td>
      <td class="text-success">${formatCurrency(sumPaid)}</td>
      <td class="${sumBalance > 0 ? 'text-danger' : ''}">${formatCurrency(sumBalance)}</td>
      <td colspan="3"></td>
    </tr>
  `;
}

// UNITS PAGE
function renderUnitsPage() {
  const searchTerm = document.getElementById('unitSearch').value.toLowerCase();
  const filterStatus = document.getElementById('unitFilter').value;
  const monthIndex = document.getElementById('unitMonthFilter').value;
  const monthName = MONTHS[monthIndex];

  const tbody = document.getElementById('unitsTableBody');
  let html = '';

  DEFAULT_UNITS.forEach(unit => {
    const rec = getPaymentRecord(appData.currentYear, monthName, unit);
    const status = calculateStatus(rec.expected, rec.paid);
    
    // Filters
    if (filterStatus !== 'all' && status !== filterStatus) return;
    if (searchTerm && !unit.id.toLowerCase().includes(searchTerm) && !(rec.tenant && rec.tenant.toLowerCase().includes(searchTerm))) return;

    html += `
      <tr class="${status === 'unpaid' ? 'unpaid-row' : ''}">
        <td class="fw-bold">${unit.id}</td>
        <td><span style="font-size:12px;color:var(--text2)">${unit.type}</span></td>
        <td>${rec.tenant || '-'}</td>
        <td>${formatCurrency(rec.expected)}</td>
        <td>${formatCurrency(rec.paid)}</td>
        <td>${formatCurrency(rec.expected - rec.paid)}</td>
        <td>${getStatusBadgeHtml(status)}</td>
        <td>${rec.date ? rec.date.split('-').reverse().join('/') : '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="handleUnitClick('${unit.id}', '${monthName}')">Update</button>
        </td>
      </tr>
    `;
  });

  if (html === '') html = `<tr><td colspan="9" class="empty-state">No units found matching criteria.</td></tr>`;
  tbody.innerHTML = html;
}

// EXPENSES PAGE
function renderExpensesPage() {
  const filterVal = document.getElementById('expenseMonth').value;
  const tbody = document.getElementById('expensesTableBody');
  
  let filtered = appData.expenses.filter(e => {
    if(!e.date) return false;
    return parseInt(e.date.split('-')[0]) === appData.currentYear;
  });
  if (filterVal !== 'All Months') {
    document.getElementById('expMonthLabel').innerText = filterVal;
    const mIdx = MONTHS.indexOf(filterVal);
    filtered = filtered.filter(e => (parseInt(e.date.split('-')[1]) - 1) === mIdx);
  } else {
    document.getElementById('expMonthLabel').innerText = 'All Year';
  }

  // Stats
  let totalEx = 0;
  let categoryMap = {};
  filtered.forEach(e => {
    totalEx += Number(e.amount);
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });
  
  let tops = Object.entries(categoryMap).sort((a,b)=>b[1]-a[1]);
  let topCat = tops.length ? tops[0][0] : '-';
  
  document.getElementById('expenseStats').innerHTML = `
    <div class="stat-card yellow">
      <div class="stat-label">Total Selected Expenses</div>
      <div class="stat-value">${formatCurrency(totalEx)}</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Highest Category</div>
      <div class="stat-value" style="font-size:20px;margin-top:6px">${topCat}</div>
      <div class="stat-sub">${tops.length ? formatCurrency(tops[0][1]) : ''}</div>
    </div>
    <div class="stat-card red">
      <div class="stat-label">Expense Count</div>
      <div class="stat-value">${filtered.length}</div>
    </div>
  `;

  // Table
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
  let html = '';
  filtered.forEach(e => {
    html += `
      <tr>
        <td>${e.date ? e.date.split('-').reverse().join('/') : '-'}</td>
        <td><span class="badge" style="background:var(--bg2);color:var(--text)">${e.category}</span></td>
        <td>${e.desc}</td>
        <td class="fw-bold">${formatCurrency(e.amount)}</td>
        <td>
          <button class="btn-icon danger" onclick="deleteExpense('${e.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
  if(!html) html = `<tr><td colspan="5" class="empty-state">No expenses recorded.</td></tr>`;
  tbody.innerHTML = html;
}

// REPORTS PAGE
function renderMonthlyReport() {
  const monthName = document.getElementById('reportMonth').value;
  document.getElementById('reportMonthLabel').innerText = monthName;

  let totalInc=0, totalExp=0, expected=0;

  // Income
  const tbody = document.getElementById('reportTableBody');
  let rowHtml='';
  DEFAULT_UNITS.forEach(u => {
    const r = getPaymentRecord(appData.currentYear, monthName, u);
    totalInc += Number(r.paid); expected += Number(r.expected);
    const bal = r.expected - r.paid;
    rowHtml += `
      <tr>
        <td>${u.id}</td><td>${r.tenant||'-'}</td><td>${formatCurrency(r.expected)}</td>
        <td>${formatCurrency(r.paid)}</td><td class="${bal>0?'text-danger':''}">${formatCurrency(bal)}</td>
        <td>${getStatusBadgeHtml(calculateStatus(r.expected,r.paid))}</td>
      </tr>
    `;
  });
  tbody.innerHTML = rowHtml;

  // Expenses
  const mIdx = MONTHS.indexOf(monthName);
  appData.expenses.forEach(e => {
    if(e.date) {
      const parts = e.date.split('-');
      if(parseInt(parts[0])===appData.currentYear && (parseInt(parts[1])-1)===mIdx) totalExp += Number(e.amount);
    }
  });

  const net = totalInc - totalExp;
  document.getElementById('reportStats').innerHTML = `
    <div class="stat-card blue"><div class="stat-label">Collected Income</div><div class="stat-value">${formatCurrency(totalInc)}</div><div class="stat-sub">Expected: ${formatCurrency(expected)}</div></div>
    <div class="stat-card yellow"><div class="stat-label">Total Expenses</div><div class="stat-value">${formatCurrency(totalExp)}</div></div>
    <div class="stat-card green"><div class="stat-label">Net Profit</div><div class="stat-value ${net<0?'text-danger':''}">${formatCurrency(net)}</div></div>
  `;
}

function renderYearlyReport() {
  let yrInc=0, yrExp=0;
  const tbody = document.getElementById('yearlyTableBody');
  let html = '';

  MONTHS.forEach((m, idx) => {
    let inc=0, exp=0, expc=0;
    DEFAULT_UNITS.forEach(u => {
      const r = getPaymentRecord(appData.currentYear, m, u);
      inc += Number(r.paid); expc += Number(r.expected);
    });
    appData.expenses.forEach(e => {
       if(e.date) {
         const parts = e.date.split('-');
         if(parseInt(parts[0])===appData.currentYear && (parseInt(parts[1])-1)===idx) exp += Number(e.amount);
       }
    });

    yrInc+=inc; yrExp+=exp;
    const net = inc - exp;
    
    html += `
      <tr>
        <td class="fw-bold">${m}</td>
        <td class="text-success">${formatCurrency(inc)}</td>
        <td class="text-warning">${formatCurrency(exp)}</td>
        <td class="${net<0?'text-danger':'fw-bold'}">${formatCurrency(net)}</td>
        <td>${((inc/(expc||1))*100).toFixed(0)}%</td>
        <td class="text-danger">${formatCurrency(expc-inc)}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  document.getElementById('yearlyStats').innerHTML = `
    <div class="stat-card green"><div class="stat-label">Gross Income (${appData.currentYear})</div><div class="stat-value">${formatCurrency(yrInc)}</div></div>
    <div class="stat-card yellow"><div class="stat-label">Total Expenses</div><div class="stat-value">${formatCurrency(yrExp)}</div></div>
    <div class="stat-card blue"><div class="stat-label">Net Profit</div><div class="stat-value">${formatCurrency(yrInc-yrExp)}</div></div>
  `;
}


// ----- MODALS & FORMS ----- //

function openPaymentModal(unitId, monthName, year) {
  const rec = getPaymentRecord(year, monthName, {id: unitId, defaultExpected: DEFAULT_UNITS.find(u=>u.id===unitId).defaultExpected});
  
  document.getElementById('payUnit').value = unitId;
  document.getElementById('payMonth').value = monthName;
  document.getElementById('payYear').value = year;

  document.getElementById('modalTitle').innerText = `Edit Payment - ${monthName} ${year}`;
  document.getElementById('payUnitDisplay').value = unitId;
  document.getElementById('payTenant').value = rec.tenant !== '-' ? rec.tenant : '';
  document.getElementById('payExpected').value = rec.expected;
  document.getElementById('payAmount').value = rec.paid;
  document.getElementById('payDate').value = rec.date;
  document.getElementById('payNotes').value = rec.notes || '';

  document.getElementById('paymentModal').classList.add('open');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('open');
}

function savePaymentRecord() {
  const unitId = document.getElementById('payUnit').value;
  const monthName = document.getElementById('payMonth').value;
  const year = document.getElementById('payYear').value;

  const tenant = document.getElementById('payTenant').value.trim();
  if(!tenant) return showToast('Tenant name is required', 'error');

  const key = getPaymentKey(year, monthName, unitId);
  appData.payments[key] = {
    tenant: tenant,
    expected: Number(document.getElementById('payExpected').value) || 0,
    paid: Number(document.getElementById('payAmount').value) || 0,
    date: document.getElementById('payDate').value,
    notes: document.getElementById('payNotes').value
  };

  saveData();
  closePaymentModal();
  
  // Re-render current views
  if(currentPage === 'dashboard') renderDashboard();
  if(currentPage === 'monthly') renderMonthlyTable();
  if(currentPage === 'units') renderUnitsPage();
  
  showToast('Payment updated successfully', 'success');
}

function openExpenseModal() {
  document.getElementById('expenseForm').reset();
  document.getElementById('expDate').valueAsDate = new Date();
  document.getElementById('expenseModal').classList.add('open');
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('open');
}

function saveExpenseRecord() {
  const date = document.getElementById('expDate').value;
  const category = document.getElementById('expCategory').value;
  const desc = document.getElementById('expDesc').value.trim();
  const amount = Number(document.getElementById('expAmount').value) || 0;

  if(!date || !desc || amount <= 0) return showToast('Please fill all required fields correctly', 'error');

  appData.expenses.push({
    id: Date.now().toString(),
    date, category, desc, amount
  });

  saveData();
  closeExpenseModal();
  if(currentPage === 'expenses') renderExpensesPage();
  showToast('Expense added', 'success');
}

function deleteExpense(id) {
  if(confirm('Are you sure you want to delete this expense?')) {
    appData.expenses = appData.expenses.filter(e => e.id !== id);
    saveData();
    renderExpensesPage();
    showToast('Expense deleted', 'info');
  }
}

// ----- TOAST ALERTS ----- //
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}


// ----- PDF & CSV EXPORTS ----- //

function exportToCSV(type) {
  let csvContent = "data:text/csv;charset=utf-8,";
  let tableId = '';
  let filename = '';

  if (type === 'monthly') { tableId = 'monthlyTable'; filename = `Monthly_${MONTHS[currentMonthIndex]}_${appData.currentYear}.csv`; }
  if (type === 'monthlyReport') { tableId = 'reportTable'; filename = `Detailed_Report_${document.getElementById('reportMonth').value}_${appData.currentYear}.csv`; }
  if (type === 'yearlyReport') { tableId = 'yearlyTable'; filename = `Yearly_Report_${appData.currentYear}.csv`; }

  const table = document.getElementById(tableId);
  if(!table) return;

  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    let rowData = [];
    row.querySelectorAll('th, td').forEach(cell => {
      // Clean string
      let txt = cell.innerText.replace(/"/g, '""').replace(/KES/g, '').trim();
      rowData.push(`"${txt}"`);
    });
    csvContent += rowData.join(',') + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV Exported', 'success');
}

function generatePDF(tableId, title) {
  if (typeof window.jspdf !== 'undefined') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`FRAKIDS RENTAL INCOME - ${title.replace(/_/g, ' ')}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    doc.autoTable({
      html: `#${tableId}`,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`${title}.pdf`);
    showToast('PDF Downloaded successfully', 'success');
  } else {
    // Fallback if jsPDF is not loaded
    window.print();
  }
}
