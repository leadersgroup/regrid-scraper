module.exports = {
  // UserCheck API Settings
  usercheck: {
    apiKey: process.env.USERCHECKCOM_API,
    apiUrl: 'https://api.usercheck.com',
    timeout: 10000,              // 10 seconds timeout for API calls
  },

  // SMTP Verification Settings
  smtp: {
    timeout: 30000,              // 30 seconds timeout for SMTP connections (increased for cloud environments)
    fromEmail: 'verify@example.com',  // Email to use in MAIL FROM command
    retries: 1,                  // Number of retries for failed verifications (reduced to speed up)
  },

  // Rate Limiting Settings
  rateLimit: {
    concurrent: 1,               // Max concurrent verifications (UserCheck API has strict rate limits)
    delayBetweenBatches: 1000,   // 1 second delay between batches
    delayBetweenRequests: 1100,  // 1.1 second delay between requests (UserCheck API: 1 req/sec)
  },

  // Bulk Processing Settings
  bulk: {
    maxEmails: 10000,            // Maximum emails to process in one run
    batchSize: 100,              // Process emails in batches of 100
    saveProgressInterval: 50,    // Save progress every 50 emails
  },

  // Validation Settings
  validation: {
    useUserCheckAPI: true,       // Use UserCheck API for validation (recommended)
    checkSyntax: true,
    checkDomain: true,
    checkMX: true,
    checkSMTP: false,            // Disabled - ISP blocks port 25
    checkDisposable: true,
    checkRoleBased: true,
    checkCatchAll: false,        // Requires SMTP, so disabled
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
