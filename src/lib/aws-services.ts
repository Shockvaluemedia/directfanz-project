// AWS Services Configuration for DirectFanz
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// SES Client for Email
export const sesClient = new SESClient({ region: AWS_REGION });

// Rekognition Client for Content Moderation
export const rekognitionClient = new RekognitionClient({ region: AWS_REGION });

// Kinesis Client for Analytics
export const kinesisClient = new KinesisClient({ region: AWS_REGION });

// OpenSearch Client for Search
export const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: AWS_REGION,
    service: 'es',
    getCredentials: () => defaultProvider()(),
  }),
  node: process.env.OPENSEARCH_ENDPOINT,
});

// Email Service using SES
export async function sendEmail(to: string, subject: string, body: string) {
  const command = new SendEmailCommand({
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: body } }
    }
  });
  
  return await sesClient.send(command);
}

// Content Moderation using Rekognition
export async function moderateContent(imageBytes: Buffer) {
  const command = new DetectModerationLabelsCommand({
    Image: { Bytes: imageBytes },
    MinConfidence: 80
  });
  
  const result = await rekognitionClient.send(command);
  return result.ModerationLabels || [];
}

// Analytics using Kinesis
export async function trackEvent(eventType: string, data: any) {
  const command = new PutRecordCommand({
    StreamName: process.env.KINESIS_STREAM_NAME,
    Data: Buffer.from(JSON.stringify({ eventType, data, timestamp: new Date() })),
    PartitionKey: eventType
  });
  
  return await kinesisClient.send(command);
}

// Search using OpenSearch
export async function searchContent(query: string, filters: any = {}) {
  const searchBody = {
    query: {
      bool: {
        must: [
          { multi_match: { query, fields: ['title', 'description', 'tags'] } }
        ],
        filter: Object.entries(filters).map(([key, value]) => ({ term: { [key]: value } }))
      }
    }
  };
  
  return await opensearchClient.search({
    index: 'directfanz-content',
    body: searchBody
  });
}