#!/bin/bash

# Data Explorer CLI - Comprehensive Test Suite
# This script tests all functionality of the Data Explorer CLI tool

set -e

echo "🚀 Data Explorer CLI - Comprehensive Test Suite"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="${3:-0}"
    
    echo -e "\n${BLUE}🧪 Testing: $test_name${NC}"
    echo "Command: $command"
    
    if eval "$command" > /dev/null 2>&1; then
        if [ $? -eq $expected_exit_code ]; then
            echo -e "${GREEN}✅ PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAILED (wrong exit code)${NC}"
            ((TESTS_FAILED++))
        fi
    else
        if [ $? -eq $expected_exit_code ]; then
            echo -e "${GREEN}✅ PASSED (expected failure)${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAILED${NC}"
            ((TESTS_FAILED++))
        fi
    fi
}

# Function to check file exists and has content
check_file() {
    local file_path="$1"
    local min_size="${2:-1000}"
    
    if [ -f "$file_path" ] && [ $(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null) -gt $min_size ]; then
        echo -e "${GREEN}✅ File exists and has content: $file_path${NC}"
        return 0
    else
        echo -e "${RED}❌ File missing or too small: $file_path${NC}"
        return 1
    fi
}

echo -e "\n${YELLOW}📋 Test Categories:${NC}"
echo "1. Basic CLI functionality"
echo "2. CSV processing and type inference"
echo "3. HTML generation with interactive charts"
echo "4. Column selection and filtering"
echo "5. Batch processing"
echo "6. File analysis and validation"
echo "7. Error handling"

# Clean up previous test outputs
echo -e "\n${YELLOW}🧹 Cleaning up previous test outputs...${NC}"
rm -rf out/test_*
mkdir -p out/test_results

echo -e "\n${YELLOW}🔧 Building the project...${NC}"
cargo build --release

# Test 1: Basic CLI functionality
echo -e "\n${YELLOW}1️⃣ Testing Basic CLI Functionality${NC}"

run_test "Help command" "cargo run -- --help"
run_test "Process help" "cargo run -- process --help"
run_test "Analyze help" "cargo run -- analyze --help"
run_test "Batch help" "cargo run -- batch --help"
run_test "Validate help" "cargo run -- validate --help"

# Test 2: CSV processing and type inference
echo -e "\n${YELLOW}2️⃣ Testing CSV Processing and Type Inference${NC}"

run_test "Process sample CSV (all columns)" "cargo run -- process tests/fixtures/sample_data.csv out/test_results/sample_all.html"
check_file "out/test_results/sample_all.html" 20000

run_test "Process large dataset CSV" "cargo run -- process tests/fixtures/large_dataset.csv out/test_results/large_all.html"
check_file "out/test_results/large_all.html" 20000

# Test 3: Column selection and filtering
echo -e "\n${YELLOW}3️⃣ Testing Column Selection and Filtering${NC}"

run_test "Process with selected columns (width, height, category)" "cargo run -- process tests/fixtures/sample_data.csv out/test_results/sample_selected.html --columns width --columns height --columns category"
check_file "out/test_results/sample_selected.html" 15000

run_test "Process with single column (category)" "cargo run -- process tests/fixtures/sample_data.csv out/test_results/sample_category_only.html --columns category"
check_file "out/test_results/sample_category_only.html" 10000

run_test "Process with numeric columns only" "cargo run -- process tests/fixtures/large_dataset.csv out/test_results/large_numeric.html --columns value_a --columns value_b --columns value_c"
check_file "out/test_results/large_numeric.html" 15000

# Test 4: File analysis
echo -e "\n${YELLOW}4️⃣ Testing File Analysis${NC}"

run_test "Analyze sample data (basic)" "cargo run -- analyze tests/fixtures/sample_data.csv"
run_test "Analyze sample data (detailed)" "cargo run -- analyze tests/fixtures/sample_data.csv --detailed"
run_test "Analyze large dataset (detailed)" "cargo run -- analyze tests/fixtures/large_dataset.csv --detailed"

# Test 5: Batch processing
echo -e "\n${YELLOW}5️⃣ Testing Batch Processing${NC}"

run_test "Batch process all fixtures" "cargo run -- batch tests/fixtures/ out/test_results/batch/"
check_file "out/test_results/batch/sample_data.html" 20000
check_file "out/test_results/batch/large_dataset.html" 20000

# Test 6: Error handling
echo -e "\n${YELLOW}6️⃣ Testing Error Handling${NC}"

run_test "Process non-existent file (should fail)" "cargo run -- process nonexistent.csv out/test_results/error.html" 1
run_test "Process with invalid columns (should fail)" "cargo run -- process tests/fixtures/sample_data.csv out/test_results/error.html --columns nonexistent_column" 1
run_test "Analyze non-existent file (should fail)" "cargo run -- analyze nonexistent.csv" 1

# Test 7: HTML content validation
echo -e "\n${YELLOW}7️⃣ Testing HTML Content Validation${NC}"

echo -e "\n${BLUE}🔍 Validating HTML content...${NC}"

# Check if HTML files contain expected elements
for html_file in out/test_results/*.html; do
    if [ -f "$html_file" ]; then
        echo "Checking $html_file..."
        
        # Check for basic HTML structure
        if grep -q "<!DOCTYPE html>" "$html_file" && \
           grep -q "<title>" "$html_file" && \
           grep -q "Data Explorer" "$html_file" && \
           grep -q "canvas" "$html_file" && \
           grep -q "embeddedData" "$html_file"; then
            echo -e "${GREEN}✅ HTML structure valid: $(basename "$html_file")${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ HTML structure invalid: $(basename "$html_file")${NC}"
            ((TESTS_FAILED++))
        fi
    fi
done

# Test 8: Performance testing
echo -e "\n${YELLOW}8️⃣ Testing Performance${NC}"

echo -e "\n${BLUE}⏱️ Performance benchmarks...${NC}"

# Time the processing of different file sizes
echo "Timing sample data processing..."
time_start=$(date +%s%N)
cargo run -- process tests/fixtures/sample_data.csv out/test_results/performance_sample.html > /dev/null 2>&1
time_end=$(date +%s%N)
sample_time=$(( (time_end - time_start) / 1000000 ))
echo -e "${GREEN}✅ Sample data processed in ${sample_time}ms${NC}"

echo "Timing large dataset processing..."
time_start=$(date +%s%N)
cargo run -- process tests/fixtures/large_dataset.csv out/test_results/performance_large.html > /dev/null 2>&1
time_end=$(date +%s%N)
large_time=$(( (time_end - time_start) / 1000000 ))
echo -e "${GREEN}✅ Large dataset processed in ${large_time}ms${NC}"

# Test 9: Type inference accuracy
echo -e "\n${YELLOW}9️⃣ Testing Type Inference Accuracy${NC}"

echo -e "\n${BLUE}🔍 Validating type inference...${NC}"

# Check if the analysis output contains expected types
analysis_output=$(cargo run -- analyze tests/fixtures/sample_data.csv --detailed 2>/dev/null)

if echo "$analysis_output" | grep -q "Type: Float" && \
   echo "$analysis_output" | grep -q "Type: Categorical" && \
   echo "$analysis_output" | grep -q "Type: Boolean"; then
    echo -e "${GREEN}✅ Type inference working correctly${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Type inference not working correctly${NC}"
    ((TESTS_FAILED++))
fi

# Final results
echo -e "\n${YELLOW}📊 Test Results Summary${NC}"
echo "=========================="
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"

total_tests=$((TESTS_PASSED + TESTS_FAILED))
if [ $total_tests -gt 0 ]; then
    success_rate=$(( (TESTS_PASSED * 100) / total_tests ))
    echo -e "${BLUE}📈 Success Rate: ${success_rate}%${NC}"
fi

echo -e "\n${YELLOW}📁 Generated Files:${NC}"
echo "==================="
ls -la out/test_results/

echo -e "\n${YELLOW}🎯 Test Files Ready for Manual Inspection:${NC}"
echo "=============================================="
echo "• out/test_results/sample_all.html - All columns from sample data"
echo "• out/test_results/sample_selected.html - Selected columns (width, height, category)"
echo "• out/test_results/sample_category_only.html - Category column only"
echo "• out/test_results/large_numeric.html - Numeric columns from large dataset"
echo "• out/test_results/batch/ - Batch processed files"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! The Data Explorer CLI is working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed. Please check the output above.${NC}"
    exit 1
fi
