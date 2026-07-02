/* ══════════════════════════════════════════════════════
   CryptoPulse – stream.js
   IAsyncEnumerable NDJSON streaming client
══════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────
const MAX_CHART_POINTS = 60;
const MAX_LOG_ITEMS    = 80;
const RECONNECT_DELAY  = 3000;

let currentSymbol  = 'BTC';
let activeMode     = 'single'; // 'single' | 'all'
let abortCtrl      = null;
let reconnectTimer = null;
let isConnected    = false;

// Symbol → coin rows for all-coins table
const allCoinsRows = {};

// ── Chart ────────────────────────────────────────────
const chartCanvas = document.getElementById('priceChart');
const chartCtx    = chartCanvas.getContext('2d');

const priceChart = new Chart(chartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label:           'Price (USD)',
            data:            [],
            borderColor:     '#58a6ff',
            backgroundColor: 'rgba(88,166,255,0.08)',
            borderWidth:     2,
            pointRadius:     0,
            pointHoverRadius:4,
            tension:         0.35,
            fill:            true,
        }]
    },
    options: {
        animation:   false,
        responsive:  true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: ctx =>
                        ` $${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                }
            }
        },
        scales: {
            x: {
                ticks: { color: '#8b949e', maxTicksLimit: 8, maxRotation: 0 },
                grid:  { color: 'rgba(48,54,61,0.6)' }
            },
            y: {
                position: 'right',
                ticks: {
                    color: '#8b949e',
                    callback: v =>
                        '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                },
                grid: { color: 'rgba(48,54,61,0.6)' }
            }
        }
    }
});

// ── Helpers ──────────────────────────────────────────
function fmt(price, symbol) {
    if (!price) return '—';
    const decimals = symbol === 'DOGE' ? 5 : 2;
    return '$' + Number(price).toLocaleString('en-US',
        { minimumFractionDigits: decimals, maximumFractionDigits: decimals + 2 });
}

function fmtVol(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
}

function timeStr(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour12: false });
}

// ── Connection Status ─────────────────────────────────
function setStatus(state) {
    const el = document.getElementById('connectionStatus');
    el.className = 'status-badge status-' + state;
    const labels = {
        connected:    '● Connected',
        connecting:   '⬤ Connecting…',
        disconnected: '● Disconnected'
    };
    el.innerHTML = `<span class="status-dot"></span> ${labels[state] ?? state}`;
    isConnected = (state === 'connected');
}

// ── Chart helpers ─────────────────────────────────────
function pushToChart(label, price) {
    const d = priceChart.data;
    d.labels.push(label);
    d.datasets[0].data.push(price);
    if (d.labels.length > MAX_CHART_POINTS) {
        d.labels.shift();
        d.datasets[0].data.shift();
    }
    priceChart.update('none');
}

function clearChart() {
    priceChart.data.labels   = [];
    priceChart.data.datasets[0].data = [];
    priceChart.update();
}

// ── Event Log ─────────────────────────────────────────
function addLogEntry(tick) {
    const log  = document.getElementById('eventLog');
    const up   = tick.change >= 0;
    const sign = up ? '+' : '';
    const li   = document.createElement('li');
    li.innerHTML = `
        <span class="log-time">${timeStr(tick.time)}</span>
        <span class="log-symbol" style="color:var(--accent-blue)">${tick.symbol}</span>
        <span class="log-price">${fmt(tick.price, tick.symbol)}</span>
        <span class="log-change ${up ? 'up' : 'down'}">${sign}${tick.changePercent.toFixed(2)}%</span>
        ${tick.isAnomaly ? `<span class="log-anomaly">⚠ SPIKE</span>` : ''}
    `;
    log.prepend(li);
    while (log.children.length > MAX_LOG_ITEMS)
        log.removeChild(log.lastChild);
}

function clearLog() {
    document.getElementById('eventLog').innerHTML = '';
}

// ── Stat Cards ────────────────────────────────────────
function updateStatCards(tick) {
    const up = tick.change >= 0;
    const sign = up ? '+' : '';

    document.getElementById('statPrice').textContent  = fmt(tick.price, tick.symbol);
    document.getElementById('statHigh').textContent   = fmt(tick.high24h, tick.symbol);
    document.getElementById('statLow').textContent    = fmt(tick.low24h, tick.symbol);
    document.getElementById('statVolume').textContent = fmtVol(tick.volume);

    const chEl = document.getElementById('statChange');
    chEl.textContent  = `${sign}${tick.changePercent.toFixed(2)}%  (${sign}${fmt(tick.change, tick.symbol)})`;
    chEl.style.color  = up ? 'var(--accent-green)' : 'var(--accent-red)';
}

// ── Anomaly Alert ─────────────────────────────────────
function showAnomaly(tick) {
    const box = document.getElementById('anomalyAlert');
    document.getElementById('anomalyText').textContent =
        `${tick.symbol} — ${tick.anomalyReason}`;
    box.classList.remove('d-none', 'anomaly-flash');
    void box.offsetWidth;                  // reflow to restart animation
    box.classList.add('anomaly-flash');
}

// ── All-Coins Table ───────────────────────────────────
function upsertCoinRow(tick) {
    const tbody = document.getElementById('allCoinsBody');
    let row = allCoinsRows[tick.symbol];

    if (!row) {
        row = document.createElement('tr');
        row.id = 'row-' + tick.symbol;
        row.innerHTML = `
            <td><strong>${tick.symbol}</strong></td>
            <td class="rc-price">—</td>
            <td class="rc-change">—</td>
            <td class="rc-changepct">—</td>
            <td class="rc-high text-success">—</td>
            <td class="rc-low  text-danger">—</td>
            <td class="rc-status">—</td>
        `;
        tbody.appendChild(row);
        allCoinsRows[tick.symbol] = row;
    }

    const up   = tick.change >= 0;
    const sign = up ? '+' : '';
    row.querySelector('.rc-price').textContent     = fmt(tick.price, tick.symbol);
    row.querySelector('.rc-change').textContent    = `${sign}${fmt(tick.change, tick.symbol)}`;
    row.querySelector('.rc-change').style.color    = up ? 'var(--accent-green)' : 'var(--accent-red)';
    row.querySelector('.rc-changepct').textContent = `${sign}${tick.changePercent.toFixed(2)}%`;
    row.querySelector('.rc-changepct').style.color = up ? 'var(--accent-green)' : 'var(--accent-red)';
    row.querySelector('.rc-high').textContent      = fmt(tick.high24h, tick.symbol);
    row.querySelector('.rc-low').textContent       = fmt(tick.low24h, tick.symbol);
    row.querySelector('.rc-status').innerHTML = tick.isAnomaly
        ? `<span class="badge bg-danger">⚠ SPIKE</span>`
        : `<span class="badge bg-secondary">normal</span>`;

    // Flash row on anomaly
    if (tick.isAnomaly) {
        row.style.transition = 'background .3s';
        row.style.background = 'rgba(248,81,73,.2)';
        setTimeout(() => row.style.background = '', 1200);
    }
}

// ── Reconnect Overlay ─────────────────────────────────
function showReconnectOverlay(show, countdown = 0) {
    const ov = document.getElementById('reconnectOverlay');
    if (show) {
        ov.classList.remove('d-none');
        document.getElementById('reconnectCountdown').textContent =
            `Retry in ${Math.ceil(countdown / 1000)} seconds…`;
    } else {
        ov.classList.add('d-none');
    }
}

// ── NDJSON Reader ─────────────────────────────────────
async function readNDJSON(stream, onTick) {
    const reader  = stream.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();                  // keep incomplete last line

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const tick = JSON.parse(trimmed);
                    onTick(tick);
                } catch { /* skip malformed */ }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// ── Single-symbol stream ──────────────────────────────
async function startSingleStream(symbol) {
    setStatus('connecting');
    showReconnectOverlay(false);

    document.getElementById('chartTitle').textContent = symbol;
    clearChart();

    abortCtrl = new AbortController();

    try {
        const resp = await fetch(`/Stream/Prices?symbol=${symbol}`,
            { signal: abortCtrl.signal });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setStatus('connected');

        await readNDJSON(resp.body, tick => {
            updateStatCards(tick);
            pushToChart(timeStr(tick.time), Number(tick.price));
            addLogEntry(tick);
            if (tick.isAnomaly) showAnomaly(tick);
        });
    } catch (err) {
        if (err.name === 'AbortError') return;          // intentional stop
        setStatus('disconnected');
        scheduleReconnect(() => startSingleStream(symbol));
    }
}

// ── All-coins stream ──────────────────────────────────
async function startAllStream() {
    setStatus('connecting');
    showReconnectOverlay(false);

    abortCtrl = new AbortController();

    try {
        const resp = await fetch('/Stream/AllPrices',
            { signal: abortCtrl.signal });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setStatus('connected');

        await readNDJSON(resp.body, tick => {
            upsertCoinRow(tick);
            addLogEntry(tick);
            if (tick.isAnomaly) showAnomaly(tick);
        });
    } catch (err) {
        if (err.name === 'AbortError') return;
        setStatus('disconnected');
        scheduleReconnect(startAllStream);
    }
}

// ── Reconnect ─────────────────────────────────────────
function scheduleReconnect(fn) {
    showReconnectOverlay(true, RECONNECT_DELAY);
    reconnectTimer = setTimeout(() => {
        showReconnectOverlay(false);
        fn();
    }, RECONNECT_DELAY);
}

function stopStream() {
    if (abortCtrl)     { abortCtrl.abort(); abortCtrl = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

// ── Public API (called from Razor) ───────────────────
window.switchSymbol = function (symbol, btn) {
    document.querySelectorAll('.btn-crypto').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentSymbol = symbol;
    activeMode    = 'single';

    document.getElementById('allCoinsSection').style.setProperty('display', 'none', 'important');
    document.getElementById('priceChart').closest('.col-lg-8').style.display = '';

    stopStream();
    startSingleStream(symbol);
};

window.switchToAll = function () {
    activeMode = 'all';
    document.querySelectorAll('.btn-crypto').forEach(b => b.classList.remove('active'));

    document.getElementById('allCoinsSection').style.removeProperty('display');
    document.getElementById('priceChart').closest('.col-lg-8').style.display = 'none';

    stopStream();
    startAllStream();
};

window.clearChart = clearChart;
window.clearLog   = clearLog;

// ── Theme Toggle ──────────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', () => {
    const html  = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').innerHTML =
        isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
});

// ── Boot ──────────────────────────────────────────────
startSingleStream(currentSymbol);
