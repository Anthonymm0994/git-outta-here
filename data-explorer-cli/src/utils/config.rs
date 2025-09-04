//! Configuration utilities

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub processing: crate::ProcessingConfig,
}
