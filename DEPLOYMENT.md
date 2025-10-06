# 🚀 Deployment Guide

Complete guide to deploying your booking management system to production.

## Prerequisites

- [ ] GitHub account
- [ ] Vercel account (free)
- [ ] Neon PostgreSQL database set up
- [ ] Email credentials configured

---

## Part 1: Prepare Your Repository

### 1. Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit: Booking management system"
```

### 2. Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click **"New repository"**
3. Name it: `booking-management-app`
4. Keep it **private** (recommended)
5. Don't initialize with README (you already have one)
6. Click **"Create repository"**

### 3. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/booking-management-app.git
git branch -M main
git push -u origin main
```

---

## Part 2: Deploy to Vercel

### 1. Connect Vercel to GitHub

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sign in with GitHub
3. Click **"New Project"**
4. Select your `booking-management-app` repository
5. Click **"Import"**

### 2. Configure Build Settings

Vercel should auto-detect Next.js. Verify:

- **Framework Preset:** Next.js
- **Build Command:** `prisma generate && next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### 3. Add Environment Variables

Click **"Environment Variables"** and add ALL variables from your `.env` file:

```env
DATABASE_URL=postgresql://user:password@host.neon.tech/db?sslmode=require

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=info@evaggelias-apts.com
EMAIL_PASSWORD=your-app-password

EMAIL_FROM_EVAGGELIA=info@evaggelias-apts.com
EMAIL_FROM_ELEGANCIA=info@elegancialuxuryvillas.com

EVAGGELIA_ID_BANK_NAME=Alpha Bank
EVAGGELIA_ID_IBAN=GR1234567890123456789012345
EVAGGELIA_ID_ACCOUNT_HOLDER=Evaggelia Rental Apartments

EVAGGELIA_ID_WU_RECIPIENT=Recipient Name
EVAGGELIA_ID_WU_CITY=Athens
EVAGGELIA_ID_WU_COUNTRY=Greece

ELEGANCIA_ID_BANK_NAME=Alpha Bank
ELEGANCIA_ID_IBAN=GR0987654321098765432109876
ELEGANCIA_ID_ACCOUNT_HOLDER=Elegancia Luxury Villas

ELEGANCIA_ID_WU_RECIPIENT=Recipient Name
ELEGANCIA_ID_WU_CITY=Athens
ELEGANCIA_ID_WU_COUNTRY=Greece
```

> **Important:** Select "Production", "Preview", and "Development" for all variables

### 4. Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for the build to complete
3. Your app will be live at: `https://your-app.vercel.app`

### 5. Run Database Migrations

After first deployment, you need to set up the database:

**Option A: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Run migration
vercel env pull .env.local
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

**Option B: Using Prisma Data Platform**

1. Go to [Prisma Data Platform](https://cloud.prisma.io/)
2. Connect your Neon database
3. Run migrations from the UI

**Option C: Manual via Neon Console**

1. Go to [Neon Console](https://console.neon.tech/)
2. Open SQL Editor
3. Run the migration SQL manually (see `prisma/migrations/`)

---

## Part 3: Set Up Keep-Alive

Neon's free tier pauses after 5 minutes of inactivity. Keep it alive with UptimeRobot:

### 1. Create UptimeRobot Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for free (50 monitors included)

### 2. Add Monitor

1. Click **"Add New Monitor"**
2. Fill in:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Booking App Keep-Alive
   - **URL:** `https://your-app.vercel.app/api/ping`
   - **Monitoring Interval:** 5 minutes
3. Click **"Create Monitor"**

### 3. Verify It's Working

Visit `https://your-app.vercel.app/api/ping` - you should see:

```json
{
  "status": "ok",
  "timestamp": "2025-10-06T...",
  "message": "Database connection is alive"
}
```

---

## Part 4: Custom Domain (Optional)

### 1. Add Domain in Vercel

1. Go to Project Settings → Domains
2. Add your domain: `bookings.yourdomain.com`
3. Copy the DNS records Vercel provides

### 2. Configure DNS

Add these records in your domain provider:

```
Type: CNAME
Name: bookings
Value: cname.vercel-dns.com
```

Wait 5-60 minutes for DNS propagation.

---

## Part 5: Email Configuration

### Gmail Setup

1. Enable 2FA on your Google account
2. Generate App Password:
   - Visit [myaccount.google.com/security](https://myaccount.google.com/security)
   - Go to **"2-Step Verification"** → **"App passwords"**
   - Generate password for "Mail"
3. Use this password in `EMAIL_PASSWORD` env var
4. Test by sending an email from the app

### Using Business Email

If you want emails sent from `info@evaggelias-apts.com`:

**Option A: Gmail Alias**
1. Add the business email as an alias in Gmail
2. Verify ownership
3. Use Gmail SMTP with business email as "from"

**Option B: Custom SMTP**
1. Get SMTP credentials from your hosting provider
2. Update `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`

---

## Part 6: Post-Deployment Checklist

- [ ] Visit your production URL
- [ ] Select a business
- [ ] Create a test booking
- [ ] Check calendar shows the booking
- [ ] Test email sending (if configured)
- [ ] Export a report (CSV/PDF)
- [ ] Edit an email template
- [ ] Install PWA on mobile device
- [ ] Verify UptimeRobot is pinging `/api/ping`

---

## Monitoring & Maintenance

### View Logs

```bash
vercel logs your-app.vercel.app
```

### Update Environment Variables

1. Go to Project Settings → Environment Variables
2. Edit values
3. Redeploy (Vercel auto-deploys on git push)

### Database Backups

Neon automatically backs up your data. To manual backup:

1. Go to Neon Console
2. Click "Backup & Restore"
3. Create backup

### Redeploy

Push changes to GitHub:

```bash
git add .
git commit -m "Update feature X"
git push
```

Vercel auto-deploys within 1-2 minutes.

---

## Troubleshooting

### Build fails with "Cannot find module '@prisma/client'"

Add to vercel.json:

```json
{
  "buildCommand": "prisma generate && next build"
}
```

### Database connection timeout

- Check `DATABASE_URL` is correct
- Verify Neon project is not paused
- Ensure `?sslmode=require` is in connection string

### Email sending fails in production

- Verify all EMAIL_* env vars are set in Vercel
- Check Gmail App Password is correct
- Test locally first with same env vars

### App shows blank page

- Check Vercel deployment logs
- Look for JavaScript errors in browser console
- Verify all environment variables are set

---

## Cost Breakdown (Free Tiers)

| Service | Free Tier Limits |
|---------|------------------|
| Vercel | 100 GB bandwidth, unlimited projects |
| Neon PostgreSQL | 500 MB storage, 10 projects |
| UptimeRobot | 50 monitors, 5-min intervals |
| **Total Cost** | **$0/month** ✅ |

---

## Scaling Beyond Free Tier

If you outgrow free tiers:

1. **Vercel Pro** ($20/mo) - More bandwidth, advanced features
2. **Neon Scale** ($19/mo) - 10 GB storage, better performance
3. **Professional email** ($6/user/mo) - Google Workspace or similar

---

## Security Best Practices

- [ ] Keep `.env` in `.gitignore` (never commit secrets)
- [ ] Use strong App Passwords
- [ ] Regularly update dependencies: `npm update`
- [ ] Monitor Vercel logs for suspicious activity
- [ ] Enable Vercel password protection if needed (Project Settings → Deployment Protection)

---

## Support & Updates

### Update the App

```bash
git pull
npm install
npx prisma migrate dev
npm run dev
```

### Prisma Studio (View Database)

```bash
npx prisma studio
```

Opens at [http://localhost:5555](http://localhost:5555)

---

🎉 **Congratulations!** Your booking management system is now live!

**Production URL:** https://your-app.vercel.app

Share this URL with your team and start managing bookings!
