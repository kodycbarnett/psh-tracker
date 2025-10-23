import React, { useState } from 'react';
import { LogOut, User, Mail, ChevronDown, Shield } from 'lucide-react';

interface UserProfileProps {
  user: {
    name: string;
    email: string;
    username?: string;
  };
  onLogout: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="relative">
      {/* User Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Avatar */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
          {getInitials(user.name)}
        </div>
        
        {/* User Info */}
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-600">{user.email}</p>
        </div>
        
        {/* Chevron */}
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden">
            {/* User Info Section */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {getInitials(user.name)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className="p-4 space-y-3 border-b border-gray-200">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Account Type</p>
                  <p className="font-medium text-gray-900">Microsoft Account</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Email Integration</p>
                  <p className="font-medium text-gray-900">Active</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Security Status</p>
                  <p className="font-medium text-gray-900">Authenticated</p>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <div className="p-3">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserProfile;




