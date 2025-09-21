import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import StudentDashboard from './components/StudentDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const getSession = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.log('Session check timeout, defaulting to no user');
          setUser(null);
          setLoading(false);
        }, 5000); // 5 second timeout

        const { data: { session }, error } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        
        if (error) throw error;
        if (session?.user) {
          // Quick role fetch with timeout
          const rolePromise = supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          // Race between role fetch and timeout
          const raceResult = await Promise.race([
            rolePromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Role fetch timeout')), 3000)
            )
          ]);

          if (raceResult.error) {
            console.log('Role fetch error, defaulting to student:', raceResult.error.message);
            setUser({ ...session.user, role: 'student' });
          } else {
            console.log('User role found:', raceResult.data?.role);
            setUser({ ...session.user, role: raceResult.data?.role || 'student' });
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        console.log('Session error, defaulting to no user:', e.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('Auth state change event:', _event);
        setLoading(true);
        
        try {
          if (session?.user) {
            // Quick role fetch for auth changes
            setTimeout(async () => {
              try {
                const { data: userData, error: roleError } = await supabase
                  .from('users')
                  .select('role')
                  .eq('id', session.user.id)
                  .single();
                
                if (roleError) {
                  console.log('Auth change - Role fetch error, defaulting to student');
                  setUser({ ...session.user, role: 'student' });
                } else {
                  console.log('Auth change - User role found:', userData?.role);
                  setUser({ ...session.user, role: userData?.role || 'student' });
                }
              } catch (e) {
                console.log('Auth change error, defaulting to student');
                setUser({ ...session.user, role: 'student' });
              } finally {
                setLoading(false);
              }
            }, 100); // Small delay to prevent race conditions
          } else {
            setUser(null);
            setLoading(false);
          }
        } catch (e) {
          console.error('Auth state change error:', e?.message || e);
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to={user.role === 'student' ? '/student' : '/lecturer'} /> : <Login />} 
          />
          <Route 
            path="/forgot-password" 
            element={user ? <Navigate to={user.role === 'student' ? '/student' : '/lecturer'} /> : <ForgotPassword />} 
          />
          <Route 
            path="/reset-password" 
            element={user ? <Navigate to={user.role === 'student' ? '/student' : '/lecturer'} /> : <ResetPassword />} 
          />
          <Route 
            path="/student" 
            element={user && user.role === 'student' ? <StudentDashboard user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/lecturer" 
            element={user && (user.role === 'lecturer' || user.role === 'admin') ? <LecturerDashboard user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={user ? (user.role === 'student' ? '/student' : '/lecturer') : '/login'} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
