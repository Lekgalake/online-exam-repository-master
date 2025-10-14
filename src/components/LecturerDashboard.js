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

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateScore = (score) => {
  const numScore = parseInt(score);
  return !isNaN(numScore) && numScore >= 0 && numScore <= 100;
};

const validateDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

const validateExamName = (name) => {
  return name.trim().length >= 3 && name.trim().length <= 100;
};

const validateCourseName = (name) => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};

const validateCredits = (credits) => {
  const numCredits = parseInt(credits);
  return !isNaN(numCredits) && numCredits >= 1 && numCredits <= 30;
};

const sanitizeInput = (input) => {
  // Remove any HTML tags and trim whitespace
  return input.replace(/<[^>]*>/g, '').trim();
};

const LecturerDashboard = ({ user }) => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorTimeout, setErrorTimeout] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Loading states for different operations
  const [addingResult, setAddingResult] = useState(false);
  const [addingExam, setAddingExam] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [deletingExam, setDeletingExam] = useState(false);
  const [deletingResult, setDeletingResult] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Enhanced error handling utility
  const showError = (message, type = 'error') => {
    const errorObj = {
      message,
      type, // 'error', 'warning', 'success', 'info'
      timestamp: new Date(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    setError(errorObj);
    
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    
    // Different durations for different types of messages
    const durations = {
      error: 8000,
      warning: 6000,
      success: 4000,
      info: 4000
    };
    
    const timeout = setTimeout(() => setError(''), durations[type] || 8000);
    setErrorTimeout(timeout);
    
    // Log errors to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
  
  // Validation utility functions
  const validateField = (field, value, rules) => {
    const errors = [];
    
    if (rules.required && !value) {
      errors.push(`${field} is required`);
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${field} must be no more than ${rules.maxLength} characters`);
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(rules.message || `${field} is invalid`);
    }
    
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }
    
    return errors;
  };
  const [filterStudent, setFilterStudent] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  // Analytics filters
  const [analyticsCourse, setAnalyticsCourse] = useState('');
  const [analyticsExam, setAnalyticsExam] = useState('');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

    // Remove student handler with improved error handling and validation
    const handleRemoveStudent = async (student_id) => {
      try {
        // Get student details for better error messages
        const studentToDelete = students.find(s => s.student_id === student_id);
        if (!studentToDelete) {
          throw new Error('Student not found');
        }

        const confirmMessage = 
          `Are you sure you want to remove ${studentToDelete.name}?\n\n` +
          `This will permanently delete:\n` +
          `- All their exam results\n` +
          `- Their student profile\n` +
          `- Associated records\n\n` +
          `This action cannot be undone.`;

        const confirmDelete = window.confirm(confirmMessage);
        if (!confirmDelete) return;

        showError(`Removing student ${studentToDelete.name}...`, 'info');

        // Start a transaction by deleting all results first
        const { error: resultsError } = await supabase
          .from('results')
          .delete()
          .eq('student_id', student_id);

        if (resultsError) {
          throw new Error(`Failed to delete student results: ${resultsError.message}`);
        }

        // Then delete the student record
        const { error: studentError } = await supabase
          .from('students')
          .delete()
          .eq('student_id', student_id);

        if (studentError) {
          throw new Error(`Failed to delete student profile: ${studentError.message}`);
        }

        await fetchData();
        showError(`✅ Successfully removed ${studentToDelete.name} and all associated records`, 'success');
      } catch (error) {
        showError(`Failed to remove student: ${error.message}`, 'error');
        console.error('Remove student error:', error);
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
    let isSubscribed = true;
    
    const initializeData = async () => {
      try {
        await fetchData();
        
        // Set up real-time subscription for new students
        const studentsSubscription = supabase
          .channel('students_changes')
          .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'students' },
            (payload) => {
              if (!isSubscribed) return;
              
              console.log('New student registered:', payload.new);
              
              try {
                // Validate the new student data
                const newStudent = payload.new;
                if (!newStudent || !newStudent.email || !newStudent.name) {
                  console.error('Invalid student data received:', newStudent);
                  return;
                }

                // Add new student to the list with a "new" flag
                const studentWithFlag = { ...newStudent, isNew: true };
                setStudents(prevStudents => {
                  // Check for duplicates
                  const isDuplicate = prevStudents.some(s => s.student_id === newStudent.student_id);
                  if (isDuplicate) {
                    return prevStudents.map(s => 
                      s.student_id === newStudent.student_id 
                        ? { ...s, ...studentWithFlag }
                        : s
                    );
                  }
                  return [...prevStudents, studentWithFlag];
                });
                
                // Show notification
                showError(`🎉 New student registered: ${newStudent.name} (${newStudent.email})`, 'success');
                
                // Remove "new" flag after 10 seconds
                setTimeout(() => {
                  if (!isSubscribed) return;
                  setStudents(prev => prev.map(s => 
                    s.student_id === newStudent.student_id 
                      ? { ...s, isNew: false }
                      : s
                  ));
                }, 10000);
                
              } catch (error) {
                console.error('Error handling new student:', error);
                showError('Failed to process new student registration', 'error');
              }
            }
          )
          .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'students' },
            (payload) => {
              if (!isSubscribed) return;
              console.log('Student deleted:', payload.old);
              
              try {
                const deletedStudentId = payload.old?.student_id;
                if (deletedStudentId) {
                  setStudents(prev => prev.filter(s => s.student_id !== deletedStudentId));
                  showError(`Student record has been removed`, 'info');
                }
              } catch (error) {
                console.error('Error handling student deletion:', error);
                showError('Failed to process student deletion', 'error');
              }
            }
          )
          .subscribe();

        // Store subscription in ref for cleanup
        return studentsSubscription;
      } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize dashboard', 'error');
      }
    };

    const subscription = initializeData();

    // Cleanup function
    return () => {
      isSubscribed = false;
      subscription.then(sub => {
        if (sub) sub.unsubscribe();
      });
    };
  }, []);

  const fetchData = async () => {
    let timeoutHandle;
    try {
      setLoading(true);
      showError('Fetching latest data...', 'info');
      
      // Create a fetch promise that includes timeout and cleanup
      const fetchWithTimeout = async (promise, name, timeoutMs = 10000) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout fetching ${name} after ${timeoutMs}ms`));
          }, timeoutMs);
          
          promise
            .then(result => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch(error => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });
      };
      
      // Start loading animation
      timeoutHandle = setTimeout(() => {
        showError('Still fetching data... This may take a moment.', 'info');
      }, 3000);
      
      // Validate results before setting state
      const validateResults = (data) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format: expected an array');
        }
        return data.filter(item => {
          if (!item) return false;
          
          // Basic data validation
          if (typeof item !== 'object') return false;
          
          // You can add more specific validation rules here
          return true;
        });
      };
      
      // Fetch with retries
      const fetchWithRetry = async (fetcher, name, maxRetries = 2) => {
        let lastError;
        for (let i = 0; i <= maxRetries; i++) {
          try {
            const result = await fetchWithTimeout(
              fetcher(),
              name,
              10000 * (i + 1) // Increase timeout with each retry
            );
            
            if (result.error) {
              throw result.error;
            }
            
            return {
              ...result,
              data: validateResults(result.data || [])
            };
          } catch (error) {
            lastError = error;
            if (i < maxRetries) {
              console.warn(`Retry ${i + 1}/${maxRetries} for ${name} due to:`, error);
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
        }
        throw lastError;
      };
      
      const [studentsResult, examsResult, resultsResult] = await Promise.all([
        fetchWithRetry(
          () => supabase.from('students').select('*').order('name'),
          'students'
        ),
        fetchWithRetry(
          () => supabase.from('exams').select('*').order('date', { ascending: false }),
          'exams'
        ),
        fetchWithRetry(
          () => supabase.from('results').select(`
            *,
            students (name, email),
            exams (exam_name, course, date)
          `).order('created_at', { ascending: false }),
          'results'
        )
      ]);

      // Validate relationships between data
      const validateRelationships = () => {
        const errors = [];
        const studentIds = new Set(studentsResult.data.map(s => s.student_id));
        const examIds = new Set(examsResult.data.map(e => e.exam_id));
        
        for (const result of resultsResult.data) {
          if (!studentIds.has(result.student_id)) {
            errors.push(`Invalid student reference in result ${result.result_id}`);
          }
          if (!examIds.has(result.exam_id)) {
            errors.push(`Invalid exam reference in result ${result.result_id}`);
          }
        }
        
        return errors;
      };
      
      const relationshipErrors = validateRelationships();
      if (relationshipErrors.length > 0) {
        console.warn('Data relationship warnings:', relationshipErrors);
        // We could throw here if we want to be strict
      }

      // Update state with validated data
      setStudents(studentsResult.data);
      setExams(examsResult.data);
      setResults(resultsResult.data);
      
      showError('✅ Data refreshed successfully', 'success');
      
    } catch (error) {
      const errorMessage = error.code === 'PGRST301' 
        ? 'Database connection error. Please check your network connection.'
        : error.code === '23505'
          ? 'Duplicate entry found. Please refresh and try again.'
          : `Failed to fetch data: ${error.message}`;
      
      showError(errorMessage, 'error');
      console.error('Fetch error:', error);
      
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
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
    
    setEditingResult(true);

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
      showError('✅ Result updated successfully!');
    } catch (error) {
      showError('Failed to update result: ' + error.message);
    } finally {
      setEditingResult(false);
    }
  };

  const handleDeleteResult = async (id) => {
    try {
      const confirmDelete = window.confirm('Are you sure you want to delete this result? This action cannot be undone.');
      if (!confirmDelete) return;

      setDeletingResult(true);
      showError('Deleting result...', 'info');

      // Get the result details before deletion for better error messages
      const resultToDelete = results.find(r => r.result_id === id);
      const studentName = resultToDelete?.students?.name || 'Unknown Student';
      const examName = resultToDelete?.exams?.exam_name || 'Unknown Exam';

      const { error } = await supabase
        .from('results')
        .delete()
        .eq('result_id', id);

      if (error) {
        throw new Error(`Failed to delete result: ${error.message}`);
      }

      await fetchData();
      showError(`✅ Successfully deleted result for ${studentName} in ${examName}`, 'success');
    } catch (error) {
      showError(`Failed to delete result: ${error.message}`, 'error');
      console.error('Delete result error:', error);
    } finally {
      setDeletingResult(false);
    }
  };

  // Function to handle exam deletion
  const handleDeleteExam = async (examId) => {
    // Find exam details for better error messages
    const examToDelete = exams.find(e => e.exam_id === examId);
    if (!examToDelete) {
      showError('Exam not found. It may have been already deleted.');
      return;
    }

    // Improved confirmation message with exam details
    const confirmMessage = [
      `Are you sure you want to delete the exam "${examToDelete.exam_name}"?`,
      `\nCourse: ${examToDelete.course}`,
      `\nDate: ${new Date(examToDelete.date).toLocaleDateString()}`,
      `\n\nThis will permanently delete:`,
      `• The exam and all its settings`,
      `• All student results for this exam`,
      `• Associated performance analytics`,
      `\nThis action cannot be undone.`
    ].join('');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingExam(true);
    let succeeded = false;

    try {
      showError('Deleting exam data...', 'info');

      // Start a database transaction
      const { error: transactionError } = await supabase.rpc('delete_exam_transaction', {
        exam_id_param: examId
      });

      if (transactionError) {
        // Try fallback approach if transaction fails
        console.warn('Transaction failed, trying sequential deletion:', transactionError);
        
        // First check if there are any results
        const { data: resultCount } = await supabase
          .from('results')
          .select('result_id', { count: 'exact' })
          .eq('exam_id', examId);

        // Delete all results for this exam
        if (resultCount && resultCount.length > 0) {
          const { error: resultsError } = await supabase
            .from('results')
            .delete()
            .eq('exam_id', examId);

          if (resultsError) {
            throw new Error(`Failed to delete exam results: ${resultsError.message}`);
          }
        }

        // Then delete the exam itself
        const { error: examError } = await supabase
          .from('exams')
          .delete()
          .eq('exam_id', examId);

        if (examError) {
          throw new Error(`Failed to delete exam: ${examError.message}`);
        }
      }

      succeeded = true;
      await fetchData(); // Refresh the data
      showError(`✅ Successfully deleted exam "${examToDelete.exam_name}"`, 'success');
      
    } catch (error) {
      console.error('Delete exam error:', error);
      
      // Show different error messages based on error type
      if (error.code === '23503') {
        showError('Cannot delete exam because it has associated data that depends on it. Please contact support.', 'error');
      } else if (error.code === '42P01') {
        showError('Database error: Table not found. Please refresh the page and try again.', 'error');
      } else {
        showError(`Failed to delete exam: ${error.message}`, 'error');
      }
      
      // If partial deletion occurred, force a refresh
      if (error.message.includes('exam results')) {
        await fetchData();
      }
      
    } finally {
      setDeletingExam(false);
      
      // Show warning if operation failed
      if (!succeeded) {
        showError('Warning: The exam deletion may have been only partially completed', 'warning');
      }
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
    setIsSubmitting(true);
    const errors = {};
    
    try {
      // Validate all fields
      if (!newResult.student_id) {
        errors.student_id = 'Please select a student';
      }
      
      if (!newResult.exam_id) {
        errors.exam_id = 'Please select an exam';
      }
      
      if (!newResult.score) {
        errors.score = 'Please enter a score';
      } else if (!validateScore(newResult.score)) {
        errors.score = 'Score must be a number between 0 and 100';
      }
      
      // If there are any validation errors, stop submission
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        showError('Please correct the errors before submitting');
        return;
      }
      
      setValidationErrors({});
      setAddingResult(true);
      
      // Validate that the student and exam exist
      const studentExists = students.some(s => s.student_id === newResult.student_id);
      const examExists = exams.some(e => e.exam_id === newResult.exam_id);
      
      if (!studentExists) {
        throw new Error('Selected student no longer exists');
      }
      if (!examExists) {
        throw new Error('Selected exam no longer exists');
      }
      
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
        throw new Error(
          `${student?.name || 'This student'} already has a result for ${exam?.exam_name || 'this exam'}. Please edit the existing result instead.`
        );
      }

      // Insert the new result with retry
      const maxRetries = 2;
      let lastError;
      
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const { error } = await supabase
            .from('results')
            .insert([{
              student_id: newResult.student_id,
              exam_id: newResult.exam_id,
              score: parseInt(newResult.score),
              created_at: new Date().toISOString()
            }]);

          if (error) {
            throw error;
          }

          // Success - clear form and refresh data
          setNewResult({ student_id: '', exam_id: '', score: '' });
          await fetchData();
          showError('✅ Result added successfully!', 'success');
          return;
          
        } catch (error) {
          console.warn(`Attempt ${i + 1}/${maxRetries + 1} failed:`, error);
          lastError = error;
          
          if (error.code === '23505') {
            throw new Error('This student already has a result for this exam. Please edit the existing result instead.');
          }
          
          if (i < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      
      throw lastError || new Error('Failed to add result after multiple attempts');
      
    } catch (error) {
      showError(error.message, 'error');
      console.error('Add result error:', error);
    } finally {
      setAddingResult(false);
      setIsSubmitting(false);
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
    } finally {
      setAddingResult(false);
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    setAddingExam(true);
    setValidationErrors({});
    const errors = {};

    try {
      // Validate course name
      if (!newExam.course.trim()) {
        errors.course = 'Course name is required';
      } else if (!validateCourseName(newExam.course.trim())) {
        errors.course = 'Course name must be between 2 and 50 characters';
      }

      // Validate exam name
      if (!newExam.exam_name.trim()) {
        errors.exam_name = 'Exam name is required';
      } else if (!validateExamName(newExam.exam_name.trim())) {
        errors.exam_name = 'Exam name must be between 3 and 100 characters';
      }

      // Validate date
      if (!newExam.date) {
        errors.date = 'Exam date is required';
      } else if (!validateDate(newExam.date)) {
        errors.date = 'Please enter a valid date';
      } else {
        const examDate = new Date(newExam.date);
        const today = new Date();
        if (examDate < today) {
          errors.date = 'Exam date cannot be in the past';
        }
      }

      // Validate credits
      if (!validateCredits(newExam.credits)) {
        errors.credits = 'Credits must be between 1 and 30';
      }

      // Check for duplicate exam names
      const duplicateExam = exams.find(
        exam => exam.exam_name.toLowerCase() === newExam.exam_name.trim().toLowerCase()
      );
      if (duplicateExam) {
        errors.exam_name = 'An exam with this name already exists';
      }

      // If there are validation errors, stop submission
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        showError('Please correct all errors before submitting', 'warning');
        setAddingExam(false);
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
    } finally {
      setAddingExam(false);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      showError('Please select a CSV file to upload', 'warning');
      return;
    }

    // Validate file type and size
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('Invalid file type. Please upload a CSV file', 'error');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showError('File is too large. Maximum size is 5MB', 'error');
      return;
    }

    setUploadingCsv(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        
        if (lines.length < 2) {
          throw new Error('CSV file is empty or missing header row');
        }
        
        // Validate header row
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const expectedHeaders = ['student_email', 'exam_name', 'score'];
        const missingHeaders = expectedHeaders.filter(h => !header.includes(h));
        
        if (missingHeaders.length > 0) {
          throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
        }
        
        // Track errors for reporting
        const errors = [];
        const resultsToInsert = [];
        const processed = {
          total: lines.length - 1,
          valid: 0,
          invalid: 0,
          duplicates: 0
        };
        
        // Keep track of processed student/exam combinations
        const processedCombos = new Set();
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines
          
          try {
            const values = line.split(',').map(v => v.trim());
            if (values.length !== 3) {
              errors.push(`Line ${i + 1}: Expected 3 values, got ${values.length}`);
              processed.invalid++;
              continue;
            }
            
            const [studentEmail, examName, scoreStr] = values;
            
            // Validate email
            if (!validateEmail(studentEmail)) {
              errors.push(`Line ${i + 1}: Invalid email format: ${studentEmail}`);
              processed.invalid++;
              continue;
            }
            
            // Validate score
            const score = parseInt(scoreStr);
            if (!validateScore(score)) {
              errors.push(`Line ${i + 1}: Invalid score (must be 0-100): ${scoreStr}`);
              processed.invalid++;
              continue;
            }
            
            // Find student and exam
            const student = students.find(s => s.email.toLowerCase() === studentEmail.toLowerCase());
            const exam = exams.find(e => e.exam_name.toLowerCase() === examName.toLowerCase());
            
            if (!student) {
              errors.push(`Line ${i + 1}: Student not found: ${studentEmail}`);
              processed.invalid++;
              continue;
            }
            
            if (!exam) {
              errors.push(`Line ${i + 1}: Exam not found: ${examName}`);
              processed.invalid++;
              continue;
            }
            
            // Check for duplicates in current upload
            const combo = `${student.student_id}-${exam.exam_id}`;
            if (processedCombos.has(combo)) {
              errors.push(`Line ${i + 1}: Duplicate entry for student ${studentEmail} in exam ${examName}`);
              processed.duplicates++;
              continue;
            }
            processedCombos.add(combo);
            
            // All validations passed, add to insert array
            resultsToInsert.push({
              student_id: student.student_id,
              exam_id: exam.exam_id,
              score: score,
              created_at: new Date().toISOString()
            });
            processed.valid++;
            
          } catch (lineError) {
            errors.push(`Line ${i + 1}: ${lineError.message}`);
            processed.invalid++;
          }
        }

        if (resultsToInsert.length === 0) {
          throw new Error('No valid results found in CSV file');
        }

        // Insert results in batches
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < resultsToInsert.length; i += batchSize) {
          batches.push(resultsToInsert.slice(i, i + batchSize));
        }

        let successCount = 0;
        let failureCount = 0;

        for (const batch of batches) {
          try {
            const { error } = await supabase
              .from('results')
              .insert(batch);

            if (error) {
              failureCount += batch.length;
              if (error.code === '23505') {
                errors.push(`Batch insert failed: Some results already exist`);
              } else {
                errors.push(`Batch insert failed: ${error.message}`);
              }
            } else {
              successCount += batch.length;
            }
          } catch (batchError) {
            failureCount += batch.length;
            errors.push(`Batch insert error: ${batchError.message}`);
          }
        }

        // Refresh data and show summary
        await fetchData();
        
        const summary = [
          `📊 CSV Upload Summary:`,
          `✓ Successfully added: ${successCount}`,
          `✕ Failed to add: ${failureCount}`,
          `ℹ Total rows processed: ${processed.total}`,
          `• Valid entries: ${processed.valid}`,
          `• Invalid entries: ${processed.invalid}`,
          `• Duplicates: ${processed.duplicates}`
        ].join('\n');

        showError(summary, successCount > 0 ? 'success' : 'warning');
        
        // If there were any errors, provide detailed report
        if (errors.length > 0) {
          console.warn('CSV upload errors:', errors);
          const errorReport = errors.join('\n');
          // Save error report to file or show in modal
          console.error('Error Report:\n', errorReport);
        }

      } catch (error) {
        showError(`CSV Upload Error: ${error.message}`, 'error');
        console.error('CSV upload error:', error);
      } finally {
        setUploadingCsv(false);
        // Reset file input
        e.target.value = '';
      }
    };
    
    reader.onerror = () => {
      setUploadingCsv(false);
      showError('Failed to read CSV file', 'error');
    };
    
    // Start reading the file
    showError('Processing CSV file...', 'info');
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
    
    // Use the actual number of registered students instead of unique students in results
    const totalStudents = students.length;
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
          className={`alert ${
            typeof error === 'object' 
              ? `alert-${error.type}` 
              : error.startsWith('✅') 
                ? 'alert-success' 
                : 'alert-danger'
          } alert-dismissible fade show notification-alert`}
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
            background: typeof error === 'object'
              ? error.type === 'success'
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : error.type === 'warning'
                  ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)'
                  : error.type === 'info'
                    ? 'linear-gradient(135deg, #17a2b8 0%, #0097a7 100%)'
                    : 'linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)'
              : error.startsWith('✅')
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)',
            color: 'white',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {typeof error === 'object' ? (
              <i className={`fas ${
                error.type === 'success' ? 'fa-check-circle' :
                error.type === 'warning' ? 'fa-exclamation-triangle' :
                error.type === 'info' ? 'fa-info-circle' :
                'fa-exclamation-circle'
              }`} style={{ fontSize: '1.2rem' }}></i>
            ) : (
              error.startsWith('✅') ? (
                <i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i>
              ) : (
                <i className="fas fa-exclamation-circle" style={{ fontSize: '1.2rem' }}></i>
              )
            )}
            <div style={{ flex: 1 }}>
              {typeof error === 'object' ? error.message : 
               error.startsWith('✅') ? error.substring(2) : error}
            </div>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={() => setError('')}
              aria-label="Close notification"
              style={{ opacity: 0.8, fontSize: '0.8rem' }}
            ></button>
          </div>
          
          {/* Progress bar */}
          <div className="notification-progress">
            <div className="progress-bar" />
          </div>
        </div>
      )}

      <style>
        {`
          .notification-alert {
            opacity: 0;
            transform: translateX(100%);
          }

          .notification-alert.show {
            opacity: 1;
            transform: translateX(0);
          }

          .notification-progress {
            width: 100%;
            height: 3px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 4px;
          }

          .progress-bar {
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.8);
            animation: shrinkProgress 8s linear forwards;
          }

          @keyframes shrinkProgress {
            from {
              width: 100%;
            }
            to {
              width: 0%;
            }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
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
        `}
      </style>

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
        <div className="col-md-3 mb-3">
          <div className="card h-100 shadow-sm hover-scale" 
               style={{ 
                 background: 'linear-gradient(135deg, #4e73df 0%, #224abe 100%)',
                 transition: 'transform 0.2s, box-shadow 0.2s',
                 border: 'none',
                 borderRadius: '15px',
                 boxShadow: '0 4px 20px rgba(78, 115, 223, 0.1)'
               }}>
            <div className="card-body text-white p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title mb-0">Total Students</h5>
                </div>
                <div className="icon-circle">
                  <i className="fas fa-users fa-lg"></i>
                </div>
              </div>
              <h2 className="display-4 fw-bold mb-0">{stats.totalStudents}</h2>
              <div className="text-white-50 small mt-2">Active Students</div>
            </div>
            <div className="card-footer bg-transparent border-0 py-3">
              <div className="progress bg-white bg-opacity-25" style={{ height: '4px' }}>
                <div className="progress-bar bg-white" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
        
        <style>
          {`
            .icon-circle {
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .hover-scale:hover {
              transform: translateY(-5px);
              box-shadow: 0 8px 25px rgba(78, 115, 223, 0.2) !important;
            }
          `}
        </style>
        <div className="col-md-3 mb-3">
          <div className="card h-100 shadow-sm hover-scale" 
               style={{ 
                 background: 'linear-gradient(135deg, #1cc88a 0%, #13855c 100%)',
                 transition: 'transform 0.2s'
               }}>
            <div className="card-body text-white p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Total Exams</h5>
                <i className="fas fa-book fa-2x text-white-50"></i>
              </div>
              <h2 className="display-4 mb-0">{stats.totalExams}</h2>
              <div className="text-white-50 small mt-2">Created Exams</div>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card h-100 shadow-sm hover-scale" 
               style={{ 
                 background: 'linear-gradient(135deg, #f6c23e 0%, #dda20a 100%)',
                 transition: 'transform 0.2s'
               }}>
            <div className="card-body text-white p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Average Score</h5>
                <i className="fas fa-chart-line fa-2x text-white-50"></i>
              </div>
              <h2 className="display-4 mb-0">{stats.averageScore}%</h2>
              <div className="text-white-50 small mt-2">Overall Performance</div>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card h-100 shadow-sm hover-scale" 
               style={{ 
                 background: 'linear-gradient(135deg, #36b9cc 0%, #258391 100%)',
                 transition: 'transform 0.2s'
               }}>
            <div className="card-body text-white p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Total Results</h5>
                <i className="fas fa-clipboard-list fa-2x text-white-50"></i>
              </div>
              <h2 className="display-4 mb-0">{stats.totalResults}</h2>
              <div className="text-white-50 small mt-2">Recorded Results</div>
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

      {/* Navigation Tabs */}
      <style>
        {`
          /* Transcript Styles */
          .transcript-section {
            background-color: white;
          }

          .university-name {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a237e;
            margin-bottom: 0.5rem;
          }

          .transcript-title {
            font-size: 1.8rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 2px;
          }

          .student-info {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 10px;
            border: 1px solid #dee2e6;
            max-width: 500px;
            margin: 0 auto;
          }

          .course-section {
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 1.5rem;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .course-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e9ecef;
          }

          .score-cell {
            width: 200px;
          }

          .score-value {
            display: block;
            font-weight: 600;
            margin-bottom: 0.25rem;
          }

          .score-bar {
            height: 6px;
            background: #e9ecef;
            border-radius: 3px;
            overflow: hidden;
          }

          .score-fill {
            height: 100%;
            transition: width 0.3s ease;
          }

          .grade-badge {
            display: inline-block;
            width: 32px;
            height: 32px;
            line-height: 32px;
            text-align: center;
            border-radius: 50%;
            font-weight: 600;
            color: white;
          }

          .grade-a { background: #198754; }
          .grade-b { background: #0d6efd; }
          .grade-c { background: #ffc107; }
          .grade-d { background: #fd7e14; }
          .grade-f { background: #dc3545; }

          .transcript-summary {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 2rem;
            margin-top: 2rem;
          }

          .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-top: 1rem;
          }

          .summary-item {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .summary-label {
            display: block;
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
          }

          .summary-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 600;
            color: #1a237e;
          }

          @media print {
            body * {
              visibility: hidden;
            }
            .transcript-section, .transcript-section * {
              visibility: visible;
            }
            .transcript-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}
      </style>

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
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'transcript' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            <i className="fas fa-scroll me-2"></i>Transcript
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
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }} 
                          className="hover-highlight"
                          title="Click to sort by student name">
                        <div className="d-flex align-items-center gap-2">
                          <span>Student</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by course">
                        <div className="d-flex align-items-center gap-2">
                          <span>Course</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by exam name">
                        <div className="d-flex align-items-center gap-2">
                          <span>Exam</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by date">
                        <div className="d-flex align-items-center gap-2">
                          <span>Date</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by score">
                        <div className="d-flex align-items-center gap-2">
                          <span>Score</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by grade">
                        <div className="d-flex align-items-center gap-2">
                          <span>Grade</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          className="hover-highlight"
                          title="Click to sort by status">
                        <div className="d-flex align-items-center gap-2">
                          <span>Status</span>
                          <i className="fas fa-sort text-muted small"></i>
                        </div>
                      </th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <style>
                    {`
                      .hover-highlight:hover {
                        background-color: rgba(255, 255, 255, 0.1);
                      }
                    `}
                  </style>
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
                                <button 
                                  className="btn btn-success" 
                                  onClick={handleEditSave}
                                  disabled={editingResult}
                                >
                                  {editingResult ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                      Saving...
                                    </>
                                  ) : (
                                    'Save'
                                  )}
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={handleEditCancel}
                                  disabled={editingResult}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="btn-group btn-group-sm" role="group">
                                <button 
                                  className="btn btn-outline-primary d-flex align-items-center gap-1"
                                  onClick={() => handleEditStart(result)}
                                  title="Edit this result"
                                >
                                  <i className="fas fa-edit"></i>
                                  <span>Edit</span>
                                </button>
                                <button 
                                  className="btn btn-outline-danger d-flex align-items-center gap-1"
                                  onClick={() => handleDeleteResult(result.result_id)}
                                  title="Delete this result"
                                >
                                  <i className="fas fa-trash-alt"></i>
                                  <span>Delete</span>
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
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={addingResult}
              >
                {addingResult ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding...
                  </>
                ) : (
                  'Add Result'
                )}
              </button>
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
                            disabled={deletingExam}
                          >
                            {deletingExam ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
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
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={addingExam}
              >
                {addingExam ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding Exam...
                  </>
                ) : (
                  'Add Exam'
                )}
              </button>
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
              <div className="position-relative">
                <input
                  type="file"
                  className="form-control"
                  id="csvFile"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={uploadingCsv}
                />
                {uploadingCsv && (
                  <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Uploading...</span>
                    </div>
                  </div>
                )}
              </div>
              {uploadingCsv && (
                <small className="text-muted mt-2 d-block">
                  <i className="fas fa-info-circle me-1"></i>
                  Processing CSV file, please wait...
                </small>
              )}
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

      {/* Academic Transcript Tab */}
      {activeTab === 'transcript' && (
        <div className="card">
          <div className="card-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h3 className="mb-0">Academic Transcript</h3>
              <button className="btn btn-light btn-sm" onClick={() => window.print()}>
                <i className="fas fa-print me-2"></i>Print Transcript
              </button>
            </div>
          </div>
          <div className="card-body transcript-section">
            <div className="mb-4">
              <select
                className="form-select form-select-lg mb-3"
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
              >
                <option value="">Select Student</option>
                {uniqueStudents.map(student => (
                  <option key={student} value={student}>{student}</option>
                ))}
              </select>
            </div>

            {filterStudent && (
              <div className="transcript-content">
                <div className="text-center mb-5">
                  <h1 className="university-name">Online Exam Repository</h1>
                  <h2 className="transcript-title">Official Academic Transcript</h2>
                  <div className="student-info mt-4">
                    <p className="mb-1"><strong>Student Name:</strong> {filterStudent}</p>
                    <p className="mb-1"><strong>Student ID:</strong> {
                      students.find(s => s.name === filterStudent)?.student_id || 'N/A'
                    }</p>
                    <p className="mb-1"><strong>Issue Date:</strong> {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {uniqueCourses.map(course => {
                  const courseResults = filteredResults.filter(r => 
                    r.students?.name === filterStudent && 
                    r.exams?.course === course
                  );

                  if (courseResults.length === 0) return null;

                  const courseAverage = Math.round(
                    courseResults.reduce((sum, r) => sum + r.score, 0) / courseResults.length
                  );

                  const totalCredits = courseResults.reduce((sum, r) => {
                    const exam = exams.find(e => e.exam_id === r.exam_id);
                    return sum + (exam?.credits || 0);
                  }, 0);

                  return (
                    <div key={course} className="course-section mb-4">
                      <div className="course-header">
                        <h3>{course}</h3>
                        <div className="course-stats">
                          <span className="badge bg-primary me-2">Credits: {totalCredits}</span>
                          <span className={`badge ${
                            courseAverage >= 90 ? 'bg-success' :
                            courseAverage >= 80 ? 'bg-primary' :
                            courseAverage >= 70 ? 'bg-warning' :
                            'bg-danger'
                          }`}>
                            Average: {courseAverage}%
                          </span>
                        </div>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Exam</th>
                              <th>Date</th>
                              <th>Credits</th>
                              <th>Score</th>
                              <th>Grade</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseResults.map(result => {
                              const exam = exams.find(e => e.exam_id === result.exam_id);
                              return (
                                <tr key={result.result_id}>
                                  <td>{result.exams?.exam_name}</td>
                                  <td>{new Date(result.exams?.date).toLocaleDateString()}</td>
                                  <td>{exam?.credits || 3}</td>
                                  <td>
                                    <div className="score-cell">
                                      <span className="score-value">{result.score}%</span>
                                      <div className="score-bar">
                                        <div 
                                          className="score-fill" 
                                          style={{
                                            width: `${result.score}%`,
                                            backgroundColor: 
                                              result.score >= 90 ? '#198754' :
                                              result.score >= 80 ? '#0d6efd' :
                                              result.score >= 70 ? '#ffc107' :
                                              result.score >= 60 ? '#fd7e14' :
                                              '#dc3545'
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`grade-badge ${
                                      result.score >= 90 ? 'grade-a' :
                                      result.score >= 80 ? 'grade-b' :
                                      result.score >= 70 ? 'grade-c' :
                                      result.score >= 60 ? 'grade-d' :
                                      'grade-f'
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
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div className="transcript-summary mt-5">
                  <h4>Transcript Summary</h4>
                  <div className="summary-stats">
                    <div className="summary-item">
                      <span className="summary-label">Total Courses</span>
                      <span className="summary-value">{
                        new Set(filteredResults
                          .filter(r => r.students?.name === filterStudent)
                          .map(r => r.exams?.course)
                        ).size
                      }</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Total Credits</span>
                      <span className="summary-value">{
                        filteredResults
                          .filter(r => r.students?.name === filterStudent)
                          .reduce((sum, r) => {
                            const exam = exams.find(e => e.exam_id === r.exam_id);
                            return sum + (exam?.credits || 0);
                          }, 0)
                      }</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Overall GPA</span>
                      <span className="summary-value">{(() => {
                        const studentResults = filteredResults.filter(r => r.students?.name === filterStudent);
                        
                        // Calculate GPA based on grade points
                        const totalPoints = studentResults.reduce((sum, r) => {
                          // Get the credits for this exam
                          const exam = exams.find(e => e.exam_id === r.exam_id);
                          const credits = exam?.credits || 3;
                          
                          // Calculate grade points
                          let gradePoints;
                          if (r.score >= 90) gradePoints = 4.0;      // A  = 4.0
                          else if (r.score >= 85) gradePoints = 3.7;  // A- = 3.7
                          else if (r.score >= 80) gradePoints = 3.3;  // B+ = 3.3
                          else if (r.score >= 75) gradePoints = 3.0;  // B  = 3.0
                          else if (r.score >= 70) gradePoints = 2.7;  // B- = 2.7
                          else if (r.score >= 65) gradePoints = 2.3;  // C+ = 2.3
                          else if (r.score >= 60) gradePoints = 2.0;  // C  = 2.0
                          else if (r.score >= 55) gradePoints = 1.7;  // C- = 1.7
                          else if (r.score >= 50) gradePoints = 1.3;  // D+ = 1.3
                          else if (r.score >= 45) gradePoints = 1.0;  // D  = 1.0
                          else gradePoints = 0.0;                     // F  = 0.0
                          
                          return sum + (gradePoints * credits);
                        }, 0);

                        // Calculate total credits
                        const totalCredits = studentResults.reduce((sum, r) => {
                          const exam = exams.find(e => e.exam_id === r.exam_id);
                          return sum + (exam?.credits || 3);
                        }, 0);

                        // Calculate GPA
                        const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
                        
                        return gpa.toFixed(2);
                      })()}</span>
                      <div className="gpa-scale mt-2 text-start small">
                        <div className="text-muted mb-1">GPA Scale:</div>
                        <div className="d-flex flex-wrap gap-3">
                          <span>A (90-100): 4.0</span>
                          <span>A- (85-89): 3.7</span>
                          <span>B+ (80-84): 3.3</span>
                          <span>B (75-79): 3.0</span>
                          <span>B- (70-74): 2.7</span>
                          <span>C+ (65-69): 2.3</span>
                          <span>C (60-64): 2.0</span>
                          <span>C- (55-59): 1.7</span>
                          <span>D+ (50-54): 1.3</span>
                          <span>D (45-49): 1.0</span>
                          <span>F (0-44): 0.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
