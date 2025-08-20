import { PERFORMANCE_CONFIG, DATA_TYPES } from '../constants/index.js';
import { DataUtils } from '../utils/DataUtils.js';

/**
 * Manages data operations including loading, filtering, and pre-binning
 * Optimized for handling large datasets (10M+ rows) with TypedArrays
 */
export default class DataManager {
  constructor(config = {}) {
    this.config = {
      batchSize: PERFORMANCE_CONFIG.BATCH_SIZE,
      sampleThreshold: PERFORMANCE_CONFIG.SAMPLE_THRESHOLD,
      sampleSize: PERFORMANCE_CONFIG.SAMPLE_SIZE,
      enablePrebinning: true,
      ...config
    };
    
    this.data = {};
    this.originalData = null;
    this.schema = {};
    this.binCache = {};
    this.filteredIndices = null;
    this.currentRows = 0;
    this.totalRows = 0;
    
    // Performance tracking
    this.performanceMetrics = {
      loadTime: 0,
      filterTime: 0,
      binTime: 0
    };
  }

  /**
   * Load data from various sources
   * @param {*} dataSource - Raw data, CSV string, or data source config
   * @param {Object} options - Loading options
   */
  async loadData(dataSource, options = {}) {
    const startTime = performance.now();
    
    try {
      if (typeof dataSource === 'string') {
        // CSV data
        this.data = await this.parseCSV(dataSource, options);
      } else if (Array.isArray(dataSource)) {
        // Array of objects
        this.data = this.convertArrayToTypedArrays(dataSource, options);
      } else if (dataSource && typeof dataSource === 'object') {
        // Already in TypedArray format
        this.data = dataSource;
      } else {
        throw new Error('Unsupported data source format');
      }

      this.totalRows = this.getRowCount();
      this.currentRows = this.totalRows;
      this.filteredIndices = new Uint8Array(this.totalRows);
      this.filteredIndices.fill(1);

      // Infer schema if not provided
      if (!options.schema) {
        this.schema = this.inferSchema();
      } else {
        this.schema = options.schema;
      }

      // Pre-bin data for performance
      if (this.config.enablePrebinning) {
        this.prebinData();
      }

      this.performanceMetrics.loadTime = performance.now() - startTime;
      
      return {
        success: true,
        rowCount: this.totalRows,
        schema: this.schema,
        loadTime: this.performanceMetrics.loadTime
      };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  /**
   * Parse CSV data and convert to TypedArrays
   */
  async parseCSV(csvString, options = {}) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = {};
    
    // Initialize TypedArrays
    headers.forEach(header => {
      data[header] = [];
    });

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      headers.forEach((header, j) => {
        if (data[header]) {
          data[header].push(values[j] ? values[j].trim() : '');
        }
      });
    }

    // Convert to TypedArrays
    return this.convertArrayToTypedArrays(data, options);
  }

  /**
   * Convert array of objects to TypedArrays for performance
   */
  convertArrayToTypedArrays(arrayData, options = {}) {
    const typedData = {};
    const firstRow = arrayData[0] || {};
    
    // Determine data types and create TypedArrays
    Object.keys(firstRow).forEach(key => {
      const values = arrayData.map(row => row[key]);
      const type = this.inferDataType(values);
      
      switch (type) {
        case DATA_TYPES.FLOAT32:
          typedData[key] = new Float32Array(values);
          break;
        case DATA_TYPES.UINT8:
          typedData[key] = new Uint8Array(values);
          break;
        case DATA_TYPES.UINT16:
          typedData[key] = new Uint16Array(values);
          break;
        case DATA_TYPES.UINT32:
          typedData[key] = new Uint32Array(values);
          break;
        case DATA_TYPES.BOOLEAN:
          typedData[key] = new Uint8Array(values.map(v => v ? 1 : 0));
          break;
        default:
          typedData[key] = values; // Keep as regular array for strings
      }
    });

    return typedData;
  }

  /**
   * Infer data type from values
   */
  inferDataType(values) {
    if (values.length === 0) return DATA_TYPES.STRING;
    
    const sample = values.slice(0, Math.min(100, values.length));
    let hasFloat = false;
    let hasInt = false;
    let hasBoolean = false;
    
    for (const value of sample) {
      if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        hasBoolean = true;
      } else if (typeof value === 'number' || !isNaN(Number(value))) {
        const num = Number(value);
        if (Number.isInteger(num)) {
          hasInt = true;
        } else {
          hasFloat = true;
        }
      }
    }

    if (hasBoolean && !hasFloat && !hasInt) return DATA_TYPES.BOOLEAN;
    if (hasFloat) return DATA_TYPES.FLOAT32;
    if (hasInt) return DATA_TYPES.UINT32;
    return DATA_TYPES.STRING;
  }

  /**
   * Infer schema from loaded data
   */
  inferSchema() {
    const schema = {};
    
    Object.keys(this.data).forEach(field => {
      const values = this.data[field];
      schema[field] = {
        type: this.inferDataType(Array.isArray(values) ? values : Array.from(values)),
        min: null,
        max: null,
        uniqueValues: null
      };

      // Calculate min/max for numeric fields
      if (schema[field].type === DATA_TYPES.FLOAT32 || 
          schema[field].type === DATA_TYPES.UINT32 ||
          schema[field].type === DATA_TYPES.UINT16 ||
          schema[field].type === DATA_TYPES.UINT8) {
        
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          if (val < min) min = val;
          if (val > max) max = val;
        }
        schema[field].min = min;
        schema[field].max = max;
      }

      // Calculate unique values for categorical fields
      if (schema[field].type === DATA_TYPES.UINT8 || 
          schema[field].type === DATA_TYPES.UINT16 ||
          schema[field].type === DATA_TYPES.UINT32) {
        const unique = new Set();
        for (let i = 0; i < Math.min(1000, values.length); i++) {
          unique.add(values[i]);
        }
        schema[field].uniqueValues = Array.from(unique).sort((a, b) => a - b);
      }
    });

    return schema;
  }

  /**
   * Pre-bin data for performance optimization
   */
  prebinData() {
    const startTime = performance.now();
    
    Object.keys(this.data).forEach(field => {
      const values = this.data[field];
      const fieldSchema = this.schema[field];
      
      if (fieldSchema.type === DATA_TYPES.FLOAT32 || 
          fieldSchema.type === DATA_TYPES.UINT32 ||
          fieldSchema.type === DATA_TYPES.UINT16 ||
          fieldSchema.type === DATA_TYPES.UINT8) {
        
        if (fieldSchema.type === DATA_TYPES.UINT8 && fieldSchema.uniqueValues?.length <= 10) {
          // Categorical data - create category bins
          this.binCache[field] = this.binCategoricalData(values, fieldSchema);
        } else if (field === 'angle') {
          // Special handling for angle data
          this.binCache[field] = this.binAngleData(values);
        } else {
          // Continuous data - create histogram bins
          this.binCache[field] = this.binContinuousData(values, fieldSchema);
        }
      }
    });

    this.performanceMetrics.binTime = performance.now() - startTime;
  }

  /**
   * Bin continuous data into histogram bins
   */
  binContinuousData(values, schema, numBins = 50) {
    const bins = new Array(numBins).fill(null).map(() => []);
    const { min, max } = schema;
    const range = max - min;
    
    if (range <= 0) {
      // Degenerate range, place everything in the first bin
      for (let i = 0; i < values.length; i++) bins[0].push(i);
      return { bins, binSize: 1, min, max, maxCount: values.length };
    }

    const binSize = range / numBins;
    
    for (let i = 0; i < values.length; i++) {
      const value = Math.min(values[i], max - Number.EPSILON);
      const bin = Math.floor((value - min) / binSize);
      
      if (bin >= 0 && bin < numBins) {
        bins[bin].push(i);
      }
    }

    // Compute max count for y-scale stability
    let maxCount = 0;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i].length > maxCount) maxCount = bins[i].length;
    }

    return { bins, binSize, min, max, maxCount };
  }

  /**
   * Bin categorical data
   */
  binCategoricalData(values, schema) {
    const { uniqueValues } = schema;
    const bins = new Array(uniqueValues.length).fill(null).map(() => []);
    
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const binIndex = uniqueValues.indexOf(value);
      if (binIndex >= 0) {
        bins[binIndex].push(i);
      }
    }

    const maxCount = Math.max(...bins.map(bin => bin.length));
    return { 
      bins, 
      categories: uniqueValues, 
      maxCount,
      type: 'categorical'
    };
  }

  /**
   * Bin angle data with special handling for circular data
   */
  binAngleData(values, numBins = 120) {
    const bins = new Array(numBins).fill(null).map(() => []);
    const binSize = 360 / numBins;
    
    for (let i = 0; i < values.length; i++) {
      const bin = Math.floor(values[i] / binSize) % numBins;
      bins[bin].push(i);
    }
    
    let maxCount = 0;
    for (let i = 0; i < bins.length; i++) {
      maxCount = Math.max(maxCount, bins[i].length);
    }
    
    return { bins, binSize, numBins, maxCount, type: 'angle' };
  }

  /**
   * Get filtered data based on current filters
   */
  getFilteredData(filters = {}) {
    const startTime = performance.now();
    
    if (!this.filteredIndices) {
      return this.data;
    }

    // Apply filters with batching for performance
    let processed = 0;
    
    const processBatch = () => {
      const batchEnd = Math.min(processed + this.config.batchSize, this.totalRows);
      
      for (let i = processed; i < batchEnd; i++) {
        let pass = true;
        
        // Apply each filter
        Object.entries(filters).forEach(([field, filter]) => {
          if (!filter || !filter.enabled) return;
          
          const value = this.data[field][i];
          
          switch (filter.type) {
            case 'range':
              if (value < filter.value[0] || value >= filter.value[1]) {
                pass = false;
              }
              break;
            case 'category':
              if (!filter.value.has(value)) {
                pass = false;
              }
              break;
            case 'angle':
              const [start, end] = filter.value;
              if (start <= end) {
                if (value < start || value >= end) pass = false;
              } else {
                if (value >= end && value < start) pass = false;
              }
              break;
          }
        });
        
        this.filteredIndices[i] = pass ? 1 : 0;
      }
      
      processed = batchEnd;
      
      if (processed < this.totalRows) {
        // Use requestIdleCallback for performance
        if (window.requestIdleCallback) {
          requestIdleCallback(() => processBatch(), { timeout: 16 });
        } else {
          setTimeout(processBatch, 0);
        }
      } else {
        this.performanceMetrics.filterTime = performance.now() - startTime;
        this.updateFilteredCount();
      }
    };
    
    processBatch();
    
    return this.data;
  }

  /**
   * Update filtered count
   */
  updateFilteredCount() {
    if (!this.filteredIndices) return;
    
    let count = 0;
    for (let i = 0; i < this.filteredIndices.length; i++) {
      if (this.filteredIndices[i]) count++;
    }
    
    this.currentRows = count;
    return count;
  }

  /**
   * Get row count
   */
  getRowCount() {
    const firstField = Object.keys(this.data)[0];
    return firstField ? this.data[firstField].length : 0;
  }

  /**
   * Get field values with optional filtering
   */
  getFieldValues(field, filtered = true) {
    if (!this.data[field]) return [];
    
    if (filtered && this.filteredIndices) {
      const filteredValues = [];
      for (let i = 0; i < this.data[field].length; i++) {
        if (this.filteredIndices[i]) {
          filteredValues.push(this.data[field][i]);
        }
      }
      return filteredValues;
    }
    
    return Array.from(this.data[field]);
  }

  /**
   * Export filtered data to CSV
   */
  exportToCSV(fields = null) {
    if (!this.filteredIndices) return '';
    
    const exportFields = fields || Object.keys(this.data);
    const rows = [exportFields.join(',')];
    
    for (let i = 0; i < this.totalRows; i++) {
      if (this.filteredIndices[i]) {
        const row = exportFields.map(field => {
          const value = this.data[field][i];
          if (typeof value === 'number') {
            return value.toFixed(2);
          }
          return value;
        });
        rows.push(row.join(','));
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset to original data
   */
  reset() {
    if (this.originalData) {
      this.data = { ...this.originalData };
      this.currentRows = this.totalRows;
      this.filteredIndices.fill(1);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.data = {};
    this.binCache = {};
    this.filteredIndices = null;
    this.originalData = null;
  }
}
