import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  const [passwordStrength, setPasswordStrength] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isSignUp) {
        // Password validation
        const passwordRequirements = [
          { regex: /.{8,}/, message: 'Password must be at least 8 characters.' },
          { regex: /[A-Z]/, message: 'Password must contain an uppercase letter.' },
          { regex: /[a-z]/, message: 'Password must contain a lowercase letter.' },
          { regex: /[0-9]/, message: 'Password must contain a number.' },
          { regex: /[!@#$%^&*(),.?":{}|<>]/, message: 'Password must contain a special character.' },
          { regex: /^(?!.*(123456|qwerty|password|admin|letmein|yourname)).*$/, message: 'Password should not contain obvious patterns or dictionary words.' }
        ];
        for (const req of passwordRequirements) {
          if (!req.regex.test(password)) {
            setError(`❌ ${req.message}`);
            setLoading(false);
            return;
          }
        }

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

          // If user is a student, also add them to the students table
          if (selectedRole === 'student') {
            const studentName = data.user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const { error: studentError } = await supabase
              .from('students')
              .upsert({
                name: studentName,
                email: data.user.email
              });
            if (studentError) {
              console.error('Error adding student to students table:', studentError);
            } else {
              console.log('Student added to students table successfully');
            }
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
        if (error) throw error;

        // After successful login, check if user has a role assigned
        if (data.user) {
              const { error: roleError } = await supabase
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

  const handleQuickLogin = (email, password) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div 
      className="min-vh-100 d-flex"
      style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      {/* Left Side - Branding */}
      <div className="col-lg-6 d-none d-lg-flex align-items-center justify-content-center text-white p-5">
        <div className="text-center">
          <div 
            className="d-inline-flex align-items-center justify-content-center mb-4"
            style={{
              width: '120px',
              height: '120px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '30px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            <i className="fas fa-graduation-cap" style={{ fontSize: '3.5rem' }}></i>
          </div>
          <h1 className="display-4 fw-bold mb-4">Online Exam Repository</h1>
          <p className="lead mb-4">Streamline your academic journey with our comprehensive exam management system</p>
          <div className="row text-center">
            <div className="col-4">
              <i className="fas fa-chart-line fa-2x mb-2"></i>
              <p className="small">Track Progress</p>
            </div>
            <div className="col-4">
              <i className="fas fa-file-pdf fa-2x mb-2"></i>
              <p className="small">Export Results</p>
            </div>
            <div className="col-4">
              <i className="fas fa-users fa-2x mb-2"></i>
              <p className="small">Manage Students</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
        <div className="w-100" style={{ maxWidth: '450px' }}>
          <div 
            className="card border-0 shadow-lg"
            style={{ 
              borderRadius: '25px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="card-body p-5">
              {/* Mobile Header */}
              <div className="text-center mb-4 d-lg-none">
                <div 
                  className="d-inline-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: '70px',
                    height: '70px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '18px'
                  }}
                >
                  <i className="fas fa-graduation-cap text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
                <h3 className="fw-bold text-dark">Online Exam Repository</h3>
              </div>

              {/* Welcome Message */}
              <div className="text-center mb-4">
                <h2 className="fw-bold text-dark mb-2">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="text-muted">{isSignUp ? 'Join our academic community' : 'Sign in to access your dashboard'}</p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="alert alert-success d-flex align-items-center mb-4" role="alert">
                  <i className="fas fa-check-circle me-2"></i>
                  {successMessage}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="form-label fw-semibold text-dark" aria-label="Email Address">
                    <i className="fas fa-envelope me-2 text-primary" aria-hidden="true"></i>Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required="true"
                    aria-label="Enter your email address"
                    style={{ 
                      borderRadius: '15px',
                      border: '2px solid #e9ecef',
                      padding: '15px 20px'
                    }}
                    placeholder="Enter your email"
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="form-label fw-semibold text-dark" aria-label="Password">
                    <i className="fas fa-lock me-2 text-primary" aria-hidden="true"></i>Password
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      // Password strength logic
                      const val = e.target.value;
                      let strength = '';
                      if (val.length < 8) strength = 'Too short';
                      else if (!/[A-Z]/.test(val)) strength = 'Add uppercase letter';
                      else if (!/[a-z]/.test(val)) strength = 'Add lowercase letter';
                      else if (!/[0-9]/.test(val)) strength = 'Add number';
                      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(val)) strength = 'Add special character';
                      else if (/(123456|qwerty|password|admin|letmein|yourname)/i.test(val)) strength = 'Avoid common words';
                      else strength = 'Strong';
                      setPasswordStrength(strength);
                    }}
                    required
                    aria-required="true"
                    aria-label="Enter your password"
                    style={{ 
                      borderRadius: '15px',
                      border: '2px solid #e9ecef',
                      padding: '15px 20px'
                    }}
                    placeholder="Enter your password"
                  />
                  {isSignUp && password && (
                    <div className={`mt-1 small ${passwordStrength === 'Strong' ? 'text-success' : 'text-danger'}`}>{passwordStrength}</div>
                  )}
                  {!isSignUp && (
                    <div className="text-end mt-2">
                      <Link
                        to="/forgot-password"
                        className="text-decoration-none small"
                        style={{ color: '#667eea' }}
                      >
                        <i className="fas fa-key me-1"></i>
                        Forgot Password?
                      </Link>
                    </div>
                  )}
                </div>

                {/* Role Selection for Sign Up */}
                {isSignUp && (
                  <div className="mb-4">
                    <label htmlFor="role" className="form-label fw-semibold text-dark">
                      <i className="fas fa-user-tag me-2 text-primary"></i>Account Type
                    </label>
                    <select
                      className="form-select form-select-lg"
                      id="role"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      style={{ 
                        borderRadius: '15px',
                        border: '2px solid #e9ecef',
                        padding: '15px 20px'
                      }}
                    >
                      <option value="student">🎓 Student</option>
                      <option value="lecturer">👨‍🏫 Lecturer</option>
                    </select>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-lg w-100 text-white fw-bold mb-4"
                  aria-label={isSignUp ? "Create Account" : "Sign In"}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '15px',
                    padding: '15px',
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
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
              <div className="text-center mb-4">
                <button
                  type="button"
                  className="btn btn-link text-decoration-none fw-semibold"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setSuccessMessage('');
                  }}
                  style={{ color: '#667eea' }}
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'Don\'t have an account? Sign Up'}
                </button>
              </div>

              {/* Quick Login Buttons */}
              {!isSignUp && (
                <div className="border-top pt-4">
                  <p className="text-center text-muted mb-3">
                    <small><i className="fas fa-rocket me-1"></i>Quick Demo Access</small>
                  </p>
                  <div className="d-grid gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => handleQuickLogin('john.doe@student.com', 'password123')}
                      style={{ borderRadius: '10px' }}
                    >
                      <i className="fas fa-user-graduate me-2"></i>Demo Student
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm"
                      onClick={() => handleQuickLogin('teststudent@gmail.com', 'password123')}
                      style={{ borderRadius: '10px' }}
                    >
                      <i className="fas fa-user me-2"></i>Test Student
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm"
                      onClick={() => handleQuickLogin('testlecturer@test.com', 'password123')}
                      style={{ borderRadius: '10px' }}
                    >
                      <i className="fas fa-chalkboard-teacher me-2"></i>Test Lecturer
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <small className="text-muted">
                      <i className="fas fa-info-circle me-1"></i>
                      Use demo accounts above or create your own account
                    </small>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
