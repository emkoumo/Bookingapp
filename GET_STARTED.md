# 🚀 Get Started in 5 Minutes

Quick start guide to get your booking management system running.

---

## ⚡ Quick Setup (5 steps)

### 1️⃣ Set Up Database (2 minutes)

1. Visit [console.neon.tech](https://console.neon.tech)
2. Sign up → Create project → Copy connection string

### 2️⃣ Configure Environment (1 minute)

```bash
# Copy example file
cp .env.example .env

# Edit .env and add your database URL
nano .env  # or use any text editor
```

### 3️⃣ Install & Setup (2 minutes)

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

### 4️⃣ Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) ✨

### 5️⃣ Deploy (Optional)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_URL
git push -u origin main

# Then import to Vercel from their dashboard
```

---

## 🎯 What You Get

✅ **Home** - Business selector & dashboard
✅ **Calendar** - Visual booking calendar with FullCalendar
✅ **Bookings** - Create, edit, search bookings
✅ **Reports** - Statistics & CSV/PDF exports
✅ **Templates** - Email template editor

---

## 📋 Need More Help?

| Document | Purpose |
|----------|---------|
| **README.md** | Full documentation |
| **SETUP.md** | Detailed setup guide |
| **DEPLOYMENT.md** | Deployment instructions |
| **CHECKLIST.md** | Pre-deployment checklist |
| **QUICK_REFERENCE.md** | Command reference |

---

## 🆘 Common Issues

**"Cannot find module '@prisma/client'"**
```bash
npx prisma generate
```

**"Database connection failed"**
- Check DATABASE_URL in .env
- Make sure it includes `?sslmode=require`

**"Email not sending"**
- Configure EMAIL_* variables in .env
- Use Gmail App Password (not regular password)

---

## 🎉 You're Ready!

Start managing bookings for:
- **Evaggelia Rental Apartments** (4 apartments)
- **Elegancia Luxury Villas** (3 villas)

Need help? Check README.md for full documentation.

**Happy booking! 🏨✨**
