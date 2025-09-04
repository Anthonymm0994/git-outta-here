//! HTML generation module

use crate::data::Schema;
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum HtmlError {
    #[error("HTML generation error: {0}")]
    GenerationError(String),
    
    #[error("Template error: {0}")]
    TemplateError(String),
    
    #[error("Data encoding error: {0}")]
    EncodingError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtmlConfig {
    pub title: String,
    pub theme: String,
    pub chart_config: crate::ChartConfig,
    pub include_hyparquet: bool,
}

pub struct HtmlGenerator {
    title: String,
    theme: String,
}

impl HtmlGenerator {
    pub fn new(config: &HtmlConfig) -> Self {
        Self {
            title: config.title.clone(),
            theme: config.theme.clone(),
        }
    }
    
    pub async fn generate_html(&self, parquet_bytes: &[u8], schema: &Schema) -> Result<String, HtmlError> {
        let base64_data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, parquet_bytes);
        
        // Calculate grid layout based on number of columns
        let num_columns = schema.columns.len();
        let grid_columns = match num_columns {
            1 => "1fr",
            2 => "1fr 1fr", 
            3 => "1fr 1fr 1fr",
            4 => "1fr 1fr 1fr 1fr",
            5..=6 => "repeat(3, 1fr)",
            _ => "repeat(auto-fit, minmax(300px, 1fr))",
        };
        
        // Generate column-specific chart HTML
        let mut chart_html = String::new();
        
        for (i, column) in schema.columns.iter().enumerate() {
            // Create descriptive canvas ID based on column name (like original data_explorer.html)
            let canvas_id = format!("{}Canvas", column.name.replace(" ", "").replace("_", ""));
            let panel_class = match column.data_type {
                crate::data::DataType::Float | crate::data::DataType::Integer => "histogram-panel",
                crate::data::DataType::Categorical(_) => "category-panel",
                crate::data::DataType::Boolean => "boolean-panel",
                _ => "text-panel",
            };
            
            chart_html.push_str(&format!(r#"
        <div class="panel {}">
            <div class="panel-title">{}</div>
            <canvas id="{}" width="400" height="300"></canvas>
        </div>"#, 
                panel_class, column.name, canvas_id
            ));
        }
        
        // Build HTML using string concatenation
        let mut html = String::new();
        html.push_str("<!DOCTYPE html>\n");
        html.push_str("<html lang=\"en\">\n");
        html.push_str("<head>\n");
        html.push_str("    <meta charset=\"UTF-8\">\n");
        html.push_str("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.push_str(&format!("    <title>{} - Data Explorer</title>\n", self.title));
        html.push_str("    <style>\n");
        html.push_str("        * { margin: 0; padding: 0; box-sizing: border-box; }\n");
        html.push_str("        body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; overflow: hidden; }\n");
        html.push_str("        #loading { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }\n");
        html.push_str("        .progress { width: 400px; height: 6px; background: #333; margin-top: 10px; border-radius: 3px; }\n");
        html.push_str("        .progress-bar { height: 100%; background: #4a9eff; transition: width 0.1s; border-radius: 3px; }\n");
        html.push_str("        #main { display: none; height: 100vh; padding: 8px; }\n");
        html.push_str("        .header { background: #1a1a1a; padding: 8px 16px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }\n");
        html.push_str("        .stats { display: flex; gap: 15px; font-size: 13px; }\n");
        html.push_str("        .stats span { display: flex; align-items: center; gap: 5px; }\n");
        html.push_str("        .stats strong { color: #4a9eff; }\n");
        html.push_str("        button { background: #4a9eff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px; transition: all 0.2s; }\n");
        html.push_str("        button:hover { background: #3a8eef; }\n");
        html.push_str("        button:active { transform: scale(0.95); }\n");
        html.push_str(&format!("        .grid {{ display: grid; grid-template-columns: {}; gap: 8px; height: calc(100% - 60px); }}\n", grid_columns));
        html.push_str("        .panel { background: #1a1a1a; border-radius: 4px; padding: 8px; position: relative; min-height: 200px; display: flex; flex-direction: column; }\n");
        html.push_str("        .panel-title { font-size: 13px; margin-bottom: 8px; font-weight: 500; }\n");
        html.push_str("        canvas { width: 100%; height: calc(100% - 30px); cursor: crosshair; }\n");
        html.push_str("        #tooltip { position: fixed; background: rgba(0,0,0,0.95); padding: 6px 10px; border-radius: 3px; font-size: 11px; pointer-events: none; display: none; z-index: 1000; border: 1px solid #333; }\n");
        html.push_str("        .histogram-panel { border-left: 3px solid #4a9eff; }\n");
        html.push_str("        .category-panel { border-left: 3px solid #ff6b6b; }\n");
        html.push_str("        .boolean-panel { border-left: 3px solid #51cf66; }\n");
        html.push_str("        .text-panel { border-left: 3px solid #ffd43b; }\n");
        html.push_str("    </style>\n");
        html.push_str("</head>\n");
        html.push_str("<body>\n");
        html.push_str("    <div id=\"loading\">\n");
        html.push_str("        <div>Loading data...</div>\n");
        html.push_str("        <div class=\"progress\"><div class=\"progress-bar\" id=\"progress\"></div></div>\n");
        html.push_str("        <div id=\"loadingStatus\" style=\"margin-top: 8px; font-size: 12px; color: #999;\"></div>\n");
        html.push_str("    </div>\n");
        html.push_str("    \n");
        html.push_str("    <div id=\"main\">\n");
        html.push_str("        <div class=\"header\">\n");
        html.push_str(&format!("            <h3>Data Explorer - {} Rows</h3>\n", schema.row_count));
        html.push_str("            <div class=\"stats\">\n");
        html.push_str(&format!("                <span>Total: <strong>{}</strong></span>\n", schema.row_count));
        html.push_str(&format!("                <span>Columns: <strong>{}</strong></span>\n", schema.columns.len()));
        html.push_str(&format!("                <span>Data Size: <strong>{:.1} KB</strong></span>\n", parquet_bytes.len() as f64 / 1024.0));
        html.push_str("            </div>\n");
        html.push_str("            <div style=\"display: flex; gap: 8px;\">\n");
        html.push_str("                <button onclick=\"resetAll()\">🔄 Reset</button>\n");
        html.push_str("                <button onclick=\"exportData()\">💾 Export</button>\n");
        html.push_str("            </div>\n");
        html.push_str("        </div>\n");
        html.push_str("        \n");
        html.push_str("        <div class=\"grid\">\n");
        html.push_str(&chart_html);
        html.push_str("        </div>\n");
        html.push_str("    </div>\n");
        html.push_str("    \n");
        html.push_str("    <div id=\"tooltip\"></div>\n");
        html.push_str("    \n");
        html.push_str("    <script>\n");
        html.push_str("        // Embedded data\n");
        html.push_str(&format!("        const embeddedData = \"{}\";\n", base64_data));
        html.push_str(&format!("        const schema = {};\n", serde_json::to_string(schema).unwrap_or_else(|_| "{}".to_string())));
        html.push_str("        let allData = null;\n");
        html.push_str("        \n");
        html.push_str("        // Initialize data\n");
        html.push_str("        async function initializeData() {\n");
        html.push_str("            try {\n");
        html.push_str("                // Decode base64 data\n");
        html.push_str("                const binaryString = atob(embeddedData);\n");
        html.push_str("                const bytes = new Uint8Array(binaryString.length);\n");
        html.push_str("                for (let i = 0; i < binaryString.length; i++) {\n");
        html.push_str("                    bytes[i] = binaryString.charCodeAt(i);\n");
        html.push_str("                }\n");
        html.push_str("                \n");
        html.push_str("                // Parse JSON data (temporary - will be replaced with hyparquet)\n");
        html.push_str("                const jsonString = new TextDecoder().decode(bytes);\n");
        html.push_str("                allData = JSON.parse(jsonString);\n");
        html.push_str("                \n");
        html.push_str("                // Update progress\n");
        html.push_str("                document.getElementById('progress').style.width = '100%';\n");
        html.push_str("                document.getElementById('loadingStatus').textContent = 'Data loaded successfully!';\n");
        html.push_str("                \n");
        html.push_str("                // Show main interface\n");
        html.push_str("                setTimeout(() => {\n");
        html.push_str("                    document.getElementById('loading').style.display = 'none';\n");
        html.push_str("                    document.getElementById('main').style.display = 'block';\n");
        html.push_str("                    initializeCharts();\n");
        html.push_str("                }, 500);\n");
        html.push_str("                \n");
        html.push_str("            } catch (error) {\n");
        html.push_str("                console.error('Error loading data:', error);\n");
        html.push_str("                document.getElementById('loadingStatus').textContent = 'Error loading data: ' + error.message;\n");
        html.push_str("            }\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Initialize all charts\n");
        html.push_str("        function initializeCharts() {\n");
        html.push_str("            if (!allData) {\n");
        html.push_str("                console.error('No data available for chart initialization');\n");
        html.push_str("                return;\n");
        html.push_str("            }\n");
        html.push_str("            \n");
        html.push_str("            \n");
        html.push_str("            for (const [columnName, columnData] of Object.entries(allData.columns)) {\n");
        html.push_str("                // Create canvas ID based on column name (same as HTML generation)\n");
        html.push_str("                const canvasId = `${columnName.replace(/[ _]/g, '')}Canvas`;\n");
        html.push_str("                const canvas = document.getElementById(canvasId);\n");
        html.push_str("                \n");
        html.push_str("                if (!canvas) {\n");
        html.push_str("                    console.error(`Canvas ${canvasId} not found in DOM`);\n");
        html.push_str("                    continue;\n");
        html.push_str("                }\n");
        html.push_str("                \n");
        html.push_str("                if (typeof canvas.getContext !== 'function') {\n");
        html.push_str("                    console.error(`Canvas ${canvasId} does not have getContext method`);\n");
        html.push_str("                    continue;\n");
        html.push_str("                }\n");
        html.push_str("                \n");
        html.push_str("                const ctx = canvas.getContext('2d');\n");
        html.push_str("                if (!ctx) {\n");
        html.push_str("                    console.error(`Could not get 2D context for canvas ${canvasId}`);\n");
        html.push_str("                    continue;\n");
        html.push_str("                }\n");
        html.push_str("                \n");
        html.push_str("                // Get the actual data values from the ColumnData structure\n");
        html.push_str("                let values = [];\n");
        html.push_str("                if (columnData && typeof columnData === 'object') {\n");
        html.push_str("                    // ColumnData is an object with type as key and data as value\n");
        html.push_str("                    // e.g., {\"String\": [\"value1\", \"value2\", ...]}\n");
        html.push_str("                    const dataType = Object.keys(columnData)[0];\n");
        html.push_str("                    if (dataType && Array.isArray(columnData[dataType])) {\n");
        html.push_str("                        values = columnData[dataType];\n");
        html.push_str("                    }\n");
        html.push_str("                }\n");
        html.push_str("                \n");
        html.push_str("                // Create chart based on data type\n");
        html.push_str("                createChart(ctx, values, columnName, canvas.width, canvas.height);\n");
        html.push_str("            }\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Create chart based on data type\n");
        html.push_str("        function createChart(ctx, data, columnName, width, height) {\n");
        html.push_str("            // Clear canvas\n");
        html.push_str("            ctx.clearRect(0, 0, width, height);\n");
        html.push_str("            \n");
        html.push_str("            if (data.length === 0) {\n");
        html.push_str("                ctx.fillStyle = '#666';\n");
        html.push_str("                ctx.font = '16px sans-serif';\n");
        html.push_str("                ctx.textAlign = 'center';\n");
        html.push_str("                ctx.fillText('No data available', width / 2, height / 2);\n");
        html.push_str("                return;\n");
        html.push_str("            }\n");
        html.push_str("            \n");
        html.push_str("            // Try to determine if data is numeric\n");
        html.push_str("            const numericData = data.map(d => parseFloat(d)).filter(d => !isNaN(d));\n");
        html.push_str("            \n");
        html.push_str("            if (numericData.length > data.length * 0.8) {\n");
        html.push_str("                // Numeric data - create histogram\n");
        html.push_str("                createHistogram(ctx, numericData, columnName, width, height);\n");
        html.push_str("            } else {\n");
        html.push_str("                // Categorical data - create bar chart\n");
        html.push_str("                createCategoryChart(ctx, data, columnName, width, height);\n");
        html.push_str("            }\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Create histogram\n");
        html.push_str("        function createHistogram(ctx, data, columnName, width, height) {\n");
        html.push_str("            const min = Math.min(...data);\n");
        html.push_str("            const max = Math.max(...data);\n");
        html.push_str("            const bins = 20;\n");
        html.push_str("            const binWidth = (max - min) / bins;\n");
        html.push_str("            \n");
        html.push_str("            // Create bins\n");
        html.push_str("            const histogram = new Array(bins).fill(0);\n");
        html.push_str("            data.forEach(value => {\n");
        html.push_str("                const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);\n");
        html.push_str("                histogram[binIndex]++;\n");
        html.push_str("            });\n");
        html.push_str("            \n");
        html.push_str("            const maxCount = Math.max(...histogram);\n");
        html.push_str("            \n");
        html.push_str("            // Draw histogram\n");
        html.push_str("            ctx.fillStyle = '#4a9eff';\n");
        html.push_str("            histogram.forEach((count, i) => {\n");
        html.push_str("                const barHeight = (count / maxCount) * (height - 40);\n");
        html.push_str("                const x = (i / bins) * width;\n");
        html.push_str("                const y = height - barHeight - 20;\n");
        html.push_str("                ctx.fillRect(x, y, width / bins - 1, barHeight);\n");
        html.push_str("            });\n");
        html.push_str("            \n");
        html.push_str("            // Draw axes\n");
        html.push_str("            ctx.strokeStyle = '#666';\n");
        html.push_str("            ctx.lineWidth = 1;\n");
        html.push_str("            ctx.beginPath();\n");
        html.push_str("            ctx.moveTo(0, height - 20);\n");
        html.push_str("            ctx.lineTo(width, height - 20);\n");
        html.push_str("            ctx.stroke();\n");
        html.push_str("            \n");
        html.push_str("            ctx.beginPath();\n");
        html.push_str("            ctx.moveTo(0, 0);\n");
        html.push_str("            ctx.lineTo(0, height - 20);\n");
        html.push_str("            ctx.stroke();\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Create category chart\n");
        html.push_str("        function createCategoryChart(ctx, data, columnName, width, height) {\n");
        html.push_str("            // Count categories\n");
        html.push_str("            const categories = {};\n");
        html.push_str("            data.forEach(value => {\n");
        html.push_str("                categories[value] = (categories[value] || 0) + 1;\n");
        html.push_str("            });\n");
        html.push_str("            \n");
        html.push_str("            const categoryNames = Object.keys(categories);\n");
        html.push_str("            const maxCount = Math.max(...Object.values(categories));\n");
        html.push_str("            \n");
        html.push_str("            // Draw bars\n");
        html.push_str("            const barWidth = width / categoryNames.length;\n");
        html.push_str("            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];\n");
        html.push_str("            \n");
        html.push_str("            categoryNames.forEach((category, i) => {\n");
        html.push_str("                const count = categories[category];\n");
        html.push_str("                const barHeight = (count / maxCount) * (height - 40);\n");
        html.push_str("                const x = i * barWidth;\n");
        html.push_str("                const y = height - barHeight - 20;\n");
        html.push_str("                \n");
        html.push_str("                ctx.fillStyle = colors[i % colors.length];\n");
        html.push_str("                ctx.fillRect(x, y, barWidth - 2, barHeight);\n");
        html.push_str("                \n");
        html.push_str("                // Draw label\n");
        html.push_str("                ctx.fillStyle = '#e0e0e0';\n");
        html.push_str("                ctx.font = '10px sans-serif';\n");
        html.push_str("                ctx.textAlign = 'center';\n");
        html.push_str("                ctx.fillText(category, x + barWidth / 2, height - 5);\n");
        html.push_str("            });\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Reset all charts\n");
        html.push_str("        function resetAll() {\n");
        html.push_str("            initializeCharts();\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Export data\n");
        html.push_str("        function exportData() {\n");
        html.push_str("            if (!allData) return;\n");
        html.push_str("            \n");
        html.push_str("            const dataStr = JSON.stringify(allData, null, 2);\n");
        html.push_str("            const dataBlob = new Blob([dataStr], {type: 'application/json'});\n");
        html.push_str("            const url = URL.createObjectURL(dataBlob);\n");
        html.push_str("            const link = document.createElement('a');\n");
        html.push_str("            link.href = url;\n");
        html.push_str("            link.download = 'data_export.json';\n");
        html.push_str("            link.click();\n");
        html.push_str("            URL.revokeObjectURL(url);\n");
        html.push_str("        }\n");
        html.push_str("        \n");
        html.push_str("        // Start loading\n");
        html.push_str("        initializeData();\n");
        html.push_str("    </script>\n");
        html.push_str("</body>\n");
        html.push_str("</html>\n");
        
        Ok(html)
    }
}