import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Compass,
  ArrowLeft,
  Shield,
  Info
} from 'lucide-react';
import { NavRoute } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onNavigate: (route: NavRoute) => void;
  initialMode?: 'signin' | 'signup';
}

const AVATAR_OPTIONS = [
  { emoji: '🎓', label: 'Scholar' },
  { emoji: '⚡', label: 'Focus' },
  { emoji: '🦉', label: 'Wisdom' },
  { emoji: '💡', label: 'Ideas' },
  { emoji: '🚀', label: 'Achiever' },
  { emoji: '🎨', label: 'Creative' },
  { emoji: '👧', label: 'Student A' },
  { emoji: '👦', label: 'Student B' },
];

export const AuthView: React.FC<AuthViewProps> = ({
  onNavigate,
  initialMode = 'signin',
}) => {
  const { signIn, signUp, continueAsGuest, user } = useAuth();

  // Mode: 'signin' | 'signup'
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎓');

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation & Error Handling
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Switch modes smoothly
  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setErrors({});
    setForgotPasswordNotice(false);
    setSuccessMessage(null);
  };

  // Client-side Validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please enter a valid email format (e.g. name@university.edu).';
    }

    if (!password) {
      errs.password = 'Please enter your password.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'signup') {
      const trimmedNick = nickname.trim();
      if (!trimmedNick) {
        errs.nickname = 'Please enter a display nickname.';
      } else if (trimmedNick.length < 2) {
        errs.nickname = 'Nickname must be at least 2 characters.';
      }

      if (!confirmPassword) {
        errs.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler connected to Neon Auth API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordNotice(false);
    setErrors({});
    setSuccessMessage(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signIn({
          email: email.trim(),
          password: password,
        });

        if (!res.success) {
          setErrors({ general: res.error || 'Invalid email or password. Please try again.' });
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage(`Welcome back! Signed in as ${email.split('@')[0]}.`);
      } else {
        const res = await signUp({
          email: email.trim(),
          password: password,
          nickname: nickname.trim(),
          avatar: selectedAvatar,
        });

        if (!res.success) {
          setErrors({ general: res.error || 'Failed to create account.' });
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage(`Account created! Welcome to LectureScript, ${nickname.trim()}.`);
      }

      // Smooth transition to Study Studio or Dashboard after brief visual confirmation
      setTimeout(() => {
        onNavigate('home');
      }, 500);
    } catch (err: any) {
      setErrors({ general: err.message || 'An unexpected network error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    onNavigate('home');
  };

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8 px-2 animate-fadeIn">
      {/* ── Top Back to Dashboard Link ── */}
      <div className="mb-4">
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6888] hover:text-[#242238] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* ── Main Auth Card ── */}
      <div
        className="glass-panel-elevated rounded-3xl p-6 sm:p-8 border relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 246, 255, 0.94) 100%)',
          borderColor: 'rgba(220, 212, 255, 0.85)',
          boxShadow: '0 20px 45px -10px rgba(116, 86, 232, 0.12), inset 0 1px 2px rgba(255, 255, 255, 1)',
        }}
      >
        {/* Soft Ambient Lavender Corner Accent */}
        <div
          className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none opacity-40 blur-2xl"
          style={{ background: 'radial-gradient(circle, #DCD4FF 0%, #B8A8FF 100%)' }}
        />

        {/* ── Header Badge & Title ── */}
        <div className="text-center space-y-1.5 mb-6 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-black text-lg text-white shadow-md mb-3"
            style={{
              background: 'linear-gradient(135deg, #7456E8 0%, #9B82F3 100%)',
              boxShadow: '0 4px 14px rgba(116, 86, 232, 0.35)',
            }}
          >
            LS
          </div>

          <h1 className="text-2xl font-extrabold text-[#242238] tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create an Account'}
          </h1>
          <p className="text-xs text-[#6B6888] max-w-xs mx-auto leading-relaxed">
            {mode === 'signin'
              ? 'Sign in to access your notes, decks, and active study practice.'
              : 'Save your study progress, customize your avatar, and practice exams.'}
          </p>
        </div>

        {/* ── Toggle Pills: Sign In vs Create Account ── */}
        <div
          className="flex p-1 rounded-2xl border mb-6 relative z-10"
          style={{
            background: 'rgba(247, 245, 255, 0.8)',
            borderColor: 'rgba(220, 212, 255, 0.8)',
          }}
        >
          <button
            type="button"
            onClick={() => handleSwitchMode('signin')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-[#6B6888] hover:text-[#242238]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('signup')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-[#6B6888] hover:text-[#242238]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* ── General Server Error Alert ── */}
        {errors.general && (
          <div
            className="mb-5 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold border animate-fadeIn"
            style={{
              background: '#FEF2F2',
              borderColor: '#FECACA',
              color: '#991B1B',
            }}
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* ── Success Feedback Alert ── */}
        {successMessage && (
          <div
            className="mb-5 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold border animate-fadeIn"
            style={{
              background: '#F0FDF4',
              borderColor: '#BBF7D0',
              color: '#166534',
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── Forgot Password Info Banner ── */}
        {forgotPasswordNotice && (
          <div
            className="mb-5 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs border animate-fadeIn"
            style={{
              background: '#FFFBEB',
              borderColor: '#FDE68A',
              color: '#92400E',
            }}
          >
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Password Reset</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                Enter your email address above to receive a secure password reset link, or contact support if you need immediate assistance.
              </p>
            </div>
          </div>
        )}

        {/* ── Authentication Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10" noValidate>
          {/* Sign Up: Nickname */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#242238] mb-1.5">
                Nickname / Name
              </label>
              <div
                className={`glass-input rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border transition-all ${
                  errors.nickname ? 'border-red-400 ring-2 ring-red-100' : ''
                }`}
              >
                <User className="w-4 h-4 text-violet-500 shrink-0" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (errors.nickname) setErrors((prev) => ({ ...prev, nickname: '' }));
                  }}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-transparent text-xs sm:text-sm text-[#242238] placeholder-[#9D9AB8] focus:outline-none font-medium"
                />
              </div>
              {errors.nickname && (
                <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.nickname}</span>
                </p>
              )}
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-[#242238] mb-1.5">
              Email Address
            </label>
            <div
              className={`glass-input rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border transition-all ${
                errors.email ? 'border-red-400 ring-2 ring-red-100' : ''
              }`}
            >
              <Mail className="w-4 h-4 text-violet-500 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="student@university.edu"
                className="w-full bg-transparent text-xs sm:text-sm text-[#242238] placeholder-[#9D9AB8] focus:outline-none font-medium"
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#242238]">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => setForgotPasswordNotice((prev) => !prev)}
                  className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div
              className={`glass-input rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border transition-all ${
                errors.password ? 'border-red-400 ring-2 ring-red-100' : ''
              }`}
            >
              <Lock className="w-4 h-4 text-violet-500 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="At least 6 characters"
                className="w-full bg-transparent text-xs sm:text-sm text-[#242238] placeholder-[#9D9AB8] focus:outline-none font-medium"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#8E8BA8] hover:text-violet-700 transition-colors p-0.5 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.password}</span>
              </p>
            )}
          </div>

          {/* Sign Up: Confirm Password */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#242238] mb-1.5">
                Confirm Password
              </label>
              <div
                className={`glass-input rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border transition-all ${
                  errors.confirmPassword ? 'border-red-400 ring-2 ring-red-100' : ''
                }`}
              >
                <Lock className="w-4 h-4 text-violet-500 shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Re-enter your password"
                  className="w-full bg-transparent text-xs sm:text-sm text-[#242238] placeholder-[#9D9AB8] focus:outline-none font-medium"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[#8E8BA8] hover:text-violet-700 transition-colors p-0.5 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.confirmPassword}</span>
                </p>
              )}
            </div>
          )}

          {/* Sign Up: Optional Avatar Selection */}
          {mode === 'signup' && (
            <div className="pt-1">
              <label className="block text-xs font-bold text-[#242238] mb-1.5">
                Choose an Avatar <span className="text-[10px] text-[#6B6888] font-normal">(Optional)</span>
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                {AVATAR_OPTIONS.map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(item.emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer ${
                      selectedAvatar === item.emoji
                        ? 'bg-violet-100 border-2 border-violet-600 scale-110 shadow-xs'
                        : 'bg-white/80 border border-violet-200 hover:bg-violet-50'
                    }`}
                    title={item.label}
                  >
                    <span>{item.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`btn-primary w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-opacity ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* ── Switch Mode Prompt ── */}
        <div className="text-center mt-4 text-xs text-[#6B6888]">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signup')}
                className="font-bold text-violet-700 hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signin')}
                className="font-bold text-violet-700 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* ── Subtle Divider ── */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-violet-200/70" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#8E8BA8]">
            <span className="bg-white/90 px-3 py-0.5 rounded-full border border-violet-100">
              or continue without an account
            </span>
          </div>
        </div>

        {/* ── Continue as Guest Action ── */}
        <button
          type="button"
          onClick={handleGuestContinue}
          className="w-full py-2.5 rounded-xl border border-violet-200 bg-white/70 hover:bg-violet-50/80 text-xs font-bold text-[#242238] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
        >
          <Compass className="w-4 h-4 text-violet-600" />
          <span>Continue as Guest</span>
        </button>

        {/* ── UI Preview Mode Notice (Clear & Honest) ── */}
        <div
          className="mt-5 p-2.5 rounded-xl border text-[11px] text-[#6B6888] flex items-center gap-2"
          style={{
            background: 'rgba(247, 245, 255, 0.65)',
            borderColor: 'rgba(220, 212, 255, 0.6)',
          }}
        >
          <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span>
            <strong>UI Preview Mode:</strong> Mock sessions are for UI testing. PostgreSQL authentication will connect in the next phase.
          </span>
        </div>
      </div>
    </div>
  );
};
