import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StudentDashboard = ({ user }) => {
  const [results, setResults] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  // Default credits for each exam (schema has no credits field). Update if you add credits to DB.
  const DEFAULT_CREDITS = 3;

  useEffect(() => {
    fetchResults();
  }, [user.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError('');
      
      // First get the student_id for the current user
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('student_id, name')
        .eq('email', user.email)
        .single();

      if (studentError) {
        if (studentError.code === 'PGRST116') {
          // No student found with this email
          setError(`No student record found for ${user.email}. Please contact your lecturer to add you to the system.`);
          setResults([]);
          return;
        }
        throw studentError;
      }

      if (studentData) {
        setStudentName(studentData.name || '');
        // Fetch results for this student
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select(`
            *,
            exams (
              exam_name,
              course,
              date,
              credits
            )
          `)
          .eq('student_id', studentData.student_id)
          .order('created_at', { ascending: false });

        if (resultsError) throw resultsError;
        setResults(resultsData || []);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setError(`Error loading results: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===== PDF helpers =====
  // Update gradeFor function thresholds
  const gradeFor = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  // Update statusFor function thresholds
  const statusFor = (score) => {
    if (score >= 75) return 'Distinction';
    if (score >= 50) return 'Pass';
    return 'Fail';
  };

  const exportAllToPdf = () => {
    try {
      const doc = new jsPDF();
      const title = 'Exam Results';
      doc.setFontSize(16);
      doc.text(title, 14, 18);
      doc.setFontSize(11);
      doc.text(`Student: ${user.email}`, 14, 26);

    const rows = filteredResults.map(r => [
      r.exams?.course || '-',
      r.exams?.exam_name || '-',
      r.exams?.date ? new Date(r.exams.date).toLocaleDateString() : '-',
      `${r.score}%`,
      gradeFor(r.score),
      statusFor(r.score),
      r.score >= 75 ? 'Yes' : 'No'
    ]);

      autoTable(doc, {
        startY: 32,
        head: [['Course', 'Exam', 'Date', 'Score', 'Grade', 'Status', 'Distinction']],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [13, 110, 253] }
      });

      const fileName = `exam-results-${user.email.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF export (all) failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const exportSingleToPdf = (result) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Exam Result', 14, 18);
      doc.setFontSize(11);
      doc.text(`Student: ${user.email}`, 14, 26);

    const body = [[
      result.exams?.course || '-',
      result.exams?.exam_name || '-',
      result.exams?.date ? new Date(result.exams.date).toLocaleDateString() : '-',
      `${result.score}%`,
      gradeFor(result.score),
      statusFor(result.score),
      result.score >= 75 ? 'Yes' : 'No'
    ]];

      autoTable(doc, {
        startY: 32,
        head: [['Course', 'Exam', 'Date', 'Score', 'Grade', 'Status', 'Distinction']],
        body,
        styles: { fontSize: 11 },
        headStyles: { fillColor: [25, 135, 84] }
      });

      const fileName = `exam-${(result.exams?.exam_name || 'result').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF export (single) failed:', err);
      alert('Failed to generate PDF for this exam. Please try again.');
    }
  };

  // Utility: load an image from public and convert to data URL for jsPDF
  const loadImageAsDataUrl = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

  // Branded transcript export (Group 9 Software Engineers) with GPA and credits
  const exportTranscriptPdf = async () => {
    try {
      const doc = new jsPDF();
    // Header / Branding bar
    doc.setFillColor(13, 110, 253); // Bootstrap primary
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Official Academic Transcript', 14, 12);
    doc.setFontSize(11);
    doc.text('Group 9 Software Engineers', 14, 18);
    // Real logo from public assets
    const logoPath = (process.env.PUBLIC_URL || '') + '/logo512.png';
    const dataUrl = await loadImageAsDataUrl(logoPath);
    if (dataUrl) {
      const imgWidth = 14;
      const imgHeight = 14;
      const x = doc.internal.pageSize.getWidth() - imgWidth - 8;
      const y = 4;
      doc.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);
    }
    doc.setTextColor(0, 0, 0);

    // Student info
    const startY = 30;
    doc.setFontSize(12);
    doc.text(`Student: ${studentName || 'N/A'}`, 14, startY);
    doc.text(`Email: ${user.email}`, 14, startY + 7);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY + 14);

    // Summary stats + GPA/credits (4.0 scale)
    const scores = results.map(r => r.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const hi = scores.length ? Math.max(...scores) : 0;
    const lo = scores.length ? Math.min(...scores) : 0;
    const totalExams = results.length;
    const totalScore = scores.length ? scores.reduce((a, b) => a + b, 0) : 0;
    const gpa = scores.length ? (totalScore / (scores.length * 100)) * 100 : 0;  // GPA as percentage

      autoTable(doc, {
        startY: startY + 20,
        head: [['Average', 'Highest', 'Lowest', 'Total Exams', 'GPA']],
        body: [[`${avg}%`, `${hi}%`, `${lo}%`, `${totalExams}`, `${gpa.toFixed(2)}%`]],
        styles: { fontSize: 11 },
        headStyles: { fillColor: [13, 110, 253] }
      });

    // Detailed rows
    const detailRows = results.map(r => [
      r.exams?.course || '-',
      r.exams?.exam_name || '-',
      r.exams?.date ? new Date(r.exams.date).toLocaleDateString() : '-',
      `${r.exams?.credits ?? DEFAULT_CREDITS}`,
      `${r.score}%`,
      gradeFor(r.score),
      statusFor(r.score)
    ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Course', 'Exam', 'Date', 'Credits', 'Score', 'Grade', 'Status']],
        body: detailRows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [25, 135, 84] }
      });

    // Signature block and footer
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const sigY = pageHeight - 36;
    doc.setFontSize(11);
    doc.text('Registrar:', 14, sigY);
    doc.text('Dean:', pageWidth / 2, sigY);
    // signature lines
    doc.line(14, sigY + 16, 90, sigY + 16);
    doc.line(pageWidth / 2, sigY + 16, pageWidth - 20, sigY + 16);
    doc.setFontSize(9);
    doc.text('This transcript is system-generated by Group 9 Software Engineers and valid without signature.', 14, pageHeight - 10);

      const fileName = `transcript-${(studentName || user.email).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF export (transcript) failed:', err);
      alert('Failed to generate transcript PDF. Please try again.');
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

  // Calculate statistics
  const calculateStats = () => {
    if (results.length === 0) return { average: 0, highest: 0, lowest: 0, total: 0, distinctions: 0 };
    
    const scores = results.map(r => r.score);
    const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const distinctions = scores.filter(score => score >= 75).length;
    
    return { average, highest, lowest, total: results.length, distinctions };
  };

  // Filter results
  const filteredResults = results.filter(result => {
    const matchesSearch = result.exams?.exam_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.exams?.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = filterCourse === '' || result.exams?.course === filterCourse;
    return matchesSearch && matchesCourse;
  });

  // Get unique courses for filter
  const uniqueCourses = [...new Set(results.map(r => r.exams?.course).filter(Boolean))];

  const stats = calculateStats();

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
    <div className="container-fluid px-4 py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold mb-1" style={{ 
            background: 'linear-gradient(135deg, #1a237e, #0d47a1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Student Dashboard
          </h1>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">Home</li>
              <li className="breadcrumb-item active" aria-current="page">Dashboard</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div className="text-end">
            <div className="fw-bold text-primary">{studentName || user.email}</div>
            <small className="text-muted">Student</small>
          </div>
          <button 
            className="btn btn-outline-danger d-flex align-items-center gap-2" 
            onClick={handleLogout}
            style={{
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
          >
            <i className="fas fa-sign-out-alt"></i>
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
      {results.length > 0 && (
        <div className="row g-4 mb-4">
          <div className="col-xl-3 col-md-6">
            <div 
              className="card h-100 border-0 shadow-sm hover-scale" 
              style={{ 
                background: 'linear-gradient(135deg, #4e73df 0%, #224abe 100%)',
                borderRadius: '15px',
                transition: 'transform 0.2s'
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="text-white-50 mb-1">Average Score</h6>
                    <h2 className="display-6 fw-bold text-white mb-0">{stats.average}%</h2>
                  </div>
                  <div 
                    className="rounded-circle bg-white bg-opacity-25 p-3"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className="fas fa-chart-line text-white"></i>
                  </div>
                </div>
                <div className="progress bg-white bg-opacity-25" style={{ height: '4px' }}>
                  <div 
                    className="progress-bar bg-white" 
                    style={{ width: `${stats.average}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div 
              className="card h-100 border-0 shadow-sm hover-scale" 
              style={{ 
                background: 'linear-gradient(135deg, #1cc88a 0%, #13855c 100%)',
                borderRadius: '15px',
                transition: 'transform 0.2s'
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="text-white-50 mb-1">Highest Score</h6>
                    <h2 className="display-6 fw-bold text-white mb-0">{stats.highest}%</h2>
                  </div>
                  <div 
                    className="rounded-circle bg-white bg-opacity-25 p-3"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className="fas fa-trophy text-white"></i>
                  </div>
                </div>
                <div className="progress bg-white bg-opacity-25" style={{ height: '4px' }}>
                  <div 
                    className="progress-bar bg-white" 
                    style={{ width: `${stats.highest}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div 
              className="card h-100 border-0 shadow-sm hover-scale" 
              style={{ 
                background: 'linear-gradient(135deg, #36b9cc 0%, #258391 100%)',
                borderRadius: '15px',
                transition: 'transform 0.2s'
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="text-white-50 mb-1">Total Exams</h6>
                    <h2 className="display-6 fw-bold text-white mb-0">{stats.total}</h2>
                  </div>
                  <div 
                    className="rounded-circle bg-white bg-opacity-25 p-3"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className="fas fa-book text-white"></i>
                  </div>
                </div>
                <div className="text-white-50">
                  <small>Completed Assessments</small>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6">
            <div 
              className="card h-100 border-0 shadow-sm hover-scale" 
              style={{ 
                background: 'linear-gradient(135deg, #f6c23e 0%, #dda20a 100%)',
                borderRadius: '15px',
                transition: 'transform 0.2s'
              }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="text-white-50 mb-1">Distinctions</h6>
                    <h2 className="display-6 fw-bold text-white mb-0">{stats.distinctions}</h2>
                  </div>
                  <div 
                    className="rounded-circle bg-white bg-opacity-25 p-3"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className="fas fa-star text-white"></i>
                  </div>
                </div>
                <div className="text-white-50">
                  <small>Scores ≥ 75%</small>
                </div>
              </div>
            </div>
          </div>
          <style>
            {`
              .hover-scale:hover {
                transform: translateY(-5px);
                box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important;
              }
            `}
          </style>
        </div>
      )}

      <div className="card border-0 shadow-sm" style={{ borderRadius: '15px' }}>
        <div className="card-header bg-white border-0 py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center">
              <i className="fas fa-list-alt fa-2x text-primary me-3"></i>
              <h3 className="mb-0">My Exam Results</h3>
            </div>
            {results.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                <div className="position-relative">
                  <i className="fas fa-search position-absolute text-muted" 
                     style={{ top: '50%', left: '12px', transform: 'translateY(-50%)' }}></i>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search exams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                      width: '200px',
                      paddingLeft: '35px',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                <select
                  className="form-select"
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  style={{ 
                    width: '180px',
                    borderRadius: '8px'
                  }}
                >
                  <option value="">📚 All Courses</option>
                  {uniqueCourses.map(course => (
                    <option key={course} value={course}>📘 {course}</option>
                  ))}
                </select>
                <button 
                  className="btn btn-outline-primary d-flex align-items-center gap-2"
                  onClick={exportAllToPdf}
                  style={{ borderRadius: '8px' }}
                >
                  <i className="fas fa-file-pdf"></i>
                  Export All
                </button>
                <button 
                  className="btn btn-primary d-flex align-items-center gap-2"
                  onClick={exportTranscriptPdf}
                  style={{ borderRadius: '8px' }}
                >
                  <i className="fas fa-download"></i>
                  Download Transcript
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="card-body p-0">
          {results.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="fas fa-graduation-cap fa-4x text-muted"></i>
              </div>
              <h4 className="text-muted mb-2">No Results Found</h4>
              <p className="text-muted mb-0">Please contact your lecturer if you believe this is an error.</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-4">
              <div className="mb-3">
                <i className="fas fa-search fa-3x text-muted"></i>
              </div>
              <p className="text-muted mb-0">No results match your search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr className="bg-light">
                    <th className="border-0 py-3 ps-4">Course</th>
                    <th className="border-0 py-3">Exam</th>
                    <th className="border-0 py-3">Date</th>
                    <th className="border-0 py-3">Score</th>
                    <th className="border-0 py-3">Grade</th>
                    <th className="border-0 py-3">Status</th>
                    <th className="border-0 py-3 text-end pe-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result.result_id} className="align-middle">
                      <td className="ps-4">
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2">
                            <i className="fas fa-book text-primary"></i>
                          </div>
                          <strong>{result.exams?.course}</strong>
                        </div>
                      </td>
                      <td>{result.exams?.exam_name}</td>
                      <td>
                        <i className="far fa-calendar-alt text-muted me-2"></i>
                        {new Date(result.exams?.date).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="me-2">
                            <strong>{result.score}%</strong>
                          </div>
                          <div className="progress flex-grow-1" style={{ height: '6px', width: '60px' }}>
                            <div 
                              className="progress-bar" 
                              style={{ 
                                width: `${result.score}%`,
                                backgroundColor: result.score >= 70 ? '#1cc88a' : '#f6c23e'
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-3 py-2 ${
                          result.score >= 90 ? 'bg-gradient bg-success' :
                          result.score >= 80 ? 'bg-gradient bg-primary' :
                          result.score >= 70 ? 'bg-gradient bg-info' :
                          result.score >= 50 ? 'bg-gradient bg-warning' : 'bg-gradient bg-danger'
                        }`}>
                          {result.score >= 90 ? 'A' :
                           result.score >= 80 ? 'B' :
                           result.score >= 70 ? 'C' :
                           result.score >= 50 ? 'D' : 'F'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-3 py-2 ${
                          result.score >= 75 
                            ? 'bg-primary-subtle text-primary border border-primary' 
                            : result.score >= 50
                            ? 'bg-success-subtle text-success border border-success'
                            : 'bg-danger-subtle text-danger border border-danger'
                        }`}>
                          <i className={`fas fa-${
                            result.score >= 75 
                              ? 'award'
                              : result.score >= 50 
                              ? 'check' 
                              : 'times'
                          } me-1`}></i>
                          {statusFor(result.score)}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button 
                          className="btn btn-light btn-sm d-inline-flex align-items-center gap-2"
                          onClick={() => exportSingleToPdf(result)}
                          style={{ 
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}
                        >
                          <i className="fas fa-download"></i>
                          PDF
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

      <style>
        {`
          .table > :not(caption) > * > * {
            padding: 1rem 0.5rem;
          }
          .progress {
            background-color: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
          }
        `}
      </style>
    </div>
  );
};

export default StudentDashboard;
