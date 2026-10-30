# Port by kk

Port by kk is a business logistics booking and shipment visibility platform.

## Production setup

- **Hosting:** Render free web service using [`render.yaml`](./render.yaml).
- **Database:** Supabase PostgreSQL using [`supabase-schema.sql`](./supabase-schema.sql).
- **Payments:** Razorpay Checkout with UPI, cards and netbanking.

Razorpay signatures are verified by the server before a booking is marked paid. Keep `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` in Render environment variables only.

## Deploy

1. Run the SQL in `supabase-schema.sql` in the Supabase SQL Editor.
2. Connect the `karthe23/kk` GitHub repository to Render.
3. Use Node 20, `npm install` as the build command, and `npm start` as the start command.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PUBLIC_BASE_URL`, and `PAYMENT_PROVIDER=razorpay`.
5. Test with Razorpay Test Mode before switching to live keys.

## Local development

```bash
npm start
```

Open `http://localhost:3000`. Without production variables, the app uses explicit mock payments and `data/port-by-kk.json`. With Supabase variables, bookings use PostgreSQL.
