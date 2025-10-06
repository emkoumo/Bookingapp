# 🔄 Database Keepalive Setup (Optional)

## ⚠️ Should You Use Keepalive?

### ❌ **DO NOT USE** if:
- Personal/internal tool with <5 concurrent users ✓ **YOUR CASE**
- Intermittent usage patterns (few times per day)
- 500ms first-request delay is acceptable
- Want to maximize free tier compute hours

### ✅ **USE** if:
- Multiple users accessing simultaneously (>10 users)
- Can't tolerate ANY delay on first request
- Have consistent traffic throughout the day
- Willing to use ~30% of compute hours for keepalive

---

## 📊 Cost Analysis

### Without Keepalive:
- **Compute hours used:** ~20-40 hours/month (actual usage only)
- **Cold start:** 500ms on first request after 5 min idle
- **Subsequent requests:** Normal speed
- **Free tier usage:** 20-40% of 100 CU-hours

### With Keepalive (every 4 minutes):
- **Compute hours used:** ~60-80 hours/month (usage + keepalive)
- **Cold start:** Never (always warm)
- **All requests:** Normal speed
- **Free tier usage:** 60-80% of 100 CU-hours
- **Function invocations:** ~10,800/month (1% of 1M)

---

## 🚀 Setup Option 1: Vercel Cron (Recommended if needed)

### Step 1: Enable Cron in vercel.json

```json
{
  "crons": [{
    "path": "/api/keepalive",
    "schedule": "*/4 * * * *"
  }]
}
```

### Step 2: Deploy to Vercel

The cron will automatically start running.

### Step 3: Monitor

Check Vercel dashboard → Functions → `/api/keepalive`

---

## 🌐 Setup Option 2: External Cron Service (Free)

### Using cron-job.org (Free Plan)

**Pros:**
- No cost to Vercel function invocations
- Independent of your hosting
- Can monitor uptime

**Cons:**
- Requires external service account
- Slightly less reliable than Vercel Cron

### Setup Steps:

1. **Create Account:** https://cron-job.org/en/signup/

2. **Create Cron Job:**
   - URL: `https://your-app.vercel.app/api/keepalive`
   - Schedule: Every 4 minutes (`*/4 * * * *`)
   - Execution: HTTP GET

3. **Enable Monitoring:**
   - Email alerts on failure
   - Success rate tracking

---

## 📈 Monitoring Keepalive

### Check if Working:

```bash
curl https://your-app.vercel.app/api/keepalive
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-06T12:34:56.789Z",
  "message": "Database connection active"
}
```

### Vercel Dashboard:

1. Go to your project → Functions
2. Check `/api/keepalive` invocations
3. Should see ~360 calls/day if working

### Neon Dashboard:

1. Go to console.neon.tech → Your Project
2. Check "Monitoring" tab
3. Should see continuous low activity

---

## 🛑 Disabling Keepalive

### If using Vercel Cron:

1. Remove `crons` section from `vercel.json`
2. Redeploy
3. Done!

### If using External Cron:

1. Go to cron-job.org
2. Disable or delete the job
3. Done!

---

## 🎯 Recommendation for Your App

**Based on your use case (internal booking management, 2-5 users):**

### ❌ **DO NOT ENABLE KEEPALIVE**

**Reasons:**
1. 500ms cold start is acceptable for internal tools
2. Saves 40% of free tier compute hours
3. Users won't notice 500ms delay occasionally
4. Intermittent usage patterns benefit from auto-suspend
5. Keeps setup simple

### When to Reconsider:

- If you get complaints about slow first load
- If you add >10 concurrent users
- If you need instant responses 24/7
- If you move to paid plan anyway

---

## 📝 Testing Cold Start Delay

Want to see the 500ms delay yourself?

1. Wait 10 minutes without accessing the app
2. Open the app and measure first request
3. Subsequent requests will be fast

Most users won't notice 500ms on occasional first load!

---

## ✅ Current Recommendation

**Keep the `/api/keepalive` route** for future use, but **DO NOT enable cron** unless needed.

The route is there if you change your mind later!
