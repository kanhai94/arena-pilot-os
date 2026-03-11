# Razorpay Webhook Setup (Super Admin / Platform)

This guide is for **Super Admin** to configure the **platform Razorpay** (fallback if tenant Razorpay is not configured).

---

## Why this webhook is needed

Platform-level payments (or tenants without their own Razorpay) will go to the platform account.
Webhook ensures:
- Payment confirmation is recorded
- Subscription status updates
- No duplicate processing

---

## Step 1: Configure Platform Razorpay in Admin

Go to:

```
Super Admin → Integrations → Razorpay
```

Enter:

- **Razorpay Key ID**
- **Razorpay Secret**
- **Webhook Secret** (choose a strong secret)

Save the settings.

---

## Step 2: Create Webhook in Platform Razorpay Dashboard

1. Login to Razorpay Dashboard  
2. Go to **Settings → Webhooks**  
3. Add new webhook

### Use this URL:

```
https://<YOUR_BACKEND_DOMAIN>/api/v1/billing/webhooks/razorpay
```

Example:

```
https://arena-pilot-os.onrender.com/api/v1/billing/webhooks/razorpay
```

### Webhook Secret

Use the **same webhook secret** set in Admin Integrations.

---

## Step 3: Required Event

Enable at minimum:

```
payment.captured
```

---

## Webhook Event Handling (Current Behavior)

Handled:
- `payment.captured` → **records payment** and updates status
- `payment.failed` → marks tenant payment status as **failed** (no payment recorded)

Ignored (safe):
- any other event (logged as `ignored`)

Response status behavior:
- `invalid_signature` → signature mismatch
- `processing_error` → verification or processing failure
- `duplicate` → already processed (idempotent)

If you want us to handle more events, we can extend it.

---

## Step 4: Notes for Platform Payments

Platform payments (like tenant signup plans) automatically include:

```
notes: {
  tenantId: "<tenantObjectId>"
}
```

This allows accurate routing and prevents conflicts.

---

## How verification works (internal)

When webhook arrives:

1. System reads `notes.tenantId`
2. If that tenant has its own webhook secret → use tenant secret  
3. Otherwise use platform secret
4. Signature verified and stored safely

---

## Troubleshooting

### Invalid signature
- Webhook secret mismatch
- Fix by updating secret in Razorpay and ArenaPilot to match

### No payment marked
- Webhook not firing
- Check Razorpay webhook logs

### Duplicate payments
- Webhook retries are safe
- System ignores duplicates by `razorpayPaymentId`

---

If you want, I can add a **Postman collection** entry to test webhook verification.
