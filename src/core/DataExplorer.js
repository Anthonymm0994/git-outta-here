import DataManager from './DataManager.js';
import FilterManager from './FilterManager.js';
import LayoutEngine from './LayoutEngine.js';
import ChartManager from './ChartManager.js';
import { LAYOUT_PRESETS } from '../constants/index.js';

/**
 * Main DataExplorer class - orchestrates all components and provides unified API
 * This is the primary interface for users to create and manage data visualization dashboards
 */
export default class DataExplorer {
  constructor(config = {}) {
    this.config = {
      theme: 'dark',
      responsive: true,
      enablePerformanceMonitoring: true,
      ...config
    };
    
    // Initialize core components
    this.dataManager = new DataManager(config.performance);
    this.filterManager = new FilterManager(this.dataManager);
    this.layoutEngine = new LayoutEngine(config.layout);
    this.chartManager = new ChartManager(this.dataManager, this.filterManager, this.layoutEngine);
    
    // State management
    this.isInitialized = false;
    this.currentLayout = null;
    this.performanceMetrics = {};
    
    // Event system
    this.eventListeners = new Map();
    this.eventQueue = [];
    
    // Set up component event handlers
    this.setupComponentEventHandlers();
    
    // Performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }
  }

  /**
   * Set up event handlers for component interactions
   */
  setupComponentEventHandlers() {
    // Filter manager events
    this.filterManager.setCallbacks({
      onFilterChange: (field, filter) => {
        this.emit('filterChange', { field, filter });
      },
      onFilterComplete: (stats) => {
        this.emit('filterComplete', stats);
        this.updateCharts();
      }
    });
  }

  /**
   * Set up performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor data operations
    setInterval(() => {
      this.performanceMetrics = {
        data: this.dataManager.getPerformanceMetrics(),
        filters: this.filterManager.getFilterStats(),
        charts: this.chartManager.getChartStats(),
        layout: this.layoutEngine.getLayoutStats()
      };
      
      this.emit('performanceUpdate', this.performanceMetrics);
    }, 1000);
  }

  /**
   * Initialize the data explorer with data and layout
   * @param {Object} initConfig - Initialization configuration
   */
  async initialize(initConfig) {
    try {
      const { data, layout, charts, options = {} } = initConfig;
      
      // Load data
      if (data) {
        await this.loadData(data, options);
      }
      
      // Set layout
      if (layout) {
        this.setLayout(layout);
      }
      
      // Create charts
      if (charts && Array.isArray(charts)) {
        this.createCharts(charts);
      }
      
      this.isInitialized = true;
      this.emit('initialized', { success: true });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize DataExplorer:', error);
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Load data into the explorer
   * @param {*} data - Data source (CSV, array, or TypedArrays)
   * @param {Object} options - Loading options
   */
  async loadData(data, options = {}) {
    try {
      const result = await this.dataManager.loadData(data, options);
      
      // Update filter manager with new data
      this.filterManager = new FilterManager(this.dataManager);
      this.chartManager = new ChartManager(this.dataManager, this.filterManager, this.layoutEngine);
      
      this.emit('dataLoaded', result);
      return result;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'loadData' });
      throw error;
    }
  }

  /**
   * Set dashboard layout
   * @param {string|Object} layout - Layout preset or custom configuration
   */
  setLayout(layout) {
    try {
      this.layoutEngine.setLayout(layout);
      this.currentLayout = this.layoutEngine.getCurrentLayout();
      
      // Update chart manager with new layout
      this.chartManager = new ChartManager(this.dataManager, this.filterManager, this.layoutEngine);
      
      this.emit('layoutChanged', { layout: this.currentLayout });
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'setLayout' });
      throw error;
    }
  }

  /**
   * Create charts from configuration
   * @param {Array} chartConfigs - Array of chart configurations
   */
  createCharts(chartConfigs) {
    try {
      chartConfigs.forEach((config, index) => {
        const chartId = config.id || `chart_${index}`;
        this.chartManager.createChart(chartId, config);
      });
      
      this.emit('chartsCreated', { count: chartConfigs.length });
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'createCharts' });
      throw error;
    }
  }

  /**
   * Add a single chart
   * @param {string} chartId - Chart identifier
   * @param {Object} config - Chart configuration
   */
  addChart(chartId, config) {
    try {
      const chart = this.chartManager.createChart(chartId, config);
      this.emit('chartAdded', { chartId, config });
      return chart;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'addChart' });
      throw error;
    }
  }

  /**
   * Remove a chart
   * @param {string} chartId - Chart identifier
   */
  removeChart(chartId) {
    try {
      this.chartManager.destroyChart(chartId);
      this.emit('chartRemoved', { chartId });
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'removeChart' });
      throw error;
    }
  }

  /**
   * Apply filters to the data
   * @param {Object} filters - Filter configuration
   */
  async applyFilters(filters) {
    try {
      // Set filters
      Object.entries(filters).forEach(([field, filterConfig]) => {
        this.filterManager.setFilter(field, filterConfig);
      });
      
      // Apply filters
      const result = await this.filterManager.applyFilters();
      this.emit('filtersApplied', result);
      return result;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'applyFilters' });
      throw error;
    }
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    try {
      this.filterManager.resetFilters();
      this.emit('filtersCleared');
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'clearFilters' });
      throw error;
    }
  }

  /**
   * Update all charts
   */
  updateCharts() {
    try {
      this.chartManager.updateAllCharts();
      this.emit('chartsUpdated');
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'updateCharts' });
      throw error;
    }
  }

  /**
   * Resize all charts (useful for responsive layouts)
   */
  resizeCharts() {
    try {
      this.chartManager.resizeAllCharts();
      this.emit('chartsResized');
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'resizeCharts' });
      throw error;
    }
  }

  /**
   * Export filtered data
   * @param {Array} fields - Fields to export (default: all)
   * @param {string} format - Export format (default: 'csv')
   */
  exportData(fields = null, format = 'csv') {
    try {
      let result;
      
      switch (format.toLowerCase()) {
        case 'csv':
          result = this.dataManager.exportToCSV(fields);
          break;
        case 'json':
          result = this.getFilteredData(fields);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      this.emit('dataExported', { format, fields, result });
      return result;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'exportData' });
      throw error;
    }
  }

  /**
   * Get filtered data as objects
   * @param {Array} fields - Fields to include (default: all)
   */
  getFilteredData(fields = null) {
    try {
      const exportFields = fields || Object.keys(this.dataManager.data);
      const filteredIndices = this.dataManager.filteredIndices;
      const data = this.dataManager.data;
      
      if (!filteredIndices) return [];
      
      const result = [];
      for (let i = 0; i < data[exportFields[0]].length; i++) {
        if (filteredIndices[i]) {
          const row = {};
          exportFields.forEach(field => {
            row[field] = data[field][i];
          });
          result.push(row);
        }
      }
      
      return result;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'getFilteredData' });
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  getStats() {
    try {
      return {
        data: {
          totalRows: this.dataManager.totalRows,
          filteredRows: this.dataManager.currentRows,
          percentage: this.dataManager.totalRows > 0 ? 
            (this.dataManager.currentRows / this.dataManager.totalRows * 100).toFixed(1) : 0
        },
        filters: this.filterManager.getFilterStats(),
        charts: this.chartManager.getChartStats(),
        layout: this.layoutEngine.getLayoutStats(),
        performance: this.performanceMetrics
      };
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'getStats' });
      throw error;
    }
  }

  /**
   * Save dashboard configuration
   */
  saveConfiguration() {
    try {
      const config = {
        layout: this.layoutEngine.exportLayout(),
        charts: this.chartManager.exportChartConfig(),
        filters: this.filterManager.exportFilters(),
        timestamp: new Date().toISOString()
      };
      
      this.emit('configurationSaved', config);
      return config;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'saveConfiguration' });
      throw error;
    }
  }

  /**
   * Load dashboard configuration
   * @param {Object} config - Configuration to load
   */
  loadConfiguration(config) {
    try {
      if (config.layout) {
        this.layoutEngine.importLayout(config.layout);
      }
      
      if (config.charts) {
        this.chartManager.importChartConfig(config.charts);
      }
      
      if (config.filters) {
        this.filterManager.importFilters(config.filters);
      }
      
      this.emit('configurationLoaded', config);
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'loadConfiguration' });
      throw error;
    }
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return this;
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    
    // Queue event for potential replay
    this.eventQueue.push({ event, data, timestamp: Date.now() });
    
    // Keep only last 100 events
    if (this.eventQueue.length > 100) {
      this.eventQueue.shift();
    }
  }

  /**
   * Get recent events
   * @param {number} count - Number of events to return
   */
  getRecentEvents(count = 10) {
    return this.eventQueue.slice(-count);
  }

  /**
   * Reset the explorer to initial state
   */
  reset() {
    try {
      this.filterManager.resetFilters();
      this.chartManager.destroyAllCharts();
      this.emit('reset');
      return this;
    } catch (error) {
      this.emit('error', { error: error.message, operation: 'reset' });
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    try {
      this.chartManager.destroy();
      this.filterManager.destroy();
      this.layoutEngine.destroy();
      this.dataManager.destroy();
      
      this.eventListeners.clear();
      this.eventQueue = [];
      this.isInitialized = false;
      
      this.emit('destroyed');
    } catch (error) {
      console.error('Error during destruction:', error);
    }
  }
}
