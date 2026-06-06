import { useState } from 'react'
import { Heart, Mail, User, LogIn, UserPlus } from 'lucide-react'
import { login, register, getStoredEmail } from '../utils/storage'
import './AuthScreen.css'

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState(getStoredEmail())
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      if (mode === 'login') {
        await login(email)
      } else {
        if (!name.trim()) {
          setError('Name is required')
          setLoading(false)
          return
        }
        await register(name, email)
      }
      onAuth()
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
        
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            <LogIn size={16} /> Login
          </button>
          <button 
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            <UserPlus size={16} /> Register
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="auth-field">
              <label><User size={16} /> Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}
          
          <div className="auth-field">
            <label><Mail size={16} /> Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Your data is stored securely in PostgreSQL</p>
        </div>
      </div>
    </div>
  )
}
