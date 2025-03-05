#!/bin/bash

# Hard-coded root directory - adjust this to your project root
ROOT_DIR="/home/dtb/0-dev/2github/funk"
# Output directory
OUTPUT_DIR="${ROOT_DIR}/z_sources"

# Function to check if a file is binary
is_binary() {
    local file="$1"
    if file -b --mime-encoding "$file" | grep -qE '^binary$'; then
        return 0
    else
        return 1
    fi
}

# Function to process files
process_file() {
    local file="$1"
    local output_file="$2"
    local base_path="$3"
    local relative_path="${file#$base_path/}"
    
    # Skip binary files
    if is_binary "$file"; then
        echo "Skipping binary file: $relative_path"
        return
    fi
    
    # Append the file path and content to the output file
    echo "## $relative_path" >> "$output_file"
    echo '```' >> "$output_file"
    cat "$file" >> "$output_file"
    echo '```' >> "$output_file"
    echo "" >> "$output_file"  # Add an empty line for readability
}

# Clean up and recreate output directory
echo "Cleaning up old z_sources directory..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Process Nuxt.js project directory
echo "Processing Nuxt.js project directory..."
NUXT_OUTPUT="${OUTPUT_DIR}/nuxt_sources.md"
> "$NUXT_OUTPUT"  # Clear/create the file

find "$ROOT_DIR" -type f \
    ! -path "*/node_modules/*" \
    ! -path "*/.nuxt/*" \
    ! -path "*/.output/*" \
    ! -path "*/models/*" \
    ! -path "*/.git/*" \
    ! -path "*/todos/*" \
    ! -path "*/tests/*" \
    ! -path "*/scripts/legacy/*" \
    ! -path "*/refactor/*" \
    ! -path "*/__pycache__/*" \
    ! -path "*/lib/*" \
    ! -path "*/env/*" \
    ! -path "*/data/*" \
    ! -path "*/data-bkp/*" \
    ! -path "*/dist/*" \
    ! -name "*.pyc" \
    ! -name ".DS_Store" \
    ! -name "*.swp" \
    ! -name ".env" \
    ! -name ".env.*" \
    ! -name "*.jpg" \
    ! -name "*.jpeg" \
    ! -name "*.png" \
    ! -name "todo.md" \
    ! -name "*.gif" \
    ! -name "*.svg" \
    ! -name "*.ico" \
    ! -name "*.pdf" \
    ! -name "bun.lockb" \
    ! -name ".nuxt" \
    ! -name ".google.json" \
    ! -name "*.log" \
    -print0 | while IFS= read -r -d '' file; do
    # Check if file is in app, components, or specific Nuxt/config files
    if echo "$file" | grep -qE "/(app|components|pages|composables|stores|types|utils)/" || \
       echo "$file" | grep -qE "\.(ts|js|vue|json|yaml|md)$" || \
       echo "$file" | grep -qE "^(nuxt\.config\.|tsconfig\.|uno\.config\.)"; then
        process_file "$file" "$NUXT_OUTPUT" "$ROOT_DIR"
    fi
done

echo "Processing complete!"
echo "Nuxt sources saved to: ${NUXT_OUTPUT}"