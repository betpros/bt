# BetPro Backend

Node/Express backend for the BetPro tailoring site. Handles PesaPal checkout
(both the "M-Pesa" and "PesaPal" buttons on `pricing.html` go through PesaPal
— their hosted checkout offers M-Pesa STK push as one of the payment
options) and stores every order in Supabase.

## 1. Set up Supabase

1. In your Supabase project, open the SQL editor and run `supabase/schema.sql`.
2. Grab your project URL and **service role key** (Project Settings → API) —
   not the anon key, the service role key stays server-side only.

## 2. Set up PesaPal

1. Sign up at https://developer.pesapal.com (sandbox) and later
   https://www.pesapal.com (live business account).
2. From your PesaPal dashboard, grab the **Consumer Key** and **Consumer
   Secret** for the app you created.

## 3. Deploy to Render

1. Push this `backend/` folder to its own GitHub repo (or a subfolder of
   your existing repo, with Render's root directory set to `backend`).
2. On Render: **New → Web Service** → connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Add these environment variables in Render's dashboard:
   - `PESAPAL_ENV` — `sandbox` while testing, `live` when ready for real payments
   - `PESAPAL_CONSUMER_KEY`
   - `PESAPAL_CONSUMER_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FRONTEND_URL` — your GitHub Pages URL, no trailing slash
   - `BACKEND_URL` — leave blank for the first deploy, see step 4
4. Deploy once. Render will assign you a URL like
   `https://betpro-backend.onrender.com`. Set `BACKEND_URL` to that value in
   the Render dashboard and trigger a redeploy.

## 4. Register your IPN URL (one-time)

PesaPal needs to know where to notify you about payment status changes.
From your local machine (with a `.env` copied from `.env.example` and
`BACKEND_URL` pointed at your live Render URL):

```bash
npm install
npm run register-ipn
```

This prints an `ipn_id`. Copy it into the `PESAPAL_IPN_ID` environment
variable on Render and redeploy. Until this is set, `/api/pesapal/order`
will fail.

## 5. Point the frontend at this backend

In your frontend repo, edit `js/config.js` (create it if it isn't there yet):

```js
window.BETPRO_API_BASE = "https://betpro-backend.onrender.com";
```

Commit and push — GitHub Pages will pick it up automatically. Without this
file, `pricing.html` stays in demo mode (fake, no real charges).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/pesapal/order` | Create an order + get PesaPal redirect URL |
| GET | `/api/pesapal/callback` | Browser lands here after checkout, redirects back to the site |
| GET | `/api/pesapal/ipn` | PesaPal's server-to-server webhook |
| GET | `/api/pesapal/status/:orderTrackingId` | Optional: poll an order's current status |
| GET | `/api/health` | Health check |

## Notes

- Render's free tier spins down when idle — the first request after a quiet
  period can take 20–30s to wake up. Worth mentioning to customers or
  upgrading to a paid instance if that matters for your launch.
- Test with PesaPal's sandbox test card/M-Pesa numbers before flipping
  `PESAPAL_ENV` to `live`.
