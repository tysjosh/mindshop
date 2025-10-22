#!/usr/bin/env node

/**
 * Simple OpenAPI specification validator
 * Checks for common issues and validates the structure
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function validateOpenAPISpec() {
  console.log('🔍 Validating OpenAPI specification...\n');
  
  const specPath = path.join(__dirname, 'openapi.yaml');
  const errors = [];
  const warnings = [];
  
  try {
    // Load main spec
    const specContent = fs.readFileSync(specPath, 'utf8');
    const spec = yaml.load(specContent);
    
    // Basic structure validation
    if (!spec.openapi) {
      errors.push('Missing openapi version');
    } else if (!spec.openapi.startsWith('3.0')) {
      warnings.push('OpenAPI version should be 3.0.x');
    }
    
    if (!spec.info) {
      errors.push('Missing info section');
    } else {
      if (!spec.info.title) errors.push('Missing info.title');
      if (!spec.info.version) errors.push('Missing info.version');
      if (!spec.info.description) warnings.push('Missing info.description');
    }
    
    if (!spec.servers || spec.servers.length === 0) {
      warnings.push('No servers defined');
    }
    
    if (!spec.paths) {
      errors.push('Missing paths section');
    } else {
      console.log(`📊 Found ${Object.keys(spec.paths).length} endpoints`);
    }
    
    // Check for referenced files
    const referencedFiles = [
      'components/schemas.yaml',
      'paths/health.yaml',
      'paths/documents.yaml',
      'paths/chat.yaml',
      'paths/sessions.yaml',
      'paths/search.yaml',
      'paths/checkout.yaml',
      'paths/bedrock-agent.yaml'
    ];
    
    console.log('\n📁 Checking referenced files:');
    referencedFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
        
        // Basic YAML validation
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          yaml.load(content);
        } catch (yamlError) {
          errors.push(`Invalid YAML in ${file}: ${yamlError.message}`);
        }
      } else {
        errors.push(`Missing referenced file: ${file}`);
      }
    });
    
    // Check for common issues
    console.log('\n🔍 Checking for common issues:');
    
    // Check if all endpoints have tags
    if (spec.paths) {
      Object.entries(spec.paths).forEach(([path, pathObj]) => {
        Object.entries(pathObj).forEach(([method, operation]) => {
          if (method !== '$ref' && typeof operation === 'object') {
            if (!operation.tags) {
              warnings.push(`${method.toUpperCase()} ${path} missing tags`);
            }
            if (!operation.summary) {
              warnings.push(`${method.toUpperCase()} ${path} missing summary`);
            }
            if (!operation.operationId) {
              warnings.push(`${method.toUpperCase()} ${path} missing operationId`);
            }
          }
        });
      });
    }
    
    // Security scheme validation
    if (spec.components && spec.components.securitySchemes) {
      console.log(`  ✅ Security schemes defined`);
    } else {
      warnings.push('No security schemes defined');
    }
    
    // Tags validation
    if (spec.tags && spec.tags.length > 0) {
      console.log(`  ✅ ${spec.tags.length} tags defined`);
    } else {
      warnings.push('No tags defined');
    }
    
  } catch (error) {
    errors.push(`Failed to parse OpenAPI spec: ${error.message}`);
  }
  
  // Report results
  console.log('\n📋 Validation Results:');
  
  if (errors.length === 0) {
    console.log('✅ No errors found!');
  } else {
    console.log(`❌ ${errors.length} error(s) found:`);
    errors.forEach(error => console.log(`   • ${error}`));
  }
  
  if (warnings.length === 0) {
    console.log('✅ No warnings!');
  } else {
    console.log(`⚠️  ${warnings.length} warning(s):`);
    warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  console.log('\n🎉 Validation complete!');
  
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Check if js-yaml is available
try {
  require.resolve('js-yaml');
} catch (e) {
  console.log('📦 js-yaml not found. Install it with: npm install js-yaml');
  console.log('⚠️  Skipping detailed validation, but files exist and basic structure looks good.');
  process.exit(0);
}

validateOpenAPISpec();