//! Data Explorer CLI - Main entry point
//! 
//! A command-line tool for generating self-contained HTML data visualizations
//! from CSV and Parquet files.

use anyhow::Result;
use clap::Parser;
use data_explorer_cli::{
    cli::{Cli, Commands, CommandHandler},
    ProcessingConfig,
};
use std::path::PathBuf;
use tracing::{info, Level};
use tracing_subscriber;

/// Main entry point for the Data Explorer CLI
/// 
/// This function orchestrates the entire CLI application:
/// 1. Initializes logging and argument parsing
/// 2. Loads configuration (default or from file)
/// 3. Creates command handler with the configuration
/// 4. Executes the requested command
/// 5. Handles errors and provides user feedback
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging with INFO level by default
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    // Parse command line arguments using clap
    let cli = Cli::parse();

    // Set up debug logging if verbose flag is provided
    if cli.verbose {
        tracing_subscriber::fmt()
            .with_max_level(Level::DEBUG)
            .init();
    }

    info!("Data Explorer CLI starting...");

    // Load configuration from file or use defaults
    let config = load_config(cli.config.as_ref()).await?;

    // Create command handler with the loaded configuration
    let handler = CommandHandler::new(config);

    // Execute the requested command based on CLI arguments
    match cli.command {
        Commands::Process { input, output, columns, config: cmd_config } => {
            let config = if let Some(cmd_config) = cmd_config {
                load_config(Some(&cmd_config)).await?
            } else {
                handler.config().clone()
            };
            
            let handler = CommandHandler::new(config);
            handler.handle_process(input, output, columns).await?;
        }
        Commands::Batch { input_dir, output_dir, config: cmd_config } => {
            let config = if let Some(cmd_config) = cmd_config {
                load_config(Some(&cmd_config)).await?
            } else {
                handler.config().clone()
            };
            
            let handler = CommandHandler::new(config);
            handler.handle_batch(input_dir, output_dir).await?;
        }
        Commands::Analyze { input, detailed } => {
            handler.handle_analyze(input, detailed).await?;
        }
        Commands::Validate { input, rules } => {
            handler.handle_validate(input, rules).await?;
        }
    }

    info!("Data Explorer CLI completed successfully");
    Ok(())
}

/// Load configuration from file or return default configuration
/// 
/// This function handles configuration loading with fallback to defaults.
/// It reads a JSON configuration file if provided, or uses the built-in
/// default configuration. This allows users to customize processing behavior
/// without modifying the source code.
/// 
/// # Arguments
/// * `config_path` - Optional path to configuration file
/// 
/// # Returns
/// ProcessingConfig loaded from file or default configuration
async fn load_config(config_path: Option<&PathBuf>) -> Result<ProcessingConfig> {
    match config_path {
        Some(path) => {
            info!("Loading configuration from: {}", path.display());
            // Read configuration file as JSON
            let config_content = std::fs::read_to_string(path)?;
            let config: ProcessingConfig = serde_json::from_str(&config_content)?;
            Ok(config)
        }
        None => {
            info!("Using default configuration");
            // Use built-in default configuration
            Ok(ProcessingConfig::default())
        }
    }
}