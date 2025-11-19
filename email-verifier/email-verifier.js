const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');
const config = require('./config');

class EmailVerifier {
  constructor(options = {}) {
    this.config = { ...config, ...options };
  }

  /**
   * Validate email using UserCheck API
   */
  async validateWithUserCheck(email) {
    try {
      const url = `${this.config.usercheck.apiUrl}/email/${encodeURIComponent(email)}`;

      // Log request for debugging
      if (process.env.DEBUG_USERCHECK) {
        console.log('UserCheck API request:', {
          url,
          email,
          encoded: encodeURIComponent(email)
        });
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.config.usercheck.apiKey}`
        },
        timeout: this.config.usercheck.timeout,
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only accept 2xx responses
        }
      });

      const data = response.data;

      // Log API response for debugging
      if (process.env.DEBUG_USERCHECK) {
        console.log('UserCheck API response:', JSON.stringify(data, null, 2));
      }

      // Map UserCheck response to our format
      return {
        email: email,  // Include email address in result
        valid: data.mx && !data.disposable && !data.spam,
        syntax: {
          valid: true,  // If API accepts it, syntax is valid
          message: 'Valid syntax'
        },
        domain: {
          valid: true,
          name: data.domain,
          message: 'Domain exists'
        },
        mx: {
          valid: data.mx || false,
          records: data.mx_records || [],
          message: data.mx ? 'MX records found' : 'No MX records'
        },
        smtp: {
          valid: data.mx || false,
          status: data.mx ? 'valid' : 'no_mx',
          message: 'Verified via UserCheck API'
        },
        disposable: data.disposable || false,
        roleBased: data.role_account || false,
        catchAll: false,  // UserCheck doesn't provide this in basic response
        freeProvider: data.public_domain || false,
        spam: data.spam || false,
        didYouMean: data.did_you_mean || null,
        normalizedEmail: data.normalized_email || email,
        domainAge: data.domain_age_in_days || null,
        error: null,
        verifiedAt: new Date().toISOString(),
        apiProvider: 'usercheck'
      };
    } catch (error) {
      // If API call fails, return error result
      // Log full error for debugging
      if (process.env.DEBUG_USERCHECK) {
        console.error('UserCheck API error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }

      if (error.response) {
        // API responded with error
        const errorMsg = typeof error.response.data === 'string'
          ? error.response.data
          : (error.response.data?.message || error.response.data?.error || error.message);

        return {
          email: email,
          valid: false,
          syntax: { valid: false, message: 'API validation failed' },
          domain: { valid: false },
          mx: { valid: false, records: [] },
          smtp: { valid: false, status: 'api_error' },
          disposable: false,
          roleBased: false,
          catchAll: false,
          freeProvider: false,
          error: `UserCheck API error: ${error.response.status} - ${errorMsg}`,
          verifiedAt: new Date().toISOString(),
          apiProvider: 'usercheck'
        };
      } else {
        // Network or timeout error
        return {
          email: email,
          valid: false,
          syntax: { valid: false, message: 'API request failed' },
          domain: { valid: false },
          mx: { valid: false, records: [] },
          smtp: { valid: false, status: 'api_timeout' },
          disposable: false,
          roleBased: false,
          catchAll: false,
          freeProvider: false,
          error: `UserCheck API error: ${error.message}`,
          verifiedAt: new Date().toISOString(),
          apiProvider: 'usercheck'
        };
      }
    }
  }

  /**
   * Main verification function
   */
  async verify(email) {
    // Use UserCheck API if enabled
    if (this.config.validation.useUserCheckAPI) {
      return await this.validateWithUserCheck(email);
    }

    // Otherwise use local validation
    const result = {
      email: email,
      valid: false,
      syntax: { valid: false },
      domain: { valid: false },
      mx: { valid: false, records: [] },
      smtp: { valid: false, status: 'unknown' },
      disposable: false,
      roleBased: false,
      catchAll: false,
      freeProvider: false,
      error: null,
      verifiedAt: new Date().toISOString()
    };

    try {
      // 1. Syntax validation
      result.syntax = this.validateSyntax(email);
      if (!result.syntax.valid) {
        result.error = 'Invalid email syntax';
        return result;
      }

      const [localPart, domain] = email.toLowerCase().split('@');
      result.domain.name = domain;
      result.localPart = localPart;

      // 2. Check if disposable
      if (this.config.validation.checkDisposable) {
        result.disposable = this.isDisposable(domain);
      }

      // 3. Check if role-based
      if (this.config.validation.checkRoleBased) {
        result.roleBased = this.isRoleBased(localPart);
      }

      // 4. Check if free provider
      if (this.config.validation.checkFreeProvider) {
        result.freeProvider = this.isFreeProvider(domain);
      }

      // 5. Domain validation (DNS lookup)
      if (this.config.validation.checkDomain) {
        result.domain = await this.validateDomain(domain);
        if (!result.domain.valid) {
          result.error = 'Domain does not exist';
          return result;
        }
      }

      // 6. MX Record validation
      if (this.config.validation.checkMX) {
        result.mx = await this.validateMX(domain);
        if (!result.mx.valid) {
          result.error = 'No MX records found';
          return result;
        }
      }

      // 7. SMTP validation
      if (this.config.validation.checkSMTP && result.mx.valid) {
        result.smtp = await this.validateSMTP(email, result.mx.records[0]);

        // Check if catch-all
        if (this.config.validation.checkCatchAll && result.smtp.valid) {
          result.catchAll = await this.isCatchAll(domain, result.mx.records[0]);
        }
      } else if (!this.config.validation.checkSMTP) {
        // SMTP check disabled - set status to skipped
        result.smtp = {
          valid: true,
          status: 'skipped',
          message: 'SMTP verification disabled (Railway port 25 blocked)'
        };
      }

      // Determine overall validity
      if (this.config.validation.checkSMTP) {
        // With SMTP enabled, require SMTP validation to pass
        result.valid = result.syntax.valid &&
                       result.domain.valid &&
                       result.mx.valid &&
                       (result.smtp.valid || result.smtp.status === 'accept_all');
      } else {
        // Without SMTP, valid if syntax, domain, and MX are all valid
        result.valid = result.syntax.valid &&
                       result.domain.valid &&
                       result.mx.valid;
      }

      return result;

    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Validate email syntax
   */
  validateSyntax(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    const valid = emailRegex.test(email);
    return {
      valid,
      message: valid ? 'Valid syntax' : 'Invalid email format'
    };
  }

  /**
   * Validate domain exists
   */
  async validateDomain(domain) {
    try {
      await dns.resolve(domain, 'A');
      return { valid: true, message: 'Domain exists' };
    } catch (error) {
      try {
        await dns.resolve(domain, 'AAAA');
        return { valid: true, message: 'Domain exists (IPv6)' };
      } catch (error2) {
        return { valid: false, message: 'Domain does not exist' };
      }
    }
  }

  /**
   * Validate MX records
   */
  async validateMX(domain) {
    try {
      const mxRecords = await dns.resolveMx(domain);

      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, records: [], message: 'No MX records found' };
      }

      // Sort by priority (lower number = higher priority)
      const sortedRecords = mxRecords
        .sort((a, b) => a.priority - b.priority)
        .map(record => record.exchange);

      return {
        valid: true,
        records: sortedRecords,
        message: `Found ${sortedRecords.length} MX record(s)`
      };
    } catch (error) {
      return { valid: false, records: [], message: error.message };
    }
  }

  /**
   * Validate SMTP - connect to mail server and verify mailbox
   */
  async validateSMTP(email, mxHost) {
    return new Promise((resolve) => {
      const timeout = this.config.smtp.timeout;
      const port = 25;
      let socket = null;
      let step = 0;
      let result = { valid: false, status: 'unknown', message: '' };

      const cleanup = () => {
        if (socket) {
          socket.removeAllListeners();
          socket.destroy();
        }
      };

      const commands = [
        `HELO ${this.config.smtp.fromEmail.split('@')[1] || 'verification.com'}\r\n`,
        `MAIL FROM:<${this.config.smtp.fromEmail}>\r\n`,
        `RCPT TO:<${email}>\r\n`,
        `QUIT\r\n`
      ];

      try {
        socket = net.createConnection(port, mxHost);

        // Set timeout
        socket.setTimeout(timeout);

        socket.on('timeout', () => {
          result = { valid: false, status: 'timeout', message: 'Connection timeout' };
          cleanup();
          resolve(result);
        });

        socket.on('error', (error) => {
          result = { valid: false, status: 'error', message: error.message };
          cleanup();
          resolve(result);
        });

        socket.on('data', (data) => {
          const response = data.toString();
          const code = parseInt(response.substring(0, 3));

          // Connection established (220)
          if (step === 0 && code === 220) {
            socket.write(commands[0]); // HELO
            step = 1;
          }
          // HELO accepted (250)
          else if (step === 1 && code === 250) {
            socket.write(commands[1]); // MAIL FROM
            step = 2;
          }
          // MAIL FROM accepted (250)
          else if (step === 2 && code === 250) {
            socket.write(commands[2]); // RCPT TO
            step = 3;
          }
          // RCPT TO response
          else if (step === 3) {
            if (code === 250 || code === 251) {
              result = { valid: true, status: 'valid', message: 'Mailbox exists' };
            } else if (code === 550 || code === 551 || code === 553) {
              result = { valid: false, status: 'invalid', message: 'Mailbox does not exist' };
            } else if (code === 450 || code === 451 || code === 452) {
              result = { valid: false, status: 'temporary_error', message: 'Temporary error' };
            } else if (code === 421) {
              result = { valid: false, status: 'service_unavailable', message: 'Service unavailable' };
            } else {
              result = { valid: false, status: 'unknown', message: response.trim() };
            }

            socket.write(commands[3]); // QUIT
            step = 4;

            setTimeout(() => {
              cleanup();
              resolve(result);
            }, 500);
          }
        });

        socket.on('close', () => {
          if (step < 3) {
            result = { valid: false, status: 'connection_closed', message: 'Connection closed prematurely' };
          }
          cleanup();
          resolve(result);
        });

      } catch (error) {
        result = { valid: false, status: 'error', message: error.message };
        cleanup();
        resolve(result);
      }
    });
  }

  /**
   * Check if domain accepts all emails (catch-all)
   */
  async isCatchAll(domain, mxHost) {
    // Test with a random non-existent email
    const randomEmail = `verify-${Math.random().toString(36).substring(7)}@${domain}`;

    try {
      const result = await this.validateSMTP(randomEmail, mxHost);
      // If random email is accepted, it's likely a catch-all
      return result.valid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if email is from a disposable domain
   */
  isDisposable(domain) {
    return this.config.disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * Check if email is role-based
   */
  isRoleBased(localPart) {
    const prefix = localPart.toLowerCase().split(/[+.-]/)[0];
    return this.config.roleBasedPrefixes.includes(prefix);
  }

  /**
   * Check if email is from a free provider
   */
  isFreeProvider(domain) {
    return this.config.freeProviders.includes(domain.toLowerCase());
  }
}

module.exports = EmailVerifier;
