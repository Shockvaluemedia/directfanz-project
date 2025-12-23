#!/usr/bin/env node

/**
 * Enable Maintenance Mode Script
 * 
 * Puts the application into maintenance mode during cutover
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import fs from 'fs';

const prisma = new PrismaClient();

async function enableMaintenanceMode() {
  console.log('🚧 Enabling maintenance mode...');

  try {
    // Set maintenance mode in database
    await prisma.$executeRaw`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('maintenance_mode', 'true', NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = 'true', updated_at = NOW()
    `;

    // Set maintenance mode in Redis cache
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    });

    await redis.connect();
    await redis.set('system:maintenance_mode', 'true');
    await redis.set('system:maintenance_message', 'DirectFanz is undergoing scheduled maintenance. We\'ll be back shortly!');
    await redis.set('system:maintenance_start_time', new Date().toISOString());
    await redis.disconnect();

    // Create maintenance flag file
    const maintenanceInfo = {
      enabled: true,
      startTime: new Date().toISOString(),
      reason: 'AWS infrastructure migration',
      estimatedDuration: '30 minutes'
    };

    fs.writeFileSync('/tmp/maintenance-mode.json', JSON.stringify(maintenanceInfo, null, 2));

    console.log('✅ Maintenance mode enabled successfully');
    console.log('   Users will see maintenance page for new requests');
    console.log('   Existing sessions will be allowed to complete');

  } catch (error) {
    console.error('❌ Failed to enable maintenance mode:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await enableMaintenanceMode();
}

main();