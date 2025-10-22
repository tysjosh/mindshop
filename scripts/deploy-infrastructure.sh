#!/bin/bash

# MindsDB RAG Assistant Infrastructure Deployment Script
# This script deploys the complete AWS infrastructure including all missing components

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
DR_REGION=${DR_REGION:-us-west-2}
ALERT_EMAIL=${ALERT_EMAIL:-admin@example.com}
SECURITY_ALERT_EMAIL=${SECURITY_ALERT_EMAIL:-security@example.com}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check CDK CLI
    if ! command -v cdk &> /dev/null; then
        error "AWS CDK CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Build Lambda functions
build_lambda_functions() {
    log "Building Lambda functions..."
    
    cd "$(dirname "$0")/.."
    
    # Install dependencies
    npm install
    
    # Build TypeScript
    npm run build
    
    # Verify Lambda functions are built
    if [ ! -d "dist/lambda" ]; then
        error "Lambda functions not built. Please check the build process."
        exit 1
    fi
    
    success "Lambda functions built successfully"
}

# Bootstrap CDK (if needed)
bootstrap_cdk() {
    log "Bootstrapping CDK..."
    
    cd infrastructure/cdk
    
    # Install CDK dependencies
    npm install
    
    # Bootstrap primary region
    cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/${AWS_REGION} \
        --context environment=${ENVIRONMENT}
    
    # Bootstrap DR region if specified
    if [ -n "$DR_REGION" ] && [ "$DR_REGION" != "$AWS_REGION" ]; then
        log "Bootstrapping DR region: $DR_REGION"
        cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/${DR_REGION} \
            --context environment=${ENVIRONMENT}
    fi
    
    success "CDK bootstrap completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure..."
    
    cd infrastructure/cdk
    
    # Set environment variables
    export ENVIRONMENT=${ENVIRONMENT}
    export AWS_REGION=${AWS_REGION}
    export DR_REGION=${DR_REGION}
    export ALERT_EMAIL=${ALERT_EMAIL}
    export SECURITY_ALERT_EMAIL=${SECURITY_ALERT_EMAIL}
    
    # Deploy the main stack
    log "Deploying main MindsDB RAG stack..."
    cdk deploy mindsdb-rag-${ENVIRONMENT} \
        --context environment=${ENVIRONMENT} \
        --require-approval never \
        --outputs-file outputs.json
    
    if [ $? -eq 0 ]; then
        success "Infrastructure deployment completed successfully"
    else
        error "Infrastructure deployment failed"
        exit 1
    fi
}

# Validate deployment
validate_deployment() {
    log "Validating deployment..."
    
    cd infrastructure/cdk
    
    # Check if outputs file exists
    if [ ! -f "outputs.json" ]; then
        error "Deployment outputs not found"
        exit 1
    fi
    
    # Extract key outputs
    VPC_ID=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].VpcId' outputs.json)
    API_URL=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].ApiGatewayUrl' outputs.json)
    DB_ENDPOINT=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].DatabaseEndpoint' outputs.json)
    
    log "Deployment validation results:"
    log "  VPC ID: $VPC_ID"
    log "  API Gateway URL: $API_URL"
    log "  Database Endpoint: $DB_ENDPOINT"
    
    # Test API Gateway health endpoint
    if [ "$API_URL" != "null" ]; then
        log "Testing API Gateway health endpoint..."
        if curl -f -s "${API_URL}health" > /dev/null; then
            success "API Gateway health check passed"
        else
            warning "API Gateway health check failed (this may be expected if services are still starting)"
        fi
    fi
    
    success "Deployment validation completed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$(dirname "$0")/.."
    
    # Get database endpoint from CDK outputs
    DB_ENDPOINT=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].DatabaseEndpoint' infrastructure/cdk/outputs.json)
    
    if [ "$DB_ENDPOINT" != "null" ]; then
        # Set database connection environment variables
        export DB_HOST=$DB_ENDPOINT
        export DB_PORT=5432
        export DB_NAME=mindsdb_rag
        export NODE_ENV=$ENVIRONMENT
        
        # Run migrations
        npm run db:migrate
        
        success "Database migrations completed"
    else
        warning "Database endpoint not found, skipping migrations"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring and alerting..."
    
    # The monitoring stack is already deployed as part of the main stack
    # Here we can add additional monitoring setup if needed
    
    log "Monitoring dashboard URL:"
    DASHBOARD_URL=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].DashboardUrl' infrastructure/cdk/outputs.json)
    log "  $DASHBOARD_URL"
    
    success "Monitoring setup completed"
}

# Test deployment
test_deployment() {
    log "Running deployment tests..."
    
    cd "$(dirname "$0")/.."
    
    # Run infrastructure tests
    npm run test:infrastructure
    
    # Run integration tests
    npm run test:integration
    
    success "Deployment tests completed"
}

# Main deployment function
main() {
    log "Starting MindsDB RAG Assistant infrastructure deployment"
    log "Environment: $ENVIRONMENT"
    log "Region: $AWS_REGION"
    log "DR Region: $DR_REGION"
    
    check_prerequisites
    build_lambda_functions
    bootstrap_cdk
    deploy_infrastructure
    validate_deployment
    run_migrations
    setup_monitoring
    
    if [ "$ENVIRONMENT" != "prod" ]; then
        test_deployment
    fi
    
    success "🎉 MindsDB RAG Assistant infrastructure deployment completed successfully!"
    
    log "Next steps:"
    log "1. Configure your application environment variables"
    log "2. Set up your MindsDB API keys in AWS Secrets Manager"
    log "3. Configure your payment gateway credentials"
    log "4. Test the complete system end-to-end"
    
    # Display important URLs and endpoints
    log ""
    log "Important endpoints:"
    API_URL=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].ApiGatewayUrl' infrastructure/cdk/outputs.json)
    DASHBOARD_URL=$(jq -r '.["mindsdb-rag-'${ENVIRONMENT}'"].DashboardUrl' infrastructure/cdk/outputs.json)
    
    log "  API Gateway: $API_URL"
    log "  Monitoring Dashboard: $DASHBOARD_URL"
    log "  Health Check: ${API_URL}health"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        validate_deployment
        ;;
    "test")
        test_deployment
        ;;
    "migrate")
        run_migrations
        ;;
    "destroy")
        log "Destroying infrastructure..."
        cd infrastructure/cdk
        cdk destroy mindsdb-rag-${ENVIRONMENT} --force
        success "Infrastructure destroyed"
        ;;
    *)
        echo "Usage: $0 [deploy|validate|test|migrate|destroy]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy the complete infrastructure (default)"
        echo "  validate - Validate existing deployment"
        echo "  test     - Run deployment tests"
        echo "  migrate  - Run database migrations"
        echo "  destroy  - Destroy the infrastructure"
        exit 1
        ;;
esac