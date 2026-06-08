// Demo data + shared context types for the employee app.

export type LeaveRequest = {
  type: string;
  from: string;
  to: string;
  half: boolean;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected';
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
  status: 'Pending' | 'Approved' | 'Rejected';
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
  fmtClock: (d: Date | null) => string;
  fmtDur: (secs: number) => string;
  openOverlay: (o: string) => void;
  closeOverlay: () => void;
  doCheckIn: () => void;
  doCheckOut: () => void;
  submitLeave: (l: Omit<LeaveRequest, 'status' | 'mgr'>) => void;
  teamRequests: TeamRequest[];
  approveTeam: (id: string) => void;
  rejectTeam: (id: string) => void;
  logout: () => void;
};
