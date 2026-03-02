'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGetWithAuth, apiPostWithAuth, apiPutWithAuth } from '../../lib/api';

type UserSession = {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: string;
};

type RegistrationStats = {
  totalRegistrations: number;
  todayRegistrations: number;
  thisMonthRegistrations: number;
};

type Student = {
  _id: string;
  name: string;
  age: number;
  gender: string;
  parentName: string;
  parentPhone: string;
  email?: string | null;
  batchId?: string | { _id: string; name?: string } | null;
  feeStatus: 'paid' | 'pending';
  status: 'active' | 'inactive';
};

type ClientMeta = {
  photoDataUrl?: string;
  photoFileName?: string;
  rollNo?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceAmount?: string;
  invoiceRemarks?: string;
  subscriptionLevel?: string;
  subscriptionType?: 'subscription' | 'trial';
  subscriptionPlanId?: string;
  subscriptionClassId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionAutoRenew?: boolean;
};

type NotificationLog = {
  _id: string;
  phoneNumber: string;
  messageType: 'feeReminder' | 'absence' | 'broadcast';
  messageContent: string;
  status: 'queued' | 'sent' | 'failed';
  createdAt: string;
};

type BillingCurrent = {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  plan: null | {
    name: string;
    priceMonthly: number;
    studentLimit: number;
    features: string[];
  };
};

type FeePlan = {
  _id: string;
  name: string;
  amount: number;
  durationMonths: number;
  description?: string | null;
};

type Batch = {
  _id: string;
  name: string;
  centerName?: string;
  feePlanId?: {
    _id: string;
    name: string;
    amount: number;
    durationMonths: number;
  } | null;
  sportType: string;
  coachId?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  capacity: number;
  status: 'active' | 'inactive';
};

type TeamMember = {
  id: string;
  fullName: string;
  title?: string;
  designation?: string;
  email: string;
  role: string;
  isActive: boolean;
};

type StudentsListResponse = {
  items: Student[];
  pagination: {
    total: number;
  };
};

type NotificationListResponse = {
  items: NotificationLog[];
  pagination: {
    total: number;
  };
};

type PendingFeesResponse = {
  items: Array<{
    student: {
      _id: string;
      name: string;
      parentPhone: string;
    };
    summary: {
      pendingTillDate: number;
      overallPending: number;
      dueStatus: 'due' | 'clear';
    };
  }>;
  pagination: {
    total: number;
  };
};

type BatchesListResponse = {
  items: Batch[];
  pagination: {
    total: number;
  };
};

type TeamMembersResponse = {
  items: TeamMember[];
  total: number;
};

type AttendanceEntry = {
  _id: string;
  batchId?: string | { _id: string } | null;
  studentId?: string | { _id: string } | null;
  status: 'present' | 'absent';
  date: string;
};

type AttendanceByDateResponse = {
  items: AttendanceEntry[];
  pagination: {
    total: number;
  };
};

const leftMenu = [
  'Pulse Board',
  'Academy Pro',
  'Student Roster',
  'Training Grid',
  'Finance Deck',
  'Alert Center',
  'Growth Reports'
] as const;
type MenuItem = (typeof leftMenu)[number];

type AcademyProItem = 'plans' | 'classes' | 'class-schedule' | 'clients' | 'renewals' | 'coach' | 'attendance';
type TabId = 'pulse' | 'studio' | 'automations' | 'academy-pro';
const headerTabs: TabId[] = ['studio', 'automations', 'academy-pro'];

const menuToTab: Record<MenuItem, TabId> = {
  'Pulse Board': 'pulse',
  'Academy Pro': 'academy-pro',
  'Student Roster': 'studio',
  'Training Grid': 'pulse',
  'Finance Deck': 'studio',
  'Alert Center': 'automations',
  'Growth Reports': 'pulse'
};

const menuToSectionSlug: Record<MenuItem, string> = {
  'Pulse Board': 'pulse-board',
  'Academy Pro': 'academy-pro-plans',
  'Student Roster': 'student-roster',
  'Training Grid': 'training-grid',
  'Finance Deck': 'finance-deck',
  'Alert Center': 'alert-center',
  'Growth Reports': 'growth-reports'
};

const sectionSlugToMenu: Record<string, MenuItem> = Object.fromEntries(
  Object.entries(menuToSectionSlug).map(([menu, slug]) => [slug, menu])
) as Record<string, MenuItem>;

const tabDefaultMenu: Record<TabId, MenuItem> = {
  pulse: 'Pulse Board',
  'academy-pro': 'Academy Pro',
  studio: 'Student Roster',
  automations: 'Alert Center'
};

const tabLabels: Record<TabId, string> = {
  pulse: 'Pulse',
  studio: 'Student Roster',
  automations: 'Automations',
  'academy-pro': 'Academy Pro'
};

const academyProNav: Array<{ id: AcademyProItem; label: string }> = [
  { id: 'plans', label: 'Plans' },
  { id: 'classes', label: 'Classes' },
  { id: 'class-schedule', label: 'Class Schedule' },
  { id: 'clients', label: 'Clients' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'renewals', label: 'Renewals' },
  { id: 'coach', label: 'Coach' }
];
const weekDayOptions = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' }
] as const;

const fmtDate = (value: string) => new Date(value).toLocaleDateString();
const formatCurrency = (amount: number) => `INR ${amount.toLocaleString('en-IN')}`;

const pseudoTime = (index: number) => {
  const hour = 6 + (index % 8);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelve = hour > 12 ? hour - 12 : hour;
  return `${String(twelve).padStart(2, '0')}:00 ${suffix}`;
};

const CLIENT_META_STORAGE_KEY = 'academy-client-meta-v1';
const renewalDueFilters = [1, 2, 3, 4, 5, 10, 20] as const;
const matchesRenewalWindow = (dueInDays: number, selected: (typeof renewalDueFilters)[number]) => {
  if (dueInDays <= 0) return false;
  if (selected <= 4) return dueInDays === selected;
  if (selected === 5) return dueInDays <= 5;
  if (selected === 10) return dueInDays >= 6 && dueInDays <= 10;
  if (selected === 20) return dueInDays >= 11 && dueInDays <= 20;
  return false;
};

const splitBatchAndClass = (value: string) => {
  const parts = value.split(' - ');
  if (parts.length >= 2) {
    return {
      batchName: parts[0].trim(),
      classTitle: parts.slice(1).join(' - ').trim()
    };
  }
  return {
    batchName: value.trim(),
    classTitle: ''
  };
};

const csvEscape = (value: unknown) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('pulse');
  const [activeMenu, setActiveMenu] = useState<MenuItem>('Pulse Board');
  const [academyProExpanded, setAcademyProExpanded] = useState(false);
  const [activeAcademyPro, setActiveAcademyPro] = useState<AcademyProItem>('plans');
  const [showPlanComposer, setShowPlanComposer] = useState(false);
  const [showClassComposer, setShowClassComposer] = useState(false);
  const [showCoachComposer, setShowCoachComposer] = useState(false);
  const [classEditBatchId, setClassEditBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [billing, setBilling] = useState<BillingCurrent | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStudents, setAttendanceStudents] = useState<Student[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [notificationsTotal, setNotificationsTotal] = useState(0);
  const [pendingFees, setPendingFees] = useState<PendingFeesResponse['items']>([]);
  const [registrationStats, setRegistrationStats] = useState<RegistrationStats | null>(null);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [coaches, setCoaches] = useState<TeamMember[]>([]);

  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentGender, setStudentGender] = useState('male');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [rosterSearchText, setRosterSearchText] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [rosterFeeFilter, setRosterFeeFilter] = useState<'all' | 'paid' | 'pending'>('all');

  const [feePlanName, setFeePlanName] = useState('Monthly Prime');
  const [feeAmount, setFeeAmount] = useState('2200');
  const [feeMonths, setFeeMonths] = useState('1');

  const [batchName, setBatchName] = useState('U13 Elite');
  const [batchCenter, setBatchCenter] = useState('Main Center');
  const [batchSportType, setBatchSportType] = useState('Football');
  const [batchCoachId, setBatchCoachId] = useState('');
  const [batchDays, setBatchDays] = useState('mon,wed,fri');
  const [batchStartTime, setBatchStartTime] = useState('17:00');
  const [batchEndTime, setBatchEndTime] = useState('18:00');
  const [batchCapacity, setBatchCapacity] = useState('30');

  const [batchFilterCenter, setBatchFilterCenter] = useState('all');
  const [batchFilterSport, setBatchFilterSport] = useState('all');
  const [batchFilterStatus, setBatchFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [batchSearchText, setBatchSearchText] = useState('');

  const [classTitle, setClassTitle] = useState('U13 Evening Beginners');
  const [classBatchName, setClassBatchName] = useState('');
  const [classSkill, setClassSkill] = useState('Football');
  const [classCenter, setClassCenter] = useState('Main Center');
  const [classLevel, setClassLevel] = useState('Beginner');
  const [classInfo, setClassInfo] = useState('Foundational class for new players.');
  const [classVisibility, setClassVisibility] = useState<'public' | 'private'>('public');
  const [classStatus, setClassStatus] = useState<'active' | 'inactive'>('active');
  const [classCapacity, setClassCapacity] = useState('30');
  const [classScheduleDays, setClassScheduleDays] = useState<string[]>(['mon', 'wed', 'fri']);
  const [classStartTime, setClassStartTime] = useState('17:00');
  const [classEndTime, setClassEndTime] = useState('18:00');
  const [classCoachId, setClassCoachId] = useState('');
  const [classFeePlanId, setClassFeePlanId] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState<'active' | 'inactive'>('active');
  const [classSearchText, setClassSearchText] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleCenterFilter, setScheduleCenterFilter] = useState('all');
  const [scheduleBatchFilter, setScheduleBatchFilter] = useState('all');
  const [showClientComposer, setShowClientComposer] = useState(false);
  const [academyAttendanceDate, setAcademyAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [recentAttendanceEntries, setRecentAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [activeAttendanceBatch, setActiveAttendanceBatch] = useState<{
    id: string;
    title: string;
    centerName: string;
  } | null>(null);
  const [attendanceDraftRecords, setAttendanceDraftRecords] = useState<
    Array<{ studentId: string; name: string; phone: string; status: 'present' | 'absent' }>
  >([]);
  const [clientEditingId, setClientEditingId] = useState<string | null>(null);
  const [clientFullName, setClientFullName] = useState('');
  const [clientGender, setClientGender] = useState<'male' | 'female' | 'other'>('male');
  const [clientEmail, setClientEmail] = useState('');
  const [clientRollNo, setClientRollNo] = useState('');
  const [clientMobileCode, setClientMobileCode] = useState('+91');
  const [clientMobile, setClientMobile] = useState('');
  const [clientPhotoDataUrl, setClientPhotoDataUrl] = useState('');
  const [clientPhotoFileName, setClientPhotoFileName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [subscriptionLevel, setSubscriptionLevel] = useState('');
  const [subscriptionType, setSubscriptionType] = useState<'subscription' | 'trial'>('subscription');
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('');
  const [subscriptionClassId, setSubscriptionClassId] = useState('');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [subscriptionAutoRenew, setSubscriptionAutoRenew] = useState(false);
  const [clientMetaByStudentId, setClientMetaByStudentId] = useState<Record<string, ClientMeta>>({});
  const [renewalDueFilter, setRenewalDueFilter] = useState<(typeof renewalDueFilters)[number]>(5);
  const [coachName, setCoachName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [coachTitle, setCoachTitle] = useState('');
  const [coachDesignation, setCoachDesignation] = useState('');
  const [coachPassword, setCoachPassword] = useState(`Coach@${Math.random().toString(36).slice(-6)}A1`);

  const [broadcastText, setBroadcastText] = useState('Reminder: Recovery drills start 30 minutes early tomorrow.');
  const [debugOutput, setDebugOutput] = useState('');

  const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const loadDashboardData = async (accessToken: string, currentUser?: UserSession | null) => {
    setLoading(true);

    const resolvedUser = currentUser || user;

    const [me, currentBilling, studentsList, studentsForAttendance, notificationList, pending, regStats, plans, batchList, memberList] = await Promise.all([
      safeFetch(() => apiGetWithAuth<UserSession>('/auth/me', accessToken), null),
      safeFetch(() => apiGetWithAuth<BillingCurrent>('/billing/current', accessToken), null),
      safeFetch(() => apiGetWithAuth<StudentsListResponse>('/students?page=1&limit=12', accessToken), {
        items: [],
        pagination: { total: 0 }
      }),
      safeFetch(() => apiGetWithAuth<StudentsListResponse>('/students?page=1&limit=100', accessToken), {
        items: [],
        pagination: { total: 0 }
      }),
      safeFetch(() => apiGetWithAuth<NotificationListResponse>('/notifications/logs?page=1&limit=200', accessToken), {
        items: [],
        pagination: { total: 0 }
      }),
      safeFetch(() => apiGetWithAuth<PendingFeesResponse>('/fees/payments/pending?page=1&limit=200', accessToken), {
        items: [],
        pagination: { total: 0 }
      }),
      resolvedUser?.role === 'SuperAdmin'
        ? safeFetch(() => apiGetWithAuth<RegistrationStats>('/auth/registration-stats', accessToken), null)
        : Promise.resolve(null),
      safeFetch(() => apiGetWithAuth<FeePlan[]>('/fees/plans', accessToken), []),
      safeFetch(
        () =>
          apiGetWithAuth<BatchesListResponse>(
            `/batches?page=1&limit=60${batchFilterStatus === 'all' ? '' : `&status=${batchFilterStatus}`}`,
            accessToken
          ),
        { items: [], pagination: { total: 0 } }
      ),
      resolvedUser?.role === 'Coach'
        ? Promise.resolve({ items: [], total: 0 } as TeamMembersResponse)
        : safeFetch(() => apiGetWithAuth<TeamMembersResponse>('/team-members', accessToken), { items: [], total: 0 })
    ]);

    if (me) {
      localStorage.setItem('currentUser', JSON.stringify(me));
      setUser(me);
    }

    setBilling(currentBilling);
    setStudents(studentsList.items);
    setAttendanceStudents(studentsForAttendance.items);
    setStudentsTotal(studentsList.pagination.total);
    setNotifications(notificationList.items);
    setNotificationsTotal(notificationList.pagination.total);
    setPendingFees(pending.items);
    setRegistrationStats(regStats);
    setFeePlans(plans);
    setBatches(batchList.items);
    setCoaches(memberList.items.filter((member) => member.role === 'Coach' && member.isActive));

    const recentDateList = [0, 1, 2].map((offset) => {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      return date.toISOString().slice(0, 10);
    });

    const recentAttendanceResponses = await Promise.all(
      recentDateList.map((date) =>
        safeFetch(
          () => apiGetWithAuth<AttendanceByDateResponse>(`/attendance/by-date?date=${date}&page=1&limit=200`, accessToken),
          { items: [], pagination: { total: 0 } }
        )
      )
    );

    setRecentAttendanceEntries(recentAttendanceResponses.flatMap((response) => response.items));
    setLoading(false);
  };

  const loadAttendanceByDate = async (accessToken: string, date: string) => {
    const response = await safeFetch(
      () => apiGetWithAuth<AttendanceByDateResponse>(`/attendance/by-date?date=${date}&page=1&limit=200`, accessToken),
      { items: [], pagination: { total: 0 } }
    );
    setAttendanceEntries(response.items);
  };

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken') || '';
    const userData = localStorage.getItem('currentUser');

    if (!accessToken || !userData) {
      router.replace('/login');
      return;
    }

    setToken(accessToken);

    try {
      const parsedUser = JSON.parse(userData) as UserSession;
      setUser(parsedUser);
      loadDashboardData(accessToken, parsedUser);
      loadAttendanceByDate(accessToken, academyAttendanceDate);
    } catch {
      localStorage.removeItem('currentUser');
      router.replace('/login');
      return;
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const section = new URLSearchParams(window.location.search).get('section');
    if (!section) return;

    if (section.startsWith('academy-pro-')) {
      const sub = section.replace('academy-pro-', '') as AcademyProItem;
      if (academyProNav.some((item) => item.id === sub)) {
        setActiveAcademyPro(sub);
      }
      setAcademyProExpanded(true);
      setActiveMenu('Academy Pro');
      setActiveTab('academy-pro');
      return;
    }

    const menu = sectionSlugToMenu[section];
    if (!menu) return;
    setActiveMenu(menu);
    setActiveTab(menuToTab[menu]);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadDashboardData(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchFilterStatus]);

  useEffect(() => {
    if (!token) return;
    loadAttendanceByDate(token, academyAttendanceDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, academyAttendanceDate]);

  useEffect(() => {
    if (!batchCoachId && coaches.length > 0) {
      setBatchCoachId(coaches[0].id);
    }
  }, [coaches, batchCoachId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CLIENT_META_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, ClientMeta>;
      setClientMetaByStudentId(parsed);
    } catch {
      setClientMetaByStudentId({});
    }
  }, []);

  useEffect(() => {
    if (!classCoachId && coaches.length > 0) {
      setClassCoachId(coaches[0].id);
    }
  }, [coaches, classCoachId]);

  useEffect(() => {
    if (!classFeePlanId && feePlans.length > 0) {
      setClassFeePlanId(feePlans[0]._id);
    }
  }, [feePlans, classFeePlanId]);

  const pendingStudentsCount = useMemo(() => pendingFees.filter((f) => f.summary.overallPending > 0).length, [pendingFees]);
  const paidStudentsCount = useMemo(() => attendanceStudents.filter((s) => s.feeStatus === 'paid').length, [attendanceStudents]);

  const centerOptions = useMemo(
    () => Array.from(new Set(batches.map((batch) => batch.centerName || 'Main Center'))).sort((a, b) => a.localeCompare(b)),
    [batches]
  );

  const sportOptions = useMemo(
    () => Array.from(new Set(batches.map((batch) => batch.sportType))).sort((a, b) => a.localeCompare(b)),
    [batches]
  );

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const centerPass =
        batchFilterCenter === 'all' || (batch.centerName || 'Main Center').toLowerCase() === batchFilterCenter.toLowerCase();
      const sportPass =
        batchFilterSport === 'all' || batch.sportType.toLowerCase() === batchFilterSport.toLowerCase();
      const text = batchSearchText.trim().toLowerCase();
      const searchPass =
        !text ||
        batch.name.toLowerCase().includes(text) ||
        (batch.centerName || 'Main Center').toLowerCase().includes(text) ||
        (batch.coachId?.fullName || '').toLowerCase().includes(text);

      return centerPass && sportPass && searchPass;
    });
  }, [batches, batchFilterCenter, batchFilterSport, batchSearchText]);

  const academyClassRows = useMemo(() => {
    return batches
      .map((batch) => ({
        id: batch._id,
        title: batch.name,
        coachId: batch.coachId?._id || '',
        feePlanId: batch.feePlanId?._id || '',
        centerName: batch.centerName || 'Main Center',
        skill: batch.sportType,
        coachName: batch.coachId?.fullName || 'Unassigned',
        planName: batch.feePlanId?.name || 'Not linked',
        timing: `${batch.startTime} - ${batch.endTime}`,
        scheduleDayValues: batch.scheduleDays,
        scheduleDays: batch.scheduleDays.join(', '),
        capacity: batch.capacity,
        status: batch.status
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [batches]);

  const filteredClassRows = useMemo(() => {
    const search = classSearchText.trim().toLowerCase();
    return academyClassRows.filter((row) => {
      const statusMatch = row.status === classStatusFilter;
      const searchMatch =
        !search ||
        row.title.toLowerCase().includes(search) ||
        row.centerName.toLowerCase().includes(search) ||
        row.skill.toLowerCase().includes(search) ||
        row.coachName.toLowerCase().includes(search);
      return statusMatch && searchMatch;
    });
  }, [academyClassRows, classSearchText, classStatusFilter]);

  const attendanceByBatch = useMemo(() => {
    const stats = new Map<string, { present: number; absent: number }>();
    attendanceEntries.forEach((entry) => {
      const batchId = typeof entry.batchId === 'string' ? entry.batchId : entry.batchId?._id;
      if (!batchId) return;
      const current = stats.get(batchId) || { present: 0, absent: 0 };
      if (entry.status === 'present') current.present += 1;
      if (entry.status === 'absent') current.absent += 1;
      stats.set(batchId, current);
    });
    return stats;
  }, [attendanceEntries]);

  const academyAttendanceRows = useMemo(() => {
    return academyClassRows.map((row) => {
      const enrolled = attendanceStudents.filter((student) => {
        const studentBatchId = typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '';
        return studentBatchId === row.id;
      }).length;
      const attendanceStat = attendanceByBatch.get(row.id) || { present: 0, absent: 0 };
      return {
        ...row,
        enrolled,
        attendanceText: `${attendanceStat.present}P | ${attendanceStat.absent}A`
      };
    });
  }, [academyClassRows, attendanceStudents, attendanceByBatch]);

  const studioRosterRows = useMemo(() => {
    const search = rosterSearchText.trim().toLowerCase();
    return attendanceStudents.filter((student) => {
      const batchId = typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '';
      const classInfo = academyClassRows.find((row) => row.id === batchId);

      const searchMatch =
        !search ||
        student.name.toLowerCase().includes(search) ||
        student.parentName.toLowerCase().includes(search) ||
        student.parentPhone.toLowerCase().includes(search) ||
        (student.email || '').toLowerCase().includes(search) ||
        (classInfo?.title || '').toLowerCase().includes(search) ||
        (classInfo?.centerName || '').toLowerCase().includes(search);

      const statusMatch = rosterStatusFilter === 'all' || student.status === rosterStatusFilter;
      const feeMatch = rosterFeeFilter === 'all' || student.feeStatus === rosterFeeFilter;
      return searchMatch && statusMatch && feeMatch;
    });
  }, [attendanceStudents, academyClassRows, rosterSearchText, rosterStatusFilter, rosterFeeFilter]);

  const scheduleRows = useMemo(() => {
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const selectedDate = new Date(`${scheduleDate}T00:00:00`);
    const selectedDay = dayMap[selectedDate.getDay()];

    return academyClassRows.filter((row) => {
      const dayMatch = row.scheduleDayValues.includes(selectedDay);
      const centerMatch = scheduleCenterFilter === 'all' || row.centerName === scheduleCenterFilter;
      const batchMatch = scheduleBatchFilter === 'all' || row.id === scheduleBatchFilter;
      return dayMatch && centerMatch && batchMatch;
    });
  }, [academyClassRows, scheduleDate, scheduleCenterFilter, scheduleBatchFilter]);

  const renewalCandidates = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return students
      .map((student) => {
        const meta = clientMetaByStudentId[student._id] || {};
        const dueDateStr = meta.subscriptionEndDate || '';
        if (!dueDateStr) {
          return null;
        }

        const dueDate = new Date(`${dueDateStr}T00:00:00`);
        if (Number.isNaN(dueDate.getTime())) {
          return null;
        }

        const diffMs = dueDate.getTime() - now.getTime();
        const dueInDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const classId =
          meta.subscriptionClassId ||
          (typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '');
        const classRow = academyClassRows.find((row) => row.id === classId);

        return {
          id: student._id,
          name: student.name,
          batchName: classRow?.title || '-',
          centerName: classRow?.centerName || '-',
          email: student.email || '-',
          mobile: student.parentPhone,
          paymentDate: meta.invoiceDate || '-',
          dueDate: dueDateStr,
          dueInDays
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.dueInDays - b.dueInDays);
  }, [students, clientMetaByStudentId, academyClassRows]);

  const renewalRows = useMemo(
    () => renewalCandidates.filter((row) => matchesRenewalWindow(row.dueInDays, renewalDueFilter)),
    [renewalCandidates, renewalDueFilter]
  );

  const renewalStats = useMemo(() => {
    const dueToday = renewalCandidates.filter((row) => row.dueInDays === 1).length;
    const dueNext5 = renewalCandidates.filter((row) => row.dueInDays <= 5).length;
    const dueNext20 = renewalCandidates.filter((row) => row.dueInDays <= 20).length;
    return { dueToday, dueNext5, dueNext20 };
  }, [renewalCandidates]);

  const collectionRate = useMemo(() => {
    if (studentsTotal === 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((studentsTotal - pendingStudentsCount) / studentsTotal) * 100)));
  }, [studentsTotal, pendingStudentsCount]);

  const activeBatchRate = useMemo(() => {
    if (batches.length === 0) return 0;
    const active = batches.filter((batch) => batch.status === 'active').length;
    return Math.round((active / batches.length) * 100);
  }, [batches]);

  const trendSeries = useMemo(() => {
    const base = Math.max(studentsTotal, 24);
    return Array.from({ length: 6 }).map((_, idx) =>
      Math.max(6, Math.round(base * (0.68 + idx * 0.06) - pendingStudentsCount * 1.2 + (idx % 2 === 0 ? -2 : 3)))
    );
  }, [studentsTotal, pendingStudentsCount]);

  const trendChart = useMemo(() => {
    const width = 420;
    const height = 150;
    const maxVal = Math.max(...trendSeries, 1);
    const points = trendSeries.map((value, idx) => {
      const x = (idx / (trendSeries.length - 1)) * (width - 20) + 10;
      const y = height - (value / maxVal) * (height - 24) - 8;
      return `${x},${y}`;
    });

    return {
      polyline: points.join(' '),
      area: `M${points[0]} L${points.slice(1).join(' L')} L${width - 10},${height} L10,${height} Z`
    };
  }, [trendSeries]);

  const todayIsoDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayAttendanceRate = useMemo(() => {
    const todayRows = recentAttendanceEntries.filter((entry) => {
      const entryDate = entry.date ? new Date(entry.date).toISOString().slice(0, 10) : '';
      return entryDate === todayIsoDate;
    });
    if (todayRows.length === 0) return 0;
    const presentCount = todayRows.filter((entry) => entry.status === 'present').length;
    return Math.round((presentCount / todayRows.length) * 100);
  }, [recentAttendanceEntries, todayIsoDate]);

  const activeStudentsCount = useMemo(
    () => attendanceStudents.filter((student) => student.status === 'active').length,
    [attendanceStudents]
  );

  const activeBatchesCount = useMemo(
    () => academyClassRows.filter((row) => row.status === 'active').length,
    [academyClassRows]
  );

  const feeCollectionRatio = useMemo(() => {
    if (studentsTotal === 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((studentsTotal - pendingStudentsCount) / studentsTotal) * 100)));
  }, [studentsTotal, pendingStudentsCount]);

  const absent3PlusStudents = useMemo(() => {
    const absentDatesByStudent = new Map<string, Set<string>>();

    recentAttendanceEntries.forEach((entry) => {
      if (entry.status !== 'absent') return;
      const studentId = typeof entry.studentId === 'string' ? entry.studentId : entry.studentId?._id;
      if (!studentId) return;
      const dateKey = entry.date ? new Date(entry.date).toISOString().slice(0, 10) : '';
      const existing = absentDatesByStudent.get(studentId) || new Set<string>();
      if (dateKey) existing.add(dateKey);
      absentDatesByStudent.set(studentId, existing);
    });

    const studentNameById = new Map(attendanceStudents.map((student) => [student._id, student.name]));

    return Array.from(absentDatesByStudent.entries())
      .filter(([, dateSet]) => dateSet.size >= 3)
      .map(([studentId]) => ({
        studentId,
        name: studentNameById.get(studentId) || 'Unknown student'
      }));
  }, [recentAttendanceEntries, attendanceStudents]);

  const fullCapacityBatchRows = useMemo(
    () => academyAttendanceRows.filter((row) => row.enrolled >= row.capacity),
    [academyAttendanceRows]
  );

  const automationPulse = useMemo(() => {
    const todayLogs = notifications.filter((log) => {
      const logDate = log.createdAt ? new Date(log.createdAt).toISOString().slice(0, 10) : '';
      return logDate === todayIsoDate;
    });

    return {
      remindersSentToday: todayLogs.filter((log) => log.messageType === 'feeReminder' && log.status === 'sent').length,
      queuedNotifications: notifications.filter((log) => log.status === 'queued').length,
      failedMessages: notifications.filter((log) => log.status === 'failed').length
    };
  }, [notifications, todayIsoDate]);

  const revenuePulse = useMemo(() => {
    const expectedRevenue = attendanceStudents
      .filter((student) => student.status === 'active')
      .reduce((sum, student) => {
        const meta = clientMetaByStudentId[student._id];
        const linkedPlan = feePlans.find((plan) => plan._id === meta?.subscriptionPlanId);
        if (linkedPlan) return sum + linkedPlan.amount;
        const invoiceAmount = Number(meta?.invoiceAmount || 0);
        return sum + (Number.isFinite(invoiceAmount) ? invoiceAmount : 0);
      }, 0);

    const pendingAmount = pendingFees.reduce((sum, row) => sum + Math.max(0, row.summary.overallPending), 0);
    const collectedAmount = Math.max(0, expectedRevenue - pendingAmount);
    const collectionGap = Math.max(0, expectedRevenue - collectedAmount);
    const trendPercent = expectedRevenue > 0 ? Number((((collectedAmount - expectedRevenue) / expectedRevenue) * 100).toFixed(1)) : 0;

    return {
      expectedRevenue,
      collectedAmount,
      collectionGap,
      trendPercent
    };
  }, [attendanceStudents, clientMetaByStudentId, feePlans, pendingFees]);

  const growthPulseSeries = useMemo(() => {
    const studentSeries = trendSeries.map((value) => Math.max(20, Math.min(100, Math.round((value / Math.max(studentsTotal || 1, value)) * 100))));
    const attendanceSeries = trendSeries.map((_, index) => Math.max(15, Math.min(100, todayAttendanceRate - 10 + index * 3)));
    const batchSeries = trendSeries.map((_, index) => Math.max(15, Math.min(100, activeBatchRate - 8 + index * 2)));
    return { studentSeries, attendanceSeries, batchSeries };
  }, [trendSeries, studentsTotal, todayAttendanceRate, activeBatchRate]);

  const growthPulseChart = useMemo(() => {
    const width = 520;
    const height = 170;
    const toPolyline = (series: number[]) =>
      series
        .map((value, index) => {
          const x = (index / Math.max(series.length - 1, 1)) * (width - 24) + 12;
          const y = height - (value / 100) * (height - 24) - 8;
          return `${x},${y}`;
        })
        .join(' ');

    return {
      student: toPolyline(growthPulseSeries.studentSeries),
      attendance: toPolyline(growthPulseSeries.attendanceSeries),
      batch: toPolyline(growthPulseSeries.batchSeries)
    };
  }, [growthPulseSeries]);

  const runAction = async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    if (!token) return false;

    setActionLoading(true);
    setToast('');

    try {
      const data = await action();
      setDebugOutput(JSON.stringify(data, null, 2));
      setToast(successMessage);
      await loadDashboardData(token);
      return true;
    } catch (err) {
      setDebugOutput(JSON.stringify({ error: err instanceof Error ? err.message : 'Action failed' }, null, 2));
      setToast(err instanceof Error ? err.message : 'Action failed');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    router.replace('/login');
  };

  const handleMenuClick = (menu: MenuItem) => {
    if (menu === 'Academy Pro') {
      setAcademyProExpanded(true);
      setActiveMenu('Academy Pro');
      setActiveTab('academy-pro');
      setActiveAcademyPro('plans');
      setShowClassComposer(false);
      setShowClientComposer(false);
      setShowCoachComposer(false);
      setActiveAttendanceBatch(null);
      router.replace('/dashboard?section=academy-pro-plans');
      return;
    }

    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(false);
    setActiveAttendanceBatch(null);
    setActiveMenu(menu);
    setActiveTab(menuToTab[menu]);
    router.replace(`/dashboard?section=${menuToSectionSlug[menu]}`);
  };

  const handleTabClick = (tab: TabId) => {
    if (tab === 'academy-pro') {
      setAcademyProExpanded(true);
      setActiveMenu('Academy Pro');
      setActiveTab('academy-pro');
      router.replace(`/dashboard?section=academy-pro-${activeAcademyPro}`);
      return;
    }

    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(false);
    setActiveAttendanceBatch(null);
    const menu = tabDefaultMenu[tab];
    setActiveTab(tab);
    setActiveMenu(menu);
    router.replace(`/dashboard?section=${menuToSectionSlug[menu]}`);
  };

  const handleAcademyProNavClick = (item: AcademyProItem) => {
    setActiveAcademyPro(item);
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setAcademyProExpanded(true);
    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(false);
    setActiveAttendanceBatch(null);
    router.replace(`/dashboard?section=academy-pro-${item}`);
  };

  const handleAcademyProToggle = () => {
    const nextExpanded = !academyProExpanded;
    setAcademyProExpanded(nextExpanded);

    if (nextExpanded) {
      setActiveMenu('Academy Pro');
      setActiveTab('academy-pro');
      router.replace(`/dashboard?section=academy-pro-${activeAcademyPro}`);
    }
  };

  const openPlanComposer = () => {
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('plans');
    setAcademyProExpanded(true);
    setFeePlanName('');
    setFeeAmount('');
    setFeeMonths('');
    setShowPlanComposer(true);
    setShowClassComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(false);
    setActiveAttendanceBatch(null);
    router.replace('/dashboard?section=academy-pro-plans');
  };

  const openClassComposer = () => {
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('classes');
    setAcademyProExpanded(true);
    setClassEditBatchId(null);
    setClassTitle('');
    setClassBatchName('');
    setClassSkill('');
    setClassCenter('');
    setClassLevel('');
    setClassCapacity('');
    setClassScheduleDays([]);
    setClassStartTime('');
    setClassEndTime('');
    setClassCoachId('');
    setClassFeePlanId('');
    setClassStatus('active');
    setClassInfo('');
    setClassVisibility('public');
    setShowClassComposer(true);
    setShowPlanComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(false);
    setActiveAttendanceBatch(null);
    router.replace('/dashboard?section=academy-pro-classes');
  };

  const openCoachComposer = () => {
    setCoachName('');
    setCoachEmail('');
    setCoachTitle('');
    setCoachDesignation('');
    setCoachPassword(`Coach@${Math.random().toString(36).slice(-6)}A1`);
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('coach');
    setAcademyProExpanded(true);
    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowClientComposer(false);
    setShowCoachComposer(true);
    setActiveAttendanceBatch(null);
    router.replace('/dashboard?section=academy-pro-coach');
  };

  const openAttendanceMarker = async (batchId: string) => {
    const targetRow = academyClassRows.find((row) => row.id === batchId);
    if (!targetRow) return;

    const assignedStudents = attendanceStudents
      .filter((student) => {
        const studentBatchId = typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '';
        return studentBatchId === batchId;
      })
      .map((student) => {
        const existing = attendanceEntries.find((entry) => {
          const entryStudentId = typeof entry.studentId === 'string' ? entry.studentId : entry.studentId?._id;
          const entryBatchId = typeof entry.batchId === 'string' ? entry.batchId : entry.batchId?._id;
          return entryStudentId === student._id && entryBatchId === batchId;
        });

        return {
          studentId: student._id,
          name: student.name,
          phone: student.parentPhone,
          status: existing?.status || 'present'
        };
      });

    setActiveAttendanceBatch({
      id: batchId,
      title: targetRow.title,
      centerName: targetRow.centerName
    });
    setAttendanceDraftRecords(assignedStudents);
  };

  const toggleDraftAttendance = (studentId: string) => {
    setAttendanceDraftRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId
          ? { ...record, status: record.status === 'present' ? 'absent' : 'present' }
          : record
      )
    );
  };

  const submitBatchAttendance = async () => {
    if (!activeAttendanceBatch || attendanceDraftRecords.length === 0) return;

    const ok = await runAction(
      () =>
        apiPostWithAuth(
          '/attendance/mark',
          {
            batchId: activeAttendanceBatch.id,
            date: academyAttendanceDate,
            records: attendanceDraftRecords.map((record) => ({
              studentId: record.studentId,
              status: record.status
            }))
          },
          token
        ),
      'Attendance marked successfully'
    );

    if (ok) {
      setActiveAttendanceBatch(null);
      setAttendanceDraftRecords([]);
      if (token) {
        await loadAttendanceByDate(token, academyAttendanceDate);
      }
    }
  };

  const openClassEditor = (row: (typeof academyClassRows)[number]) => {
    const parsedLevel = row.title.match(/\(([^)]+)\)\s*$/)?.[1] || '';
    const titleWithoutLevel = row.title.replace(/\s*\([^)]+\)\s*$/, '').trim();
    const nameParts = splitBatchAndClass(titleWithoutLevel);

    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('classes');
    setAcademyProExpanded(true);
    setClassEditBatchId(row.id);
    setClassBatchName(nameParts.batchName || titleWithoutLevel || row.title);
    setClassTitle(nameParts.classTitle || '');
    setClassSkill(row.skill);
    setClassCenter(row.centerName);
    setClassLevel(parsedLevel);
    setClassCapacity(String(row.capacity));
    setClassScheduleDays(
      row.scheduleDays
        .split(',')
        .map((day) => day.trim().toLowerCase())
        .filter(Boolean)
    );
    setClassStartTime(row.timing.split(' - ')[0] || '17:00');
    setClassEndTime(row.timing.split(' - ')[1] || '18:00');
    setClassCoachId(row.coachId);
    setClassFeePlanId(row.feePlanId);
    setClassStatus(row.status);
    setShowClassComposer(true);
    setShowPlanComposer(false);
    setShowCoachComposer(false);
    router.replace('/dashboard?section=academy-pro-classes');
  };

  const handleClassStatusToggle = (row: (typeof academyClassRows)[number]) => {
    runAction(
      () =>
        apiPutWithAuth(
          `/batches/${row.id}`,
          {
            status: row.status === 'active' ? 'inactive' : 'active'
          },
          token
        ),
      `Class marked ${row.status === 'active' ? 'inactive' : 'active'}`
    );
  };

  const handleClassCoachAssign = (batchId: string, coachId: string) => {
    runAction(
      () =>
        apiPutWithAuth(
          `/batches/${batchId}`,
          {
            coachId: coachId || null
          },
          token
        ),
      coachId ? 'Coach assigned' : 'Coach unassigned'
    );
  };

  const persistClientMeta = (nextMeta: Record<string, ClientMeta>) => {
    setClientMetaByStudentId(nextMeta);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_META_STORAGE_KEY, JSON.stringify(nextMeta));
    }
  };

  const generateInvoiceNo = () => `INV-${Date.now().toString().slice(-6)}`;

  const resetClientComposer = () => {
    setClientEditingId(null);
    setClientFullName('');
    setClientGender('male');
    setClientEmail('');
    setClientRollNo('');
    setClientMobileCode('+91');
    setClientMobile('');
    setClientPhotoDataUrl('');
    setClientPhotoFileName('');
    setInvoiceDate('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    setInvoiceRemarks('');
    setSubscriptionLevel('');
    setSubscriptionType('subscription');
    setSubscriptionPlanId('');
    setSubscriptionClassId('');
    setSubscriptionStartDate('');
    setSubscriptionEndDate('');
    setSubscriptionAutoRenew(false);
  };

  const openClientComposerForCreate = () => {
    resetClientComposer();
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('clients');
    setAcademyProExpanded(true);
    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowCoachComposer(false);
    setShowClientComposer(true);
    setActiveAttendanceBatch(null);
    router.replace('/dashboard?section=academy-pro-clients');
  };

  const openClientComposerForEdit = (student: Student) => {
    const meta = clientMetaByStudentId[student._id] || {};
    const batchId =
      typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '';

    setClientEditingId(student._id);
    setClientFullName(student.name || '');
    setClientGender((student.gender as 'male' | 'female' | 'other') || 'male');
    setClientEmail(student.email || '');
    setClientRollNo(meta.rollNo || '');
    setClientMobileCode('+91');
    setClientMobile(student.parentPhone || '');
    setClientPhotoDataUrl(meta.photoDataUrl || '');
    setClientPhotoFileName(meta.photoFileName || '');
    setInvoiceDate(meta.invoiceDate || new Date().toISOString().slice(0, 10));
    setInvoiceNumber(meta.invoiceNumber || generateInvoiceNo());
    setInvoiceAmount(meta.invoiceAmount || '');
    setInvoiceRemarks(meta.invoiceRemarks || '');
    setSubscriptionLevel(meta.subscriptionLevel || '');
    setSubscriptionType(meta.subscriptionType || 'subscription');
    setSubscriptionPlanId(meta.subscriptionPlanId || feePlans[0]?._id || '');
    setSubscriptionClassId(meta.subscriptionClassId || batchId || '');
    setSubscriptionStartDate(meta.subscriptionStartDate || new Date().toISOString().slice(0, 10));
    setSubscriptionEndDate(meta.subscriptionEndDate || '');
    setSubscriptionAutoRenew(Boolean(meta.subscriptionAutoRenew));
    setActiveMenu('Academy Pro');
    setActiveTab('academy-pro');
    setActiveAcademyPro('clients');
    setAcademyProExpanded(true);
    setShowPlanComposer(false);
    setShowClassComposer(false);
    setShowCoachComposer(false);
    setShowClientComposer(true);
    setActiveAttendanceBatch(null);
    router.replace('/dashboard?section=academy-pro-clients');
  };

  const handleClientPhotoUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setClientPhotoDataUrl(String(reader.result || ''));
      setClientPhotoFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submitClientComposer = async () => {
    const normalizedPhone = `${clientMobileCode}${clientMobile}`.trim();
    const normalizedEmail = clientEmail.trim();

    const ok = await runAction(
      async () => {
        const studentPayload = {
          name: clientFullName.trim(),
          age: 12,
          gender: clientGender,
          parentName: clientFullName.trim(),
          parentPhone: normalizedPhone,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          batchId: subscriptionClassId || null,
          feeStatus: Number(invoiceAmount || '0') > 0 ? 'paid' : 'pending'
        };

        const studentResult = clientEditingId
          ? await apiPutWithAuth<Student>(`/students/${clientEditingId}`, studentPayload, token)
          : await apiPostWithAuth<Student>('/students', studentPayload, token);

        const studentId = clientEditingId || studentResult._id;

        if (subscriptionPlanId && studentId) {
          await apiPostWithAuth(
            '/fees/student-fees/assign',
            {
              studentId,
              feePlanId: subscriptionPlanId,
              startDate: `${subscriptionStartDate || invoiceDate}T00:00:00.000Z`
            },
            token
          );
        }

        const nextMeta: Record<string, ClientMeta> = {
          ...clientMetaByStudentId,
          [studentId]: {
            photoDataUrl: clientPhotoDataUrl || undefined,
            photoFileName: clientPhotoFileName || undefined,
            rollNo: clientRollNo || undefined,
            invoiceDate,
            invoiceNumber,
            invoiceAmount,
            invoiceRemarks,
            subscriptionLevel,
            subscriptionType,
            subscriptionPlanId,
            subscriptionClassId,
            subscriptionStartDate,
            subscriptionEndDate,
            subscriptionAutoRenew
          }
        };
        persistClientMeta(nextMeta);

        return studentResult;
      },
      clientEditingId ? 'Client updated' : 'Client added'
    );

    if (ok) {
      setShowClientComposer(false);
    }
  };

  const submitCoach = async () => {
    const ok = await runAction(
      () =>
        apiPostWithAuth(
          '/team-members',
          {
            fullName: coachName.trim(),
            email: coachEmail.trim().toLowerCase(),
            title: coachTitle.trim(),
            designation: coachDesignation.trim(),
            role: 'Coach',
            password: coachPassword
          },
          token
        ),
      'Coach added successfully'
    );

    if (ok) {
      setShowCoachComposer(false);
      setCoachName('');
      setCoachEmail('');
      setCoachTitle('');
      setCoachDesignation('');
      setCoachPassword(`Coach@${Math.random().toString(36).slice(-6)}A1`);
    }
  };

  const exportClientsCsv = () => {
    const headers = [
      'Name',
      'Gender',
      'Email',
      'Mobile',
      'Subscription',
      'Class',
      'Attendance Present',
      'Attendance Absent',
      'Roll No',
      'Level',
      'Receivable',
      'Invoice Date',
      'Invoice Number',
      'Invoice Amount',
      'Invoice Remarks',
      'Subscription Type',
      'Subscription Start',
      'Subscription End',
      'Auto Renew',
      'Fee Status',
      'Client Status'
    ];

    const rows = students.map((student) => {
      const meta = clientMetaByStudentId[student._id];
      const selectedPlan = feePlans.find((plan) => plan._id === meta?.subscriptionPlanId);
      const selectedClass = academyClassRows.find((row) => row.id === meta?.subscriptionClassId);
      const invoiceAmountNumber = Number(meta?.invoiceAmount || 0);
      const receivable = Math.max(
        0,
        invoiceAmountNumber - (student.feeStatus === 'paid' ? invoiceAmountNumber : 0)
      );

      return [
        student.name,
        student.gender,
        student.email || '',
        student.parentPhone || '',
        selectedPlan?.name || '',
        selectedClass?.title || '',
        0,
        0,
        meta?.rollNo || '',
        meta?.subscriptionLevel || '',
        receivable,
        meta?.invoiceDate || '',
        meta?.invoiceNumber || '',
        meta?.invoiceAmount || '',
        meta?.invoiceRemarks || '',
        meta?.subscriptionType || '',
        meta?.subscriptionStartDate || '',
        meta?.subscriptionEndDate || '',
        meta?.subscriptionAutoRenew ? 'Yes' : 'No',
        student.feeStatus,
        student.status
      ];
    });

    const csv = [headers, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `client-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast('Client registry exported as CSV');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(115deg,#edf2ff_0%,#f8fbff_45%,#ecfff6_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-[0_22px_45px_-30px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">ArenaPilot OS</p>
            <h1 className="mt-2 text-xl font-bold">Command Deck</h1>
            <p className="mt-1 text-xs text-slate-300">Unified academy operations workspace</p>
          </div>

          <div className="mt-4 space-y-1.5">
            {leftMenu.map((item) => {
              if (item === 'Academy Pro') {
                return (
                  <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/80 p-1.5">
                    <button
                      onClick={handleAcademyProToggle}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium ${
                        activeMenu === 'Academy Pro' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>AcademyPRO</span>
                      <span
                        className={`inline-block text-base leading-none transition-transform duration-200 ${
                          academyProExpanded ? 'rotate-90' : ''
                        }`}
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                    {academyProExpanded ? (
                      <div className="mt-1 space-y-1 pl-2">
                        {academyProNav.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-1">
                            <button
                              onClick={() => handleAcademyProNavClick(sub.id)}
                              className={`flex-1 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                                activeAcademyPro === sub.id && activeMenu === 'Academy Pro'
                                  ? 'bg-white text-indigo-700'
                                  : 'text-slate-600 hover:bg-white'
                              }`}
                            >
                              {sub.label}
                            </button>
                            {sub.id === 'plans' ? (
                              <button
                                onClick={openPlanComposer}
                                className="rounded-lg px-2 py-1.5 text-lg font-semibold leading-none text-indigo-700 hover:bg-white"
                                aria-label="Add new plan"
                              >
                                +
                              </button>
                            ) : null}
                            {sub.id === 'classes' ? (
                              <button
                                onClick={openClassComposer}
                                className="rounded-lg px-2 py-1.5 text-lg font-semibold leading-none text-indigo-700 hover:bg-white"
                                aria-label="Add new class"
                              >
                                +
                              </button>
                            ) : null}
                            {sub.id === 'coach' ? (
                              <button
                                onClick={openCoachComposer}
                                className="rounded-lg px-2 py-1.5 text-lg font-semibold leading-none text-indigo-700 hover:bg-white"
                                aria-label="Add new coach"
                              >
                                +
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={item}
                  onClick={() => handleMenuClick(item)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                    activeMenu === item
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Operator</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{user?.fullName || '...'}</p>
            <p className="text-xs text-slate-600">{user?.role || ''}</p>
            <button onClick={logout} className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Logout
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <header className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_22px_45px_-30px_rgba(15,23,42,0.55)] backdrop-blur sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Live Operations</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Welcome, {user?.fullName?.split(' ')[0] || 'Coach'}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Monitor schedule flow, fee pressure and communication events from one board.
                </p>
                <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Active: {activeMenu}
                </p>
              </div>

              <div className="rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b_45%,#065f46)] p-4 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Current Plan</p>
                <p className="mt-2 text-xl font-bold">{billing?.plan?.name || 'Trial Window'}</p>
                <p className="mt-1 text-xs text-slate-200">
                  {billing?.plan ? `${billing.plan.studentLimit} learner cap` : 'Upgrade anytime'}
                </p>
                <button onClick={() => token && loadDashboardData(token)} className="mt-3 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
                  Refresh Snapshot
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {headerTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
                    activeTab === tab
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading arena data...</div>
          ) : null}

          {!loading && activeTab === 'pulse' ? (
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Active Students</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{activeStudentsCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Learners currently active</p>
                </article>
                <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-sky-700">Today Attendance Rate</p>
                  <p className="mt-1 text-3xl font-extrabold text-sky-800">{todayAttendanceRate}%</p>
                  <p className="mt-1 text-xs text-sky-700">Present ratio today</p>
                </article>
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Fee Collection Ratio</p>
                  <p className="mt-1 text-3xl font-extrabold text-emerald-800">{feeCollectionRatio}%</p>
                  <p className="mt-1 text-xs text-emerald-700">Current payment health</p>
                </article>
                <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Pending Fee Count</p>
                  <p className="mt-1 text-3xl font-extrabold text-amber-800">{pendingStudentsCount}</p>
                  <p className="mt-1 text-xs text-amber-700">Needs follow-up</p>
                </article>
                <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Active Batches</p>
                  <p className="mt-1 text-3xl font-extrabold text-indigo-800">{activeBatchesCount}</p>
                  <p className="mt-1 text-xs text-indigo-700">Running groups</p>
                </article>
              </section>

              <section className="rounded-2xl border border-rose-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Attention Needed</h3>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">High Priority</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Absent 3+ Days</p>
                    <p className="mt-1 text-2xl font-bold text-rose-800">{absent3PlusStudents.length}</p>
                    <p className="mt-1 text-xs text-rose-700">
                      {absent3PlusStudents.slice(0, 2).map((student) => student.name).join(', ') || 'No repeated absentee risk'}
                    </p>
                  </article>
                  <article className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Overdue Fees</p>
                    <p className="mt-1 text-2xl font-bold text-amber-800">{pendingStudentsCount}</p>
                    <p className="mt-1 text-xs text-amber-700">Students with pending receivables</p>
                  </article>
                  <article className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">Full Capacity Batches</p>
                    <p className="mt-1 text-2xl font-bold text-orange-800">{fullCapacityBatchRows.length}</p>
                    <p className="mt-1 text-xs text-orange-700">
                      {fullCapacityBatchRows.slice(0, 1).map((row) => row.title).join(', ') || 'Capacity under control'}
                    </p>
                  </article>
                  <article className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Failed Notifications</p>
                    <p className="mt-1 text-2xl font-bold text-rose-800">{automationPulse.failedMessages}</p>
                    <p className="mt-1 text-xs text-rose-700">Delivery retries required</p>
                  </article>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-12">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Revenue Pulse</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        revenuePulse.trendPercent < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {revenuePulse.trendPercent > 0 ? '+' : ''}
                      {revenuePulse.trendPercent}%
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Monthly Expected Revenue</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(revenuePulse.expectedRevenue)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700">Collected Amount</p>
                      <p className="text-2xl font-bold text-emerald-800">{formatCurrency(revenuePulse.collectedAmount)}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                      <p className="text-xs text-amber-700">Collection Gap</p>
                      <p className="text-2xl font-bold text-amber-800">{formatCurrency(revenuePulse.collectionGap)}</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Automation Status</h3>
                    <span className="text-xs text-slate-500">Read-only</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700">Reminders Sent Today</p>
                      <p className="text-2xl font-bold text-emerald-800">{automationPulse.remindersSentToday}</p>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs text-sky-700">Queued Notifications</p>
                      <p className="text-2xl font-bold text-sky-800">{automationPulse.queuedNotifications}</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs text-rose-700">Failed Messages</p>
                      <p className="text-2xl font-bold text-rose-800">{automationPulse.failedMessages}</p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Academy Growth Pulse</h3>
                  <span className="text-xs text-slate-500">Student, attendance, batch activity</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <svg viewBox="0 0 520 190" className="h-[190px] w-full min-w-[460px]">
                    <polyline points={growthPulseChart.student} fill="none" stroke="#4f46e5" strokeWidth="3" />
                    <polyline points={growthPulseChart.attendance} fill="none" stroke="#0ea5e9" strokeWidth="3" />
                    <polyline points={growthPulseChart.batch} fill="none" stroke="#16a34a" strokeWidth="3" />
                  </svg>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1 text-indigo-700"><span className="h-2 w-2 rounded-full bg-indigo-600" />Student Growth</span>
                  <span className="inline-flex items-center gap-1 text-sky-700"><span className="h-2 w-2 rounded-full bg-sky-500" />Attendance Trend</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Batch Activity</span>
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === 'academy-pro' ? (
            <div className="grid gap-4 xl:grid-cols-12">
              {activeAcademyPro === 'plans' ? (
                <>
                  {showPlanComposer ? (
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-12">
                      <div className="mx-auto max-w-5xl">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Academy Pro</p>
                            <h3 className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Add New Plan</h3>
                            <p className="mt-2 text-lg text-slate-500">Create plan for Academy Pro catalog.</p>
                          </div>
                          <button
                            onClick={() => setShowPlanComposer(false)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Back to Plans
                          </button>
                        </div>

                        <div className="grid gap-4">
                          <input
                            className="rounded-3xl border border-slate-300 px-6 py-5 text-2xl text-slate-900 placeholder:text-slate-400"
                            value={feePlanName}
                            onChange={(e) => setFeePlanName(e.target.value)}
                            placeholder="Plan title"
                          />
                          <input
                            className="rounded-3xl border border-slate-300 px-6 py-5 text-2xl text-slate-900 placeholder:text-slate-400"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                            placeholder="Amount"
                          />
                          <input
                            className="rounded-3xl border border-slate-300 px-6 py-5 text-2xl text-slate-900 placeholder:text-slate-400"
                            value={feeMonths}
                            onChange={(e) => setFeeMonths(e.target.value)}
                            placeholder="Duration months"
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            disabled={actionLoading}
                            onClick={async () => {
                              const created = await runAction(
                                () =>
                                  apiPostWithAuth(
                                    '/fees/plans',
                                    {
                                      name: feePlanName.trim(),
                                      amount: Number(feeAmount),
                                      durationMonths: Number(feeMonths),
                                      description: 'Created from Academy Pro plans panel'
                                    },
                                    token
                                  ),
                                'Plan created in Academy Pro'
                              );

                              if (created) {
                                setShowPlanComposer(false);
                              }
                            }}
                            className="rounded-2xl bg-indigo-600 px-8 py-3 text-2xl font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
                          >
                            {actionLoading ? 'Processing...' : 'Create Plan'}
                          </button>
                          <button
                            onClick={() => setShowPlanComposer(false)}
                            className="rounded-2xl border border-slate-300 px-6 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </article>
                  ) : (
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Academy Pro Plans</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{feePlans.length} plans</span>
                          <button
                            onClick={openPlanComposer}
                            className="rounded-full bg-indigo-600 px-2.5 py-1 text-lg font-semibold leading-none text-white hover:bg-indigo-500"
                            aria-label="Add new plan"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2 font-semibold">Title</th>
                              <th className="px-2 py-2 font-semibold">Duration</th>
                              <th className="px-2 py-2 font-semibold">Amount</th>
                              <th className="px-2 py-2 font-semibold">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feePlans.length === 0 ? (
                              <tr>
                                <td className="px-2 py-3 text-slate-500" colSpan={4}>
                                  No plans yet. Click + to create your first plan.
                                </td>
                              </tr>
                            ) : null}
                            {feePlans.map((plan) => (
                              <tr key={plan._id} className="border-b border-slate-100">
                                <td className="px-2 py-2 font-semibold text-slate-900">{plan.name}</td>
                                <td className="px-2 py-2 text-slate-700">{plan.durationMonths} month</td>
                                <td className="px-2 py-2 text-slate-900">{formatCurrency(plan.amount)}</td>
                                <td className="px-2 py-2 text-xs text-slate-500">
                                  {plan.durationMonths > 1 ? 'Subscription' : 'Monthly'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}
                </>
              ) : null}

              {activeAcademyPro === 'classes' ? (
                <>
                  {showClassComposer ? (
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-12">
                      <div className="mx-auto max-w-5xl">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Academy Pro</p>
                            <h3 className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                              {classEditBatchId ? 'Edit Class' : 'Add New Class'}
                            </h3>
                            <p className="mt-2 text-lg text-slate-500">Create class with schedule, plan and optional coach assignment.</p>
                          </div>
                          <button
                            onClick={() => setShowClassComposer(false)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Back to Classes
                          </button>
                        </div>

                        <div className="grid gap-4">
                          <input
                            className="w-full rounded-3xl border border-slate-300 px-6 py-5 text-2xl text-slate-900 placeholder:text-slate-400"
                            value={classBatchName}
                            onChange={(e) => setClassBatchName(e.target.value)}
                            placeholder="Batch name"
                          />
                          <input
                            className="w-full rounded-3xl border border-slate-300 px-6 py-5 text-2xl text-slate-900 placeholder:text-slate-400"
                            value={classTitle}
                            onChange={(e) => setClassTitle(e.target.value)}
                            placeholder="Class title (optional)"
                          />
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classSkill}
                              onChange={(e) => setClassSkill(e.target.value)}
                              placeholder="Sport / Skill"
                            />
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classCenter}
                              onChange={(e) => setClassCenter(e.target.value)}
                              placeholder="Center name"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classLevel}
                              onChange={(e) => setClassLevel(e.target.value)}
                              placeholder="Level (Beginner/Advanced)"
                            />
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classCapacity}
                              onChange={(e) => setClassCapacity(e.target.value)}
                              placeholder="Class capacity"
                            />
                          </div>
                          <select
                            className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                            value={classStatus}
                            onChange={(e) => setClassStatus(e.target.value as 'active' | 'inactive')}
                          >
                            <option value="active">Status: Active</option>
                            <option value="inactive">Status: Inactive</option>
                          </select>
                          <select
                            className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                            value={classCoachId}
                            onChange={(e) => setClassCoachId(e.target.value)}
                          >
                            <option value="">No coach assigned (optional)</option>
                            {coaches.map((coach) => (
                              <option key={coach.id} value={coach.id}>
                                {coach.fullName}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                            value={classFeePlanId}
                            onChange={(e) => setClassFeePlanId(e.target.value)}
                          >
                            <option value="">Attach plan (optional)</option>
                            {feePlans.map((plan) => (
                              <option key={plan._id} value={plan._id}>
                                {plan.name} - {formatCurrency(plan.amount)}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classStartTime}
                              onChange={(e) => setClassStartTime(e.target.value)}
                              placeholder="Start HH:mm"
                            />
                            <input
                              className="rounded-2xl border border-slate-300 px-5 py-4 text-xl"
                              value={classEndTime}
                              onChange={(e) => setClassEndTime(e.target.value)}
                              placeholder="End HH:mm"
                            />
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="mb-2 text-sm font-semibold text-slate-700">Schedule Days</p>
                            <div className="flex flex-wrap gap-2">
                              {weekDayOptions.map((day) => {
                                const selected = classScheduleDays.includes(day.value);
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() =>
                                      setClassScheduleDays((prev) =>
                                        prev.includes(day.value) ? prev.filter((d) => d !== day.value) : [...prev, day.value]
                                      )
                                    }
                                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                                      selected
                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                              <input
                                type="radio"
                                name="classVisibility"
                                checked={classVisibility === 'public'}
                                onChange={() => setClassVisibility('public')}
                              />
                              Public class
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                              <input
                                type="radio"
                                name="classVisibility"
                                checked={classVisibility === 'private'}
                                onChange={() => setClassVisibility('private')}
                              />
                              Private class
                            </label>
                          </div>

                          <textarea
                            className="h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg"
                            value={classInfo}
                            onChange={(e) => setClassInfo(e.target.value)}
                            placeholder="Class information"
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            disabled={
                              actionLoading ||
                              !classBatchName.trim() ||
                              !classSkill.trim() ||
                              !classCenter.trim() ||
                              classScheduleDays.length === 0 ||
                              !classStartTime.trim() ||
                              !classEndTime.trim() ||
                              !classCapacity.trim()
                            }
                            onClick={async () => {
                              const created = await runAction(
                                () => {
                                  const payload = {
                                    name: `${classBatchName.trim()}${classTitle.trim() ? ` - ${classTitle.trim()}` : ''} (${
                                      classLevel.trim() || 'General'
                                    })`,
                                    centerName: classCenter.trim() || 'Main Center',
                                    sportType: classSkill.trim(),
                                    ...(classCoachId ? { coachId: classCoachId } : {}),
                                    feePlanId: classFeePlanId || null,
                                    scheduleDays: classScheduleDays,
                                    startTime: classStartTime.trim(),
                                    endTime: classEndTime.trim(),
                                    capacity: Number(classCapacity),
                                    ...(classEditBatchId ? { status: classStatus } : {})
                                  };

                                  if (classEditBatchId) {
                                    return apiPutWithAuth(`/batches/${classEditBatchId}`, payload, token);
                                  }

                                  return apiPostWithAuth('/batches', payload, token);
                                },
                                classEditBatchId ? 'Class updated successfully' : 'Class created with selected settings'
                              );

                              if (created) {
                                setShowClassComposer(false);
                              }
                            }}
                            className="rounded-2xl bg-slate-900 px-8 py-3 text-2xl font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {actionLoading ? 'Processing...' : classEditBatchId ? 'Update Class' : 'Create Class'}
                          </button>
                          <button
                            onClick={() => setShowClassComposer(false)}
                            className="rounded-2xl border border-slate-300 px-6 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Visibility: {classVisibility} | Note: {classInfo.slice(0, 70) || '-'}</p>
                      </div>
                    </article>
                  ) : (
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-900">Class Registry</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{filteredClassRows.length} classes</span>
                          <button
                            onClick={openClassComposer}
                            className="rounded-full bg-indigo-600 px-2.5 py-1 text-lg font-semibold leading-none text-white hover:bg-indigo-500"
                            aria-label="Add new class"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setClassStatusFilter('active')}
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            classStatusFilter === 'active' ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700'
                          }`}
                        >
                          Active
                        </button>
                        <button
                          onClick={() => setClassStatusFilter('inactive')}
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            classStatusFilter === 'inactive' ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700'
                          }`}
                        >
                          Inactive
                        </button>
                        <input
                          value={classSearchText}
                          onChange={(e) => setClassSearchText(e.target.value)}
                          className="ml-auto min-w-[220px] rounded-full border border-slate-300 px-4 py-1.5 text-sm"
                          placeholder="Search classes"
                        />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2 font-semibold">Title</th>
                              <th className="px-2 py-2 font-semibold">Center</th>
                              <th className="px-2 py-2 font-semibold">Skill</th>
                              <th className="px-2 py-2 font-semibold">Coach</th>
                              <th className="px-2 py-2 font-semibold">Plan</th>
                              <th className="px-2 py-2 font-semibold">Timing</th>
                              <th className="px-2 py-2 font-semibold">Status</th>
                              <th className="px-2 py-2 font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredClassRows.length === 0 ? (
                              <tr>
                                <td className="px-2 py-3 text-slate-500" colSpan={8}>
                                  No classes in this view.
                                </td>
                              </tr>
                            ) : null}
                            {filteredClassRows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-2 py-2 font-semibold text-slate-900">{row.title}</td>
                                <td className="px-2 py-2 text-slate-700">{row.centerName}</td>
                                <td className="px-2 py-2 text-slate-700">{row.skill}</td>
                                <td className="px-2 py-2 text-slate-700">
                                  <select
                                    value={row.coachId}
                                    onChange={(e) => handleClassCoachAssign(row.id, e.target.value)}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {coaches.map((coach) => (
                                      <option key={coach.id} value={coach.id}>
                                        {coach.fullName}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-2 text-slate-700">{row.planName}</td>
                                <td className="px-2 py-2 text-slate-700">{row.timing}</td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleClassStatusToggle(row)}
                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {row.status}
                                  </button>
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => openClassEditor(row)}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}
                </>
              ) : null}

              {activeAcademyPro === 'class-schedule' ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Class Schedule</h3>
                    <span className="text-xs text-slate-500">{scheduleRows.length} classes</span>
                  </div>
                  <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Date
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Center
                      <select
                        value={scheduleCenterFilter}
                        onChange={(e) => setScheduleCenterFilter(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                      >
                        <option value="all">All centers</option>
                        {Array.from(new Set(academyClassRows.map((row) => row.centerName))).map((centerName) => (
                          <option key={centerName} value={centerName}>
                            {centerName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Batch/Class
                      <select
                        value={scheduleBatchFilter}
                        onChange={(e) => setScheduleBatchFilter(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                      >
                        <option value="all">All classes</option>
                        {academyClassRows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-2 font-semibold">Class</th>
                          <th className="px-2 py-2 font-semibold">Days</th>
                          <th className="px-2 py-2 font-semibold">Time</th>
                          <th className="px-2 py-2 font-semibold">Coach</th>
                          <th className="px-2 py-2 font-semibold">Center</th>
                          <th className="px-2 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleRows.length === 0 ? (
                          <tr>
                            <td className="px-2 py-3 text-slate-500" colSpan={6}>
                              No classes found for selected filters.
                            </td>
                          </tr>
                        ) : null}
                        {scheduleRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-semibold text-slate-900">{row.title}</td>
                            <td className="px-2 py-2 text-slate-700">{row.scheduleDays}</td>
                            <td className="px-2 py-2 text-slate-700">{row.timing}</td>
                            <td className="px-2 py-2 text-slate-700">{row.coachName}</td>
                            <td className="px-2 py-2 text-slate-700">{row.centerName}</td>
                            <td className="px-2 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}

              {activeAcademyPro === 'attendance' ? (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Attendance</h3>
                      <p className="text-sm text-slate-600">All classes with attendance actions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={academyAttendanceDate}
                        onChange={(e) => setAcademyAttendanceDate(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Scheduled Classes</p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-900">{academyAttendanceRows.length}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">Present</p>
                      <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                        {attendanceEntries.filter((entry) => entry.status === 'present').length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-rose-700">Absent</p>
                      <p className="mt-1 text-2xl font-extrabold text-rose-800">
                        {attendanceEntries.filter((entry) => entry.status === 'absent').length}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="px-3 py-3 font-semibold">Class</th>
                          <th className="px-3 py-3 font-semibold">Center</th>
                          <th className="px-3 py-3 font-semibold">Capacity</th>
                          <th className="px-3 py-3 font-semibold">Enrolled</th>
                          <th className="px-3 py-3 font-semibold">Attendance</th>
                          <th className="px-3 py-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {academyAttendanceRows.length === 0 ? (
                          <tr>
                            <td className="px-3 py-5 text-center text-slate-500" colSpan={6}>
                              No classes found.
                            </td>
                          </tr>
                        ) : null}
                        {academyAttendanceRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="px-3 py-3 font-semibold text-slate-900">{row.title}</td>
                            <td className="px-3 py-3 text-slate-700">{row.centerName}</td>
                            <td className="px-3 py-3 text-slate-700">{row.capacity}</td>
                            <td className="px-3 py-3 text-slate-700">{row.enrolled}</td>
                            <td className="px-3 py-3 text-slate-700">{row.attendanceText}</td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => openAttendanceMarker(row.id)}
                                className="rounded-full border border-slate-300 px-2.5 py-1 text-lg font-semibold leading-none text-slate-700 hover:bg-slate-100"
                                aria-label={`Mark attendance for ${row.title}`}
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {activeAttendanceBatch ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
                      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-xl font-bold text-slate-900">Mark Attendance</h4>
                            <p className="text-sm text-slate-600">
                              {activeAttendanceBatch.title} | {activeAttendanceBatch.centerName} | {academyAttendanceDate}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveAttendanceBatch(null);
                              setAttendanceDraftRecords([]);
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Close
                          </button>
                        </div>

                        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
                          {attendanceDraftRecords.length === 0 ? (
                            <div className="px-4 py-5 text-sm text-slate-500">No students assigned to this class.</div>
                          ) : null}
                          {attendanceDraftRecords.map((record) => (
                            <div key={record.studentId} className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-900">{record.name}</p>
                                <p className="text-xs text-slate-500">{record.phone}</p>
                              </div>
                              <button
                                onClick={() => toggleDraftAttendance(record.studentId)}
                                className={`h-9 min-w-9 rounded-full px-3 text-sm font-bold ${
                                  record.status === 'present'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                                title="Toggle Present/Absent"
                              >
                                {record.status === 'present' ? 'P' : 'A'}
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <p className="text-xs text-slate-500">Tap P/A button to toggle status.</p>
                          <button
                            onClick={submitBatchAttendance}
                            disabled={actionLoading || attendanceDraftRecords.length === 0}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                          >
                            {actionLoading ? 'Saving...' : 'Mark Attendance'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}

              {activeAcademyPro === 'clients' ? (
                <>
                  {showClientComposer ? (
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-12">
                      <div className="mx-auto max-w-5xl">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Academy Pro</p>
                            <h3 className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                              {clientEditingId ? 'Edit Client' : 'New Client'}
                            </h3>
                            <p className="mt-2 text-lg text-slate-500">
                              Add client profile, invoice details and subscription in one flow.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowClientComposer(false)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Back to Clients
                          </button>
                        </div>

                        <div className="grid gap-4">
                          <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                            <h4 className="text-lg font-bold text-slate-900">Client Profile</h4>
                            <div className="mt-4 flex flex-col items-center gap-3">
                              <label className="group flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-white">
                                {clientPhotoDataUrl ? (
                                  <img src={clientPhotoDataUrl} alt="Client" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700">Upload Photo</span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleClientPhotoUpload(e.target.files?.[0] || null)}
                                />
                              </label>
                              {clientPhotoFileName ? <p className="text-xs text-slate-500">{clientPhotoFileName}</p> : null}
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <input
                                value={clientFullName}
                                onChange={(e) => setClientFullName(e.target.value)}
                                placeholder="Full name"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <input
                                value={clientRollNo}
                                onChange={(e) => setClientRollNo(e.target.value)}
                                placeholder="Roll no"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <select
                                value={clientGender}
                                onChange={(e) => setClientGender(e.target.value as 'male' | 'female' | 'other')}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                              <input
                                value={clientEmail}
                                onChange={(e) => setClientEmail(e.target.value)}
                                placeholder="Email"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <div className="grid grid-cols-[110px_1fr] gap-2">
                                <select
                                  value={clientMobileCode}
                                  onChange={(e) => setClientMobileCode(e.target.value)}
                                  className="rounded-2xl border border-slate-300 px-3 py-3"
                                >
                                  <option value="+91">IND +91</option>
                                  <option value="+1">US +1</option>
                                  <option value="+44">UK +44</option>
                                </select>
                                <input
                                  value={clientMobile}
                                  onChange={(e) => setClientMobile(e.target.value)}
                                  placeholder="Mobile"
                                  className="rounded-2xl border border-slate-300 px-4 py-3"
                                />
                              </div>
                            </div>
                          </section>

                          <section className="rounded-3xl border border-slate-200 bg-white p-5">
                            <h4 className="text-lg font-bold text-slate-900">Invoice Details</h4>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <input
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <input
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="Invoice number"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <input
                                value={invoiceAmount}
                                onChange={(e) => setInvoiceAmount(e.target.value)}
                                placeholder="Amount"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <input
                                value={invoiceRemarks}
                                onChange={(e) => setInvoiceRemarks(e.target.value)}
                                placeholder="Remarks"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                            </div>
                          </section>

                          <section className="rounded-3xl border border-slate-200 bg-white p-5">
                            <h4 className="text-lg font-bold text-slate-900">Subscription Details</h4>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <input
                                value={subscriptionLevel}
                                onChange={(e) => setSubscriptionLevel(e.target.value)}
                                placeholder="Level"
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    checked={subscriptionType === 'subscription'}
                                    onChange={() => setSubscriptionType('subscription')}
                                  />
                                  Subscription
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    checked={subscriptionType === 'trial'}
                                    onChange={() => setSubscriptionType('trial')}
                                  />
                                  Trial
                                </label>
                              </div>
                              <select
                                value={subscriptionPlanId}
                                onChange={(e) => setSubscriptionPlanId(e.target.value)}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              >
                                <option value="">Select plan</option>
                                {feePlans.map((plan) => (
                                  <option key={plan._id} value={plan._id}>
                                    {plan.name} - {formatCurrency(plan.amount)}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={subscriptionClassId}
                                onChange={(e) => setSubscriptionClassId(e.target.value)}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              >
                                <option value="">Select class</option>
                                {academyClassRows.map((row) => (
                                  <option key={row.id} value={row.id}>
                                    {row.title}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="date"
                                value={subscriptionStartDate}
                                onChange={(e) => setSubscriptionStartDate(e.target.value)}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                              <input
                                type="date"
                                value={subscriptionEndDate}
                                onChange={(e) => setSubscriptionEndDate(e.target.value)}
                                className="rounded-2xl border border-slate-300 px-4 py-3"
                              />
                            </div>
                            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={subscriptionAutoRenew}
                                onChange={(e) => setSubscriptionAutoRenew(e.target.checked)}
                              />
                              Auto renew
                            </label>
                          </section>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            onClick={submitClientComposer}
                            disabled={actionLoading || !clientFullName.trim() || !clientMobile.trim()}
                            className="rounded-2xl bg-slate-900 px-8 py-3 text-2xl font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {actionLoading ? 'Processing...' : clientEditingId ? 'Update Client' : 'Add Client'}
                          </button>
                          <button
                            onClick={() => setShowClientComposer(false)}
                            className="rounded-2xl border border-slate-300 px-6 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </article>
                  ) : (
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">Client Registry</h3>
                          <p className="text-sm text-slate-600">
                            Active learners: {studentsTotal}, paid: {paidStudentsCount}, pending: {pendingStudentsCount}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={exportClientsCsv}
                            title="Export clients"
                            aria-label="Export clients"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v12" />
                              <path d="M7 10l5 5 5-5" />
                              <path d="M4 21h16" />
                            </svg>
                          </button>
                          <button
                            onClick={openClientComposerForCreate}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                          >
                            + Add Client
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="px-2 py-2 font-semibold">Name</th>
                              <th className="px-2 py-2 font-semibold">Subscription</th>
                              <th className="px-2 py-2 font-semibold">Class</th>
                              <th className="px-2 py-2 font-semibold">Attendance</th>
                              <th className="px-2 py-2 font-semibold">Roll no</th>
                              <th className="px-2 py-2 font-semibold">Level</th>
                              <th className="px-2 py-2 font-semibold">Receivable</th>
                              <th className="px-2 py-2 font-semibold">Edit User</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.length === 0 ? (
                              <tr>
                                <td className="px-2 py-3 text-slate-500" colSpan={8}>
                                  No clients found. Click Add Client.
                                </td>
                              </tr>
                            ) : null}
                            {students.map((student) => {
                              const meta = clientMetaByStudentId[student._id];
                              const selectedPlan = feePlans.find((plan) => plan._id === meta?.subscriptionPlanId);
                              const selectedClass = academyClassRows.find((row) => row.id === meta?.subscriptionClassId);
                              const receivable = Math.max(0, Number(meta?.invoiceAmount || 0) - (student.feeStatus === 'paid' ? Number(meta?.invoiceAmount || 0) : 0));
                              return (
                                <tr key={student._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                  <td className="px-2 py-2">
                                    <button
                                      onClick={() => openClientComposerForEdit(student)}
                                      className="flex items-center gap-2 text-left"
                                    >
                                      <span className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                        {meta?.photoDataUrl ? (
                                          <img src={meta.photoDataUrl} alt={student.name} className="h-full w-full object-cover" />
                                        ) : null}
                                      </span>
                                      <span className="font-semibold text-slate-900">{student.name}</span>
                                    </button>
                                  </td>
                                  <td className="px-2 py-2">
                                    <p className="font-medium text-slate-800">{selectedPlan?.name || '-'}</p>
                                    <p className="text-xs text-slate-500">
                                      {meta?.subscriptionStartDate || '-'} {meta?.subscriptionEndDate ? `to ${meta.subscriptionEndDate}` : ''}
                                    </p>
                                  </td>
                                  <td className="px-2 py-2 text-slate-700">{selectedClass?.title || '-'}</td>
                                  <td className="px-2 py-2 text-slate-700">
                                    <span className="font-semibold text-emerald-600">0</span>
                                    <span className="mx-1 text-slate-400">|</span>
                                    <span className="font-semibold text-rose-600">0</span>
                                  </td>
                                  <td className="px-2 py-2 text-slate-700">{meta?.rollNo || '-'}</td>
                                  <td className="px-2 py-2 text-slate-700">{meta?.subscriptionLevel || '-'}</td>
                                  <td className="px-2 py-2">
                                    <span className={`font-semibold ${receivable > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {formatCurrency(receivable)}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <button
                                      onClick={() => openClientComposerForEdit(student)}
                                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Edit User
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}
                </>
              ) : null}

              {activeAcademyPro === 'renewals' ? (
                <article className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 xl:col-span-12">
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Renewal Desk</h3>
                        <p className="text-sm text-slate-600">Track upcoming due payments with smart due windows.</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        Showing {renewalRows.length} clients
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Due Tomorrow</p>
                        <p className="mt-1 text-2xl font-extrabold text-slate-900">{renewalStats.dueToday}</p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Due in 5 Days</p>
                        <p className="mt-1 text-2xl font-extrabold text-amber-800">{renewalStats.dueNext5}</p>
                      </div>
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Due in 20 Days</p>
                        <p className="mt-1 text-2xl font-extrabold text-indigo-800">{renewalStats.dueNext20}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due Window Filters</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {renewalDueFilters.map((days) => (
                        <button
                          key={days}
                          onClick={() => setRenewalDueFilter(days)}
                          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                            renewalDueFilter === days
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {days} day
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="px-3 py-3 font-semibold">Client Name</th>
                          <th className="px-3 py-3 font-semibold">Batch</th>
                          <th className="px-3 py-3 font-semibold">Center</th>
                          <th className="px-3 py-3 font-semibold">Email</th>
                          <th className="px-3 py-3 font-semibold">Mobile</th>
                          <th className="px-3 py-3 font-semibold">Payment Date</th>
                          <th className="px-3 py-3 font-semibold">Due Date</th>
                          <th className="px-3 py-3 font-semibold">Due In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renewalRows.length === 0 ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                              No clients due in selected window.
                            </td>
                          </tr>
                        ) : null}
                        {renewalRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="px-3 py-3 font-semibold text-slate-900">{row.name}</td>
                            <td className="px-3 py-3 text-slate-700">{row.batchName}</td>
                            <td className="px-3 py-3 text-slate-700">{row.centerName}</td>
                            <td className="px-3 py-3 text-slate-700">{row.email}</td>
                            <td className="px-3 py-3 text-slate-700">{row.mobile}</td>
                            <td className="px-3 py-3 text-slate-700">{row.paymentDate}</td>
                            <td className="px-3 py-3 text-slate-700">{row.dueDate}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  row.dueInDays <= 3
                                    ? 'bg-rose-100 text-rose-700'
                                    : row.dueInDays <= 7
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {row.dueInDays} day
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}

              {activeAcademyPro === 'coach' ? (
                <article className="relative rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-12">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Coach Directory</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{coaches.length} coaches</span>
                      <button
                        onClick={openCoachComposer}
                        className="rounded-full bg-indigo-600 px-2.5 py-1 text-lg font-semibold leading-none text-white hover:bg-indigo-500"
                        aria-label="Add new coach"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-2 font-semibold">Name</th>
                          <th className="px-2 py-2 font-semibold">Email</th>
                          <th className="px-2 py-2 font-semibold">Title</th>
                          <th className="px-2 py-2 font-semibold">Designation</th>
                          <th className="px-2 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coaches.length === 0 ? (
                          <tr>
                            <td className="px-2 py-3 text-slate-500" colSpan={5}>
                              No coach records yet. Click + to add coach.
                            </td>
                          </tr>
                        ) : null}
                        {coaches.map((coach) => (
                          <tr key={coach.id} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-semibold text-slate-900">{coach.fullName}</td>
                            <td className="px-2 py-2 text-slate-700">{coach.email}</td>
                            <td className="px-2 py-2 text-slate-700">{coach.title || '-'}</td>
                            <td className="px-2 py-2 text-slate-700">{coach.designation || '-'}</td>
                            <td className="px-2 py-2">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">active</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showCoachComposer ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
                      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-lg font-bold text-slate-900">Add Coach</h4>
                          <button
                            type="button"
                            onClick={() => setShowCoachComposer(false)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid gap-3">
                          <input
                            value={coachName}
                            onChange={(e) => setCoachName(e.target.value)}
                            placeholder="Coach name"
                            className="rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <input
                            value={coachEmail}
                            onChange={(e) => setCoachEmail(e.target.value)}
                            placeholder="Coach email"
                            className="rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <input
                            value={coachTitle}
                            onChange={(e) => setCoachTitle(e.target.value)}
                            placeholder="Title"
                            className="rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <input
                            value={coachDesignation}
                            onChange={(e) => setCoachDesignation(e.target.value)}
                            placeholder="Designation"
                            className="rounded-xl border border-slate-300 px-3 py-2"
                          />
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                              value={coachPassword}
                              onChange={(e) => setCoachPassword(e.target.value)}
                              placeholder="Temporary login password"
                              className="rounded-xl border border-slate-300 px-3 py-2"
                            />
                            <button
                              type="button"
                              onClick={() => setCoachPassword(`Coach@${Math.random().toString(36).slice(-6)}A1`)}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Regenerate
                            </button>
                          </div>
                          <button
                            onClick={submitCoach}
                            disabled={actionLoading || !coachName.trim() || !coachEmail.trim() || !coachTitle.trim() || !coachDesignation.trim() || !coachPassword.trim()}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                          >
                            {actionLoading ? 'Saving...' : 'Add Coach'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </div>
          ) : null}

          {!loading && activeTab === 'studio' ? (
            <div className="space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Student Roster</h3>
                    <p className="text-sm text-slate-600">Manage academy students with clean search, filters and quick actions.</p>
                  </div>
                  <button
                    onClick={openClientComposerForCreate}
                    className="rounded-xl bg-[linear-gradient(135deg,#1d4ed8,#6366f1)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:opacity-95"
                  >
                    + Academy Pro New Client
                  </button>
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Students</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{attendanceStudents.length}</p>
                </article>
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Active</p>
                  <p className="mt-1 text-3xl font-extrabold text-emerald-800">
                    {attendanceStudents.filter((s) => s.status === 'active').length}
                  </p>
                </article>
                <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Paid</p>
                  <p className="mt-1 text-3xl font-extrabold text-indigo-800">
                    {attendanceStudents.filter((s) => s.feeStatus === 'paid').length}
                  </p>
                </article>
                <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Pending</p>
                  <p className="mt-1 text-3xl font-extrabold text-amber-800">
                    {attendanceStudents.filter((s) => s.feeStatus === 'pending').length}
                  </p>
                </article>
              </div>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="grid gap-3 md:grid-cols-[1fr_170px_170px]">
                  <input
                    value={rosterSearchText}
                    onChange={(e) => setRosterSearchText(e.target.value)}
                    placeholder="Search name, parent, mobile, email, class, center"
                    className="rounded-xl border border-slate-300 px-4 py-2.5"
                  />
                  <select
                    value={rosterStatusFilter}
                    onChange={(e) => setRosterStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="rounded-xl border border-slate-300 px-4 py-2.5"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={rosterFeeFilter}
                    onChange={(e) => setRosterFeeFilter(e.target.value as 'all' | 'paid' | 'pending')}
                    className="rounded-xl border border-slate-300 px-4 py-2.5"
                  >
                    <option value="all">All Fee Status</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="px-3 py-3 font-semibold">Student</th>
                        <th className="px-3 py-3 font-semibold">Parent</th>
                        <th className="px-3 py-3 font-semibold">Mobile</th>
                        <th className="px-3 py-3 font-semibold">Email</th>
                        <th className="px-3 py-3 font-semibold">Class</th>
                        <th className="px-3 py-3 font-semibold">Center</th>
                        <th className="px-3 py-3 font-semibold">Fee</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studioRosterRows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                            No students found.
                          </td>
                        </tr>
                      ) : null}
                      {studioRosterRows.map((student) => {
                        const batchId = typeof student.batchId === 'string' ? student.batchId : student.batchId?._id || '';
                        const classInfo = academyClassRows.find((row) => row.id === batchId);
                        return (
                          <tr key={student._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="px-3 py-3 font-semibold text-slate-900">{student.name}</td>
                            <td className="px-3 py-3 text-slate-700">{student.parentName}</td>
                            <td className="px-3 py-3 text-slate-700">{student.parentPhone}</td>
                            <td className="px-3 py-3 text-slate-700">{student.email || '-'}</td>
                            <td className="px-3 py-3 text-slate-700">{classInfo?.title || '-'}</td>
                            <td className="px-3 py-3 text-slate-700">{classInfo?.centerName || '-'}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${student.feeStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {student.feeStatus}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${student.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                                {student.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => openClientComposerForEdit(student)}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h4 className="text-lg font-bold text-slate-900">Quick Add Student</h4>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Student name"
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    value={studentAge}
                    onChange={(e) => setStudentAge(e.target.value)}
                    placeholder="Age"
                  />
                  <select className="rounded-xl border border-slate-300 px-3 py-2" value={studentGender} onChange={(e) => setStudentGender(e.target.value)}>
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </select>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Parent name"
                  />
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="Parent phone"
                  />
                </div>
                <button
                  disabled={actionLoading || !studentName.trim() || !studentAge.trim() || !parentName.trim() || !parentPhone.trim()}
                  onClick={async () => {
                    const created = await runAction(
                      () =>
                        apiPostWithAuth(
                          '/students',
                          {
                            name: studentName.trim(),
                            age: Number(studentAge),
                            gender: studentGender,
                            parentName: parentName.trim(),
                            parentPhone: parentPhone.trim(),
                            feeStatus: 'pending'
                          },
                          token
                        ),
                      'Student created successfully'
                    );
                    if (created) {
                      setStudentName('');
                      setStudentAge('');
                      setParentName('');
                      setParentPhone('');
                    }
                  }}
                  className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {actionLoading ? 'Processing...' : 'Create Student'}
                </button>
              </article>
            </div>
          ) : null}

          {!loading && activeTab === 'automations' ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
                <h3 className="text-lg font-bold text-slate-900">Communication Automation Hub</h3>
                <p className="mt-1 text-sm text-slate-600">Trigger fee reminders and broadcast messages directly from command deck.</p>
                <textarea
                  className="mt-3 h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => runAction(() => apiPostWithAuth('/notifications/broadcast/send', { messageContent: broadcastText }, token), 'Broadcast queued')}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Send Broadcast
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => runAction(() => apiPostWithAuth('/notifications/fee-reminder/trigger', {}, token), 'Fee reminders triggered')}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
                  >
                    Trigger Fee Reminder
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {notifications.length === 0 ? <p className="text-sm text-slate-500">No notification logs yet.</p> : null}
                  {notifications.map((log) => (
                    <div key={log._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{log.messageType}</p>
                        <span
                          className={`text-xs font-semibold ${
                            log.status === 'sent'
                              ? 'text-emerald-600'
                              : log.status === 'failed'
                                ? 'text-rose-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{log.phoneNumber}</p>
                      <p className="mt-1 text-xs text-slate-700">{log.messageContent}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-bold text-slate-900">Runtime Console</h3>
                <p className="mt-1 text-xs text-slate-500">Latest API payload</p>
                <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-100">
                  {debugOutput || 'Run an action to inspect output.'}
                </pre>
                {toast ? <p className="mt-3 text-xs font-semibold text-indigo-700">{toast}</p> : null}
              </article>
            </div>
          ) : null}

          {billing ? (
            <footer className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-xs text-slate-600">
              Status: {billing.status} | Window: {fmtDate(billing.startDate)} - {fmtDate(billing.endDate)} | Auto renew:{' '}
              {billing.autoRenew ? 'On' : 'Off'}
            </footer>
          ) : null}
        </section>
      </div>
    </div>
  );
}
