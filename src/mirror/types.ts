export type BotState = 'idle' | 'searching' | 'scoring' | 'applying' | 'error';

export interface BrowserStateData {
  url: string;
  title: string;
  state: BotState;
  memoryMB: number;
  uptime: number;
  currentQuery: string;
  currentPage: number;
  totalPages: number;
  currentJob: number;
  totalJobs: number;
  sessionStatus: string;
}

export interface JobViewData {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  easyApply: boolean;
  score: number;
  grade: string;
  confidence: number;
  skills: SkillMatch[];
  postedDate: string | null;
  workplaceType: string | null;
  employmentType: string | null;
}

export interface SkillMatch {
  name: string;
  matched: boolean;
}

export interface FormFieldData {
  type: 'input' | 'select' | 'textarea' | 'button' | 'radio' | 'checkbox' | 'file';
  name: string;
  label: string;
  value: string;
  options?: string[];
  required: boolean;
  filled: boolean;
}

export interface FormViewData {
  isEasyApply: boolean;
  currentStep: number;
  totalSteps: number;
  fields: FormFieldData[];
  buttons: string[];
  resumeFile: string | null;
}

export interface DecisionStep {
  label: string;
  value: string | boolean | number;
  passed: boolean;
}

export interface DecisionTreeData {
  jobId: string;
  steps: DecisionStep[];
}

export interface TimelineEntry {
  timestamp: string;
  type: 'navigation' | 'job_found' | 'job_enriched' | 'scoring' | 'form_detected' |
        'field_filled' | 'question_asked' | 'decision' | 'submitted' | 'error' |
        'pipeline_start' | 'pipeline_stage' | 'application_start' | 'application_complete';
  message: string;
  data?: Record<string, unknown>;
}

export interface DOMNodeData {
  tag: string;
  text?: string;
  children: DOMNodeData[];
  interactive: boolean;
  selector?: string;
}

export interface MirrorEvent {
  event: string;
  data: unknown;
  timestamp: string;
}
