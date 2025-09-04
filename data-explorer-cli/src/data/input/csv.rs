//! CSV file reading and parsing
//! 
//! This module handles reading and parsing CSV files into the internal data format.
//! It provides robust CSV parsing with configurable delimiters, quote characters,
//! and encoding support. The parser automatically detects data types and handles
//! common CSV formatting issues.

use super::FileReader;
use crate::data::{ProcessedData, Schema, ColumnInfo, ColumnData, DataType, ColumnStatistics, DataMetadata};
use std::path::Path;
use std::collections::HashMap;
use chrono::Utc;

/// Configuration for CSV file parsing
/// 
/// This struct contains all the parameters needed to properly parse a CSV file.
/// It allows customization of common CSV formats and handles various edge cases
/// that can occur in real-world CSV files.
#[derive(Debug, Clone)]
pub struct CsvConfig {
    /// Character used to separate fields (comma, semicolon, tab, etc.)
    pub delimiter: u8,
    /// Whether the first row contains column headers
    pub has_headers: bool,
    /// Character used to quote fields containing special characters
    pub quote_char: u8,
    /// Character used to escape quotes within quoted fields
    pub escape_char: Option<u8>,
    /// Text encoding of the CSV file (utf-8, latin1, etc.)
    pub encoding: String,
}

impl Default for CsvConfig {
    fn default() -> Self {
        Self {
            delimiter: b',',
            has_headers: true,
            quote_char: b'"',
            escape_char: Some(b'\\'),
            encoding: "utf-8".to_string(),
        }
    }
}

/// Errors that can occur during CSV file processing
/// 
/// This enum covers all possible error conditions when reading and parsing
/// CSV files, including file I/O errors, parsing errors, and encoding issues.
#[derive(Debug, thiserror::Error)]
pub enum CsvError {
    /// General CSV parsing error with descriptive message
    #[error("CSV parsing error: {0}")]
    ParseError(String),
    
    /// File I/O error (file not found, permission denied, etc.)
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    /// Low-level CSV parsing error from the csv crate
    #[error("CSV error: {0}")]
    CsvError(#[from] csv::Error),
    
    /// Text encoding/decoding error
    #[error("Encoding error: {0}")]
    EncodingError(String),
}

/// CSV file reader that implements the FileReader trait
/// 
/// This struct handles the complete CSV reading pipeline:
/// 1. Reads the CSV file with the specified configuration
/// 2. Parses the CSV data into structured format
/// 3. Performs basic type inference on each column
/// 4. Returns ProcessedData ready for further processing
pub struct CsvReader {
    /// Configuration for CSV parsing behavior
    config: CsvConfig,
}

impl FileReader for CsvReader {
    type Config = CsvConfig;
    type Error = CsvError;
    
    fn new(config: Self::Config) -> Self {
        Self { config }
    }
    
    /// Read and parse a CSV file into ProcessedData
    /// 
    /// This is the main entry point for CSV processing. It reads the file
    /// from disk and delegates to parse_csv_content for the actual parsing.
    async fn read_file(&self, path: &Path) -> Result<ProcessedData, Self::Error> {
        // Read the entire file into memory as a string
        let file_content = std::fs::read_to_string(path)?;
        // Parse the CSV content using the configured settings
        self.parse_csv_content(&file_content, path)
    }
}

impl CsvReader {
    /// Parse CSV content into ProcessedData structure
    /// 
    /// This is the core CSV parsing function that:
    /// 1. Sets up the CSV reader with the configured parameters
    /// 2. Extracts or generates column headers
    /// 3. Reads all data rows and performs type inference
    /// 4. Creates the ProcessedData structure with schema and data
    fn parse_csv_content(&self, content: &str, path: &Path) -> Result<ProcessedData, CsvError> {
        // Configure CSV reader with the specified settings
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(self.config.delimiter)
            .has_headers(self.config.has_headers)
            .quote(self.config.quote_char)
            .escape(self.config.escape_char)
            .from_reader(content.as_bytes());
        
        // Extract column headers from CSV or generate default names
        let headers = if self.config.has_headers {
            reader.headers()?.clone()
        } else {
            // Generate default headers for CSV files without headers
            let first_record = reader.records().next()
                .ok_or_else(|| CsvError::ParseError("Empty CSV file".to_string()))??;
            (0..first_record.len())
                .map(|i| format!("column_{}", i))
                .collect::<Vec<_>>()
                .into()
        };
        
        // Initialize column storage - each column starts as a Vec<String>
        let mut columns: HashMap<String, Vec<String>> = HashMap::new();
        for header in headers.iter() {
            columns.insert(header.to_string(), Vec::new());
        }
        
        // Read all data rows from the CSV file
        let mut row_count = 0;
        for result in reader.records() {
            let record = result.map_err(|e| CsvError::ParseError(e.to_string()))?;
            
            // Validate that each row has the correct number of fields
            if record.len() != headers.len() {
                return Err(CsvError::ParseError(
                    format!("Row {} has {} fields, expected {}", 
                           row_count + 1, record.len(), headers.len())
                ));
            }
            
            // Store each field in its corresponding column
            for (i, field) in record.iter().enumerate() {
                let header = &headers[i];
                columns.get_mut(header)
                    .ok_or_else(|| CsvError::ParseError("Header not found".to_string()))?
                    .push(field.to_string());
            }
            
            row_count += 1;
        }
        
        // Convert string columns to typed columns (infer data types)
        let typed_columns = self.convert_to_typed_columns(columns)?;
        
        // Create schema
        let schema = self.create_schema(&typed_columns, row_count);
        
        // Create metadata
        let metadata = DataMetadata {
            source_file: path.to_string_lossy().to_string(),
            file_size: content.len() as u64,
            processing_timestamp: Utc::now(),
            format: "CSV".to_string(),
            encoding: self.config.encoding.clone(),
        };
        
        // Create quality report (basic for now)
        let quality_report = crate::DataQualityReport {
            total_rows: row_count,
            valid_rows: row_count, // Will be updated during validation
            invalid_rows: 0,
            missing_values: 0,
            type_errors: 0,
            validation_errors: 0,
        };
        
        Ok(ProcessedData {
            schema,
            columns: typed_columns,
            row_count,
            metadata,
            quality_report,
        })
    }
    
    /// Convert string columns to typed columns
    /// 
    /// This function takes the raw string data from CSV parsing and converts it
    /// to the typed ColumnData format. Currently, all data is kept as strings
    /// and type inference is handled later in the pipeline by the TypeInferenceEngine.
    /// This design allows for more sophisticated type inference based on the
    /// complete dataset rather than just individual values.
    fn convert_to_typed_columns(&self, string_columns: HashMap<String, Vec<String>>) -> Result<HashMap<String, ColumnData>, CsvError> {
        let mut typed_columns = HashMap::new();
        
        for (name, values) in string_columns {
            // For now, keep everything as strings - type inference will handle conversion
            // This allows the TypeInferenceEngine to analyze the complete column
            // and make better decisions about data types
            typed_columns.insert(name, ColumnData::String(values));
        }
        
        Ok(typed_columns)
    }
    
    /// Create schema information for the parsed data
    /// 
    /// This function creates the Schema structure that describes the structure
    /// of the parsed data. At this stage, all columns are treated as strings
    /// since type inference happens later in the pipeline. The schema will
    /// be updated with proper types and statistics after type inference.
    fn create_schema(&self, columns: &HashMap<String, ColumnData>, row_count: usize) -> Schema {
        let column_infos = columns.iter()
            .map(|(name, _data)| {
                ColumnInfo {
                    name: name.clone(),
                    data_type: DataType::String, // Will be updated during type inference
                    nullable: true,  // Assume nullable until validation
                    statistics: ColumnStatistics {
                        min: None,  // Will be calculated during type inference
                        max: None,
                        mean: None,
                        median: None,
                        std_dev: None,
                        null_count: 0,
                        unique_count: None,
                    },
                }
            })
            .collect();
        
        Schema {
            columns: column_infos,
            row_count,
        }
    }
}
