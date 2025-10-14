import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
// Charts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend
);

const LecturerDashboard = ({ user }) => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorTimeout, setErrorTimeout] = useState(null);
  const [activeTab, setActiveTab] = useState('results');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Error handling utility
  const showError = (message) => {
    setError(message);
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    // Set new timeout to clear error after 8 seconds
    const timeout = setTimeout(() => setError(''), 8000);
    setErrorTimeout(timeout);
  };
  const [filterStudent, setFilterStudent] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  // Analytics filters
  const [analyticsCourse, setAnalyticsCourse] = useState('');
  const [analyticsExam, setAnalyticsExam] = useState('');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

    // Remove student handler
    const handleRemoveStudent = async (student_id) => {
      const confirmDelete = window.confirm('Are you sure you want to remove this student? This will also delete all their results.');
      if (!confirmDelete) return;
      try {
        // Delete all results for this student first
        const { error: resultsError } = await supabase
          .from('results')
          .delete()
          .eq('student_id', student_id);
        if (resultsError) throw resultsError;

        // Now delete the student
        const { error: studentError } = await supabase
          .from('students')
          .delete()
          .eq('student_id', student_id);
        if (studentError) throw studentError;

        await fetchData();
        alert('Student and all their results removed successfully!');
      } catch (error) {
        setError(error.message);
      }
    };

  // Form states
  const [newResult, setNewResult] = useState({
    student_id: '',
    exam_id: '',
    score: ''
  });
  const [newExam, setNewExam] = useState({
    course: '',
    exam_name: '',
    date: '',
    credits: 3
  });

  // Inline edit state for managing results
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    student_id: '',
    exam_id: '',
    score: ''
  });

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscription for new students
    const studentsSubscription = supabase
      .channel('students_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'students' },
        (payload) => {
          console.log('New student registered:', payload.new);
          // Add new student to the list with a "new" flag
          const newStudent = { ...payload.new, isNew: true };
          setStudents(prevStudents => [...prevStudents, newStudent]);
          
          // Show notification
          alert(`🎉 New student registered: ${newStudent.name} (${newStudent.email})`);
          
          // Remove "new" flag after 10 seconds
          setTimeout(() => {
            setStudents(prev => prev.map(s => 
              s.student_id === newStudent.student_id 
                ? { ...s, isNew: false }
                : s
            ));
          }, 10000);
        }
      )
      .subscribe();

    return () => {
      studentsSubscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [studentsResult, examsResult, resultsResult] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('exams').select('*').order('date', { ascending: false }),
        supabase.from('results').select(`
          *,
          students (name, email),
          exams (exam_name, course, date)
        `).order('created_at', { ascending: false })
      ]);

      if (studentsResult.error) {
        showError('Failed to fetch students: ' + studentsResult.error.message);
        return;
      }
      if (examsResult.error) {
        showError('Failed to fetch exams: ' + examsResult.error.message);
        return;
      }
      if (resultsResult.error) {
        showError('Failed to fetch results: ' + resultsResult.error.message);
        return;
      }

      setStudents(studentsResult.data || []);
      setExams(examsResult.data || []);
      setResults(resultsResult.data || []);
    } catch (error) {
      showError('An unexpected error occurred: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helpers for inline editing
  const getExamById = (id) => exams.find(x => String(x.exam_id) === String(id));
  const getStudentById = (id) => students.find(x => String(x.student_id) === String(id));

  const handleEditStart = (result) => {
    setEditingId(result.result_id);
    setEditForm({
      student_id: result.student_id,
      exam_id: result.exam_id,
      score: result.score
    });
    setError('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ student_id: '', exam_id: '', score: '' });
  };

  const handleEditSave = async () => {
    // Validation
    if (!editForm.student_id || !editForm.exam_id || editForm.score === '' || editForm.score === null) {
      showError('Please fill in all fields');
      return;
    }

    // Check if score contains any non-numeric characters
    if (!/^\d+$/.test(editForm.score)) {
      showError('❌ Only numbers are allowed for marks. Please remove any letters or special characters.');
      return;
    }

    const scoreNum = parseInt(editForm.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showError('Score must be a number between 0 and 100');
      return;
    }
    try {
      const { error } = await supabase
        .from('results')
        .update({
          student_id: editForm.student_id,
          exam_id: editForm.exam_id,
          score: parseInt(editForm.score)
        })
        .eq('result_id', editingId);

      if (error) throw error;

      await fetchData();
      handleEditCancel();
      alert('Result updated successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDeleteResult = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this result?');
    if (!confirmDelete) return;
    try {
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('result_id', id);
      if (error) throw error;
      await fetchData();
      alert('Result deleted successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  // Function to handle exam deletion
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam? This will also delete all associated results.')) {
      return;
    }

    try {
      // First delete all results for this exam
      const { error: resultsError } = await supabase
        .from('results')
        .delete()
        .eq('exam_id', examId);

      if (resultsError) {
        showError('Failed to delete exam results: ' + resultsError.message);
        return;
      }

      // Then delete the exam
      const { error: examError } = await supabase
        .from('exams')
        .delete()
        .eq('exam_id', examId);

      if (examError) {
        showError('Failed to delete exam: ' + examError.message);
        return;
      }

      await fetchData(); // Refresh the data
      showError('✅ Exam and associated results deleted successfully!');
    } catch (error) {
      showError('An unexpected error occurred while deleting: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      // Check if there's an active session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // No active session, just clear local state and redirect
        console.log('No active session found, clearing local state');
        window.location.href = '/login';
        return;
      }

      // Attempt to sign out
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        // Even if signOut fails, clear local state and redirect
        console.log('SignOut failed, but clearing local state anyway');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear local state and redirect
      console.log('Logout error occurred, but clearing local state anyway');
      window.location.href = '/login';
    }
  };

  const handleAddResult = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!newResult.student_id || !newResult.exam_id || !newResult.score) {
      showError('Please fill in all fields');
      return;
    }

    // Check if score contains any non-numeric characters
    if (!/^\d+$/.test(newResult.score)) {
      showError('❌ Only numbers are allowed for marks. Please remove any letters or special characters.');
      return;
    }
    
    const scoreNum = parseInt(newResult.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showError('Score must be a number between 0 and 100');
      return;
    }
    
    try {
      // First check if this student already has a result for this exam
      const { data: existingResult } = await supabase
        .from('results')
        .select('result_id')
        .eq('student_id', newResult.student_id)
        .eq('exam_id', newResult.exam_id)
        .single();

      if (existingResult) {
        // Get student and exam details for the error message
        const student = students.find(s => s.student_id === newResult.student_id);
        const exam = exams.find(e => e.exam_id === newResult.exam_id);
        showError(`${student?.name || 'This student'} already has a result for ${exam?.exam_name || 'this exam'}. Please edit the existing result instead.`);
        return;
      }

      const { error } = await supabase
        .from('results')
        .insert([{
          student_id: newResult.student_id,
          exam_id: newResult.exam_id,
          score: parseInt(newResult.score)
        }]);

      if (error) {
        if (error.code === '23505') {
          showError('This student already has a result for this exam. Please edit the existing result instead.');
        } else {
          showError('Failed to add result: ' + error.message);
        }
        return;
      }

      setNewResult({ student_id: '', exam_id: '', score: '' });
      await fetchData(); // Refresh data
      showError('✅ Result added successfully!');
    } catch (error) {
      showError('An unexpected error occurred: ' + error.message);
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    try {
      // Validate input
      if (!newExam.course.trim()) {
        showError('Course name is required');
        return;
      }
      if (!newExam.exam_name.trim()) {
        showError('Exam name is required');
        return;
      }
      if (!newExam.date) {
        showError('Exam date is required');
        return;
      }

      const { error } = await supabase
        .from('exams')
        .insert([{ 
          course: newExam.course.trim(),
          exam_name: newExam.exam_name.trim(),
          date: newExam.date,
          credits: parseInt(newExam.credits || 3)
        }]);

      if (error) {
        if (error.code === '23505') {
          showError('An exam with this name already exists');
        } else {
          showError('Failed to add exam: ' + error.message);
        }
        return;
      }

      setNewExam({ course: '', exam_name: '', date: '', credits: 3 });
      await fetchData(); // Refresh data
      showError('✅ Exam added successfully!');
    } catch (error) {
      showError('An unexpected error occurred: ' + error.message);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        
        // Expected format: student_email, exam_name, score
        const resultsToInsert = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= 3) {
            const studentEmail = values[0];
            const examName = values[1];
            const score = parseInt(values[2]);
            
            // Find student_id and exam_id
            const student = students.find(s => s.email === studentEmail);
            const exam = exams.find(e => e.exam_name === examName);
            
            if (student && exam) {
              resultsToInsert.push({
                student_id: student.student_id,
                exam_id: exam.exam_id,
                score: score
              });
            }
          }
        }

        if (resultsToInsert.length > 0) {
          const { error } = await supabase
            .from('results')
            .insert(resultsToInsert);

          if (error) throw error;
          
          fetchData(); // Refresh data
          alert(`Successfully uploaded ${resultsToInsert.length} results!`);
        } else {
          alert('No valid results found in CSV file.');
        }
      } catch (error) {
        setError(error.message);
      }
    };
    
    reader.readAsText(file);
  };

  // Filter results for lecturer view
  const filteredResults = results.filter(result => {
    const matchesSearch = result.students?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.exams?.exam_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.exams?.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStudent = filterStudent === '' || result.students?.name === filterStudent;
    const matchesCourse = filterCourse === '' || result.exams?.course === filterCourse;
    return matchesSearch && matchesStudent && matchesCourse;
  });

  // Get unique students and courses for filters
  const uniqueStudents = [...new Set(results.map(r => r.students?.name).filter(Boolean))];
  const uniqueCourses = [...new Set(results.map(r => r.exams?.course).filter(Boolean))];

  // Calculate statistics
  const calculateStats = () => {
    if (results.length === 0) return { totalStudents: 0, totalExams: 0, averageScore: 0, totalResults: 0 };
    
    const totalStudents = uniqueStudents.length;
    const totalExams = exams.length;
    const scores = results.map(r => r.score);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    return { totalStudents, totalExams, averageScore, totalResults: results.length };
  };

  const stats = calculateStats();

  // ===== Analytics: apply filters =====
  const analyticsFilteredResults = results.filter(r => {
    const courseOk = !analyticsCourse || r.exams?.course === analyticsCourse;
    const examOk = !analyticsExam || r.exams?.exam_name === analyticsExam;
    const d = r.exams?.date ? new Date(r.exams.date) : null;
    let startOk = true;
    let endOk = true;
    if (analyticsStartDate && d) {
      startOk = d >= new Date(analyticsStartDate);
    }
    if (analyticsEndDate && d) {
      // Include end date inclusive
      const end = new Date(analyticsEndDate);
      end.setHours(23,59,59,999);
      endOk = d <= end;
    }
    return courseOk && examOk && startOk && endOk;
  });

  // ===== Analytics: datasets =====
  const averageByCourse = (() => {
    const map = new Map(); // course -> { sum, count }
    analyticsFilteredResults.forEach(r => {
      const course = r.exams?.course;
      if (!course) return;
      if (!map.has(course)) map.set(course, { sum: 0, count: 0 });
      const agg = map.get(course);
      agg.sum += r.score || 0;
      agg.count += 1;
    });
    const labels = Array.from(map.keys());
    const data = labels.map(c => Math.round(map.get(c).sum / map.get(c).count));
    return { labels, data };
  })();

  const scoreDistribution = (() => {
    // Buckets: 0-49, 50-59, 60-69, 70-79, 80-89, 90-100
    const buckets = [0, 0, 0, 0, 0, 0];
    analyticsFilteredResults.forEach(r => {
      const s = r.score || 0;
      if (s < 50) buckets[0]++;
      else if (s < 60) buckets[1]++;
      else if (s < 70) buckets[2]++;
      else if (s < 80) buckets[3]++;
      else if (s < 90) buckets[4]++;
      else buckets[5]++;
    });
    const labels = ['0-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
    return { labels, data: buckets };
  })();

  const averageTrendOverTime = (() => {
    // group by exam date (YYYY-MM-DD)
    const map = new Map();
    analyticsFilteredResults.forEach(r => {
      const d = r.exams?.date ? new Date(r.exams.date) : null;
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { sum: 0, count: 0 });
      const agg = map.get(key);
      agg.sum += r.score || 0;
      agg.count += 1;
    });
    const labels = Array.from(map.keys()).sort();
    const data = labels.map(k => Math.round(map.get(k).sum / map.get(k).count));
    return { labels, data };
  })();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Lecturer Dashboard</h1>
        <div>
          <span className="me-3">Welcome, {user.email}</span>
          <button className="btn btn-outline-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div 
          className={`alert ${error.startsWith('✅') ? 'alert-success' : 'alert-danger'} alert-dismissible fade show`}
          role="alert"
          style={{
            animation: 'slideIn 0.5s ease-out, fadeOut 0.5s ease-out 7.5s',
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '400px',
            minWidth: '300px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            border: 'none',
            background: error.startsWith('✅') 
              ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
              : 'linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)',
            color: 'white',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {error.startsWith('✅') ? (
              <i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i>
            ) : (
              <i className="fas fa-exclamation-circle" style={{ fontSize: '1.2rem' }}></i>
            )}
            <div style={{ flex: 1 }}>
              {error.startsWith('✅') ? error.substring(2) : error}
            </div>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={() => setError('')}
              style={{ opacity: 0.8, fontSize: '0.8rem' }}
            ></button>
          </div>
          
          {/* Progress bar */}
          <div style={{ 
            width: '100%', 
            height: '3px', 
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '4px'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              animation: 'progress 8s linear'
            }} />
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
          @keyframes progress {
            from {
              width: 100%;
            }
            to {
              width: 0%;
            }
          }
        `}
      </style>

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white">
            <div className="card-body text-center">
              <h5 className="card-title">Total Students</h5>
              <h2>{stats.totalStudents}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white">
            <div className="card-body text-center">
              <h5 className="card-title">Total Exams</h5>
              <h2>{stats.totalExams}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning text-white">
            <div className="card-body text-center">
              <h5 className="card-title">Average Score</h5>
              <h2>{stats.averageScore}%</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-info text-white">
            <div className="card-body text-center">
              <h5 className="card-title">Total Results</h5>
              <h2>{stats.totalResults}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            <i className="fas fa-list me-2"></i>Results
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'add-result' ? 'active' : ''}`}
            onClick={() => setActiveTab('add-result')}
          >
            <i className="fas fa-plus me-2"></i>Add Result
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'add-exam' ? 'active' : ''}`}
            onClick={() => setActiveTab('add-exam')}
          >
            <i className="fas fa-book me-2"></i>Add Exam
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'csv-upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv-upload')}
          >
            <i className="fas fa-upload me-2"></i>CSV Upload
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="fas fa-chart-bar me-2"></i>Analytics
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <i className="fas fa-users me-2"></i>Students
          </button>
        </li>
      </ul>

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h3>All Results</h3>
            {results.length > 0 && (
              <div className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search students, exams, courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '250px' }}
                />
                <select
                  className="form-select form-select-sm"
                  value={filterStudent}
                  onChange={(e) => setFilterStudent(e.target.value)}
                  style={{ width: '150px' }}
                >
                  <option value="">All Students</option>
                  {uniqueStudents.map(student => (
                    <option key={student} value={student}>{student}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  style={{ width: '150px' }}
                >
                  <option value="">All Courses</option>
                  {uniqueCourses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="card-body">
            {results.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-chart-line fa-3x text-muted mb-3"></i>
                <p className="text-muted">No results found. Add some results to get started!</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-muted">No results match your search criteria.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Exam</th>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((result) => {
                      const isEditing = editingId === result.result_id;
                      const selectedExam = isEditing ? getExamById(editForm.exam_id) : result.exams;
                      const selectedStudent = isEditing ? getStudentById(editForm.student_id) : result.students;
                      return (
                        <tr key={result.result_id}>
                          <td style={{ minWidth: '220px' }}>
                            {isEditing ? (
                              <select
                                className="form-select form-select-sm"
                                value={editForm.student_id}
                                onChange={(e) => setEditForm({ ...editForm, student_id: e.target.value })}
                              >
                                {students.map(s => (
                                  <option key={s.student_id} value={s.student_id}>
                                    {s.name} ({s.email})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <strong>{selectedStudent?.name}</strong>
                                <br />
                                <small className="text-muted">{selectedStudent?.email}</small>
                              </>
                            )}
                          </td>
                          <td style={{ minWidth: '140px' }}>
                            {isEditing ? (
                              <span>{selectedExam?.course || '-'}</span>
                            ) : (
                              result.exams?.course
                            )}
                          </td>
                          <td style={{ minWidth: '220px' }}>
                            {isEditing ? (
                              <select
                                className="form-select form-select-sm"
                                value={editForm.exam_id}
                                onChange={(e) => setEditForm({ ...editForm, exam_id: e.target.value })}
                              >
                                {exams.map(ex => (
                                  <option key={ex.exam_id} value={ex.exam_id}>
                                    {ex.exam_name} ({ex.course})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              result.exams?.exam_name
                            )}
                          </td>
                          <td>
                            {new Date((isEditing ? selectedExam?.date : result.exams?.date)).toLocaleDateString()}
                          </td>
                          <td style={{ minWidth: '110px' }}>
                            {isEditing ? (
                              <input
                                type="text"
                                pattern="[0-9]*"
                                inputMode="numeric"
                                className="form-control form-control-sm"
                                value={editForm.score}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || /^\d+$/.test(value)) {
                                    setEditForm({ ...editForm, score: value });
                                  }
                                }}
                                placeholder="Enter marks (0-100)"
                              />
                            ) : (
                              <span className="fw-bold">{result.score}%</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${
                              (isEditing ? editForm.score : result.score) >= 90 ? 'bg-success' :
                              (isEditing ? editForm.score : result.score) >= 80 ? 'bg-primary' :
                              (isEditing ? editForm.score : result.score) >= 70 ? 'bg-warning' :
                              (isEditing ? editForm.score : result.score) >= 60 ? 'bg-info' :
                              (isEditing ? editForm.score : result.score) >= 50 ? 'bg-secondary' :
                              'bg-danger'
                            }`}>
                              {(isEditing ? editForm.score : result.score) >= 90 ? 'A' :
                               (isEditing ? editForm.score : result.score) >= 80 ? 'B' :
                               (isEditing ? editForm.score : result.score) >= 70 ? 'C' :
                               (isEditing ? editForm.score : result.score) >= 60 ? 'D' :
                               (isEditing ? editForm.score : result.score) >= 50 ? 'D' : 'F'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              (isEditing ? editForm.score : result.score) >= 70 ? 'bg-success' : 'bg-warning'
                            }`}>
                              {(isEditing ? editForm.score : result.score) >= 70 ? 'Pass' : 'Needs Improvement'}
                            </span>
                          </td>
                          <td className="text-end" style={{ minWidth: '180px' }}>
                            {isEditing ? (
                              <div className="btn-group btn-group-sm" role="group">
                                <button className="btn btn-success" onClick={handleEditSave}>
                                  Save
                                </button>
                                <button className="btn btn-secondary" onClick={handleEditCancel}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="btn-group btn-group-sm" role="group">
                                <button className="btn btn-outline-primary" onClick={() => handleEditStart(result)}>
                                  Edit
                                </button>
                                <button className="btn btn-outline-danger" onClick={() => handleDeleteResult(result.result_id)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Result Tab */}
      {activeTab === 'add-result' && (
        <div className="card">
          <div className="card-header">
            <h3>Add New Result</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleAddResult}>
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="student" className="form-label">Student</label>
                    <select
                      className="form-select"
                      id="student"
                      value={newResult.student_id}
                      onChange={(e) => setNewResult({...newResult, student_id: e.target.value})}
                      required
                    >
                      <option value="">Select Student</option>
                      {students.map(student => (
                        <option key={student.student_id} value={student.student_id}>
                          {student.name} ({student.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="exam" className="form-label">Exam</label>
                    <select
                      className="form-select"
                      id="exam"
                      value={newResult.exam_id}
                      onChange={(e) => setNewResult({...newResult, exam_id: e.target.value})}
                      required
                    >
                      <option value="">Select Exam</option>
                      {exams.map(exam => (
                        <option key={exam.exam_id} value={exam.exam_id}>
                          {exam.exam_name} ({exam.course})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="score" className="form-label">Score</label>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="form-control"
                      id="score"
                      value={newResult.score}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d+$/.test(value)) {
                          setNewResult({...newResult, score: value});
                        }
                      }}
                      placeholder="Enter marks (0-100)"
                      required
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Add Result</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Exam Tab */}
      {activeTab === 'add-exam' && (
        <div className="card">
          <div className="card-header">
            <h3>Add New Exam</h3>
          </div>
          <div className="card-body">
            {/* Existing Exams Table */}
            <div className="mb-4">
              <h4>Existing Exams</h4>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Exam Name</th>
                      <th>Date</th>
                      <th>Credits</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.exam_id}>
                        <td>{exam.course}</td>
                        <td>{exam.exam_name}</td>
                        <td>{new Date(exam.date).toLocaleDateString()}</td>
                        <td>{exam.credits}</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteExam(exam.exam_id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <form onSubmit={handleAddExam}>
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="course" className="form-label">Course</label>
                    <input
                      type="text"
                      className="form-control"
                      id="course"
                      value={newExam.course}
                      onChange={(e) => setNewExam({...newExam, course: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="exam_name" className="form-label">Exam Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="exam_name"
                      value={newExam.exam_name}
                      onChange={(e) => setNewExam({...newExam, exam_name: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="date" className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-control"
                      id="date"
                      value={newExam.date}
                      onChange={(e) => setNewExam({...newExam, date: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label htmlFor="credits" className="form-label">Credits</label>
                    <input
                      type="number"
                      className="form-control"
                      id="credits"
                      min="1"
                      max="30"
                      value={newExam.credits}
                      onChange={(e) => setNewExam({ ...newExam, credits: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Add Exam</button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Tab */}
      {activeTab === 'csv-upload' && (
        <div className="card">
          <div className="card-header">
            <h3>Upload Results via CSV</h3>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label htmlFor="csvFile" className="form-label">CSV File</label>
              <input
                type="file"
                className="form-control"
                id="csvFile"
                accept=".csv"
                onChange={handleCSVUpload}
              />
            </div>
            <div className="alert alert-info">
              <h5>CSV Format:</h5>
              <p>Expected format: <code>student_email, exam_name, score</code></p>
              <p>Example:</p>
              <pre>
                john.doe@student.com, Midterm Exam, 85{'\n'}
                jane.smith@student.com, Midterm Exam, 92
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="card">
          <div className="card-header">
            <div className="d-flex flex-wrap gap-2 align-items-end justify-content-between">
              <h3 className="mb-0">Analytics</h3>
              <div className="d-flex flex-wrap gap-2">
                <select
                  className="form-select form-select-sm"
                  value={analyticsCourse}
                  onChange={(e) => {
                    setAnalyticsCourse(e.target.value);
                    setAnalyticsExam('');
                  }}
                  style={{ minWidth: '160px' }}
                >
                  <option value="">All Courses</option>
                  {[...new Set(exams.map(x => x.course).filter(Boolean))].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={analyticsExam}
                  onChange={(e) => setAnalyticsExam(e.target.value)}
                  style={{ minWidth: '180px' }}
                >
                  <option value="">All Exams</option>
                  {exams
                    .filter(x => !analyticsCourse || x.course === analyticsCourse)
                    .map(ex => (
                      <option key={ex.exam_id} value={ex.exam_name}>{ex.exam_name}</option>
                    ))}
                </select>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={analyticsStartDate}
                  onChange={(e) => setAnalyticsStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={analyticsEndDate}
                  onChange={(e) => setAnalyticsEndDate(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => { setAnalyticsCourse(''); setAnalyticsExam(''); setAnalyticsStartDate(''); setAnalyticsEndDate(''); }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            {analyticsFilteredResults.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-chart-line fa-3x text-muted mb-3"></i>
                <p className="text-muted">No data available for the selected filters.</p>
              </div>
            ) : (
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-body">
                      <h5 className="card-title">Average Score by Course</h5>
                      <Bar
                        data={{
                          labels: averageByCourse.labels,
                          datasets: [
                            {
                              label: 'Average Score',
                              data: averageByCourse.data,
                              backgroundColor: 'rgba(13, 110, 253, 0.5)',
                              borderColor: 'rgba(13, 110, 253, 1)',
                              borderWidth: 1,
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { beginAtZero: true, max: 100, ticks: { stepSize: 10 } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-body">
                      <h5 className="card-title">Score Distribution</h5>
                      <Doughnut
                        data={{
                          labels: scoreDistribution.labels,
                          datasets: [
                            {
                              label: 'Count',
                              data: scoreDistribution.data,
                              backgroundColor: [
                                '#dc3545', // 0-49
                                '#fd7e14', // 50-59
                                '#ffc107', // 60-69
                                '#20c997', // 70-79
                                '#0d6efd', // 80-89
                                '#198754'  // 90-100
                              ]
                            }
                          ]
                        }}
                        options={{ responsive: true }}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="card">
                    <div className="card-body">
                      <h5 className="card-title">Average Score Over Time</h5>
                      <Line
                        data={{
                          labels: averageTrendOverTime.labels,
                          datasets: [
                            {
                              label: 'Average Score',
                              data: averageTrendOverTime.data,
                              borderColor: 'rgba(25, 135, 84, 1)',
                              backgroundColor: 'rgba(25, 135, 84, 0.2)',
                              tension: 0.3,
                              fill: true
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          scales: {
                            y: { beginAtZero: true, max: 100, ticks: { stepSize: 10 } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-users me-2"></i>Registered Students</h3>
            <p className="text-muted mb-0">All students who have created accounts will appear here</p>
          </div>
          <div className="card-body">
            {students.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-user-plus fa-3x text-muted mb-3"></i>
                <p className="text-muted">No students registered yet.</p>
                <p className="text-muted">Students will appear here automatically when they create accounts.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registration Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr 
                        key={student.student_id} 
                        className={student.isNew ? 'table-success' : ''}
                        style={student.isNew ? { 
                          animation: 'pulse 2s infinite',
                          boxShadow: '0 0 10px rgba(25, 135, 84, 0.5)'
                        } : {}}
                      >
                        <td>
                          <strong>{student.name}</strong>
                          {student.isNew && (
                            <span className="badge bg-success ms-2">
                              <i className="fas fa-star me-1"></i>NEW
                            </span>
                          )}
                        </td>
                        <td>{student.email}</td>
                        <td>
                          {new Date(student.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td>
                          <span className="badge bg-primary">Active</span>
                        </td>
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRemoveStudent(student.student_id)}>
                              Remove
                            </button>
                          </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerDashboard;
