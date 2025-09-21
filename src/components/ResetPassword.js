import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Detect whether there's a valid recovery session from the email link
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        // First, try to get the current session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session check error:', error);
        }

        if (!mounted) return;

        const hasSession = !!data?.session?.user;
        console.log('Session check result:', { hasSession, user: data?.session?.user, error });

        setHasRecoverySession(hasSession);

        // If no session, check if we have URL parameters that need processing
        if (!hasSession) {
          console.log('No session found, checking URL for recovery parameters...');
          const urlParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          const type = urlParams.get('type');

          console.log('URL parameters:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

          if (accessToken && type === 'recovery') {
            console.log('Recovery tokens found in URL, setting session...');
            // Set the session with the tokens from the URL
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (setSessionError) {
              console.error('Set session error:', setSessionError);
            } else {
              console.log('Session set successfully from URL tokens');
              // Re-check session after setting it
              const { data: newData } = await supabase.auth.getSession();
              if (!mounted) return;
              const hasNewSession = !!newData?.session?.user;
              console.log('Session after setting:', hasNewSession);
              setHasRecoverySession(hasNewSession);
            }
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (!mounted) return;
        setHasRecoverySession(false);
      }
    };

    // Small delay to ensure Supabase has processed the URL hash
    const t = setTimeout(checkSession, 500);

    // Also listen for auth events
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event, !!session?.user);
      if (!mounted) return;
      setHasRecoverySession(!!session?.user);
    });

    return () => {
      mounted = false;
      clearTimeout(t);
      listener.subscription.unsubscribe();
    };
  }, []);

  const validatePassword = (password) => {
    const requirements = [
      { regex: /.{8,}/, message: 'Password must be at least 8 characters.' },
      { regex: /[A-Z]/, message: 'Password must contain an uppercase letter.' },
      { regex: /[a-z]/, message: 'Password must contain a lowercase letter.' },
      { regex: /[0-9]/, message: 'Password must contain a number.' },
      { regex: /[!@#$%^&*(),.?":{}|<>]/, message: 'Password must contain a special character.' },
      { regex: /^(?!.*(123456|qwerty|password|admin|letmein|yourname)).*$/, message: 'Password should not contain obvious patterns or dictionary words.' }
    ];

    for (const req of requirements) {
      if (!req.regex.test(password)) {
        return req.message;
      }
    }
    return null;
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    
    // Password strength logic
    let strength = '';
    if (val.length < 8) strength = 'Too short';
    else if (!/[A-Z]/.test(val)) strength = 'Add uppercase letter';
    else if (!/[a-z]/.test(val)) strength = 'Add lowercase letter';
    else if (!/[0-9]/.test(val)) strength = 'Add number';
    else if (!/[!@#$%^&*(),.?":{}|<>]/.test(val)) strength = 'Add special character';
    else if (/(123456|qwerty|password|admin|letmein|yourname)/i.test(val)) strength = 'Avoid common words';
    else strength = 'Strong';
    setPasswordStrength(strength);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Ensure the page was opened from the password reset email link
    if (!hasRecoverySession) {
      setError('❌ This page must be opened from the password reset email link. Please request a new link.');
      setLoading(false);
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(`❌ ${passwordError}`);
      setLoading(false);
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError('❌ Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage('🎉 Password updated successfully! Redirecting to login...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      setError(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
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
            <i className="fas fa-lock" style={{ fontSize: '3.5rem' }}></i>
          </div>
          <h1 className="display-4 fw-bold mb-4">Reset Password</h1>
          <p className="lead mb-4">Create a new secure password for your account</p>
          <div className="row text-center">
            <div className="col-4">
              <i className="fas fa-shield-alt fa-2x mb-2"></i>
              <p className="small">Secure</p>
            </div>
            <div className="col-4">
              <i className="fas fa-key fa-2x mb-2"></i>
              <p className="small">Encrypted</p>
            </div>
            <div className="col-4">
              <i className="fas fa-check-circle fa-2x mb-2"></i>
              <p className="small">Protected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Reset Password Form */}
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
                  <i className="fas fa-lock text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
                <h3 className="fw-bold text-dark">Reset Password</h3>
              </div>

              {/* Header */}
              <div className="text-center mb-4">
                <h2 className="fw-bold text-dark mb-2">Create New Password</h2>
                <p className="text-muted">Enter a strong password to secure your account</p>
              </div>

              {/* Recovery Session Warning Banner */}
              {!hasRecoverySession && (
                <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <div>
                    <strong>Access Required</strong>
                    <br />
                    <small>This page must be opened from the password reset email link. The link is valid for 1 hour.</small>
                    <br />
                    <Link to="/forgot-password" className="btn btn-sm btn-outline-warning mt-2">
                      <i className="fas fa-envelope me-1"></i>
                      Request New Reset Link
                    </Link>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
              {message && (
                <div className="alert alert-success d-flex align-items-center mb-4" role="alert">
                  <i className="fas fa-check-circle me-2"></i>
                  {message}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="password" className="form-label fw-semibold text-dark">
                    <i className="fas fa-lock me-2 text-primary"></i>New Password
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    style={{ 
                      borderRadius: '15px',
                      border: '2px solid #e9ecef',
                      padding: '15px 20px'
                    }}
                    placeholder="Enter your new password"
                  />
                  {password && (
                    <div className={`mt-1 small ${passwordStrength === 'Strong' ? 'text-success' : 'text-danger'}`}>
                      <i className={`fas ${passwordStrength === 'Strong' ? 'fa-check' : 'fa-times'} me-1`}></i>
                      {passwordStrength}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmPassword" className="form-label fw-semibold text-dark">
                    <i className="fas fa-lock me-2 text-primary"></i>Confirm New Password
                  </label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ 
                      borderRadius: '15px',
                      border: '2px solid #e9ecef',
                      padding: '15px 20px'
                    }}
                    placeholder="Confirm your new password"
                  />
                  {confirmPassword && (
                    <div className={`mt-1 small ${password === confirmPassword ? 'text-success' : 'text-danger'}`}>
                      <i className={`fas ${password === confirmPassword ? 'fa-check' : 'fa-times'} me-1`}></i>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                {/* Password Requirements */}
                <div className="mb-4">
                  <small className="text-muted">
                    <strong>Password Requirements:</strong>
                    <ul className="mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
                      <li>At least 8 characters long</li>
                      <li>Contains uppercase and lowercase letters</li>
                      <li>Contains at least one number</li>
                      <li>Contains at least one special character</li>
                    </ul>
                  </small>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || passwordStrength !== 'Strong' || password !== confirmPassword}
                  className="btn btn-lg w-100 text-white fw-bold mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '15px',
                    padding: '15px',
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                    opacity: (loading || passwordStrength !== 'Strong' || password !== confirmPassword) ? 0.7 : 1
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      Update Password
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <div className="text-center">
                <Link
                  to="/login"
                  className="btn btn-link text-decoration-none fw-semibold d-flex align-items-center justify-content-center"
                  style={{ color: '#667eea' }}
                >
                  <i className="fas fa-arrow-left me-2"></i>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
