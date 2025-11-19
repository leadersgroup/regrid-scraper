const EmailVerifier = require('./email-verifier');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

class BulkEmailVerifier {
  constructor(options = {}) {
    this.verifier = new EmailVerifier(options);
    this.config = { ...config, ...options };
    this.results = [];
    this.stats = {
      total: 0,
      processed: 0,
      valid: 0,
      invalid: 0,
      errors: 0,
      disposable: 0,
      roleBased: 0,
      catchAll: 0,
      freeProvider: 0
    };
    this.startTime = null;
    this.progressFile = null;
  }

  /**
   * Verify a list of emails with rate limiting
   */
  async verifyBulk(emails, options = {}) {
    const {
      outputFile = 'results.csv',
      progressFile = 'progress.json',
      onProgress = null
    } = options;

    this.progressFile = progressFile;
    this.startTime = Date.now();

    // Validate input
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new Error('Email list must be a non-empty array');
    }

    if (emails.length > this.config.bulk.maxEmails) {
      throw new Error(`Maximum ${this.config.bulk.maxEmails} emails allowed per run`);
    }

    // Remove duplicates and empty values
    const uniqueEmails = [...new Set(emails.filter(e => e && e.trim()))];

    this.stats.total = uniqueEmails.length;

    console.log(`\n🚀 Starting bulk verification of ${this.stats.total} emails...`);
    console.log(`⚙️  Concurrent connections: ${this.config.rateLimit.concurrent}`);
    console.log(`⏱️  Delay between batches: ${this.config.rateLimit.delayBetweenBatches}ms\n`);

    // Process in batches
    const batches = this.createBatches(uniqueEmails, this.config.bulk.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      console.log(`📦 Processing batch ${batchNumber}/${batches.length} (${batch.length} emails)...`);

      // Process batch with concurrency limit
      const batchResults = await this.processBatchConcurrent(batch);

      this.results.push(...batchResults);

      // Update stats
      this.updateStats(batchResults);

      // Progress callback
      if (onProgress) {
        onProgress(this.getProgress());
      }

      // Save progress periodically
      if (this.stats.processed % this.config.bulk.saveProgressInterval === 0) {
        await this.saveProgress();
      }

      // Display progress
      this.displayProgress();

      // Delay between batches (except for last batch)
      if (i < batches.length - 1) {
        await this.delay(this.config.rateLimit.delayBetweenBatches);
      }
    }

    // Save final results
    await this.saveResults(outputFile);
    await this.saveProgress();

    console.log('\n✅ Verification complete!\n');
    this.displayFinalStats();

    return {
      results: this.results,
      stats: this.stats,
      outputFile
    };
  }

  /**
   * Process a batch with concurrent requests
   */
  async processBatchConcurrent(emails) {
    const results = [];
    const concurrent = this.config.rateLimit.concurrent;

    // Split batch into concurrent chunks
    for (let i = 0; i < emails.length; i += concurrent) {
      const chunk = emails.slice(i, i + concurrent);

      // Process chunk concurrently
      const chunkPromises = chunk.map(async (email) => {
        try {
          const result = await this.verifier.verify(email);
          this.stats.processed++;
          return result;
        } catch (error) {
          this.stats.processed++;
          this.stats.errors++;
          return {
            email,
            valid: false,
            error: error.message,
            verifiedAt: new Date().toISOString()
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Small delay between chunks within a batch
      if (i + concurrent < emails.length) {
        await this.delay(this.config.rateLimit.delayBetweenRequests);
      }
    }

    return results;
  }

  /**
   * Create batches from email list
   */
  createBatches(emails, batchSize) {
    const batches = [];
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update statistics
   */
  updateStats(results) {
    results.forEach(result => {
      if (result.valid) {
        this.stats.valid++;
      } else {
        this.stats.invalid++;
      }

      if (result.disposable) this.stats.disposable++;
      if (result.roleBased) this.stats.roleBased++;
      if (result.catchAll) this.stats.catchAll++;
      if (result.freeProvider) this.stats.freeProvider++;
      if (result.error) this.stats.errors++;
    });
  }

  /**
   * Get current progress
   */
  getProgress() {
    const elapsed = Date.now() - this.startTime;
    const emailsPerSecond = (this.stats.processed / (elapsed / 1000)).toFixed(2);
    const percentComplete = ((this.stats.processed / this.stats.total) * 100).toFixed(1);
    const estimatedTimeRemaining = this.stats.processed > 0
      ? ((this.stats.total - this.stats.processed) / (this.stats.processed / (elapsed / 1000)))
      : 0;

    return {
      processed: this.stats.processed,
      total: this.stats.total,
      percentComplete: parseFloat(percentComplete),
      emailsPerSecond: parseFloat(emailsPerSecond),
      estimatedTimeRemaining: Math.ceil(estimatedTimeRemaining / 1000), // seconds
      stats: { ...this.stats }
    };
  }

  /**
   * Display progress
   */
  displayProgress() {
    const progress = this.getProgress();
    const bar = this.createProgressBar(progress.percentComplete);

    console.log(`${bar} ${progress.percentComplete}% | ${progress.processed}/${progress.total} | ${progress.emailsPerSecond} emails/sec`);
  }

  /**
   * Create progress bar
   */
  createProgressBar(percent, length = 30) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * Display final statistics
   */
  displayFinalStats() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

    console.log('📊 Final Statistics:');
    console.log('─'.repeat(50));
    console.log(`Total Processed:  ${this.stats.processed}`);
    console.log(`Valid Emails:     ${this.stats.valid} (${((this.stats.valid / this.stats.total) * 100).toFixed(1)}%)`);
    console.log(`Invalid Emails:   ${this.stats.invalid} (${((this.stats.invalid / this.stats.total) * 100).toFixed(1)}%)`);
    console.log(`Disposable:       ${this.stats.disposable}`);
    console.log(`Role-based:       ${this.stats.roleBased}`);
    console.log(`Catch-all:        ${this.stats.catchAll}`);
    console.log(`Free Provider:    ${this.stats.freeProvider}`);
    console.log(`Errors:           ${this.stats.errors}`);
    console.log('─'.repeat(50));
    console.log(`Time Elapsed:     ${elapsed}s`);
    console.log(`Average Speed:    ${(this.stats.processed / elapsed).toFixed(2)} emails/sec`);
    console.log('─'.repeat(50));
  }

  /**
   * Save results to file
   */
  async saveResults(filename) {
    // Skip saving if no filename provided (API mode)
    if (!filename) {
      return;
    }

    const ext = path.extname(filename).toLowerCase();

    if (ext === '.json') {
      await this.saveJSON(filename);
    } else {
      await this.saveCSV(filename);
    }

    console.log(`\n💾 Results saved to: ${filename}`);
  }

  /**
   * Save as CSV
   */
  async saveCSV(filename) {
    const headers = [
      'email',
      'valid',
      'smtp_status',
      'disposable',
      'role_based',
      'catch_all',
      'free_provider',
      'domain',
      'mx_records',
      'error',
      'verified_at'
    ];

    const rows = this.results.map(r => [
      r.email,
      r.valid ? 'yes' : 'no',
      r.smtp?.status || 'unknown',
      r.disposable ? 'yes' : 'no',
      r.roleBased ? 'yes' : 'no',
      r.catchAll ? 'yes' : 'no',
      r.freeProvider ? 'yes' : 'no',
      r.domain?.name || '',
      r.mx?.records?.join(';') || '',
      r.error || '',
      r.verifiedAt
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    await fs.writeFile(filename, csv, 'utf8');
  }

  /**
   * Save as JSON
   */
  async saveJSON(filename) {
    const output = {
      stats: this.stats,
      processedAt: new Date().toISOString(),
      results: this.results
    };

    await fs.writeFile(filename, JSON.stringify(output, null, 2), 'utf8');
  }

  /**
   * Save progress
   */
  async saveProgress() {
    if (!this.progressFile) return;

    const progress = {
      ...this.getProgress(),
      results: this.results,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2), 'utf8');
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BulkEmailVerifier;
