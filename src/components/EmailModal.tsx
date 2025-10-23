import React, { useState, useEffect } from 'react';
import { X, Send, Copy, User, Mail, AlertCircle } from 'lucide-react';
import { EmailService, type EmailData } from '../services/emailService';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  stageId?: string;
  recipients: string[];
}

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: EmailTemplate;
  applicant?: {
    name: string;
    unit?: string;
    phone?: string;
    email?: string;
    caseManager?: string;
    caseManagerEmail?: string;
  };
  emailService: EmailService | null;
}

const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  template,
  applicant,
  emailService,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (isOpen && template && applicant) {
      // Fill template with applicant data
      const filledSubject = template.subject
        .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
        .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]')
        .replace(/\{\{applicantPhone\}\}/g, applicant.phone || '[Applicant Phone]')
        .replace(/\{\{applicantEmail\}\}/g, applicant.email || '[Applicant Email]')
        .replace(/\{\{caseManager\}\}/g, applicant.caseManager || '[Case Manager]')
        .replace(/\{\{caseManagerEmail\}\}/g, applicant.caseManagerEmail || '[Case Manager Email]')
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{userName\}\}/g, 'Kody Barnett');

      const filledBody = template.body
        .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
        .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]')
        .replace(/\{\{applicantPhone\}\}/g, applicant.phone || '[Applicant Phone]')
        .replace(/\{\{applicantEmail\}\}/g, applicant.email || '[Applicant Email]')
        .replace(/\{\{caseManager\}\}/g, applicant.caseManager || '[Case Manager]')
        .replace(/\{\{caseManagerEmail\}\}/g, applicant.caseManagerEmail || '[Case Manager Email]')
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{userName\}\}/g, 'Kody Barnett');

      setSubject(filledSubject);
      setBody(filledBody);
      setRecipients(template.recipients || []);
    }

    // Check authentication status
    if (emailService) {
      setIsAuthenticated(emailService.isAuthenticated());
    }
  }, [isOpen, template, applicant, emailService]);

  const addRecipient = () => {
    if (newRecipient.trim() && !recipients.includes(newRecipient.trim())) {
      setRecipients([...recipients, newRecipient.trim()]);
      setNewRecipient('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const copyToClipboard = async () => {
    const emailText = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(emailText);
      alert('Email copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleSend = async () => {
    if (!emailService || !isAuthenticated) {
      alert('Please authenticate with Microsoft Graph first.');
      return;
    }

    if (recipients.length === 0) {
      alert('Please add at least one recipient.');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const emailData: EmailData = {
        to: recipients,
        subject,
        body,
        isHtml: false,
      };

      const result = await emailService.sendEmail(emailData);
      
      if (result.success) {
        setSendResult({ success: true, message: 'Email sent successfully!' });
        // Close modal after successful send
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setSendResult({ success: false, message: result.error || 'Failed to send email' });
      }
    } catch (error) {
      setSendResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!emailService) return;
    
    const success = await emailService.authenticate();
    setIsAuthenticated(success);
    
    if (!success) {
      alert('Authentication failed. Please try again.');
    }
  };

  if (!isOpen) return null;
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)'
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'white',
          opacity: 1,
          backdropFilter: 'none'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {template ? `Send Email: ${template.name}` : 'Send Email'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div 
          className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]"
          style={{
            backgroundColor: 'white',
            opacity: 1
          }}
        >
          {/* Authentication Status */}
          {!isAuthenticated && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Authentication Required</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                You need to authenticate with Microsoft Graph to send emails.
              </p>
              <button
                onClick={handleAuthenticate}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Authenticate with Microsoft
              </button>
            </div>
          )}

          {/* Recipients */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipients
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
              />
              <button
                onClick={addRecipient}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recipients.map((email, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  <User className="h-4 w-4" />
                  <span>{email}</span>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Send Result */}
          {sendResult && (
            <div className={`mb-6 p-4 rounded-lg ${
              sendResult.success 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">
                  {sendResult.success ? 'Success!' : 'Error'}
                </span>
              </div>
              <p className="text-sm mt-1">{sendResult.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-6 border-t bg-gray-50"
          style={{
            backgroundColor: '#f9fafb',
            opacity: 1
          }}
        >
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!isAuthenticated || isSending || recipients.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
