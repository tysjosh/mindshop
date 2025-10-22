#!/bin/bash

# Deploy MindsDB RAG Monitoring Stack to EKS
# This script deploys Prometheus, Grafana, and CloudWatch integration

set -e

# Configuration
NAMESPACE="monitoring"
CLUSTER_NAME="${EKS_CLUSTER_NAME:-mindsdb-rag-cluster}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if connected to the right cluster
    CURRENT_CONTEXT=$(kubectl config current-context)
    if [[ ! "$CURRENT_CONTEXT" == *"$CLUSTER_NAME"* ]]; then
        log_warn "Current kubectl context: $CURRENT_CONTEXT"
        log_warn "Expected cluster name: $CLUSTER_NAME"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check if account ID is set
    if [ -z "$ACCOUNT_ID" ]; then
        log_error "AWS_ACCOUNT_ID environment variable is not set"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Create IAM role for CloudWatch exporter
create_cloudwatch_exporter_role() {
    log_info "Creating IAM role for CloudWatch exporter..."
    
    # Create trust policy
    cat > /tmp/cloudwatch-exporter-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/oidc.eks.${REGION}.amazonaws.com/id/$(aws eks describe-cluster --name ${CLUSTER_NAME} --query 'cluster.identity.oidc.issuer' --output text | cut -d'/' -f5)"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "oidc.eks.${REGION}.amazonaws.com/id/$(aws eks describe-cluster --name ${CLUSTER_NAME} --query 'cluster.identity.oidc.issuer' --output text | cut -d'/' -f5):sub": "system:serviceaccount:${NAMESPACE}:cloudwatch-exporter",
                    "oidc.eks.${REGION}.amazonaws.com/id/$(aws eks describe-cluster --name ${CLUSTER_NAME} --query 'cluster.identity.oidc.issuer' --output text | cut -d'/' -f5):aud": "sts.amazonaws.com"
                }
            }
        }
    ]
}
EOF

    # Create IAM role
    aws iam create-role \
        --role-name CloudWatchExporterRole \
        --assume-role-policy-document file:///tmp/cloudwatch-exporter-trust-policy.json \
        --description "Role for CloudWatch Exporter in EKS" || log_warn "Role may already exist"
    
    # Attach CloudWatch read policy
    aws iam attach-role-policy \
        --role-name CloudWatchExporterRole \
        --policy-arn arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess || log_warn "Policy may already be attached"
    
    log_info "CloudWatch exporter IAM role created"
}

# Update CloudWatch exporter configuration with account ID
update_cloudwatch_exporter_config() {
    log_info "Updating CloudWatch exporter configuration..."
    
    sed -i.bak "s/ACCOUNT_ID/${ACCOUNT_ID}/g" infrastructure/k8s/monitoring/cloudwatch-exporter.yaml
    
    log_info "CloudWatch exporter configuration updated"
}

# Deploy monitoring namespace
deploy_namespace() {
    log_info "Creating monitoring namespace..."
    kubectl apply -f infrastructure/k8s/monitoring/namespace.yaml
    log_info "Monitoring namespace created"
}

# Deploy Prometheus
deploy_prometheus() {
    log_info "Deploying Prometheus..."
    
    kubectl apply -f infrastructure/k8s/monitoring/prometheus-config.yaml
    kubectl apply -f infrastructure/k8s/monitoring/prometheus-deployment.yaml
    
    # Wait for Prometheus to be ready
    log_info "Waiting for Prometheus to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n monitoring
    
    log_info "Prometheus deployed successfully"
}

# Deploy Grafana
deploy_grafana() {
    log_info "Deploying Grafana..."
    
    kubectl apply -f infrastructure/k8s/monitoring/grafana-config.yaml
    kubectl apply -f infrastructure/k8s/monitoring/grafana-deployment.yaml
    
    # Wait for Grafana to be ready
    log_info "Waiting for Grafana to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/grafana -n monitoring
    
    log_info "Grafana deployed successfully"
}

# Deploy CloudWatch exporter
deploy_cloudwatch_exporter() {
    log_info "Deploying CloudWatch exporter..."
    
    kubectl apply -f infrastructure/k8s/monitoring/cloudwatch-exporter.yaml
    
    # Wait for CloudWatch exporter to be ready
    log_info "Waiting for CloudWatch exporter to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/cloudwatch-exporter -n monitoring
    
    log_info "CloudWatch exporter deployed successfully"
}

# Get access information
get_access_info() {
    log_info "Getting access information..."
    
    # Get Grafana LoadBalancer URL
    GRAFANA_URL=$(kubectl get svc grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if [ -n "$GRAFANA_URL" ]; then
        log_info "Grafana URL: http://${GRAFANA_URL}:3000"
        log_info "Grafana credentials: admin / admin123"
    else
        log_warn "Grafana LoadBalancer not ready yet. Check with: kubectl get svc grafana -n monitoring"
    fi
    
    # Get Prometheus service info
    log_info "Prometheus service: kubectl port-forward svc/prometheus 9090:9090 -n monitoring"
    
    # Show pod status
    log_info "Monitoring stack status:"
    kubectl get pods -n monitoring
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/cloudwatch-exporter-trust-policy.json
    rm -f infrastructure/k8s/monitoring/cloudwatch-exporter.yaml.bak
}

# Main deployment function
main() {
    log_info "Starting MindsDB RAG monitoring stack deployment..."
    
    check_prerequisites
    create_cloudwatch_exporter_role
    update_cloudwatch_exporter_config
    deploy_namespace
    deploy_prometheus
    deploy_grafana
    deploy_cloudwatch_exporter
    get_access_info
    cleanup
    
    log_info "Monitoring stack deployment completed successfully!"
    log_info "Next steps:"
    log_info "1. Access Grafana at the provided URL"
    log_info "2. Import additional dashboards as needed"
    log_info "3. Configure alerting rules in Prometheus"
    log_info "4. Set up notification channels in Grafana"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"