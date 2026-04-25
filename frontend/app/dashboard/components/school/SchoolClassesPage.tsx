'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SchoolClass, SchoolTeacher } from '../curriculum/CurriculumPage';

const DAY_OPTIONS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' }
] as const;

const formatClassLabel = (name: string, section?: string | null) => [name, section].filter(Boolean).join('-');
const formatScheduleDays = (days: string[] = []) =>
  DAY_OPTIONS.filter((option) => days.includes(option.value))
    .map((option) => option.label)
    .join(', ');

type AssignmentStudent = {
  _id: string;
  name: string;
  classId?: string | { _id: string } | null;
  rollNumber?: string | null;
  feeStatus: 'paid' | 'pending';
  status: 'active' | 'inactive';
};

export type SchoolClassDetails = {
  _id: string;
  className: string;
  name: string;
  section: string;
  teacher: SchoolTeacher | null;
  totalStudents: number;
  strength: number;
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
  students: Array<{
    _id: string;
    name: string;
    rollNumber?: string | null;
    attendancePercentage: number;
    feeStatus: 'paid' | 'pending';
    status: 'active' | 'inactive';
  }>;
};

type SchoolClassesPageProps = {
  classes: SchoolClass[];
  teachers: SchoolTeacher[];
  students: AssignmentStudent[];
  canManage: boolean;
  canDelete: boolean;
  saving: boolean;
  onCreateClass: (payload: {
    name: string;
    section?: string;
    scheduleDays: string[];
    startTime: string;
    endTime: string;
  }) => Promise<boolean>;
  onUpdateClass: (id: string, payload: {
    name: string;
    section?: string;
    scheduleDays: string[];
    startTime: string;
    endTime: string;
  }) => Promise<boolean>;
  onFetchClassDetails: (id: string) => Promise<SchoolClassDetails | null>;
  onAssignTeacher: (classId: string, teacherId: string) => Promise<boolean>;
  onAssignStudent: (studentId: string, classId: string, rollNumber: string) => Promise<boolean>;
  onDeleteClass: (classId: string, classLabel: string) => Promise<boolean>;
};

const modalShellClass =
  'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200 dark:border-white/10 dark:bg-slate-950';

export function SchoolClassesPage({
  classes,
  teachers,
  students,
  canManage,
  canDelete,
  saving,
  onCreateClass,
  onUpdateClass,
  onFetchClassDetails,
  onAssignTeacher,
  onAssignStudent,
  onDeleteClass
}: SchoolClassesPageProps) {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classDetails, setClassDetails] = useState<SchoolClassDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentTargetClassId, setStudentTargetClassId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] = useState('');
  const [newClassScheduleDays, setNewClassScheduleDays] = useState<string[]>([]);
  const [newClassStartTime, setNewClassStartTime] = useState('');
  const [newClassEndTime, setNewClassEndTime] = useState('');

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0]._id);
    }

    if (selectedClassId && classes.every((item) => item._id !== selectedClassId)) {
      setSelectedClassId(classes[0]?._id || '');
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setClassDetails(null);
      return;
    }

    let mounted = true;
    setDetailsLoading(true);
    onFetchClassDetails(selectedClassId)
      .then((data) => {
        if (mounted) {
          setClassDetails(data);
        }
      })
      .finally(() => {
        if (mounted) {
          setDetailsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedClassId, classes.length]);

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const availableStudents = useMemo(
    () =>
      students.filter((student) => {
        const currentClassId = typeof student.classId === 'string' ? student.classId : student.classId?._id || '';
        return student.status === 'active' && (!currentClassId || currentClassId === studentTargetClassId);
      }),
    [studentTargetClassId, students]
  );

  const selectedTeacher = useMemo(
    () => teachers.find((item) => item._id === selectedTeacherId) || null,
    [selectedTeacherId, teachers]
  );

  const openTeacherModal = (classId: string, currentTeacherId?: string | null) => {
    setSelectedClassId(classId);
    setSelectedTeacherId(currentTeacherId || '');
    setShowTeacherModal(true);
  };

  const openStudentModal = (classId: string) => {
    setSelectedClassId(classId);
    setStudentTargetClassId(classId);
    setSelectedStudentId('');
    setRollNumber('');
    setShowStudentModal(true);
  };

  const submitTeacherAssignment = async () => {
    if (!selectedClassId || !selectedTeacherId) return;
    const success = await onAssignTeacher(selectedClassId, selectedTeacherId);
    if (success) {
      setShowTeacherModal(false);
    }
  };

  const submitStudentAssignment = async () => {
    if (!selectedStudentId || !studentTargetClassId || !rollNumber.trim()) return;
    const success = await onAssignStudent(selectedStudentId, studentTargetClassId, rollNumber.trim());
    if (success) {
      setShowStudentModal(false);
      setSelectedStudentId('');
      setRollNumber('');
    }
  };

  const submitCreateClass = async () => {
    if (!newClassName.trim()) return;
    const payload = {
      name: newClassName.trim(),
      section: newClassSection.trim(),
      scheduleDays: newClassScheduleDays,
      startTime: newClassStartTime,
      endTime: newClassEndTime
    };
    const success = editingClassId ? await onUpdateClass(editingClassId, payload) : await onCreateClass(payload);
    if (success) {
      setShowCreateModal(false);
      setEditingClassId(null);
      setNewClassName('');
      setNewClassSection('');
      setNewClassScheduleDays([]);
      setNewClassStartTime('');
      setNewClassEndTime('');
    }
  };

  const openCreateModal = () => {
    setEditingClassId(null);
    setNewClassName('');
    setNewClassSection('');
    setNewClassScheduleDays([]);
    setNewClassStartTime('');
    setNewClassEndTime('');
    setShowCreateModal(true);
  };

  const openEditModal = (row: SchoolClass) => {
    setEditingClassId(row._id);
    setNewClassName(row.name || '');
    setNewClassSection(row.section || '');
    setNewClassScheduleDays(row.scheduleDays || []);
    setNewClassStartTime(row.startTime || '');
    setNewClassEndTime(row.endTime || '');
    setShowCreateModal(true);
  };

  const toggleScheduleDay = (value: string) => {
    setNewClassScheduleDays((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">School Module</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Class Management</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Link classes with teachers and students while keeping attendance and fee tracking connected.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              + Add Class
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Class List</h4>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
            {classes.length} classes
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="border-b border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300">
                <th className="px-4 py-3 font-semibold">Class Name</th>
                <th className="px-4 py-3 font-semibold">Class Teacher</th>
                <th className="px-4 py-3 font-semibold">Students Count</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500 dark:text-slate-300">
                    No classes available yet.
                  </td>
                </tr>
              ) : null}
              {classes.map((row) => {
                const teacher =
                  typeof row.classTeacherId === 'string'
                    ? teachers.find((item) => item._id === row.classTeacherId)
                    : row.classTeacherId || null;

                return (
                  <tr
                    key={row._id}
                    className={`border-b border-slate-100 transition dark:border-white/5 ${
                      row._id === selectedClassId ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {formatClassLabel(row.name, row.section)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{teacher?.name || 'Not assigned'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.strength || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClassId(row._id)}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          disabled={!canManage}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openTeacherModal(row._id, teacher?._id)}
                          disabled={!canManage}
                          className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                        >
                          Assign Teacher
                        </button>
                        <button
                          type="button"
                          onClick={() => openStudentModal(row._id)}
                          disabled={!canManage}
                          className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        >
                          Add Students
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => onDeleteClass(row._id, formatClassLabel(row.name, row.section))}
                            className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Class Info</h4>
            {detailsLoading ? <span className="text-xs text-slate-500 dark:text-slate-400">Loading...</span> : null}
          </div>
          {classDetails ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Name</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{classDetails.className}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Section</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{classDetails.section || '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Teacher</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{classDetails.teacher?.name || 'Not assigned'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Timetable</p>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {classDetails.scheduleDays?.length && classDetails.startTime && classDetails.endTime
                    ? `${formatScheduleDays(classDetails.scheduleDays)} • ${classDetails.startTime} - ${classDetails.endTime}`
                    : 'Not scheduled yet'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-slate-500 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300">
              Select a class to view details.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Student List</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Attendance and fee visibility for the selected class.</p>
            </div>
            {classDetails ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                {classDetails.totalStudents} students
              </span>
            ) : null}
          </div>
          {classDetails?.students?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr className="border-b border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Roll No</th>
                    <th className="px-4 py-3 font-semibold">Attendance %</th>
                    <th className="px-4 py-3 font-semibold">Fees Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classDetails.students.map((student) => (
                    <tr key={student._id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{student.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.rollNumber || '-'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.attendancePercentage}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            student.feeStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          }`}
                        >
                          {student.feeStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-slate-500 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300">
              No students assigned to this class yet.
            </div>
          )}
        </article>
      </section>

      {showTeacherModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className={modalShellClass}>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assign Teacher</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Select a teacher for {selectedClass ? formatClassLabel(selectedClass.name, selectedClass.section) : 'this class'}.
            </p>
            <select
              value={selectedTeacherId}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
              className="mt-5 w-full rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTeacherAssignment}
                disabled={saving || !selectedTeacherId}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950"
              >
                {saving ? 'Saving...' : 'Assign Teacher'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStudentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className={modalShellClass}>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assign Student</h4>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Student
                <select
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Select student</option>
                  {availableStudents.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Select class
                <select
                  value={studentTargetClassId}
                  onChange={(event) => setStudentTargetClassId(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {formatClassLabel(item.name, item.section)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Roll number
                <input
                  value={rollNumber}
                  onChange={(event) => setRollNumber(event.target.value)}
                  placeholder="Enter roll number"
                  className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStudentAssignment}
                disabled={saving || !selectedStudentId || !studentTargetClassId || !rollNumber.trim()}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950"
              >
                {saving ? 'Saving...' : 'Assign Student'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className={modalShellClass}>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {editingClassId ? 'Edit Class' : 'Create Class'}
            </h4>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Class name
                <input
                  value={newClassName}
                  onChange={(event) => setNewClassName(event.target.value)}
                  placeholder="10"
                  className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Section
                <input
                  value={newClassSection}
                  onChange={(event) => setNewClassSection(event.target.value)}
                  placeholder="Optional"
                  className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <div className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span>Class days</span>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const active = newClassScheduleDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleScheduleDay(day.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Start time
                  <input
                    type="time"
                    value={newClassStartTime}
                    onChange={(event) => setNewClassStartTime(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  End time
                  <input
                    type="time"
                    value={newClassEndTime}
                    onChange={(event) => setNewClassEndTime(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              <p>
                Timetable:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {newClassScheduleDays.length && newClassStartTime && newClassEndTime
                    ? `${formatScheduleDays(newClassScheduleDays)} • ${newClassStartTime} - ${newClassEndTime}`
                    : 'Schedule can be added now or later'}
                </span>
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingClassId(null);
                }}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreateClass}
                disabled={saving || !newClassName.trim()}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950"
              >
                {saving ? 'Saving...' : editingClassId ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
