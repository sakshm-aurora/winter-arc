#!/usr/bin/env node
/**
 * Winter Arc RPG - Battle Processing Scheduler
 * 
 * Runs the daily battle processor at midnight IST (00:00 India Standard Time)
 * Uses node-cron for scheduling
 */

const cron = require('node-cron');
const { DailyBattleProcessor } = require('./daily-battle-processor');

class BattleScheduler {
  constructor() {
    this.processor = new DailyBattleProcessor();
    this.isProcessing = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    console.log('🚀 Winter Arc RPG Battle Scheduler Started');
    console.log('⏰ Scheduled for: Midnight IST (00:00 India Standard Time)');
    console.log('🌍 Current IST Time:', this.getCurrentISTTime());
    console.log('');

    // Schedule for midnight IST (00:00)
    // Cron expression: '0 0 * * *' in IST timezone
    const job = cron.schedule('0 0 * * *', async () => {
      await this.runDailyProcessing();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    // Also schedule a test run every minute for development/testing
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: Also scheduling test runs every 5 minutes');
      cron.schedule('*/5 * * * *', async () => {
        console.log('🧪 Development test run...');
        await this.runDailyProcessing();
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
      });
    }

    // Keep the process alive
    console.log('📡 Scheduler is running... Press Ctrl+C to stop');
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⏹️  Stopping scheduler...');
      job.stop();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  /**
   * Run daily processing
   */
  async runDailyProcessing() {
    if (this.isProcessing) {
      console.log('⚠️  Daily processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('\n🌙 MIDNIGHT IST PROCESSING STARTED');
      console.log('🕛 IST Time:', this.getCurrentISTTime());
      console.log('');

      await this.processor.processDaily();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Daily processing completed in ${duration}s`);
      console.log('⏰ Next run: Tomorrow at midnight IST\n');

    } catch (error) {
      console.error('\n💥 Daily processing failed:', error);
      console.log('⏰ Will retry tomorrow at midnight IST\n');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current IST time as string
   */
  getCurrentISTTime() {
    return new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Manual trigger for testing
   */
  async runManual(targetDate = null) {
    console.log('🔧 Manual processing triggered...');
    await this.runDailyProcessing();
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const scheduler = new BattleScheduler();

  if (command === 'manual') {
    // Manual run for testing
    const targetDate = args[1] || null;
    await scheduler.runManual(targetDate);
    process.exit(0);
  } else if (command === 'start') {
    // Start the scheduler
    scheduler.start();
  } else {
    console.log('🎮 Winter Arc RPG - Battle Scheduler\n');
    console.log('Usage:');
    console.log('  node scheduler.js start    - Start the scheduled service');
    console.log('  node scheduler.js manual   - Run processing manually');
    console.log('');
    console.log('Environment Variables:');
    console.log('  NODE_ENV=development       - Enable test runs every 5 minutes');
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Scheduler error:', error);
    process.exit(1);
  });
}

module.exports = { BattleScheduler };
