# 🔧 FieldBook

Scheduling & booking SaaS for local service businesses — plumbers, HVAC techs, electricians, and cleaners.

**Owner setup takes under 10 minutes:** sign up → services are pre-loaded for your trade → share your booking link → confirm requests with one tap.

## Features

- **Dashboard** — today's jobs, upcoming jobs, pending booking requests, and monthly revenue at a glance (mobile-first, made for checking from the truck)
- **Online booking page** — each business gets a public `/book/your-company` link; customers pick a service, day, and open time slot without calling
- **Calendar** — month view with color-coded technician chips, day agenda, one-tap reschedule
- **Automated reminders** — SMS (Twilio) and email (SendGrid) reminders sent before appointments (2/4/24/48h, configurable), plus confirmation messages when a job is booked or rescheduled
- **Review requests** — when a job is marked complete, the customer automatically gets a text + email with your Google and Yelp review links
- **Customer database** — searchable, with full job history and lifetime value per customer
- **Team management** — add technicians with their own logins, assign jobs, filter the calendar per tech
- **Settings** — logo, booking link name, welcome message, business hours, service list, review links, notification toggles
- **Auth & pricing page** — JWT auth, landing page with Solo/Crew/Company plans

## Stack

React (Vite) · Node.js + Express · PostgreSQL · Twilio · SendGrid

## Quick start

```bash
# 1. Start PostgreSQL (or point DATABASE_URL at an existing instance)
docker compose up -d db

# 2. Configure the API
cp server/.env.example server/.env   # add Twilio/SendGrid keys when ready — the app runs fine without them

# 3. Install & run (API on :4000, web on :5173)
npm install
npm run dev
```

Open http://localhost:5173, create an account, and you're live. The database schema is created automatically on first boot.

Without Twilio/SendGrid keys, messages are skipped gracefully and logged to the `messages_log` table so you can see exactly what *would* have been sent.

## Production

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built frontend on :4000
```

Set `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, and your Twilio/SendGrid credentials in the environment.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing auth tokens |
| `PORT` | API port (default 4000) |
| `APP_URL` | Public URL used in message links |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS sending (optional) |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Email sending (optional) |

## How the automations work

- A cron pass runs every 5 minutes and sends a reminder for every confirmed job entering its reminder window; rescheduling a job re-arms its reminder.
- Confirming a pending request (or rescheduling a confirmed job) immediately sends the customer a confirmation.
- Marking a job **completed** sends the review request (only if a Google or Yelp link is set and the toggle is on) — once per job.
- Every send (or skip/failure) is recorded in `messages_log`.
