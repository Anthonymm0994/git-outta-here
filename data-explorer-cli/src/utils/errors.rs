//! Error handling utilities

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Application error: {0}")]
    ApplicationError(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
}
