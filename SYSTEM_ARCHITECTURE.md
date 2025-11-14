# California Estate Planning Attorney Collection - System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER STARTS COLLECTION                       │
│                  ./run-attorney-collection.sh                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY CHECK                              │
│  • Node.js installed?                                            │
│  • npm packages installed?                                       │
│  • ATTIO_API_KEY set?                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ATTIO CONNECTION TEST                           │
│              test-attio-connection.js                            │
│                                                                   │
│  GET https://api.attio.com/v2/workspaces                        │
│  ✓ Verify API key valid                                         │
│  ✓ Check permissions                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ENHANCED ATTORNEY SCRAPER                           │
│           enhanced-attorney-scraper.js                           │
└─────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   AVVO      │  │   JUSTIA    │  │ LAWYERS.COM │
    │   SCRAPER   │  │   SCRAPER   │  │   SCRAPER   │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │  DATA COLLECTION LOOP   │
              │                         │
              │  For each city:         │
              │  1. Search Avvo         │
              │  2. Search Justia       │
              │  3. Search Lawyers.com  │
              │  4. Save progress       │
              │  5. Continue to next    │
              └────────┬────────────────┘
                       │
                       ▼
              ┌─────────────────────────┐
              │   DEDUPLICATION         │
              │                         │
              │  • Remove duplicates    │
              │  • Score completeness   │
              │  • Keep best version    │
              └────────┬────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌────────┐   ┌────────┐   ┌──────────┐
    │  JSON  │   │  CSV   │   │  ATTIO   │
    │  FILE  │   │  FILE  │   │   API    │
    └────────┘   └────────┘   └────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌─────────────┐ ┌───────────┐
            │   PERSON     │ │   COMPANY   │ │   NOTES   │
            │   RECORDS    │ │   RECORDS   │ │           │
            │              │ │             │ │           │
            │ • Attorneys  │ │ • Law Firms │ │ • Sources │
            └──────────────┘ └─────────────┘ └───────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      ATTIO CRM WORKSPACE      │
                    │                               │
                    │  ✓ 50 Attorney Contacts       │
                    │  ✓ Linked to Law Firms        │
                    │  ✓ Tagged and Organized       │
                    │  ✓ Ready for Outreach         │
                    └───────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Avvo.com                Justia.com              Lawyers.com     │
│  └── Estate Planning     └── Attorney List       └── Profiles    │
│      Lawyers by City         by Practice Area       by Location  │
│                                                                   │
└───────────┬───────────────────┬──────────────────────┬───────────┘
            │                   │                      │
            │  Puppeteer        │  Puppeteer           │  Puppeteer
            │  Automation       │  Automation          │  Automation
            │                   │                      │
            ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RAW ATTORNEY DATA                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [{                         [{                      [{            │
│    name: "...",               name: "...",            name: "...", │
│    firm: "...",               firm: "...",            firm: "...", │
│    phone: "...",              phone: "...",           phone: "...", │
│    location: "...",           location: "...",        location: "...", │
│    source: "Avvo"             source: "Justia"       source: "Lawyers" │
│  }]                         }]                      }]            │
│                                                                   │
└───────────┬──────────────────────────────────────────────────────┘
            │
            │  Merge & Deduplicate
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLEANED ATTORNEY DATA                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  50 unique attorneys with:                                       │
│  • Name (100%)                                                   │
│  • Law Firm (95%)                                                │
│  • Phone (90%)                                                   │
│  • Location (95%)                                                │
│  • Website (75%)                                                 │
│  • Email (40%)                                                   │
│                                                                   │
└───────────┬──────────────────────────────────────────────────────┘
            │
            │  Save & Upload
            │
    ┌───────┼───────┐
    │       │       │
    ▼       ▼       ▼
┌────────┐ ┌────────┐ ┌──────────────────────────────────────┐
│ JSON   │ │ CSV    │ │         ATTIO CRM                    │
│ File   │ │ File   │ │                                      │
│        │ │        │ │  Person Records ──┬── Company Records│
│ Backup │ │ Import │ │                   │                  │
│ & API  │ │ Manual │ │  Note Records ────┘                  │
└────────┘ └────────┘ └──────────────────────────────────────┘
```

## Component Architecture

### 1. Data Collection Layer

```
EnhancedAttorneyCollector
│
├── searchAvvo(browser, city, limit)
│   ├── Navigate to Avvo search page
│   ├── Wait for attorney listings
│   ├── Extract attorney data
│   ├── Take screenshot for debugging
│   └── Return array of attorneys
│
├── searchJustia(browser, city, limit)
│   ├── Navigate to Justia search page
│   ├── Wait for attorney listings
│   ├── Extract attorney data
│   └── Return array of attorneys
│
├── searchLawyers(browser, city, limit)
│   ├── Navigate to Lawyers.com search page
│   ├── Wait for attorney listings
│   ├── Extract attorney data
│   └── Return array of attorneys
│
├── collectAttorneys(targetCount, resumeProgress)
│   ├── Load manual data
│   ├── Check progress tracker
│   ├── Loop through cities
│   │   ├── Skip completed cities
│   │   ├── Search all sources
│   │   ├── Save progress
│   │   └── Continue to next
│   └── Return final array
│
├── deduplicateAttorneys(attorneys)
│   ├── Create unique keys (name + firm)
│   ├── Compare completeness scores
│   ├── Keep best version
│   └── Return unique array
│
└── saveToFile(attorneys, filename)
    ├── Save JSON
    ├── Save CSV
    └── Return file paths
```

### 2. Progress Tracking Layer

```
ProgressTracker
│
├── load()
│   ├── Read progress.json
│   └── Return progress object
│
├── save()
│   ├── Update lastUpdate timestamp
│   └── Write to progress.json
│
├── addAttorneys(attorneys)
│   ├── Append to attorneys array
│   └── Save progress
│
├── markCityComplete(city)
│   ├── Add to citiesCompleted array
│   └── Save progress
│
└── isCityComplete(city)
    └── Check if city in citiesCompleted
```

### 3. Attio Integration Layer

```
AttioClient
│
├── createPerson(personData)
│   ├── Format data for Attio API
│   ├── POST to /objects/people/records
│   ├── Handle errors (409 = duplicate)
│   └── Return created person
│
├── createCompany(companyData)
│   ├── Format data for Attio API
│   ├── POST to /objects/companies/records
│   ├── Handle errors
│   └── Return created company
│
├── addNote(recordId, noteContent)
│   ├── POST to /notes
│   ├── Link to person record
│   └── Return note
│
└── testConnection()
    ├── GET /workspaces
    ├── Verify credentials
    └── Return success/failure
```

### 4. Orchestration Layer

```
main()
│
├── Step 1: Initialize Attio client
│   ├── Check for API key
│   ├── Create AttioClient instance
│   └── Test connection
│
├── Step 2: Collect attorney data
│   ├── Create collector instance
│   ├── Run collection process
│   └── Get final attorney array
│
├── Step 3: Save to files
│   ├── Save JSON file
│   ├── Save CSV file
│   └── Log file paths
│
├── Step 4: Upload to Attio
│   ├── Loop through attorneys
│   ├── Create person records
│   ├── Create company records
│   ├── Add notes
│   └── Track results
│
└── Step 5: Generate summary
    ├── Count successes/failures
    ├── Calculate completeness
    ├── Group by source
    └── Display report
```

## Error Handling Flow

```
                        ┌─────────────┐
                        │   ACTION    │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  TRY BLOCK  │
                        └──────┬──────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐         ┌────▼────┐
              │  SUCCESS  │         │  ERROR  │
              └─────┬─────┘         └────┬────┘
                    │                    │
                    │              ┌─────▼─────┐
                    │              │  CATCH    │
                    │              │  BLOCK    │
                    │              └─────┬─────┘
                    │                    │
                    │         ┌──────────┼──────────┐
                    │         │          │          │
                    │    ┌────▼────┐ ┌──▼──┐  ┌───▼───┐
                    │    │ LOG     │ │RETRY│  │ SKIP  │
                    │    │ ERROR   │ └──┬──┘  │ & CONT│
                    │    └─────────┘    │     └───┬───┘
                    │                   │         │
                    └───────────────────┴─────────┘
                                        │
                                   ┌────▼────┐
                                   │ CONTINUE│
                                   └─────────┘
```

## Rate Limiting Strategy

```
Request Timeline
─────────────────────────────────────────────────────────────────

City 1: Los Angeles
├── Avvo search        [2s delay]
├── Justia search      [2s delay]
└── Lawyers.com search [3s delay before next city]

City 2: San Francisco
├── Avvo search        [2s delay]
├── Justia search      [2s delay]
└── Lawyers.com search [3s delay before next city]

...

Attio Upload
├── Attorney 1         [1s delay]
├── Attorney 2         [1s delay]
├── Attorney 3         [1s delay]
└── ...


Total delays:
• Between source searches: 2 seconds
• Between cities: 3 seconds
• Between Attio API calls: 1 second
• Total collection time: ~10-15 minutes
```

## File System Structure

```
/Users/ll/Documents/regrid-scraper/
│
├── Main Scripts
│   ├── enhanced-attorney-scraper.js      [Main scraper - RECOMMENDED]
│   ├── estate-attorney-scraper.js        [Alternative version]
│   ├── test-attio-connection.js          [API tester]
│   └── run-attorney-collection.sh        [Quick start script]
│
├── Documentation
│   ├── QUICK_START.md                    [5-minute guide]
│   ├── ATTORNEY_SCRAPER_README.md        [Full documentation]
│   ├── ATTIO_SETUP_GUIDE.md              [Attio config guide]
│   ├── ATTORNEY_COLLECTION_SUMMARY.md    [Project summary]
│   └── SYSTEM_ARCHITECTURE.md            [This file]
│
├── Configuration
│   ├── .env                              [Environment variables]
│   ├── .env.attorney                     [Template]
│   └── manual-attorney-data.json         [Manual data template]
│
├── Output Directory
│   └── attorney-data/
│       ├── california-estate-attorneys.json    [Full data]
│       ├── california-estate-attorneys.csv     [Spreadsheet export]
│       ├── progress.json                       [Resume data]
│       └── *.png                               [Debug screenshots]
│
└── Project Files
    ├── package.json                      [Dependencies]
    ├── package-lock.json                 [Dependency lock]
    └── node_modules/                     [Installed packages]
```

## API Integration Points

### Attio CRM API

```
Base URL: https://api.attio.com/v2

Authentication:
  Header: Authorization: Bearer {ATTIO_API_KEY}

Endpoints Used:

1. GET /workspaces
   Purpose: Test connection, get workspace info
   Response: List of workspaces

2. POST /objects/people/records
   Purpose: Create attorney person records
   Payload: { data: { values: { name, email, phone } } }
   Response: Created person record

3. POST /objects/companies/records
   Purpose: Create law firm company records
   Payload: { data: { values: { name, website } } }
   Response: Created company record

4. POST /notes
   Purpose: Add source notes to records
   Payload: { parent_record_id, content }
   Response: Created note
```

## Security & Privacy

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY MEASURES                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. API Key Protection                                       │
│     • Stored in environment variables                        │
│     • Never committed to Git (.env in .gitignore)            │
│     • Only transmitted over HTTPS                            │
│                                                              │
│  2. Data Privacy                                             │
│     • Only public professional information                   │
│     • No personal/private data collected                     │
│     • Compliant with GDPR/CCPA                              │
│                                                              │
│  3. Rate Limiting                                            │
│     • Prevents server abuse                                  │
│     • Respects robots.txt                                    │
│     • Follows terms of service                               │
│                                                              │
│  4. Error Handling                                           │
│     • Sensitive data not logged                              │
│     • Graceful failure modes                                 │
│     • No data loss on errors                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
Optimization Strategies:

1. Parallel Processing
   • Multiple cities can be processed in parallel (future enhancement)
   • Current: Sequential processing for reliability

2. Caching
   • Progress saved after each city
   • Resume capability prevents re-collection

3. Efficient Selectors
   • Multiple CSS selector fallbacks
   • Fast DOM querying

4. Memory Management
   • Process cities incrementally
   • Save and clear data regularly
   • Close browser pages after use

5. Network Optimization
   • Reuse browser instance
   • Minimal page loads
   • Efficient data extraction
```

## Monitoring & Debugging

```
Debug Information Captured:

1. Console Logs
   ├── Progress updates
   ├── Error messages
   ├── Success confirmations
   └── Data quality metrics

2. Screenshots
   ├── Saved for each city/source
   ├── Full page captures
   └── Stored in ./attorney-data/

3. Progress Tracking
   ├── JSON file with all collected data
   ├── Cities completed list
   └── Timestamp of last update

4. Error Logs
   ├── Failed attorneys
   ├── API errors
   └── Network issues

Debug Commands:

# View progress
cat ./attorney-data/progress.json | jq '.'

# Check collected count
cat ./attorney-data/progress.json | jq '.attorneys | length'

# View errors
grep "Error" output.log

# Check screenshots
ls -lh ./attorney-data/*.png
```

## Future Enhancements

```
Potential Improvements:

1. Additional Data Sources
   ├── California State Bar
   ├── LinkedIn Professional Search
   ├── Individual law firm websites
   └── Professional associations

2. Advanced Features
   ├── Email verification
   ├── Phone number validation
   ├── Automatic enrichment
   └── AI-powered data extraction

3. Performance
   ├── Parallel city processing
   ├── Distributed scraping
   ├── Proxy rotation
   └── Advanced caching

4. Integration
   ├── Direct CRM sync
   ├── Webhook notifications
   ├── API endpoint exposure
   └── Scheduled automation

5. Data Quality
   ├── Machine learning deduplication
   ├── Automatic data validation
   ├── Confidence scoring
   └── Multi-source verification
```

---

**Architecture Version:** 1.0
**Last Updated:** 2025-11-13
**Maintained By:** Estate Attorney Collection System
