import { FILTER_TYPES } from '../constants/index.js';

/**
 * Manages data filtering operations and filter state
 * Provides a clean API for applying, managing, and combining filters
 */
export default class FilterManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.filters = {};
    this.filterState = {
      filteredIndices: null,
      filteredCount: 0,
      totalCount: 0
    };
    
    // Event callbacks
    this.onFilterChange = null;
    this.onFilterComplete = null;
    
    // Initialize with data manager's filtered indices
    if (dataManager.filteredIndices) {
      this.filterState.filteredIndices = dataManager.filteredIndices;
      this.filterState.totalCount = dataManager.totalRows;
      this.filterState.filteredCount = dataManager.totalRows;
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks = {}) {
    if (callbacks.onFilterChange) {
      this.onFilterChange = callbacks.onFilterChange;
    }
    if (callbacks.onFilterComplete) {
      this.onFilterComplete = callbacks.onFilterComplete;
    }
  }

  /**
   * Add or update a filter
   * @param {string} field - Data field to filter
   * @param {Object} filterConfig - Filter configuration
   */
  setFilter(field, filterConfig) {
    const { type, value, enabled = true } = filterConfig;
    
    if (!Object.values(FILTER_TYPES).includes(type)) {
      throw new Error(`Invalid filter type: ${type}`);
    }

    this.filters[field] = {
      type,
      value,
      enabled,
      field
    };

    // Trigger filter change event
    if (this.onFilterChange) {
      this.onFilterChange(field, this.filters[field]);
    }

    return this;
  }

  /**
   * Remove a filter
   * @param {string} field - Field to remove filter from
   */
  removeFilter(field) {
    if (this.filters[field]) {
      delete this.filters[field];
      
      // Trigger filter change event
      if (this.onFilterChange) {
        this.onFilterChange(field, null);
      }
    }

    return this;
  }

  /**
   * Enable/disable a filter
   * @param {string} field - Field to toggle
   * @param {boolean} enabled - Whether to enable the filter
   */
  setFilterEnabled(field, enabled) {
    if (this.filters[field]) {
      this.filters[field].enabled = enabled;
      
      // Trigger filter change event
      if (this.onFilterChange) {
        this.onFilterChange(field, this.filters[field]);
      }
    }

    return this;
  }

  /**
   * Get all active filters
   */
  getActiveFilters() {
    return Object.entries(this.filters)
      .filter(([_, filter]) => filter.enabled)
      .reduce((acc, [field, filter]) => {
        acc[field] = filter;
        return acc;
      }, {});
  }

  /**
   * Get all filters (including disabled ones)
   */
  getAllFilters() {
    return { ...this.filters };
  }

  /**
   * Get filter for specific field
   */
  getFilter(field) {
    return this.filters[field] || null;
  }

  /**
   * Apply all active filters to the data
   */
  async applyFilters() {
    const activeFilters = this.getActiveFilters();
    
    if (Object.keys(activeFilters).length === 0) {
      // No filters, show all data
      this.resetFilters();
      return;
    }

    // Use data manager to apply filters
    const result = await this.dataManager.getFilteredData(activeFilters);
    
    // Update filter state
    this.filterState.filteredIndices = this.dataManager.filteredIndices;
    this.filterState.filteredCount = this.dataManager.currentRows;
    this.filterState.totalCount = this.dataManager.totalRows;

    // Trigger filter complete event
    if (this.onFilterComplete) {
      this.onFilterComplete({
        filters: activeFilters,
        filteredCount: this.filterState.filteredCount,
        totalCount: this.filterState.totalCount,
        percentage: (this.filterState.filteredCount / this.filterState.totalCount * 100).toFixed(1)
      });
    }

    return result;
  }

  /**
   * Reset all filters
   */
  resetFilters() {
    this.filters = {};
    
    // Reset filtered indices to show all data
    if (this.dataManager.filteredIndices) {
      this.dataManager.filteredIndices.fill(1);
      this.dataManager.currentRows = this.dataManager.totalRows;
    }

    // Update filter state
    this.filterState.filteredIndices = this.dataManager.filteredIndices;
    this.filterState.filteredCount = this.dataManager.totalRows;
    this.filterState.totalCount = this.dataManager.totalRows;

    // Trigger filter change event
    if (this.onFilterChange) {
      this.onFilterChange('all', null);
    }

    return this;
  }

  /**
   * Clear specific filter
   */
  clearFilter(field) {
    this.removeFilter(field);
    return this.applyFilters();
  }

  /**
   * Get current filter state
   */
  getFilterState() {
    return { ...this.filterState };
  }

  /**
   * Get filter statistics
   */
  getFilterStats() {
    const activeFilters = this.getActiveFilters();
    const stats = {
      totalFilters: Object.keys(this.filters).length,
      activeFilters: Object.keys(activeFilters).length,
      filteredCount: this.filterState.filteredCount,
      totalCount: this.filterState.totalCount,
      percentage: this.filterState.totalCount > 0 ? 
        (this.filterState.filteredCount / this.filterState.totalCount * 100).toFixed(1) : 0
    };

    // Add per-filter statistics
    stats.filters = {};
    Object.entries(activeFilters).forEach(([field, filter]) => {
      stats.filters[field] = {
        type: filter.type,
        value: filter.value,
        enabled: filter.enabled
      };
    });

    return stats;
  }

  /**
   * Create a range filter
   * @param {string} field - Data field
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {boolean} enabled - Whether filter is enabled
   */
  createRangeFilter(field, min, max, enabled = true) {
    return this.setFilter(field, {
      type: FILTER_TYPES.RANGE,
      value: [min, max],
      enabled
    });
  }

  /**
   * Create a category filter
   * @param {string} field - Data field
   * @param {Array|Set} categories - Categories to include
   * @param {boolean} enabled - Whether filter is enabled
   */
  createCategoryFilter(field, categories, enabled = true) {
    const value = categories instanceof Set ? categories : new Set(categories);
    return this.setFilter(field, {
      type: FILTER_TYPES.CATEGORY,
      value,
      enabled
    });
  }

  /**
   * Create an angle filter (handles circular data)
   * @param {string} field - Data field
   * @param {number} startAngle - Start angle in degrees
   * @param {number} endAngle - End angle in degrees
   * @param {boolean} enabled - Whether filter is enabled
   */
  createAngleFilter(field, startAngle, endAngle, enabled = true) {
    return this.setFilter(field, {
      type: FILTER_TYPES.ANGLE,
      value: [startAngle, endAngle],
      enabled
    });
  }

  /**
   * Create a time filter
   * @param {string} field - Data field
   * @param {number} startTime - Start time (seconds)
   * @param {number} endTime - End time (seconds)
   * @param {boolean} enabled - Whether filter is enabled
   */
  createTimeFilter(field, startTime, endTime, enabled = true) {
    return this.setFilter(field, {
      type: FILTER_TYPES.TIME,
      value: [startTime, endTime],
      enabled
    });
  }

  /**
   * Combine multiple filters with AND logic
   * @param {Array} filterConfigs - Array of filter configurations
   */
  combineFilters(filterConfigs) {
    filterConfigs.forEach(({ field, ...config }) => {
      this.setFilter(field, config);
    });
    
    return this;
  }

  /**
   * Export filter configuration
   */
  exportFilters() {
    return JSON.stringify(this.filters, null, 2);
  }

  /**
   * Import filter configuration
   * @param {string|Object} filterConfig - Filter configuration to import
   */
  importFilters(filterConfig) {
    try {
      const filters = typeof filterConfig === 'string' ? 
        JSON.parse(filterConfig) : filterConfig;
      
      this.filters = { ...filters };
      
      // Trigger filter change event
      if (this.onFilterChange) {
        this.onFilterChange('import', this.filters);
      }
      
      return this;
    } catch (error) {
      console.error('Error importing filters:', error);
      throw error;
    }
  }

  /**
   * Check if data passes all active filters
   * @param {number} rowIndex - Row index to check
   */
  checkRow(rowIndex) {
    const activeFilters = this.getActiveFilters();
    
    for (const [field, filter] of Object.entries(activeFilters)) {
      if (!filter.enabled) continue;
      
      const value = this.dataManager.data[field][rowIndex];
      let pass = true;
      
      switch (filter.type) {
        case FILTER_TYPES.RANGE:
          const [min, max] = filter.value;
          if (value < min || value >= max) pass = false;
          break;
          
        case FILTER_TYPES.CATEGORY:
          if (!filter.value.has(value)) pass = false;
          break;
          
        case FILTER_TYPES.ANGLE:
          const [start, end] = filter.value;
          if (start <= end) {
            if (value < start || value >= end) pass = false;
          } else {
            if (value >= end && value < start) pass = false;
          }
          break;
          
        case FILTER_TYPES.TIME:
          const [startTime, endTime] = filter.value;
          if (value < startTime || value >= endTime) pass = false;
          break;
      }
      
      if (!pass) return false;
    }
    
    return true;
  }

  /**
   * Get sample of filtered data for preview
   * @param {number} sampleSize - Number of samples to return
   */
  getFilteredSample(sampleSize = 100) {
    if (!this.filterState.filteredIndices) return [];
    
    const sample = [];
    let count = 0;
    
    for (let i = 0; i < this.filterState.totalCount && count < sampleSize; i++) {
      if (this.filterState.filteredIndices[i]) {
        const row = {};
        Object.keys(this.dataManager.data).forEach(field => {
          row[field] = this.dataManager.data[field][i];
        });
        sample.push(row);
        count++;
      }
    }
    
    return sample;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.filters = {};
    this.filterState = {
      filteredIndices: null,
      filteredCount: 0,
      totalCount: 0
    };
    this.onFilterChange = null;
    this.onFilterComplete = null;
  }
}
