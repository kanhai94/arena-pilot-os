import test from 'node:test';
import assert from 'node:assert/strict';
import { TenantContext } from './tenantContext.js';
import { studentRepository } from '../../modules/students/student.repository.js';
import { Student } from '../../models/student.model.js';
import { resolveScopedLogMeta } from '../../config/logger.js';

test('TenantContext exposes tenantId inside request scope', async () => {
  await TenantContext.runWithTenant('tenant-alpha', async () => {
    assert.equal(TenantContext.getTenantId(), 'tenant-alpha');
  });
});

test('student repository uses TenantContext tenantId automatically', async () => {
  const originalFindOne = Student.findOne;
  let capturedFilter = null;

  Student.findOne = (filter) => {
    capturedFilter = filter;
    return { lean: async () => null };
  };

  try {
    await TenantContext.runWithTenant('tenant-repo', async () => {
      await studentRepository.findStudentById(undefined, '507f1f77bcf86cd799439011');
    });
  } finally {
    Student.findOne = originalFindOne;
  }

  assert.equal(capturedFilter?.tenantId, 'tenant-repo');
});

test('tenant-scoped repository rejects access when tenantId context is missing', async () => {
  await assert.rejects(
    async () => {
      await studentRepository.findStudentById(undefined, '507f1f77bcf86cd799439011');
    },
    /tenantId is missing/
  );
});

test('logger metadata includes tenantId from TenantContext automatically', async () => {
  await TenantContext.runWithTenant('tenant-log', async () => {
    const meta = resolveScopedLogMeta({ channel: 'queue' }, { event: 'job_created' });
    assert.equal(meta.tenantId, 'tenant-log');
    assert.equal(meta.channel, 'queue');
  });
});

