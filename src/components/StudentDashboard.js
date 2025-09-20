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
  const gradeFor = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const statusFor = (score) => (score >= 70 ? 'Pass' : 'Needs Improvement');

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
      statusFor(r.score)
    ]);

      autoTable(doc, {
        startY: 32,
        head: [['Course', 'Exam', 'Date', 'Score', 'Grade', 'Status']],
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
      statusFor(result.score)
    ]];

      autoTable(doc, {
        startY: 32,
        head: [['Course', 'Exam', 'Date', 'Score', 'Grade', 'Status']],
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
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
    const hi = scores.length ? Math.max(...scores) : 0;
    const lo = scores.length ? Math.min(...scores) : 0;
    const totalExams = results.length;
    const gradePoint = (s) => (s >= 90 ? 4.0 : s >= 80 ? 3.0 : s >= 70 ? 2.0 : s >= 60 ? 1.0 : 0.0);
    const totalCredits = results.reduce((acc, r) => acc + (r.exams?.credits ?? DEFAULT_CREDITS), 0);
    const qualityPoints = results.reduce((acc, r) => acc + gradePoint(r.score) * (r.exams?.credits ?? DEFAULT_CREDITS), 0);
    const gpa = totalCredits > 0 ? (qualityPoints / totalCredits) : 0;

      autoTable(doc, {
        startY: startY + 20,
        head: [['Average', 'Highest', 'Lowest', 'Total Exams', 'Total Credits', 'GPA']],
        body: [[`${avg}%`, `${hi}%`, `${lo}%`, `${totalExams}`, `${totalCredits}`, gpa.toFixed(2)]],
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
    if (results.length === 0) return { average: 0, highest: 0, lowest: 0, total: 0 };
    
    const scores = results.map(r => r.score);
    const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    
    return { average, highest, lowest, total: results.length };
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
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Student Dashboard</h1>
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
      {results.length > 0 && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body text-center">
                <h5 className="card-title">Average Score</h5>
                <h2>{stats.average}%</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body text-center">
                <h5 className="card-title">Highest Score</h5>
                <h2>{stats.highest}%</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white">
              <div className="card-body text-center">
                <h5 className="card-title">Lowest Score</h5>
                <h2>{stats.lowest}%</h2>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body text-center">
                <h5 className="card-title">Total Exams</h5>
                <h2>{stats.total}</h2>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h3>My Exam Results</h3>
          {results.length > 0 && (
            <div className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '200px' }}
              />
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
              <button className="btn btn-sm btn-outline-primary" onClick={exportAllToPdf}>
                Export All (PDF)
              </button>
              <button className="btn btn-sm btn-primary" onClick={exportTranscriptPdf}>
                Download Transcript
              </button>
            </div>
          )}
        </div>
        <div className="card-body">
          {results.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-graduation-cap fa-3x text-muted mb-3"></i>
              <p className="text-muted">No results found. Please contact your lecturer if you believe this is an error.</p>
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
                  {filteredResults.map((result) => (
                    <tr key={result.result_id}>
                      <td>
                        <strong>{result.exams?.course}</strong>
                      </td>
                      <td>{result.exams?.exam_name}</td>
                      <td>{new Date(result.exams?.date).toLocaleDateString()}</td>
                      <td>
                        <span className="fw-bold">{result.score}%</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          result.score >= 90 ? 'bg-success' :
                          result.score >= 80 ? 'bg-primary' :
                          result.score >= 70 ? 'bg-warning' :
                          result.score >= 60 ? 'bg-info' :
                          'bg-danger'
                        }`}>
                          {result.score >= 90 ? 'A' :
                           result.score >= 80 ? 'B' :
                           result.score >= 70 ? 'C' :
                           result.score >= 60 ? 'D' : 'F'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          result.score >= 70 ? 'bg-success' : 'bg-warning'
                        }`}>
                          {result.score >= 70 ? 'Pass' : 'Needs Improvement'}
                        </span>
                      </td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => exportSingleToPdf(result)}>
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
    </div>
  );
};

export default StudentDashboard;
