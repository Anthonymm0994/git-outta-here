//! CSV file reading and parsing

use super::FileReader;
use crate::data::{ProcessedData, Schema, ColumnInfo, ColumnData, DataType, ColumnStatistics, DataMetadata};
use std::path::Path;
use std::collections::HashMap;
use chrono::Utc;

#[derive(Debug, Clone)]
pub struct CsvConfig {
    pub delimiter: u8,
    pub has_headers: bool,
    pub quote_char: u8,
    pub escape_char: Option<u8>,
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

#[derive(Debug, thiserror::Error)]
pub enum CsvError {
    #[error("CSV parsing error: {0}")]
    ParseError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("CSV error: {0}")]
    CsvError(#[from] csv::Error),
    
    #[error("Encoding error: {0}")]
    EncodingError(String),
}

pub struct CsvReader {
    config: CsvConfig,
}

impl FileReader for CsvReader {
    type Config = CsvConfig;
    type Error = CsvError;
    
    fn new(config: Self::Config) -> Self {
        Self { config }
    }
    
    async fn read_file(&self, path: &Path) -> Result<ProcessedData, Self::Error> {
        let file_content = std::fs::read_to_string(path)?;
        self.parse_csv_content(&file_content, path)
    }
}

impl CsvReader {
    fn parse_csv_content(&self, content: &str, path: &Path) -> Result<ProcessedData, CsvError> {
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(self.config.delimiter)
            .has_headers(self.config.has_headers)
            .quote(self.config.quote_char)
            .escape(self.config.escape_char)
            .from_reader(content.as_bytes());
        
        let headers = if self.config.has_headers {
            reader.headers()?.clone()
        } else {
            // Generate default headers
            let first_record = reader.records().next()
                .ok_or_else(|| CsvError::ParseError("Empty CSV file".to_string()))??;
            (0..first_record.len())
                .map(|i| format!("column_{}", i))
                .collect::<Vec<_>>()
                .into()
        };
        
        let mut columns: HashMap<String, Vec<String>> = HashMap::new();
        for header in headers.iter() {
            columns.insert(header.to_string(), Vec::new());
        }
        
        let mut row_count = 0;
        for result in reader.records() {
            let record = result.map_err(|e| CsvError::ParseError(e.to_string()))?;
            
            if record.len() != headers.len() {
                return Err(CsvError::ParseError(
                    format!("Row {} has {} fields, expected {}", 
                           row_count + 1, record.len(), headers.len())
                ));
            }
            
            for (i, field) in record.iter().enumerate() {
                let header = &headers[i];
                columns.get_mut(header)
                    .ok_or_else(|| CsvError::ParseError("Header not found".to_string()))?
                    .push(field.to_string());
            }
            
            row_count += 1;
        }
        
        // Convert string columns to typed columns
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
    
    fn convert_to_typed_columns(&self, string_columns: HashMap<String, Vec<String>>) -> Result<HashMap<String, ColumnData>, CsvError> {
        let mut typed_columns = HashMap::new();
        
        for (name, values) in string_columns {
            // For now, keep everything as strings - type inference will handle conversion
            typed_columns.insert(name, ColumnData::String(values));
        }
        
        Ok(typed_columns)
    }
    
    fn create_schema(&self, columns: &HashMap<String, ColumnData>, row_count: usize) -> Schema {
        let column_infos = columns.iter()
            .map(|(name, _data)| {
                ColumnInfo {
                    name: name.clone(),
                    data_type: DataType::String, // Will be updated during type inference
                    nullable: true,
                    statistics: ColumnStatistics {
                        min: None,
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
