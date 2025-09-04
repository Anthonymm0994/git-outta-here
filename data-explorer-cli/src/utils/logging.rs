//! Logging utilities

use tracing_subscriber;

pub fn setup_logging(level: tracing::Level) {
    tracing_subscriber::fmt()
        .with_max_level(level)
        .init();
}
