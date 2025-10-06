# ✅ Pre-Deployment Checklist

Use this checklist to ensure everything is set up correctly before deploying.

---

## 📋 Initial Setup

### Database Setup
- [ ] Created Neon PostgreSQL account
- [ ] Created new database project
- [ ] Copied connection string
- [ ] Connection string includes `?sslmode=require`

### Environment Configuration
- [ ] Copied `.env.example` to `.env`
- [ ] Added `DATABASE_URL`
- [ ] Configured email settings (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`)
- [ ] Added business email addresses
- [ ] Filled in bank details for Evaggelia
- [ ] Filled in Western Union details for Evaggelia
- [ ] Filled in bank details for Elegancia
- [ ] Filled in Western Union details for Elegancia

### Email Setup (Gmail)
- [ ] Enabled 2-Factor Authentication on Google account
- [ ] Generated App Password (not regular password)
- [ ] Added App Password to `.env`
- [ ] Verified from address matches business email

---

## 🛠️ Local Development

### Installation
- [ ] Ran `npm install` successfully
- [ ] No error messages in installation

### Database Migration
- [ ] Ran `npx prisma generate`
- [ ] Ran `npx prisma migrate dev --name init`
- [ ] Migration completed without errors
- [ ] Ran `npm run db:seed`
- [ ] Seed completed successfully (2 businesses, 7 properties, 8 templates)

### Testing Locally
- [ ] Ran `npm run dev`
- [ ] App opens at `http://localhost:3000`
- [ ] Home page loads correctly
- [ ] Can select a business from dropdown
- [ ] Business selection persists (LocalStorage)

### Feature Testing
- [ ] **Calendar Page**
  - [ ] Calendar loads and displays
  - [ ] Can switch between month/week/day views
  - [ ] Property filter works
  - [ ] Legend shows all properties with colors

- [ ] **Bookings Page**
  - [ ] Can create a new booking
  - [ ] Booking appears in list
  - [ ] Search functionality works
  - [ ] Status filter works
  - [ ] Can edit a booking
  - [ ] Can delete a booking
  - [ ] Overlap detection prevents double-booking

- [ ] **Reports Page**
  - [ ] Statistics display correctly
  - [ ] Date range filter works
  - [ ] CSV export downloads file
  - [ ] PDF export downloads file
  - [ ] Table shows all bookings

- [ ] **Templates Page**
  - [ ] All 4 templates load
  - [ ] Can select a template
  - [ ] Can edit template subject
  - [ ] Can edit template body
  - [ ] Can add image URL
  - [ ] Save button works
  - [ ] Changes persist after save

### Database Verification
- [ ] Ran `npx prisma studio`
- [ ] Opened at `http://localhost:5555`
- [ ] Can view all tables (Business, Property, Booking, EmailTemplate)
- [ ] 2 businesses exist
- [ ] 4 properties for Evaggelia
- [ ] 3 properties for Elegancia
- [ ] 4 email templates per business

---

## 🚀 Deployment Preparation

### GitHub Setup
- [ ] Created GitHub repository
- [ ] Repository is private (recommended for internal use)
- [ ] Initialized git: `git init`
- [ ] Added all files: `git add .`
- [ ] Created first commit: `git commit -m "Initial commit"`
- [ ] Pushed to GitHub: `git push -u origin main`

### Vercel Account
- [ ] Created Vercel account
- [ ] Linked GitHub account
- [ ] Verified email address

### Pre-Deployment Review
- [ ] All sensitive data in `.env` (not in code)
- [ ] `.env` is in `.gitignore`
- [ ] No console.log debugging statements left in code
- [ ] All features tested locally
- [ ] Documentation reviewed

---

## 🌐 Vercel Deployment

### Import Project
- [ ] Clicked "New Project" in Vercel
- [ ] Selected repository from GitHub
- [ ] Framework detected as "Next.js"
- [ ] Build settings auto-configured

### Environment Variables
Copy from `.env` and add to Vercel:

- [ ] `DATABASE_URL`
- [ ] `EMAIL_HOST`
- [ ] `EMAIL_PORT`
- [ ] `EMAIL_USER`
- [ ] `EMAIL_PASSWORD`
- [ ] `EMAIL_FROM_EVAGGELIA`
- [ ] `EMAIL_FROM_ELEGANCIA`
- [ ] `EVAGGELIA_ID_BANK_NAME`
- [ ] `EVAGGELIA_ID_IBAN`
- [ ] `EVAGGELIA_ID_ACCOUNT_HOLDER`
- [ ] `EVAGGELIA_ID_WU_RECIPIENT`
- [ ] `EVAGGELIA_ID_WU_CITY`
- [ ] `EVAGGELIA_ID_WU_COUNTRY`
- [ ] `ELEGANCIA_ID_BANK_NAME`
- [ ] `ELEGANCIA_ID_IBAN`
- [ ] `ELEGANCIA_ID_ACCOUNT_HOLDER`
- [ ] `ELEGANCIA_ID_WU_RECIPIENT`
- [ ] `ELEGANCIA_ID_WU_CITY`
- [ ] `ELEGANCIA_ID_WU_COUNTRY`

> **Important:** Set environment variables for "Production", "Preview", AND "Development"

### Deploy
- [ ] Clicked "Deploy"
- [ ] Deployment completed successfully
- [ ] Build logs show no errors
- [ ] Received deployment URL

---

## 🧪 Post-Deployment Testing

### Basic Functionality
- [ ] Visited production URL
- [ ] Home page loads
- [ ] Can select business
- [ ] Navigation works

### Full Feature Test
- [ ] **Calendar**
  - [ ] Opens without errors
  - [ ] Shows correct data from database
  - [ ] Events are clickable

- [ ] **Bookings**
  - [ ] Can create new booking
  - [ ] Booking saves to database
  - [ ] Can view in list
  - [ ] Can edit booking
  - [ ] Can delete booking

- [ ] **Reports**
  - [ ] Statistics calculate correctly
  - [ ] CSV export works
  - [ ] PDF export works
  - [ ] Date filtering works

- [ ] **Templates**
  - [ ] All templates load
  - [ ] Can edit and save
  - [ ] Changes persist

### API Testing
- [ ] Visited `/api/ping`
- [ ] Returns JSON with status "ok"
- [ ] Timestamp is current

### Mobile Testing
- [ ] Opened on mobile device
- [ ] UI is responsive
- [ ] All features work on mobile
- [ ] Can install as PWA

---

## 🔄 Keep-Alive Setup

### UptimeRobot Configuration
- [ ] Created UptimeRobot account
- [ ] Added new HTTP(s) monitor
- [ ] Set URL: `https://your-app.vercel.app/api/ping`
- [ ] Set interval: 5 minutes
- [ ] Monitor is active
- [ ] First ping successful

---

## 📧 Email Testing

### Test Email Sending
- [ ] Created test booking
- [ ] Attempted to send email (if UI supports it)
- [ ] Email received successfully
- [ ] Email content formatted correctly
- [ ] Placeholders replaced properly
- [ ] From address correct

**Note:** If email modal UI not yet built, test using API directly:

```bash
curl -X POST https://your-app.vercel.app/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "evaggelia-id",
    "templateName": "availability_confirmation",
    "recipientEmail": "test@example.com",
    "recipientName": "Test Customer"
  }'
```

---

## 🔐 Security Review

- [ ] `.env` not committed to git
- [ ] No API keys in code
- [ ] Database uses SSL (`?sslmode=require`)
- [ ] Email uses secure SMTP (port 587 with TLS)
- [ ] App Password used (not regular password)
- [ ] Vercel environment variables marked as sensitive

---

## 📱 PWA Testing

### iOS Testing
- [ ] Opened in Safari
- [ ] Tapped Share → Add to Home Screen
- [ ] Icon appears on home screen
- [ ] Opens in standalone mode (no browser UI)
- [ ] App functions correctly

### Android Testing
- [ ] Opened in Chrome
- [ ] Saw "Install app" prompt
- [ ] Installed successfully
- [ ] Icon appears on home screen
- [ ] Opens in standalone mode
- [ ] App functions correctly

---

## 📊 Performance Check

- [ ] Pages load quickly (< 3 seconds)
- [ ] No JavaScript errors in console
- [ ] Images load properly
- [ ] Calendar renders smoothly
- [ ] Database queries are fast
- [ ] No timeout errors

---

## 📚 Documentation Review

- [ ] README.md is complete
- [ ] SETUP.md instructions are clear
- [ ] DEPLOYMENT.md covers all steps
- [ ] QUICK_REFERENCE.md is useful
- [ ] PROJECT_SUMMARY.md is accurate

---

## 🎯 Final Checks

### Admin Training
- [ ] Showed admin how to select business
- [ ] Demonstrated creating booking
- [ ] Showed how to use calendar
- [ ] Explained reports/exports
- [ ] Trained on email templates

### Business Data
- [ ] Verified Evaggelia has 4 apartments
- [ ] Verified Elegancia has 3 villas
- [ ] All property names correct
- [ ] Business emails correct
- [ ] Bank details accurate
- [ ] Western Union details accurate

### Backup Plan
- [ ] Documented database backup process
- [ ] Saved copy of `.env` file (securely)
- [ ] Bookmarked Neon Console
- [ ] Bookmarked Vercel Dashboard
- [ ] Created admin credentials document (if needed)

---

## 🎉 Launch Readiness

### All Systems Go?
- [ ] Local development works ✅
- [ ] Deployed to Vercel ✅
- [ ] Database connected ✅
- [ ] All features tested ✅
- [ ] Email configured ✅
- [ ] Keep-alive setup ✅
- [ ] Mobile responsive ✅
- [ ] PWA installable ✅
- [ ] Documentation complete ✅
- [ ] Team trained ✅

---

## 🚨 Emergency Contacts & Resources

**If something breaks:**

1. **Check Vercel Logs:**
   ```bash
   vercel logs your-app.vercel.app
   ```

2. **Check Database:**
   - Visit [Neon Console](https://console.neon.tech)
   - Verify database is not paused

3. **Check UptimeRobot:**
   - Verify monitor is active
   - Check last ping was successful

4. **Rollback if needed:**
   - Vercel keeps previous deployments
   - Go to Deployments → Click previous → "Promote to Production"

---

## 📈 Post-Launch Monitoring

### Week 1
- [ ] Monitor Vercel logs daily
- [ ] Check UptimeRobot status
- [ ] Verify bookings are being created
- [ ] Ensure emails are sending
- [ ] Collect user feedback

### Week 2-4
- [ ] Review usage patterns
- [ ] Optimize slow queries if any
- [ ] Add requested features
- [ ] Update documentation as needed

---

## ✨ Success!

Once all checkboxes are ticked, your booking management system is:

✅ **Fully deployed**
✅ **Production-ready**
✅ **Tested and verified**
✅ **Documented**
✅ **Ready for daily use**

**Congratulations! 🎊**

Start managing your bookings for Evaggelia Rental Apartments and Elegancia Luxury Villas!

---

**Need help?** Refer to:
- README.md for full documentation
- SETUP.md for setup issues
- DEPLOYMENT.md for deployment problems
- QUICK_REFERENCE.md for command reminders
