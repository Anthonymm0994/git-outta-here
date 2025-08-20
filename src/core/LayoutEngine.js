import { LAYOUT_PRESETS } from '../constants/index.js';

/**
 * Manages dashboard layout and chart positioning
 * Provides flexible grid system with preset layouts and custom configurations
 */
export default class LayoutEngine {
  constructor(config = {}) {
    this.config = {
      rows: 2,
      cols: 3,
      gap: 8,
      padding: 8,
      responsive: true,
      ...config
    };
    
    this.layouts = this.initializePresetLayouts();
    this.currentLayout = null;
    this.chartPositions = new Map();
    
    // Responsive breakpoints
    this.breakpoints = {
      mobile: 768,
      tablet: 1024,
      desktop: 1200
    };
  }

  /**
   * Initialize preset layouts
   */
  initializePresetLayouts() {
    return {
      [LAYOUT_PRESETS.EXECUTIVE]: {
        name: 'Executive Dashboard',
        rows: 2,
        cols: 3,
        gap: 8,
        padding: 8,
        charts: [
          { type: 'time', position: [0, 0, 1, 1], title: 'Time Distribution' },
          { type: 'histogram', position: [0, 1, 1, 1], title: 'Key Metric' },
          { type: 'angle', position: [0, 2, 1, 1], title: 'Angle Distribution' },
          { type: 'histogram', position: [1, 0, 1, 1], title: 'Width Distribution' },
          { type: 'histogram', position: [1, 1, 1, 1], title: 'Height Distribution' },
          { type: 'category', position: [1, 2, 1, 1], title: 'Category Distribution' }
        ]
      },
      
      [LAYOUT_PRESETS.ANALYST]: {
        name: 'Analyst View',
        rows: 3,
        cols: 4,
        gap: 6,
        padding: 6,
        charts: [
          { type: 'time', position: [0, 0, 1, 2], title: 'Time Series' },
          { type: 'histogram', position: [0, 2, 1, 2], title: 'Distribution' },
          { type: 'angle', position: [1, 0, 1, 2], title: 'Angle Analysis' },
          { type: 'category', position: [1, 2, 1, 2], title: 'Categories' },
          { type: 'histogram', position: [2, 0, 1, 1], title: 'Width' },
          { type: 'histogram', position: [2, 1, 1, 1], title: 'Height' },
          { type: 'histogram', position: [2, 2, 1, 1], title: 'Strength' },
          { type: 'scatter', position: [2, 3, 1, 1], title: 'Correlation' }
        ]
      },
      
      [LAYOUT_PRESETS.RESEARCH]: {
        name: 'Research Mode',
        rows: 4,
        cols: 3,
        gap: 4,
        padding: 4,
        charts: [
          { type: 'time', position: [0, 0, 1, 3], title: 'Time Analysis' },
          { type: 'histogram', position: [1, 0, 1, 1], title: 'Width' },
          { type: 'histogram', position: [1, 1, 1, 1], title: 'Height' },
          { type: 'histogram', position: [1, 2, 1, 1], title: 'Strength' },
          { type: 'angle', position: [2, 0, 1, 2], title: 'Angle Distribution' },
          { type: 'category', position: [2, 2, 1, 1], title: 'Categories' },
          { type: 'scatter', position: [3, 0, 1, 1], title: 'Width vs Height' },
          { type: 'scatter', position: [3, 1, 1, 1], title: 'Strength vs Angle' },
          { type: 'line', position: [3, 2, 1, 1], title: 'Trends' }
        ]
      },
      
      [LAYOUT_PRESETS.MINI]: {
        name: 'Mini Mode',
        rows: 2,
        cols: 6,
        gap: 8,
        padding: 12,
        charts: [
          { type: 'metric', position: [0, 0, 1, 1], title: 'Filtered Rows' },
          { type: 'metric', position: [0, 1, 1, 1], title: 'Percentage' },
          { type: 'metric', position: [0, 2, 1, 1], title: 'Avg Width' },
          { type: 'metric', position: [0, 3, 1, 1], title: 'Avg Height' },
          { type: 'metric', position: [0, 4, 1, 1], title: 'Cat2 True %' },
          { type: 'metric', position: [0, 5, 1, 1], title: 'Avg Strength' },
          { type: 'mini-chart', position: [1, 0, 1, 2], title: 'Distribution' },
          { type: 'mini-chart', position: [1, 2, 1, 2], title: 'Categories' },
          { type: 'mini-chart', position: [1, 4, 1, 2], title: 'Trends' }
        ]
      }
    };
  }

  /**
   * Set layout configuration
   * @param {string|Object} layout - Layout preset name or custom layout config
   */
  setLayout(layout) {
    if (typeof layout === 'string') {
      if (!this.layouts[layout]) {
        throw new Error(`Unknown layout preset: ${layout}`);
      }
      this.currentLayout = { ...this.layouts[layout] };
    } else {
      this.currentLayout = this.validateLayoutConfig(layout);
    }

    // Update internal config
    Object.assign(this.config, {
      rows: this.currentLayout.rows,
      cols: this.currentLayout.cols,
      gap: this.currentLayout.gap,
      padding: this.currentLayout.padding
    });

    return this;
  }

  /**
   * Validate layout configuration
   */
  validateLayoutConfig(config) {
    const required = ['rows', 'cols', 'charts'];
    required.forEach(field => {
      if (!(field in config)) {
        throw new Error(`Layout config missing required field: ${field}`);
      }
    });

    // Validate chart positions
    config.charts.forEach((chart, index) => {
      if (!chart.position || !Array.isArray(chart.position) || chart.position.length !== 4) {
        throw new Error(`Chart ${index} has invalid position: ${chart.position}`);
      }
      
      const [row, col, rowSpan, colSpan] = chart.position;
      if (row < 0 || col < 0 || rowSpan < 1 || colSpan < 1) {
        throw new Error(`Chart ${index} has invalid position values: [${row}, ${col}, ${rowSpan}, ${colSpan}]`);
      }
      
      if (row + rowSpan > config.rows || col + colSpan > config.cols) {
        throw new Error(`Chart ${index} extends beyond grid bounds: [${row}, ${col}, ${rowSpan}, ${colSpan}]`);
      }
    });

    return config;
  }

  /**
   * Get current layout
   */
  getCurrentLayout() {
    return this.currentLayout ? { ...this.currentLayout } : null;
  }

  /**
   * Get available layout presets
   */
  getAvailableLayouts() {
    return Object.keys(this.layouts).map(key => ({
      key,
      name: this.layouts[key].name,
      rows: this.layouts[key].rows,
      cols: this.layouts[key].cols
    }));
  }

  /**
   * Calculate chart dimensions and position
   * @param {Array} position - Chart position [row, col, rowSpan, colSpan]
   * @param {Object} containerSize - Container dimensions
   */
  calculateChartDimensions(position, containerSize) {
    const [row, col, rowSpan, colSpan] = position;
    const { width, height } = containerSize;
    
    // Calculate available grid area
    const gridWidth = width - (this.config.padding * 2);
    const gridHeight = height - (this.config.padding * 2);
    
    // Calculate cell dimensions
    const cellWidth = (gridWidth - (this.config.cols - 1) * this.config.gap) / this.config.cols;
    const cellHeight = (gridHeight - (this.config.rows - 1) * this.config.gap) / this.config.rows;
    
    // Calculate chart position and size
    const x = this.config.padding + col * (cellWidth + this.config.gap);
    const y = this.config.padding + row * (cellHeight + this.config.gap);
    const chartWidth = colSpan * cellWidth + (colSpan - 1) * this.config.gap;
    const chartHeight = rowSpan * cellHeight + (rowSpan - 1) * this.config.gap;
    
    return {
      x,
      y,
      width: chartWidth,
      height: chartHeight,
      cellWidth,
      cellHeight
    };
  }

  /**
   * Get responsive layout adjustments
   * @param {number} screenWidth - Current screen width
   */
  getResponsiveAdjustments(screenWidth) {
    if (!this.config.responsive) return {};
    
    let adjustments = {};
    
    if (screenWidth < this.breakpoints.mobile) {
      adjustments = {
        gap: Math.max(4, this.config.gap * 0.5),
        padding: Math.max(4, this.config.padding * 0.5),
        fontSize: 0.8
      };
    } else if (screenWidth < this.breakpoints.tablet) {
      adjustments = {
        gap: Math.max(6, this.config.gap * 0.75),
        padding: Math.max(6, this.config.padding * 0.75),
        fontSize: 0.9
      };
    } else if (screenWidth < this.breakpoints.desktop) {
      adjustments = {
        gap: this.config.gap,
        padding: this.config.padding,
        fontSize: 1.0
      };
    } else {
      adjustments = {
        gap: this.config.gap * 1.2,
        padding: this.config.padding * 1.2,
        fontSize: 1.1
      };
    }
    
    return adjustments;
  }

  /**
   * Create custom layout
   * @param {Object} config - Custom layout configuration
   */
  createCustomLayout(config) {
    const customLayout = this.validateLayoutConfig(config);
    
    // Add to available layouts
    const key = `custom-${Date.now()}`;
    this.layouts[key] = customLayout;
    
    return key;
  }

  /**
   * Modify existing layout
   * @param {string} layoutKey - Layout to modify
   * @param {Object} modifications - Modifications to apply
   */
  modifyLayout(layoutKey, modifications) {
    if (!this.layouts[layoutKey]) {
      throw new Error(`Layout not found: ${layoutKey}`);
    }
    
    const modifiedLayout = { ...this.layouts[layoutKey] };
    Object.assign(modifiedLayout, modifications);
    
    // Re-validate
    this.layouts[layoutKey] = this.validateLayoutConfig(modifiedLayout);
    
    return this;
  }

  /**
   * Get chart grid information
   * @param {string} chartId - Chart identifier
   */
  getChartGridInfo(chartId) {
    if (!this.currentLayout) return null;
    
    const chart = this.currentLayout.charts.find(c => c.id === chartId);
    if (!chart) return null;
    
    return {
      position: chart.position,
      title: chart.title,
      type: chart.type,
      options: chart.options || {}
    };
  }

  /**
   * Check if layout is valid
   */
  isLayoutValid() {
    if (!this.currentLayout) return false;
    
    try {
      this.validateLayoutConfig(this.currentLayout);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export layout configuration
   */
  exportLayout() {
    if (!this.currentLayout) return null;
    
    return {
      layout: { ...this.currentLayout },
      config: { ...this.config },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import layout configuration
   * @param {Object} layoutData - Layout data to import
   */
  importLayout(layoutData) {
    try {
      if (layoutData.layout) {
        this.setLayout(layoutData.layout);
      }
      
      if (layoutData.config) {
        Object.assign(this.config, layoutData.config);
      }
      
      return this;
    } catch (error) {
      console.error('Error importing layout:', error);
      throw error;
    }
  }

  /**
   * Get layout statistics
   */
  getLayoutStats() {
    if (!this.currentLayout) return null;
    
    const stats = {
      name: this.currentLayout.name,
      rows: this.currentLayout.rows,
      cols: this.currentLayout.cols,
      totalCharts: this.currentLayout.charts.length,
      gridSize: this.currentLayout.rows * this.currentLayout.cols,
      utilization: 0,
      chartTypes: {}
    };
    
    // Calculate grid utilization
    let usedCells = 0;
    this.currentLayout.charts.forEach(chart => {
      const [row, col, rowSpan, colSpan] = chart.position;
      usedCells += rowSpan * colSpan;
      
      // Count chart types
      const type = chart.type;
      stats.chartTypes[type] = (stats.chartTypes[type] || 0) + 1;
    });
    
    stats.utilization = (usedCells / stats.gridSize * 100).toFixed(1);
    
    return stats;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.layouts = {};
    this.currentLayout = null;
    this.chartPositions.clear();
  }
}
