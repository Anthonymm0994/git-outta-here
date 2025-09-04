//! Data Explorer CLI - Generate self-contained HTML data visualizations
//! 
//! This library provides the core functionality for processing CSV/Parquet files
//! and generating self-contained HTML files with embedded data visualizations.
//! 
//! The library is organized into several key modules:
//! - `cli`: Command-line interface and argument parsing
//! - `data`: Data processing pipeline (input, inference, validation, optimization)
//! - `html`: HTML generation with interactive charts and embedded data
//! - `utils`: Utility functions and helper types

pub mod cli;
pub mod data;
pub mod html;
pub mod utils;

// Re-export main types for convenient access from the library
pub use data::{
    ProcessedData, Schema, ColumnInfo, ColumnData, DataType, 
    ColumnStatistics, DataMetadata
};

pub use cli::{Cli, Commands, CommandHandler};
pub use html::HtmlGenerator;

/// Main processing result that summarizes the data processing operation
/// 
/// This structure contains comprehensive information about the processing
/// operation, including performance metrics, data quality assessment,
/// and the resulting schema. It's used for reporting and debugging.
#[derive(Debug, Clone)]
pub struct ProcessingResult {
    /// Number of rows in the input dataset
    pub input_rows: usize,
    /// Size of the generated output (HTML file) in bytes
    pub output_size: usize,
    /// Total time taken for the processing operation
    pub processing_time: std::time::Duration,
    /// Schema information about the processed data
    pub schema: Schema,
    /// Data quality metrics and validation results
    pub data_quality: DataQualityReport,
}

/// Data quality report that provides detailed metrics about data quality
/// 
/// This structure tracks various quality metrics during data processing,
/// including missing values, type errors, and validation failures.
/// It's used to assess the overall quality of the dataset and identify
/// potential issues that may affect visualization accuracy.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DataQualityReport {
    /// Total number of rows processed
    pub total_rows: usize,
    /// Number of rows that passed all validation checks
    pub valid_rows: usize,
    /// Number of rows that failed validation
    pub invalid_rows: usize,
    /// Total number of missing/null values across all columns
    pub missing_values: usize,
    /// Number of type conversion errors encountered
    pub type_errors: usize,
    /// Number of validation rule violations
    pub validation_errors: usize,
}

impl DataQualityReport {
    /// Calculate an overall quality score for the dataset
    /// 
    /// This method computes a quality score between 0.0 and 1.0 based on
    /// two key factors: data validity (ratio of valid rows) and completeness
    /// (ratio of non-missing values). A score of 1.0 indicates perfect
    /// data quality, while 0.0 indicates poor quality.
    /// 
    /// # Returns
    /// Quality score between 0.0 and 1.0, or 0.0 if no data was processed
    pub fn quality_score(&self) -> f64 {
        if self.total_rows == 0 {
            return 0.0;
        }
        
        // Calculate validity ratio (proportion of rows that passed validation)
        let valid_ratio = self.valid_rows as f64 / self.total_rows as f64;
        
        // Calculate completeness ratio (proportion of non-missing values)
        let completeness = 1.0 - (self.missing_values as f64 / self.total_rows as f64);
        
        // Return average of validity and completeness scores
        (valid_ratio + completeness) / 2.0
    }
}

/// Main data processor that orchestrates the entire data processing pipeline
/// 
/// This struct coordinates all the components of the data processing pipeline:
/// file reading, type inference, validation, optimization, and HTML generation.
/// It provides a unified interface for processing data files and generating
/// self-contained HTML visualizations.
pub struct DataProcessor {
    /// Configuration settings for the processing pipeline
    config: ProcessingConfig,
    /// Type inference engine for automatic data type detection
    type_inference: data::inference::TypeInferenceEngine,
    /// Data validator for quality checking and cleaning
    validator: data::validation::DataValidator,
    /// Parquet optimizer for efficient data storage
    optimizer: data::optimization::ParquetOptimizer,
    /// HTML generator for creating interactive visualizations
    html_generator: HtmlGenerator,
}

impl DataProcessor {
    pub fn new(config: ProcessingConfig) -> Self {
        Self {
            type_inference: data::inference::TypeInferenceEngine::new(&config.inference),
            validator: data::validation::DataValidator::new(&config.validation),
            optimizer: data::optimization::ParquetOptimizer::new(&config.optimization),
            html_generator: html::HtmlGenerator::new(&config.html),
            config,
        }
    }

    /// Process a data file and generate an interactive HTML visualization
    /// 
    /// This is the main processing function that orchestrates the entire pipeline:
    /// 1. Detects and reads the input file (CSV or Parquet)
    /// 2. Performs automatic type inference on all columns
    /// 3. Validates and cleans the data according to quality rules
    /// 4. Filters columns if specific columns are requested
    /// 5. Optimizes the data for browser consumption
    /// 6. Generates a self-contained HTML file with embedded data
    /// 
    /// # Arguments
    /// * `input_path` - Path to the input CSV or Parquet file
    /// * `output_path` - Path where the HTML file should be saved
    /// * `selected_columns` - Optional list of columns to include (empty means all columns)
    /// 
    /// # Returns
    /// ProcessingResult with detailed metrics about the processing operation
    pub async fn process_file(&self, input_path: &std::path::Path, output_path: &std::path::Path, selected_columns: &[String]) -> Result<ProcessingResult, ProcessingError> {
        let start = std::time::Instant::now();
        
        // 1. Detect and read input file
        let input_format = data::input::FileDetector::detect_format(input_path)?;
        let raw_data = self.read_data(input_path, input_format).await?;
        
        // 2. Perform type inference
        let schema = self.type_inference.infer_types(&raw_data).await?;
        
        // 3. Validate and clean data
        let validated_data = self.validator.validate_and_clean(raw_data, &schema).await?;
        
        // 4. Filter columns if specified
        let filtered_data = if selected_columns.is_empty() {
            validated_data
        } else {
            self.filter_columns(validated_data, selected_columns)?
        };
        
        // 5. Optimize for browser consumption
        let optimized_parquet = self.optimizer.optimize_for_browser(&filtered_data).await?;
        
        // 6. Generate HTML with embedded Parquet
        let html_content = self.html_generator.generate_html(&optimized_parquet, &filtered_data.schema).await?;
        
        // 6. Write output file
        let output_size = html_content.len();
        std::fs::write(output_path, html_content)?;
        
        let processing_time = start.elapsed();
        
        Ok(ProcessingResult {
            input_rows: filtered_data.row_count,
            output_size,
            processing_time,
            schema: filtered_data.schema,
            data_quality: filtered_data.quality_report,
        })
    }

    async fn read_data(&self, path: &std::path::Path, format: data::input::InputFormat) -> Result<ProcessedData, ProcessingError> {
        match format {
            data::input::InputFormat::Csv(config) => {
                use data::input::FileReader;
                let reader = data::input::CsvReader::new(config);
                reader.read_file(path).await.map_err(ProcessingError::CsvError)
            }
            data::input::InputFormat::Parquet(config) => {
                use data::input::FileReader;
                let reader = data::input::ParquetReader::new(config);
                reader.read_file(path).await.map_err(ProcessingError::ParquetError)
            }
        }
    }
    
    fn filter_columns(&self, data: ProcessedData, selected_columns: &[String]) -> Result<ProcessedData, ProcessingError> {
        let mut filtered_columns = std::collections::HashMap::new();
        let mut filtered_schema_columns = Vec::new();
        
        for column_name in selected_columns {
            if let Some(column_data) = data.columns.get(column_name) {
                filtered_columns.insert(column_name.clone(), column_data.clone());
                
                // Find the corresponding schema column
                if let Some(schema_column) = data.schema.columns.iter().find(|c| &c.name == column_name) {
                    filtered_schema_columns.push(schema_column.clone());
                }
            } else {
                return Err(ProcessingError::ValidationError(
                    data::validation::ValidationError::TypeMismatch {
                        column: column_name.clone(),
                        expected: "existing column".to_string(),
                        actual: "column not found".to_string(),
                    }
                ));
            }
        }
        
        Ok(ProcessedData {
            schema: data::Schema {
                columns: filtered_schema_columns,
                row_count: data.row_count,
            },
            columns: filtered_columns,
            row_count: data.row_count,
            metadata: data.metadata,
            quality_report: data.quality_report,
        })
    }
}

/// Processing configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProcessingConfig {
    pub inference: InferenceConfig,
    pub validation: ValidationConfig,
    pub optimization: OptimizationConfig,
    pub html: html::HtmlConfig,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InferenceConfig {
    pub sample_size: usize,
    pub confidence_threshold: f64,
    pub max_categories: usize,
    pub enable_pattern_matching: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationConfig {
    pub strict_type_enforcement: bool,
    pub handle_missing_data: MissingDataStrategy,
    pub outlier_detection: bool,
    pub custom_rules: Vec<data::validation::ValidationRule>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OptimizationConfig {
    pub row_group_size: usize,
    pub compression: data::optimization::CompressionType,
    pub dictionary_threshold: f64,
    pub enable_metadata: bool,
}

// HtmlConfig is now defined in html module

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChartConfig {
    pub default_bins: usize,
    pub color_scheme: String,
    pub show_statistics: bool,
    pub enable_interactions: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum MissingDataStrategy {
    Skip,
    Default,
    Error,
    Interpolate,
}

/// Processing errors
#[derive(Debug, thiserror::Error)]
pub enum ProcessingError {
    #[error("File detection error: {0}")]
    DetectionError(#[from] data::input::DetectionError),
    
    #[error("CSV processing error: {0}")]
    CsvError(#[from] data::input::CsvError),
    
    #[error("Parquet processing error: {0}")]
    ParquetError(#[from] data::input::ParquetError),
    
    #[error("Type inference error: {0}")]
    InferenceError(#[from] data::inference::InferenceError),
    
    #[error("Validation error: {0}")]
    ValidationError(#[from] data::validation::ValidationError),
    
    #[error("Optimization error: {0}")]
    OptimizationError(#[from] data::optimization::OptimizationError),
    
    #[error("HTML generation error: {0}")]
    HtmlError(#[from] html::HtmlError),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Default for ProcessingConfig {
    fn default() -> Self {
        Self {
            inference: InferenceConfig {
                sample_size: 10000,
                confidence_threshold: 0.8,
                max_categories: 1000,
                enable_pattern_matching: true,
            },
            validation: ValidationConfig {
                strict_type_enforcement: true,
                handle_missing_data: MissingDataStrategy::Skip,
                outlier_detection: true,
                custom_rules: Vec::new(),
            },
            optimization: OptimizationConfig {
                row_group_size: 100000,
                compression: data::optimization::CompressionType::Snappy,
                dictionary_threshold: 0.8,
                enable_metadata: true,
            },
            html: html::HtmlConfig {
                title: "Data Explorer".to_string(),
                theme: "dark".to_string(),
                chart_config: ChartConfig {
                    default_bins: 50,
                    color_scheme: "viridis".to_string(),
                    show_statistics: true,
                    enable_interactions: true,
                },
                include_hyparquet: true,
            },
        }
    }
}
