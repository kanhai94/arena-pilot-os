'use client';

import { useEffect, useMemo, useState } from 'react';

export type SchoolClass = {
  _id: string;
  name: string;
  section: string;
  classTeacherId?: SchoolTeacher | string | null;
  strength?: number;
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
};

export type SchoolTeacher = {
  _id: string;
  name: string;
  email: string;
  phone: string;
};

export type CurriculumSubject = {
  _id: string;
  name: string;
  classId: SchoolClass | string;
  teacherId?: SchoolTeacher | string | null;
  status: 'active' | 'inactive';
};

type SubjectDraft = {
  name: string;
  classId: string;
  teacherId: string;
  status: 'active' | 'inactive';
};

type CurriculumPageProps = {
  subjects: CurriculumSubject[];
  classes: SchoolClass[];
  teachers: SchoolTeacher[];
  canManage: boolean;
  saving: boolean;
  onCreateSubject: (payload: {
    name: string;
    classId: string;
    teacherId?: string | null;
    status: 'active' | 'inactive';
  }) => Promise<boolean>;
  onUpdateSubject: (
    id: string,
    payload: {
      name: string;
      classId: string;
      teacherId?: string | null;
      status: 'active' | 'inactive';
    }
  ) => Promise<boolean>;
  onDeleteSubject: (id: string) => Promise<boolean>;
};

const EMPTY_DRAFT: SubjectDraft = {
  name: '',
  classId: '',
  teacherId: '',
  status: 'active'
};

const getClassMeta = (value: SchoolClass | string, classes: SchoolClass[]) => {
  if (typeof value !== 'string') {
    return value;
  }

  return classes.find((item) => item._id === value) || null;
};

const getTeacherMeta = (value: SchoolTeacher | string | null | undefined, teachers: SchoolTeacher[]) => {
  if (!value) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return teachers.find((item) => item._id === value) || null;
};

export function CurriculumPage({
  subjects,
  classes,
  teachers,
  canManage,
  saving,
  onCreateSubject,
  onUpdateSubject,
  onDeleteSubject
}: CurriculumPageProps) {
  const [draft, setDraft] = useState<SubjectDraft>(EMPTY_DRAFT);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === draft.classId) || null,
    [classes, draft.classId]
  );
  const selectedTeacher = useMemo(
    () => teachers.find((item) => item._id === draft.teacherId) || null,
    [teachers, draft.teacherId]
  );

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!draft.name.trim()) {
      errors.name = 'Subject name is required.';
    }
    if (!draft.classId) {
      errors.classId = 'Class is required.';
    }
    return errors;
  }, [draft.classId, draft.name]);

  const isFormValid = Object.keys(validationErrors).length === 0;

  useEffect(() => {
    if (!showModal) {
      setModalVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setModalVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showModal]);

  const closeModal = () => {
    setModalVisible(false);
    window.setTimeout(() => {
      setShowModal(false);
      setEditingSubjectId(null);
      setDraft(EMPTY_DRAFT);
      setSubmitAttempted(false);
    }, 180);
  };

  const openAddModal = () => {
    setEditingSubjectId(null);
    setDraft({
      ...EMPTY_DRAFT,
      classId: classes[0]?._id || ''
    });
    setSubmitAttempted(false);
    setShowModal(true);
  };

  const openEditModal = (subject: CurriculumSubject) => {
    const classMeta = getClassMeta(subject.classId, classes);
    const teacherMeta = getTeacherMeta(subject.teacherId, teachers);
    setEditingSubjectId(subject._id);
    setDraft({
      name: subject.name,
      classId: classMeta?._id || '',
      teacherId: teacherMeta?._id || '',
      status: subject.status
    });
    setSubmitAttempted(false);
    setShowModal(true);
  };

  const submitSubject = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) {
      return;
    }

    const payload = {
      name: draft.name.trim(),
      classId: draft.classId,
      teacherId: draft.teacherId || null,
      status: draft.status
    };

    const success = editingSubjectId
      ? await onUpdateSubject(editingSubjectId, payload)
      : await onCreateSubject(payload);

    if (success) {
      closeModal();
    }
  };

  const removeSubject = async (subject: CurriculumSubject) => {
    if (!window.confirm(`Delete ${subject.name}?`)) {
      return;
    }

    await onDeleteSubject(subject._id);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              <span aria-hidden="true">📚</span>
              Curriculum
            </div>
            <h3 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">Subject Management</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Manage subjects across classes and organize academic structure.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 dark:shadow-[0_0_0_1px_rgba(99,102,241,0.28)]"
            >
              + Add Subject
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Subject List</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Curriculum records linked to classes and teachers.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              {subjects.length} subjects
            </span>
          </div>

          {subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300">
              Start by adding your first subject
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr className="border-b border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300">
                    <th className="px-4 py-3 font-semibold">Subject Name</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Teacher</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => {
                    const classMeta = getClassMeta(subject.classId, classes);
                    const teacherMeta = getTeacherMeta(subject.teacherId, teachers);
                    return (
                      <tr key={subject._id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{subject.name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {classMeta ? `${classMeta.name} ${classMeta.section}`.trim() : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{teacherMeta?.name || 'Not assigned'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              subject.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {subject.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(subject)}
                              disabled={!canManage}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSubject(subject)}
                              disabled={!canManage}
                              className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950">
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Curriculum Foundation</h4>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This module is structured so we can extend it into syllabus, exams, and assignments later without rebuilding the subject layer.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Classes</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{classes.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Teachers</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{teachers.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Active Subjects</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {subjects.filter((subject) => subject.status === 'active').length}
              </p>
            </div>
          </div>
        </article>
      </section>

      {showModal ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 transition-opacity duration-200 ${
            modalVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200 dark:border-white/10 dark:bg-slate-950 ${
              modalVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.98] opacity-0'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Curriculum</p>
                <h4 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {editingSubjectId ? 'Edit Subject' : 'Add Subject'}
                </h4>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Subject Name
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Mathematics"
                  className={`rounded-2xl border px-4 py-3 font-normal outline-none transition ${
                    submitAttempted && validationErrors.name
                      ? 'border-rose-400'
                      : 'border-slate-300 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100'
                  }`}
                />
                {submitAttempted && validationErrors.name ? (
                  <span className="text-xs font-medium text-rose-600">{validationErrors.name}</span>
                ) : null}
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Class
                <select
                  value={draft.classId}
                  onChange={(event) => setDraft((current) => ({ ...current, classId: event.target.value }))}
                  className={`rounded-2xl border px-4 py-3 font-normal outline-none transition ${
                    submitAttempted && validationErrors.classId
                      ? 'border-rose-400'
                      : 'border-slate-300 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100'
                  }`}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} {item.section}
                    </option>
                  ))}
                </select>
                {submitAttempted && validationErrors.classId ? (
                  <span className="text-xs font-medium text-rose-600">{validationErrors.classId}</span>
                ) : null}
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Teacher
                <select
                  value={draft.teacherId}
                  onChange={(event) => setDraft((current) => ({ ...current, teacherId: event.target.value }))}
                  className="rounded-2xl border border-slate-300 px-4 py-3 font-normal outline-none transition dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as 'active' | 'inactive'
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 font-normal outline-none transition dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              <p>
                Class: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedClass ? `${selectedClass.name} ${selectedClass.section}`.trim() : '-'}</span>
              </p>
              <p className="mt-1">
                Teacher: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedTeacher?.name || 'Not assigned'}</span>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSubject}
                disabled={saving}
                className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 dark:shadow-[0_0_0_1px_rgba(99,102,241,0.28)]"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    {editingSubjectId ? 'Saving changes...' : 'Adding subject...'}
                  </span>
                ) : editingSubjectId ? (
                  'Update Subject'
                ) : (
                  'Add Subject'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
