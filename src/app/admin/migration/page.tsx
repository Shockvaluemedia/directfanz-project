/**
 * Migration Dashboard Page
 * Administrative interface for monitoring AWS migration progress
 * Implements Requirements 11.6
 */

import MigrationDashboard from '@/components/migration/MigrationDashboard';

export default function MigrationPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          AWS Migration Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Monitor the progress of DirectFanz platform migration to AWS infrastructure
        </p>
      </div>
      
      <MigrationDashboard migrationId="aws-conversion-2024" />
    </div>
  );
}