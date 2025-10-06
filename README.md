# 🏨 Booking Management System

A mobile-first internal booking management web app for **Evaggelia Rental Apartments** and **Elegancia Luxury Villas**.

Built with **Next.js**, **TailwindCSS**, **Prisma**, and **Neon PostgreSQL** — fully deployable on free tiers.

## ✨ Features

- 📅 **Calendar View** - Full calendar with FullCalendar integration
- 📋 **Bookings Management** - Create, edit, delete bookings with search/filter
- 📊 **Reports** - Statistics, CSV/PDF export
- ✉️ **Email System** - Automated email templates with customizable content
- 🏢 **Multi-Business** - Switch between two businesses
- 📱 **PWA Ready** - Installable on mobile devices
- 🇬🇷 **Greek UI** - All interface labels in Greek
- 🔄 **Real-time** - Auto-refresh with polling
- 🆓 **100% Free** - Hosted on Vercel + Neon PostgreSQL free tiers

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- A Neon PostgreSQL account (free tier)
- Vercel account (for deployment)
- Gmail or SMTP credentials for sending emails

### 2. Database Setup (Neon PostgreSQL)

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project (free tier)
3. Copy your connection string (looks like: `postgresql://user:password@host.neon.tech/database?sslmode=require`)

### 3. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 4. Environment Variables

Create a \`.env\` file in the root directory:

\`\`\`env
# Neon Database URL
DATABASE_URL="your-neon-connection-string-here"

# Email Configuration
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"

# Business Emails
EMAIL_FROM_EVAGGELIA="info@evaggelias-apts.com"
EMAIL_FROM_ELEGANCIA="info@elegancialuxuryvillas.com"

# Bank Details for Evaggelia
EVAGGELIA_BANK_NAME="Alpha Bank"
EVAGGELIA_IBAN="GR1234567890123456789012345"
EVAGGELIA_ACCOUNT_HOLDER="Evaggelia Rental Apartments"

# Western Union Details for Evaggelia
EVAGGELIA_WU_RECIPIENT="Recipient Name"
EVAGGELIA_WU_CITY="Athens"
EVAGGELIA_WU_COUNTRY="Greece"

# Bank Details for Elegancia
ELEGANCIA_BANK_NAME="Alpha Bank"
ELEGANCIA_IBAN="GR0987654321098765432109876"
ELEGANCIA_ACCOUNT_HOLDER="Elegancia Luxury Villas"

# Western Union Details for Elegancia
ELEGANCIA_WU_RECIPIENT="Recipient Name"
ELEGANCIA_WU_CITY="Athens"
ELEGANCIA_WU_COUNTRY="Greece"
\`\`\`

> **Note:** For Gmail, you need to create an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

### 5. Database Migration & Seed

\`\`\`bash
# Generate Prisma client
npx prisma generate

# Run database migration
npx prisma migrate dev --name init

# Seed database with initial data
npm run db:seed
\`\`\`

This will create:
- 2 businesses (Evaggelia & Elegancia)
- 4 apartments for Evaggelia
- 3 villas for Elegancia
- 4 email templates per business

### 6. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Deployment to Vercel

### 1. Push to GitHub

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/booking-app.git
git push -u origin main
\`\`\`

### 2. Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Add all environment variables from your \`.env\` file
5. Click **Deploy**

### 3. Set Up Keep-Alive (Prevent Database Sleep)

Neon free tier pauses after inactivity. Set up a cron job to keep it alive:

1. Go to [UptimeRobot](https://uptimerobot.com/) (free)
2. Create a new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://your-app.vercel.app/api/ping`
   - **Interval:** Every 5 minutes
3. This will ping your database regularly to prevent it from sleeping

---

## 📧 Email Templates

The app includes 4 pre-configured email templates (in English):

1. **No Availability** - When requested dates are not available
2. **Alternative Dates** - Suggest alternative date ranges
3. **Availability Confirmation** - Confirm dates are available
4. **Booking Confirmation** - Confirm booking with payment details

### Placeholders

Use these placeholders in your templates:

- `{{CUSTOMER_NAME}}` - Customer name
- `{{ALTERNATIVE_DATES}}` - List of alternative date ranges
- `{{CHECK_IN}}` - Check-in date
- `{{CHECK_OUT}}` - Check-out date
- `{{PAYMENT_INFO}}` - Bank or Western Union details

---

## 🗄️ Database Schema

\`\`\`
Business
  ├── id (UUID)
  ├── name (String)
  ├── email (String)
  ├── properties (Relation)
  └── emailTemplates (Relation)

Property
  ├── id (UUID)
  ├── businessId (FK → Business)
  ├── name (String)
  ├── description (String?)
  └── bookings (Relation)

Booking
  ├── id (UUID)
  ├── propertyId (FK → Property)
  ├── customerName (String)
  ├── contactInfo (String?)
  ├── checkIn (Date)
  ├── checkOut (Date)
  ├── deposit (String?)
  ├── notes (String?)
  └── status (active|completed|canceled)

EmailTemplate
  ├── id (UUID)
  ├── businessId (FK → Business)
  ├── name (String)
  ├── subject (String)
  ├── body (String)
  └── imageUrl (String?)
\`\`\`

---

## 🔧 Available Scripts

\`\`\`bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run db:seed      # Seed database with initial data
npx prisma studio    # Open Prisma Studio (database GUI)
npx prisma migrate   # Create new migration
\`\`\`

---

## 📱 PWA Installation

The app can be installed on mobile devices:

1. Open the app in Safari (iOS) or Chrome (Android)
2. **iOS:** Tap Share → Add to Home Screen
3. **Android:** Tap Menu → Install App

---

## 🎨 Customization

### Change Colors

Edit \`tailwind.config.ts\`:

\`\`\`ts
theme: {
  extend: {
    colors: {
      primary: '#3b82f6',  // Change primary color
    }
  }
}
\`\`\`

### Add More Properties

\`\`\`bash
npx prisma studio
\`\`\`

Open Prisma Studio and add properties manually, or modify \`prisma/seed.ts\`.

### Modify Email Templates

Go to the **Email Templates** page in the app to edit templates directly from the UI.

---

## 🐛 Troubleshooting

### Database connection issues

- Make sure your \`DATABASE_URL\` includes \`?sslmode=require\`
- Check if your Neon project is active (not paused)

### Email sending fails

- Verify Gmail App Password is correct
- Check SMTP settings for your email provider
- Make sure 2FA is enabled on Gmail

### Build errors on Vercel

- Ensure all environment variables are set in Vercel dashboard
- Check build logs for specific errors

### Calendar not showing events

- Check browser console for errors
- Verify bookings exist in database
- Ensure business is selected

---

## 📊 Tech Stack

- **Framework:** Next.js 15.5 (App Router)
- **Styling:** TailwindCSS 3.4
- **Database:** Neon PostgreSQL (free tier)
- **ORM:** Prisma 6
- **Calendar:** FullCalendar React
- **PDF Export:** jsPDF + jsPDF-AutoTable
- **Email:** Nodemailer
- **Hosting:** Vercel (free tier)
- **PWA:** next-pwa

---

## 📄 License

MIT License - feel free to use this for your own projects!

---

## 🤝 Support

For issues or questions, please open an issue on GitHub.

---

## 🎯 Roadmap

- [ ] Email sending modal with preview
- [ ] WhatsApp/Viber integration
- [ ] Multiple date range selection for alternative dates
- [ ] Push notifications for new bookings
- [ ] Dark mode
- [ ] Multi-language support

---

**Built with ❤️ for Evaggelia Rental Apartments & Elegancia Luxury Villas**
# Repository is now public and ready for deployment
