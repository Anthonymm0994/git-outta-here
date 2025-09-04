//! File format detection

use std::path::Path;
use super::{CsvConfig, ParquetConfig};

#[derive(Debug, thiserror::Error)]
pub enum DetectionError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    
    #[error("Unknown file format: {0}")]
    UnknownFormat(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

pub struct FileDetector;

impl FileDetector {
    pub fn detect_format(path: &Path) -> Result<super::InputFormat, DetectionError> {
        // 1. Check file extension first
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
                    // Continue to magic bytes check
                }
            }
        }
        
        // 2. Check magic bytes for more accurate detection
        if path.exists() {
            let mut file = std::fs::File::open(path)?;
            let mut header = [0u8; 16];
            std::io::Read::read_exact(&mut file, &mut header)?;
            
            // Check for Parquet magic bytes (PAR1)
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
