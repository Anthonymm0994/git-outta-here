//! Data processing module
//! 
//! This module contains all data processing functionality including
//! input handling, type inference, validation, and optimization.
//! 
//! The data processing pipeline follows this flow:
//! 1. **Input**: Detect file format and read CSV/Parquet files
//! 2. **Inference**: Automatically determine data types for each column
//! 3. **Validation**: Clean and validate data according to inferred types
//! 4. **Optimization**: Prepare data for efficient browser consumption
//! 5. **Output**: Generate self-contained HTML with embedded data

pub mod input;
pub mod inference;
pub mod validation;
pub mod optimization;

// Re-export main types for convenient access
pub use input::{InputFormat, FileDetector, CsvReader, ParquetReader};
pub use inference::{TypeInferenceEngine, InferenceError};
pub use validation::{DataValidator, ValidationError, ValidationRule};
pub use optimization::{ParquetOptimizer, OptimizationError, CompressionType};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Main processed data structure that holds all information about the dataset
/// 
/// This is the central data structure that flows through the entire processing pipeline.
/// It contains both the raw data (in columns) and metadata about the data structure
/// (in schema), along with quality metrics and processing information.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProcessedData {
    /// Schema information describing column names, types, and statistics
    pub schema: Schema,
    /// Actual data organized by column name
    /// Key: column name, Value: typed data array
    pub columns: HashMap<String, ColumnData>,
    /// Total number of rows in the dataset
    pub row_count: usize,
    /// Additional metadata about the dataset (file info, processing time, etc.)
    pub metadata: DataMetadata,
    /// Data quality metrics and validation results
    pub quality_report: crate::DataQualityReport,
}

/// Data schema information that describes the structure of the dataset
/// 
/// This structure contains metadata about each column in the dataset,
/// including their names, data types, and statistical information.
/// It's used both for data validation and for generating appropriate
/// visualizations in the HTML output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    /// Information about each column in the dataset
    pub columns: Vec<ColumnInfo>,
    /// Total number of rows in the dataset
    pub row_count: usize,
}

/// Information about a single column in the dataset
/// 
/// This structure holds all metadata about a column, including its name,
/// inferred data type, and statistical properties. This information is
/// crucial for both data validation and chart generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    /// The name of the column as it appears in the source data
    pub name: String,
    /// The inferred data type (Float, Integer, Categorical, etc.)
    pub data_type: DataType,
    /// Whether the column can contain null/missing values
    pub nullable: bool,
    /// Statistical properties of the column (min, max, mean, etc.)
    pub statistics: ColumnStatistics,
}

/// Data types supported by the system
/// 
/// This enum represents the different types of data that can be processed.
/// Each type determines how the data is stored, validated, and visualized.
/// The Categorical variant includes the number of unique categories for
/// optimization purposes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataType {
    /// Integer numeric data (whole numbers)
    Integer,
    /// Floating-point numeric data (decimal numbers)
    Float,
    /// String/text data (variable length strings)
    String,
    /// Boolean data (true/false values)
    Boolean,
    /// Date and time data (timestamps, dates)
    DateTime,
    /// Categorical data with a limited set of unique values
    /// The usize parameter indicates the number of unique categories
    Categorical(usize),
}

/// Column data storage that holds the actual data values for each column
/// 
/// This enum provides type-safe storage for different data types. Each variant
/// contains a Vec of values for that specific type. This design allows for
/// efficient memory usage and type safety throughout the processing pipeline.
/// The data is stored in columnar format for optimal performance.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ColumnData {
    /// Integer values stored as Vec<i64> for maximum range
    Integer(Vec<i64>),
    /// Floating-point values stored as Vec<f64> for precision
    Float(Vec<f64>),
    /// String values stored as Vec<String>
    String(Vec<String>),
    /// Boolean values stored as Vec<bool>
    Boolean(Vec<bool>),
    /// Date/time values stored as chrono::DateTime<Utc> for proper date handling
    DateTime(Vec<chrono::DateTime<chrono::Utc>>),
}

impl ColumnData {
    /// Get the number of values in this column
    /// 
    /// This method provides a unified way to get the length of any column
    /// regardless of its data type. It's used throughout the processing
    /// pipeline for validation and iteration.
    pub fn len(&self) -> usize {
        match self {
            ColumnData::Integer(data) => data.len(),
            ColumnData::Float(data) => data.len(),
            ColumnData::String(data) => data.len(),
            ColumnData::Boolean(data) => data.len(),
            ColumnData::DateTime(data) => data.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Column statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnStatistics {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub mean: Option<f64>,
    pub median: Option<f64>,
    pub std_dev: Option<f64>,
    pub null_count: usize,
    pub unique_count: Option<usize>,
}

/// Data metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DataMetadata {
    pub source_file: String,
    pub file_size: u64,
    pub processing_timestamp: chrono::DateTime<chrono::Utc>,
    pub format: String,
    pub encoding: String,
}
