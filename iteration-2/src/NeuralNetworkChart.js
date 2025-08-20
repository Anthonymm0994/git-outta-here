/**
 * Neural Network Data Visualization
 * Shows data flowing through a neural network with animated connections
 * Displays activation patterns, weights, and data propagation
 */
export default class NeuralNetworkChart {
  constructor(config = {}) {
    this.config = {
      width: 1000,
      height: 600,
      backgroundColor: '#001122',
      nodeColor: '#4a9eff',
      connectionColor: '#ff6b6b',
      activationColor: '#feca57',
      textColor: '#ffffff',
      gridColor: '#333366',
      showConnections: true,
      showActivations: true,
      showWeights: true,
      showLabels: true,
      showGrid: false,
      animationSpeed: 0.03,
      nodeRadius: 15,
      connectionWidth: 2,
      autoAnimate: true,
      layers: [4, 6, 6, 3], // Default architecture
      ...config
    };

    this.canvas = null;
    this.ctx = null;
    this.data = [];
    this.network = null;
    this.time = 0;
    this.isAnimating = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.selectedNode = null;
    this.dataFlow = [];

    this.initialize();
  }

  initialize() {
    this.createCanvas();
    this.setupEventListeners();
    this.generateNetwork();
    this.generateDataFlow();
    if (this.config.autoAnimate) {
      this.startAnimation();
    }
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;
    this.canvas.style.display = 'block';
    this.canvas.style.background = this.config.backgroundColor;
    this.canvas.style.border = '1px solid #333';
    this.canvas.style.cursor = 'crosshair';
    
    this.ctx = this.canvas.getContext('2d');
  }

  setupEventListeners() {
    // Mouse interaction for node selection
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      
      this.checkNodeHover();
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      this.selectNode(clickX, clickY);
    });

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const rect = this.canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const touchY = e.touches[0].clientY - rect.top;
        this.selectNode(touchX, touchY);
      }
    });

    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.config.nodeRadius = Math.max(8, Math.min(30, this.config.nodeRadius * zoomFactor));
      this.generateNetwork();
    });
  }

  generateNetwork() {
    this.network = {
      layers: [],
      connections: []
    };

    const layerCount = this.config.layers.length;
    const maxNodes = Math.max(...this.config.layers);
    const layerSpacing = this.config.width / (layerCount + 1);
    const nodeSpacing = this.config.height / (maxNodes + 1);

    // Generate nodes for each layer
    this.config.layers.forEach((nodeCount, layerIndex) => {
      const layer = {
        index: layerIndex,
        nodes: [],
        x: (layerIndex + 1) * layerSpacing
      };

      for (let i = 0; i < nodeCount; i++) {
        const y = (i + 1) * nodeSpacing;
        layer.nodes.push({
          id: `L${layerIndex}_N${i}`,
          layerIndex,
          nodeIndex: i,
          x: layer.x,
          y,
          activation: Math.random(),
          bias: (Math.random() - 0.5) * 2,
          selected: false
        });
      }

      this.network.layers.push(layer);
    });

    // Generate connections between layers
    for (let layerIndex = 0; layerIndex < this.network.layers.length - 1; layerIndex++) {
      const currentLayer = this.network.layers[layerIndex];
      const nextLayer = this.network.layers[layerIndex + 1];

      currentLayer.nodes.forEach(fromNode => {
        nextLayer.nodes.forEach(toNode => {
          this.network.connections.push({
            from: fromNode,
            to: toNode,
            weight: (Math.random() - 0.5) * 2,
            strength: Math.random(),
            animated: false
          });
        });
      });
    }
  }

  generateDataFlow() {
    this.dataFlow = [];
    
    if (!this.data || this.data.length === 0) {
      this.generateSampleData();
    }

    // Create data flow through the network
    this.data.forEach((dataPoint, dataIndex) => {
      const flow = {
        id: dataIndex,
        data: dataPoint,
        path: [],
        currentLayer: 0,
        progress: 0
      };

      // Initialize with input layer
      this.network.layers[0].nodes.forEach((node, nodeIndex) => {
        const value = this.extractValue(dataPoint, nodeIndex);
        flow.path.push({
          nodeId: node.id,
          value,
          activation: this.sigmoid(value + node.bias)
        });
      });

      this.dataFlow.push(flow);
    });
  }

  generateSampleData() {
    this.data = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      input1: Math.random() * 2 - 1,
      input2: Math.random() * 2 - 1,
      input3: Math.random() * 2 - 1,
      input4: Math.random() * 2 - 1,
      label: `Data ${i + 1}`
    }));
  }

  extractValue(dataPoint, index) {
    if (typeof dataPoint === 'number') return dataPoint;
    if (typeof dataPoint === 'object') {
      const keys = Object.keys(dataPoint).filter(key => key.startsWith('input'));
      if (keys[index]) return dataPoint[keys[index]];
      if (dataPoint.value !== undefined) return dataPoint.value;
    }
    return Math.random() * 2 - 1;
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  startAnimation() {
    this.isAnimating = true;
    this.animate();
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  animate() {
    if (!this.isAnimating) return;

    this.time += this.config.animationSpeed;
    this.updateDataFlow();
    this.updateNetwork();
    this.render();
    
    requestAnimationFrame(() => this.animate());
  }

  updateDataFlow() {
    this.dataFlow.forEach((flow, flowIndex) => {
      // Update progress through network
      flow.progress = (this.time + flowIndex * 0.5) % 1;
      
      // Propagate through layers
      for (let layerIndex = 1; layerIndex < this.network.layers.length; layerIndex++) {
        const layer = this.network.layers[layerIndex];
        const prevLayer = this.network.layers[layerIndex - 1];
        
        layer.nodes.forEach((node, nodeIndex) => {
          // Calculate activation from previous layer
          let activation = 0;
          prevLayer.nodes.forEach((prevNode, prevIndex) => {
            const connection = this.network.connections.find(c => 
              c.from.id === prevNode.id && c.to.id === node.id
            );
            if (connection) {
              const prevActivation = flow.path.find(p => p.nodeId === prevNode.id);
              if (prevActivation) {
                activation += prevActivation.activation * connection.weight;
              }
            }
          });
          
          // Apply activation function
          activation = this.sigmoid(activation + node.bias);
          
          // Update or create path entry
          let pathEntry = flow.path.find(p => p.nodeId === node.id);
          if (!pathEntry) {
            pathEntry = { nodeId: node.id, value: activation, activation };
            flow.path.push(pathEntry);
          } else {
            pathEntry.activation = activation;
          }
        });
      }
    });
  }

  updateNetwork() {
    // Update node activations based on data flow
    this.network.layers.forEach(layer => {
      layer.nodes.forEach(node => {
        // Find average activation from data flow
        const activations = this.dataFlow
          .map(flow => flow.path.find(p => p.nodeId === node.id))
          .filter(p => p)
          .map(p => p.activation);
        
        if (activations.length > 0) {
          node.activation = activations.reduce((sum, act) => sum + act, 0) / activations.length;
        }
      });
    });

    // Update connection animations
    this.network.connections.forEach(connection => {
      connection.animated = Math.random() > 0.8; // Random animation triggers
    });
  }

  render() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Draw grid
    if (this.config.showGrid) {
      this.drawGrid();
    }

    // Draw connections
    if (this.config.showConnections) {
      this.drawConnections();
    }

    // Draw nodes
    this.drawNodes();

    // Draw data flow
    if (this.config.showActivations) {
      this.drawDataFlow();
    }

    // Draw labels and legend
    if (this.config.showLabels) {
      this.drawLabels();
      this.drawLegend();
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.2;

    const gridSpacing = 50;
    for (let x = 0; x < this.config.width; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.config.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.config.height; y += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.config.width, y);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1.0;
  }

  drawConnections() {
    this.network.connections.forEach(connection => {
      const { from, to, weight, strength, animated } = connection;
      
      // Calculate connection color based on weight
      const weightColor = weight > 0 ? 
        `rgba(74, 158, 255, ${Math.abs(weight)})` : 
        `rgba(255, 107, 107, ${Math.abs(weight)})`;
      
      this.ctx.strokeStyle = weightColor;
      this.ctx.lineWidth = this.config.connectionWidth * Math.abs(strength);
      
      // Add animation effect
      if (animated) {
        this.ctx.globalAlpha = 0.8 + 0.2 * Math.sin(this.time * 10);
      } else {
        this.ctx.globalAlpha = 0.6;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();

      // Draw weight indicator
      if (this.config.showWeights) {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillText(weight.toFixed(2), midX, midY);
      }
    });

    this.ctx.globalAlpha = 1.0;
  }

  drawNodes() {
    this.network.layers.forEach(layer => {
      layer.nodes.forEach(node => {
        const { x, y, activation, selected } = node;
        
        // Draw node background
        this.ctx.fillStyle = this.config.nodeColor;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.nodeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw activation indicator
        if (this.config.showActivations) {
          const activationRadius = this.config.nodeRadius * activation;
          this.ctx.fillStyle = this.config.activationColor;
          this.ctx.globalAlpha = 0.7;
          this.ctx.beginPath();
          this.ctx.arc(x, y, activationRadius, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Draw selection highlight
        if (selected) {
          this.ctx.strokeStyle = this.config.activationColor;
          this.ctx.lineWidth = 3;
          this.ctx.globalAlpha = 1.0;
          this.ctx.beginPath();
          this.ctx.arc(x, y, this.config.nodeRadius + 5, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        // Draw node label
        if (this.config.showLabels) {
          this.ctx.fillStyle = this.config.textColor;
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.globalAlpha = 1.0;
          this.ctx.fillText(`${node.layerIndex}:${node.nodeIndex}`, x, y + 4);
        }
      });
    });
  }

  drawDataFlow() {
    this.dataFlow.forEach((flow, flowIndex) => {
      const alpha = 0.3 + 0.4 * Math.sin(this.time * 2 + flowIndex);
      
      flow.path.forEach(pathEntry => {
        const node = this.findNodeById(pathEntry.nodeId);
        if (node) {
          // Draw data flow indicator
          this.ctx.fillStyle = this.config.activationColor;
          this.ctx.globalAlpha = alpha;
          this.ctx.beginPath();
          this.ctx.arc(node.x, node.y, this.config.nodeRadius + 3, 0, Math.PI * 2);
          this.ctx.fill();

          // Draw activation value
          this.ctx.fillStyle = this.config.textColor;
          this.ctx.font = '8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.globalAlpha = 1.0;
          this.ctx.fillText(
            pathEntry.activation.toFixed(2),
            node.x,
            node.y + this.config.nodeRadius + 15
          );
        }
      });
    });
  }

  findNodeById(nodeId) {
    for (const layer of this.network.layers) {
      for (const node of layer.nodes) {
        if (node.id === nodeId) return node;
      }
    }
    return null;
  }

  drawLabels() {
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.font = 'bold 18px Arial';
    this.ctx.textAlign = 'center';
    
    // Title
    this.ctx.fillText('Neural Network Visualization', this.config.width / 2, 30);
    
    // Layer labels
    this.network.layers.forEach((layer, index) => {
      const layerName = index === 0 ? 'Input' : 
                       index === this.network.layers.length - 1 ? 'Output' : 
                       `Hidden ${index}`;
      
      this.ctx.font = '14px Arial';
      this.ctx.fillText(layerName, layer.x, this.config.height - 20);
    });
  }

  drawLegend() {
    const legendX = 20;
    const legendY = 20;
    const legendSpacing = 25;

    this.ctx.fillStyle = this.config.textColor;
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Neural Network Legend', legendX, legendY);

    // Nodes
    this.ctx.fillStyle = this.config.nodeColor;
    this.ctx.beginPath();
    this.ctx.arc(legendX + 10, legendY + 10 + legendSpacing, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.font = '12px Arial';
    this.ctx.fillText('Neurons', legendX + 25, legendY + 15 + legendSpacing);

    // Connections
    this.ctx.strokeStyle = this.config.connectionColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(legendX + 10, legendY + 10 + legendSpacing * 2);
    this.ctx.lineTo(legendX + 26, legendY + 10 + legendSpacing * 2);
    this.ctx.stroke();
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.fillText('Synapses', legendX + 35, legendY + 15 + legendSpacing * 2);

    // Activations
    this.ctx.fillStyle = this.config.activationColor;
    this.ctx.beginPath();
    this.ctx.arc(legendX + 10, legendY + 10 + legendSpacing * 3, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.fillText('Activations', legendX + 25, legendY + 15 + legendSpacing * 3);

    // Network info
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.font = '10px Arial';
    this.ctx.fillText(`Layers: ${this.network.layers.length}`, legendX, legendY + 10 + legendSpacing * 4);
    this.ctx.fillText(`Total Nodes: ${this.network.layers.reduce((sum, layer) => sum + layer.nodes.length, 0)}`, legendX, legendY + 10 + legendSpacing * 5);
    this.ctx.fillText(`Connections: ${this.network.connections.length}`, legendX, legendY + 10 + legendSpacing * 6);
  }

  checkNodeHover() {
    let hoveredNode = null;
    
    this.network.layers.forEach(layer => {
      layer.nodes.forEach(node => {
        const distance = Math.sqrt((this.mouseX - node.x) ** 2 + (this.mouseY - node.y) ** 2);
        if (distance < this.config.nodeRadius) {
          hoveredNode = node;
        }
      });
    });

    if (hoveredNode !== null) {
      this.canvas.style.cursor = 'pointer';
      this.showTooltip(hoveredNode);
    } else {
      this.canvas.style.cursor = 'crosshair';
      this.hideTooltip();
    }
  }

  showTooltip(node) {
    // Create tooltip element if it doesn't exist
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid #333;
      `;
      document.body.appendChild(this.tooltip);
    }

    const tooltipContent = `
      <strong>${node.id}</strong><br>
      Layer: ${node.layerIndex}<br>
      Activation: ${(node.activation * 100).toFixed(1)}%<br>
      Bias: ${node.bias.toFixed(3)}
    `;

    this.tooltip.innerHTML = tooltipContent;
    this.tooltip.style.left = (this.mouseX + 20) + 'px';
    this.tooltip.style.top = (this.mouseY - 20) + 'px';
    this.tooltip.style.display = 'block';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  selectNode(x, y) {
    let selectedNode = null;
    
    this.network.layers.forEach(layer => {
      layer.nodes.forEach(node => {
        const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
        if (distance < this.config.nodeRadius) {
          selectedNode = node;
        }
      });
    });

    // Clear previous selection
    this.network.layers.forEach(layer => {
      layer.nodes.forEach(node => {
        node.selected = false;
      });
    });

    if (selectedNode) {
      selectedNode.selected = true;
    }

    this.render();
  }

  setData(data) {
    this.data = data;
    this.generateDataFlow();
    this.render();
  }

  setArchitecture(layers) {
    this.config.layers = layers;
    this.generateNetwork();
    this.generateDataFlow();
    this.render();
  }

  setAnimationSpeed(speed) {
    this.config.animationSpeed = speed;
  }

  toggleAnimation() {
    this.config.autoAnimate = !this.config.autoAnimate;
    if (this.config.autoAnimate) {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  }

  getCanvas() {
    return this.canvas;
  }

  resize(width, height) {
    this.config.width = width;
    this.config.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.generateNetwork();
    this.render();
  }

  destroy() {
    this.stopAnimation();
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.ctx = null;
  }
}
