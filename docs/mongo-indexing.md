# ArenaPilot OS MongoDB Indexing (Multi-tenant)

All high-frequency indexes are tenant-scoped first to keep query scans isolated per academy.

## Students

```javascript
db.students.createIndex({ tenantId: 1 });
db.students.createIndex({ tenantId: 1, parentPhone: 1 });
db.students.createIndex({ tenantId: 1, status: 1 });
db.students.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
db.students.createIndex({ tenantId: 1, normalizedName: 1, normalizedParentPhone: 1, status: 1 });
db.students.createIndex({ tenantId: 1, name: "text" });
```

Why:
- list/search/filters run inside tenant scope
- duplicate detection uses normalized name + phone pair

## Attendance

```javascript
db.attendances.createIndex({ tenantId: 1, date: -1 });
db.attendances.createIndex({ tenantId: 1, studentId: 1, date: -1 });
db.attendances.createIndex({ tenantId: 1, studentId: 1, date: 1 }, { unique: true });
db.attendances.createIndex({ tenantId: 1, batchId: 1, date: 1 });
```

Why:
- day-wise and student-wise attendance reads
- unique index prevents duplicate mark per student/day

## Payments

```javascript
db.payments.createIndex({ tenantId: 1, createdAt: -1 });
db.payments.createIndex({ tenantId: 1, studentId: 1 });
db.payments.createIndex({ tenantId: 1, studentId: 1, paymentDate: -1 });
db.payments.createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
```

Why:
- tenant payment history + student payment timeline
- webhook idempotency through unique Razorpay payment id

## Notifications

```javascript
db.notifications.createIndex({ tenantId: 1, status: 1 });
db.notifications.createIndex({ tenantId: 1, retryCount: 1 });
db.notifications.createIndex({ tenantId: 1, updatedAt: -1 });
db.notifications.createIndex({ tenantId: 1, createdAt: -1 });
```

Why:
- queue status/failed retry scans and log timeline reads

## Tenants

```javascript
db.tenants.createIndex({ tenantStatus: 1 });
db.tenants.createIndex({ subscriptionStatus: 1 });
db.tenants.createIndex({ createdAt: -1 });
db.tenants.createIndex({ lastActivityAt: -1 });
db.tenants.createIndex({ tenantStatus: 1, subscriptionStatus: 1, metricsMonth: 1 });
```

Why:
- admin filtering by status/subscription
- recent tenant + recent activity sorting

## Users

```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1 });
db.users.createIndex({ tenantId: 1, role: 1 });
```

Why:
- login/email lookup
- tenant role-based member queries

## Startup index initialization

Indexes are created during boot via:

- `backend/src/config/indexes.js`
- called from `backend/src/server.js` as `await ensureIndexes();`

This keeps environments consistent without adding sharding/microservice complexity.

