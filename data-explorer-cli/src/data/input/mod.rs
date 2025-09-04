//! Input handling module
//! 
//! This module handles reading and parsing of input files in various formats.
//! It provides a unified interface for different file types (CSV, Parquet)
//! and automatic file format detection based on file extensions and content.

pub mod csv;
pub mod parquet;
pub mod detector;

pub use csv::{CsvReader, CsvConfig, CsvError};
pub use parquet::{ParquetReader, ParquetConfig, ParquetError};
pub use detector::{FileDetector, DetectionError};

use std::path::Path;

/// Input format configuration that specifies how to read different file types
/// 
/// This enum allows the system to configure different readers for different
/// file formats, each with their own specific settings and parameters.
#[derive(Debug, Clone)]
pub enum InputFormat {
    /// CSV file format with configurable delimiters, quotes, and encoding
    Csv(CsvConfig),
    /// Parquet file format with compression and schema settings
    Parquet(ParquetConfig),
}

/// Trait for reading and parsing files into ProcessedData
/// 
/// This trait provides a unified interface for different file readers,
/// allowing the system to handle multiple file formats through a common
/// API. Each implementation handles the specific requirements of its
/// file format while providing consistent output.
pub trait FileReader {
    /// Configuration type specific to this file reader
    type Config;
    /// Error type specific to this file reader
    type Error;
    
    /// Create a new file reader with the specified configuration
    fn new(config: Self::Config) -> Self;
    
    /// Read and parse a file into ProcessedData
    /// 
    /// This is the main method that reads a file from disk and converts it
    /// into the internal ProcessedData format. The implementation handles
    /// all format-specific parsing and type inference.
    async fn read_file(&self, path: &Path) -> Result<crate::data::ProcessedData, Self::Error>;
}
