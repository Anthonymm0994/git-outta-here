import { CHART_TYPES, DEFAULT_CHART_CONFIG } from '../constants/index.js';
import HistogramChart from '../charts/HistogramChart.js';
import AngleChart from '../charts/AngleChart.js';
import CategoryChart from '../charts/CategoryChart.js';
import TimeChart from '../charts/TimeChart.js';

/**
 * Manages chart lifecycle, interactions, and provides unified chart interface
 * Handles chart creation, updates, and coordination between charts
 */
export default class ChartManager {
  constructor(dataManager, filterManager, layoutEngine) {
    this.dataManager = dataManager;
    this.filterManager = filterManager;
    this.layoutEngine = layoutEngine;
    
    this.charts = new Map();
    this.chartFactories = this.initializeChartFactories();
    this.chartRegistry = new Map();
    
    // Chart interaction state
    this.activeSelections = new Map();
    this.crossChartFilters = new Map();
    this.chartEventListeners = new Map();
    
    // Performance optimization
    this.updateQueue = new Set();
    this.updateScheduled = false;
    this.batchUpdateSize = 5;
  }

  /**
   * Initialize chart factory functions
   */
  initializeChartFactories() {
    return {
      [CHART_TYPES.HISTOGRAM]: (config) => new HistogramChart(config),
      [CHART_TYPES.ANGLE]: (config) => new AngleChart(config),
      [CHART_TYPES.CATEGORY]: (config) => new CategoryChart(config),
      [CHART_TYPES.TIME]: (config) => new TimeChart(config),
      [CHART_TYPES.SCATTER]: (config) => new ScatterChart(config),
      [CHART_TYPES.LINE]: (config) => new LineChart(config),
      [CHART_TYPES.BAR]: (config) => new BarChart(config)
    };
  }

  /**
   * Create and register a chart
   * @param {string} chartId - Unique chart identifier
   * @param {Object} config - Chart configuration
   */
  createChart(chartId, config) {
    const { type, data, position, options = {} } = config;
    
    if (!this.chartFactories[type]) {
      throw new Error(`Unknown chart type: ${type}`);
    }

    // Merge with default configuration
    const chartConfig = {
      ...DEFAULT_CHART_CONFIG,
      ...options,
      id: chartId,
      dataField: data,
      position,
      dataManager: this.dataManager,
      filterManager: this.filterManager
    };

    // Create chart instance
    const chart = this.chartFactories[type](chartConfig);
    
    // Register chart
    this.charts.set(chartId, chart);
    this.chartRegistry.set(chartId, {
      type,
      config: chartConfig,
      instance: chart,
      position,
      dataField: data
    });

    // Set up event listeners
    this.setupChartEventListeners(chartId, chart);

    return chart;
  }

  /**
   * Set up event listeners for chart interactions
   */
  setupChartEventListeners(chartId, chart) {
    const listeners = new Map();
    
    // Selection events
    listeners.set('selection', (event) => {
      this.handleChartSelection(chartId, event);
    });

    // Filter events
    listeners.set('filter', (event) => {
      this.handleChartFilter(chartId, event);
    });

    // Hover events
    listeners.set('hover', (event) => {
      this.handleChartHover(chartId, event);
    });

    // Register listeners with chart
    listeners.forEach((listener, eventType) => {
      chart.addEventListener(eventType, listener);
    });

    this.chartEventListeners.set(chartId, listeners);
  }

  /**
   * Handle chart selection events
   */
  handleChartSelection(chartId, event) {
    const { selection, data } = event;
    
    if (selection) {
      this.activeSelections.set(chartId, selection);
      this.applyCrossChartFilters();
    } else {
      this.activeSelections.delete(chartId);
      this.clearCrossChartFilters();
    }

    // Notify other charts of selection change
    this.notifyChartsOfSelectionChange(chartId, selection);
  }

  /**
   * Handle chart filter events
   */
  handleChartFilter(chartId, event) {
    const { filterType, filterValue, field } = event;
    
    // Create filter in filter manager
    switch (filterType) {
      case 'range':
        this.filterManager.createRangeFilter(field, filterValue[0], filterValue[1]);
        break;
      case 'category':
        this.filterManager.createCategoryFilter(field, filterValue);
        break;
      case 'angle':
        this.filterManager.createAngleFilter(field, filterValue[0], filterValue[1]);
        break;
    }

    // Apply filters
    this.filterManager.applyFilters();
  }

  /**
   * Handle chart hover events
   */
  handleChartHover(chartId, event) {
    // Implement hover tooltip coordination between charts
    this.updateCrossChartTooltips(chartId, event);
  }

  /**
   * Apply cross-chart filters based on active selections
   */
  applyCrossChartFilters() {
    const activeSelections = Array.from(this.activeSelections.entries());
    
    if (activeSelections.length === 0) return;

    // Group selections by data field
    const fieldSelections = new Map();
    
    activeSelections.forEach(([chartId, selection]) => {
      const chartInfo = this.chartRegistry.get(chartId);
      if (chartInfo) {
        const { dataField } = chartInfo;
        if (!fieldSelections.has(dataField)) {
          fieldSelections.set(dataField, []);
        }
        fieldSelections.get(dataField).push(selection);
      }
    });

    // Apply filters for each field
    fieldSelections.forEach((selections, field) => {
      if (selections.length === 1) {
        // Single selection - apply directly
        this.applySelectionFilter(field, selections[0]);
      } else {
        // Multiple selections - combine with OR logic
        this.applyCombinedSelectionFilter(field, selections);
      }
    });
  }

  /**
   * Apply a single selection filter
   */
  applySelectionFilter(field, selection) {
    const chartInfo = this.getChartByDataField(field);
    if (!chartInfo) return;

    const { type } = chartInfo;
    
    switch (type) {
      case CHART_TYPES.HISTOGRAM:
      case CHART_TYPES.TIME:
        this.filterManager.createRangeFilter(field, selection[0], selection[1]);
        break;
      case CHART_TYPES.ANGLE:
        this.filterManager.createAngleFilter(field, selection[0], selection[1]);
        break;
      case CHART_TYPES.CATEGORY:
        this.filterManager.createCategoryFilter(field, selection);
        break;
    }
  }

  /**
   * Apply combined selection filters with OR logic
   */
  applyCombinedSelectionFilter(field, selections) {
    // For now, use the first selection - could implement OR logic later
    this.applySelectionFilter(field, selections[0]);
  }

  /**
   * Clear cross-chart filters
   */
  clearCrossChartFilters() {
    this.filterManager.resetFilters();
  }

  /**
   * Notify all charts of selection change
   */
  notifyChartsOfSelectionChange(sourceChartId, selection) {
    this.charts.forEach((chart, chartId) => {
      if (chartId !== sourceChartId && chart.handleExternalSelection) {
        chart.handleExternalSelection(selection);
      }
    });
  }

  /**
   * Update cross-chart tooltips
   */
  updateCrossChartTooltips(sourceChartId, hoverEvent) {
    // Implement coordinated tooltip system
    // This could show related data across multiple charts
  }

  /**
   * Get chart by data field
   */
  getChartByDataField(field) {
    for (const [chartId, info] of this.chartRegistry) {
      if (info.dataField === field) {
        return info;
      }
    }
    return null;
  }

  /**
   * Update all charts
   */
  updateAllCharts() {
    this.charts.forEach(chart => {
      if (chart.update) {
        chart.update();
      }
    });
  }

  /**
   * Update specific chart
   */
  updateChart(chartId) {
    const chart = this.charts.get(chartId);
    if (chart && chart.update) {
      chart.update();
    }
  }

  /**
   * Queue chart for update
   */
  queueChartUpdate(chartId) {
    this.updateQueue.add(chartId);
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.processUpdateQueue());
    }
  }

  /**
   * Process update queue
   */
  processUpdateQueue() {
    const chartsToUpdate = Array.from(this.updateQueue);
    this.updateQueue.clear();
    this.updateScheduled = false;

    // Update charts in batches for performance
    for (let i = 0; i < chartsToUpdate.length; i += this.batchUpdateSize) {
      const batch = chartsToUpdate.slice(i, i + this.batchUpdateSize);
      
      requestAnimationFrame(() => {
        batch.forEach(chartId => this.updateChart(chartId));
      });
    }
  }

  /**
   * Resize all charts
   */
  resizeAllCharts() {
    this.charts.forEach(chart => {
      if (chart.resize) {
        chart.resize();
      }
    });
  }

  /**
   * Get chart statistics
   */
  getChartStats() {
    const stats = {
      totalCharts: this.charts.size,
      chartTypes: {},
      activeSelections: this.activeSelections.size,
      crossChartFilters: this.crossChartFilters.size
    };

    // Count chart types
    this.chartRegistry.forEach(info => {
      const type = info.type;
      stats.chartTypes[type] = (stats.chartTypes[type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export chart configuration
   */
  exportChartConfig() {
    const config = {};
    
    this.chartRegistry.forEach((info, chartId) => {
      config[chartId] = {
        type: info.type,
        data: info.dataField,
        position: info.position,
        options: info.config
      };
    });

    return config;
  }

  /**
   * Import chart configuration
   */
  importChartConfig(config) {
    // Clear existing charts
    this.destroyAllCharts();
    
    // Create charts from config
    Object.entries(config).forEach(([chartId, chartConfig]) => {
      this.createChart(chartId, chartConfig);
    });
  }

  /**
   * Destroy specific chart
   */
  destroyChart(chartId) {
    const chart = this.charts.get(chartId);
    if (chart && chart.destroy) {
      chart.destroy();
    }
    
    this.charts.delete(chartId);
    this.chartRegistry.delete(chartId);
    this.activeSelections.delete(chartId);
    
    // Clean up event listeners
    const listeners = this.chartEventListeners.get(chartId);
    if (listeners) {
      listeners.forEach((listener, eventType) => {
        if (chart.removeEventListener) {
          chart.removeEventListener(eventType, listener);
        }
      });
      this.chartEventListeners.delete(chartId);
    }
  }

  /**
   * Destroy all charts
   */
  destroyAllCharts() {
    const chartIds = Array.from(this.charts.keys());
    chartIds.forEach(chartId => this.destroyChart(chartId));
  }

  /**
   * Get chart instance
   */
  getChart(chartId) {
    return this.charts.get(chartId);
  }

  /**
   * Get all chart IDs
   */
  getChartIds() {
    return Array.from(this.charts.keys());
  }

  /**
   * Check if chart exists
   */
  hasChart(chartId) {
    return this.charts.has(chartId);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.destroyAllCharts();
    this.chartEventListeners.clear();
    this.activeSelections.clear();
    this.crossChartFilters.clear();
  }
}
