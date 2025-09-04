//! Parquet optimization module

use crate::data::ProcessedData;
use crate::ProcessingConfig;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum CompressionType {
    Snappy,    // Required for hyparquet compatibility
    Gzip,      // Supported by hyparquet
    Lz4,       // NOT supported by hyparquet
    Zstd,      // NOT supported by hyparquet
}

#[derive(Debug, thiserror::Error)]
pub enum OptimizationError {
    #[error("Parquet optimization error: {0}")]
    OptimizationError(String),
    
    #[error("Compression error: {0}")]
    CompressionError(String),
}

pub struct ParquetOptimizer {
    row_group_size: usize,
    compression: CompressionType,
    dictionary_threshold: f64,
}

impl ParquetOptimizer {
    pub fn new(config: &crate::OptimizationConfig) -> Self {
        Self {
            row_group_size: config.row_group_size,
            compression: config.compression.clone(),
            dictionary_threshold: config.dictionary_threshold,
        }
    }
    
    pub async fn optimize_for_browser(&self, data: &ProcessedData) -> Result<Vec<u8>, OptimizationError> {
        // For now, serialize the data as JSON and return as bytes
        // TODO: Implement actual Parquet optimization logic
        
        let json_data = serde_json::to_string(data)
            .map_err(|e| OptimizationError::OptimizationError(format!("JSON serialization failed: {}", e)))?;
        
        Ok(json_data.into_bytes())
    }
}
