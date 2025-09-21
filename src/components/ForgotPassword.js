import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const siteUrl = process.env.REACT_APP_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
      });

      if (error) throw error;

      setMessage('🎉 Password reset email sent! Please check your email inbox and spam folder for the reset link.');
      setEmail(''); // Clear the form
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
            <i className="fas fa-key" style={{ fontSize: '3.5rem' }}></i>
          </div>
          <h1 className="display-4 fw-bold mb-4">Password Recovery</h1>
          <p className="lead mb-4">Don't worry, we'll help you get back into your account securely</p>
          <div className="row text-center">
            <div className="col-4">
              <i className="fas fa-envelope fa-2x mb-2"></i>
              <p className="small">Email Verification</p>
            </div>
            <div className="col-4">
              <i className="fas fa-shield-alt fa-2x mb-2"></i>
              <p className="small">Secure Process</p>
            </div>
            <div className="col-4">
              <i className="fas fa-clock fa-2x mb-2"></i>
              <p className="small">Quick Recovery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Forgot Password Form */}
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
                  <i className="fas fa-key text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
                <h3 className="fw-bold text-dark">Password Recovery</h3>
              </div>

              {/* Header */}
              <div className="text-center mb-4">
                <h2 className="fw-bold text-dark mb-2">Forgot Password?</h2>
                <p className="text-muted">Enter your email address and we'll send you a link to reset your password</p>
              </div>

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
                  <label htmlFor="email" className="form-label fw-semibold text-dark">
                    <i className="fas fa-envelope me-2 text-primary"></i>Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ 
                      borderRadius: '15px',
                      border: '2px solid #e9ecef',
                      padding: '15px 20px'
                    }}
                    placeholder="Enter your registered email"
                  />
                  <div className="form-text text-muted mt-2">
                    <i className="fas fa-info-circle me-1"></i>
                    We'll send a password reset link to this email address
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-lg w-100 text-white fw-bold mb-4"
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
                      Sending Reset Link...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane me-2"></i>
                      Send Reset Link
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

              {/* Help Text */}
              <div className="border-top pt-4 mt-4">
                <div className="text-center">
                  <small className="text-muted">
                    <i className="fas fa-question-circle me-1"></i>
                    Having trouble? The reset link will be valid for 1 hour.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
