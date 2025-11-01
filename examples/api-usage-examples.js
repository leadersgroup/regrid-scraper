/**
 * API Usage Examples
 *
 * This file contains practical examples of how to use the Deed Scraper API
 * from JavaScript/Node.js applications.
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// =============================================================================
// Example 1: Simple Deed Download
// =============================================================================

async function example1_simpleDeedDownload() {
  console.log('Example 1: Simple Deed Download\n');

  const address = '6431 Swanson St, Windermere, FL 34786';

  try {
    const response = await axios.post(`${API_BASE}/api/deed/download`, {
      address: address
    });

    console.log('✅ Success!');
    console.log(`   PDF: ${response.data.download.filename}`);
    console.log(`   Size: ${response.data.download.fileSizeKB} KB`);
    console.log(`   Cost: ${response.data.cost}\n`);

    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// =============================================================================
// Example 2: Download with Error Handling
// =============================================================================

async function example2_withErrorHandling(address) {
  console.log('Example 2: Download with Error Handling\n');

  try {
    const response = await axios.post(`${API_BASE}/api/deed/download`, {
      address: address,
      options: {
        headless: true,
        timeout: 120000
      }
    });

    return {
      success: true,
      data: response.data
    };

  } catch (error) {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data;

      if (status === 503) {
        return {
          success: false,
          error: 'CAPTCHA_NOT_CONFIGURED',
          message: 'Server needs 2Captcha API key configured'
        };
      } else if (status === 400) {
        return {
          success: false,
          error: 'INVALID_REQUEST',
          message: data.message
        };
      } else {
        return {
          success: false,
          error: 'SERVER_ERROR',
          message: data.error || error.message
        };
      }
    } else if (error.request) {
      // No response from server
      return {
        success: false,
        error: 'NO_RESPONSE',
        message: 'Server did not respond. Is it running?'
      };
    } else {
      // Request setup error
      return {
        success: false,
        error: 'REQUEST_ERROR',
        message: error.message
      };
    }
  }
}

// =============================================================================
// Example 3: Batch Download Multiple Deeds
// =============================================================================

async function example3_batchDownload(addresses) {
  console.log('Example 3: Batch Download Multiple Deeds\n');

  const results = [];
  const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];

    console.log(`[${i + 1}/${addresses.length}] Downloading: ${address}`);

    try {
      const response = await axios.post(`${API_BASE}/api/deed/download`, {
        address: address
      });

      results.push({
        address: address,
        success: true,
        filename: response.data.download.filename,
        fileSize: response.data.download.fileSizeKB,
        cost: response.data.cost
      });

      console.log(`   ✅ Success: ${response.data.download.filename}\n`);

    } catch (error) {
      results.push({
        address: address,
        success: false,
        error: error.response?.data?.error || error.message
      });

      console.log(`   ❌ Failed: ${error.response?.data?.error || error.message}\n`);
    }

    // Wait between requests (except for last one)
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalCost = successful * 0.001;

  console.log('='.repeat(80));
  console.log('BATCH DOWNLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Requests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Cost: $${totalCost.toFixed(3)}`);
  console.log('='.repeat(80) + '\n');

  return results;
}

// =============================================================================
// Example 4: Download with Retry Logic
// =============================================================================

async function example4_downloadWithRetry(address, maxRetries = 3) {
  console.log('Example 4: Download with Retry Logic\n');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${maxRetries}: ${address}`);

    try {
      const response = await axios.post(`${API_BASE}/api/deed/download`, {
        address: address
      });

      console.log(`✅ Success on attempt ${attempt}\n`);
      return response.data;

    } catch (error) {
      console.log(`❌ Failed on attempt ${attempt}`);

      if (attempt === maxRetries) {
        console.log(`⚠️ All ${maxRetries} attempts failed\n`);
        throw error;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delaySeconds = Math.pow(2, attempt);
      console.log(`   Waiting ${delaySeconds}s before retry...\n`);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }
}

// =============================================================================
// Example 5: Parallel Downloads (Concurrent Requests)
// =============================================================================

async function example5_parallelDownloads(addresses, concurrency = 3) {
  console.log('Example 5: Parallel Downloads (Concurrent Requests)\n');
  console.log(`Processing ${addresses.length} addresses with concurrency ${concurrency}\n`);

  const results = [];

  // Process in batches
  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);

    console.log(`Processing batch ${Math.floor(i / concurrency) + 1}...`);

    const batchPromises = batch.map(async (address) => {
      try {
        const response = await axios.post(`${API_BASE}/api/deed/download`, {
          address: address
        });

        console.log(`   ✅ ${address}`);
        return { address, success: true, data: response.data };

      } catch (error) {
        console.log(`   ❌ ${address}`);
        return { address, success: false, error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`Batch complete. Waiting before next batch...\n`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

// =============================================================================
// Example 6: Cost Tracking
// =============================================================================

class DeedDownloader {
  constructor() {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalCost = 0;
    this.budgetLimit = 10.00; // $10 limit
  }

  async downloadDeed(address) {
    console.log(`Downloading: ${address}`);

    // Check budget
    if (this.totalCost >= this.budgetLimit) {
      throw new Error(`Budget limit reached! ($${this.budgetLimit})`);
    }

    this.totalRequests++;

    try {
      const response = await axios.post(`${API_BASE}/api/deed/download`, {
        address: address
      });

      this.successfulRequests++;
      this.totalCost += 0.001;

      console.log(`✅ Success`);
      console.log(`   Total cost: $${this.totalCost.toFixed(3)}`);
      console.log(`   Remaining budget: $${(this.budgetLimit - this.totalCost).toFixed(3)}\n`);

      return response.data;

    } catch (error) {
      this.failedRequests++;
      console.log(`❌ Failed: ${error.response?.data?.error || error.message}\n`);
      throw error;
    }
  }

  getStats() {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      totalCost: this.totalCost,
      budgetRemaining: this.budgetLimit - this.totalCost,
      successRate: this.totalRequests > 0
        ? ((this.successfulRequests / this.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log('='.repeat(80));
    console.log('DOWNLOAD STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Successful: ${stats.successfulRequests}`);
    console.log(`Failed: ${stats.failedRequests}`);
    console.log(`Success Rate: ${stats.successRate}`);
    console.log(`Total Cost: $${stats.totalCost.toFixed(3)}`);
    console.log(`Budget Remaining: $${stats.budgetRemaining.toFixed(3)}`);
    console.log('='.repeat(80) + '\n');
  }
}

async function example6_costTracking() {
  console.log('Example 6: Cost Tracking\n');

  const downloader = new DeedDownloader();

  const addresses = [
    '6431 Swanson St, Windermere, FL 34786',
    // Add more addresses here
  ];

  for (const address of addresses) {
    try {
      await downloader.downloadDeed(address);
    } catch (error) {
      if (error.message.includes('Budget limit')) {
        console.error('⚠️ Budget limit reached, stopping downloads');
        break;
      }
    }
  }

  downloader.printStats();
}

// =============================================================================
// Run Examples
// =============================================================================

async function runExamples() {
  console.log('\n' + '='.repeat(80));
  console.log('DEED SCRAPER API - USAGE EXAMPLES');
  console.log('='.repeat(80) + '\n');

  try {
    // Uncomment the example you want to run:

    // await example1_simpleDeedDownload();

    // await example2_withErrorHandling('6431 Swanson St, Windermere, FL 34786');

    // await example3_batchDownload([
    //   '6431 Swanson St, Windermere, FL 34786',
    //   // Add more addresses
    // ]);

    // await example4_downloadWithRetry('6431 Swanson St, Windermere, FL 34786');

    // await example5_parallelDownloads([
    //   '6431 Swanson St, Windermere, FL 34786',
    //   // Add more addresses
    // ], 2);

    // await example6_costTracking();

    console.log('✅ All examples completed successfully!\n');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runExamples();
}

// Export for use in other modules
module.exports = {
  example1_simpleDeedDownload,
  example2_withErrorHandling,
  example3_batchDownload,
  example4_downloadWithRetry,
  example5_parallelDownloads,
  example6_costTracking,
  DeedDownloader
};
