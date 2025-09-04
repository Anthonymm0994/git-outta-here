# Data Explorer CLI

A Rust command-line tool for generating self-contained HTML data visualizations from CSV and Parquet files.

## Features

- **CSV Processing**: Parse CSV files with automatic type inference
- **Type Inference**: Automatically detect numeric, categorical, boolean, and string types
- **HTML Generation**: Create self-contained HTML files with embedded data
- **CLI Interface**: Easy-to-use command-line interface with multiple commands

## Installation

```bash
git clone <repository-url>
cd data-explorer-cli
cargo build --release
```

## Usage

### Process a CSV file and generate HTML

```bash
cargo run -- process input.csv output.html
```

### Analyze a file and show schema information

```bash
cargo run -- analyze input.csv --detailed
```

### Validate data quality

```bash
cargo run -- validate input.csv
```

### Process multiple files in batch

```bash
cargo run -- batch input_dir/ output_dir/
```

## Example

```bash
# Process a CSV file
cargo run -- process test_data.csv output.html

# Analyze the file structure
cargo run -- analyze test_data.csv --detailed
```

## Architecture

The tool follows a modular architecture:

- **Input Layer**: Handles CSV/Parquet file reading and format detection
- **Processing Layer**: Type inference, validation, and data cleaning
- **Optimization Layer**: Data optimization for browser consumption
- **Output Layer**: HTML generation with embedded data

## Current Status

✅ **Working Features:**
- CSV file parsing
- Automatic type inference (numeric, categorical, boolean, string)
- HTML generation with embedded data
- CLI interface with multiple commands
- Data analysis and validation

🚧 **In Development:**
- Parquet file support
- Full hyparquet integration for browser data access
- Advanced visualization components
- Performance optimization for large datasets

## Output

The tool generates self-contained HTML files that include:
- Data statistics and schema information
- Embedded data (currently as JSON, future: optimized Parquet)
- Clean, responsive design
- Ready for browser visualization

## Future Plans

- **Tauri Integration**: Desktop application with GUI
- **Advanced Visualizations**: Interactive charts and graphs
- **Performance Optimization**: Handle datasets up to 10M+ rows
- **Parquet Support**: Native Parquet file processing
- **Browser Integration**: Full hyparquet integration for on-demand data access
