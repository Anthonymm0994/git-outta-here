//! File format detection
//! 
//! This module provides automatic detection of file formats based on
//! file extensions and content analysis. It determines the appropriate
//! reader and configuration for different input files.

use std::path::Path;
use super::{CsvConfig, ParquetConfig};

/// Errors that can occur during file format detection
/// 
/// These errors cover issues with file access, unknown formats,
/// and I/O problems during the detection process.
#[derive(Debug, thiserror::Error)]
pub enum DetectionError {
    /// The specified file does not exist
    #[error("File not found: {0}")]
    FileNotFound(String),
    
    /// The file format is not supported or cannot be determined
    #[error("Unknown file format: {0}")]
    UnknownFormat(String),
    
    /// I/O error occurred while accessing the file
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// File format detector that automatically determines input file types
/// 
/// This detector analyzes file extensions and content to determine
/// the appropriate file reader and configuration. It supports CSV
/// and Parquet formats with fallback to content analysis.
pub struct FileDetector;

impl FileDetector {
    /// Detect the file format and return appropriate configuration
    /// 
    /// This function uses a two-step process to determine file format:
    /// 1. First checks the file extension for quick identification
    /// 2. If extension is ambiguous or unknown, analyzes file content (magic bytes)
    /// 
    /// This approach provides both speed and accuracy, handling cases where
    /// files have incorrect extensions or no extensions at all.
    /// 
    /// # Arguments
    /// * `path` - Path to the file to analyze
    /// 
    /// # Returns
    /// InputFormat with appropriate configuration for the detected file type
    pub fn detect_format(path: &Path) -> Result<super::InputFormat, DetectionError> {
        // 1. Check file extension first (fastest method)
        if let Some(extension) = path.extension() {
            let ext_str = extension.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "csv" => {
                    return Ok(super::InputFormat::Csv(CsvConfig::default()));
                }
                "parquet" => {
                    return Ok(super::InputFormat::Parquet(ParquetConfig::default()));
                }
                _ => {
                    // Continue to magic bytes check for unknown extensions
                }
            }
        }
        
        // 2. Check magic bytes for more accurate detection
        if path.exists() {
            let mut file = std::fs::File::open(path)?;
            let mut header = [0u8; 16];
            std::io::Read::read_exact(&mut file, &mut header)?;
            
            // Check for Parquet magic bytes (PAR1 signature)
            if header.starts_with(b"PAR1") {
                return Ok(super::InputFormat::Parquet(ParquetConfig::default()));
            }
            
            // Check for CSV-like patterns (text with commas, quotes, etc.)
            if Self::looks_like_csv(&header) {
                return Ok(super::InputFormat::Csv(CsvConfig::default()));
            }
        }
        
        Err(DetectionError::UnknownFormat(
            path.to_string_lossy().to_string()
        ))
    }
    
    fn looks_like_csv(header: &[u8]) -> bool {
        // Simple heuristic: check if the first 16 bytes contain
        // mostly printable ASCII characters and common CSV delimiters
        let printable_count = header.iter()
            .filter(|&&b| b.is_ascii_graphic() || b.is_ascii_whitespace())
            .count();
        
        let delimiter_count = header.iter()
            .filter(|&&b| b == b',' || b == b';' || b == b'\t' || b == b'|')
            .count();
        
        // If more than 80% are printable and we have at least one delimiter
        printable_count as f64 / header.len() as f64 > 0.8 && delimiter_count > 0
    }
}
