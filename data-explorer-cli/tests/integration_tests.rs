//! Integration tests for the data explorer CLI

use std::process::Command;
use std::path::Path;

#[test]
fn test_cli_help() {
    let output = Command::new("cargo")
        .args(&["run", "--", "--help"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Process a single file and generate interactive HTML visualization"));
    assert!(stdout.contains("process"));
    assert!(stdout.contains("batch"));
}

#[test]
fn test_process_command_help() {
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "--help"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Process a single file"));
    assert!(stdout.contains("--columns"));
}

#[test]
fn test_process_sample_data() {
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "tests/fixtures/sample_data.csv", "out/test_integration.html", "--columns", "width"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    assert!(Path::new("out/test_integration.html").exists());
}

#[test]
fn test_process_invalid_column() {
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "tests/fixtures/sample_data.csv", "out/test_error.html", "--columns", "nonexistent"])
        .output()
        .expect("Failed to execute command");
    
    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("expected existing column, found column not found"));
}

#[test]
fn test_process_multiple_columns() {
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "tests/fixtures/sample_data.csv", "out/test_multi.html", "--columns", "width", "--columns", "height"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    assert!(Path::new("out/test_multi.html").exists());
}

#[test]
fn test_generated_html_contains_data() {
    // First generate the HTML
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "tests/fixtures/sample_data.csv", "out/test_data_check.html", "--columns", "width"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    
    // Check that the HTML file contains expected content
    let html_content = std::fs::read_to_string("out/test_data_check.html")
        .expect("Failed to read generated HTML");
    
    assert!(html_content.contains("width"));
    assert!(html_content.contains("Chart"));
    assert!(html_content.contains("Histogram"));
    assert!(html_content.contains("allData"));
}

#[test]
fn test_large_dataset_processing() {
    let output = Command::new("cargo")
        .args(&["run", "--", "process", "tests/fixtures/large_dataset.csv", "out/test_large_integration.html", "--columns", "value_a", "--columns", "category"])
        .output()
        .expect("Failed to execute command");
    
    assert!(output.status.success());
    assert!(Path::new("out/test_large_integration.html").exists());
    
    // Check that the HTML contains both chart types
    let html_content = std::fs::read_to_string("out/test_large_integration.html")
        .expect("Failed to read generated HTML");
    
    assert!(html_content.contains("value_a"));
    assert!(html_content.contains("category"));
    assert!(html_content.contains("Histogram"));
    assert!(html_content.contains("CategoryChart"));
}
