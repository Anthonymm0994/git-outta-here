// Main entry point for data-explorer-lib
export { default as DataExplorer } from './core/DataExplorer.js';
export { default as DataManager } from './core/DataManager.js';
export { default as ChartManager } from './core/ChartManager.js';
export { default as FilterManager } from './core/FilterManager.js';
export { default as LayoutEngine } from './core/LayoutEngine.js';

// Chart classes
export { default as HistogramChart } from './charts/HistogramChart.js';
export { default as AngleChart } from './charts/AngleChart.js';
export { default as CategoryChart } from './charts/CategoryChart.js';
export { default as TimeChart } from './charts/TimeChart.js';

// Base classes
export { default as BaseChart } from './charts/BaseChart.js';

// Utilities
export { default as PerformanceUtils } from './utils/PerformanceUtils.js';
export { default as DataUtils } from './utils/DataUtils.js';

// Constants and types
export * from './constants/index.js';
export * from './types/index.js';
