# ⚡ Quick Reference Guide

Fast reference for common tasks and commands.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Set up database
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Run locally
npm run dev
```

---

## 📦 Common Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm start                # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create new migration
npx prisma generate      # Regenerate Prisma client
npm run db:seed          # Seed database

# Deployment
git push                 # Auto-deploys to Vercel
vercel logs             # View deployment logs
```

---

## 🗄️ Database Operations

### View Database

```bash
npx prisma studio
```

### Add New Property

```sql
INSERT INTO "Property" (id, "businessId", name)
VALUES ('uuid-here', 'business-id', 'Property Name');
```

Or use Prisma Studio GUI.

### Backup Database

```bash
# Export via Neon Console or:
pg_dump $DATABASE_URL > backup.sql
```

---

## 🌐 URLs

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Business selector & navigation |
| Calendar | `/calendar?business=ID` | View bookings calendar |
| Bookings | `/bookings?business=ID` | Manage bookings list |
| Reports | `/reports?business=ID` | Statistics & exports |
| Templates | `/templates?business=ID` | Email template editor |
| Keep-Alive | `/api/ping` | Database health check |

---

## 📧 Email Template Placeholders

Use in email body:

```
{{CUSTOMER_NAME}}       - Customer name
{{ALTERNATIVE_DATES}}   - List of date ranges
{{CHECK_IN}}            - Check-in date (dd/MM/yyyy)
{{CHECK_OUT}}           - Check-out date (dd/MM/yyyy)
{{PAYMENT_INFO}}        - Bank/WU details
```

---

## 🏢 Business IDs

```javascript
Evaggelia: 'evaggelia-id'
Elegancia: 'elegancia-id'
```

---

## 🔧 Environment Variables

Required:

```env
DATABASE_URL           # Neon connection string
EMAIL_HOST             # SMTP host
EMAIL_PORT             # SMTP port (587)
EMAIL_USER             # SMTP username
EMAIL_PASSWORD         # SMTP password/app password
```

Optional (for email templates):

```env
EVAGGELIA_ID_BANK_NAME
EVAGGELIA_ID_IBAN
EVAGGELIA_ID_ACCOUNT_HOLDER
EVAGGELIA_ID_WU_RECIPIENT
EVAGGELIA_ID_WU_CITY
EVAGGELIA_ID_WU_COUNTRY

ELEGANCIA_ID_BANK_NAME
ELEGANCIA_ID_IBAN
ELEGANCIA_ID_ACCOUNT_HOLDER
ELEGANCIA_ID_WU_RECIPIENT
ELEGANCIA_ID_WU_CITY
ELEGANCIA_ID_WU_COUNTRY
```

---

## 🐛 Quick Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npx prisma generate
```

### Database connection error
- Check `DATABASE_URL` includes `?sslmode=require`
- Verify Neon project is active (not paused)

### Email not sending
- Verify Gmail App Password
- Check env vars are set

### Build fails
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Calendar not showing events
- Check browser console
- Verify bookings exist in database
- Ensure business is selected

---

## 📊 Database Schema Quick Ref

```
Business → Properties → Bookings
Business → EmailTemplates
```

**Booking Statuses:**
- `active` - Current/upcoming booking
- `completed` - Past booking
- `canceled` - Canceled booking

---

## 🔐 Gmail App Password Setup

1. Enable 2FA on Google account
2. Visit [myaccount.google.com/security](https://myaccount.google.com/security)
3. Go to "2-Step Verification" → "App passwords"
4. Generate new password for "Mail"
5. Use in `EMAIL_PASSWORD`

---

## 📱 PWA Installation

**iOS:**
1. Open in Safari
2. Tap Share button
3. "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Tap menu (⋮)
3. "Install app"

---

## 🔄 Update Workflow

```bash
# 1. Pull latest changes
git pull

# 2. Install new dependencies
npm install

# 3. Update database
npx prisma migrate dev

# 4. Test locally
npm run dev

# 5. Deploy
git add .
git commit -m "Update description"
git push
```

---

## 📈 UptimeRobot Setup

1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP(s) monitor
3. URL: `https://your-app.vercel.app/api/ping`
4. Interval: 5 minutes

---

## 🎨 Customization Quick Tips

### Change primary color
Edit `tailwind.config.ts`:
```ts
colors: {
  primary: '#3b82f6', // Your color here
}
```

### Add new property
Use Prisma Studio or seed file

### Modify email template
Use the Templates page in the app

### Change app name
Edit `public/manifest.json`

---

## 📞 Support Resources

- **README.md** - Full documentation
- **SETUP.md** - Initial setup guide
- **DEPLOYMENT.md** - Deployment guide
- **Prisma Docs** - [prisma.io/docs](https://www.prisma.io/docs)
- **Next.js Docs** - [nextjs.org/docs](https://nextjs.org/docs)
- **Vercel Support** - [vercel.com/support](https://vercel.com/support)

---

## ⌨️ Keyboard Shortcuts

(None built-in, but you can add them!)

Suggested additions:
- `Ctrl+N` - New booking
- `Ctrl+K` - Search
- `Esc` - Close modal

---

## 🔗 Useful Links

| Link | URL |
|------|-----|
| Neon Console | [console.neon.tech](https://console.neon.tech) |
| Vercel Dashboard | [vercel.com/dashboard](https://vercel.com/dashboard) |
| UptimeRobot | [uptimerobot.com](https://uptimerobot.com) |
| Prisma Studio | `npx prisma studio` |
| Local Dev | [localhost:3000](http://localhost:3000) |

---

**💡 Tip:** Bookmark this file for quick reference!
