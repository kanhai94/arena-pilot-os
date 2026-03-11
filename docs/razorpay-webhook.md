# Razorpay Webhook Guide (ArenaPilot OS)

This document explains how to configure Razorpay webhooks for both **Platform (Super Admin)** and **Tenant (Academy)** payments, how tenant-level Razorpay accounts work, and how to verify that payment events are processed correctly.

## 1. Overview

ArenaPilot OS supports **two Razorpay modes**:

1. **Platform Razorpay (Super Admin)**  
   - Used when a tenant has **not** configured its own Razorpay credentials.
   - Webhook secret comes from platform settings or `.env`.

2. **Tenant Razorpay (Academy)**  
   - Used when a tenant configures its own Razorpay credentials under **Integrations**.
   - Webhook secret is stored per tenant.
   - Payments go directly to the tenant’s Razorpay account.

Both modes can co-exist **without conflict** because each tenant payment uses **notes.tenantId**, and webhook verification uses the **correct secret** based on those notes.

## 2. Webhook URL

Set this URL in Razorpay (platform or tenant account):

```
POST https://<YOUR_BACKEND_DOMAIN>/api/v1/billing/webhooks/razorpay
```

Example:

```
https://arena-pilot-os.onrender.com/api/v1/billing/webhooks/razorpay
```

## 3. Required Events

Enable at minimum:

```
payment.captured
```

Other events are ignored safely.

## 4. Required Notes (Tenant Payments)

For tenant payments, Razorpay orders **must include**:

```
notes: {
  tenantId: "<tenantObjectId>"
}
```

ArenaPilot uses this to:
- Identify the correct tenant
- Load the tenant-specific webhook secret
- Route the payment safely

This is automatically added when using:

```
POST /api/v1/billing/orders
```

## 5. Tenant Order Creation

To create a payment order (for tenant use), call:

```
POST /api/v1/billing/orders
```

Body:

```json
{
  "amount": 1999,
  "currency": "INR",
  "receipt": "fee-INV-2026-04",
  "notes": {
    "studentId": "64c1f1b34f1d2e0012a12345",
    "subscriptionId": "64c1f1b34f1d2e0012a99999",
    "purpose": "Monthly fee"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "orderId": "order_JF9YxvC123",
    "amount": 199900,
    "currency": "INR",
    "receipt": "fee-INV-2026-04",
    "keyId": "rzp_live_xxxxx",
    "notes": {
      "tenantId": "64c1f1b34f1d2e0012a11111",
      "studentId": "64c1f1b34f1d2e0012a12345",
      "subscriptionId": "64c1f1b34f1d2e0012a99999",
      "purpose": "Monthly fee"
    }
  }
}
```

Note: `amount` is returned in **paise**.

## 6. Webhook Secret Setup

### Platform (Super Admin)
Set **one** global webhook secret:

- Environment variable: `RAZORPAY_WEBHOOK_SECRET`
  - Or platform settings (Super Admin Integrations)

### Tenant (Academy)
Set **per tenant** in:

```
Dashboard → Integrations → Razorpay → Webhook Secret
```

This overrides the platform secret for that tenant only.

## 7. Security & Verification

ArenaPilot verifies every webhook:

1. Extracts `tenantId` from `notes`
2. Loads tenant secret if available
3. Validates `x-razorpay-signature`
4. Rejects invalid signatures (returns 200 with status `invalid_signature`)

All webhook attempts are logged with:

- success
- invalid_signature
- ignored (non `payment.captured`)
- duplicate

## 8. Common Issues & Fixes

### 1. Signature Invalid
**Cause:** Wrong webhook secret in Razorpay dashboard  
**Fix:** Update webhook secret to match configured secret.

### 2. No Payment Recorded
**Cause:** Missing `notes.tenantId` in Razorpay order  
**Fix:** Always use `/api/v1/billing/orders` for tenant payments.

### 3. Duplicate Webhook Logs
**Cause:** Razorpay retries webhooks  
**Fix:** Safe. Webhook handler is idempotent using `razorpayPaymentId`.

## 9. Test Checklist

1. Create tenant order via `/billing/orders`
2. Complete payment in Razorpay checkout
3. Ensure webhook received:
   - status = `payment.captured`
   - signature verified
4. Check DB:
   - `payments` contains `razorpayPaymentId`
   - tenant payment status updated

---

If you want, I can also add a **Postman collection** entry for this flow.
