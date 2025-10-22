/**
 * AWS Step Functions State Machine Definition for Document Ingestion Pipeline
 * 
 * Workflow: S3 upload → PII sanitization → MindsDB embedding → Aurora insertion
 * 
 * This file contains the state machine definition and helper functions
 * for the document ingestion pipeline.
 */

export interface WorkflowInput {
  bucket: string;
  key: string;
  merchantId: string;
  contentType?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface WorkflowState {
  input: WorkflowInput;
  parsedDocument?: any;
  sanitizedDocument?: any;
  embedding?: number[];
  documentId?: string;
  error?: string;
  retryCount?: number;
}

/**
 * Step Functions State Machine Definition (JSON)
 * This would be deployed as an AWS Step Functions state machine
 */
export const documentIngestionStateMachine = {
  Comment: "Document Ingestion Pipeline with PII sanitization and embedding generation",
  StartAt: "ValidateInput",
  States: {
    ValidateInput: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${ValidateInputLambdaArn}",
        Payload: {
          "input.$": "$"
        }
      },
      ResultPath: "$.validation",
      Next: "DownloadAndParse",
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "HandleValidationError",
          ResultPath: "$.error"
        }
      ]
    },
    
    DownloadAndParse: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${DocumentParserLambdaArn}",
        Payload: {
          "bucket.$": "$.bucket",
          "key.$": "$.key",
          "merchantId.$": "$.merchantId",
          "contentType.$": "$.contentType",
          "metadata.$": "$.metadata"
        }
      },
      ResultPath: "$.parsedDocument",
      Next: "SanitizePII",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed", "Lambda.ServiceException"],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "HandleParsingError",
          ResultPath: "$.error"
        }
      ]
    },
    
    SanitizePII: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${PIISanitizationLambdaArn}",
        Payload: {
          "document.$": "$.parsedDocument.Payload",
          "merchantId.$": "$.merchantId"
        }
      },
      ResultPath: "$.sanitizedDocument",
      Next: "GenerateEmbedding",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed"],
          IntervalSeconds: 1,
          MaxAttempts: 2,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "HandleSanitizationError",
          ResultPath: "$.error"
        }
      ]
    },
    
    GenerateEmbedding: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${EmbeddingGenerationLambdaArn}",
        Payload: {
          "document.$": "$.sanitizedDocument.Payload",
          "merchantId.$": "$.merchantId"
        }
      },
      ResultPath: "$.embedding",
      Next: "StoreDocument",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed", "MindsDB.ServiceException"],
          IntervalSeconds: 5,
          MaxAttempts: 3,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "StoreDocumentWithoutEmbedding",
          ResultPath: "$.error"
        }
      ]
    },
    
    StoreDocument: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${DocumentStorageLambdaArn}",
        Payload: {
          "document.$": "$.sanitizedDocument.Payload",
          "embedding.$": "$.embedding.Payload",
          "merchantId.$": "$.merchantId",
          "sourceUri.$": "States.Format('s3://{}/{}', $.bucket, $.key)"
        }
      },
      ResultPath: "$.documentId",
      Next: "UpdateVectorIndex",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed", "Database.ConnectionException"],
          IntervalSeconds: 3,
          MaxAttempts: 3,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "HandleStorageError",
          ResultPath: "$.error"
        }
      ]
    },
    
    StoreDocumentWithoutEmbedding: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${DocumentStorageLambdaArn}",
        Payload: {
          "document.$": "$.sanitizedDocument.Payload",
          "embedding": [],
          "merchantId.$": "$.merchantId",
          "sourceUri.$": "States.Format('s3://{}/{}', $.bucket, $.key)",
          "embeddingFailed": true
        }
      },
      ResultPath: "$.documentId",
      Next: "LogEmbeddingFailure",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed"],
          IntervalSeconds: 3,
          MaxAttempts: 2,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "HandleStorageError",
          ResultPath: "$.error"
        }
      ]
    },
    
    UpdateVectorIndex: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${VectorIndexUpdateLambdaArn}",
        Payload: {
          "documentId.$": "$.documentId.Payload",
          "merchantId.$": "$.merchantId"
        }
      },
      ResultPath: "$.indexUpdate",
      Next: "SendSuccessNotification",
      Retry: [
        {
          ErrorEquals: ["States.TaskFailed"],
          IntervalSeconds: 2,
          MaxAttempts: 2,
          BackoffRate: 2.0
        }
      ],
      Catch: [
        {
          ErrorEquals: ["States.ALL"],
          Next: "LogIndexUpdateFailure",
          ResultPath: "$.error"
        }
      ]
    },
    
    LogEmbeddingFailure: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${AuditLogLambdaArn}",
        Payload: {
          "event": "embedding_generation_failed",
          "documentId.$": "$.documentId.Payload",
          "merchantId.$": "$.merchantId",
          "error.$": "$.error"
        }
      },
      Next: "PartialSuccessResult"
    },
    
    LogIndexUpdateFailure: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${AuditLogLambdaArn}",
        Payload: {
          "event": "vector_index_update_failed",
          "documentId.$": "$.documentId.Payload",
          "merchantId.$": "$.merchantId",
          "error.$": "$.error"
        }
      },
      Next: "PartialSuccessResult"
    },
    
    SendSuccessNotification: {
      Type: "Task",
      Resource: "arn:aws:states:::sns:publish",
      Parameters: {
        TopicArn: "${DocumentIngestionSuccessTopicArn}",
        Message: {
          "status": "success",
          "documentId.$": "$.documentId.Payload",
          "merchantId.$": "$.merchantId",
          "sourceUri.$": "States.Format('s3://{}/{}', $.bucket, $.key)",
          "timestamp.$": "$.timestamp"
        }
      },
      Next: "SuccessResult"
    },
    
    SuccessResult: {
      Type: "Pass",
      Result: {
        "status": "success",
        "message": "Document ingestion completed successfully"
      },
      ResultPath: "$.result",
      End: true
    },
    
    PartialSuccessResult: {
      Type: "Pass",
      Result: {
        "status": "partial_success",
        "message": "Document stored but some operations failed"
      },
      ResultPath: "$.result",
      End: true
    },
    
    HandleValidationError: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${ErrorHandlerLambdaArn}",
        Payload: {
          "errorType": "validation_error",
          "error.$": "$.error",
          "input.$": "$.input"
        }
      },
      Next: "FailureResult"
    },
    
    HandleParsingError: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${ErrorHandlerLambdaArn}",
        Payload: {
          "errorType": "parsing_error",
          "error.$": "$.error",
          "input.$": "$.input"
        }
      },
      Next: "FailureResult"
    },
    
    HandleSanitizationError: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${ErrorHandlerLambdaArn}",
        Payload: {
          "errorType": "sanitization_error",
          "error.$": "$.error",
          "input.$": "$.input"
        }
      },
      Next: "FailureResult"
    },
    
    HandleStorageError: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${ErrorHandlerLambdaArn}",
        Payload: {
          "errorType": "storage_error",
          "error.$": "$.error",
          "input.$": "$.input"
        }
      },
      Next: "FailureResult"
    },
    
    FailureResult: {
      Type: "Pass",
      Result: {
        "status": "failed",
        "message": "Document ingestion failed"
      },
      ResultPath: "$.result",
      End: true
    }
  }
};

/**
 * Batch processing state machine for handling multiple documents
 */
export const batchIngestionStateMachine = {
  Comment: "Batch Document Ingestion Pipeline",
  StartAt: "ProcessBatch",
  States: {
    ProcessBatch: {
      Type: "Map",
      ItemsPath: "$.documents",
      MaxConcurrency: 10,
      Iterator: {
        StartAt: "ProcessSingleDocument",
        States: {
          ProcessSingleDocument: {
            Type: "Task",
            Resource: "arn:aws:states:::states:startExecution.sync",
            Parameters: {
              StateMachineArn: "${DocumentIngestionStateMachineArn}",
              Input: {
                "bucket.$": "$.bucket",
                "key.$": "$.key",
                "merchantId.$": "$.merchantId",
                "contentType.$": "$.contentType",
                "metadata.$": "$.metadata",
                "timestamp.$": "$$.State.EnteredTime"
              }
            },
            End: true,
            Retry: [
              {
                ErrorEquals: ["States.ALL"],
                IntervalSeconds: 5,
                MaxAttempts: 2,
                BackoffRate: 2.0
              }
            ]
          }
        }
      },
      ResultPath: "$.results",
      Next: "GenerateBatchReport"
    },
    
    GenerateBatchReport: {
      Type: "Task",
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: "${BatchReportLambdaArn}",
        Payload: {
          "results.$": "$.results",
          "batchId.$": "$.batchId",
          "timestamp.$": "$$.State.EnteredTime"
        }
      },
      End: true
    }
  }
};

/**
 * Helper function to create Step Functions execution input
 */
export function createWorkflowInput(
  bucket: string,
  key: string,
  merchantId: string,
  contentType?: string,
  metadata?: Record<string, any>
): WorkflowInput {
  return {
    bucket,
    key,
    merchantId,
    contentType,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper function to validate workflow input
 */
export function validateWorkflowInput(input: WorkflowInput): void {
  if (!input.bucket || !input.key || !input.merchantId) {
    throw new Error('Missing required fields: bucket, key, or merchantId');
  }
  
  if (!input.merchantId.match(/^[a-zA-Z0-9_-]+$/)) {
    throw new Error('Invalid merchantId format');
  }
  
  if (input.key.includes('..') || input.key.startsWith('/')) {
    throw new Error('Invalid S3 key format');
  }
}

/**
 * Helper function to extract results from Step Functions execution
 */
export function extractWorkflowResult(executionOutput: any): {
  status: 'success' | 'partial_success' | 'failed';
  documentId?: string;
  error?: string;
  processingTime?: number;
} {
  if (!executionOutput || !executionOutput.result) {
    return { status: 'failed', error: 'No execution result' };
  }
  
  const result = executionOutput.result;
  
  return {
    status: result.status,
    documentId: executionOutput.documentId?.Payload,
    error: executionOutput.error?.Error || result.message,
    processingTime: executionOutput.processingTime,
  };
}

/**
 * CloudFormation template for deploying the Step Functions state machine
 */
export const stepFunctionsCloudFormationTemplate = {
  AWSTemplateFormatVersion: "2010-09-09",
  Description: "Document Ingestion Pipeline Step Functions State Machine",
  
  Parameters: {
    Environment: {
      Type: "String",
      Default: "dev",
      AllowedValues: ["dev", "staging", "prod"]
    },
    MerchantId: {
      Type: "String",
      Description: "Merchant ID for resource naming"
    }
  },
  
  Resources: {
    DocumentIngestionStateMachine: {
      Type: "AWS::StepFunctions::StateMachine",
      Properties: {
        StateMachineName: {
          "Fn::Sub": "document-ingestion-${Environment}-${MerchantId}"
        },
        DefinitionString: JSON.stringify(documentIngestionStateMachine),
        RoleArn: {
          "Fn::GetAtt": ["StepFunctionsExecutionRole", "Arn"]
        },
        Tags: [
          {
            Key: "Environment",
            Value: { Ref: "Environment" }
          },
          {
            Key: "MerchantId", 
            Value: { Ref: "MerchantId" }
          },
          {
            Key: "Service",
            Value: "document-ingestion"
          }
        ]
      }
    },
    
    BatchIngestionStateMachine: {
      Type: "AWS::StepFunctions::StateMachine",
      Properties: {
        StateMachineName: {
          "Fn::Sub": "batch-ingestion-${Environment}-${MerchantId}"
        },
        DefinitionString: JSON.stringify(batchIngestionStateMachine),
        RoleArn: {
          "Fn::GetAtt": ["StepFunctionsExecutionRole", "Arn"]
        }
      }
    },
    
    StepFunctionsExecutionRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "states.amazonaws.com"
              },
              Action: "sts:AssumeRole"
            }
          ]
        },
        Policies: [
          {
            PolicyName: "StepFunctionsExecutionPolicy",
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: [
                    "lambda:InvokeFunction",
                    "sns:Publish",
                    "states:StartExecution"
                  ],
                  Resource: "*"
                },
                {
                  Effect: "Allow",
                  Action: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                  ],
                  Resource: "arn:aws:logs:*:*:*"
                }
              ]
            }
          }
        ]
      }
    },
    
    DocumentIngestionSuccessTopic: {
      Type: "AWS::SNS::Topic",
      Properties: {
        TopicName: {
          "Fn::Sub": "document-ingestion-success-${Environment}-${MerchantId}"
        },
        DisplayName: "Document Ingestion Success Notifications"
      }
    }
  },
  
  Outputs: {
    DocumentIngestionStateMachineArn: {
      Description: "ARN of the Document Ingestion State Machine",
      Value: { Ref: "DocumentIngestionStateMachine" },
      Export: {
        Name: {
          "Fn::Sub": "${AWS::StackName}-DocumentIngestionStateMachineArn"
        }
      }
    },
    
    BatchIngestionStateMachineArn: {
      Description: "ARN of the Batch Ingestion State Machine", 
      Value: { Ref: "BatchIngestionStateMachine" },
      Export: {
        Name: {
          "Fn::Sub": "${AWS::StackName}-BatchIngestionStateMachineArn"
        }
      }
    },
    
    SuccessTopicArn: {
      Description: "ARN of the Success Notification Topic",
      Value: { Ref: "DocumentIngestionSuccessTopic" },
      Export: {
        Name: {
          "Fn::Sub": "${AWS::StackName}-SuccessTopicArn"
        }
      }
    }
  }
};