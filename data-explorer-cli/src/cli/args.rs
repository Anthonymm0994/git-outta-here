//! Command line argument parsing using clap
//! 
//! This module defines the CLI interface for the data explorer tool.
//! It uses clap for robust argument parsing with automatic help generation,
//! validation, and error messages.

use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// Main CLI structure that defines the top-level command interface
/// 
/// This struct represents the root command and contains global options
/// that apply to all subcommands. The actual functionality is delegated
/// to subcommands defined in the Commands enum.
#[derive(Parser)]
#[command(name = "data-explorer")]
#[command(about = "Generate self-contained HTML data visualizations from CSV/Parquet files")]
#[command(version)]
pub struct Cli {
    /// The subcommand to execute (process, help, etc.)
    #[command(subcommand)]
    pub command: Commands,
    
    /// Enable verbose output for debugging and detailed progress information
    #[arg(short, long, global = true)]
    pub verbose: bool,
    
    /// Optional configuration file path for custom processing settings
    /// If not provided, default configuration is used
    #[arg(short, long, global = true)]
    pub config: Option<PathBuf>,
}

/// Available subcommands for the data explorer CLI
/// 
/// Each variant represents a different operation the tool can perform.
/// Currently only the Process command is implemented, but this structure
/// allows for easy extension with additional commands like batch processing,
/// configuration management, or data validation.
#[derive(Subcommand)]
pub enum Commands {
    /// Process a single file and generate interactive HTML visualization
    /// 
    /// This is the main command that takes a CSV or Parquet file, processes it,
    /// and generates a self-contained HTML file with interactive charts.
    /// The generated HTML can be opened in any web browser and provides
    /// the same interactive experience as the original data_explorer.html.
    Process {
        /// Input file path (CSV or Parquet)
        /// The tool will automatically detect the file format and use appropriate parser
        input: PathBuf,
        /// Output HTML file path where the interactive visualization will be saved
        /// The file will be completely self-contained with embedded data
        output: PathBuf,
        /// Columns to include in visualization (if not specified, all columns are used)
        /// Can be specified multiple times: --columns width --columns height --columns category
        #[arg(short = 'C', long)]
        columns: Vec<String>,
        /// Processing configuration file for custom settings
        /// If not provided, default configuration is used
        #[arg(short, long)]
        config: Option<PathBuf>,
    },
    /// Process multiple files in batch
    Batch {
        /// Input directory containing CSV/Parquet files
        input_dir: PathBuf,
        /// Output directory for HTML files
        output_dir: PathBuf,
        /// Processing configuration file
        #[arg(short, long)]
        config: Option<PathBuf>,
    },
    /// Analyze file and show schema information
    Analyze {
        /// Input file path
        input: PathBuf,
        /// Show detailed statistics
        #[arg(short, long)]
        detailed: bool,
    },
    /// Validate data quality
    Validate {
        /// Input file path
        input: PathBuf,
        /// Validation rules file
        #[arg(short, long)]
        rules: Option<PathBuf>,
    },
}
