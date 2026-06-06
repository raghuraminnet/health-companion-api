import { useState } from 'react'
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { resetPassword } from '../utils/storage'
import './AuthScreen.css'

export default function PasswordResetScreen({ onComplete }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    setLoading(true)
    try {
      await resetPassword(newPassword)
      onComplete()
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" style={{ background: '#ef4444' }}>
            <AlertTriangle size={32} />
          </div>
          <h1>Reset Password</h1>
          <p>You must set a new password before continuing</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label><Lock size={16} /> New Password *</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
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
          
          <div className="auth-field">
            <label><Lock size={16} /> Confirm Password *</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </div>
          </div>
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Setting password...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}