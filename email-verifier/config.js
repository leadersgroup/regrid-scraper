module.exports = {
  // SMTP Verification Settings
  smtp: {
    timeout: 10000,              // 10 seconds timeout for SMTP connections
    fromEmail: 'verify@yourdomain.com',  // Email to use in MAIL FROM command
    retries: 2,                  // Number of retries for failed verifications
  },

  // Rate Limiting Settings
  rateLimit: {
    concurrent: 10,              // Max concurrent verifications
    delayBetweenBatches: 1000,   // 1 second delay between batches
    delayBetweenRequests: 100,   // 100ms delay between individual requests
  },

  // Bulk Processing Settings
  bulk: {
    maxEmails: 10000,            // Maximum emails to process in one run
    batchSize: 100,              // Process emails in batches of 100
    saveProgressInterval: 50,    // Save progress every 50 emails
  },

  // Validation Settings
  validation: {
    checkSyntax: true,
    checkDomain: true,
    checkMX: true,
    checkSMTP: true,
    checkDisposable: true,
    checkRoleBased: true,
    checkCatchAll: true,
    checkFreeProvider: true,
  },

  // Output Settings
  output: {
    format: 'csv',               // 'csv' or 'json'
    includeDetails: true,        // Include full verification details
    separateByStatus: false,     // Create separate files for valid/invalid
  },

  // Known disposable email domains (sample list)
  disposableDomains: [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'getnada.com', 'temp-mail.org', 'trashmail.com',
    'maildrop.cc', 'yopmail.com', 'fakeinbox.com', 'dispostable.com'
  ],

  // Known free email providers
  freeProviders: [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'gmx.com'
  ],

  // Role-based email prefixes
  roleBasedPrefixes: [
    'admin', 'info', 'support', 'sales', 'contact', 'help', 'webmaster',
    'postmaster', 'noreply', 'no-reply', 'marketing', 'billing', 'abuse'
  ]
};
