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

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    // Parse command line arguments
    let cli = Cli::parse();

    // Set up logging level based on verbose flag
    if cli.verbose {
        tracing_subscriber::fmt()
            .with_max_level(Level::DEBUG)
            .init();
    }

    info!("Data Explorer CLI starting...");

    // Load configuration
    let config = load_config(cli.config.as_ref()).await?;

    // Create command handler
    let handler = CommandHandler::new(config);

    // Execute command
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

async fn load_config(config_path: Option<&PathBuf>) -> Result<ProcessingConfig> {
    match config_path {
        Some(path) => {
            info!("Loading configuration from: {}", path.display());
            let config_content = std::fs::read_to_string(path)?;
            let config: ProcessingConfig = serde_json::from_str(&config_content)?;
            Ok(config)
        }
        None => {
            info!("Using default configuration");
            Ok(ProcessingConfig::default())
        }
    }
}