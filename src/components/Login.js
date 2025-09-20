import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Enhanced client-side validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Create/Upsert profile in public.users with the selected role
        if (data.user) {
          console.log('Creating user profile with role:', selectedRole);
          const { error: profileError } = await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              role: selectedRole
            });
          if (profileError) {
            console.error('Error creating user profile:', profileError);
          } else {
            console.log('User profile created successfully with role:', selectedRole);
          }
        }
        
        if (data.user && !data.user.email_confirmed_at) {
          setSuccessMessage(`🎉 Account created as ${selectedRole}! Please check your email for the confirmation link, or try logging in directly.`);
        } else {
          setSuccessMessage(`🎉 Account created successfully as ${selectedRole}! You can now log in.`);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('email not confirmed') || error.message.includes('Email not confirmed')) {
            setError('📧 Email not confirmed. Please check your email for the confirmation link, or try signing up again.');
            return;
          }
          if (error.message.includes('Invalid login credentials')) {
            setError('❌ Invalid email or password. Please check your credentials and try again.');
            return;
          }
          throw error;
        }

        // After successful login, check if user has a role assigned
        if (data.user) {
          const { data: userData, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (roleError) {
            console.log('Role check error (normal if database not set up):', roleError.message);
            // If users table doesn't exist or user not found, continue with default role
            // The App.js will handle role assignment
          }
        }
      }
    } catch (error) {
      setError(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (email, password, message) => {
    setEmail(email);
    setPassword(password);
    if (message) {
      setError(message);
    }
  };

  const handleCreateLecturerAccount = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Create lecturer account automatically
      const lecturerEmail = 'lecturer@test.com';
      const lecturerPassword = 'password123';

      const { data, error } = await supabase.auth.signUp({
        email: lecturerEmail,
        password: lecturerPassword,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setSuccessMessage('✅ Lecturer account already exists! You can now log in with lecturer@test.com / password123');
        } else {
          throw error;
        }
      } else if (data.user) {
        // Create the user profile with lecturer role
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: lecturerEmail,
            role: 'lecturer'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        setSuccessMessage('🎉 Lecturer account created successfully! You can now log in with lecturer@test.com / password123');
      }
    } catch (error) {
      setError(`❌ Error creating lecturer account: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center" style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5 col-xl-4">
            {/* Main Card */}
            <div className="card shadow-lg border-0" style={{ 
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)'
            }}>
              <div className="card-body p-5">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="mb-3">
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
                    }}>
                      <i className="fas fa-graduation-cap text-white" style={{ fontSize: '2rem' }}></i>
                    </div>
                  </div>
                  <h2 className="fw-bold mb-2" style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.8rem'
                  }}>
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                  </h2>
                  <p className="text-muted mb-0">
                    {isSignUp ? 'Join the exam management system' : 'Sign in to your dashboard'}
                  </p>
                </div>

                {/* Success Message */}
                {successMessage && (
                  <div className="alert alert-success border-0 mb-4" style={{ borderRadius: '12px' }}>
                    <i className="fas fa-check-circle me-2"></i>
                    {successMessage}
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="alert alert-danger border-0 mb-4" style={{ borderRadius: '12px' }}>
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}

                {/* Lecturer Notice */}
                {!isSignUp && (
                  <div className="alert alert-info border-0 mb-4" style={{ borderRadius: '12px' }}>
                    <i className="fas fa-info-circle me-2"></i>
                    <strong>Want to test lecturer features?</strong> Click "Don't have an account? Sign Up" and select "Lecturer" role.
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="email" className="form-label fw-semibold">
                      <i className="fas fa-envelope me-2 text-primary"></i>Email Address
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-lg"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      style={{ 
                        borderRadius: '12px',
                        border: '2px solid #e9ecef',
                        padding: '12px 16px',
                        fontSize: '1rem'
                      }}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" className="form-label fw-semibold">
                      <i className="fas fa-lock me-2 text-primary"></i>Password
                    </label>
                    <div className="input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control form-control-lg"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        style={{ 
                          borderRadius: '12px 0 0 12px',
                          border: '2px solid #e9ecef',
                          borderRight: 'none',
                          padding: '12px 16px',
                          fontSize: '1rem'
                        }}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ 
                          borderRadius: '0 12px 12px 0',
                          border: '2px solid #e9ecef',
                          borderLeft: 'none',
                          padding: '12px 16px'
                        }}
                      >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    <div className="form-text mt-2">
                      <i className="fas fa-info-circle me-1"></i>
                      Password must be at least 6 characters long
                    </div>
                  </div>

                  {isSignUp && (
                    <div className="mb-4">
                      <label htmlFor="role" className="form-label fw-semibold">
                        <i className="fas fa-user-tag me-2 text-primary"></i>Account Type
                      </label>
                      <select
                        className="form-select form-select-lg"
                        id="role"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        style={{ 
                          borderRadius: '12px',
                          border: '2px solid #e9ecef',
                          padding: '12px 16px',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="student">🎓 Student - View your exam results</option>
                        <option value="lecturer">👨‍🏫 Lecturer - Manage all exam results</option>
                      </select>
                      <div className="form-text mt-2">
                        <i className="fas fa-lightbulb me-1"></i>
                        <strong>To test lecturer features:</strong> Select "Lecturer" and sign up with any email.
                        <br />
                        <i className="fas fa-info-circle me-1"></i>
                        <strong>Note:</strong> Lecturer accounts can manage all exam results and add new students.
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100 mb-4"
                    disabled={loading || !email || !password}
                    style={{ 
                      borderRadius: '12px',
                      padding: '14px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        {isSignUp ? 'Creating Account...' : 'Signing In...'}
                      </>
                    ) : (
                      <>
                        <i className={`fas ${isSignUp ? 'fa-user-plus' : 'fa-sign-in-alt'} me-2`}></i>
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </>
                    )}
                  </button>
                </form>

                {/* Toggle Sign Up/Login */}
                <div className="text-center">
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                      setSuccessMessage('');
                    }}
                    style={{ 
                      color: '#667eea',
                      fontWeight: '500'
                    }}
                  >
                    <i className={`fas ${isSignUp ? 'fa-sign-in-alt' : 'fa-user-plus'} me-2`}></i>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>

                {/* Quick Test Accounts */}
                {!isSignUp && (
                  <div className="mt-4 p-4" style={{ 
                    backgroundColor: '#f8f9fa',
                    borderRadius: '16px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h6 className="mb-3 fw-semibold text-center">
                      <i className="fas fa-flask me-2 text-primary"></i>Quick Test Accounts
                    </h6>
                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => handleQuickLogin('teststudent@gmail.com', 'password123')}
                        style={{ borderRadius: '8px', padding: '10px' }}
                      >
                        <i className="fas fa-user-graduate me-2"></i>
                        Login as Student (teststudent@gmail.com)
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={() => handleQuickLogin('john.doe@student.com', 'password123')}
                        style={{ borderRadius: '8px', padding: '10px' }}
                      >
                        <i className="fas fa-user me-2"></i>
                        Login as Sample Student (john.doe@student.com)
                      </button>
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm"
                      onClick={handleCreateLecturerAccount}
                      disabled={loading}
                      style={{ borderRadius: '8px', padding: '10px' }}
                    >
                      <i className="fas fa-chalkboard-teacher me-2"></i>
                      {loading ? 'Creating...' : 'Create Lecturer Account'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-info btn-sm"
                      onClick={() => handleQuickLogin('newlecturer@test.com', 'password123')}
                      style={{ borderRadius: '8px', padding: '10px' }}
                    >
                      <i className="fas fa-sign-in-alt me-2"></i>
                      Login as New Lecturer (newlecturer@test.com)
                    </button>
                    </div>
                    <div className="text-center mt-3">
                      <small className="text-muted">
                        <i className="fas fa-info-circle me-1"></i>
                        Use these accounts to test different user roles
                      </small>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-4">
              <p className="text-white-50 mb-0">
                <i className="fas fa-shield-alt me-2"></i>
                Secure authentication powered by Supabase
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;