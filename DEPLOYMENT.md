# 🚀 Deployment Guide

## Quick Setup for New Users

### 1. Clone and Install
```bash
git clone https://github.com/YOUR_USERNAME/online-exam-repository.git
cd online-exam-repository
npm install
```

### 2. Supabase Configuration
Update `src/lib/supabase.js` with your own Supabase credentials:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'
```

### 3. Database Setup
1. Create a new Supabase project
2. Go to SQL Editor
3. Run the `minimal-setup.sql` script
4. This creates all tables and sample data

### 4. Run the App
```bash
npm start
```
App opens at `http://localhost:3000`

## Test Accounts
- **Students:** `john.doe@student.com` / `password123`, `teststudent@gmail.com` / `password123`
- **Lecturer:** Sign up with any email and select "Lecturer" role

## Features
- ✅ Student dashboard with exam results
- ✅ Lecturer dashboard with management tools
- ✅ PDF export functionality
- ✅ CSV bulk upload
- ✅ Real-time analytics
- ✅ Role-based access control

## Tech Stack
- React 18, Bootstrap 5, React Router
- Supabase (PostgreSQL + Auth)
- Chart.js, jsPDF, Font Awesome
