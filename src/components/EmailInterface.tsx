import React, { useState, useEffect } from 'react';
import { X, Send, Mail, User, Clock, FileText, RefreshCw, Download } from 'lucide-react';
import { EmailService, type IncomingEmail } from '../services/emailService';

// Secure ID generation utility (currently unused but kept for future use)
// const generateSecureId = (prefix: string = ''): string => {
//   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
//     return `${prefix}${crypto.randomUUID()}`;
//   }
//   // Fallback for environments without crypto.randomUUID
//   return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// };

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  stageId?: string;
  recipients: string[];
}

interface Applicant {
  id: string;
  name: string;
  unit?: string;
  phone?: string;
  email?: string;
  caseManager?: string;
  caseManagerEmail?: string;
}

interface EmailInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  applicant: Applicant;
  emailService: EmailService | null;
  onEmailSent: (emailData: {
    applicantId: string;
    applicantName: string;
    subject: string;
    body: string;
    recipients: string[];
    templateId: string;
    templateName: string;
  }) => void;
  emailArchive: Array<{
    id: string;
    applicantId: string;
    applicantName: string;
    timestamp: string;
    subject: string;
    body: string;
    recipients: string[];
    templateId: string;
    templateName: string;
    threadId: string;
    threadSubject: string;
    emailHeaders: {
      'In-Reply-To'?: string;
      'References'?: string;
      'Message-ID': string;
    };
  }>;
  emailThreads: Array<{
    id: string;
    applicantId: string;
    applicantName: string;
    subject: string;
    participants: string[];
    emailCount: number;
    lastActivity: string;
    isActive: boolean;
    createdDate: string;
  }>;
  onEmailViewed?: (emailId: string, applicantId: string) => void;
}

const EmailInterface: React.FC<EmailInterfaceProps> = ({
  isOpen,
  onClose,
  applicant,
  emailService,
  onEmailSent,
  emailArchive,
  emailThreads,
  onEmailViewed,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'compose' | 'view'>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [replyToEmail, setReplyToEmail] = useState<any>(null);
  
  // Incoming email state
  const [incomingEmails, setIncomingEmails] = useState<IncomingEmail[]>([]);
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [fetchEmailsError, setFetchEmailsError] = useState<string | null>(null);

  // Mock email templates for now - we'll integrate with real templates later
  const emailTemplates: EmailTemplate[] = [
    {
      id: 'new-referral',
      name: 'New Referral Request',
      subject: 'PSH Unit Available - Referral Request for {{unit}}',
      body: 'Hi JOHS Team,\n\nWe have a PSH unit available at {{unit}}. Please find the referral request attached.\n\nApplicant: {{applicantName}}\nPhone: {{applicantPhone}}\nCase Manager: {{caseManager}}\n\nPlease respond within the next 3 weeks.\n\nThank you,\n{{userName}}',
      recipients: ['johs@portland.gov'],
      stageId: 'awaiting-referral'
    },
    {
      id: 'status-update',
      name: 'Status Update',
      subject: 'PSH Application Status Update - {{applicantName}}',
      body: 'Hi {{caseManager}},\n\nThis is an update on {{applicantName}}\'s PSH application.\n\nCurrent Status: [Current Stage]\nUnit: {{unit}}\n\nPlease let me know if you need any additional information.\n\nBest regards,\n{{userName}}',
      recipients: ['case.manager@agency.org']
    },
    {
      id: 'follow-up',
      name: 'Follow-up Request',
      subject: 'Follow-up Required - {{applicantName}} PSH Application',
      body: 'Hi {{caseManager}},\n\nWe need to follow up on {{applicantName}}\'s PSH application.\n\nCould you please provide an update on the current status?\n\nApplicant: {{applicantName}}\nUnit: {{unit}}\nPhone: {{applicantPhone}}\n\nThank you for your time.\n\n{{userName}}',
      recipients: ['case.manager@agency.org']
    }
  ];

  // Reset form when modal opens/closes and auto-fetch emails
  useEffect(() => {
    if (isOpen) {
      console.log('EmailInterface opened for applicant:', applicant);
      setSelectedTemplate(null);
      setSelectedEmail(null);
      setViewMode('compose');
      setSubject('');
      setBody('');
      setRecipients([]);
      setNewRecipient('');
      setSendResult(null);
      setIncomingEmails([]);
      setFetchEmailsError(null);
      
      // Auto-fetch emails when modal opens
      if (emailService) {
        console.log('Auto-fetching emails for applicant:', applicant.name);
        handleFetchEmails();
      }
    }
  }, [isOpen, applicant, emailService]);

  // Fill template when selected
  const handleTemplateSelect = (template: EmailTemplate) => {
    console.log('Template selected:', template);
    setSelectedTemplate(template);
    setSelectedEmail(null);
    setViewMode('compose');
    setReplyToEmail(null); // Clear reply state when selecting a new template
    
    // Fill subject with applicant data
    const filledSubject = template.subject
      .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
      .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]')
      .replace(/\{\{applicantPhone\}\}/g, applicant.phone || '[Applicant Phone]')
      .replace(/\{\{caseManager\}\}/g, applicant.caseManager || '[Case Manager]')
      .replace(/\{\{caseManagerEmail\}\}/g, applicant.caseManagerEmail || '[Case Manager Email]')
      .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{userName\}\}/g, 'PSH Team'); // This could be dynamic later

    // Fill body with applicant data
    const filledBody = template.body
      .replace(/\{\{applicantName\}\}/g, applicant.name || '[Applicant Name]')
      .replace(/\{\{unit\}\}/g, applicant.unit || '[Unit Number]')
      .replace(/\{\{applicantPhone\}\}/g, applicant.phone || '[Applicant Phone]')
      .replace(/\{\{caseManager\}\}/g, applicant.caseManager || '[Case Manager]')
      .replace(/\{\{caseManagerEmail\}\}/g, applicant.caseManagerEmail || '[Case Manager Email]')
      .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{userName\}\}/g, 'PSH Team');

    setSubject(filledSubject);
    setBody(filledBody);
    setRecipients([...template.recipients]);
  };

  // Handle viewing a sent email
  const handleEmailClick = (email: any) => {
    console.log('Email clicked:', email);
    console.log('Email ID:', email.id);
    console.log('Email type:', email.type);
    console.log('Applicant ID:', applicant.id);
    console.log('onEmailViewed function:', !!onEmailViewed);
    
    setSelectedEmail(email);
    setSelectedTemplate(null);
    setViewMode('view');
    setSendResult(null);
    
    // Mark email as viewed to clear unread indicators
    // Use a unique identifier - either the email ID or a combination of timestamp and subject
    const emailIdentifier = email.id || `${email.timestamp}-${email.subject}`;
    
    if (onEmailViewed && emailIdentifier) {
      console.log('Calling onEmailViewed with:', emailIdentifier, applicant.id || 'unknown');
      onEmailViewed(emailIdentifier, applicant.id || 'unknown');
    } else {
      console.log('Not calling onEmailViewed - missing function or email identifier');
    }
  };

  // Handle replying to an email
  const handleReply = () => {
    if (!selectedEmail) return;
    
    console.log('Replying to email:', selectedEmail);
    
    setViewMode('compose');
    
    // Set subject with Re: prefix if not already present
    const replySubject = selectedEmail.subject.startsWith('Re:') 
      ? selectedEmail.subject 
      : `Re: ${selectedEmail.subject}`;
    setSubject(replySubject);
    
    // Set recipients - if this is a received email, reply to the sender
    // If this is a sent email, keep the original recipients
    if (selectedEmail.type === 'received' && selectedEmail.from) {
      setRecipients([selectedEmail.from.email || selectedEmail.from]);
    } else {
      setRecipients([...selectedEmail.recipients]);
    }
    
    // Clear body for fresh reply (don't include original message in compose area)
    setBody('');
    
    // Store the email we're replying to for threading
    setReplyToEmail(selectedEmail);
  };

  // Fetch incoming emails related to this applicant
  const handleFetchEmails = async () => {
    if (!emailService) {
      setFetchEmailsError('Email service not available');
      return;
    }

    setIsFetchingEmails(true);
    setFetchEmailsError(null);

    try {
      console.log('Fetching incoming emails...');
      
      // Get all recent emails
      const result = await emailService.fetchRecentEmails({ top: 100 });
      
      if (!result.success || !result.emails) {
        setFetchEmailsError(result.error || 'Failed to fetch emails');
        return;
      }

      console.log(`Fetched ${result.emails.length} emails`);

      // Get sent emails for this applicant to match against
      const applicantSentEmails = emailArchive.filter(email => 
        email.applicantId === applicant.id || 
        email.applicantName === applicant.name
      );

      console.log(`Found ${applicantSentEmails.length} sent emails for applicant`);

      // Match incoming emails to this applicant's threads
      const matchedEmails = result.emails.filter(incomingEmail => {
        // Check if any sent email matches this incoming email
        return applicantSentEmails.some(sentEmail => {
          return emailService.matchEmailToThread(incomingEmail, sentEmail.subject);
        });
      });

      console.log(`Matched ${matchedEmails.length} incoming emails to applicant threads`);
      setIncomingEmails(matchedEmails);
      
      if (matchedEmails.length === 0) {
        setFetchEmailsError(`No replies found. Checked ${result.emails.length} emails.`);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      setFetchEmailsError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsFetchingEmails(false);
    }
  };

  // Add recipient
  const addRecipient = () => {
    if (newRecipient.trim() && !recipients.includes(newRecipient.trim())) {
      setRecipients([...recipients, newRecipient.trim()]);
      setNewRecipient('');
    }
  };

  // Remove recipient
  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  // Send email
  const handleSendEmail = async () => {
    console.log('handleSendEmail called');
    console.log('emailService:', emailService);
    console.log('recipients:', recipients);
    console.log('subject:', subject);
    console.log('body:', body);

    if (!emailService || recipients.length === 0) {
      console.log('Validation failed - no emailService or recipients');
      setSendResult({ success: false, message: 'Please add at least one recipient' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Build email data
      const emailData: any = {
        to: recipients,
        subject: subject,
        body: body,
      };

      // If replying to an email, use the Graph API reply endpoint
      if (replyToEmail) {
        console.log('This is a reply to:', replyToEmail);
        console.log('Reply email data:', {
          id: replyToEmail.id,
          internetMessageId: replyToEmail.internetMessageId,
          inReplyTo: replyToEmail.inReplyTo,
          references: replyToEmail.references,
        });
        
        // Use the Graph API message ID for the reply endpoint
        // This will automatically handle threading
        emailData.replyToMessageId = replyToEmail.id;
        
        console.log('Using Graph API reply endpoint with message ID:', replyToEmail.id);
      }

      console.log('Attempting to send email with data:', emailData);
      await emailService.sendEmail(emailData);
      console.log('Email sent successfully!');
      setSendResult({ success: true, message: 'Email sent successfully!' });
      
      // Log email to archive with threading info
      onEmailSent({
        applicantId: applicant.id || 'unknown',
        applicantName: applicant.name,
        subject: subject,
        body: body,
        recipients: recipients,
        templateId: selectedTemplate?.id || 'custom',
        templateName: selectedTemplate?.name || 'Custom Email',
      });
      
      // Reset form after successful send
      setReplyToEmail(null); // Clear reply state
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error sending email:', error);
      setSendResult({ 
        success: false, 
        message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsSending(false);
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  console.log('EmailInterface rendering with isOpen:', isOpen);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[99999]"
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
        justifyContent: 'center'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] max-w-7xl flex flex-col"
        style={{
          backgroundColor: 'white',
          opacity: 1,
          backdropFilter: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Email Communication</h2>
              <p className="text-sm text-gray-600">Sending email for: <strong>{applicant.name}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Templates */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Email Templates
            </h3>
            
            <div className="space-y-3">
              {emailTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {template.recipients.length} recipient(s)
                  </div>
                </button>
              ))}
            </div>

            {/* Email Thread Information */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Email Thread
                  {isFetchingEmails && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking for replies...
                    </div>
                  )}
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={handleFetchEmails}
                    disabled={isFetchingEmails}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    title="Check for new email replies"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingEmails ? 'animate-spin' : ''}`} />
                    {isFetchingEmails ? 'Checking...' : 'Check Emails'}
                  </button>
                  <button
                    onClick={async () => {
                      if (emailService) {
                        try {
                          await emailService.authenticate();
                          handleFetchEmails();
                        } catch (error) {
                          console.error('Re-authentication failed:', error);
                        }
                      }
                    }}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    title="Re-authenticate and check emails"
                  >
                    🔄
                  </button>
                </div>
              </div>
              
              {fetchEmailsError && (
                <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  {fetchEmailsError}
                </div>
              )}
              {(() => {
                const applicantThread = emailThreads.find(thread => 
                  (thread.applicantId === applicant.id || thread.applicantName === applicant.name) && thread.isActive
                );
                
                const applicantSentEmails = emailArchive.filter(email => 
                  email.applicantId === applicant.id || 
                  email.applicantName === applicant.name
                );

                // Filter incoming emails to only include those that match this applicant's threads
                const relevantIncomingEmails = incomingEmails.filter(incomingEmail => {
                  return applicantSentEmails.some(sentEmail => {
                    // Use the emailService matching logic to ensure we only get relevant emails
                    return emailService?.matchEmailToThread(incomingEmail, sentEmail.subject) || false;
                  });
                });

                console.log(`EmailInterface - Applicant: ${applicant.name}`);
                console.log(`- Sent emails: ${applicantSentEmails.length}`);
                console.log(`- Total incoming emails: ${incomingEmails.length}`);
                console.log(`- Relevant incoming emails: ${relevantIncomingEmails.length}`);

                // Combine sent and incoming emails, then deduplicate by ID
                const combinedEmails = [
                  ...applicantSentEmails.map(e => ({ ...e, type: 'sent' as const })),
                  ...relevantIncomingEmails.map(e => ({
                    id: e.id,
                    timestamp: e.receivedDateTime,
                    subject: e.subject,
                    body: e.body,
                    recipients: e.toRecipients.map(r => r.email),
                    from: e.from,
                    templateName: '(Received)',
                    type: 'received' as const
                  }))
                ];

                // Deduplicate by email ID to prevent showing the same email twice
                const uniqueEmails = combinedEmails.reduce((acc, email) => {
                  const existingEmail = acc.find(e => e.id === email.id);
                  if (!existingEmail) {
                    acc.push(email);
                  } else {
                    console.log(`Found duplicate email ID: ${email.id} (${email.type} vs ${existingEmail.type})`);
                    // If we find a duplicate, prefer the 'sent' version over 'received'
                    if (email.type === 'sent' && existingEmail.type === 'received') {
                      const index = acc.findIndex(e => e.id === email.id);
                      acc[index] = email;
                      console.log(`Replaced received with sent version for email ID: ${email.id}`);
                    }
                  }
                  return acc;
                }, [] as typeof combinedEmails);

                console.log(`After deduplication: ${uniqueEmails.length} unique emails`);

                // Sort by timestamp (newest first) - most recent activity at the top
                const allEmails = uniqueEmails.sort((a, b) => {
                  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
                
                if (!applicantThread && allEmails.length === 0) {
                  return (
                    <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border">
                      <p>No email thread started yet.</p>
                      <p className="text-xs mt-1">Sending your first email will create a thread.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {/* Thread Info */}
                    {applicantThread && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-900">Active Thread</span>
                        </div>
                        <div className="text-sm text-blue-800">
                          <div className="font-medium">{applicantThread.subject}</div>
                          <div className="text-xs text-blue-600 mt-1">
                            {applicantThread.emailCount} email(s) • Last activity: {new Date(applicantThread.lastActivity).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Email History - Combined Sent & Received */}
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {allEmails.map((email, index) => {
                        // Check if this is the first email with this subject
                        const isFirstWithSubject = index === 0 || allEmails[index - 1].subject !== email.subject;
                        
                        return (
                          <div key={email.id}>
                            {/* Subject header for new conversation threads */}
                            {isFirstWithSubject && (
                              <div className="mb-2 px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700 border-l-2 border-gray-300">
                                📧 {email.subject}
                                {/* Show "NEW" indicator for recent threads */}
                                {index < 3 && (
                                  <span className="ml-2 px-1 py-0.5 bg-blue-500 text-white text-xs rounded">
                                    NEW
                                  </span>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => handleEmailClick(email)}
                              className={`w-full text-left p-4 rounded-lg border transition-all ${
                                selectedEmail?.id === email.id
                                  ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300'
                                  : email.type === 'sent'
                                    ? index === 0 
                                      ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                    : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                              }`}
                            >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {email.type === 'sent' ? (
                                  <Send className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Download className="w-4 h-4 text-purple-600" />
                                )}
                                <div className="font-medium text-sm text-gray-900">
                                  {email.type === 'sent' ? email.templateName : `From: ${email.from?.name || email.from?.email || 'Unknown'}`}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 mb-1 ml-6">
                                {email.type === 'sent' 
                                  ? `${email.recipients.length} recipient(s)`
                                  : `Reply received`}
                              </div>
                              <div className="text-xs text-gray-500 ml-6">
                                {new Date(email.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {index === 0 && !selectedEmail && (
                            <div className="mt-2 text-xs font-medium ml-5">
                              {email.type === 'sent' ? (
                                <span className="text-green-700">✓ Latest email in thread</span>
                              ) : (
                                <span className="text-purple-700">📬 Latest reply received</span>
                              )}
                            </div>
                          )}
                          {selectedEmail?.id === email.id && (
                            <div className="mt-2 text-xs text-blue-700 font-medium ml-5">
                              👁️ Viewing this email
                            </div>
                          )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Panel - Email Composer or Viewer */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Email Viewer Mode */}
              {viewMode === 'view' && selectedEmail && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">Viewing Email</h3>
                      {selectedEmail.type === 'sent' && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Sent
                        </span>
                      )}
                      {selectedEmail.type === 'received' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                          Received
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleReply}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Send className="w-4 h-4" />
                      Reply
                    </button>
                  </div>

                  {/* Email Metadata */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedEmail.type === 'sent' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {selectedEmail.type === 'sent' ? (
                          <Send className="w-4 h-4 text-green-600" />
                        ) : (
                          <Download className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">
                            {selectedEmail.type === 'sent' ? 'Template Used' : 'From'}
                          </span>
                          <span className="text-xs text-gray-500">{new Date(selectedEmail.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="font-medium text-gray-900">
                          {selectedEmail.type === 'sent' 
                            ? selectedEmail.templateName 
                            : `${selectedEmail.from?.name || selectedEmail.from?.email || 'Unknown'}`}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-500 mb-2">
                        {selectedEmail.type === 'sent' ? 'Recipients' : 'To'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmail.recipients.map((email: string, idx: number) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            <User className="w-3 h-3" />
                            {email}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedEmail.type === 'sent' && selectedEmail.threadId && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-500 mb-1">Thread ID</div>
                        <div className="text-xs text-gray-700 font-mono">{selectedEmail.threadId}</div>
                      </div>
                    )}
                  </div>

                  {/* Email Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      {selectedEmail.subject}
                    </div>
                  </div>

                  {/* Email Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded-md text-gray-900 whitespace-pre-wrap min-h-[300px] max-h-[500px] overflow-y-auto leading-relaxed">
                      <div className="prose prose-sm max-w-none">
                        {selectedEmail.body ? (
                          selectedEmail.body.split('\n').map((line: string, index: number) => {
                            // Style different parts of the email
                            if (line.includes('--- Previous Message ---')) {
                              return (
                                <div key={index} className="my-4 p-3 bg-blue-50 border-l-4 border-blue-300 rounded-r">
                                  <div className="text-blue-800 font-medium text-sm">📧 Previous Message</div>
                                </div>
                              );
                            } else if (line.startsWith('From:') || line.startsWith('Sent:') || line.startsWith('To:') || line.startsWith('Subject:')) {
                              return (
                                <div key={index} className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded mb-1">
                                  {line}
                                </div>
                              );
                            } else if (line.trim() === '') {
                              return <br key={index} />;
                            } else {
                              return (
                                <div key={index} className="mb-2">
                                  {line}
                                </div>
                              );
                            }
                          })
                        ) : (
                          <div className="text-gray-500 italic">
                            {selectedEmail.bodyPreview || 'No content available'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Composer Mode */}
              {viewMode === 'compose' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Email Composer</h3>
                    {replyToEmail && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                        <span>↩️</span>
                        <span>Replying to: {replyToEmail.subject}</span>
                      </div>
                    )}
                  </div>
                  
                  {!selectedTemplate && !replyToEmail && (
                    <div className="text-center py-12">
                      <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Select an email template from the left panel to get started.</p>
                    </div>
                  )}

                  {(selectedTemplate || replyToEmail) && (
                <div className="space-y-6">
                  {/* Recipients */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipients
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                        >
                          <User className="w-3 h-3" />
                          {email}
                          <button
                            onClick={() => removeRecipient(email)}
                            className="ml-1 hover:text-blue-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        placeholder="Add recipient email"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                      />
                      <button
                        onClick={addRecipient}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Send Result */}
                  {sendResult && (
                    <div className={`p-4 rounded-md ${
                      sendResult.success 
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                      {sendResult.message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSendEmail}
                      disabled={isSending || recipients.length === 0}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {isSending ? 'Sending...' : 'Send Email'}
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailInterface;
