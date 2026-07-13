import { JobDetails } from '../linkedin/JobExtractor.js';
import { UserProfileData } from './UserProfile.js';

export interface ScoreResult {
  score: number;
  grade: string;
  confidence: number;
  reasons: string[];
  passedStage1: boolean;
  stage1Score: number;
  breakdown: string[];
  rawBreakdown: Array<{ label: string; raw: number }>;
}

export const GRADE_ACTIONS: Record<string, string> = {
  A: 'Auto Apply inmediatamente',
  B: 'Auto Apply',
  C: 'Mostrar para revisión',
  D: 'Guardar por si acaso',
  F: 'Ignorar',
};

// ── Skill aliases ──
const SKILL_ALIASES: Record<string, string[]> = {
  react: ['react', 'reactjs', 'react.js', 'react js'],
  angular: ['angular', 'angularjs', 'angular.js', 'angular 2', 'angular 4', 'angular 5', 'angular 6', 'angular 8', 'angular 10'],
  vue: ['vue', 'vuejs', 'vue.js', 'vue 3', 'nuxt', 'nuxtjs'],
  javascript: ['javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2020', 'esnext', 'es5'],
  typescript: ['typescript', 'ts'],
  node: ['node', 'nodejs', 'node.js', 'node js', 'nestjs', 'nest.js'],
  express: ['express', 'expressjs', 'express.js'],
  java: ['java', 'java 8', 'java 11', 'java 17'],
  python: ['python'],
  sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sql server', 't-sql', 'tsql', 'pl/sql', 'rdbms', 'relational database', 'sqlite'],
  html: ['html', 'html5'],
  css: ['css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'bootstrap', 'styled components'],
  git: ['git', 'github', 'gitlab', 'bitbucket', 'version control', 'vcs', 'source control'],
  docker: ['docker', 'container', 'containerization'],
  linux: ['linux', 'unix', 'bash', 'shell', 'command line', 'cli', 'terminal'],
  rest: ['rest', 'restful', 'rest api', 'restful api', 'restful apis', 'restful services', 'rest api'],
  api: ['api', 'apis', 'web api', 'rest api', 'graphql', 'endpoint', 'soap'],
  powerbi: ['power bi', 'powerbi', 'power-bi', 'power bi desktop'],
};

// ── Role keywords ──
const ROLE_PATTERNS = [
  { pattern: /\bfront\s*end\b/i, label: 'Frontend' },
  { pattern: /\bback\s*end\b/i, label: 'Backend' },
  { pattern: /\bfull\s*stack\b/i, label: 'Full Stack' },
  { pattern: /\bfullstack\b/i, label: 'Full Stack' },
];

// ── Entry-level keywords (title only) ──
const ENTRY_KEYWORDS = [
  { pattern: /\bjunior\b/i, label: 'Junior' },
  { pattern: /\bjr\b/i, label: 'Junior' },
  { pattern: /\bentry[\s-]?level\b/i, label: 'Entry Level' },
  { pattern: /\btrainee\b/i, label: 'Trainee' },
  { pattern: /\bintern(?:ship)?\b/i, label: 'Intern' },
  { pattern: /\bgraduate\b/i, label: 'Graduate' },
  { pattern: /\bnew\s+grad\b/i, label: 'Graduate' },
  { pattern: /\bapprentice\b/i, label: 'Apprentice' },
  { pattern: /\bassociate\b/i, label: 'Associate' },
  { pattern: /\bpracticante\b/i, label: 'Practicante' },
  { pattern: /\baprendiz\b/i, label: 'Aprendiz' },
];

// ── Senior/lead penalty (title only) ──
const PENALTY_PATTERNS = [
  /\bsenior\b/i, /\bsr\b/i, /\blead\b/i, /\bmanager\b/i,
  /\bprincipal\b/i, /\bstaff\b/i, /\barchitect\b/i,
  /\bdirector\b/i, /\bhead\b/i, /\bcto\b/i,
];

// ── Experience patterns ──
const LOW_EXP_PATTERNS = [
  /0[\s-]?1\s+years?/i, /0[\s–-]+1\s+years?/i,
  /0\+\s+years?/i, /1\s*\+\s*years?/i, /1\s+years?/i,
  /no\s+experience/i, /fresh\s+graduate/i, /recent\s+graduate/i,
  /new\s+grad/i, /entry[\s-]?level/i, /0[\s-]?2\s+years?/i,
];
const MID_EXP_PATTERNS = [
  /2\s+years?/i, /2\s*\+\s*years?/i,
];
const HIGH_EXP_PATTERNS = [
  /3\s*\+\s*years?/i, /4\s*\+\s*years?/i,
  /5\s+years?/i, /5\s*\+\s*years?/i,
  /6\s+years?/i, /6\s*\+\s*years?/i,
  /7\s+years?/i, /7\s*\+\s*years?/i,
  /8\s+years?/i, /8\s*\+\s*years?/i,
  /9\s+years?/i, /10\s+years?/i,
];

// ── Technologies far from profile ──
const EXCLUDED_TECH = [
  'sap', 'sap abap', 'sap hana', 'sap fiori', 'sapui5',
  'salesforce', 'apex', 'soql', 'sosl', 'lightning', 'salesforce community',
  'servicenow', 'now platform',
  'cobol', 'fortran', 'pascal', 'assembly', 'mainframe', 'z/os', 'cics', 'db2',
  'swift', 'kotlin', 'flutter', 'dart', 'react native',
  'go', 'golang', 'rust', 'scala', 'clojure', 'haskell', 'erlang', 'elixir',
  'php', 'laravel', 'symfony', 'wordpress', 'drupal', 'joomla',
  'c#', '.net', 'asp.net', 'vb.net', 'csharp',
  'hadoop', 'spark', 'kafka', 'redis', 'mongodb', 'cassandra', 'neo4j',
  'tableau', 'qlik', 'looker',
  'sharepoint', 'dynamics 365', 'power apps', 'power automate',
  'oracle', 'oracle ebs', 'peoplesoft', 'siebel',
  'sas', 'informatica', 'datastage',
  'splunk', 'datadog', 'pagerduty',
  'terraform', 'ansible', 'puppet', 'chef',
  'kubernetes', 'k8s', 'openshift',
];

export class AdvancedJobScorer {
  private profile: UserProfileData;
  private threshold: number;

  constructor(profile: UserProfileData) {
    this.profile = profile;
    this.threshold = parseFloat(process.env.SCORE_THRESHOLD || '3.0');
  }

  scoreJob(job: JobDetails): ScoreResult {
    const title = job.title;
    const loc = job.location || '';
    const wp = job.workplaceType || '';
    const desc = (job.description || '') + ' ' + title;

    let raw = 0;
    const components: Array<{ label: string; raw: number }> = [];

    // ── 1. Entry level (+4) ──
    const entryMatch = ENTRY_KEYWORDS.find((e) => e.pattern.test(title));
    if (entryMatch) {
      raw += 4;
      components.push({ label: entryMatch.label, raw: 4 });
    }

    // ── 2. Role match (+1) ──
    const roleMatch = ROLE_PATTERNS.find((r) => r.pattern.test(title));
    if (roleMatch) {
      raw += 1;
      components.push({ label: roleMatch.label, raw: 1 });
    }

    // ── 3. Tech match ──
    const matchedSkills = this._findSkills(desc);
    const skillCount = matchedSkills.length;
    let techRaw = 0;
    if (skillCount >= 4) techRaw = 4;
    else if (skillCount >= 2) techRaw = 3.5;
    else if (skillCount === 1) techRaw = 3;
    if (techRaw > 0) {
      raw += techRaw;
      const skillLabel = matchedSkills.slice(0, 3).join(', ') + (skillCount > 3 ? ', ...' : '');
      components.push({ label: `Tech (${skillLabel})`, raw: techRaw });
    }

    // ── 4. Remote ──
    const isRemote =
      /\bremote\b/i.test(loc) || /\bremote\b/i.test(wp) || /\bremote\b/i.test(desc);
    if (isRemote) {
      raw += 1;
      components.push({ label: 'Remote', raw: 1 });
    }

    // ── 5. Colombia ──
    const isColombia =
      /\bcolombia\b/i.test(loc) || /\bbogotá\b/i.test(loc) ||
      /\bbogota\b/i.test(loc) || /\bcolombia\b/i.test(desc);
    if (isColombia) {
      const pts = isRemote ? 0.25 : 0.5;
      raw += pts;
      components.push({ label: isRemote ? 'Remote + Colombia' : 'Colombia', raw: pts });
    }

    // ── 6. Easy Apply ──
    if (job.easyApply) {
      raw += 1;
      components.push({ label: 'Easy Apply', raw: 1 });
    }

    // ── 7. Experience ──
    const hasLowExp = LOW_EXP_PATTERNS.some((p) => p.test(desc));
    const hasMidExp = MID_EXP_PATTERNS.some((p) => p.test(desc));
    const hasHighExp = HIGH_EXP_PATTERNS.some((p) => p.test(desc));

    if (hasLowExp) {
      raw += 2;
      components.push({ label: '≤1 year exp', raw: 2 });
    } else if (hasMidExp) {
      raw += 1;
      components.push({ label: '2 years exp', raw: 1 });
    }
    if (hasHighExp) {
      raw -= 2;
      components.push({ label: '3+ years exp', raw: -2 });
    }

    // ── 8. Excluded tech penalty ──
    const hasExcluded = EXCLUDED_TECH.some((tech) => {
      if (tech.length <= 3) return new RegExp(`\\b${tech}\\b`, 'i').test(desc);
      return desc.toLowerCase().includes(tech);
    });
    if (hasExcluded && skillCount === 0) {
      raw -= 2;
      components.push({ label: 'Distant tech (no known skills)', raw: -2 });
    }

    // ── 9. Senior / Lead / Manager in title ──
    const hasPenalty = PENALTY_PATTERNS.some((p) => p.test(title));
    if (hasPenalty) {
      raw -= 5;
      components.push({ label: 'Senior/Lead in title', raw: -5 });
    }

    // ── 10. Combo bonus (+1 when 3+ strong signals align) ──
    const hasEntry = entryMatch !== undefined;
    const hasTech = skillCount > 0;
    const hasRemote = isRemote;
    const hasEasy = !!job.easyApply;
    const strongSignals = [hasEntry, hasTech, hasRemote, hasEasy].filter(Boolean).length;
    if (strongSignals >= 3) {
      raw += 1;
      components.push({ label: 'Combo bonus (3+ signals)', raw: 1 });
    }

    // ── Scale raw → 0–5 ──
    const scaled = Math.min(5, Math.max(0, +(raw * 0.8).toFixed(2)));
    const passed = scaled >= this.threshold;

    const breakdown = components.map(
      (c) => `${c.raw >= 0 ? '+' : ''}${c.raw.toFixed(1)}  ${c.label}`
    );

    const reasons = hasPenalty
      ? ['Senior/Lead/Manager in title — not entry-level']
      : [
          ...(entryMatch ? [`${entryMatch.label} position`] : []),
          ...(roleMatch ? [`Role: ${roleMatch.label}`] : []),
          ...(techRaw > 0 ? [`Tech: ${matchedSkills.join(', ')}`] : []),
          ...(isRemote ? ['Remote'] : []),
          ...(isColombia ? ['Colombia'] : []),
          ...(job.easyApply ? ['Easy Apply'] : []),
          ...(hasLowExp ? ['≤1 year experience'] : hasMidExp ? ['2 years experience'] : []),
          ...(hasHighExp ? ['3+ years experience'] : []),
          ...(hasExcluded && skillCount === 0 ? ['Distant tech, no known skills'] : []),
          ...(strongSignals >= 3 ? ['Combo bonus'] : []),
        ];

    const matchCount = reasons.length;
    const confidence = Math.min(95, Math.round(55 + matchCount * 7));

    return {
      score: scaled,
      grade: this._getGrade(scaled),
      confidence: hasPenalty ? 100 : confidence,
      reasons,
      passedStage1: passed,
      stage1Score: hasEntry ? 4 : 0,
      breakdown,
      rawBreakdown: components,
    };
  }

  private _findSkills(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];
    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
      const match = aliases.some((alias) => {
        if (alias.length <= 3) return new RegExp(`\\b${alias}\\b`, 'i').test(text);
        return lower.includes(alias);
      });
      if (match) found.push(canonical);
    }
    return found;
  }

  private _getGrade(score: number): string {
    if (score >= 4.5) return 'A';
    if (score >= 4.0) return 'B';
    if (score >= 3.0) return 'C';
    if (score >= 2.0) return 'D';
    return 'F';
  }
}
