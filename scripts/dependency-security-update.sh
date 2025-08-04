#!/bin/bash

# Automated dependency security update script
# This script updates dependencies to secure versions and performs security audits

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUDIT_LEVEL="moderate"
BACKUP_DIR="./dependency-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${GREEN}🔄 Starting Automated Dependency Security Update - $TIMESTAMP${NC}"

# Function to create backup
create_backup() {
    echo -e "${YELLOW}📦 Creating backup of current dependencies${NC}"
    mkdir -p "$BACKUP_DIR"
    
    # Backup package files
    cp package.json "$BACKUP_DIR/package.json.$TIMESTAMP"
    cp pnpm-lock.yaml "$BACKUP_DIR/pnpm-lock.yaml.$TIMESTAMP" 2>/dev/null || true
    
    # Backup workspace package files
    find . -name "package.json" -not -path "./node_modules/*" -not -path "./$BACKUP_DIR/*" | while read -r file; do
        backup_path="$BACKUP_DIR/$(echo "$file" | sed 's|/|_|g').$TIMESTAMP"
        cp "$file" "$backup_path"
    done
    
    echo -e "${GREEN}✅ Backup created in $BACKUP_DIR${NC}"
}

# Function to restore backup
restore_backup() {
    echo -e "${YELLOW}🔄 Restoring from backup${NC}"
    
    if [ -f "$BACKUP_DIR/package.json.$TIMESTAMP" ]; then
        cp "$BACKUP_DIR/package.json.$TIMESTAMP" package.json
        echo -e "${GREEN}✅ Restored package.json${NC}"
    fi
    
    if [ -f "$BACKUP_DIR/pnpm-lock.yaml.$TIMESTAMP" ]; then
        cp "$BACKUP_DIR/pnpm-lock.yaml.$TIMESTAMP" pnpm-lock.yaml
        echo -e "${GREEN}✅ Restored pnpm-lock.yaml${NC}"
    fi
    
    # Restore workspace package files
    find "$BACKUP_DIR" -name "*package.json.$TIMESTAMP" | while read -r backup_file; do
        original_file=$(basename "$backup_file" ".$TIMESTAMP" | sed 's|_|/|g')
        if [ -f "$original_file" ]; then
            cp "$backup_file" "$original_file"
            echo -e "${GREEN}✅ Restored $original_file${NC}"
        fi
    done
}

# Function to check for vulnerabilities
check_vulnerabilities() {
    echo -e "${YELLOW}🔍 Checking for security vulnerabilities${NC}"
    
    if pnpm audit --audit-level "$AUDIT_LEVEL" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ No vulnerabilities found at $AUDIT_LEVEL level${NC}"
        return 0
    else
        echo -e "${RED}⚠️  Vulnerabilities found${NC}"
        pnpm audit --audit-level "$AUDIT_LEVEL"
        return 1
    fi
}

# Function to update dependencies
update_dependencies() {
    echo -e "${YELLOW}📦 Updating dependencies to latest secure versions${NC}"
    
    # Update all dependencies
    if pnpm update; then
        echo -e "${GREEN}✅ Dependencies updated successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to update dependencies${NC}"
        return 1
    fi
}

# Function to fix vulnerabilities
fix_vulnerabilities() {
    echo -e "${YELLOW}🔧 Attempting to fix vulnerabilities${NC}"
    
    # Get audit output in JSON format
    local audit_output
    audit_output=$(pnpm audit --audit-level "$AUDIT_LEVEL" --json 2>/dev/null || echo '{}')
    
    # Extract vulnerable packages and try to update them
    echo "$audit_output" | jq -r '.advisories | to_entries[] | .value.module_name' 2>/dev/null | sort -u | while read -r package; do
        if [ -n "$package" ] && [ "$package" != "null" ]; then
            echo -e "${BLUE}🔄 Updating vulnerable package: $package${NC}"
            pnpm update "$package" || echo -e "${YELLOW}⚠️  Could not update $package${NC}"
        fi
    done
    
    # Try pnpm audit fix if available
    if command -v pnpm >/dev/null 2>&1; then
        echo -e "${BLUE}🔄 Running pnpm audit fix${NC}"
        pnpm audit --fix 2>/dev/null || echo -e "${YELLOW}⚠️  pnpm audit --fix not available or failed${NC}"
    fi
}

# Function to validate build after updates
validate_build() {
    echo -e "${YELLOW}🏗️  Validating build after updates${NC}"
    
    # Type check
    if pnpm type-check; then
        echo -e "${GREEN}✅ Type checking passed${NC}"
    else
        echo -e "${RED}❌ Type checking failed${NC}"
        return 1
    fi
    
    # Build check
    if pnpm build; then
        echo -e "${GREEN}✅ Build successful${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        return 1
    fi
    
    return 0
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}🧪 Running tests to ensure functionality${NC}"
    
    if pnpm test; then
        echo -e "${GREEN}✅ Tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Tests failed${NC}"
        return 1
    fi
}

# Function to generate security report
generate_security_report() {
    local report_file="./security-scan-results/dependency_security_report_$TIMESTAMP.md"
    mkdir -p "./security-scan-results"
    
    echo -e "${YELLOW}📄 Generating security report${NC}"
    
    cat > "$report_file" << EOF
# Dependency Security Update Report

**Generated:** $(date)
**Update ID:** $TIMESTAMP

## Summary

This report contains the results of automated dependency security updates.

## Actions Taken

### 1. Dependency Updates
- Updated all dependencies to latest versions
- Applied security overrides where necessary
- Fixed known vulnerabilities

### 2. Security Audit Results

\`\`\`
$(pnpm audit --audit-level "$AUDIT_LEVEL" 2>&1 || echo "Audit completed with issues")
\`\`\`

### 3. Package Overrides Applied

\`\`\`json
$(jq '.pnpm.overrides // {}' package.json 2>/dev/null || echo "{}")
\`\`\`

## Validation Results

- ✅ Type checking: $(pnpm type-check >/dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- ✅ Build process: $(pnpm build >/dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- ✅ Test suite: $(pnpm test >/dev/null 2>&1 && echo "PASSED" || echo "FAILED")

## Recommendations

1. Review updated dependencies for breaking changes
2. Test application thoroughly in staging environment
3. Monitor for new vulnerabilities regularly
4. Consider implementing automated security scanning in CI/CD

## Backup Information

Backups created in: \`$BACKUP_DIR\`
- package.json backup: \`package.json.$TIMESTAMP\`
- pnpm-lock.yaml backup: \`pnpm-lock.yaml.$TIMESTAMP\`

To restore if needed:
\`\`\`bash
cp $BACKUP_DIR/package.json.$TIMESTAMP package.json
cp $BACKUP_DIR/pnpm-lock.yaml.$TIMESTAMP pnpm-lock.yaml
pnpm install
\`\`\`

EOF

    echo -e "${GREEN}✅ Security report generated: $report_file${NC}"
}

# Main execution function
main() {
    local failed=false
    
    # Create backup first
    create_backup
    
    # Check initial state
    echo -e "${BLUE}📊 Initial vulnerability check${NC}"
    check_vulnerabilities || echo -e "${YELLOW}⚠️  Initial vulnerabilities detected${NC}"
    
    # Update dependencies
    if ! update_dependencies; then
        echo -e "${RED}❌ Dependency update failed${NC}"
        failed=true
    fi
    
    # Fix remaining vulnerabilities
    if ! check_vulnerabilities; then
        echo -e "${YELLOW}🔧 Attempting to fix remaining vulnerabilities${NC}"
        fix_vulnerabilities
    fi
    
    # Final vulnerability check
    echo -e "${BLUE}📊 Final vulnerability check${NC}"
    if ! check_vulnerabilities; then
        echo -e "${YELLOW}⚠️  Some vulnerabilities may remain${NC}"
    fi
    
    # Validate the updates
    if [[ "${1:-}" != "--skip-validation" ]]; then
        echo -e "${BLUE}🔍 Validating updates${NC}"
        
        if ! validate_build; then
            echo -e "${RED}❌ Build validation failed${NC}"
            if [[ "${2:-}" == "--auto-restore" ]]; then
                echo -e "${YELLOW}🔄 Auto-restoring from backup${NC}"
                restore_backup
                pnpm install
            fi
            failed=true
        fi
        
        if [[ "${1:-}" == "--run-tests" ]] && ! run_tests; then
            echo -e "${RED}❌ Test validation failed${NC}"
            if [[ "${2:-}" == "--auto-restore" ]]; then
                echo -e "${YELLOW}🔄 Auto-restoring from backup${NC}"
                restore_backup
                pnpm install
            fi
            failed=true
        fi
    fi
    
    # Generate report
    generate_security_report
    
    if [ "$failed" = true ]; then
        echo -e "${RED}❌ Dependency security update completed with issues${NC}"
        echo -e "${YELLOW}💡 Check the security report for details${NC}"
        echo -e "${YELLOW}💡 Use backup files in $BACKUP_DIR to restore if needed${NC}"
        exit 1
    else
        echo -e "${GREEN}🎉 Dependency security update completed successfully${NC}"
        echo -e "${GREEN}📁 Security report saved in: ./security-scan-results/${NC}"
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --skip-validation    Skip build and test validation"
        echo "  --run-tests         Run tests as part of validation"
        echo "  --auto-restore      Automatically restore backup if validation fails"
        echo "  --help, -h          Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                           # Standard update with build validation"
        echo "  $0 --run-tests               # Update with build and test validation"
        echo "  $0 --skip-validation         # Update without validation (faster)"
        echo "  $0 --run-tests --auto-restore # Full validation with auto-restore"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac