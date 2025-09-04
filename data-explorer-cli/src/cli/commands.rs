//! Command handling for CLI operations

use crate::{DataProcessor, ProcessingConfig, ProcessingResult};
use anyhow::Result;
use std::path::PathBuf;
use tracing::{info, error, warn};

pub struct CommandHandler {
    processor: DataProcessor,
    config: ProcessingConfig,
}

impl CommandHandler {
    pub fn new(config: ProcessingConfig) -> Self {
        let processor = DataProcessor::new(config.clone());
        Self { processor, config }
    }

    pub fn config(&self) -> &ProcessingConfig {
        &self.config
    }

    pub async fn handle_process(&self, input: PathBuf, output: PathBuf, columns: Vec<String>) -> Result<()> {
        let start = std::time::Instant::now();
        
        info!("Processing file: {}", input.display());
        
        // Validate input file exists
        if !input.exists() {
            anyhow::bail!("Input file does not exist: {}", input.display());
        }

        // Create output directory if it doesn't exist
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Process file
        let result = self.processor.process_file(&input, &output, &columns).await?;
        
        let duration = start.elapsed();
        
        // Display results
        self.display_processing_results(&result, duration);
        
        info!("✅ Processing completed successfully!");
        Ok(())
    }

    pub async fn handle_batch(&self, input_dir: PathBuf, output_dir: PathBuf) -> Result<()> {
        info!("Starting batch processing...");
        
        // Validate input directory exists
        if !input_dir.exists() {
            anyhow::bail!("Input directory does not exist: {}", input_dir.display());
        }

        // Create output directory if it doesn't exist
        std::fs::create_dir_all(&output_dir)?;

        // Find input files
        let input_files = self.find_input_files(&input_dir)?;
        
        if input_files.is_empty() {
            warn!("No input files found in directory: {}", input_dir.display());
            return Ok(());
        }

        info!("Found {} files to process", input_files.len());

        let mut success_count = 0;
        let mut error_count = 0;

        for (i, input_file) in input_files.iter().enumerate() {
            let output_file = output_dir.join(
                input_file.file_stem().unwrap()
            ).with_extension("html");
            
            info!("Processing {}/{}: {}", i + 1, input_files.len(), input_file.display());
            
            match self.processor.process_file(input_file, &output_file, &[]).await {
                Ok(result) => {
                    success_count += 1;
                    info!("  ✅ Success: {} rows -> {:.2} MB", 
                          result.input_rows, 
                          result.output_size as f64 / 1024.0 / 1024.0);
                }
                Err(e) => {
                    error_count += 1;
                    error!("  ❌ Failed: {}", e);
                }
            }
        }
        
        info!("✅ Batch processing completed!");
        info!("  Success: {}", success_count);
        info!("  Errors: {}", error_count);
        
        Ok(())
    }

    pub async fn handle_analyze(&self, input: PathBuf, detailed: bool) -> Result<()> {
        info!("Analyzing file: {}", input.display());
        
        // Validate input file exists
        if !input.exists() {
            anyhow::bail!("Input file does not exist: {}", input.display());
        }

        // Read and analyze file
        let format = crate::data::input::FileDetector::detect_format(&input)?;
        let data = match format {
            crate::data::input::InputFormat::Csv(config) => {
                use crate::data::input::FileReader;
                let reader = crate::data::input::CsvReader::new(config);
                reader.read_file(&input).await?
            }
            crate::data::input::InputFormat::Parquet(config) => {
                use crate::data::input::FileReader;
                let reader = crate::data::input::ParquetReader::new(config);
                reader.read_file(&input).await?
            }
        };

        let schema = self.processor.type_inference.infer_types(&data).await?;
        
        // Display analysis results
        self.display_analysis_results(&input, &schema, detailed);
        
        Ok(())
    }

    pub async fn handle_validate(&self, input: PathBuf, rules: Option<PathBuf>) -> Result<()> {
        info!("Validating file: {}", input.display());
        
        // Validate input file exists
        if !input.exists() {
            anyhow::bail!("Input file does not exist: {}", input.display());
        }

        // Load validation rules if provided
        let mut validator = self.processor.validator.clone();
        if let Some(rules_path) = rules {
            let rules_content = std::fs::read_to_string(rules_path)?;
            let custom_rules: Vec<crate::data::validation::ValidationRule> = 
                serde_json::from_str(&rules_content)?;
            validator.add_custom_rules(custom_rules);
        }

        // Read and validate file
        let format = crate::data::input::FileDetector::detect_format(&input)?;
        let data = match format {
            crate::data::input::InputFormat::Csv(config) => {
                use crate::data::input::FileReader;
                let reader = crate::data::input::CsvReader::new(config);
                reader.read_file(&input).await?
            }
            crate::data::input::InputFormat::Parquet(config) => {
                use crate::data::input::FileReader;
                let reader = crate::data::input::ParquetReader::new(config);
                reader.read_file(&input).await?
            }
        };

        let schema = self.processor.type_inference.infer_types(&data).await?;
        let validation_result = validator.validate_and_clean(data, &schema).await?;
        
        // Display validation results
        self.display_validation_results(&validation_result.quality_report);
        
        Ok(())
    }

    fn find_input_files(&self, input_dir: &PathBuf) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();
        
        for entry in std::fs::read_dir(input_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if extension == "csv" || extension == "parquet" {
                        files.push(path);
                    }
                }
            }
        }
        
        files.sort();
        Ok(files)
    }

    fn display_processing_results(&self, result: &ProcessingResult, duration: std::time::Duration) {
        println!("\n📊 Processing Results:");
        println!("  Input rows: {}", result.input_rows);
        println!("  Output size: {:.2} MB", result.output_size as f64 / 1024.0 / 1024.0);
        println!("  Processing time: {:.2}s", duration.as_secs_f64());
        println!("  Quality score: {:.1}%", result.data_quality.quality_score() * 100.0);
        
        if result.data_quality.invalid_rows > 0 {
            println!("  ⚠️  Invalid rows: {}", result.data_quality.invalid_rows);
        }
        
        if result.data_quality.missing_values > 0 {
            println!("  ⚠️  Missing values: {}", result.data_quality.missing_values);
        }
    }

    fn display_analysis_results(&self, input: &PathBuf, schema: &crate::Schema, detailed: bool) {
        println!("\n📋 File Analysis: {}", input.display());
        println!("  Rows: {}", schema.row_count);
        println!("  Columns: {}", schema.columns.len());
        
        for column in &schema.columns {
            println!("\n  Column: {}", column.name);
            println!("    Type: {:?}", column.data_type);
            println!("    Nullable: {}", column.nullable);
            
            if detailed {
                println!("    Statistics: {:?}", column.statistics);
            }
        }
    }

    fn display_validation_results(&self, quality_report: &crate::DataQualityReport) {
        println!("\n✅ Validation Results:");
        println!("  Total rows: {}", quality_report.total_rows);
        println!("  Valid rows: {}", quality_report.valid_rows);
        println!("  Invalid rows: {}", quality_report.invalid_rows);
        println!("  Missing values: {}", quality_report.missing_values);
        println!("  Type errors: {}", quality_report.type_errors);
        println!("  Validation errors: {}", quality_report.validation_errors);
        println!("  Quality score: {:.1}%", quality_report.quality_score() * 100.0);
        
        if quality_report.quality_score() < 0.8 {
            println!("  ⚠️  Data quality is below 80% - consider data cleaning");
        }
    }
}
