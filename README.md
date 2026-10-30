<<<<<<< HEAD
# kk
=======
# EMTO Logistics Platform

## Free live hosting, database and UPI payments

The production setup is deliberately chosen as:

- **Render free web service** for Node hosting (`render.yaml` is included).
- **Supabase free PostgreSQL** for durable bookings and payments (`supabase-schema.sql` is included).
- **Razorpay Checkout** for UPI, cards and netbanking. The server verifies Razorpay's signature before marking a booking paid.

Free Render services may sleep after inactivity. Supabase is the database of record; local JSON is used only when Supabase variables are absent.

### Deploy

1. Create a Supabase project, open SQL Editor, and run [`supabase-schema.sql`](./supabase-schema.sql).
2. Create a Razorpay account, enable UPI, and copy the API key ID and secret from Test Mode first.
3. Create a Render Web Service from this folder/repository. Render will use [`render.yaml`](./render.yaml).
4. Add the Render environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `PUBLIC_BASE_URL` (your Render URL).
5. Test a booking with Razorpay Test Mode. Switch to live Razorpay keys only after KYC and webhook/reconciliation review.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` in frontend code. The browser receives only the Razorpay public key ID.

## Local development

Requires Node.js 20 or newer:

```bash
npm start
```

Open `http://localhost:3000`. Without production variables, the app uses the explicit `mock` payment mode and `data/emto.json`. With Supabase variables, bookings use PostgreSQL. Set `PAYMENT_PROVIDER=razorpay` to exercise real Razorpay UPI checkout.
>>>>>>> a5e1a42 (Deploy EMTO logistics platform)
