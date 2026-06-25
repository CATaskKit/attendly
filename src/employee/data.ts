// Demo data + shared context types for the employee app.
import type { AttendanceRow, Employee, Holiday, LeaveBalance, Notification, Reimbursement, Announcement } from '../lib/api';
import type { AttendanceAudit } from '../lib/attendanceAudit';
import type { WeekendConfig } from '../lib/calendar';

export type ReimbursementDraft = { category: string; amount: number; spentOn: string; reason: string; files: File[] };

export type LeaveRequest = {
  id?: string;
  type: string;
  from: string;
  to: string;
  fromDate?: string;
  toDate?: string;
  half: boolean;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  mgr?: boolean;
  rejectedBy?: 'mgr' | 'hr';
};

export type TeamRequest = {
  id: string;
  name: string;
  code: string;
  type: string;
  from: string;
  to: string;
  days: number;
  applied: string;
  reason: string;
  status: 'Pending' | 'Forwarded' | 'Approved' | 'Rejected';
  active?: boolean;
  resolvedAt?: string;
};

export type Status = 'out' | 'in' | 'done';

export const INITIAL_LEAVE: LeaveRequest[] = [
  { type: 'Sick', from: 'May 28', to: 'May 28', half: false, days: 1, status: 'Approved', mgr: true },
  { type: 'Casual', from: 'Jun 12', to: 'Jun 13', half: false, days: 2, status: 'Pending', mgr: false },
  { type: 'Work from home', from: 'May 20', to: 'May 20', half: false, days: 1, status: 'Rejected', rejectedBy: 'mgr' },
];

export const INITIAL_TEAM: TeamRequest[] = [
  { id: 'r1', name: 'Kiran Rao', code: 'ATL-3310', type: 'Casual', from: 'Jun 9', to: 'Jun 10', days: 2, applied: '2h ago', reason: 'Family function out of town, back Wednesday.', status: 'Pending' },
  { id: 'r2', name: 'Meera Iyer', code: 'ATL-2207', type: 'Sick', from: 'Jun 6', to: 'Jun 6', days: 1, applied: 'today', reason: 'Down with a fever — medical certificate attached.', status: 'Pending' },
  { id: 'r3', name: 'Dev Sharma', code: 'ATL-3402', type: 'Work from home', from: 'Jun 9', to: 'Jun 9', days: 1, applied: 'yesterday', reason: 'Electrician visit at home in the morning.', status: 'Pending' },
  { id: 'r4', name: 'Anjali Verma', code: 'ATL-1905', type: 'Paid', from: 'Jun 2', to: 'Jun 3', days: 2, applied: '4 days ago', reason: 'Short break before the next sprint.', status: 'Approved', active: true, resolvedAt: 'Jun 1' },
  { id: 'r5', name: 'Rahul Nair', code: 'ATL-2618', type: 'Casual', from: 'May 29', to: 'May 29', days: 1, applied: '1 week ago', reason: '', status: 'Approved', resolvedAt: 'May 28' },
];

export type Ctx = {
  tab: string;
  setTab: (id: string) => void;
  status: Status;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  elapsed: number;
  now: Date;
  leaveRequests: LeaveRequest[];
  live: boolean;
  /** true on any real deployment (Supabase keys present), even before the
   *  profile/org loads — use this to suppress demo sample data. */
  configured: boolean;
  /** true while the first live data fetch is in flight — show a skeleton. */
  homeLoading: boolean;
  employee: Employee | null;
  employeeName: string;
  workspaceName: string;
  workspaceLogo: string | null;
  attendanceRows: AttendanceRow[];
  leaveBalances: LeaveBalance[];
  holidays: Holiday[];
  weekend: WeekendConfig;
  orgId: string | null;
  birthdays: { name: string; dob: string }[];
  weeklyHours: number[];
  attendanceAudit: AttendanceAudit;
  refreshAttendanceAudit: () => Promise<AttendanceAudit>;
  timeSynced: boolean;
  timeSource: string | null;
  fmtClock: (d: Date | null) => string;
  fmtDur: (secs: number) => string;
  openOverlay: (o: string) => void;
  closeOverlay: () => void;
  notify: (text: string, icon?: string) => void;
  doCheckIn: (audit?: AttendanceAudit) => void;
  doCheckOut: (audit?: AttendanceAudit) => void;
  submitLeave: (l: Omit<LeaveRequest, 'status' | 'mgr'> & { fromDate?: string; toDate?: string; reason?: string; attachment?: string | null }) => void;
  cancelLeave: (id: string) => void;
  teamRequests: TeamRequest[];
  approveTeam: (id: string) => void;
  rejectTeam: (id: string) => void;
  logout: () => void;
  role?: string;
  goAdmin?: () => void;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markOneRead: (id: string) => void;
  teamMembers: Employee[];
  teamTodayAtt: Record<string, AttendanceRow>;
  reimbursements: Reimbursement[];
  teamReimbursements: Reimbursement[];
  approveReimbursement: (id: string) => void;
  rejectReimbursement: (id: string) => void;
  reimbursementEnabled: boolean;
  submitReimbursement: (draft: ReimbursementDraft) => void;
  cancelReimbursement: (id: string) => void;
  announcements: Announcement[];
  unreadAnnouncements: number;
  isAnnouncementRead: (id: string) => boolean;
  markAnnouncementRead: (id: string) => void;
};
