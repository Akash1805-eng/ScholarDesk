# Scholarship Desk — Production Deployment Guide
**Digital Scholarship Application and Approval Management System**

This guide provides step-by-step instructions for deploying the system to **Vercel** (Frontend), **Render Web Service** (Backend), and **MongoDB Atlas** (Database).

---

## 1. Architecture & Platform Overview

```
┌─────────────────────────────────┐
│   Vercel (React + Vite SPA)     │  https://your-app.vercel.app
│   Root Directory: client        │
└───────────────┬─────────────────┘
                │
                │ Same-origin proxy (/api/* rewrites) OR Direct Cross-Origin
                ▼
┌─────────────────────────────────┐
│   Render Web Service (Node.js)  │  https://your-api.onrender.com
│   Root Directory: server        │
└───────────────┬─────────────────┘
                │
                ├──────────────────────────────┬──────────────────────────────┐
                ▼                              ▼                              ▼
┌───────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│ MongoDB Atlas (Replica Set)   │ │ AWS S3 / Cloudflare R2    │ │ SendGrid (Email Service)  │
│ (Database & Collection Data)  │ │ (Persistent Document PDF) │ │ (OTP & Notifications)     │
└───────────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Prerequisites & Accounts

1. **GitHub / GitLab / Bitbucket**: Git repository hosting the project code.
2. **MongoDB Atlas Account**: [cloud.mongodb.com](https://cloud.mongodb.com) (Free tier M0 or dedicated).
3. **Render Account**: [render.com](https://render.com) (Standard Web Service).
4. **Vercel Account**: [vercel.com](https://vercel.com) (Hobby or Pro).
5. **SendGrid Account**: [sendgrid.com](https://sendgrid.com) with Single Sender Verification or Verified Domain.
6. **AWS S3 or Cloudflare R2 Account** (Optional but Recommended for production file uploads): S3-compatible bucket for permanent storage.

---

## 3. MongoDB Atlas Setup

### Step 3.1: Create Cluster & Database
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a new database deployment (Free `M0` cluster is sufficient for staging/demonstration; `M10+` for production).
3. Choose a provider and region geographically close to your Render deployment region (e.g., `AWS / us-east-1` or `Frankfurt`).

### Step 3.2: Configure Database User (Least Privilege)
1. In the Atlas sidebar, navigate to **Security** → **Database Access**.
2. Click **Add New Database User**.
3. Authentication Method: **Password**.
4. Set a strong username (e.g. `scholarship_app_user`) and a 32+ character random password.
5. Database User Privileges: Select **Read and write to any database** (or restrict to your specific DB name: `scholarship_management`).
6. Click **Add User**.
> [!CAUTION]
> Never use the Atlas root/admin account for your application connection.

### Step 3.3: Network Access (IP Whitelist)
1. In the Atlas sidebar, navigate to **Security** → **Network Access**.
2. Click **Add IP Address**.
3. **Render IP Considerations**:
   - Render Free Web Services use dynamic outbound IP addresses that can change over time.
   - For Render Free Tier or without a Static Outbound IP add-on, enter `0.0.0.0/0` (Allow Access from Anywhere).
   - If using Render Team with Dedicated Outbound IPs, add only the exact static IP addresses provided by Render.
> [!WARNING]
> If configuring `0.0.0.0/0`, your MongoDB cluster is defended solely by username/password. Ensure your database user password is long, random, and guarded in your Render environment variables.

### Step 3.4: Retrieve Connection String
1. In **Deployment** → **Database**, click **Connect**.
2. Select **Drivers** (Node.js, version 5.5 or later).
3. Copy the SRV URI. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/scholarship_management?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with the credentials created in Step 3.2. Set the database name to `scholarship_management`.

---

## 4. Render Backend Deployment

### Step 4.1: Create Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your Git repository.
4. Fill in the service configuration:
   - **Name**: `scholarship-desk-api` (or your chosen service name).
   - **Region**: Select the region matching your Atlas cluster.
   - **Branch**: `main` (or your production deployment branch).
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Instance Type**: `Starter` or `Free`

### Step 4.2: Health Check Configuration
In **Advanced Settings**:
- **Health Check Path**: `/api/health`

### Step 4.3: Render Environment Variables
In the **Environment** tab of your Render service, add the following variables:

| Variable Name | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations and security headers |
| `PORT` | `10000` *(Render sets this automatically)* | Port Express binds to on `0.0.0.0` |
| `TRUST_PROXY` | `1` | Enables secure cookie processing behind Render's HTTPS reverse proxy |
| `MONGODB_URI` | `mongodb+srv://...` | Atlas connection string from Section 3 |
| `JWT_SECRET` | *(64-char random string)* | Secret for signing session JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `CLIENT_URL` | `https://your-app.vercel.app` | Allowed CORS origin (no trailing slash) |
| `COOKIE_SAMESITE` | `lax` *(if using Vercel rewrite)* or `none` *(if cross-origin)* | Cookie cross-site transmission policy |
| `COOKIE_DOMAIN` | *(leave blank)* | Do NOT set to `localhost`. Host-only cookie default |
| `COLLEGE_EMAIL_DOMAIN` | `eec.srmrmp.edu.in` | Valid institution domain for student registrations |
| `APPROVED_DEPARTMENTS`| `CSE,IT,ECE,EEE,MECH,CIVIL,AIDS,AIML,CSD` | Permitted departments |
| `INSTITUTION_TIMEZONE` | `Asia/Kolkata` | Timezone for expiry notifications and daily cron jobs |
| `SENDGRID_API_KEY` | `SG.xxxxxxxx...` | SendGrid API Key with Mail Send permissions |
| `EMAIL_FROM` | `Scholarship Desk <noreply@yourdomain.com>` | Verified SendGrid sender address |
| `OTP_EXPIRY_SECONDS` | `30` | OTP validity window |
| `OTP_MAX_ATTEMPTS` | `5` | Maximum retry attempts per OTP |
| `STORAGE_PROVIDER` | `s3` *(or `local` for testing)* | Cloud storage provider |
| `AWS_REGION` | `us-east-1` | S3 / R2 Bucket Region |
| `AWS_ACCESS_KEY_ID` | `AKIAxxxxxxxx` | Cloud Storage Access Key |
| `AWS_SECRET_ACCESS_KEY` | `xxxxxxxxxxxx` | Cloud Storage Secret Key |
| `AWS_S3_BUCKET` | `scholarship-desk-documents` | S3 / R2 Bucket Name |
| `AWS_ENDPOINT` | *(optional, e.g. for Cloudflare R2)* | Custom S3 endpoint (leave blank for AWS) |
| `UPLOAD_FILE_SIZE_LIMIT_MB`| `10` | Maximum upload size per document |

5. Click **Create Web Service**.
6. Wait for the build to complete and note your Render service URL:
   `https://scholarship-desk-api.onrender.com`

---

## 5. Vercel Frontend Deployment

### Step 5.1: Create Vercel Project
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your Git repository.
4. In **Project Configuration**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

### Step 5.2: Configure Vercel API Routing
The application supports two API routing strategies:

#### Strategy A: Same-Origin Vercel Proxy (Recommended)
This approach routes `/api/*` through Vercel's edge proxy directly to Render.
- **Benefits**:
  - No cross-site cookie blocking in strict privacy browsers (Safari, Brave, Chrome Incognito).
  - First-party `SameSite=Lax` cookies work reliably without cross-origin issues.
- **Configuration**:
  Update `client/vercel.json` in your repository:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "cleanUrls": true,
    "rewrites": [
      {
        "source": "/api/:path*",
        "destination": "https://scholarship-desk-api.onrender.com/api/:path*"
      },
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
  *(Replace `https://scholarship-desk-api.onrender.com` with your actual Render URL).*

#### Strategy B: Direct Cross-Origin API
- If you prefer direct requests from the browser to Render:
  1. In Vercel Project Settings → **Environment Variables**, set:
     ```
     VITE_API_URL = https://scholarship-desk-api.onrender.com/api
     ```
  2. On Render, set:
     ```
     CLIENT_URL = https://your-app.vercel.app
     COOKIE_SAMESITE = none
     ```

### Step 5.3: Deploy Frontend
1. Click **Deploy**.
2. Once complete, your site will be live at `https://your-app.vercel.app`.
3. If using Strategy B, ensure the exact Vercel domain is copied into Render's `CLIENT_URL`.

---

## 6. Seed Initial Administrator Account

To access the Admin Portal in a freshly deployed environment:

1. Open Render Dashboard → Select your Web Service → Click **Shell**.
2. Run the interactive administrator creation script:
   ```bash
   ADMIN_EMAIL="admin@eec.srmrmp.edu.in" ADMIN_PASSWORD="YourStrongAdminPassword123!" node src/scripts/createAdmin.js
   ```
   *(Or run `npm run seed` to initialize test scholarships and student master catalog).*

---

## 7. Verification & Post-Deployment Checklist

Execute the following verification steps on the live deployment:

- [ ] **Health Endpoint**:
  Visit `https://your-api.onrender.com/api/health` and verify HTTP 200:
  `{"status":"ok","service":"Scholarship Desk API","timestamp":"..."}`
- [ ] **SPA Direct Route Refresh**:
  In your browser, navigate to `https://your-app.vercel.app/login` and refresh the page directly. Ensure it renders without 404 errors.
- [ ] **Login & Role Buttons**:
  Click **Student**, **Verifier**, and **Admin** on the login page; verify that dynamic placeholders update and role mismatch validation rejects mismatched credentials.
- [ ] **Authentication Cookies**:
  Log in and inspect Developer Tools → Application → Cookies. Verify that the `token` cookie is present with `HttpOnly` and `Secure` attributes enabled.
- [ ] **Document Upload**:
  Log in as a student, upload a certificate (under 10 MB in PDF/JPEG/PNG/WebP), and verify the document appears in the Document Library.
- [ ] **Conditional Expiry**:
  Select **Identity Proof** (Expiry Date appears, optional); select **Marksheet** (Expiry Date hidden).

---

## 8. Troubleshooting Common Production Issues

### Issue 1: CORS Error in Browser Console (`Access-Control-Allow-Origin`)
- **Cause**: The `CLIENT_URL` environment variable on Render does not match the Vercel URL.
- **Fix**:
  1. Check browser console for the exact Origin header (e.g. `https://scholarship-desk-akash.vercel.app`).
  2. In Render environment settings, update `CLIENT_URL` to match (without trailing slash).
  3. Wait 1–2 minutes for Render to redeploy with the new environment variable.

### Issue 2: Immediate Logout / 401 on Every Request
- **Cause**: Browser is blocking cross-site cookies, or `COOKIE_DOMAIN` was mistakenly set to `localhost`.
- **Fix**:
  1. Ensure `COOKIE_DOMAIN` on Render is empty/unset.
  2. If using direct cross-origin, ensure `COOKIE_SAMESITE=none` on Render.
  3. Alternatively, switch to Strategy A (Vercel same-origin `/api` rewrites in `client/vercel.json`), which avoids all third-party cookie restrictions.

### Issue 3: Render Free Tier Cold Starts
- **Cause**: Free tier instances spin down after 15 minutes of inactivity. The first request after sleep may take 30–50 seconds to respond.
- **Mitigation**:
  1. Upgrade to a Render `Starter` tier ($7/mo) for 24/7 persistent execution.
  2. Or configure a free external uptime monitor (e.g. UptimeRobot or Cron-Job.org) to ping `https://your-api.onrender.com/api/health` every 10 minutes.

### Issue 4: Document Uploads Disappearing After Server Restart
- **Cause**: `STORAGE_PROVIDER=local` is active on an ephemeral cloud container.
- **Fix**:
  Configure AWS S3 or Cloudflare R2 bucket credentials and set `STORAGE_PROVIDER=s3`. Cloudflare R2 offers 10 GB free storage per month with zero egress fees.

---

## 9. Security Maintenance & Data Protection

1. **Atlas Automated Backups**:
   In Atlas, enable daily snapshots under **Backup** to prevent accidental data loss.
2. **Secret Rotation**:
   If a `JWT_SECRET` is rotated, all active student and staff sessions will be logged out and prompted to log in again.
3. **Restricting CORS**:
   Never set `CLIENT_URL=*` when using credentialed cookie authentication. Express and browser security standards strictly reject wildcard origins with credentials.
