#!/usr/bin/env node

/**
 * Disable Maintenance Mode Script
 * 
 * Removes maintenance mode after successful cutover
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import fs from 'fs';

const prisma = new PrismaClient();

async function disableMaintenanceMode() {
  console.log('🟢 Disabling maintenance mode...');

  try {
    // Remove maintenance mode from database
    await prisma.$executeRaw`
      UPDATE system_settings 
      SET value = 'false', updated_at = NOW()
      WHERE key = 'maintenance_mode'
    `;

    // Remove maintenance mode from Redis cache
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    });

    await redis.connect();
    await redis.del('system:maintenance_mode');
    await redis.del('system:maintenance_message');
    await redis.set('system:maintenance_end_time', new Date().toISOString());
    await redis.disconnect();

    // Remove maintenance flag file
    if (fs.existsSync('/tmp/maintenance-mode.json')) {
      fs.unlinkSync('/tmp/maintenance-mode.json');
    }

    // Log maintenance completion
    const maintenanceLog = {
      disabled: true,
      endTime: new Date().toISOString(),
      reason: 'AWS infrastructure migration completed'
    };

    fs.writeFileSync('/tmp/maintenance-completed.json', JSON.stringify(maintenanceLog, null, 2));

    console.log('✅ Maintenance mode disabled successfully');
    console.log('   Platform is now fully operational');

  } catch (error) {
    console.error('❌ Failed to disable maintenance mode:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await disableMaintenanceMode();
}

main();