// Main Application State & Router
const AppState = {
    theme: 'dark',
    predictions: [],
    forecast: [],
    performance: [],
    stageMovement: [],
    filteredPredictions: [],
    filters: {
        search: '',
        region: 'ALL',
        bu: 'ALL',
        industry: 'ALL',
        minValue: 0,
        risk: 'ALL'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadAllData();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    AppState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const toggleIcon = document.querySelector('#themeToggle i');
    if (theme === 'dark') {
        toggleIcon.className = 'fa-solid fa-sun fs-5';
    } else {
        toggleIcon.className = 'fa-solid fa-moon fs-5';
    }
    
    // Toggle Grid Theme Class
    const grids = ['#opportunityGrid', '#riskGrid'];
    grids.forEach(id => {
        const el = document.querySelector(id);
        if (el) {
            if (theme === 'dark') {
                el.classList.add('ag-theme-alpine-dark');
                el.classList.remove('ag-theme-alpine');
            } else {
                el.classList.add('ag-theme-alpine');
                el.classList.remove('ag-theme-alpine-dark');
            }
        }
    });

    // Re-render ECharts with new theme colors
    if (typeof renderAllCharts === 'function' && AppState.predictions.length > 0) {
        renderAllCharts();
    }
}

// Data Loader
async function loadAllData() {
    try {
        const [preds, fc, perf, moves] = await Promise.all([
            fetch('data/predictions.json').then(r => {
                if (!r.ok) throw new Error(`data/predictions.json HTTP error: ${r.status} ${r.statusText}`);
                return r.json();
            }),
            fetch('data/monthly_forecast.json').then(r => {
                if (!r.ok) throw new Error(`data/monthly_forecast.json HTTP error: ${r.status} ${r.statusText}`);
                return r.json();
            }),
            fetch('data/model_performance.json').then(r => {
                if (!r.ok) throw new Error(`data/model_performance.json HTTP error: ${r.status} ${r.statusText}`);
                return r.json();
            }),
            fetch('data/stage_movement.json').then(r => {
                if (!r.ok) throw new Error(`data/stage_movement.json HTTP error: ${r.status} ${r.statusText}`);
                return r.json();
            })
        ]);
        
        AppState.predictions = preds;
        AppState.forecast = fc;
        AppState.performance = perf;
        AppState.stageMovement = moves;
        AppState.filteredPredictions = preds;
        
        populateFilterDropdowns();
        applyFilters();
        
    } catch (e) {
        console.error("Failed to load JSON data. Please run via a local server (e.g. python -m http.server 8000).", e);
        // Show overlay warning for CORS and diagnostics
        showCorsWarning(e);
    }
}

function showCorsWarning(error) {
    const warning = document.createElement('div');
    warning.style.position = 'fixed';
    warning.style.top = '0';
    warning.style.left = '0';
    warning.style.width = '100%';
    warning.style.height = '100%';
    warning.style.background = 'rgba(10, 15, 25, 0.9)';
    warning.style.color = '#f8fafc';
    warning.style.zIndex = '9999';
    warning.style.display = 'flex';
    warning.style.flexDirection = 'column';
    warning.style.justifyContent = 'center';
    warning.style.alignItems = 'center';
    warning.style.padding = '20px';
    warning.style.textAlign = 'center';
    
    let errorDetail = '';
    if (error) {
        errorDetail = `<div class="p-3 bg-dark text-danger rounded border border-danger-subtle mb-4 small text-start" style="max-width: 500px; font-family: monospace; overflow-x: auto; font-size: 13px;">
            <b>Diagnostic Error Details:</b><br/>
            ${error.toString()}<br/>
            Stack: ${error.stack ? error.stack.split('\n')[0] : 'N/A'}
        </div>`;
    }
    
    warning.innerHTML = `
        <i class="fa-solid fa-circle-exclamation fs-1 text-warning mb-4 animate__animated animate__bounce"></i>
        <h3 class="fw-bold mb-3">Local Server Required</h3>
        <p class="max-w-md text-secondary mb-3" style="max-width: 500px;">
            The browser's security policy blocks loading JSON datasets directly from the file system. 
            Please open the terminal, go to this project directory, and start a local server:
        </p>
        <code class="p-3 bg-dark rounded border border-card text-success mb-3 d-block" style="font-size: 16px;">python -m http.server 8000</code>
        <p class="text-secondary mb-3">Then visit: <a href="http://localhost:8000" class="text-primary fw-bold" target="_blank">http://localhost:8000</a></p>
        ${errorDetail}
    `;
    document.body.appendChild(warning);
}

// Populate Filter Options Dynamically
function populateFilterDropdowns() {
    const regions = new Set(AppState.predictions.map(d => d.Region).filter(Boolean));
    const bus = new Set(AppState.predictions.map(d => d['Business Unit']).filter(Boolean));
    const industries = new Set(AppState.predictions.map(d => d.Industry).filter(Boolean));
    
    const regSelect = document.getElementById('filterRegion');
    regions.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r; regSelect.appendChild(opt);
    });

    const buSelect = document.getElementById('filterBU');
    bus.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b; buSelect.appendChild(opt);
    });

    const indSelect = document.getElementById('filterIndustry');
    industries.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = i; indSelect.appendChild(opt);
    });
}

// Filter Actions
function applyFilters() {
    const f = AppState.filters;
    
    AppState.filteredPredictions = AppState.predictions.filter(d => {
        const matchSearch = !f.search || 
            d['Opportunity Number'].toString().includes(f.search) || 
            d.Client.toLowerCase().includes(f.search.toLowerCase());
            
        const matchRegion = f.region === 'ALL' || d.Region === f.region;
        const matchBU = f.bu === 'ALL' || d['Business Unit'] === f.bu;
        const matchIndustry = f.industry === 'ALL' || d.Industry === f.industry;
        const matchValue = d['Opportunity Value'] >= f.minValue;
        
        let matchRisk = true;
        if (f.risk === 'Medium') matchRisk = d['Risk Score'] >= 40 && d['Risk Score'] < 70;
        else if (f.risk === 'High') matchRisk = d['Risk Score'] >= 70;
        
        return matchSearch && matchRegion && matchBU && matchIndustry && matchValue && matchRisk;
    });
    
    updateKPIs();
    if (typeof renderAllCharts === 'function') renderAllCharts();
    if (typeof updateGrids === 'function') updateGrids();
}

// KPI Aggregation Calculations
function updateKPIs() {
    const data = AppState.filteredPredictions;
    
    const totalPipeline = data.reduce((acc, curr) => acc + curr['Opportunity Value'], 0);
    const predictedRevenue = data.reduce((acc, curr) => acc + (curr['Opportunity Value'] * curr['Win Probability']), 0);
    const avgDeal = data.length > 0 ? totalPipeline / data.length : 0;
    
    // Weighted Win Rate
    const avgWinRate = data.length > 0 ? (predictedRevenue / totalPipeline) * 100 : 0;
    
    // Coverage ratio (total pipeline / target revenue - we assume a nominal target of predicted revenue * 1.5)
    const coverage = predictedRevenue > 0 ? totalPipeline / predictedRevenue : 0;
    
    document.getElementById('kpi-pipeline').textContent = `$${(totalPipeline / 1000000).toFixed(1)}M`;
    document.getElementById('kpi-revenue').textContent = `$${(predictedRevenue / 1000000).toFixed(1)}M`;
    document.getElementById('kpi-win-rate').textContent = `${avgWinRate.toFixed(1)}%`;
    document.getElementById('kpi-avg-val').textContent = `$${(avgDeal / 1000).toFixed(0)}k`;
    document.getElementById('kpi-coverage').textContent = `${coverage.toFixed(1)}x`;
}

// Event Listeners setup
function setupEventListeners() {
    // Theme Switcher
    document.getElementById('themeToggle').addEventListener('click', () => {
        setTheme(AppState.theme === 'dark' ? 'light' : 'dark');
    });
    
    // Reset Filters
    document.getElementById('resetFilters').addEventListener('click', () => {
        document.getElementById('searchFilter').value = '';
        document.getElementById('filterRegion').value = 'ALL';
        document.getElementById('filterBU').value = 'ALL';
        document.getElementById('filterIndustry').value = 'ALL';
        document.getElementById('filterValue').value = 0;
        document.getElementById('valueDisplay').textContent = '$0';
        
        document.querySelectorAll('.filter-risk-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.risk === 'ALL') btn.classList.add('active');
        });
        
        AppState.filters = {
            search: '', region: 'ALL', bu: 'ALL', industry: 'ALL', minValue: 0, risk: 'ALL'
        };
        applyFilters();
    });
    
    // Text search
    document.getElementById('searchFilter').addEventListener('input', (e) => {
        AppState.filters.search = e.target.value;
        applyFilters();
    });
    
    // Selects
    document.getElementById('filterRegion').addEventListener('change', (e) => {
        AppState.filters.region = e.target.value;
        applyFilters();
    });
    document.getElementById('filterBU').addEventListener('change', (e) => {
        AppState.filters.bu = e.target.value;
        applyFilters();
    });
    document.getElementById('filterIndustry').addEventListener('change', (e) => {
        AppState.filters.industry = e.target.value;
        applyFilters();
    });
    
    // Slider
    document.getElementById('filterValue').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        AppState.filters.minValue = val;
        document.getElementById('valueDisplay').textContent = val >= 1000000 ? '$1.0M' : `$${(val/1000).toFixed(0)}k`;
        applyFilters();
    });
    
    // Risk buttons
    document.querySelectorAll('.filter-risk-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-risk-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.filters.risk = e.target.dataset.risk;
            applyFilters();
        });
    });

    // Close Sidebar
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('detailSidebar').classList.remove('open');
    });

    // Full screen
    document.getElementById('fullscreenToggle').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });
}
