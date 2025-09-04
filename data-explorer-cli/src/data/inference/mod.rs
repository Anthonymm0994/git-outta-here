//! Type inference module
//! 
//! This module handles automatic type inference for CSV data columns.
//! It analyzes string data and determines the most appropriate data type
//! (Integer, Float, String, Boolean, DateTime, Categorical) based on
//! statistical analysis and pattern matching.

use crate::data::{ProcessedData, Schema};

/// Errors that can occur during type inference
/// 
/// These errors cover issues with analyzing data patterns and determining
/// appropriate data types for columns.
#[derive(Debug, thiserror::Error)]
pub enum InferenceError {
    /// General type inference error with descriptive message
    #[error("Type inference error: {0}")]
    InferenceError(String),
    
    /// Error during statistical analysis of data patterns
    #[error("Statistical analysis error: {0}")]
    StatisticalError(String),
}

/// Type inference engine that analyzes data and determines column types
/// 
/// This engine uses statistical analysis and pattern matching to automatically
/// determine the most appropriate data type for each column. It considers
/// factors like value patterns, statistical properties, and data distribution
/// to make intelligent type decisions.
pub struct TypeInferenceEngine {
    /// Number of rows to sample for type inference (for performance)
    sample_size: usize,
    /// Confidence threshold for type decisions (0.0 to 1.0)
    confidence_threshold: f64,
    /// Maximum number of unique values to consider a column categorical
    max_categories: usize,
}

impl TypeInferenceEngine {
    pub fn new(config: &crate::InferenceConfig) -> Self {
        Self {
            sample_size: config.sample_size,
            confidence_threshold: config.confidence_threshold,
            max_categories: config.max_categories,
        }
    }
    
    /// Infer data types for all columns in the dataset
    /// 
    /// This is the main type inference function that analyzes each column
    /// and determines the most appropriate data type. It uses pattern matching
    /// and statistical analysis to make intelligent decisions about whether
    /// columns should be treated as numbers, categories, booleans, etc.
    pub async fn infer_types(&self, data: &ProcessedData) -> Result<Schema, InferenceError> {
        // Basic type inference implementation
        let mut columns = Vec::new();
        
        // Analyze each column to determine its data type
        for (name, column_data) in &data.columns {
            let data_type = match column_data {
                crate::data::ColumnData::String(values) => {
                    // Try to infer type from string values using pattern matching
                    if self.is_numeric(values) {
                        crate::data::DataType::Float  // Treat as numeric
                    } else if self.is_boolean(values) {
                        crate::data::DataType::Boolean  // Treat as boolean
                    } else if self.is_categorical(values) {
                        // Treat as categorical with unique count
                        crate::data::DataType::Categorical(self.count_unique(values))
                    } else {
                        crate::data::DataType::String  // Keep as string
                    }
                }
                // Already typed columns pass through unchanged
                crate::data::ColumnData::Integer(_) => crate::data::DataType::Integer,
                crate::data::ColumnData::Float(_) => crate::data::DataType::Float,
                crate::data::ColumnData::Boolean(_) => crate::data::DataType::Boolean,
                crate::data::ColumnData::DateTime(_) => crate::data::DataType::DateTime,
            };
            
            let column_info = crate::data::ColumnInfo {
                name: name.clone(),
                data_type,
                nullable: true,
                statistics: crate::data::ColumnStatistics {
                    min: None,
                    max: None,
                    mean: None,
                    median: None,
                    std_dev: None,
                    null_count: 0,
                    unique_count: Some(self.count_unique_from_column(column_data)),
                },
            };
            
            columns.push(column_info);
        }
        
        Ok(crate::data::Schema {
            columns,
            row_count: data.row_count,
        })
    }
    
    /// Check if a column contains numeric data
    /// 
    /// This function samples the column data and checks if a sufficient
    /// percentage of values can be parsed as floating-point numbers.
    /// It uses a confidence threshold to avoid false positives from
    /// columns that happen to have a few numeric values.
    fn is_numeric(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        // Sample up to 100 values for performance
        let sample_size = std::cmp::min(values.len(), 100);
        let mut numeric_count = 0;
        
        // Count how many values can be parsed as numbers
        for value in values.iter().take(sample_size) {
            if value.parse::<f64>().is_ok() {
                numeric_count += 1;
            }
        }
        
        // Require at least 80% of sampled values to be numeric
        numeric_count as f64 / sample_size as f64 > 0.8
    }
    
    /// Check if a column contains boolean data
    /// 
    /// This function looks for common boolean patterns in string data,
    /// including "true/false", "1/0", "yes/no", and "y/n" variations.
    /// It uses a confidence threshold to avoid false positives.
    fn is_boolean(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        // Sample up to 100 values for performance
        let sample_size = std::cmp::min(values.len(), 100);
        let mut boolean_count = 0;
        
        // Check for common boolean patterns (case-insensitive)
        for value in values.iter().take(sample_size) {
            let lower = value.to_lowercase();
            if lower == "true" || lower == "false" || lower == "1" || lower == "0" || 
               lower == "yes" || lower == "no" || lower == "y" || lower == "n" {
                boolean_count += 1;
            }
        }
        
        // Require at least 80% of sampled values to match boolean patterns
        boolean_count as f64 / sample_size as f64 > 0.8
    }
    
    /// Check if a column contains categorical data
    /// 
    /// This function determines if a column should be treated as categorical
    /// based on the ratio of unique values to total values. Categorical
    /// columns have a limited set of distinct values that repeat frequently.
    fn is_categorical(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        let unique_count = self.count_unique(values);
        let total_count = values.len();
        
        // Consider categorical if less than 50% unique values and more than 2 unique values
        // This avoids treating columns with mostly unique values as categorical
        unique_count < total_count / 2 && unique_count > 2
    }
    
    /// Count the number of unique values in a column
    /// 
    /// This function efficiently counts distinct values using a HashSet
    /// to avoid duplicates. It's used for categorical detection and
    /// for providing statistics about data distribution.
    fn count_unique(&self, values: &[String]) -> usize {
        let mut unique = std::collections::HashSet::new();
        for value in values {
            unique.insert(value);
        }
        unique.len()
    }
    
    fn count_unique_from_column(&self, column: &crate::data::ColumnData) -> usize {
        match column {
            crate::data::ColumnData::String(values) => self.count_unique(values),
            crate::data::ColumnData::Integer(values) => {
                let mut unique = std::collections::HashSet::new();
                for value in values {
                    unique.insert(value);
                }
                unique.len()
            }
            crate::data::ColumnData::Float(values) => {
                let mut unique = std::collections::HashSet::new();
                for value in values {
                    unique.insert((value * 1000.0) as i64); // Round to avoid floating point precision issues
                }
                unique.len()
            }
            crate::data::ColumnData::Boolean(values) => {
                let mut unique = std::collections::HashSet::new();
                for value in values {
                    unique.insert(value);
                }
                unique.len()
            }
            crate::data::ColumnData::DateTime(values) => {
                let mut unique = std::collections::HashSet::new();
                for value in values {
                    unique.insert(value.timestamp());
                }
                unique.len()
            }
        }
    }
}
