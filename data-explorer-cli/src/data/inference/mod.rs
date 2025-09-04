//! Type inference module

use crate::data::{ProcessedData, Schema, ColumnInfo, DataType, ColumnStatistics};
use crate::ProcessingConfig;

#[derive(Debug, thiserror::Error)]
pub enum InferenceError {
    #[error("Type inference error: {0}")]
    InferenceError(String),
    
    #[error("Statistical analysis error: {0}")]
    StatisticalError(String),
}

pub struct TypeInferenceEngine {
    sample_size: usize,
    confidence_threshold: f64,
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
    
    pub async fn infer_types(&self, data: &ProcessedData) -> Result<Schema, InferenceError> {
        // Basic type inference implementation
        let mut columns = Vec::new();
        
        for (name, column_data) in &data.columns {
            let data_type = match column_data {
                crate::data::ColumnData::String(values) => {
                    // Try to infer type from string values
                    if self.is_numeric(values) {
                        crate::data::DataType::Float
                    } else if self.is_boolean(values) {
                        crate::data::DataType::Boolean
                    } else if self.is_categorical(values) {
                        crate::data::DataType::Categorical(self.count_unique(values))
                    } else {
                        crate::data::DataType::String
                    }
                }
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
    
    fn is_numeric(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        let sample_size = std::cmp::min(values.len(), 100);
        let mut numeric_count = 0;
        
        for value in values.iter().take(sample_size) {
            if value.parse::<f64>().is_ok() {
                numeric_count += 1;
            }
        }
        
        numeric_count as f64 / sample_size as f64 > 0.8
    }
    
    fn is_boolean(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        let sample_size = std::cmp::min(values.len(), 100);
        let mut boolean_count = 0;
        
        for value in values.iter().take(sample_size) {
            let lower = value.to_lowercase();
            if lower == "true" || lower == "false" || lower == "1" || lower == "0" || 
               lower == "yes" || lower == "no" || lower == "y" || lower == "n" {
                boolean_count += 1;
            }
        }
        
        boolean_count as f64 / sample_size as f64 > 0.8
    }
    
    fn is_categorical(&self, values: &[String]) -> bool {
        if values.is_empty() {
            return false;
        }
        
        let unique_count = self.count_unique(values);
        let total_count = values.len();
        
        // Consider categorical if less than 50% unique values and more than 2 unique values
        unique_count < total_count / 2 && unique_count > 2
    }
    
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
