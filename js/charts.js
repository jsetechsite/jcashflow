/**
 * CashFlow PWA — Charts & Visual Analytics (Chart.js)
 */
class CashFlowCharts {
  constructor() {
    this.cashflowChart = null;
    this.expensePieChart = null;
  }

  // Currency helper
  formatCurrency(num) {
    return `${CONFIG.CURRENCY_SYMBOL}${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Render or update Dashboard charts
  renderDashboardCharts() {
    this.initCashFlowChart();
    this.initExpenseBreakdownChart();
  }

  // 1. Cashflow (Income vs Expenses Trend)
  initCashFlowChart() {
    const ctx = document.getElementById('cashflowChartCanvas');
    if (!ctx) return;

    if (this.cashflowChart) {
      this.cashflowChart.destroy();
    }

    const incomeList = store.getItems('income');
    const expenseList = store.getItems('expenses');

    // Aggregate by last 6 months
    const months = [];
    const incomeByMonth = {};
    const expenseByMonth = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mKey = d.toLocaleDateString('en-US', { month: 'short' });
      months.push(mKey);
      incomeByMonth[mKey] = 0;
      expenseByMonth[mKey] = 0;
    }

    incomeList.forEach(item => {
      if (!item.date) return;
      const m = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
      if (incomeByMonth[m] !== undefined) {
        incomeByMonth[m] += Number(item.amount) || 0;
      }
    });

    expenseList.forEach(item => {
      if (!item.date) return;
      const m = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
      if (expenseByMonth[m] !== undefined) {
        expenseByMonth[m] += Number(item.amount) || 0;
      }
    });

    const incomeData = months.map(m => incomeByMonth[m]);
    const expenseData = months.map(m => expenseByMonth[m]);

    this.cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderRadius: 6,
            borderWidth: 1,
            barThickness: 18
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#f43f5e',
            borderRadius: 6,
            borderWidth: 1,
            barThickness: 18
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono' },
              callback: (value) => '₱' + (value >= 1000 ? (value / 1000) + 'k' : value)
            }
          }
        }
      }
    });
  }

  // 2. Expense Category Breakdown (Doughnut)
  initExpenseBreakdownChart() {
    const ctx = document.getElementById('expensePieCanvas');
    if (!ctx) return;

    if (this.expensePieChart) {
      this.expensePieChart.destroy();
    }

    const expenses = store.getItems('expenses');
    const categoryTotals = {};

    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(exp.amount) || 0);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const colors = [
      '#f43f5e', '#ec4899', '#a855f7', '#6366f1',
      '#3b82f6', '#0ea5e9', '#14b8a6', '#f59e0b', '#84cc16'
    ];

    if (labels.length === 0) {
      labels.push('No data yet');
      data.push(1);
    }

    this.expensePieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            callbacks: {
              label: (context) => ` ${context.label}: ${this.formatCurrency(context.parsed)}`
            }
          }
        },
        cutout: '72%'
      }
    });
  }
}

window.charts = new CashFlowCharts();
