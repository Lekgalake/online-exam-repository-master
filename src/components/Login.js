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
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated Background */}
      <div className="animated-background">
        <div className="wave"></div>
        <div className="wave"></div>
        <div className="wave"></div>
      </div>

      {/* Left Side - Branding */}
      <div className="col-lg-6 d-none d-lg-flex align-items-center justify-content-center text-white p-5 position-relative">
        <div className="text-center" style={{ zIndex: 1 }}>
          <div 
            className="brand-logo mb-4"
            style={{
              width: '140px',
              height: '140px',
              margin: '0 auto',
              position: 'relative'
            }}
          >
            <div className="logo-bg"></div>
            <i className="fas fa-graduation-cap position-relative" style={{ 
              fontSize: '3.5rem',
              zIndex: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}></i>
          </div>
          
          <h1 className="display-4 fw-bold mb-4 text-gradient">Online Exam Repository</h1>
          <p className="lead mb-5" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Streamline your academic journey with our comprehensive exam management system
          </p>
          
          <div className="row g-4 text-center feature-grid">
            <div className="col-4">
              <div className="feature-item">
                <div className="feature-icon">
                  <i className="fas fa-chart-line"></i>
                </div>
                <p className="mb-0">Track Progress</p>
              </div>
            </div>
            <div className="col-4">
              <div className="feature-item">
                <div className="feature-icon">
                  <i className="fas fa-file-pdf"></i>
                </div>
                <p className="mb-0">Export Results</p>
              </div>
            </div>
            <div className="col-4">
              <div className="feature-item">
                <div className="feature-icon">
                  <i className="fas fa-users"></i>
                </div>
                <p className="mb-0">Manage Students</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          .animated-background {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            overflow: hidden;
          }
          
          .wave {
            position: absolute;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1));
            border-radius: 45%;
            animation: wave 20s infinite linear;
            top: -50%;
            left: -50%;
          }
          
          .wave:nth-child(2) {
            animation-duration: 17s;
            opacity: 0.3;
          }
          
          .wave:nth-child(3) {
            animation-duration: 25s;
            opacity: 0.2;
          }
          
          @keyframes wave {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .brand-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            animation: float 6s ease-in-out infinite;
          }
          
          .logo-bg {
            position: absolute;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 35px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transform: rotate(-5deg);
            transition: transform 0.3s ease;
          }
          
          .brand-logo:hover .logo-bg {
            transform: rotate(5deg);
          }
          
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
            100% { transform: translateY(0px); }
          }
          
          .text-gradient {
            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 2s infinite linear;
          }
          
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          
          .feature-grid {
            margin-top: 3rem;
          }
          
          .feature-item {
            padding: 1.5rem;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
          }
          
          .feature-item:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.15);
          }
          
          .feature-icon {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: rgba(255, 255, 255, 0.9);
            transition: transform 0.3s ease;
          }
          
          .feature-item:hover .feature-icon {
            transform: scale(1.1);
          }
        `}
      </style>

      {/* Right Side - Login Form */}
      <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
        <div className="w-100" style={{ maxWidth: '450px' }}>
          <div 
            className="card border-0 login-card"
            style={{ 
              borderRadius: '30px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div className="card-shape-top"></div>
            <div className="card-shape-bottom"></div>
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
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group mb-4">
                  <div className="input-group input-group-lg custom-input-group">
                    <div className="input-group-prepend">
                      <span className="input-group-text">
                        <i className="fas fa-envelope"></i>
                      </span>
                    </div>
                    <div className="form-floating flex-grow-1">
                      <input
                        type="email"
                        className="form-control custom-input"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        aria-required="true"
                        aria-label="Enter your email address"
                        placeholder="Enter your email"
                      />
                      <label htmlFor="email">Email Address</label>
                      <div className="input-highlight"></div>
                    </div>
                    <div className="input-validation">
                      {email && !email.includes('@') && (
                        <i className="fas fa-exclamation-circle text-danger"></i>
                      )}
                      {email && email.includes('@') && (
                        <i className="fas fa-check-circle text-success"></i>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group mb-4">
                  <div className="input-group input-group-lg custom-input-group">
                    <div className="input-group-prepend">
                      <span className="input-group-text">
                        <i className="fas fa-lock"></i>
                      </span>
                    </div>
                    <div className="form-floating flex-grow-1">
                      <input
                        type="password"
                        className="form-control custom-input"
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
                        placeholder="Enter your password"
                      />
                      <label htmlFor="password">Password</label>
                      <div className="input-highlight"></div>
                    </div>
                    <div className="input-validation">
                      {password && (
                        passwordStrength === 'Strong' 
                          ? <i className="fas fa-check-circle text-success"></i>
                          : <i className="fas fa-exclamation-circle text-warning"></i>
                      )}
                    </div>
                  </div>
                  {isSignUp && password && (
                    <div className="password-strength mt-2">
                      <div className="strength-meter">
                        <div 
                          className={`strength-bar ${
                            password.length === 0 ? '' :
                            passwordStrength === 'Strong' ? 'bg-success' :
                            passwordStrength === 'Too short' ? 'bg-danger' :
                            'bg-warning'
                          }`}
                          style={{
                            width: password.length === 0 ? '0%' :
                                   passwordStrength === 'Strong' ? '100%' :
                                   passwordStrength === 'Too short' ? '20%' :
                                   '60%'
                          }}
                        ></div>
                      </div>
                      <small className={`
                        ${passwordStrength === 'Strong' ? 'text-success' : 
                          passwordStrength === 'Too short' ? 'text-danger' : 
                          'text-warning'}
                      `}>
                        <i className={`fas fa-${
                          passwordStrength === 'Strong' ? 'check-circle' :
                          passwordStrength === 'Too short' ? 'times-circle' :
                          'exclamation-circle'
                        } me-1`}></i>
                        {passwordStrength}
                      </small>
                    </div>
                  )}
                  {!isSignUp && (
                    <div className="text-end mt-2">
                      <Link
                        to="/forgot-password"
                        className="text-decoration-none small forgot-password-link"
                      >
                        <i className="fas fa-key me-1"></i>
                        Forgot Password?
                      </Link>
                    </div>
                  )}
                </div>

                <style>
                  {`
                    .custom-input-group {
                      position: relative;
                      border-radius: 15px;
                      background: white;
                      transition: all 0.3s ease;
                    }

                    .custom-input-group:focus-within {
                      transform: translateY(-2px);
                      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.25);
                    }

                    .custom-input-group .input-group-text {
                      background: white;
                      border: none;
                      border-radius: 15px 0 0 15px;
                      color: #667eea;
                      font-size: 1.2rem;
                      padding: 0.75rem 1rem;
                      transition: all 0.3s ease;
                    }

                    .custom-input-group:focus-within .input-group-text {
                      color: #764ba2;
                    }

                    .custom-input {
                      border: 2px solid #e9ecef;
                      border-radius: 0 15px 15px 0 !important;
                      font-size: 1rem;
                      padding: 1.5rem 1rem 0.5rem 1rem;
                      transition: all 0.3s ease;
                      background: white;
                    }

                    .custom-input:focus {
                      border-color: #667eea;
                      box-shadow: none;
                      outline: none;
                    }

                    .form-floating label {
                      padding: 1rem 0.75rem;
                      color: #6c757d;
                      transition: all 0.3s ease;
                    }

                    .form-floating > .form-control:focus ~ label,
                    .form-floating > .form-control:not(:placeholder-shown) ~ label {
                      transform: scale(0.85) translateY(-0.5rem);
                      color: #667eea;
                    }

                    .input-validation {
                      position: absolute;
                      right: 1rem;
                      top: 50%;
                      transform: translateY(-50%);
                      z-index: 10;
                      font-size: 1.1rem;
                      transition: all 0.3s ease;
                    }

                    .password-strength {
                      margin-top: 0.5rem;
                    }

                    .strength-meter {
                      height: 4px;
                      background: #e9ecef;
                      border-radius: 2px;
                      margin-bottom: 0.5rem;
                      overflow: hidden;
                    }

                    .strength-bar {
                      height: 100%;
                      transition: all 0.3s ease;
                    }

                    .forgot-password-link {
                      color: #667eea;
                      transition: all 0.3s ease;
                      display: inline-flex;
                      align-items: center;
                      font-weight: 500;
                    }

                    .forgot-password-link:hover {
                      color: #764ba2;
                      transform: translateX(3px);
                    }
                  `}
                </style>

                {/* Role Selection for Sign Up */}
                {isSignUp && (
                  <div className="form-floating mb-4">
                    <div className="input-group">
                      <span className="input-group-text bg-transparent border-end-0">
                        <i className="fas fa-user-tag text-primary"></i>
                      </span>
                      <select
                        className="form-select form-select-lg border-start-0"
                        id="role"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        required
                      >
                        <option value="student">🎓 Student</option>
                        <option value="lecturer">👨‍🏫 Lecturer</option>
                      </select>
                      <label htmlFor="role" className="ps-5">Account Type</label>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-lg w-100 text-white fw-bold mb-4 submit-button"
                  aria-label={isSignUp ? "Create Account" : "Sign In"}
                >
                  <div className="button-content">
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        <span className="button-text">{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                      </>
                    ) : (
                      <>
                        <i className={`fas ${isSignUp ? 'fa-user-plus' : 'fa-sign-in-alt'} me-2`}></i>
                        <span className="button-text">{isSignUp ? 'Create Account' : 'Sign In'}</span>
                      </>
                    )}
                  </div>
                </button>

                <style>
                  {`
                    .card-shape-top {
                      position: absolute;
                      top: -50px;
                      right: -50px;
                      width: 100px;
                      height: 100px;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      border-radius: 50%;
                      opacity: 0.1;
                    }

                    .card-shape-bottom {
                      position: absolute;
                      bottom: -50px;
                      left: -50px;
                      width: 150px;
                      height: 150px;
                      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
                      border-radius: 50%;
                      opacity: 0.1;
                    }

                    .login-card {
                      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
                      transform: translateY(0);
                      transition: all 0.3s ease;
                    }

                    .login-card:hover {
                      transform: translateY(-5px);
                      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    }

                    .login-form .form-floating {
                      position: relative;
                    }

                    .login-form .form-control,
                    .login-form .form-select {
                      height: 60px;
                      border-radius: 15px;
                      border: 2px solid #e9ecef;
                      padding-left: 45px;
                      transition: all 0.3s ease;
                      font-size: 1rem;
                    }

                    .login-form .form-control:focus,
                    .login-form .form-select:focus {
                      border-color: #667eea;
                      box-shadow: 0 0 0 0.25rem rgba(102, 126, 234, 0.25);
                    }

                    .login-form .input-group-text {
                      border-radius: 15px 0 0 15px;
                      border: 2px solid #e9ecef;
                      border-right: none;
                      padding: 0 15px;
                      min-width: 50px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    }

                    .login-form .form-floating label {
                      padding-left: 50px;
                    }

                    .submit-button {
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      border: none;
                      border-radius: 15px;
                      padding: 15px;
                      position: relative;
                      overflow: hidden;
                      transition: all 0.3s ease;
                      transform: translateY(0);
                    }

                    .submit-button:not(:disabled):hover {
                      transform: translateY(-2px);
                      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                    }

                    .submit-button:not(:disabled):active {
                      transform: translateY(0);
                    }

                    .button-content {
                      position: relative;
                      z-index: 1;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    }

                    .submit-button::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
                      opacity: 0;
                      transition: opacity 0.3s ease;
                    }

                    .submit-button:not(:disabled):hover::before {
                      opacity: 1;
                    }

                    .button-text {
                      display: inline-block;
                      transition: transform 0.3s ease;
                    }

                    .submit-button:not(:disabled):hover .button-text {
                      transform: scale(1.05);
                    }

                    /* Error and Success Alerts */
                    .alert {
                      border: none;
                      border-radius: 15px;
                      padding: 1rem;
                      margin-bottom: 1.5rem;
                      position: relative;
                      overflow: hidden;
                      animation: slideIn 0.3s ease-out;
                    }

                    .alert-success {
                      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                      color: white;
                    }

                    .alert-danger {
                      background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
                      color: white;
                    }

                    @keyframes slideIn {
                      from {
                        transform: translateY(-100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateY(0);
                        opacity: 1;
                      }
                    }

                    /* Quick Login Buttons */
                    .btn-outline-primary {
                      border: 2px solid #667eea;
                      color: #667eea;
                      transition: all 0.3s ease;
                    }

                    .btn-outline-primary:hover {
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      border-color: transparent;
                      transform: translateY(-2px);
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    }

                    .btn-outline-success {
                      border: 2px solid #48bb78;
                      color: #48bb78;
                    }

                    .btn-outline-success:hover {
                      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                      border-color: transparent;
                      transform: translateY(-2px);
                      box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
                    }

                    .btn-outline-warning {
                      border: 2px solid #ecc94b;
                      color: #ecc94b;
                    }

                    .btn-outline-warning:hover {
                      background: linear-gradient(135deg, #ecc94b 0%, #d69e2e 100%);
                      border-color: transparent;
                      transform: translateY(-2px);
                      box-shadow: 0 4px 15px rgba(236, 201, 75, 0.3);
                    }
                  `}
                </style>
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
