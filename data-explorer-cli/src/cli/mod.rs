//! CLI module for Data Explorer
//! 
//! This module contains the command-line interface components including
//! argument parsing, command handling, and output formatting.

pub mod args;
pub mod commands;
pub mod output;

pub use args::{Cli, Commands};
pub use commands::CommandHandler;
pub use output::OutputFormatter;
