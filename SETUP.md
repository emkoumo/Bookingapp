# 🚀 Quick Setup Guide

Follow these steps to get your booking management system up and running.

## Step 1: Set Up Neon Database

1. Visit [https://console.neon.tech/](https://console.neon.tech/)
2. Sign up for a free account
3. Click **"Create a project"**
4. Choose a region close to you
5. Click **"Create project"**
6. Copy the connection string (it will look like):
   ```
   postgresql://username:password@ep-xxxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   - Paste your Neon connection string in `DATABASE_URL`
   - Add your Gmail credentials (create an [App Password](https://support.google.com/accounts/answer/185833))
   - Update bank/Western Union details

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma migrate dev --name init

# Seed initial data (businesses, properties, templates)
npm run db:seed
```

## Step 5: Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Step 6: Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/booking-app.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click **"New Project"**
4. Import your GitHub repository
5. Add environment variables (copy from your `.env` file)
6. Click **"Deploy"**

## Step 7: Set Up Keep-Alive

To prevent the Neon database from sleeping:

1. Go to [https://uptimerobot.com](https://uptimerobot.com)
2. Sign up for free
3. Create a new monitor:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Booking App Keep-Alive
   - **URL:** `https://your-app.vercel.app/api/ping`
   - **Monitoring Interval:** 5 minutes
4. Click **"Create Monitor"**

## Step 8: Configure Email Sending

### Using Gmail:

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
   - Click **"2-Step Verification"**
   - Scroll down to **"App passwords"**
   - Generate a new app password for "Mail"
3. Use this password in your `.env` file

### Using Another SMTP Provider:

Update these in `.env`:
```env
EMAIL_HOST="smtp.yourprovider.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@domain.com"
EMAIL_PASSWORD="your-password"
```

## Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npx prisma generate
```

### Database connection errors
- Check your `DATABASE_URL` includes `?sslmode=require`
- Verify your Neon project is active

### Email not sending
- Verify Gmail App Password is correct
- Check email credentials in `.env`
- Test SMTP settings

### Build fails on Vercel
- Ensure all environment variables are set
- Check build logs for specific errors

## Next Steps

1. Open Prisma Studio to view your database:
   ```bash
   npx prisma studio
   ```

2. Customize email templates from the app UI

3. Add your business logo/images

4. Test booking creation and email sending

## Support

If you encounter issues, check:
- README.md for detailed documentation
- Vercel deployment logs
- Browser console for errors

---

✅ **You're all set!** Start managing your bookings!
