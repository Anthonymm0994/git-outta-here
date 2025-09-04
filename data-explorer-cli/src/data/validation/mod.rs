//! Data validation module

use crate::data::{ProcessedData, Schema, DataType};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ValidationRule {
    TypeRule { column: String, expected_type: DataType },
    RangeRule { column: String, min: f64, max: f64 },
    FormatRule { column: String, pattern: String },
    RequiredRule { column: String },
}

#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Type mismatch in column {column}: expected {expected}, found {actual}")]
    TypeMismatch { column: String, expected: String, actual: String },
    
    #[error("Value {value} out of range [{min}, {max}] in column {column}")]
    OutOfRange { column: String, value: f64, min: f64, max: f64 },
    
    #[error("Invalid format in column {column}: {value} does not match pattern {pattern}")]
    InvalidFormat { column: String, value: String, pattern: String },
}

#[derive(Clone)]
pub struct DataValidator {
    strict_type_enforcement: bool,
    custom_rules: Vec<ValidationRule>,
}

impl DataValidator {
    pub fn new(config: &crate::ValidationConfig) -> Self {
        Self {
            strict_type_enforcement: config.strict_type_enforcement,
            custom_rules: config.custom_rules.clone(),
        }
    }
    
    pub async fn validate_and_clean(&self, data: ProcessedData, _schema: &Schema) -> Result<ProcessedData, ValidationError> {
        // Placeholder implementation
        // TODO: Implement actual validation logic
        Ok(data)
    }
    
    pub fn add_custom_rules(&mut self, rules: Vec<ValidationRule>) {
        self.custom_rules.extend(rules);
    }
}
