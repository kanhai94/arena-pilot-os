# MongoDB Atlas Backup Strategy

## Objectives
- Recovery Point Objective (RPO): <= 1 hour
- Recovery Time Objective (RTO): <= 2 hours
- Keep point-in-time restore enabled for production cluster.

## Atlas Native Backups
1. Enable **Cloud Backup** on production Atlas cluster.
2. Configure **Continuous Cloud Backup** for point-in-time restore.
3. Retention policy:
   - Daily snapshots: 35 days
   - Weekly snapshots: 8 weeks
   - Monthly snapshots: 12 months
4. Enable backup encryption with customer-managed KMS if required.

## Restore Drill (Monthly)
1. Restore latest snapshot to staging cluster.
2. Run smoke checks:
   - tenant count
   - subscription records
   - payment ledger integrity
3. Record restore time and verify RTO compliance.

## Scheduled Export Example (Defense in Depth)
Use a secure CI runner or bastion host with Atlas IP allowlisting.

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET_DIR="/backups/sports-academy/${STAMP}"
mkdir -p "$TARGET_DIR"

mongodump \
  --uri "$MONGO_URI" \
  --archive="$TARGET_DIR/dump.archive.gz" \
  --gzip

find /backups/sports-academy -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

## Cron Schedule Example
Nightly backup at 02:00 UTC:

```cron
0 2 * * * /opt/scripts/atlas-backup.sh >> /var/log/atlas-backup.log 2>&1
```
