//! Input handling module
//! 
//! This module handles reading and parsing of input files in various formats.

pub mod csv;
pub mod parquet;
pub mod detector;

pub use csv::{CsvReader, CsvConfig, CsvError};
pub use parquet::{ParquetReader, ParquetConfig, ParquetError};
pub use detector::{FileDetector, DetectionError};

use std::path::Path;

/// Input format configuration
#[derive(Debug, Clone)]
pub enum InputFormat {
    Csv(CsvConfig),
    Parquet(ParquetConfig),
}

/// File detection and reading trait
pub trait FileReader {
    type Config;
    type Error;
    
    fn new(config: Self::Config) -> Self;
    async fn read_file(&self, path: &Path) -> Result<crate::data::ProcessedData, Self::Error>;
}
