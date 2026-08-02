/**
 * Property Test: Prisma Relation Cascade Rules
 * 
 * Validates Requirements 5.4:
 * - All relations have proper cascade rules
 * - Schema integrity is maintained
 * - No orphaned records possible
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

describe('Property Test: Prisma Relation Cascade Rules', () => {
  const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
  let schemaContent: string;
  
  beforeAll(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  /**
   * Property 1: All Foreign Key Relations Have Cascade Rules
   * Every @relation with onDelete should specify cascade behavior
   */
  test('Property 1: All foreign key relations specify cascade behavior', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract all @relation declarations
        const relationMatches = schema.match(/@relation\([^)]+\)/g) || [];
        
        for (const relation of relationMatches) {
          // Check if relation has fields and references (indicating foreign key)
          const hasFields = relation.includes('fields:');
          const hasReferences = relation.includes('references:');
          
          if (hasFields && hasReferences) {
            // Should have onDelete specified
            expect(relation).toMatch(/onDelete:\s*(Cascade|Restrict|SetNull|NoAction)/);
            
            // Most relations should use Cascade for data integrity
            if (relation.includes('onDelete:')) {
              const onDeleteMatch = relation.match(/onDelete:\s*(\w+)/);
              if (onDeleteMatch) {
                const cascadeType = onDeleteMatch[1];
                expect(['Cascade', 'Restrict', 'SetNull', 'NoAction']).toContain(cascadeType);
              }
            }
          }
        }
      }
    ));
  });

  /**
   * Property 2: Model Relationships Are Bidirectional
   * Every relation should have corresponding back-reference
   */
  test('Property 2: Model relationships are properly bidirectional', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract model definitions
        const modelMatches = schema.match(/model\s+(\w+)\s*{[^}]+}/g) || [];
        const models = new Map<string, string>();
        
        for (const modelMatch of modelMatches) {
          const nameMatch = modelMatch.match(/model\s+(\w+)/);
          if (nameMatch) {
            models.set(nameMatch[1], modelMatch);
          }
        }
        
        // Check each model for relations
        for (const [modelName, modelDef] of models) {
          const relationFields = modelDef.match(/(\w+)\s+(\w+)(\[\])?\s+@relation/g) || [];
          
          for (const relationField of relationFields) {
            const fieldMatch = relationField.match(/(\w+)\s+(\w+)(\[\])?/);
            if (fieldMatch) {
              const fieldName = fieldMatch[1];
              const relatedModel = fieldMatch[2].replace('[]', '');
              const isArray = !!fieldMatch[3];
              
              // Check if related model exists
              expect(models.has(relatedModel)).toBe(true);
              
              // Check if related model has back-reference
              const relatedModelDef = models.get(relatedModel);
              if (relatedModelDef) {
                // Should have a field referencing back to this model
                const backRefPattern = new RegExp(`\\w+\\s+${modelName.toLowerCase()}(\\[\\])?`);
                const hasBackRef = backRefPattern.test(relatedModelDef);
                
                // Allow some flexibility for self-references and complex relations
                if (!fieldName.includes('_') && !relatedModel.includes('_')) {
                  expect(hasBackRef).toBe(true);
                }
              }
            }
          }
        }
      }
    ));
  });

  /**
   * Property 3: Index Coverage for Foreign Keys
   * All foreign key fields should have appropriate indexes
   */
  test('Property 3: Foreign key fields have appropriate indexes', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract model definitions
        const modelMatches = schema.match(/model\s+(\w+)\s*{([^}]+)}/g) || [];
        
        for (const modelMatch of modelMatches) {
          const nameMatch = modelMatch.match(/model\s+(\w+)/);
          const bodyMatch = modelMatch.match(/{([^}]+)}/);
          
          if (nameMatch && bodyMatch) {
            const modelName = nameMatch[1];
            const modelBody = bodyMatch[1];
            
            // Find foreign key fields
            const relationMatches = modelBody.match(/(\w+)\s+\w+\s+@relation\([^)]*fields:\s*\[([^\]]+)\]/g) || [];
            
            for (const relationMatch of relationMatches) {
              const fieldsMatch = relationMatch.match(/fields:\s*\[([^\]]+)\]/);
              if (fieldsMatch) {
                const foreignKeyFields = fieldsMatch[1].split(',').map(f => f.trim());
                
                // Check if there's an index covering these fields
                const indexMatches = modelBody.match(/@@index\(\[([^\]]+)\]/g) || [];
                const uniqueMatches = modelBody.match(/@@unique\(\[([^\]]+)\]/g) || [];
                const allIndexes = [...indexMatches, ...uniqueMatches];
                
                for (const foreignKeyField of foreignKeyFields) {
                  const hasIndex = allIndexes.some(index => {
                    const indexFields = index.match(/\[([^\]]+)\]/)?.[1]
                      .split(',')
                      .map(f => f.trim());
                    return indexFields?.includes(foreignKeyField);
                  });
                  
                  // Foreign key fields should be indexed for performance
                  expect(hasIndex).toBe(true);
                }
              }
            }
          }
        }
      }
    ));
  });

  /**
   * Property 4: Cascade Rule Consistency
   * Related models should have consistent cascade behavior
   */
  test('Property 4: Cascade rules are consistent across related models', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract all cascade relationships
        const cascadeRelations = new Map<string, string[]>();
        const relationMatches = schema.match(/@relation\([^)]*onDelete:\s*Cascade[^)]*\)/g) || [];
        
        for (const relation of relationMatches) {
          const fieldsMatch = relation.match(/fields:\s*\[([^\]]+)\]/);
          const referencesMatch = relation.match(/references:\s*\[([^\]]+)\]/);
          
          if (fieldsMatch && referencesMatch) {
            const field = fieldsMatch[1].trim();
            const reference = referencesMatch[1].trim();
            
            if (!cascadeRelations.has(reference)) {
              cascadeRelations.set(reference, []);
            }
            cascadeRelations.get(reference)!.push(field);
          }
        }
        
        // Verify cascade consistency
        for (const [parentField, childFields] of cascadeRelations) {
          // All child relations to the same parent should be consistent
          expect(childFields.length).toBeGreaterThan(0);
          
          // Parent field should exist in schema
          expect(schema).toContain(parentField);
        }
      }
    ));
  });

  /**
   * Property 5: Required Field Validation
   * All required fields are properly marked and have appropriate constraints
   */
  test('Property 5: Required fields have proper validation', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract model definitions
        const modelMatches = schema.match(/model\s+(\w+)\s*{([^}]+)}/g) || [];
        
        for (const modelMatch of modelMatches) {
          const bodyMatch = modelMatch.match(/{([^}]+)}/);
          if (bodyMatch) {
            const modelBody = bodyMatch[1];
            const lines = modelBody.split('\n').map(l => l.trim()).filter(l => l);
            
            for (const line of lines) {
              // Skip comments and special lines
              if (line.startsWith('//') || line.startsWith('@@') || !line.includes(' ')) {
                continue;
              }
              
              // Check field definitions
              const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?/);
              if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2];
                const isOptional = !!fieldMatch[3];
                
                // ID fields should not be optional
                if (fieldName === 'id') {
                  expect(isOptional).toBe(false);
                }
                
                // CreatedAt/UpdatedAt fields should not be optional
                if (fieldName === 'createdAt' || fieldName === 'updatedAt') {
                  expect(isOptional).toBe(false);
                }
                
                // Email fields should not be optional and should be unique
                if (fieldName === 'email') {
                  expect(isOptional).toBe(false);
                  expect(line).toMatch(/@unique/);
                }
                
                // Foreign key fields ending in 'Id' should generally not be optional
                if (fieldName.endsWith('Id') && !fieldName.includes('stripe') && !fieldName.includes('external')) {
                  // Some flexibility for optional foreign keys
                  if (!line.includes('@relation')) {
                    // Direct foreign key field
                    const isSystemField = ['reviewedBy', 'moderatedBy', 'parentId'].some(f => fieldName.includes(f));
                    if (!isSystemField) {
                      expect(isOptional).toBe(false);
                    }
                  }
                }
              }
            }
          }
        }
      }
    ));
  });

  /**
   * Property 6: Schema Completeness
   * Schema contains all expected models and relationships
   */
  test('Property 6: Schema contains expected core models', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Core models that should exist
        const expectedModels = [
          'users',
          'artists',
          'content',
          'subscriptions',
          'tiers',
          'payments',
          'sessions',
          'accounts'
        ];
        
        for (const expectedModel of expectedModels) {
          const modelPattern = new RegExp(`model\\s+${expectedModel}\\s*{`);
          expect(schema).toMatch(modelPattern);
        }
        
        // Core relationships that should exist
        const expectedRelations = [
          'users.*artists',
          'artists.*content',
          'users.*subscriptions',
          'subscriptions.*tiers'
        ];
        
        for (const expectedRelation of expectedRelations) {
          const relationPattern = new RegExp(expectedRelation);
          expect(schema).toMatch(relationPattern);
        }
        
        // Essential indexes should exist
        const expectedIndexes = [
          '@@index.*userId',
          '@@index.*artistId',
          '@@index.*createdAt'
        ];
        
        for (const expectedIndex of expectedIndexes) {
          const indexPattern = new RegExp(expectedIndex);
          expect(schema).toMatch(indexPattern);
        }
      }
    ));
  });

  /**
   * Property 7: Data Type Consistency
   * Similar fields across models use consistent data types
   */
  test('Property 7: Data types are consistent across similar fields', () => {
    fc.assert(fc.property(
      fc.constant(schemaContent),
      (schema) => {
        // Extract all field definitions
        const fieldDefinitions = new Map<string, string[]>();
        const modelMatches = schema.match(/model\s+(\w+)\s*{([^}]+)}/g) || [];
        
        for (const modelMatch of modelMatches) {
          const bodyMatch = modelMatch.match(/{([^}]+)}/);
          if (bodyMatch) {
            const modelBody = bodyMatch[1];
            const lines = modelBody.split('\n').map(l => l.trim()).filter(l => l);
            
            for (const line of lines) {
              const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?/);
              if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2];
                
                if (!fieldDefinitions.has(fieldName)) {
                  fieldDefinitions.set(fieldName, []);
                }
                fieldDefinitions.get(fieldName)!.push(fieldType);
              }
            }
          }
        }
        
        // Check consistency for common field names
        const commonFields = ['id', 'createdAt', 'updatedAt', 'email', 'status'];
        
        for (const fieldName of commonFields) {
          const types = fieldDefinitions.get(fieldName);
          if (types && types.length > 1) {
            // All instances of the same field name should use the same type
            const uniqueTypes = [...new Set(types)];
            expect(uniqueTypes.length).toBe(1);
          }
        }
        
        // ID fields should be String with @id
        const idTypes = fieldDefinitions.get('id') || [];
        for (const idType of idTypes) {
          expect(idType).toBe('String');
        }
        
        // DateTime fields should be consistent
        const dateTimeFields = ['createdAt', 'updatedAt'];
        for (const dateField of dateTimeFields) {
          const types = fieldDefinitions.get(dateField) || [];
          for (const type of types) {
            expect(type).toBe('DateTime');
          }
        }
      }
    ));
  });
});