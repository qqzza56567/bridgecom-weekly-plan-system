export interface User {
  id: string;
  name: string;
  email: string; // New field for email notifications
  isManager: boolean;
  isAdmin?: boolean; // New field for system admin access
  subordinates?: string[]; // IDs of subordinates
}

export enum TaskCategory {
  KEY_RESPONSIBILITY = '關鍵職責',
  OTHER = '其他事項'
}

export enum TaskPriority {
  HIGH = '高',
  MEDIUM = '中',
  LOW = '低'
}

export type TaskStatus = 'open' | 'in_progress' | 'on_hand' | 'done'; // Keep for type safety if needed in some places, but UI will focus on progress

export interface WeeklyTask {
  id: string;
  category: TaskCategory;
  priority: TaskPriority;
  name: string;
  outcome: string;
  hours: number; // Estimated hours
  actualHours: number; // Actual hours reported/reviewed
  progress: number; // 0 - 100
  notDoneReason?: string;
  status?: TaskStatus;
  lastTouchedAt?: string;
}

// Update to lowercase consistency
export type PlanStatus = 'draft' | 'pending' | 'approved' | 'rejected';

// --- New Types for Last Week Review ---
// Removed CompletionStatus enum as we switched to percentage progress

export interface LastWeekTaskReview {
  taskId: string;
  name: string; // Snapshot of task name
  category?: string; // Snapshot of category
  outcome?: string; // Snapshot of outcome
  hours?: number; // Snapshot of estimated hours
  actualHours: number;
  progress: number; // 0 - 100
  notDoneReason?: string; // Required if progress < 80
}

export interface LastWeekReviewSection {
  weekStart: string; // The weekStart ID of the PREVIOUS plan
  tasks: LastWeekTaskReview[];
}
// --------------------------------------

export interface WeeklyPlanSubmission {
  id: string;
  userId: string;
  userName: string;
  weekRange: string;
  weekStart: string; // YYYY-MM-DD (Wednesday)
  submittedAt: string;
  updatedAt?: string;
  status: PlanStatus;
  reviewComment?: string;
  totalHours: number;
  keyRatio: number;
  tasks: WeeklyTask[];

  // New optional field for storing the review of the previous week
  lastWeekReview?: LastWeekReviewSection;

  remark?: string; // Reason for not meeting criteria
}

export interface DailyPlanSubmission {
  id: string;
  userId: string;
  userName: string;
  date: string;
  goals: string[];
  status: 'Valid' | 'Invalid';
  incompleteReason?: string; // Reason for not filling all 3 goals
}

export interface DailyPlanItem {
  id: number;
  content: string;
  isValid?: boolean;
  feedback?: string;
}

export enum SmartStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID'
}