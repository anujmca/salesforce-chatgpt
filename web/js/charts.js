// ECharts Visualizations Manager
let activeCharts = {};

const FEATURE_NAMES_MAP = {
    'Num_Appearances': 'High Snapshot Appearances',
    'Opp_Age_Days': 'Long Deal Age',
    'Num_Stage_Changes': 'Frequent Stage Transitions',
    'Stage_Velocity': 'Fast Stage Progression',
    'Days_In_Current_Stage': 'Stuck in Stage',
    'Weighted_Amount': 'Large Weighted Value',
    'Unweighted_Amount': 'Large Unweighted Value',
    'Amount_Growth_Trend': 'Increasing Deal Value',
    'Amount_Decline_Trend': 'Declining Deal Value',
    'Num_Slippages': 'Multiple Forecast Slippages',
    'client_win_rate': 'Strong Historical Client Win Rate',
    'client_loss_rate': 'Poor Historical Client Win Rate',
    'client_avg_size': 'Large Historical Client Deal Size',
    'Stage': 'Current stage position',
    'Region': 'Geographic Region',
    'Business Unit': 'Business Unit Group',
    'Country/Entity': 'Country Entity Location',
    'Service Group': 'Service Group Department',
    'Sub-Service': 'Sub-Service Offering',
    'Core Industry': 'Core Client Industry',
    'Detail Industry': 'Specific Industry Segment',
    'Partner': 'Assigned Partner Influence',
    'Comp/SS': 'Competitive Bid Status',
    'Client Type (New)': 'Client Relationship Status'
};


function getThemeColors() {
    const isDark = AppState.theme === 'dark';
    return {
        text: isDark ? '#94a3b8' : '#475569',
        grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        tooltipBg: isDark ? '#1e293b' : '#ffffff',
        tooltipBorder: isDark ? '#334155' : '#e2e8f0',
        palette: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']
    };
}

function renderAllCharts() {
    const colors = getThemeColors();
    
    renderRevenueTrendChart(colors);
    renderFunnelChart(colors);
    renderOutcomeDistChart(colors);
    renderGeoChart(colors);
    renderRiskMatrixChart(colors);
    renderSimulatorChart(colors);
    renderRocChart(colors);
    renderConfusionChart(colors);
    renderImportanceChart(colors);
    renderShapSummaryChart(colors);
    renderSankeyChart(colors);
    renderStageVelocityChart(colors);
    renderSlippageTrackerChart(colors);
}

// 1. Revenue Forecast Trend Chart
function renderRevenueTrendChart(colors) {
    const id = 'chart-revenue-trend';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const months = AppState.forecast.map(d => d.Month);
    const expected = AppState.forecast.map(d => d['Predicted Revenue']);
    const best = AppState.forecast.map(d => d['Best Case Revenue']);
    const worst = AppState.forecast.map(d => d['Worst Case Revenue']);
    
    const option = {
        color: colors.palette,
        tooltip: {
            trigger: 'axis',
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            textStyle: { color: colors.text }
        },
        legend: {
            data: ['Expected Case', 'Best Case', 'Worst Case'],
            textStyle: { color: colors.text }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true, borderColor: colors.grid },
        xAxis: {
            type: 'category',
            data: months,
            axisLabel: { color: colors.text }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: colors.text, formatter: val => `$${(val/1000000).toFixed(1)}M` },
            splitLine: { lineStyle: { color: colors.grid } }
        },
        series: [
            {
                name: 'Expected Case',
                type: 'line',
                data: expected,
                smooth: true,
                lineStyle: { width: 3 }
            },
            {
                name: 'Best Case',
                type: 'line',
                data: best,
                smooth: true,
                lineStyle: { type: 'dashed' }
            },
            {
                name: 'Worst Case',
                type: 'line',
                data: worst,
                smooth: true,
                lineStyle: { type: 'dashed' }
            }
        ]
    };
    chart.setOption(option);
}

// 2. Pipeline Funnel Chart
function renderFunnelChart(colors) {
    const id = 'chart-funnel';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Aggregate unweighted amount per stage
    const stages = {};
    AppState.filteredPredictions.forEach(d => {
        stages[d['Current Stage']] = (stages[d['Current Stage']] || 0) + d['Opportunity Value'];
    });
    
    const data = Object.entries(stages).map(([name, value]) => ({ name, value }));
    
    const option = {
        color: colors.palette,
        tooltip: { trigger: 'item', formatter: "{a} <br/>{b} : ${c}" },
        series: [
            {
                name: 'Pipeline Value',
                type: 'funnel',
                left: '10%',
                top: 20,
                bottom: 20,
                width: '80%',
                sort: 'descending',
                label: { show: true, position: 'inside', formatter: '{b}' },
                data: data
            }
        ]
    };
    chart.setOption(option);
}

// 3. Outcome Distribution Chart
function renderOutcomeDistChart(colors) {
    const id = 'chart-outcome-dist';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Group outcomes
    const outcomes = { Won: 0, Lost: 0, Abandoned: 0 };
    AppState.filteredPredictions.forEach(d => {
        outcomes[d['Predicted Outcome']] = (outcomes[d['Predicted Outcome']] || 0) + 1;
    });
    
    const data = Object.entries(outcomes).map(([name, value]) => ({ name, value }));
    
    const option = {
        color: ['#10b981', '#ef4444', '#f59e0b'],
        tooltip: { trigger: 'item' },
        legend: { bottom: '5%', left: 'center', textStyle: { color: colors.text } },
        series: [
            {
                name: 'Predicted Outcome',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: colors.tooltipBg, borderWidth: 2 },
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
                data: data
            }
        ]
    };
    chart.setOption(option);
}

// 4. Geographic Performance
function renderGeoChart(colors) {
    const id = 'chart-geo';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Aggregate unweighted amount per region
    const regions = {};
    AppState.filteredPredictions.forEach(d => {
        regions[d.Region] = (regions[d.Region] || 0) + d['Opportunity Value'];
    });
    
    const data = Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const option = {
        color: colors.palette,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: colors.grid } }, axisLabel: { color: colors.text } },
        yAxis: { type: 'category', data: data.map(d => d[0]), axisLabel: { color: colors.text } },
        series: [
            {
                name: 'Pipeline Value',
                type: 'bar',
                data: data.map(d => d[1]),
                itemStyle: { borderRadius: [0, 8, 8, 0] }
            }
        ]
    };
    chart.setOption(option);
}

// 5. Risk Matrix Chart (Bubble Chart)
function renderRiskMatrixChart(colors) {
    const id = 'chart-risk-matrix';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Prepare bubble data
    const data = AppState.filteredPredictions.slice(0, 150).map(d => [
        d['Win Probability'] * 100, // X
        d['Opportunity Value'],     // Y
        d['Risk Score'],            // Size
        d['Opportunity Number'],    // Tooltip detail
        d.Client
    ]);
    
    const option = {
        color: ['rgba(99, 102, 241, 0.6)'],
        tooltip: {
            trigger: 'item',
            formatter: params => `
                <b>${params.value[4]} (${params.value[3]})</b><br/>
                Win Probability: ${params.value[0].toFixed(1)}%<br/>
                Deal Value: $${(params.value[1]/1000).toFixed(0)}k<br/>
                Risk Score: ${params.value[2]}
            `
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', name: 'Win Probability %', axisLabel: { color: colors.text }, splitLine: { lineStyle: { color: colors.grid } } },
        yAxis: { type: 'value', name: 'Deal Value $', axisLabel: { color: colors.text }, splitLine: { lineStyle: { color: colors.grid } } },
        series: [
            {
                type: 'scatter',
                symbolSize: val => Math.max(10, val[2] / 2.5),
                data: data
            }
        ]
    };
    chart.setOption(option);
}

// 6. Simulator Bar Chart
let winMult = 1.0;
let convImp = 0.0;
let slipRed = 0.0;

function renderSimulatorChart(colors) {
    const id = 'chart-sim-outcome';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Simulate expected revenues based on multipliers
    const originalExpected = AppState.predictions.reduce((acc, curr) => acc + (curr['Opportunity Value'] * curr['Win Probability']), 0);
    
    // Simulated expected win probabilities
    const simulatedExpected = AppState.predictions.reduce((acc, curr) => {
        let simProb = curr['Win Probability'] * winMult;
        simProb = Math.min(1.0, simProb + (convImp / 100.0));
        return acc + (curr['Opportunity Value'] * simProb);
    }, 0);
    
    const bestCase = AppState.predictions.reduce((acc, curr) => acc + curr['Opportunity Value'], 0) * 0.75;
    const worstCase = originalExpected * 0.6;
    
    const option = {
        color: ['#6366f1', '#10b981', '#38bdf8', '#f59e0b'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: ['Worst Case', 'Baseline Expected', 'Simulated Expected', 'Best Case Limit'], axisLabel: { color: colors.text } },
        yAxis: { type: 'value', axisLabel: { color: colors.text, formatter: val => `$${(val/1000000).toFixed(1)}M` } },
        series: [
            {
                name: 'Simulated Revenue',
                type: 'bar',
                data: [worstCase, originalExpected, simulatedExpected, bestCase],
                itemStyle: {
                    borderRadius: [8, 8, 0, 0]
                }
            }
        ]
    };
    chart.setOption(option);
}

// 7. Model Performance ROC Validation Chart
function renderRocChart(colors) {
    const id = 'chart-roc';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Mock ROC curves for display
    const xgbRoc = Array.from({length: 20}, (_, i) => [i/20, Math.min(1, i/20 + (i === 0 ? 0 : 0.25 - 0.2*i/20))]);
    const baseline = [[0, 0], [1, 1]];
    
    const option = {
        color: ['#6366f1', '#94a3b8'],
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', name: 'False Positive Rate', axisLabel: { color: colors.text } },
        yAxis: { type: 'value', name: 'True Positive Rate', axisLabel: { color: colors.text } },
        series: [
            { name: 'XGBoost (AUC: 0.837)', type: 'line', data: xgbRoc, smooth: true },
            { name: 'Random Guess', type: 'line', data: baseline, lineStyle: { type: 'dashed' } }
        ]
    };
    chart.setOption(option);
}

// 8. Confusion Matrix Heatmap
function renderConfusionChart(colors) {
    const id = 'chart-confusion';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    // Confusion matrix values (macro averages)
    const data = [
        [0, 0, 84], [0, 1, 12], [0, 2, 4],
        [1, 0, 15], [1, 1, 78], [1, 2, 7],
        [2, 0, 8],  [2, 1, 10], [2, 2, 82]
    ];
    
    const option = {
        tooltip: { position: 'top' },
        grid: { height: '50%', top: '10%' },
        xAxis: { type: 'category', data: ['Won', 'Lost', 'Abandoned'], splitArea: { show: true }, axisLabel: { color: colors.text } },
        yAxis: { type: 'category', data: ['Won', 'Lost', 'Abandoned'], splitArea: { show: true }, axisLabel: { color: colors.text } },
        visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: '15%' },
        series: [{
            name: 'Prediction Heatmap',
            type: 'heatmap',
            data: data,
            label: { show: true },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
        }]
    };
    chart.setOption(option);
}

// 9. Feature Importance
function renderImportanceChart(colors) {
    const id = 'chart-importance';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const data = [
        ['client_win_rate', 0.28],
        ['Weighted_Amount', 0.18],
        ['Num_Slippages', 0.14],
        ['Opp_Age_Days', 0.11],
        ['Days_In_Current_Stage', 0.09],
        ['Num_Stage_Changes', 0.08],
        ['client_avg_size', 0.06],
        ['Stage_Velocity', 0.04]
    ].reverse();
    
    const option = {
        color: ['#6366f1'],
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: colors.text } },
        yAxis: { type: 'category', data: data.map(d => FEATURE_NAMES_MAP[d[0]] || d[0]), axisLabel: { color: colors.text } },
        series: [
            {
                name: 'Feature Importance',
                type: 'bar',
                data: data.map(d => d[1]),
                itemStyle: { borderRadius: [0, 8, 8, 0] }
            }
        ]
    };
    chart.setOption(option);
}

// 10. SHAP Summary Plot
function renderShapSummaryChart(colors) {
    const id = 'chart-shap-summary';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const data = [
        ['client_win_rate', 0.32],
        ['Weighted_Amount', 0.22],
        ['Num_Slippages', -0.19],
        ['Days_In_Current_Stage', -0.15],
        ['Opp_Age_Days', -0.12],
        ['Num_Stage_Changes', 0.10],
        ['client_avg_size', 0.08]
    ].reverse();
    
    const option = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', name: 'Impact on Win Prob', axisLabel: { color: colors.text } },
        yAxis: { type: 'category', data: data.map(d => FEATURE_NAMES_MAP[d[0]] || d[0]), axisLabel: { color: colors.text } },
        series: [
            {
                name: 'SHAP Contribution',
                type: 'bar',
                data: data.map(d => d[1]),
                itemStyle: {
                    color: params => params.value > 0 ? '#10b981' : '#ef4444',
                    borderRadius: [0, 8, 8, 0]
                }
            }
        ]
    };
    chart.setOption(option);
}

// 11. Sankey Pipeline Flow
function renderSankeyChart(colors) {
    const id = 'chart-sankey';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const option = {
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [
            {
                type: 'sankey',
                data: [
                    { name: '1. Identify Opp' },
                    { name: '2. Qualify Opp' },
                    { name: '3. Develop Proposal' },
                    { name: '4. Issue Proposal' },
                    { name: '5. Won' },
                    { name: '6. Lost' },
                    { name: '7. Abandoned' }
                ],
                links: [
                    { source: '1. Identify Opp', target: '2. Qualify Opp', value: 8500 },
                    { source: '1. Identify Opp', target: '7. Abandoned', value: 1200 },
                    { source: '2. Qualify Opp', target: '3. Develop Proposal', value: 6200 },
                    { source: '2. Qualify Opp', target: '6. Lost', value: 1800 },
                    { source: '3. Develop Proposal', target: '4. Issue Proposal', value: 5000 },
                    { source: '3. Develop Proposal', target: '6. Lost', value: 900 },
                    { source: '4. Issue Proposal', target: '5. Won', value: 3800 },
                    { source: '4. Issue Proposal', target: '6. Lost', value: 800 },
                    { source: '4. Issue Proposal', target: '7. Abandoned', value: 400 }
                ],
                lineStyle: { color: 'gradient', curveness: 0.5 }
            }
        ]
    };
    chart.setOption(option);
}

// 12. Stage Velocity
function renderStageVelocityChart(colors) {
    const id = 'chart-stage-velocity';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const option = {
        color: colors.palette,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['Identify', 'Qualify', 'Develop', 'Issue'], axisLabel: { color: colors.text } },
        yAxis: { type: 'value', name: 'Avg Days in Stage', axisLabel: { color: colors.text }, splitLine: { lineStyle: { color: colors.grid } } },
        series: [
            {
                name: 'Days',
                type: 'bar',
                data: [42, 68, 89, 31],
                itemStyle: { borderRadius: [8, 8, 0, 0] }
            }
        ]
    };
    chart.setOption(option);
}

// 13. Slippage history tracker
function renderSlippageTrackerChart(colors) {
    const id = 'chart-slippage-tracker';
    const el = document.getElementById(id);
    if (!el) return;
    
    if (activeCharts[id]) activeCharts[id].dispose();
    const chart = echarts.init(el);
    activeCharts[id] = chart;
    
    const option = {
        color: ['#ef4444'],
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], axisLabel: { color: colors.text } },
        yAxis: { type: 'value', name: 'Slipped Deal Count', axisLabel: { color: colors.text }, splitLine: { lineStyle: { color: colors.grid } } },
        series: [
            {
                name: 'Slipped',
                type: 'line',
                data: [120, 145, 95, 160, 130],
                smooth: true,
                lineStyle: { width: 3 }
            }
        ]
    };
    chart.setOption(option);
}

// Connect simulator slider triggers
document.addEventListener('DOMContentLoaded', () => {
    const simWin = document.getElementById('simWinRate');
    if (simWin) {
        simWin.addEventListener('input', (e) => {
            winMult = parseFloat(e.target.value);
            document.getElementById('val-win-mult').textContent = `${winMult.toFixed(2)}x`;
            renderSimulatorChart(getThemeColors());
        });
    }

    const simConv = document.getElementById('simConversion');
    if (simConv) {
        simConv.addEventListener('input', (e) => {
            convImp = parseInt(e.target.value);
            document.getElementById('val-conv-imp').textContent = `+${convImp}%`;
            renderSimulatorChart(getThemeColors());
        });
    }

    const simSlip = document.getElementById('simSlippage');
    if (simSlip) {
        simSlip.addEventListener('input', (e) => {
            slipRed = parseInt(e.target.value);
            document.getElementById('val-slip-red').textContent = `${slipRed}%`;
            renderSimulatorChart(getThemeColors());
        });
    }
});
