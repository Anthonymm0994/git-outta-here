//! Output formatting utilities

use crate::{ProcessingResult, DataQualityReport};
use std::fmt;

pub struct OutputFormatter;

impl OutputFormatter {
    pub fn format_processing_result(result: &ProcessingResult) -> String {
        format!(
            "Processing completed successfully!\n\
             Input rows: {}\n\
             Output size: {:.2} MB\n\
             Processing time: {:.2}s\n\
             Quality score: {:.1}%",
            result.input_rows,
            result.output_size as f64 / 1024.0 / 1024.0,
            result.processing_time.as_secs_f64(),
            result.data_quality.quality_score() * 100.0
        )
    }

    pub fn format_quality_report(report: &DataQualityReport) -> String {
        format!(
            "Data Quality Report:\n\
             Total rows: {}\n\
             Valid rows: {}\n\
             Invalid rows: {}\n\
             Missing values: {}\n\
             Type errors: {}\n\
             Validation errors: {}\n\
             Quality score: {:.1}%",
            report.total_rows,
            report.valid_rows,
            report.invalid_rows,
            report.missing_values,
            report.type_errors,
            report.validation_errors,
            report.quality_score() * 100.0
        )
    }

    pub fn format_progress(current: usize, total: usize, item: &str) -> String {
        let percentage = (current as f64 / total as f64 * 100.0) as usize;
        format!("[{}/{}] {}% - {}", current, total, percentage, item)
    }
}

impl fmt::Display for ProcessingResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", OutputFormatter::format_processing_result(self))
    }
}

impl fmt::Display for DataQualityReport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", OutputFormatter::format_quality_report(self))
    }
}
