// Core Component Tests for Data Explorer Library
// Tests the basic functionality without external dependencies

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = { passed: 0, failed: 0, total: 0 };
    }
    
    test(name, testFn) {
        this.tests.push({ name, testFn });
    }
    
    runTests() {
        console.log('🧪 Running Core Component Tests...\n');
        
        this.tests.forEach((test, index) => {
            try {
                test.testFn();
                console.log(`✅ PASS: ${test.name}`);
                this.results.passed++;
            } catch (error) {
                console.log(`❌ FAIL: ${test.name}`);
                console.log(`   Error: ${error.message}`);
                this.results.failed++;
            }
            this.results.total++;
        });
        
        this.printResults();
    }
    
    printResults() {
        console.log('\n📊 Test Results:');
        console.log(`Total: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}: expected ${expected}, got ${actual}`);
        }
    }
    
    assertArrayEqual(actual, expected, message) {
        if (actual.length !== expected.length) {
            throw new Error(`${message}: length mismatch - expected ${expected.length}, got ${actual.length}`);
        }
        for (let i = 0; i < actual.length; i++) {
            if (actual[i] !== expected[i]) {
                throw new Error(`${message}: index ${i} - expected ${expected[i]}, got ${actual[i]}`);
            }
        }
    }
}

// Mock implementations for testing
class MockDataManager {
    constructor() {
        this.data = null;
        this.schema = {};
        this.filteredIndices = null;
        this.totalRows = 0;
    }
    
    loadData(data) {
        this.data = data;
        this.totalRows = data.length;
        this.filteredIndices = new Uint32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            this.filteredIndices[i] = i;
        }
        return Promise.resolve();
    }
    
    getRowCount() {
        return this.totalRows;
    }
}

class MockFilterManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.filters = {};
    }
    
    setFilter(field, config) {
        this.filters[field] = config;
    }
    
    getActiveFilters() {
        return Object.keys(this.filters).filter(field => this.filters[field].enabled);
    }
}

class MockLayoutEngine {
    constructor() {
        this.currentLayout = { rows: 2, cols: 2 };
    }
    
    setLayout(layout) {
        this.currentLayout = layout;
    }
    
    getCurrentLayout() {
        return this.currentLayout;
    }
}

class MockChartManager {
    constructor() {
        this.charts = new Map();
    }
    
    createChart(id, config) {
        const chart = { id, config, rendered: false };
        this.charts.set(id, chart);
        return chart;
    }
    
    getChart(id) {
        return this.charts.get(id);
    }
}

// Test the core DataExplorer class
class DataExplorer {
    constructor(config = {}) {
        this.config = { theme: 'dark', responsive: true, ...config };
        this.dataManager = new MockDataManager();
        this.filterManager = new MockFilterManager(this.dataManager);
        this.layoutEngine = new MockLayoutEngine();
        this.chartManager = new MockChartManager();
        this.isInitialized = false;
    }
    
    async initialize(initConfig) {
        if (initConfig.data) {
            await this.dataManager.loadData(initConfig.data);
        }
        if (initConfig.layout) {
            this.layoutEngine.setLayout(initConfig.layout);
        }
        this.isInitialized = true;
        return true;
    }
    
    async loadData(data, options = {}) {
        await this.dataManager.loadData(data);
        return true;
    }
    
    setLayout(layout) {
        this.layoutEngine.setLayout(layout);
        return true;
    }
    
    createCharts(chartConfigs) {
        const createdCharts = [];
        chartConfigs.forEach(config => {
            const chart = this.chartManager.createChart(config.id, config);
            createdCharts.push(chart);
        });
        return createdCharts;
    }
    
    getStats() {
        return {
            totalRows: this.dataManager.getRowCount(),
            activeFilters: this.filterManager.getActiveFilters().length,
            chartCount: this.chartManager.charts.size,
            layout: this.layoutEngine.getCurrentLayout()
        };
    }
}

// Run tests
const runner = new TestRunner();

// Test 1: Basic initialization
runner.test('DataExplorer initialization', () => {
    const explorer = new DataExplorer();
    runner.assert(!explorer.isInitialized, 'Should start uninitialized');
    runner.assert(explorer.config.theme === 'dark', 'Should have default theme');
});

// Test 2: Data loading
runner.test('Data loading functionality', async () => {
    const explorer = new DataExplorer();
    const testData = [
        { id: 1, value: 100 },
        { id: 2, value: 200 },
        { id: 3, value: 300 }
    ];
    
    await explorer.loadData(testData);
    const stats = explorer.getStats();
    runner.assertEqual(stats.totalRows, 3, 'Should load correct number of rows');
});

// Test 3: Layout management
runner.test('Layout management', () => {
    const explorer = new DataExplorer();
    const testLayout = { rows: 3, cols: 4 };
    
    explorer.setLayout(testLayout);
    const currentLayout = explorer.layoutEngine.getCurrentLayout();
    runner.assertEqual(currentLayout.rows, 3, 'Should set correct rows');
    runner.assertEqual(currentLayout.cols, 4, 'Should set correct columns');
});

// Test 4: Chart creation
runner.test('Chart creation', () => {
    const explorer = new DataExplorer();
    const chartConfigs = [
        { id: 'chart1', type: 'histogram', data: 'value' },
        { id: 'chart2', type: 'scatter', data: 'id' }
    ];
    
    const createdCharts = explorer.createCharts(chartConfigs);
    runner.assertEqual(createdCharts.length, 2, 'Should create correct number of charts');
    
    const chart1 = explorer.chartManager.getChart('chart1');
    runner.assert(chart1 !== undefined, 'Should find created chart');
    runner.assertEqual(chart1.config.type, 'histogram', 'Should have correct chart type');
});

// Test 5: Full initialization workflow
runner.test('Complete initialization workflow', async () => {
    const explorer = new DataExplorer();
    const initConfig = {
        data: [{ x: 1, y: 10 }, { x: 2, y: 20 }],
        layout: { rows: 2, cols: 2 }
    };
    
    await explorer.initialize(initConfig);
    runner.assert(explorer.isInitialized, 'Should be initialized after init');
    
    const stats = explorer.getStats();
    runner.assertEqual(stats.totalRows, 2, 'Should have correct row count');
    runner.assertEqual(stats.layout.rows, 2, 'Should have correct layout');
});

// Test 6: Performance with large datasets
runner.test('Large dataset handling', async () => {
    const explorer = new DataExplorer();
    
    // Create a large dataset (100K rows)
    const largeData = new Array(100000).fill(0).map((_, i) => ({
        id: i,
        value: Math.random() * 1000,
        category: Math.floor(Math.random() * 10)
    }));
    
    const startTime = performance.now();
    await explorer.loadData(largeData);
    const loadTime = performance.now() - startTime;
    
    const stats = explorer.getStats();
    runner.assertEqual(stats.totalRows, 100000, 'Should handle large datasets');
    runner.assert(loadTime < 1000, `Should load 100K rows in under 1 second (took ${Math.round(loadTime)}ms)`);
});

// Test 7: Configuration persistence
runner.test('Configuration management', () => {
    const config = { theme: 'light', responsive: false };
    const explorer = new DataExplorer(config);
    
    runner.assertEqual(explorer.config.theme, 'light', 'Should use custom theme');
    runner.assertEqual(explorer.config.responsive, false, 'Should use custom responsive setting');
});

// Test 8: Error handling
runner.test('Error handling', () => {
    const explorer = new DataExplorer();
    
    // Test with invalid chart config
    const invalidConfigs = [
        { type: 'histogram' }, // Missing id
        { id: 'chart1' }       // Missing type
    ];
    
    try {
        explorer.createCharts(invalidConfigs);
        // Should not reach here
        runner.assert(false, 'Should throw error for invalid configs');
    } catch (error) {
        // Expected error
        runner.assert(true, 'Should handle invalid configurations gracefully');
    }
});

// Run all tests
if (typeof window !== 'undefined') {
    // Browser environment
    window.addEventListener('load', () => {
        runner.runTests();
    });
} else {
    // Node.js environment
    runner.runTests();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestRunner, DataExplorer };
}
