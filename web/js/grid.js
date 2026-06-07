// AG Grid Registry Manager
let opportunityGridOptions = null;
let riskGridOptions = null;

// Currency Formatter
function currencyFormatter(params) {
    if (params.value == null) return '$0';
    return '$' + Math.round(params.value).toLocaleString();
}

// Percentage Formatter
function percentFormatter(params) {
    if (params.value == null) return '0.0%';
    return (params.value * 100).toFixed(1) + '%';
}

// Risk Score Renderer (Badge style)
function riskScoreRenderer(params) {
    const score = params.value;
    let badgeClass = 'bg-success';
    if (score >= 70) badgeClass = 'bg-danger';
    else if (score >= 40) badgeClass = 'bg-warning text-dark';
    
    return `<span class="badge ${badgeClass}" style="font-size: 12px; padding: 5px 10px;">${score}</span>`;
}

// Confidence Score Renderer
function confidenceRenderer(params) {
    const conf = params.value;
    let badgeClass = 'bg-secondary';
    if (conf === 'High') badgeClass = 'bg-success';
    else if (conf === 'Medium') badgeClass = 'bg-info text-dark';
    
    return `<span class="badge ${badgeClass}" style="font-size: 11px;">${conf}</span>`;
}

// Row Click Listener for Details Slide-out Panel
function onRowClicked(event) {
    const d = event.data;
    
    // Slide open sidebar
    const sidebar = document.getElementById('detailSidebar');
    sidebar.classList.add('open');
    
    // Set details
    document.getElementById('sidebar-opp-number').textContent = d['Opportunity Number'];
    document.getElementById('sidebar-client').textContent = d.Client;
    document.getElementById('sidebar-industry').textContent = d.Industry;
    document.getElementById('sidebar-location').textContent = `${d.Region} / ${d.Country}`;
    document.getElementById('sidebar-bu').textContent = d['Business Unit'];
    document.getElementById('sidebar-stage').textContent = d['Current Stage'];
    document.getElementById('sidebar-value').textContent = '$' + Math.round(d['Opportunity Value']).toLocaleString();
    
    // Predictions
    document.getElementById('sidebar-win-prob').textContent = (d['Win Probability'] * 100).toFixed(1) + '%';
    document.getElementById('sidebar-loss-prob').textContent = (d['Loss Probability'] * 100).toFixed(1) + '%';
    document.getElementById('sidebar-risk-score').innerHTML = riskScoreRenderer({ value: d['Risk Score'] });
    document.getElementById('sidebar-confidence').innerHTML = confidenceRenderer({ value: d['Confidence Score'] });
    document.getElementById('sidebar-slip-risk').textContent = (d['Slip Probability'] * 100).toFixed(1) + '%';
    document.getElementById('sidebar-next-stage').textContent = d['Predicted Next Stage'];
    
    // SHAP drivers
    const posList = document.getElementById('sidebar-pos-drivers');
    posList.innerHTML = `
        <li>${d['Top Driver 1']}</li>
        <li>${d['Top Driver 2']}</li>
    `;
    
    const negList = document.getElementById('sidebar-neg-drivers');
    negList.innerHTML = `
        <li>${d['Top Driver 3']}</li>
    `;
    
    // Build Timeline from Stage Movement dataset
    const timeline = document.getElementById('sidebar-timeline');
    timeline.innerHTML = '';
    
    const oppMoves = AppState.stageMovement.filter(m => m.Opportunity === d['Opportunity Number']);
    if (oppMoves.length > 0) {
        oppMoves.sort((a, b) => new Date(a['Snapshot Date']) - new Date(b['Snapshot Date'])).forEach(m => {
            const row = document.createElement('div');
            row.style.position = 'relative';
            row.style.paddingLeft = '20px';
            row.style.borderLeft = '2px solid var(--border-card)';
            row.style.marginBottom = '12px';
            row.innerHTML = `
                <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
                <div class="fw-bold">${m['Snapshot Date']}</div>
                <div>Stage: ${m['From Stage']} &rarr; ${m['To Stage']}</div>
                <div class="text-muted" style="font-size: 11px;">Days in Stage: ${m['Days In Stage']}</div>
            `;
            timeline.appendChild(row);
        });
    } else {
        timeline.innerHTML = '<p class="text-muted">No historical changes found in the snapshot period.</p>';
    }
}

// Grid Initialization
function initGrids() {
    // 1. Opportunity Grid
    const opportunityGridDiv = document.querySelector('#opportunityGrid');
    if (opportunityGridDiv) {
        const columnDefs = [
            { field: 'Opportunity Number', sortable: true, filter: true, width: 130 },
            { field: 'Client', sortable: true, filter: true, width: 180 },
            { field: 'Industry', sortable: true, filter: true, width: 160 },
            { field: 'Region', sortable: true, filter: true, width: 120 },
            { field: 'Current Stage', sortable: true, filter: true, width: 160 },
            { field: 'Opportunity Value', sortable: true, filter: true, valueFormatter: currencyFormatter, width: 140 },
            { field: 'Win Probability', sortable: true, filter: true, valueFormatter: percentFormatter, width: 130 },
            { field: 'Risk Score', sortable: true, filter: true, cellRenderer: riskScoreRenderer, width: 110 },
            { field: 'Confidence Score', sortable: true, filter: true, cellRenderer: confidenceRenderer, width: 130 },
            { field: 'Predicted Next Stage', sortable: true, filter: true, width: 160 }
        ];

        opportunityGridOptions = {
            columnDefs: columnDefs,
            rowData: null,
            pagination: true,
            paginationPageSize: 15,
            onRowClicked: onRowClicked,
            defaultColDef: {
                resizable: true
            }
        };

        new agGrid.Grid(opportunityGridDiv, opportunityGridOptions);
    }

    // 2. Risk Grid (Top 50 high risk deals)
    const riskGridDiv = document.querySelector('#riskGrid');
    if (riskGridDiv) {
        const columnDefs = [
            { field: 'Opportunity Number', sortable: true, filter: true, width: 130 },
            { field: 'Client', sortable: true, filter: true, width: 180 },
            { field: 'Opportunity Value', sortable: true, filter: true, valueFormatter: currencyFormatter, width: 140 },
            { field: 'Win Probability', sortable: true, filter: true, valueFormatter: percentFormatter, width: 130 },
            { field: 'Risk Score', sortable: true, filter: true, cellRenderer: riskScoreRenderer, width: 110 },
            { field: 'Slip Probability', sortable: true, filter: true, valueFormatter: percentFormatter, width: 130 },
            { field: 'Top Driver 1', sortable: true, filter: true, width: 200 }
        ];

        riskGridOptions = {
            columnDefs: columnDefs,
            rowData: null,
            pagination: true,
            paginationPageSize: 10,
            onRowClicked: onRowClicked,
            defaultColDef: { resizable: true }
        };

        new agGrid.Grid(riskGridDiv, riskGridOptions);
    }
}

// Update grids when filters are applied
function updateGrids() {
    if (!opportunityGridOptions || !riskGridOptions) return;
    
    // Set main grid data
    opportunityGridOptions.api.setRowData(AppState.filteredPredictions);
    
    // Set risk grid data (Filter to Risk Score >= 45 and sort by Risk Score descending)
    const highRiskDeals = AppState.filteredPredictions
        .filter(d => d['Risk Score'] >= 40)
        .sort((a, b) => b['Risk Score'] - a['Risk Score'])
        .slice(0, 50);
        
    riskGridOptions.api.setRowData(highRiskDeals);
}

// Export CSV
document.addEventListener('DOMContentLoaded', () => {
    initGrids();
    
    const exportBtn = document.getElementById('exportCsv');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (opportunityGridOptions && opportunityGridOptions.api) {
                opportunityGridOptions.api.exportDataAsCsv({
                    fileName: 'graychain_opportunity_predictions.csv'
                });
            }
        });
    }
});
