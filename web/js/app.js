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
    
    // Hash routing for tabs
    const hash = window.location.hash;
    if (hash) {
        const tabEl = document.querySelector(`button[data-bs-target="${hash}"]`);
        if (tabEl) {
            // Bootstrap Tab instance activation
            setTimeout(() => {
                const tab = new bootstrap.Tab(tabEl);
                tab.show();
            }, 100);
        }
    }
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
    // Print Methodology button
    const printBtn = document.getElementById('printMethodologyBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

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

    // Close Help Sidebar
    const closeHelpBtn = document.getElementById('closeHelpSidebar');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
            document.getElementById('helpSidebar').classList.remove('open');
        });
    }

    // Command Center Help Content Mappings
    const COMMAND_CENTER_HELP = {
        'kpi-pipeline': {
            title: 'Total Pipeline',
            meaning: 'Total Pipeline is the cumulative value (unweighted sum) of all active, open opportunities currently in Stages 1 to 4 in our system. It excludes already closed deals (Won, Lost, or Abandoned).',
            understand: 'This KPI represents the raw, maximum potential value of all deals the sales team is actively pursuing. It does not apply any probability weighting.',
            use: 'Monitor this to assess the overall volume of active negotiations. If the total pipeline shrinks, it indicates a critical lack of new lead generation in the early stages.'
        },
        'kpi-revenue': {
            title: 'Predicted Revenue',
            meaning: 'Predicted Revenue is the probability-weighted value of the active pipeline. It is calculated as the sum of each open opportunity\'s value multiplied by its machine learning-predicted Win Probability.',
            understand: 'Unlike simple weighted forecasts based on static stage percentages, this prediction is driven by XGBoost using 24 dynamic indicators (deal age, velocity, past client close rate, etc.). It represents the statistically expected revenue that will close won.',
            use: 'Use this figure for realistic financial planning and matching against quarterly sales targets. It serves as your AI-informed baseline expectation.'
        },
        'kpi-win-rate': {
            title: 'Predicted Win Rate',
            meaning: 'Predicted Win Rate represents the average weighted win probability across the selected pipeline segment. It is calculated as: (Predicted Revenue / Total Pipeline) * 100.',
            understand: 'A higher percentage indicates a high-health pipeline containing deals with high close-probabilities. A lower percentage suggests the pipeline contains high-value but risky or stalled deals.',
            use: 'Track this value across divisions and industries. If a specific business unit\'s predicted win rate drops, drill down to inspect stuck opportunities.'
        },
        'kpi-avg-val': {
            title: 'Avg Deal Value',
            meaning: 'Avg Deal Value is the mathematical mean of all open opportunity values. It is calculated by dividing the Total Pipeline by the number of active open deals.',
            understand: 'Gives the typical scale of a deal currently in negotiation. Helps track if the team is shifting towards smaller transactional deals or larger enterprise engagements.',
            use: 'Compare this value against historical close sizes. If the average deal value rises while predicted win rate remains steady, it indicates scaling capacity.'
        },
        'kpi-accuracy': {
            title: 'Forecast Accuracy',
            meaning: 'Forecast Accuracy measures the out-of-sample predictive performance (classification ROC AUC) of our champion XGBoost machine learning model on historical validation datasets.',
            understand: 'Currently verified at 83.7% ROC AUC. This means the model can distinguish between future successful and unsuccessful opportunities with 83.7% reliability, far exceeding standard industry baselines.',
            use: 'Gives executives and finance directors confidence in the stability and accuracy of the predicted revenue target. A higher accuracy justifies bold resource commitments.'
        },
        'kpi-coverage': {
            title: 'Coverage Ratio',
            meaning: 'Coverage Ratio is the ratio of the Total Pipeline value to the Predicted Revenue (or nominal sales targets). It is calculated as: Total Pipeline / Predicted Revenue.',
            understand: 'Currently at 3.1x. In enterprise sales, a coverage ratio of 3.0x to 4.0x is considered healthy. This ensures there are enough opportunities in play to cushion against expected deal slippage and losses.',
            use: 'If this ratio drops below 3.0x, increase focus on outbound prospecting and marketing lead generation. If it rises above 5.0x, focus sales resources on closing high-value deals.'
        },
        'chart-revenue-trend': {
            title: 'Revenue Forecast Trend',
            meaning: 'This chart projects month-by-month expected closed-won revenue over the next 12 months based on machine learning predictions.',
            understand: 'It compares three distinct scenarios:\n• Most Likely: Probability-weighted revenue.\n• Best Case: Revenue from deals with win probability >= 30%.\n• Worst Case: Revenue from deals with win probability >= 80%.',
            use: 'Helps identify revenue gaps in upcoming months and quarters. If the "Most Likely" line falls short of the target in month 3, sales teams can proactively accelerate deals scheduled for month 4 or 5.'
        },
        'chart-funnel': {
            title: 'Pipeline Funnel',
            meaning: 'This funnel chart visualizes the distribution of active, open opportunities across the four progressive sales stages: 1. Identify Opp, 2. Qualify Opp, 3. Develop Opp, and 4. Negotiate Opp.',
            understand: 'A healthy funnel shows a smooth taper (wide at the top in early stages, narrower at the bottom in negotiation). Severe necking or bulges indicate bottlenecks.',
            use: 'Use this to audit stage transitions. For example, if there is a massive block in Stage 2 (Qualify) but very few in Stage 3 (Develop), the qualification criteria may be too restrictive or slow.'
        },
        'chart-outcome-dist': {
            title: 'Outcome Distribution',
            meaning: 'This chart breaks down the predicted final outcomes (Won, Lost, or Abandoned) for all open opportunities based on our XGBoost multi-class classifier.',
            understand: 'Shows what percentage of the active pipeline is expected to close won vs. what percentage will leak (close lost or be abandoned by the client).',
            use: 'Use it to assess pipeline risk. A high proportion of predicted Lost or Abandoned deals indicates that sales reps are holding low-quality deals in their active registry.'
        },
        'chart-geo': {
            title: 'Geographic Performance Map',
            meaning: 'This visualizes predicted win rates and pipeline values distributed across different geographic country entities or regions.',
            understand: 'Darker colors or bubble size represent higher pipeline volume or superior close rates, depending on the map overlay context.',
            use: 'Compare performance across regions to allocate territory budgets, align regional partner support, and share best practices from high-performing regions.'
        },
        'filter-search': {
            title: 'Search Filter',
            meaning: 'The Search Opportunities / Clients filter performs a live text search on active deals.',
            understand: 'It matches characters against opportunity numbers (e.g. OPP-01234) or client names (e.g. Acme Corp), filtering the list views and dashboard aggregates dynamically.',
            use: 'Type a client\'s name or a specific opportunity code to instantly review their forecast win probability, risk score, expected close month, and top SHAP drivers.'
        },
        'filter-region': {
            title: 'Region Filter',
            meaning: 'The Region filter slices the entire dataset to show only opportunities belonging to a specific geographic territory (e.g. NA, EMEA, APAC, LATAM).',
            understand: 'Selecting a region filters all KPI summaries, forecast lines, pipeline funnels, outcome distributions, and grids. Selecting "All Regions" resets the filter.',
            use: 'Use this to compare performance metrics and closing predictions between different regional territories, helping regional heads inspect local pipeline health.'
        },
        'filter-bu': {
            title: 'Business Unit Filter',
            meaning: 'The Business Unit filter restricts the dashboard view to opportunities belonging to a specific department or service vertical.',
            understand: 'Filters all active and predicted opportunities according to the business unit they are assigned to (e.g., Consulting, Outsourcing).',
            use: 'Enables departmental heads and delivery leads to review and simulate revenue targets specific to their division without mixing in other operations.'
        },
        'filter-industry': {
            title: 'Core Industry Filter',
            meaning: 'The Industry filter isolates opportunities by client industry sector (e.g., Financial Services, Healthcare, Technology).',
            understand: 'Limits the active deal lists, KPIs, and ECharts visualizations to represent only opportunities in the chosen sector.',
            use: 'Helps sector leaders and marketing teams examine win rates, deal distributions, and risks within specific industry spaces, pointing out vertical strengths or weaknesses.'
        },
        'filter-value': {
            title: 'Deal Value (Min) Filter',
            meaning: 'The Deal Value (Min) slider sets a minimum threshold for the unweighted opportunity amount, filtering out smaller engagements.',
            understand: 'Moving the slider to the right removes all opportunities from the views that are valued below the selected limit (from $0 up to $1,000,000+).',
            use: 'Use this to instantly filter out small transactional pipeline deals, allowing executives to audit and review only high-value, critical enterprise negotiations.'
        },
        'filter-risk': {
            title: 'Risk Level Filter',
            meaning: 'The Risk Level filter segments the opportunity pipeline into risk categories based on their AI-calculated Risk Scores (0-100).',
            understand: '• All: Displays all opportunities.\n• Med: Opportunities with Risk Score between 40 and 69.\n• High: Opportunities with Risk Score >= 70 (high risk of failing or slipping).',
            use: 'Click "High" to instantly focus on the most vulnerable opportunities, enabling sales managers to initiate intervention protocols and save deals in jeopardy.'
        },
        'registry-matrix': {
            title: 'Deal Registry & Prediction Matrix',
            meaning: 'This interactive data grid lists all active, open opportunities within the pipeline, integrating CRM data points with machine learning predictions like Win Probability, Loss Probability, and Risk Score.',
            understand: 'Each row represents an active deal. Key columns include:\n• Win Prob: XGBoost probability of winning (higher is better).\n• Loss Prob: XGBoost probability of losing.\n• Risk Score: Dynamic score (0-100) reflecting deal vulnerability.\n• Drivers: Summary of positive (+) and negative (-) SHAP factors.',
            use: 'Click any row to open the Opportunity Details panel for local SHAP explainability drivers, age, and historical timeline. Use the search bar to locate specific clients, and click the Export CSV button to download the filtered dataset.'
        },
        'risk-matrix-bubble': {
            title: 'Risk Matrix (Bubble Chart)',
            meaning: 'This multi-dimensional visualization displays open opportunities as bubbles to analyze the relationship between Deal Value, AI Win Probability, and Risk Score.',
            understand: '• X-Axis: Win Probability (0% to 100%).\n• Y-Axis: Deal Value (unweighted amount in USD).\n• Bubble Size: Represents the Risk Score (larger bubbles indicate high vulnerability).\n• Bubble Color: Indicates Risk Category (Red = High Risk, Yellow = Med Risk, Green = Low Risk).',
            use: 'Look for large red bubbles in the upper-left quadrant (high value, low win probability, high risk). Hover over bubbles to see deal ID and details. Clicking a bubble filters the Deal Registry table below.'
        },
        'risk-grid-high': {
            title: 'Top 50 High-Risk & Stuck Opportunities',
            meaning: 'This specialized list extracts the top 50 most vulnerable active deals, prioritized by their Risk Score (70+) and velocity bottlenecks (days stuck in stage).',
            understand: 'Deals displayed here have low win probabilities, elevated loss/abandonment rates, and high stage ages. These are opportunities that are highly likely to leak or stall indefinitely.',
            use: 'Use this list during weekly pipeline reviews. Sales managers should inspect these 50 deals first, identify the negative SHAP drivers (e.g. pushed close dates, zero activity), and coordinate salvage plans.'
        },
        'sim-controllers': {
            title: 'Scenario Controllers',
            meaning: 'This interactive control panel allows sales leadership to adjust key sales variables (Win Rate, Deal Size, Cycle Time) to simulate their impact on forecasted revenue.',
            understand: '• Win Rate Multiplier: Scale predicted win probabilities (e.g., 1.10x represents a 10% improvement in sales execution).\n• Avg Deal Size Multiplier: Scale overall deal values.\n• Close Date Shift: Accelerate or delay closing timelines by 1 to 3 months.',
            use: 'Slide the controls to reflect different strategic assumptions. For instance, set Win Rate to 1.15x to simulate a successful training program, and observe how the forecast line shifts in response.'
        },
        'sim-chart-outcome': {
            title: 'Simulated Scenario Revenue Chart',
            meaning: 'This trend line visualization compares the baseline predicted revenue against a custom simulated forecast driven by user-adjusted Scenario Controllers.',
            understand: '• White/Solid Line: Baseline expected revenue (standard XGBoost predictions).\n• Purple/Dashed Line: Simulated revenue (weighted using the active multiplier scenarios).\n• Shaded Area: Gap or gain relative to target baseline.',
            use: 'Evaluate the feasibility of recovery plans. If a division is pacing $5M behind quota, adjust the multipliers to see what level of win-rate increase or deal-size growth is required to bridge the gap.'
        },
        'perf-roc-curve': {
            title: 'ROC Validation Curve',
            meaning: 'The Receiver Operating Characteristic (ROC) curve measures the diagnostic ability of our classification model across all possible decision thresholds.',
            understand: '• X-Axis: False Positive Rate (1 - Specificity).\n• Y-Axis: True Positive Rate (Sensitivity).\n• Area Under Curve (AUC): Ranges from 0.5 (random guess) to 1.0 (perfect model). Our final champion model achieves an AUC of 0.8372, demonstrating highly robust separation.',
            use: 'This chart validates model reliability. A high AUC (>0.80) ensures that the probability scores are highly discriminative, justifying their use in automated workflows and forecasts.'
        },
        'perf-confusion': {
            title: 'Confusion Matrix',
            meaning: 'This matrix details the classification accuracy of the model by comparing actual historical outcomes (Won vs. Lost vs. Abandoned) against model predictions.',
            understand: '• Rows: Actual Outcomes.\n• Columns: Predicted Outcomes.\n• Diagonal Cells: True Positives (correctly classified deals).\n• Off-diagonal Cells: Misclassifications. High diagonal percentages indicate precise model predictions.',
            use: 'Assess model bias. For example, check if the model is over-predicting wins (False Positives) or losses (False Negatives), allowing data scientists to tune the classification threshold accordingly.'
        },
        'perf-importance': {
            title: 'Feature Importance',
            meaning: 'This chart displays the global feature importance weights, showing which opportunity variables have the greatest impact on the model\'s predictions.',
            understand: 'The longer the bar, the more influence that feature has on the final prediction. Client Win Rate and Stage Velocity (days stuck in current stage) are the primary drivers in our model.',
            use: 'Align sales processes with predictive signals. If \'Days stuck in current stage\' is a top driver, sales leaders should establish strict alerts for deals that exceed the normal stage age limit.'
        },
        'perf-shap-summary': {
            title: 'SHAP Global Summary',
            meaning: 'This plot combines feature importance with feature effects, illustrating how high or low values of a feature push predictions towards Won (+) or Lost (-).',
            understand: '• Y-Axis: Features ranked by overall impact.\n• X-Axis: SHAP value (positive increases win prob, negative decreases it).\n• Color: Red represents high feature values, Blue represents low feature values. For example, high client win rate (red) pushes predictions to the right (positive impact).',
            use: 'Understand the direction and magnitude of feature impacts. Use these global insights to train sales reps on what behaviors (e.g. keeping close dates stable) maximize win probabilities.'
        },
        'flow-sankey': {
            title: 'Sankey Pipeline Stage Flow',
            meaning: 'This flow diagram visualizes the movement of opportunities from their starting stages at the beginning of the year to their final end-of-year outcomes.',
            understand: '• Left Nodes: Starting stages of opportunities.\n• Right Nodes: Closed-won, Closed-lost, Abandoned, or remaining Active states.\n• Link Widths: Proportion of opportunities transitioning between those states.',
            use: 'Identify stage leakage. If a thick band flows from Stage 3 (Develop) directly to Closed-lost or Abandoned, it indicates a critical drop-off point that needs process investigation.'
        },
        'flow-velocity': {
            title: 'Stage Velocity',
            meaning: 'This chart calculates the average number of days opportunities spend in each progressive sales stage before moving forward or closing.',
            understand: '• Y-Axis: Sales stages (Identify, Qualify, Develop, Negotiate).\n• X-Axis: Average duration in days. Longer bars indicate slower stages where opportunities stall.',
            use: 'Find workflow bottlenecks. If deals spend an average of 90 days in \'Develop Opp\' compared to 15 days in \'Negotiate\', focus enablement resources on qualifying and developing early-stage deals faster.'
        },
        'flow-slippage': {
            title: 'Slippage History Tracker',
            meaning: 'This tracker monitors close date slippage, showing how many times expected close dates were pushed back and how that affects close rates.',
            understand: 'Opportunities are grouped by the number of times their Close Date has slipped (0, 1, 2, or 3+ times). The chart compares historical win rates across these slippage buckets.',
            use: 'Enforce forecast discipline. Since opportunities that slip 3+ times have a historical win rate of under 15%, treat any deal with multiple date changes as extremely high-risk, regardless of the rep\'s confidence.'
        },
        'method-splits': {
            title: 'Chronological Validation Strategy',
            meaning: 'This section displays our walk-forward cross-validation splits used to train and validate the predictive models without temporal leakage.',
            understand: 'Instead of shuffling snapshots randomly across time (which leaks future data into the past), we train on historical windows and test on subsequent blocks: Iteration 1 (Months 1-12 to 13-18), Iteration 2 (Months 1-24 to 25-30), Iteration 3 (Months 1-30 to 31-36).',
            use: 'Provides transparency into the validation structure. This confirms that the model\'s reported accuracy is evaluated on realistic, unseen out-of-sample future datasets.'
        },
        'method-comparison': {
            title: 'Model Performance Comparison',
            meaning: 'This table compares the performance metrics of five candidate machine learning algorithms evaluated on our walk-forward test folds.',
            understand: 'Algorithms (XGBoost, LightGBM, CatBoost, Random Forest, Logistic Regression) are evaluated on ROC AUC (discrimination), F1-Score (balance), and Log Loss (confidence). XGBoost was selected as the champion with an AUC of 0.8372.',
            use: 'Gives the technical and business stakeholders visibility into the model selection process, proving that the selected algorithm is statistically superior to simpler baseline classifiers.'
        },
        'method-explainability': {
            title: 'Explainability Framework (SHAP)',
            meaning: 'This section details the SHAP (SHapley Additive exPlanations) framework used to translate complex machine learning calculations into clear human explanations.',
            understand: 'SHAP calculates the contribution of each individual feature to a deal\'s win probability, showing exactly which positive (+) and negative (-) factors drove the prediction away from the baseline average.',
            use: 'Bridges the trust gap for end users. Instead of treating the AI as a black box, sales reps can see the precise mathematical drivers (like client win history or slippage counts) behind every score.'
        },
        'exec-command-center': {
            title: 'Executive Command Center',
            meaning: 'The Executive Command Center provides a high-level overview of the sales pipeline, using machine learning predictions to estimate future revenue and assess current pipeline coverage.',
            understand: 'This dashboard integrates six high-level KPI cards and four diagnostic charts:\n• KPI Row: Displays overall pipeline size, predicted close-won revenue, average deal values, coverage ratios, and baseline model accuracy.\n• Chart Grid: Compares revenue forecast scenarios, summarizes pipeline funnel taper, profiles outcome probabilities, and maps geographic performance.',
            use: 'Use the Filters in the left sidebar (Search, Region, Business Unit, Industry, Value, Risk) to slice the aggregates dynamically. Adjust your forecast view or drill down into other tabs to manage high-risk opportunities.'
        }
    };

    // Hook Help Triggers
    document.querySelectorAll('.help-trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const helpId = e.currentTarget.dataset.help;
            const details = COMMAND_CENTER_HELP[helpId];
            if (!details) return;

            // Close other sidebars
            const oppSidebar = document.getElementById('detailSidebar');
            if (oppSidebar) oppSidebar.classList.remove('open');
            const methSidebar = document.getElementById('methodologySidebar');
            if (methSidebar) methSidebar.classList.remove('open');

            // Populate help sidebar
            document.getElementById('help-sidebar-title').textContent = details.title;
            document.getElementById('help-sidebar-meaning').textContent = details.meaning;
            document.getElementById('help-sidebar-understand').textContent = details.understand;
            document.getElementById('help-sidebar-use').textContent = details.use;

            // Open sidebar
            document.getElementById('helpSidebar').classList.add('open');
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
