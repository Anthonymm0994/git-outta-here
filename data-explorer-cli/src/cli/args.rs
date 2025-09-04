//! Command line argument parsing using clap

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "data-explorer")]
#[command(about = "Generate self-contained HTML data visualizations from CSV/Parquet files")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
    
    /// Enable verbose output
    #[arg(short, long, global = true)]
    pub verbose: bool,
    
    /// Configuration file path
    #[arg(short, long, global = true)]
    pub config: Option<PathBuf>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Process a single file and generate HTML
    Process {
        /// Input file path (CSV or Parquet)
        input: PathBuf,
        /// Output HTML file path
        output: PathBuf,
        /// Columns to include in visualization (if not specified, all columns are used)
        #[arg(short = 'C', long)]
        columns: Vec<String>,
        /// Processing configuration file
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
