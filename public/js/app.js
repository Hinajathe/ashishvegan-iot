// ==============================================================
// Aaditya Kayande IoT Dashboard - Client Script
// Timezone: +5:30 Asia/Kolkata
// ==============================================================

// Global State
let currentPage = 1;
const recordsPerPage = 20;
let historyChart = null;
let currentLedState = 0;
let autoPollTimer = null;
let currentToken = localStorage.getItem('iot_auth_token') || null;
let currentUser = null;

// Initial bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initChart();
  checkAuth();
  
  // Initial data loads
  fetchLatestSensorData();
  loadRecordsTable(1);
  fetchHistoryChart();
  fetchDeviceState();

  // Periodic Auto-refresh (Every 10 seconds per requirements)
  autoPollTimer = setInterval(() => {
    fetchLatestSensorData();
    fetchDeviceState();
    fetchHistoryChart();
  }, 10000);
});

// ==============================================================
// 1. LIVE KOLKATA CLOCK (+05:30)
// ==============================================================
function initClock() {
  function update() {
    const now = new Date();
    const kolkataFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const clockEl = document.getElementById('kolkataLiveClock');
    if (clockEl) {
      clockEl.textContent = kolkataFormatter.format(now);
    }
  }
  update();
  setInterval(update, 1000);
}

// ==============================================================
// 2. TAB SWITCHING
// ==============================================================
function switchTab(tabId) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  
  // Reset all nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-brand-400', 'text-brand-300', 'bg-brand-950/40', 'border-b-2');
    btn.classList.add('text-gray-400', 'border-transparent');
  });

  // Show active tab
  const activeTab = document.getElementById(tabId);
  if (activeTab) {
    activeTab.classList.remove('hidden');
  }

  // Activate button
  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-400', 'border-transparent');
    activeBtn.classList.add('border-brand-400', 'text-brand-300', 'bg-brand-950/40', 'border-b-2');
  }

  // Re-render chart if switching to tab-env
  if (tabId === 'tab-env' && historyChart) {
    setTimeout(() => historyChart.resize(), 100);
  }
}

// ==============================================================
// 3. TAB 1: SENSOR DATA, GAUGES, SEEK BARS & CHART
// ==============================================================

// Fetch Latest Sensor Reading for Gauge & Seek Bar
async function fetchLatestSensorData() {
  try {
    const res = await fetch('/api/sensor-data/latest');
    const result = await res.json();

    if (result.success && result.hasData) {
      updateGaugeAndSeekBar(result.data.temperature, result.data.humidity);
    }
  } catch (err) {
    console.warn('Failed to poll latest sensor data:', err);
  }
}

// Innovative Gauge and Seek Bar Renderer
function updateGaugeAndSeekBar(temp, hum) {
  // 1. Temperature Calculation (Scale: 0 to 50 C)
  const tempClamped = Math.max(0, Math.min(50, temp));
  const tempPercent = (tempClamped / 50) * 100;
  
  // Arc length is 251.2. Offset goes from 251.2 (0%) to 0 (100%)
  const tempOffset = 251.2 - (251.2 * (tempPercent / 100));
  
  const tempArc = document.getElementById('tempArcFill');
  if (tempArc) tempArc.style.strokeDashoffset = tempOffset;

  const tempVal = document.getElementById('displayTemperature');
  if (tempVal) tempVal.textContent = temp.toFixed(1);

  const tempSeek = document.getElementById('tempSeekPointer');
  if (tempSeek) tempSeek.style.left = `${tempPercent}%`;

  const tempSeekVal = document.getElementById('tempSeekVal');
  if (tempSeekVal) tempSeekVal.textContent = `${temp.toFixed(1)} °C`;

  // Status Badge for Temp
  const tempBadge = document.getElementById('tempStatusBadge');
  if (tempBadge) {
    if (temp < 18) {
      tempBadge.textContent = 'Cool';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30';
    } else if (temp <= 29) {
      tempBadge.textContent = 'Optimal';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30';
    } else if (temp <= 36) {
      tempBadge.textContent = 'Warm';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-semibold border border-yellow-500/30';
    } else {
      tempBadge.textContent = 'Hot Alert';
      tempBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-semibold border border-red-500/30';
    }
  }

  // 2. Humidity Calculation (Scale: 0 to 100 %)
  const humClamped = Math.max(0, Math.min(100, hum));
  const humOffset = 251.2 - (251.2 * (humClamped / 100));

  const humArc = document.getElementById('humArcFill');
  if (humArc) humArc.style.strokeDashoffset = humOffset;

  const humVal = document.getElementById('displayHumidity');
  if (humVal) humVal.textContent = hum.toFixed(1);

  const humSeek = document.getElementById('humSeekPointer');
  if (humSeek) humSeek.style.left = `${humClamped}%`;

  const humSeekVal = document.getElementById('humSeekVal');
  if (humSeekVal) humSeekVal.textContent = `${hum.toFixed(1)} %`;

  // Status Badge for Humidity
  const humBadge = document.getElementById('humStatusBadge');
  if (humBadge) {
    if (hum < 30) {
      humBadge.textContent = 'Dry';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-semibold border border-yellow-500/30';
    } else if (hum <= 65) {
      humBadge.textContent = 'Comfortable';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30';
    } else {
      humBadge.textContent = 'High Moisture';
      humBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30';
    }
  }
}

// Chart.js Real-time Trend Graph
function initChart() {
  const ctx = document.getElementById('sensorHistoryChart');
  if (!ctx) return;

  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#34d399',
          yAxisID: 'yTemp'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#14b8a6',
          backgroundColor: 'rgba(20, 184, 166, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2dd4bf',
          yAxisID: 'yHum'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#cbd5e1',
            font: { size: 11, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: '#0c1a14',
          borderColor: '#1e4034',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(16, 185, 129, 0.07)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 55,
          grid: { color: 'rgba(16, 185, 129, 0.1)' },
          ticks: {
            color: '#10b981',
            font: { size: 10 },
            callback: (v) => `${v}°C`
          }
        },
        yHum: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#14b8a6',
            font: { size: 10 },
            callback: (v) => `${v}%`
          }
        }
      }
    }
  });
}

async function fetchHistoryChart() {
  if (!historyChart) return;
  try {
    const res = await fetch('/api/sensor-data/history?limit=30');
    const result = await res.json();
    if (result.success && result.history) {
      const labels = result.history.map(r => r.time);
      const temps = result.history.map(r => r.temperature);
      const hums = result.history.map(r => r.humidity);

      historyChart.data.labels = labels;
      historyChart.data.datasets[0].data = temps;
      historyChart.data.datasets[1].data = hums;
      historyChart.update('none'); // Update without heavy full re-render
    }
  } catch (err) {
    console.warn('Failed to load chart history:', err);
  }
}

// --------------------------------------------------------------
// SECTION 2: SAVED RECORDS TABLE WITH PAGINATION
// --------------------------------------------------------------
async function loadRecordsTable(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('recordsTableBody');
  const paginationControls = document.getElementById('paginationControls');
  const paginationInfo = document.getElementById('paginationInfo');

  try {
    const res = await fetch(`/api/sensor-data?page=${page}&limit=${recordsPerPage}`);
    const result = await res.json();

    if (!result.success || !result.records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-gray-400">
            <i class="fa-solid fa-inbox text-2xl mb-2 text-gray-500 block"></i>
            No records found. Click <strong>"Simulate DHT11 Push"</strong> or connect your ESP8266 to start logging!
          </td>
        </tr>
      `;
      if (paginationControls) paginationControls.innerHTML = '';
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 records';
      return;
    }

    // Render Table Rows (Latest records first)
    tbody.innerHTML = result.records.map(record => {
      // Temperature badge style
      let tempClass = 'text-emerald-400 font-bold';
      if (record.temperature > 35) tempClass = 'text-red-400 font-bold';
      else if (record.temperature < 20) tempClass = 'text-blue-400 font-bold';

      return `
        <tr class="hover:bg-[#12281e] transition border-b border-brand-950">
          <td class="py-3 px-4 font-mono text-gray-400">#${record.id}</td>
          <td class="py-3 px-4 ${tempClass}">
            <span class="inline-flex items-center gap-1.5">
              <i class="fa-solid fa-temperature-half text-xs"></i>
              ${record.temperature.toFixed(1)} °C
            </span>
          </td>
          <td class="py-3 px-4 text-teal-300 font-medium">
            <span class="inline-flex items-center gap-1.5">
              <i class="fa-solid fa-droplet text-xs text-teal-400"></i>
              ${record.humidity.toFixed(1)} %
            </span>
          </td>
          <td class="py-3 px-4 text-gray-300 font-mono">
            ${record.time}
          </td>
          <td class="py-3 px-4 text-gray-400 font-mono">
            ${record.date}
          </td>
          <td class="py-3 px-4 text-center">
            <button 
              onclick="deleteRecord(${record.id})" 
              class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title="Delete Record #${record.id}"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination info
    const { totalRecords, totalPages } = result.pagination;
    const startRecord = (page - 1) * recordsPerPage + 1;
    const endRecord = Math.min(page * recordsPerPage, totalRecords);
    
    if (paginationInfo) {
      paginationInfo.innerHTML = `Showing <strong class="text-white font-mono">${startRecord}-${endRecord}</strong> of <strong class="text-white font-mono">${totalRecords}</strong> records (Page ${page} of ${totalPages})`;
    }

    // Render Pagination Buttons
    if (paginationControls) {
      let buttonsHtml = '';

      // Prev Button
      buttonsHtml += `
        <button 
          onclick="loadRecordsTable(${page - 1})" 
          ${page <= 1 ? 'disabled class="px-3 py-1.5 text-xs rounded-lg bg-[#0e1d17] text-gray-600 cursor-not-allowed border border-brand-900/40"' : 'class="px-3 py-1.5 text-xs rounded-lg bg-[#142820] text-gray-300 hover:bg-brand-900/50 hover:text-white border border-brand-800/60 transition"'}
        >
          <i class="fa-solid fa-chevron-left mr-1"></i> Prev
        </button>
      `;

      // Page numbers (Window around current page)
      const maxButtons = 5;
      let startP = Math.max(1, page - 2);
      let endP = Math.min(totalPages, startP + maxButtons - 1);
      if (endP - startP < maxButtons - 1) {
        startP = Math.max(1, endP - maxButtons + 1);
      }

      for (let p = startP; p <= endP; p++) {
        if (p === page) {
          buttonsHtml += `<button class="px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white font-bold border border-brand-500 shadow-sm">${p}</button>`;
        } else {
          buttonsHtml += `<button onclick="loadRecordsTable(${p})" class="px-3 py-1.5 text-xs rounded-lg bg-[#142820] text-gray-300 hover:bg-brand-900/50 hover:text-white border border-brand-800/60 transition">${p}</button>`;
        }
      }

      // Next Button
      buttonsHtml += `
        <button 
          onclick="loadRecordsTable(${page + 1})" 
          ${page >= totalPages ? 'disabled class="px-3 py-1.5 text-xs rounded-lg bg-[#0e1d17] text-gray-600 cursor-not-allowed border border-brand-900/40"' : 'class="px-3 py-1.5 text-xs rounded-lg bg-[#142820] text-gray-300 hover:bg-brand-900/50 hover:text-white border border-brand-800/60 transition"'}
        >
          Next <i class="fa-solid fa-chevron-right ml-1"></i>
        </button>
      `;

      paginationControls.innerHTML = buttonsHtml;
    }

  } catch (err) {
    console.error('Error fetching records table:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-red-400">
          Failed to load records. Check server connection.
        </td>
      </tr>
    `;
  }
}

// Delete Record
async function deleteRecord(id) {
  if (!confirm(`Are you sure you want to delete sensor record #${id}?`)) return;

  try {
    const res = await fetch(`/api/sensor-data/${id}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
      showToast(`Record #${id} deleted successfully.`, 'success');
      loadRecordsTable(currentPage);
      fetchHistoryChart();
    } else {
      showToast(result.message || 'Failed to delete record.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting record.', 'error');
  }
}

// Quick Simulator: Injects random DHT11 data to test the dashboard
async function simulateSensorPush() {
  try {
    const res = await fetch('/api/device/simulate', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(`Simulated DHT11: ${result.data.temperature}°C, ${result.data.humidity}%`, 'success');
      updateGaugeAndSeekBar(result.data.temperature, result.data.humidity);
      loadRecordsTable(1);
      fetchHistoryChart();
    }
  } catch (err) {
    showToast('Failed to trigger simulation.', 'error');
  }
}

// Export Table to CSV
async function exportToCSV() {
  try {
    const res = await fetch('/api/sensor-data?limit=500');
    const result = await res.json();
    if (!result.success || !result.records.length) {
      showToast('No records available to export.', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Temperature (C),Humidity (%),Time (IST),Date\n';
    result.records.forEach(r => {
      csvContent += `${r.id},${r.temperature},${r.humidity},"${r.time}","${r.date}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aaditya_kayande_sensor_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sensor data exported to CSV!', 'success');
  } catch (err) {
    showToast('Failed to export CSV.', 'error');
  }
}

// ==============================================================
// 4. TAB 2: SMART LCD 16x2 CONTROLLER
// ==============================================================

// Real-time character counter and LCD matrix screen preview
function previewLcdText() {
  const row1 = document.getElementById('lcdRow1Input').value;
  const row2 = document.getElementById('lcdRow2Input').value;

  // Character counts
  document.getElementById('row1Count').textContent = `${row1.length} / 16 chars`;
  document.getElementById('row2Count').textContent = `${row2.length} / 16 chars`;

  // Display pads to 16 chars
  document.getElementById('lcdDisplayRow1').textContent = (row1 + '                ').substring(0, 16);
  document.getElementById('lcdDisplayRow2').textContent = (row2 + '                ').substring(0, 16);
}

// Presets Helper
function applyLcdPreset(row1, row2) {
  document.getElementById('lcdRow1Input').value = row1;
  document.getElementById('lcdRow2Input').value = row2;
  previewLcdText();
}

// Update LCD Form Submit
async function handleLcdUpdate(e) {
  e.preventDefault();
  const row1 = document.getElementById('lcdRow1Input').value;
  const row2 = document.getElementById('lcdRow2Input').value;
  const btn = document.getElementById('btnUpdateLcd');

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Updating...</span>';

    const res = await fetch('/api/device/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row1, row2 })
    });

    const result = await res.json();
    if (result.success) {
      showToast('Smart LCD updated! Hardware will reflect within 2 seconds.', 'success');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      document.getElementById('lcdLastSyncTime').textContent = timeStr;
    } else {
      showToast(result.message || 'Failed to update LCD.', 'error');
    }
  } catch (err) {
    showToast('Network error while updating LCD.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Update LCD Display</span>';
  }
}

// ==============================================================
// 5. TAB 3: LED AUTOMATION
// ==============================================================

// Toggle LED ON/OFF
async function toggleLed() {
  const nextState = currentLedState === 1 ? 0 : 1;
  const btn = document.getElementById('btnToggleLed');

  try {
    btn.disabled = true;

    const res = await fetch('/api/device/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nextState })
    });

    const result = await res.json();
    if (result.success) {
      currentLedState = result.led;
      renderLedUI(currentLedState);
      showToast(`LED has been turned ${currentLedState === 1 ? 'ON' : 'OFF'}!`, 'success');
    } else {
      showToast(result.message || 'Failed to toggle LED.', 'error');
    }
  } catch (err) {
    showToast('Network error toggling LED.', 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderLedUI(state) {
  const bulb = document.getElementById('visualLedBulb');
  const badge = document.getElementById('ledStatusBadge');
  const btn = document.getElementById('btnToggleLed');
  const btnIcon = document.getElementById('btnToggleIcon');
  const btnText = document.getElementById('btnToggleText');
  const icon = document.getElementById('visualLedIcon');

  if (state === 1) {
    // ON State
    bulb.className = 'led-bulb on flex items-center justify-center cursor-pointer';
    icon.className = 'fa-solid fa-lightbulb text-3xl text-emerald-100 transition-colors';
    badge.textContent = 'LED IS CURRENTLY ON (Pin D6 HIGH)';
    badge.className = 'text-sm font-bold px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tracking-wider shadow-lg shadow-emerald-500/20';

    btn.className = 'px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-300 flex items-center space-x-3 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 active:scale-95 shadow-emerald-600/30';
    btnIcon.className = 'fa-solid fa-toggle-on text-xl';
    btnText.textContent = 'Turn LED OFF';
  } else {
    // OFF State
    bulb.className = 'led-bulb off flex items-center justify-center cursor-pointer';
    icon.className = 'fa-solid fa-power-off text-2xl text-gray-500 transition-colors';
    badge.textContent = 'LED IS CURRENTLY OFF (Pin D6 LOW)';
    badge.className = 'text-sm font-bold px-4 py-1.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 tracking-wider';

    btn.className = 'px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-300 flex items-center space-x-3 shadow-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 active:scale-95';
    btnIcon.className = 'fa-solid fa-toggle-off text-xl';
    btnText.textContent = 'Turn LED ON';
  }
}

// Fetch device state (LED & LCD)
async function fetchDeviceState() {
  try {
    const res = await fetch('/api/device/state');
    const result = await res.json();
    if (result.success) {
      // Sync LED
      currentLedState = result.led;
      renderLedUI(currentLedState);

      // Sync LCD preview if inputs not being actively typed
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.id === 'lcdRow1Input' || activeEl.id === 'lcdRow2Input')) {
        // User is typing, don't overwrite input fields
      } else {
        document.getElementById('lcdRow1Input').value = result.lcd_row1 || '';
        document.getElementById('lcdRow2Input').value = result.lcd_row2 || '';
        previewLcdText();
      }
    }
  } catch (err) {
    console.warn('Failed to fetch device state:', err);
  }
}

// ==============================================================
// 6. AUTHENTICATION (LOGIN & REGISTRATION)
// ==============================================================
function openAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(type) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('authTabLoginBtn');
  const regBtn = document.getElementById('authTabRegisterBtn');
  const title = document.getElementById('authModalTitle');

  if (type === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    loginBtn.className = 'flex-1 py-2 text-xs font-bold text-brand-400 border-b-2 border-brand-400';
    regBtn.className = 'flex-1 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 border-b-2 border-transparent';
    title.textContent = 'Sign In to Account';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    regBtn.className = 'flex-1 py-2 text-xs font-bold text-brand-400 border-b-2 border-brand-400';
    loginBtn.className = 'flex-1 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 border-b-2 border-transparent';
    title.textContent = 'Register New Account';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await res.json();
    if (result.success) {
      localStorage.setItem('iot_auth_token', result.token);
      currentToken = result.token;
      currentUser = result.user;
      showToast(`Welcome back, ${result.user.name}!`, 'success');
      closeAuthModal();
      updateAuthHeader();
    } else {
      showToast(result.message || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during login.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const result = await res.json();
    if (result.success) {
      localStorage.setItem('iot_auth_token', result.token);
      currentToken = result.token;
      currentUser = result.user;
      showToast(`Account created! Welcome, ${result.user.name}.`, 'success');
      closeAuthModal();
      updateAuthHeader();
    } else {
      showToast(result.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during registration.', 'error');
  }
}

function checkAuth() {
  if (!currentToken) return;
  fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${currentToken}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      currentUser = data.user;
      updateAuthHeader();
    } else {
      localStorage.removeItem('iot_auth_token');
      currentToken = null;
    }
  })
  .catch(() => {});
}

function updateAuthHeader() {
  const container = document.getElementById('authHeaderSection');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="text-xs text-gray-300 font-medium hidden sm:inline">
          <i class="fa-solid fa-user-check text-brand-400 mr-1"></i> ${currentUser.name}
        </span>
        <button onclick="handleLogout()" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition">
          <i class="fa-solid fa-arrow-right-from-bracket mr-1"></i> Logout
        </button>
      </div>
    `;
  }
}

function handleLogout() {
  localStorage.removeItem('iot_auth_token');
  currentToken = null;
  currentUser = null;
  showToast('Logged out successfully.', 'info');
  const container = document.getElementById('authHeaderSection');
  if (container) {
    container.innerHTML = `
      <button onclick="openAuthModal()" class="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition shadow-sm flex items-center space-x-1.5">
        <i class="fa-solid fa-user-circle"></i>
        <span>Login / Register</span>
      </button>
    `;
  }
}

// ==============================================================
// 7. TOAST NOTIFICATIONS
// ==============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  
  let bgClass = 'bg-[#12281e] border-brand-500/50 text-gray-100';
  let icon = '<i class="fa-solid fa-circle-info text-brand-400"></i>';

  if (type === 'success') {
    bgClass = 'bg-[#0f2d1e] border-brand-400 text-emerald-100';
    icon = '<i class="fa-solid fa-circle-check text-brand-400"></i>';
  } else if (type === 'error') {
    bgClass = 'bg-[#2d1212] border-red-500 text-red-100';
    icon = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>';
  } else if (type === 'warning') {
    bgClass = 'bg-[#2d2412] border-yellow-500 text-yellow-100';
    icon = '<i class="fa-solid fa-circle-exclamation text-yellow-400"></i>';
  }

  toast.className = `flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium transition-all transform duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `${icon}<span>${message}</span>`;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
