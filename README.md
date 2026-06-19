# 📚 SchoolDesk — Homework Portal

A complete homework management web app for your school.
- **Teachers** post homework for their class
- **Students** view and submit homework (upload file or mark as "bringing physically")
- **Admin** manages all users and classes

Each class is completely separate — LKG students only see LKG homework, 1st std sees only 1st std homework, etc.

---

## ✅ What's Included

| Feature | Who |
|---|---|
| Login / Logout | Everyone |
| Dashboard with stats | Everyone |
| Post homework with file attachment | Teacher |
| View & submit homework | Student |
| Upload file OR mark "bringing physically" | Student |
| View all student submissions | Teacher |
| Add/remove students & teachers | Admin |
| View homework for all classes | Admin |
| Class-based isolation (LKG ≠ 1st std) | Built-in |

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Install Node.js
Go to https://nodejs.org → Download and install the LTS version.

### Step 2 — Create Firebase Project (FREE)

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → Name it (e.g. "school-homework")
3. Disable Google Analytics (not needed) → Click **Create project**

### Step 3 — Enable Firebase Services

In your Firebase project, enable these 3 things:

**A. Authentication**
- Left sidebar → **Authentication** → Get started
- Click **Email/Password** → Enable it → Save

**B. Firestore Database**
- Left sidebar → **Firestore Database** → Create database
- Select **"Start in test mode"** → Next → Choose any location → Done

**C. Storage**
- Left sidebar → **Storage** → Get started
- Select **"Start in test mode"** → Done

### Step 4 — Get Your Firebase Config

1. In Firebase console → Click the ⚙️ gear icon → **Project settings**
2. Scroll down to **"Your apps"** → Click the **</>** (Web) icon
3. Enter an app name (e.g. "schooldesk") → Register app
4. You'll see a config object like this — COPY IT:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "school-homework-xxx.firebaseapp.com",
  projectId: "school-homework-xxx",
  storageBucket: "school-homework-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 5 — Paste Config into the App

Open this file:
```
src/firebase/config.js
```

Replace the placeholder values with your actual Firebase config values.

### Step 6 — Install and Run

Open a terminal/command prompt in the project folder:

```bash
npm install
npm start
```

The app will open at http://localhost:3000

### Step 7 — Create Your First Admin Account

1. In Firebase console → **Authentication** → **Add user**
2. Enter your email and a password → Add user
3. Then in Firebase console → **Firestore Database** → **Start collection**
   - Collection ID: `users`
   - Document ID: (paste the UID from the user you just created in Authentication)
   - Add these fields:
     - `name` (string): "Admin"
     - `email` (string): your email
     - `role` (string): "admin"
     - `classId` (string): "ALL"
     - `uid` (string): same UID as the document ID

4. Now log in at http://localhost:3000/login with that email and password
5. You're the admin! Go to **Manage Users** to create teacher and student accounts.

---

## 📋 How to Add Users (After Setup)

As admin, go to **Manage Users → Add User**:

| Who to add | Role | Class |
|---|---|---|
| Priya (LKG teacher) | teacher | LKG |
| Ravi (1st std teacher) | teacher | 1st |
| Aarav (LKG student) | student | LKG |
| Sneha (1st std student) | student | 1st |

Each user gets an email + password. Share it with them so they can log in.

---

## 🎓 How It Works

```
Admin logs in
  └─ Creates teacher account for LKG → assigns to class LKG
  └─ Creates student accounts → assigns each to their class

LKG Teacher logs in
  └─ Posts homework → tagged as "LKG"
  └─ Only LKG students will see it

LKG Student logs in
  └─ Sees homework list → ONLY LKG homework shown
  └─ Clicks "Submit" → uploads photo or checks "bringing physically"

Teacher goes to Submissions → sees who submitted what
```

---

## 🌐 Deploy Online (So students can use it from home)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   (select your project, build folder = "build")
npm run build
firebase deploy
```

Your app will be live at: https://your-project-id.web.app

---

## 📁 Project Structure

```
src/
├── firebase/
│   └── config.js          ← YOUR FIREBASE CONFIG GOES HERE
├── context/
│   └── AuthContext.js     ← Handles login/logout state
├── components/
│   ├── Sidebar.js         ← Navigation sidebar
│   └── ProtectedRoute.js  ← Prevents unauthorized access
├── pages/
│   ├── Login.js           ← Login screen
│   ├── Dashboard.js       ← Home screen (adapts per role)
│   ├── PostHomework.js    ← Teacher: post homework
│   ├── MyHomework.js      ← Student: view & submit
│   ├── Submissions.js     ← Teacher: view submissions
│   ├── ManageUsers.js     ← Admin: add/remove users
│   └── AllHomework.js     ← Admin: see all homework
├── styles/
│   └── global.css         ← All styles
├── App.js                 ← Routing
└── index.js               ← Entry point
```

---

## 💰 Cost

**Completely FREE** for 300 students on Firebase's Spark plan:
- Firestore: 1GB storage, 50K reads/day, 20K writes/day
- Storage: 5GB for file uploads
- Authentication: Unlimited users
- Hosting: 10GB/month bandwidth

You will NOT need to pay anything for a school of 300 students.

---

## 🆘 Common Problems

**"npm install" fails** → Make sure Node.js is installed. Run `node --version` to check.

**Login says "wrong password"** → Double-check email and password. Passwords are case-sensitive.

**"Firebase not configured"** → Make sure you pasted the config into `src/firebase/config.js`.

**Students can see other class homework** → Check that the student's `classId` in Firestore matches exactly (e.g. "LKG" not "lkg").

---

Built with React + Firebase. Made for small schools. ❤️
