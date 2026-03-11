# Razorpay Webhook Setup (Tenant / Academy)

This guide is for **academy owners** who want to connect **their own Razorpay account** to ArenaPilot OS, so payments go directly to their account.

---

## Why this webhook is needed

Razorpay sends payment updates to ArenaPilot OS using a webhook.
Without it:
- Payments may not be marked as paid
- Fees and subscription status may not update automatically

---

## Step 1: Add Razorpay credentials in ArenaPilot

Go to:

```
Dashboard → Integrations → Razorpay
```

Enter:

- **Razorpay Key ID**
- **Razorpay Secret**
- **Webhook Secret** (any strong secret you choose)

Click **Save Integrations**.

---

## Step 2: Create the webhook in Razorpay

1. Login to Razorpay Dashboard  
2. Go to **Settings → Webhooks**  
3. Add a new webhook

### Use this URL:

```
https://<YOUR_BACKEND_DOMAIN>/api/v1/billing/webhooks/razorpay
```

Example:

```
https://arena-pilot-os.onrender.com/api/v1/billing/webhooks/razorpay
```

### Webhook Secret

Use the **same webhook secret** you entered in ArenaPilot Integrations.

---

## Step 3: Enable Required Event

Select at least:

```
payment.captured
```

Other events are safe but not required.

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

If you want us to handle additional events, we can add them.

---

## Step 4: Ensure Orders include tenantId
