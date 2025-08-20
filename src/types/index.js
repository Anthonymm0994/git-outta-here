/**
 * @typedef {Object} ChartConfig
 * @property {string} type - Chart type (histogram, angle, category, time, etc.)
 * @property {string} data - Data field to visualize
 * @property {Array<number>} position - Grid position [row, col, rowSpan, colSpan]
 * @property {Object} options - Chart-specific options
 * @property {string} [title] - Chart title
 * @property {Object} [style] - Custom styling options
 */

/**
 * @typedef {Object} LayoutConfig
 * @property {string} preset - Layout preset name
 * @property {number} rows - Number of grid rows
 * @property {number} cols - Number of grid columns
 * @property {Array<ChartConfig>} charts - Chart configurations
 * @property {Object} [grid] - Grid-specific options
 */

/**
 * @typedef {Object} DataConfig
 * @property {Array|Object} data - Raw data or data source configuration
 * @property {string} [format] - Data format (csv, json, api)
 * @property {Object} [schema] - Data schema definition
 * @property {Object} [filters] - Initial filter configuration
 */

/**
 * @typedef {Object} FilterConfig
 * @property {string} field - Data field to filter
 * @property {string} type - Filter type (range, category, time, angle)
 * @property {*} value - Filter value or range
 * @property {boolean} [enabled] - Whether filter is active
 */

/**
 * @typedef {Object} ChartOptions
 * @property {Object} [margin] - Chart margins
 * @property {Array<string>} [colors] - Color palette
 * @property {Object} [axes] - Axis configuration
 * @property {Object} [tooltip] - Tooltip configuration
 * @property {Object} [interaction] - Interaction options
 */

/**
 * @typedef {Object} PerformanceOptions
 * @property {number} [batchSize] - Processing batch size
 * @property {number} [sampleThreshold] - Threshold for sampling
 * @property {number} [sampleSize] - Sample size for large datasets
 * @property {boolean} [enablePrebinning] - Enable data pre-binning
 */

/**
 * @typedef {Object} DataExplorerConfig
 * @property {DataConfig} data - Data configuration
 * @property {LayoutConfig} layout - Layout configuration
 * @property {Array<ChartConfig>} charts - Chart configurations
 * @property {PerformanceOptions} [performance] - Performance options
 * @property {Object} [theme] - Theme configuration
 * @property {Object} [callbacks] - Event callbacks
 */

/**
 * @typedef {Object} BinData
 * @property {Array<Array<number>>} bins - Array of bin indices
 * @property {number} binSize - Size of each bin
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} maxCount - Maximum count in any bin
 */

/**
 * @typedef {Object} FilterState
 * @property {Object} filters - Active filters
 * @property {Uint8Array} filteredIndices - Filtered data indices
 * @property {number} filteredCount - Count of filtered rows
 * @property {number} totalCount - Total data rows
 */

/**
 * @typedef {Object} ChartEvent
 * @property {string} type - Event type
 * @property {*} data - Event data
 * @property {Object} chart - Chart instance
 * @property {Object} [selection] - Selection data
 */
