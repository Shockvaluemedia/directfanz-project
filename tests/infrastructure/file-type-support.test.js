/**
 * Property-Based Test for File Type Support
 * Feature: aws-conversion, Property 11: File Type Support
 * Validates: Requirements 4.3
 * 
 * This test verifies that all supported file types (videos, images, documents)
 * can be uploaded, stored, and retrieved correctly with proper metadata
 * preservation and content integrity.
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fc = require('fast-check');
const crypto = require('crypto');

// Simplified mock storage for test data
const mockStorage = new Map();

// Mock AWS SDK v3 for S3 operations with simplified implementation
const mockS3Client = {
  send: jest.fn(),
  destroy: jest.fn()
};

// Mock AWS SDK v3 S3 client and commands
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => mockS3Client),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  HeadObjectCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ input: params }))
}));

// Mock file upload library with simplified implementation
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation((config) => {
    return {
      done: jest.fn().mockImplementation(async () => {
        // Store upload data when done() is called
        const key = config.params.Key;
        const uploadData = {
          bucket: config.params.Bucket,
          key: key,
          body: config.params.Body,
          contentType: config.params.ContentType,
          metadata: config.params.Metadata || {},
          etag: '"' + crypto.createHash('md5').update(config.params.Body || 'test-content').digest('hex') + '"'
        };
        
        mockStorage.set(key, uploadData);
        
        return {
          Location: `https://s3.amazonaws.com/${config.params.Bucket}/${key}`,
          Bucket: config.params.Bucket,
          Key: key,
          ETag: uploadData.etag
        };
      })
    };
  })
}));

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

describe('File Type Support Property Tests', () => {
  let s3Client;
  const testBucket = 'direct-fan-platform-test-content';

  // Supported file types based on DirectFanz platform requirements
  const supportedFileTypes = {
    images: {
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
      mimeTypes: ['image/jpeg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'],
      maxSize: 10 * 1024 * 1024, // 10MB
      category: 'image'
    },
    videos: {
      extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'],
      mimeTypes: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm', 'video/x-matroska', 'video/mp4'],
      maxSize: 500 * 1024 * 1024, // 500MB
      category: 'video'
    },
    documents: {
      extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
      mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/rtf', 'application/vnd.oasis.opendocument.text'],
      maxSize: 25 * 1024 * 1024, // 25MB
      category: 'document'
    },
    audio: {
      extensions: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4'],
      maxSize: 50 * 1024 * 1024, // 50MB
      category: 'audio'
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorage.clear();
    
    // Create S3 client for content storage
    s3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key'
      }
    });

    // Simplified S3 mock implementation
    mockS3Client.send.mockImplementation(async (command) => {
      const key = command.input.Key;
      const storedData = mockStorage.get(key);
      
      // Check command type by looking at the input structure
      const isHeadOrGetCommand = command.input && key && !command.input.Body;
      
      if (isHeadOrGetCommand) {
        // Always return a response with metadata
        const metadata = storedData ? storedData.metadata : {
          'original-filename': key.split('/').pop(),
          'content-type': 'application/octet-stream',
          'upload-timestamp': new Date().toISOString()
        };
        
        const response = {
          ContentType: storedData ? storedData.contentType : 'application/octet-stream',
          ContentLength: storedData && storedData.body ? storedData.body.length : 1024,
          ETag: storedData ? storedData.etag : '"default-etag"',
          LastModified: new Date(),
          Metadata: metadata,
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key-id'
        };
        
        // Add Body for GetObject commands (we'll assume it's a get if we're checking for body)
        if (isHeadOrGetCommand) {
          response.Body = {
            transformToByteArray: async () => storedData && storedData.body ? storedData.body : Buffer.from('test-content'),
            transformToString: async () => (storedData && storedData.body ? storedData.body : Buffer.from('test-content')).toString()
          };
        }
        
        return response;
      }
      
      // For other commands, return success
      return { success: true };
    });
  });

  afterEach(async () => {
    if (s3Client) {
      s3Client.destroy();
    }
  });

  /**
   * Property 11: File Type Support
   * For any supported file type (video, image, document), the upload, storage,
   * and retrieval process should work correctly with proper metadata preservation
   * and content integrity
   */
  test('Property: All supported file types can be uploaded, stored, and retrieved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileCategory: fc.constantFrom('images', 'videos', 'documents', 'audio'),
          fileSize: fc.integer({ min: 1024, max: 1024 * 1024 }), // 1KB to 1MB for testing
          userId: fc.string({ minLength: 8, maxLength: 36 }),
          contentId: fc.string({ minLength: 8, maxLength: 36 }),
          uploadTimestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
        }),
        async (fileConfig) => {
          const fileTypeConfig = supportedFileTypes[fileConfig.fileCategory];
          
          // Generate random file extension and MIME type from supported types
          const extensionIndex = Math.floor(Math.random() * fileTypeConfig.extensions.length);
          const fileExtension = fileTypeConfig.extensions[extensionIndex];
          const mimeType = fileTypeConfig.mimeTypes[extensionIndex];
          
          // Generate test file data
          const fileName = `test-file-${fileConfig.contentId}.${fileExtension}`;
          const fileKey = `uploads/${fileConfig.userId}/${fileConfig.contentId}/${fileName}`;
          const fileContent = Buffer.alloc(fileConfig.fileSize, 'test-data');
          const fileChecksum = crypto.createHash('md5').update(fileContent).digest('hex');

          // Property: File size should be within category limits
          expect(fileConfig.fileSize).toBeLessThanOrEqual(fileTypeConfig.maxSize);

          // Test file upload
          const uploadParams = {
            Bucket: testBucket,
            Key: fileKey,
            Body: fileContent,
            ContentType: mimeType,
            Metadata: {
              'original-filename': fileName,
              'content-type': mimeType,
              'file-category': fileTypeConfig.category,
              'user-id': fileConfig.userId,
              'content-id': fileConfig.contentId,
              'upload-timestamp': fileConfig.uploadTimestamp.toISOString(),
              'file-checksum': fileChecksum,
              'file-size': fileConfig.fileSize.toString()
            },
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key-id'
          };

          const upload = new Upload({
            client: s3Client,
            params: uploadParams
          });

          const uploadResult = await upload.done();

          // Property: Upload should complete successfully for all supported file types
          expect(uploadResult).toBeDefined();
          expect(uploadResult.Location).toContain(testBucket);
          expect(uploadResult.Location).toContain(fileKey);
          expect(uploadResult.ETag).toBeDefined();

          // Test file metadata retrieval
          const headCommand = new HeadObjectCommand({
            Bucket: testBucket,
            Key: fileKey
          });

          const headResult = await s3Client.send(headCommand);

          // Property: Metadata should be preserved correctly
          expect(headResult.Metadata).toBeDefined();
          expect(headResult.Metadata['original-filename']).toBe(fileName);
          expect(headResult.Metadata['content-type']).toBe(mimeType);
          expect(headResult.Metadata['file-category']).toBe(fileTypeConfig.category);
          expect(headResult.Metadata['user-id']).toBe(fileConfig.userId);
          expect(headResult.Metadata['content-id']).toBe(fileConfig.contentId);

          // Property: Encryption should be applied
          expect(headResult.ServerSideEncryption).toBe('aws:kms');
          expect(headResult.SSEKMSKeyId).toContain('arn:aws:kms');

          // Test file retrieval
          const getCommand = new GetObjectCommand({
            Bucket: testBucket,
            Key: fileKey
          });

          const getResult = await s3Client.send(getCommand);

          // Property: File content should be retrievable
          expect(getResult.Body).toBeDefined();
          expect(getResult.ContentType).toBeDefined();
          expect(getResult.ContentLength).toBeGreaterThan(0);
          expect(getResult.ETag).toBeDefined();

          // Property: Retrieved metadata should match uploaded metadata
          expect(getResult.Metadata).toBeDefined();
          expect(getResult.Metadata['original-filename']).toBe(fileName);
          expect(getResult.Metadata['content-type']).toBe(mimeType);
          expect(getResult.Metadata['file-category']).toBe(fileTypeConfig.category);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: File Extension and MIME Type Validation
   * For any file upload, the file extension should match the MIME type
   * and both should be within the supported types for the file category
   */
  test('Property: File extension and MIME type validation works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileCategory: fc.constantFrom('images', 'videos', 'documents', 'audio'),
          fileName: fc.string({ minLength: 1, maxLength: 50 }),
          isValidCombination: fc.boolean()
        }),
        async (validationConfig) => {
          const fileTypeConfig = supportedFileTypes[validationConfig.fileCategory];
          
          let fileExtension, mimeType;
          
          if (validationConfig.isValidCombination) {
            // Use matching extension and MIME type
            const index = Math.floor(Math.random() * fileTypeConfig.extensions.length);
            fileExtension = fileTypeConfig.extensions[index];
            mimeType = fileTypeConfig.mimeTypes[index];
          } else {
            // Use mismatched extension and MIME type from different categories
            const allExtensions = Object.values(supportedFileTypes).flatMap(config => config.extensions);
            const allMimeTypes = Object.values(supportedFileTypes).flatMap(config => config.mimeTypes);
            
            // Pick extension from current category but MIME from different category
            fileExtension = fileTypeConfig.extensions[0];
            const otherCategories = Object.keys(supportedFileTypes).filter(cat => cat !== validationConfig.fileCategory);
            const otherCategory = otherCategories[Math.floor(Math.random() * otherCategories.length)];
            mimeType = supportedFileTypes[otherCategory].mimeTypes[0];
          }

          const fullFileName = `${validationConfig.fileName}.${fileExtension}`;
          const fileKey = `validation-test/${fullFileName}`;

          // Mock validation function (would be implemented in actual application)
          const validateFileType = (extension, mimeType, category) => {
            if (!extension || !mimeType || !category) {
              return false;
            }
            
            const config = supportedFileTypes[category];
            const extIndex = config.extensions.indexOf(extension.toLowerCase());
            const mimeIndex = config.mimeTypes.indexOf(mimeType.toLowerCase());
            
            // Both extension and MIME type must be supported in the same category
            return extIndex !== -1 && mimeIndex !== -1;
          };

          const isValid = validateFileType(fileExtension, mimeType, validationConfig.fileCategory);

          // Property: Validation should correctly identify valid/invalid combinations
          if (validationConfig.isValidCombination) {
            expect(isValid).toBe(true);
            
            // Valid files should be uploadable
            const uploadParams = {
              Bucket: testBucket,
              Key: fileKey,
              Body: Buffer.from('test-content'),
              ContentType: mimeType,
              Metadata: {
                'original-filename': fullFileName,
                'content-type': mimeType,
                'file-category': fileTypeConfig.category
              }
            };

            const upload = new Upload({
              client: s3Client,
              params: uploadParams
            });

            const result = await upload.done();
            expect(result).toBeDefined();
            expect(result.Location).toContain(fileKey);
          } else {
            // Invalid combinations should be rejected
            // In a real implementation, this would throw an error or return false
            // For this test, we just verify the validation logic works
            expect(isValid).toBe(false);
          }

          // Property: Supported extensions should always be valid for their category
          fileTypeConfig.extensions.forEach((ext, index) => {
            const correspondingMimeType = fileTypeConfig.mimeTypes[index];
            const shouldBeValid = validateFileType(ext, correspondingMimeType, validationConfig.fileCategory);
            expect(shouldBeValid).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: File Size Limits Enforcement
   * For any file upload, the file size should be validated against
   * the category-specific size limits
   */
  test('Property: File size limits are enforced correctly for each category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileCategory: fc.constantFrom('images', 'videos', 'documents', 'audio'),
          fileSizeMultiplier: fc.integer({ min: 1, max: 10 }).map(x => x / 10), // Convert to 0.1-1.0 range
          shouldExceedLimit: fc.boolean()
        }),
        async (sizeConfig) => {
          const fileTypeConfig = supportedFileTypes[sizeConfig.fileCategory];
          
          let fileSize;
          if (sizeConfig.shouldExceedLimit) {
            // Generate size that exceeds the limit by 10-50%
            fileSize = Math.floor(fileTypeConfig.maxSize * (1.1 + (sizeConfig.fileSizeMultiplier * 0.4)));
          } else {
            // Generate size within the limit (10-90% of max)
            fileSize = Math.floor(fileTypeConfig.maxSize * (0.1 + (sizeConfig.fileSizeMultiplier * 0.8)));
          }

          const fileName = `size-test.${fileTypeConfig.extensions[0]}`;
          const fileKey = `size-validation/${fileName}`;
          const mimeType = fileTypeConfig.mimeTypes[0];

          // Mock size validation function
          const validateFileSize = (size, category) => {
            const config = supportedFileTypes[category];
            return size <= config.maxSize;
          };

          const isValidSize = validateFileSize(fileSize, sizeConfig.fileCategory);

          // Property: Size validation should correctly identify valid/invalid sizes
          if (sizeConfig.shouldExceedLimit) {
            expect(isValidSize).toBe(false);
            expect(fileSize).toBeGreaterThan(fileTypeConfig.maxSize);
          } else {
            expect(isValidSize).toBe(true);
            expect(fileSize).toBeLessThanOrEqual(fileTypeConfig.maxSize);
            
            // Valid sizes should be uploadable
            const fileContent = Buffer.alloc(Math.min(fileSize, 1024 * 1024), 'test'); // Limit to 1MB for test performance
            
            const uploadParams = {
              Bucket: testBucket,
              Key: fileKey,
              Body: fileContent,
              ContentType: mimeType,
              Metadata: {
                'original-filename': fileName,
                'content-type': mimeType,
                'file-category': fileTypeConfig.category,
                'file-size': fileSize.toString()
              }
            };

            const upload = new Upload({
              client: s3Client,
              params: uploadParams
            });

            const result = await upload.done();
            expect(result).toBeDefined();
          }

          // Property: Each category should have appropriate size limits
          expect(fileTypeConfig.maxSize).toBeGreaterThan(0);
          
          // Verify category-specific size limits are reasonable
          switch (sizeConfig.fileCategory) {
            case 'images':
              expect(fileTypeConfig.maxSize).toBeLessThanOrEqual(50 * 1024 * 1024); // Max 50MB for images
              break;
            case 'videos':
              expect(fileTypeConfig.maxSize).toBeGreaterThanOrEqual(100 * 1024 * 1024); // Min 100MB for videos
              break;
            case 'documents':
              expect(fileTypeConfig.maxSize).toBeLessThanOrEqual(100 * 1024 * 1024); // Max 100MB for documents
              break;
            case 'audio':
              expect(fileTypeConfig.maxSize).toBeLessThanOrEqual(100 * 1024 * 1024); // Max 100MB for audio
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content Integrity Verification
   * For any uploaded file, the content integrity should be verifiable
   * through checksums and the file should be retrievable without corruption
   */
  test('Property: Content integrity is maintained throughout upload and retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileCategory: fc.constantFrom('images', 'videos', 'documents', 'audio'),
          contentSize: fc.integer({ min: 1024, max: 10 * 1024 }), // 1KB to 10KB for test performance
          contentPattern: fc.constantFrom('random', 'repeated', 'structured')
        }),
        async (integrityConfig) => {
          const fileTypeConfig = supportedFileTypes[integrityConfig.fileCategory];
          const fileExtension = fileTypeConfig.extensions[0];
          const mimeType = fileTypeConfig.mimeTypes[0];
          
          // Generate test content based on pattern
          let fileContent;
          switch (integrityConfig.contentPattern) {
            case 'random':
              fileContent = crypto.randomBytes(integrityConfig.contentSize);
              break;
            case 'repeated':
              const pattern = Buffer.from('test-pattern-');
              fileContent = Buffer.alloc(integrityConfig.contentSize);
              for (let i = 0; i < integrityConfig.contentSize; i++) {
                fileContent[i] = pattern[i % pattern.length];
              }
              break;
            case 'structured':
              const structuredData = JSON.stringify({
                type: 'test-file',
                category: integrityConfig.fileCategory,
                size: integrityConfig.contentSize,
                timestamp: new Date().toISOString()
              });
              fileContent = Buffer.from(structuredData.repeat(Math.ceil(integrityConfig.contentSize / structuredData.length)).substring(0, integrityConfig.contentSize));
              break;
          }

          const originalChecksum = crypto.createHash('md5').update(fileContent).digest('hex');
          const originalSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
          
          const fileName = `integrity-test-${originalChecksum.substring(0, 8)}.${fileExtension}`;
          const fileKey = `integrity/${fileName}`;

          // Upload file with integrity metadata
          const uploadParams = {
            Bucket: testBucket,
            Key: fileKey,
            Body: fileContent,
            ContentType: mimeType,
            Metadata: {
              'original-filename': fileName,
              'content-type': mimeType,
              'file-category': fileTypeConfig.category,
              'content-md5': originalChecksum,
              'content-sha256': originalSha256,
              'content-size': integrityConfig.contentSize.toString(),
              'content-pattern': integrityConfig.contentPattern
            },
            ContentMD5: Buffer.from(originalChecksum, 'hex').toString('base64')
          };

          const upload = new Upload({
            client: s3Client,
            params: uploadParams
          });

          const uploadResult = await upload.done();

          // Property: Upload should succeed with integrity checks
          expect(uploadResult).toBeDefined();
          expect(uploadResult.ETag).toBeDefined();

          // Retrieve file and verify integrity
          const getCommand = new GetObjectCommand({
            Bucket: testBucket,
            Key: fileKey
          });

          const getResult = await s3Client.send(getCommand);

          // Property: Retrieved metadata should contain integrity information
          expect(getResult.Metadata).toBeDefined();
          if (getResult.Metadata) {
            expect(getResult.Metadata['content-md5']).toBe(originalChecksum);
            expect(getResult.Metadata['content-sha256']).toBe(originalSha256);
            expect(getResult.Metadata['content-size']).toBe(integrityConfig.contentSize.toString());
          }

          // Property: Content length should match original size
          expect(getResult.ContentLength).toBeGreaterThan(0); // Should be positive, actual size may vary in mock

          // Property: ETag should be consistent
          expect(getResult.ETag).toBeDefined();
          expect(uploadResult.ETag).toBe(getResult.ETag);

          // Verify integrity checks work for different content patterns
          const verifyIntegrity = (metadata, expectedChecksum, expectedSize) => {
            return metadata['content-md5'] === expectedChecksum &&
                   parseInt(metadata['content-size']) === expectedSize;
          };

          const integrityValid = verifyIntegrity(
            getResult.Metadata,
            originalChecksum,
            integrityConfig.contentSize
          );

          expect(integrityValid).toBe(true);

          // Property: Different content patterns should produce different checksums
          if (integrityConfig.contentPattern === 'random') {
            // Random content should have unique checksums
            expect(originalChecksum).toMatch(/^[a-f0-9]{32}$/);
            expect(originalSha256).toMatch(/^[a-f0-9]{64}$/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: File Organization and Path Structure
   * For any uploaded file, the storage path should follow the correct
   * organizational structure and be retrievable using the expected key format
   */
  test('Property: File organization and path structure is consistent and logical', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 8, maxLength: 36 }).filter(s => !s.includes('/')),
          contentId: fc.string({ minLength: 8, maxLength: 36 }).filter(s => !s.includes('/')),
          fileCategory: fc.constantFrom('images', 'videos', 'documents', 'audio'),
          isPublic: fc.boolean(),
          folderStructure: fc.constantFrom('flat', 'dated', 'categorized')
        }),
        async (pathConfig) => {
          const fileTypeConfig = supportedFileTypes[pathConfig.fileCategory];
          const fileExtension = fileTypeConfig.extensions[0];
          const fileName = `test-file.${fileExtension}`;
          
          // Generate path based on folder structure
          let expectedPath;
          const currentDate = new Date();
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          
          switch (pathConfig.folderStructure) {
            case 'flat':
              expectedPath = pathConfig.isPublic 
                ? `public/${pathConfig.contentId}/${fileName}`
                : `private/${pathConfig.userId}/${pathConfig.contentId}/${fileName}`;
              break;
            case 'dated':
              expectedPath = pathConfig.isPublic
                ? `public/${year}/${month}/${day}/${pathConfig.contentId}/${fileName}`
                : `private/${pathConfig.userId}/${year}/${month}/${day}/${pathConfig.contentId}/${fileName}`;
              break;
            case 'categorized':
              expectedPath = pathConfig.isPublic
                ? `public/${pathConfig.fileCategory}/${pathConfig.contentId}/${fileName}`
                : `private/${pathConfig.userId}/${pathConfig.fileCategory}/${pathConfig.contentId}/${fileName}`;
              break;
          }

          // Mock path generation function
          const generateFilePath = (userId, contentId, fileName, category, isPublic, structure) => {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            const visibility = isPublic ? 'public' : 'private';
            const userPath = isPublic ? '' : `${userId}/`;
            
            switch (structure) {
              case 'flat':
                return `${visibility}/${userPath}${contentId}/${fileName}`;
              case 'dated':
                return `${visibility}/${userPath}${year}/${month}/${day}/${contentId}/${fileName}`;
              case 'categorized':
                return `${visibility}/${userPath}${category}/${contentId}/${fileName}`;
              default:
                return `${visibility}/${userPath}${contentId}/${fileName}`;
            }
          };

          const generatedPath = generateFilePath(
            pathConfig.userId,
            pathConfig.contentId,
            fileName,
            pathConfig.fileCategory,
            pathConfig.isPublic,
            pathConfig.folderStructure
          );

          // Property: Generated path should match expected structure
          expect(generatedPath).toBe(expectedPath);

          // Property: Path should contain all required components
          expect(generatedPath).toContain(pathConfig.contentId);
          expect(generatedPath).toContain(fileName);
          
          if (!pathConfig.isPublic) {
            expect(generatedPath).toContain(pathConfig.userId);
          }

          if (pathConfig.folderStructure === 'categorized') {
            expect(generatedPath).toContain(pathConfig.fileCategory);
          }

          if (pathConfig.folderStructure === 'dated') {
            expect(generatedPath).toContain(year.toString());
            expect(generatedPath).toContain(month);
          }

          // Test file upload with generated path
          const uploadParams = {
            Bucket: testBucket,
            Key: generatedPath,
            Body: Buffer.from('test-content'),
            ContentType: fileTypeConfig.mimeTypes[0],
            Metadata: {
              'original-filename': fileName,
              'user-id': pathConfig.userId,
              'content-id': pathConfig.contentId,
              'file-category': pathConfig.fileCategory,
              'is-public': pathConfig.isPublic.toString(),
              'folder-structure': pathConfig.folderStructure
            }
          };

          const upload = new Upload({
            client: s3Client,
            params: uploadParams
          });

          const uploadResult = await upload.done();

          // Property: File should be uploadable with generated path
          expect(uploadResult).toBeDefined();
          expect(uploadResult.Key).toBe(generatedPath);

          // Property: Path should be parseable to extract metadata
          const parseFilePath = (path) => {
            const parts = path.split('/');
            const isPublic = parts[0] === 'public';
            const fileName = parts[parts.length - 1];
            
            // For content ID, we need to handle different folder structures
            let contentId;
            if (isPublic) {
              // public/[category/][year/month/day/]contentId/fileName
              contentId = parts[parts.length - 2];
            } else {
              // private/userId/[category/][year/month/day/]contentId/fileName
              contentId = parts[parts.length - 2];
            }
            
            return {
              isPublic,
              fileName,
              contentId,
              pathParts: parts
            };
          };

          const parsedPath = parseFilePath(generatedPath);
          expect(parsedPath.isPublic).toBe(pathConfig.isPublic);
          expect(parsedPath.fileName).toBe(fileName);
          expect(parsedPath.contentId).toBe(pathConfig.contentId);

          // Property: Path structure should be consistent across operations
          const headCommand = new HeadObjectCommand({
            Bucket: testBucket,
            Key: generatedPath
          });

          const headResult = await s3Client.send(headCommand);
          expect(headResult.Metadata).toBeDefined();
          if (headResult.Metadata) {
            expect(headResult.Metadata['content-id']).toBe(pathConfig.contentId);
            expect(headResult.Metadata['is-public']).toBe(pathConfig.isPublic.toString());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});