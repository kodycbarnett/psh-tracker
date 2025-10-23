import React, { useState } from 'react';
import { Home, Mail, Shield, LogIn, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, isLoading, error }) => {
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);

  const handleLogin = async () => {
    setIsAttemptingLogin(true);
    try {
      await onLogin();
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsAttemptingLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo/Header Section */}
        <div className="text-center mb-10">
          {/* IHI Logo */}
          <div className="inline-flex flex-col items-center justify-center mb-6">
            <div className="w-32 h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center p-4 border border-gray-200">
              {/* IHI Logo - House with IHI letters */}
              <div className="flex flex-col items-center">
                {/* House icon with IHI */}
                <div className="relative">
                  {/* Roof triangle */}
                  <div className="w-16 h-8 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-800"></div>
                  {/* House base with IHI letters */}
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-12 h-6 bg-gray-800 flex items-center justify-center">
                    <span className="text-white font-bold text-xs tracking-wider">IHI</span>
                  </div>
                  {/* Base line */}
                  <div className="w-16 h-0.5 bg-gray-800 mt-1"></div>
                </div>
              </div>
            </div>
            {/* Company name */}
            <div className="mt-4 text-center">
              <h2 className="text-lg font-bold text-gray-800 tracking-wide">INNOVATIVE HOUSING, INC.</h2>
              <div className="w-24 h-0.5 bg-gray-800 mx-auto mt-1"></div>
              <p className="text-xs text-gray-600 font-medium mt-2 tracking-wider">CREATING SOLUTIONS TO UNMET HOUSING NEEDS</p>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent mb-3">
            PSH Tracker
          </h1>
          <p className="text-lg text-gray-600 font-medium">
            Permanent Supportive Housing Application Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Welcome Back
            </h2>
            <p className="text-gray-600 text-lg">
              Sign in with your Microsoft account to continue
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 p-5 bg-red-50/80 border border-red-200/50 rounded-2xl backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-base font-semibold text-red-800">Authentication Error</p>
                  <p className="text-sm text-red-700 mt-2 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading || isAttemptingLogin}
            className="w-full flex items-center justify-center gap-4 px-8 py-5 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-2xl hover:from-indigo-700 hover:via-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 disabled:transform-none font-semibold text-xl"
          >
            {isLoading || isAttemptingLogin ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn className="w-6 h-6" />
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>

          {/* Features List */}
          <div className="mt-10 pt-8 border-t border-gray-200/60">
            <p className="text-sm text-gray-500 mb-6 font-semibold uppercase tracking-wider text-center">
              What you'll get:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100/50">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">Secure Access</p>
                  <p className="text-sm text-gray-600 mt-1">Protected PSH applicant data with enterprise-grade security</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 rounded-2xl border border-purple-100/50">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">Email Integration</p>
                  <p className="text-sm text-gray-600 mt-1">Send emails directly from the platform with your account</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-2xl border border-green-100/50">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">Complete Tracking</p>
                  <p className="text-sm text-gray-600 mt-1">Manage the entire PSH application process in one place</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 font-medium">Powered by Microsoft Azure Authentication</p>
          <p className="text-xs text-gray-400 mt-2">Vibrant PSH & Homeless Preference Program</p>
        </div>
      </div>
    </div>
  );
};

export default Login;



