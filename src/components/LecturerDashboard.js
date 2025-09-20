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
  const [activeTab, setActiveTab] = useState('results');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  // Analytics filters
  const [analyticsCourse, setAnalyticsCourse] = useState('');
  const [analyticsExam, setAnalyticsExam] = useState('');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

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

      if (studentsResult.error) throw studentsResult.error;
      if (examsResult.error) throw examsResult.error;
      if (resultsResult.error) throw resultsResult.error;

      setStudents(studentsResult.data || []);
      setExams(examsResult.data || []);
      setResults(resultsResult.data || []);
    } catch (error) {
      setError(error.message);
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
      setError('Please fill in all fields');
      return;
    }
    if (editForm.score < 0 || editForm.score > 100) {
      setError('Score must be between 0 and 100');
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
      setError('Please fill in all fields');
      return;
    }
    
    if (newResult.score < 0 || newResult.score > 100) {
      setError('Score must be between 0 and 100');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('results')
        .insert([{
          student_id: newResult.student_id,
          exam_id: newResult.exam_id,
          score: parseInt(newResult.score)
        }]);

      if (error) throw error;

      setNewResult({ student_id: '', exam_id: '', score: '' });
      setError('');
      fetchData(); // Refresh data
      alert('Result added successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('exams')
        .insert([{ 
          course: newExam.course,
          exam_name: newExam.exam_name,
          date: newExam.date,
          credits: parseInt(newExam.credits || 3)
        }]);

      if (error) throw error;

      setNewExam({ course: '', exam_name: '', date: '', credits: 3 });
      fetchData(); // Refresh data
      alert('Exam added successfully!');
    } catch (error) {
      setError(error.message);
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
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

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
            <i className="fas fa-chart-line me-2"></i>Analytics
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
                                type="number"
                                className="form-control form-control-sm"
                                min="0"
                                max="100"
                                value={editForm.score}
                                onChange={(e) => setEditForm({ ...editForm, score: e.target.value })}
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
                              'bg-danger'
                            }`}>
                              {(isEditing ? editForm.score : result.score) >= 90 ? 'A' :
                               (isEditing ? editForm.score : result.score) >= 80 ? 'B' :
                               (isEditing ? editForm.score : result.score) >= 70 ? 'C' :
                               (isEditing ? editForm.score : result.score) >= 60 ? 'D' : 'F'}
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
                      type="number"
                      className="form-control"
                      id="score"
                      min="0"
                      max="100"
                      value={newResult.score}
                      onChange={(e) => setNewResult({...newResult, score: e.target.value})}
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
    </div>
  );
};

export default LecturerDashboard;
