import { useState } from 'react'
import { Heart, Mail, User, LogIn, UserPlus, Lock, Phone, Calendar, Eye, EyeOff, KeyRound } from 'lucide-react'
import { login, register, forgotPassword, getStoredEmail, setStoredEmail } from '../utils/storage'
import './AuthScreen.css'

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 100 }, (_, i) => currentYear - i)

export default function AuthScreen({ onAuth, onPasswordResetRequired }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState(getStoredEmail())
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [yearOfBirth, setYearOfBirth] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const resetForm = () => {
    setPassword('')
    setName('')
    setGender('')
    setYearOfBirth('')
    setMobile('')
    setError('')
    setSuccessMessage('')
  }

  const handleTabChange = (newMode) => {
    setMode(newMode)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      if (mode === 'login') {
        const result = await login(email, password)
        if (result.needsPasswordReset) {
          onPasswordResetRequired()
        } else {
          onAuth()
        }
      } else if (mode === 'register') {
        const result = await register({
          name,
          email,
          password,
          gender,
          yearOfBirth: parseInt(yearOfBirth),
          mobile: mobile || undefined,
        })
        onAuth()
      } else if (mode === 'forgot') {
        await forgotPassword(email)
        setSuccessMessage('Check your email for a temporary password')
        setMode('login')
        setPassword('')
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Heart size={32} />
          </div>
          <h1>BP Tracker</h1>
          <p>Track your blood pressure and weight readings</p>
        </div>
        
        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => handleTabChange('login')}
            >
              <LogIn size={16} /> Login
            </button>
            <button 
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => handleTabChange('register')}
            >
              <UserPlus size={16} /> Register
            </button>
          </div>
        )}
        
        {mode === 'forgot' && (
          <div className="auth-tabs">
            <button className="auth-tab active">
              <KeyRound size={16} /> Reset Password
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="auth-field">
                <label><User size={16} /> Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              
              <div className="auth-field">
                <label><Calendar size={16} /> Gender *</label>
                <div className="gender-select">
                  {GENDERS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      className={`gender-btn ${gender === g.value ? 'selected' : ''}`}
                      onClick={() => setGender(g.value)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="auth-field">
                <label><Calendar size={16} /> Year of Birth *</label>
                <select 
                  value={yearOfBirth} 
                  onChange={e => setYearOfBirth(e.target.value)}
                  required
                  className="year-select"
                >
                  <option value="">Select year</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          <div className="auth-field">
            <label><Mail size={16} /> Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          
          {mode !== 'forgot' && (
            <div className="auth-field">
              <label><Lock size={16} /> Password *</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          
          {mode === 'register' && (
            <div className="auth-field">
              <label><Phone size={16} /> Mobile (optional)</label>
              <input
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
          )}
          
          {error && <div className="auth-error">{error}</div>}
          {successMessage && <div className="auth-success">{successMessage}</div>}
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : 
              mode === 'login' ? 'Sign In' : 
              mode === 'forgot' ? 'Send Reset Link' : 
              'Create Account'}
          </button>
        </form>
        
        {mode === 'login' && (
          <div className="auth-footer">
            <button 
              className="forgot-link"
              onClick={() => handleTabChange('forgot')}
            >
              Forgot password?
            </button>
          </div>
        )}
        
        {mode === 'forgot' && (
          <div className="auth-footer">
            <button 
              className="forgot-link"
              onClick={() => handleTabChange('login')}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}