# Online Exam Repository

A modern React-based web application for managing student exam results with role-based access control.

## ✅ Current Status: **FULLY WORKING**

- ✅ React app running on localhost:3000
- ✅ Supabase database connected and configured
- ✅ Authentication system working
- ✅ Student and Lecturer dashboards functional
- ✅ All CRUD operations enabled

## 🚀 Quick Start

### 1. Install & Run
```bash
npm install
npm start
```
App opens at `http://localhost:3000`

### 2. Database Setup
Run `minimal-setup.sql` in your Supabase SQL Editor to create tables and sample data.

### 3. Test Accounts
**Students:**
- `john.doe@student.com` / `password123`
- `teststudent@gmail.com` / `password123`

**Lecturer:**
- Sign up with any email and select "Lecturer" role

## 🎯 Features

### 👨‍🎓 Student Dashboard
- View exam results with grades (A/B/C/D/F)
- Performance statistics (average, highest, lowest scores)
- Search and filter exam results
- PDF export (individual results + full transcript)
- Pass/Fail status indicators

### 👨‍🏫 Lecturer Dashboard
- Manage all student exam results
- Add new exams and courses
- Bulk CSV upload for results
- Real-time analytics with charts
- Student management system
- Inline editing of scores

## 🛠 Tech Stack
- **Frontend:** React 18, Bootstrap 5, React Router
- **Backend:** Supabase (PostgreSQL + Auth)
- **PDF:** jsPDF
- **Charts:** Chart.js
- **Icons:** Font Awesome

## 📊 Database Tables
- `users` - Authentication and roles
- `students` - Student information  
- `exams` - Exam details
- `results` - Student exam results

## 🔧 Configuration
Supabase credentials are configured in `src/lib/supabase.js`

## 📝 CSV Upload Format
```csv
student_email,exam_name,score
john.doe@student.com,Midterm Exam,85
teststudent@gmail.com,Final Exam,92
```

## 🎉 Ready to Use!
The application is fully functional and ready for production use.