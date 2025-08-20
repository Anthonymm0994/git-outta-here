// Chart types
export const CHART_TYPES = {
  HISTOGRAM: 'histogram',
  ANGLE: 'angle',
  CATEGORY: 'category',
  TIME: 'time',
  SCATTER: 'scatter',
  LINE: 'line',
  BAR: 'bar'
};

// Layout presets
export const LAYOUT_PRESETS = {
  EXECUTIVE: 'executive-dashboard',
  ANALYST: 'analyst-view',
  RESEARCH: 'research-mode',
  MINI: 'mini-mode',
  CUSTOM: 'custom'
};

// Default chart configurations
export const DEFAULT_CHART_CONFIG = {
  margin: { top: 10, right: 10, bottom: 40, left: 50 },
  colors: ['#4a9eff', '#feca57', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
  backgroundColor: '#1a1a1a',
  gridColor: '#2a2a2a',
  axisColor: '#444',
  textColor: '#888',
  selectionColor: 'rgba(255,255,255,0.1)',
  selectionBorderColor: '#feca57'
};

// Performance settings
export const PERFORMANCE_CONFIG = {
  BATCH_SIZE: 100000,
  SAMPLE_THRESHOLD: 1000,
  SAMPLE_SIZE: 1000,
  RESIZE_DEBOUNCE: 250,
  REQUEST_IDLE_TIMEOUT: 16
};

// Data types
export const DATA_TYPES = {
  FLOAT32: 'float32',
  UINT8: 'uint8',
  UINT16: 'uint16',
  UINT32: 'uint32',
  STRING: 'string',
  BOOLEAN: 'boolean'
};

// Filter types
export const FILTER_TYPES = {
  RANGE: 'range',
  CATEGORY: 'category',
  TIME: 'time',
  ANGLE: 'angle'
};
