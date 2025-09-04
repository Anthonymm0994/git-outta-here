//! Data processing module
//! 
//! This module contains all data processing functionality including
//! input handling, type inference, validation, and optimization.

pub mod input;
pub mod inference;
pub mod validation;
pub mod optimization;

// Re-export main types
pub use input::{InputFormat, FileDetector, CsvReader, ParquetReader};
pub use inference::{TypeInferenceEngine, InferenceError};
pub use validation::{DataValidator, ValidationError, ValidationRule};
pub use optimization::{ParquetOptimizer, OptimizationError, CompressionType};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Main processed data structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProcessedData {
    pub schema: Schema,
    pub columns: HashMap<String, ColumnData>,
    pub row_count: usize,
    pub metadata: DataMetadata,
    pub quality_report: crate::DataQualityReport,
}

/// Data schema information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub columns: Vec<ColumnInfo>,
    pub row_count: usize,
}

/// Column information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: DataType,
    pub nullable: bool,
    pub statistics: ColumnStatistics,
}

/// Data types supported by the system
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataType {
    Integer,
    Float,
    String,
    Boolean,
    DateTime,
    Categorical(usize), // Number of unique categories
}

/// Column data storage
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ColumnData {
    Integer(Vec<i64>),
    Float(Vec<f64>),
    String(Vec<String>),
    Boolean(Vec<bool>),
    DateTime(Vec<chrono::DateTime<chrono::Utc>>),
}

impl ColumnData {
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
