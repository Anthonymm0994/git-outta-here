import { DEFAULT_CHART_CONFIG } from '../constants/index.js';

/**
 * Base class for all chart types
 * Provides common functionality for canvas management, event handling, and rendering
 */
export default class BaseChart {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CHART_CONFIG,
      ...config
    };
    
    this.id = config.id || `chart_${Date.now()}`;
    this.dataField = config.dataField;
    this.position = config.position || [0, 0, 1, 1];
    this.dataManager = config.dataManager;
    this.filterManager = config.filterManager;
    
    // Canvas and rendering
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    
    // Interaction state
    this.isDragging = false;
    this.isHovering = false;
    this.selection = null;
    this.hoveredElement = null;
    
    // Event listeners
    this.eventListeners = new Map();
    this.mousePosition = { x: 0, y: 0 };
    
    // Performance
    this.lastDrawTime = 0;
    this.drawThrottle = 16; // ~60fps
    this.updateScheduled = false;
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize the chart
   */
  initialize() {
    this.createCanvas();
    this.setupEventListeners();
    this.resize();
    this.draw();
  }

  /**
   * Create canvas element
   */
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = `chart_${this.id}`;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    
    // Set up context
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false; // For crisp pixel-perfect rendering
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    // Wheel events for zooming
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
  }

  /**
   * Get mouse position relative to canvas
   */
  getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  /**
   * Get touch position relative to canvas
   */
  getTouchPos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const touch = event.touches[0];
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  }

  /**
   * Handle mouse down events
   */
  handleMouseDown(event) {
    event.preventDefault();
    this.isDragging = true;
    this.mousePosition = this.getMousePos(event);
    this.onMouseDown(this.mousePosition, event);
  }

  /**
   * Handle mouse move events
   */
  handleMouseMove(event) {
    event.preventDefault();
    this.mousePosition = this.getMousePos(event);
    
    if (this.isDragging) {
      this.onMouseDrag(this.mousePosition, event);
    } else {
      this.onMouseMove(this.mousePosition, event);
    }
  }

  /**
   * Handle mouse up events
   */
  handleMouseUp(event) {
    event.preventDefault();
    this.isDragging = false;
    this.onMouseUp(this.mousePosition, event);
  }

  /**
   * Handle mouse leave events
   */
  handleMouseLeave(event) {
    event.preventDefault();
    this.isDragging = false;
    this.isHovering = false;
    this.onMouseLeave(event);
  }

  /**
   * Handle click events
   */
  handleClick(event) {
    event.preventDefault();
    if (!this.isDragging) {
      this.onClick(this.mousePosition, event);
    }
  }

  /**
   * Handle touch start events
   */
  handleTouchStart(event) {
    event.preventDefault();
    this.isDragging = true;
    this.mousePosition = this.getTouchPos(event);
    this.onTouchStart(this.mousePosition, event);
  }

  /**
   * Handle touch move events
   */
  handleTouchMove(event) {
    event.preventDefault();
    this.mousePosition = this.getTouchPos(event);
    this.onTouchMove(this.mousePosition, event);
  }

  /**
   * Handle touch end events
   */
  handleTouchEnd(event) {
    event.preventDefault();
    this.isDragging = false;
    this.onTouchEnd(this.mousePosition, event);
  }

  /**
   * Handle wheel events
   */
  handleWheel(event) {
    event.preventDefault();
    this.onWheel(event);
  }

  /**
   * Event handler stubs - to be overridden by subclasses
   */
  onMouseDown(pos, event) {}
  onMouseMove(pos, event) {}
  onMouseDrag(pos, event) {}
  onMouseUp(pos, event) {}
  onMouseLeave(event) {}
  onClick(pos, event) {}
  onTouchStart(pos, event) {}
  onTouchMove(pos, event) {}
  onTouchEnd(pos, event) {}
  onWheel(event) {}

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit custom events
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in chart event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Resize the chart
   */
  resize() {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    this.width = rect.width;
    this.height = rect.height;
    
    // Set canvas size accounting for device pixel ratio
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    
    // Scale context to account for device pixel ratio
    this.ctx.scale(this.dpr, this.dpr);
    
    // Call subclass resize method
    this.onResize();
    
    // Schedule redraw
    this.scheduleUpdate();
  }

  /**
   * Resize handler - to be overridden by subclasses
   */
  onResize() {}

  /**
   * Clear the canvas
   */
  clear() {
    if (!this.ctx) return;
    
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw the chart
   */
  draw() {
    if (!this.ctx || !this.canvas) return;
    
    const now = performance.now();
    if (now - this.lastDrawTime < this.drawThrottle) {
      this.scheduleUpdate();
      return;
    }
    
    this.lastDrawTime = now;
    
    // Clear canvas
    this.clear();
    
    // Call subclass draw method
    this.onDraw();
    
    // Draw selection overlay if exists
    if (this.selection) {
      this.drawSelection();
    }
    
    // Draw hover overlay if exists
    if (this.hoveredElement) {
      this.drawHover();
    }
  }

  /**
   * Draw method - to be overridden by subclasses
   */
  onDraw() {
    throw new Error('onDraw method must be implemented by subclass');
  }

  /**
   * Draw selection overlay
   */
  drawSelection() {
    if (!this.selection) return;
    
    this.ctx.fillStyle = this.config.selectionColor;
    this.ctx.strokeStyle = this.config.selectionBorderColor;
    this.ctx.lineWidth = 2;
    
    // Subclasses should override this to draw appropriate selection
    this.drawSelectionOverlay();
  }

  /**
   * Draw selection overlay - to be overridden by subclasses
   */
  drawSelectionOverlay() {}

  /**
   * Draw hover overlay
   */
  drawHover() {
    if (!this.hoveredElement) return;
    
    this.ctx.strokeStyle = this.config.selectionBorderColor;
    this.ctx.lineWidth = 1;
    
    // Subclasses should override this to draw appropriate hover
    this.drawHoverOverlay();
  }

  /**
   * Draw hover overlay - to be overridden by subclasses
   */
  drawHoverOverlay() {}

  /**
   * Schedule chart update
   */
  scheduleUpdate() {
    if (this.updateScheduled) return;
    
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateScheduled = false;
      this.draw();
    });
  }

  /**
   * Update the chart (triggers redraw)
   */
  update() {
    this.scheduleUpdate();
  }

  /**
   * Set selection
   */
  setSelection(selection) {
    this.selection = selection;
    this.emit('selection', { selection, data: this.getSelectionData() });
    this.scheduleUpdate();
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selection = null;
    this.emit('selection', { selection: null });
    this.scheduleUpdate();
  }

  /**
   * Get selection data - to be overridden by subclasses
   */
  getSelectionData() {
    return null;
  }

  /**
   * Handle external selection from other charts
   */
  handleExternalSelection(selection) {
    // Subclasses can override this to respond to external selections
    this.scheduleUpdate();
  }

  /**
   * Get chart data
   */
  getData() {
    if (!this.dataManager || !this.dataField) return [];
    return this.dataManager.getFieldValues(this.dataField, true);
  }

  /**
   * Get chart metadata
   */
  getMetadata() {
    return {
      id: this.id,
      type: this.constructor.name,
      dataField: this.dataField,
      position: this.position,
      dimensions: { width: this.width, height: this.height }
    };
  }

  /**
   * Export chart configuration
   */
  exportConfig() {
    return {
      id: this.id,
      type: this.constructor.name,
      dataField: this.dataField,
      position: this.position,
      config: this.config
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    
    this.ctx = null;
    this.eventListeners.clear();
    this.selection = null;
    this.hoveredElement = null;
  }
}
