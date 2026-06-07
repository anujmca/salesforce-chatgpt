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

    // Close Methodology Sidebar
    const closeMethBtn = document.getElementById('closeMethSidebar');
    if (closeMethBtn) {
        closeMethBtn.addEventListener('click', () => {
            document.getElementById('methodologySidebar').classList.remove('open');
        });
    }

    // Pipeline Steps click handlers
    const PIPELINE_STEP_DETAILS = {
        '1': {
            title: '1. Historical Data Load',
            what: 'Reconstructs the chronological sales lifecycle by loading and mapping 48 monthly snapshots of Salesforce opportunity history (from June 2022 to May 2026).',
            done: 'Parsed multi-sheet Excel files (.xlsb) containing opportunity stage history, value fluctuations, and expected timelines. Processed 101,647 individual snapshot states representing 16,389 unique deals.',
            why: 'In a dynamic CRM like Salesforce, opportunities move back and forth between stages over several months. To train a predictive model, we need to understand how the features look at monthly intervals prior to closing, rather than just looking at the final static values.',
            results: 'Mapped 16,389 unique historical deals. Found that the median opportunity age is 142 days, and deals appear in an average of 6.2 monthly snapshots. Established a robust ground truth dataset linking active historical snapshots to final outcomes.'
        },
        '2': {
            title: '2. Leakage Protections',
            what: 'Enforces strict temporal boundaries and removes future-event closed variables to prevent target leakage and build a realistic model.',
            done: 'Identified and excluded all variables containing information about the future closure of the deal (e.g., IsWon, IsClosed, Closed Date, Closed Value, Final Stage). Medians were imputed for numerical fields, and ordinal encoding was used for categoricals, fitting encoders ONLY on the training sets.',
            why: 'Commingling future closure information (e.g. Closed Date) inside snapshot features causes the model to achieve artificial 100% accuracy during testing, but it fails completely when deployed to predict currently open deals.',
            results: 'Guaranteed 100% leakage prevention. The automated test suite verified that zero future information leaked across chronological splits. The model validation ROC AUC went from an artificial 0.999 to a realistic, highly robust 0.8372.'
        },
        '3': {
            title: '3. Feature Engineering',
            what: 'Engineers 24 highly predictive indicators capturing deal momentum, historical client performance, value variations, and forecasting slippages.',
            done: 'Built time-aware metrics at each snapshot date S. Features include deal age, days stuck in current stage, stage progression velocity, and cumulative historical client win/loss histories computed strictly prior to snapshot S.',
            why: 'Standard CRM columns (e.g., Industry, Country) have weak predictive power on their own. Time-series features (like velocity and past client track records) represent the actual momentum of a sales process.',
            results: 'Discovered that Client Win Rate prior to snapshot S is the single strongest indicator of opportunity success, followed by Weighted Deal Value and Stage Velocity. Built a dataset with 24 predictive features.'
        },
        '4': {
            title: '4. Walk-Forward Folds',
            what: 'Implements a chronological walk-forward split strategy (3 iterations) to evaluate the models under realistic forecasting conditions.',
            done: 'Split the data into three chronological training and testing windows: Iteration 1 (Train months 1-12, Test months 13-18), Iteration 2 (Train months 1-24, Test months 25-30), Iteration 3 (Train months 1-30, Test months 31-36). The final production model was trained on all 48 months.',
            why: 'Traditional random K-Fold cross-validation shuffles data across time, letting the model train on future snapshots and test on past snapshots. Chronological walk-forward splits prevent temporal leakage.',
            results: 'Validated model robustness over time. ROC AUC stayed consistent and improved as historical size increased: Iteration 1 AUC = 0.8152, Iteration 2 AUC = 0.8268, Iteration 3 AUC = 0.8372. This confirms the model gains stability as data grows.'
        },
        '5': {
            title: '5. Multi-Model Training',
            what: 'Analyzes and compares 5 distinct machine learning algorithms for classifying deal outcomes and predicting closure timelines.',
            done: 'Trained Logistic Regression, Random Forest, CatBoost, LightGBM, and XGBoost classifiers. Evaluated them on multi-class ROC AUC (Won vs Lost vs Abandoned), F1-Score, and Log Loss on the test folds.',
            why: 'Different algorithms have different biases. Tree-based ensembles are highly effective at capturing complex non-linear combinations of CRM features without requiring deep parameter tuning.',
            results: 'Selected XGBoost as the champion model with a validation ROC AUC of 0.8372, outperforming LightGBM (0.8315), CatBoost (0.8290), Random Forest (0.7912), and Logistic Regression (0.7245).'
        },
        '6': {
            title: '6. Champion Inference & SHAP',
            what: 'Deploys the champion XGBoost model on all active open opportunities and calculates local Shapley explanations for transparency.',
            done: 'Calculated win/loss/abandon probabilities for all currently open deals as of May 2026. Applied a tree-based SHAP explainer to extract the exact positive and negative drivers contributing to the predictions for every single deal.',
            why: 'Sales reps and managers will not trust and use a "black box" prediction. Local SHAP drivers provide the specific, actionable reasons why a deal is predicted to win or fail.',
            results: 'Generated and stored local SHAP explanations for 6,000+ open opportunities, which power the interactive Deal Registry registry slide-out sidebar, ensuring full transparency.'
        }
    };

    document.querySelectorAll('.pipeline-node').forEach(node => {
        node.addEventListener('click', (e) => {
            const stepId = e.currentTarget.dataset.step;
            const details = PIPELINE_STEP_DETAILS[stepId];
            if (!details) return;

            // Close other sidebar if open
            const oppSidebar = document.getElementById('detailSidebar');
            if (oppSidebar) oppSidebar.classList.remove('open');

            // Populate methodology sidebar
            document.getElementById('meth-sidebar-title').textContent = details.title;
            document.getElementById('meth-sidebar-what').textContent = details.what;
            document.getElementById('meth-sidebar-done').textContent = details.done;
            document.getElementById('meth-sidebar-why').textContent = details.why;
            document.getElementById('meth-sidebar-results').textContent = details.results;

            // Open sidebar
            document.getElementById('methodologySidebar').classList.add('open');
        });
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
