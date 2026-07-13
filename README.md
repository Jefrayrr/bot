# LinkedIn Job Bot

A professional, production-ready LinkedIn job search automation tool built with Node.js, TypeScript, and Puppeteer. Automatically searches, analyzes, scores, filters, stores, and tracks LinkedIn job opportunities matching your professional profile.

## Features

- **Automated Job Search** - Searches LinkedIn for Frontend, Full Stack, and Backend Developer roles
- **Smart Scrolling & Pagination** - Navigates up to 5 pages per query with human-like behavior
- **Two-Stage Scoring Engine** - Fast gate-pass filtering followed by deep analysis of job descriptions
- **Skill Matching** - Evaluates technical skills, soft skills, experience alignment
- **Location & Salary Analysis** - Scores jobs based on location preferences and salary thresholds
- **Persistent Storage** - Saves all job data locally in JSON format
- **Deduplication** - Prevents processing the same job twice
- **Incremental Processing** - Only analyzes new or updated jobs
- **Markdown Reports** - Generates daily and weekly reports
- **Notifications** - Alerts for high-score jobs, Easy Apply opportunities, and salary threshold matches
- **Session Management** - Persistent cookies, auto-login, and session recovery

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- A **LinkedIn account** (free or premium)

## Installation

```bash
# Clone or navigate to the project directory
cd linkedin-job-bot

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
```

## Configuration

Edit the `.env` file to customize your preferences:

### LinkedIn Credentials (Optional)

```
LINKEDIN_EMAIL=your.email@example.com
LINKEDIN_PASSWORD=your_password
```

Leave these empty for manual login in the browser window.

### Browser Settings

```
PUPPETEER_HEADLESS=false    # Set to true for headless mode
PUPPETEER_SLOW_MS=50        # Slow down Puppeteer operations
```

### Search Configuration

```
SEARCH_LOCATION=Colombia
SEARCH_KEYWORDS=Frontend Developer,Full Stack Developer,Backend Developer
MAX_PAGES_PER_QUERY=5
SCORE_THRESHOLD=3.0
MIN_SALARY_COP=5000000
EASY_APPLY_ONLY=false
```

### Bot Behavior

```
MIN_DELAY_MS=2000
MAX_DELAY_MS=5000
SCROLL_STEPS=5
```

## Usage

```bash
# Run the bot
npm run start

# Development mode with file watching
npm run dev

# Type-check the code
npm run lint
```

### First Run

1. Run `npm run start`
2. A Chromium browser window will open
3. **Log in to LinkedIn manually** if credentials are not configured
4. The bot will wait up to 120 seconds for manual login
5. Once logged in, the bot will automatically search and process jobs
6. Cookies are saved for future sessions

### Subsequent Runs

- The bot will attempt to restore your session from saved cookies
- If the session is still valid, it will skip the login step
- Only new or updated jobs are processed (incremental mode)

## Project Structure

```
project/
├── src/
│   ├── linkedin/
│   │   ├── LinkedInSession.ts     - Browser session & login management
│   │   ├── LinkedInJobSearcher.ts - Job search orchestration
│   │   ├── PaginationManager.ts   - Search result pagination
│   │   └── JobExtractor.ts        - Job detail extraction
│   │
│   ├── scoring/
│   │   ├── AdvancedJobScorer.ts   - Two-stage scoring engine
│   │   └── UserProfile.ts        - User profile configuration
│   │
│   ├── storage/
│   │   ├── JobStorage.ts         - Persistent JSON storage
│   │   ├── JobStateManager.ts    - Job state tracking & statistics
│   │   ├── JobDeduplicator.ts    - Duplicate job prevention
│   │   └── IncrementalJobFilter.ts - Incremental processing
│   │
│   ├── reports/
│   │   └── JobReportGenerator.ts - Markdown report generation
│   │
│   ├── notifications/
│   │   └── NotificationManager.ts - Alert notifications
│   │
│   └── main.ts                   - Entry point
│
├── data/          - Job storage (jobs.json)
├── reports/       - Generated reports (daily, weekly)
├── cookies/       - Saved LinkedIn session cookies
├── .env           - Environment configuration
├── .env.example   - Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Scoring System

### Stage 1: Fast Gate-Pass

Quickly analyzes title, snippet, company, and location to produce a 0.0-5.0 score. Only jobs scoring above the threshold (default: 3.0) proceed to Stage 2.

**Factors:**
- Role match against preferred titles
- Location match (Remote, Bogotá, Colombia)
- Salary indication
- Easy Apply availability

### Stage 2: Deep Analysis

Full description analysis for detailed scoring.

**Factors:**
- **Technical Skills** (15 skills matched against description)
- **Soft Skills** (Communication, Teamwork, Leadership, etc.)
- **Experience Alignment** (Full Stack, Web Dev, API Development, etc.)
- **Location Score** (Remote preferred, then Bogotá, then Colombia)
- **Salary Score** (Higher salary = higher score, minimum 5M COP)
- **Work Type Score** (Full-time remote ideal, contract/temporary penalized)
- **Education Match** (Checks for alignment with profile education)

### Grade Scale

| Grade | Score Range | Meaning |
|-------|-------------|---------|
| A | 4.5 - 5.0 | Excellent match |
| B | 4.0 - 4.49 | Strong match |
| C | 3.0 - 3.99 | Good match |
| D | 2.0 - 2.99 | Fair match |
| F | Below 2.0 | Poor match |

## Storage

Jobs are stored in `data/jobs.json` with the following structure:

```json
{
  "id": "unique-job-id",
  "title": "Frontend Developer",
  "company": "Company X",
  "location": "Bogotá",
  "salary": "$6M COP",
  "easyApply": true,
  "url": "https://linkedin.com/jobs/view/...",
  "description": "Full job description...",
  "postedDate": "1 week ago",
  "employmentType": "Full-time",
  "workplaceType": "Remote",
  "state": "new",
  "score": {
    "score": 4.7,
    "grade": "A",
    "confidence": 92,
    "reasons": ["..."],
    "passedStage1": true,
    "stage1Score": 3.5
  },
  "stateUpdatedAt": "2026-07-04T...",
  "lastSeenAt": "2026-07-04T..."
}
```

### Job States

- **new** - Recently discovered, not reviewed
- **seen** - Reviewed by user
- **applied** - User has applied
- **rejected** - Not interested
- **saved** - Saved for later

## Reports

Reports are generated in Markdown format and saved to the `reports/` directory.

**Daily reports** include:
- Summary statistics (total, new, applied, rejected)
- Grade distribution
- Top 10 opportunities by score
- Insights and trends

**Weekly reports** provide the same data over a 7-day window.

## Troubleshooting

### Browser won't open
Ensure Puppeteer can download Chromium: `npx puppeteer browsers install`

### Login timeout
- Check your internet connection
- Complete the login within 120 seconds
- Try clearing the `cookies/` directory and restarting

### No jobs found
- Verify your search keywords in `.env`
- Check LinkedIn's website is accessible
- Try reducing `MAX_PAGES_PER_QUERY`

### Session expired
- Delete the cookies file in `cookies/` directory
- Restart the bot for fresh login

### Anti-bot detection
- Keep `PUPPETEER_HEADLESS=false` (visible browser is more trusted)
- The bot implements human-like delays and scrolling
- Real browser fingerprinting is masked

## Extending

### Adding new search queries
Edit `SEARCH_KEYWORDS` in `.env` or modify `UserProfile.ts`

### Customizing scoring weights
Modify the scoring factors in `AdvancedJobScorer.ts`

### Adding notification channels
Extend the `NotificationManager.ts` class (email, Slack, webhook, etc.)

### Adding new job sources
Create a new searcher class following the pattern in `LinkedInJobSearcher.ts`

## License

MIT
