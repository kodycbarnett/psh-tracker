import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication } from '@azure/msal-browser';

export interface EmailData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  headers?: {
    'In-Reply-To'?: string;
    'References'?: string;
    'Message-ID'?: string;
    [key: string]: string | undefined;
  };
  replyToMessageId?: string; // Graph API message ID to use /reply endpoint
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IncomingEmail {
  id: string;
  subject: string;
  body: string;
  bodyPreview: string;
  from: {
    name: string;
    email: string;
  };
  toRecipients: Array<{
    name: string;
    email: string;
  }>;
  receivedDateTime: string;
  internetMessageId: string;
  conversationId: string;
  inReplyTo?: string;
  references?: string;
  isRead: boolean;
}

export class EmailService {
  private graphClient: Client | null = null;
  private msalInstance: PublicClientApplication;
  private account: any = null;

  constructor(msalInstance: PublicClientApplication) {
    this.msalInstance = msalInstance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Get the current account
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length === 0) {
        console.log('No accounts found');
        return false;
      }

      this.account = accounts[0];
      
      // Get access token
      const tokenResponse = await this.msalInstance.acquireTokenSilent({
        scopes: ['https://graph.microsoft.com/Mail.Send'],
        account: this.account,
      });

      // Initialize Graph client
      this.graphClient = Client.init({
        authProvider: (done) => {
          done(null, tokenResponse.accessToken);
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      return false;
    }
  }

  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    if (!this.graphClient) {
      return {
        success: false,
        error: 'Email service not initialized. Please authenticate first.',
      };
    }

    try {
      // Try to get token with Mail.Send scope
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const tokenResult = await this.msalInstance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/Mail.Send'],
            account: accounts[0],
          });
          
          // Re-initialize Graph client with new token
          this.graphClient = Client.init({
            authProvider: (done) => {
              done(null, tokenResult.accessToken);
            },
          });
        } catch (tokenError) {
          console.log('Silent token refresh failed for send, trying popup:', tokenError);
          
          // If silent fails, try popup for Mail.Send permission
          try {
            const popupResult = await this.msalInstance.acquireTokenPopup({
              scopes: ['https://graph.microsoft.com/Mail.Send'],
              account: accounts[0],
            });
            
            // Re-initialize Graph client with new token
            this.graphClient = Client.init({
              authProvider: (done) => {
                done(null, popupResult.accessToken);
              },
            });
          } catch (popupError) {
            console.error('Popup token acquisition failed for send:', popupError);
            return {
              success: false,
              error: 'Unable to get permission to send emails. Please try logging out and back in.',
            };
          }
        }
      }
      // Build internet message headers if provided (only custom headers starting with x- or X-)
      const internetMessageHeaders: any[] = [];
      if (emailData.headers) {
        Object.entries(emailData.headers).forEach(([name, value]) => {
          // Only add custom headers (x- prefix), skip standard headers
          if (name.toLowerCase().startsWith('x-')) {
            internetMessageHeaders.push({ name, value });
          }
        });
      }
      
      console.log('Building message with custom headers:', internetMessageHeaders);
      console.log('Reply metadata:', emailData.replyToMessageId);

      const message = {
        message: {
          subject: emailData.subject,
          body: {
            contentType: emailData.isHtml ? 'HTML' : 'Text',
            content: emailData.body,
          },
          toRecipients: emailData.to.map(email => ({
            emailAddress: {
              address: email,
            },
          })),
          ...(emailData.cc && emailData.cc.length > 0 && {
            ccRecipients: emailData.cc.map(email => ({
              emailAddress: {
                address: email,
              },
            })),
          }),
          ...(emailData.bcc && emailData.bcc.length > 0 && {
            bccRecipients: emailData.bcc.map(email => ({
              emailAddress: {
                address: email,
              },
            })),
          }),
          ...(internetMessageHeaders.length > 0 && {
            internetMessageHeaders: internetMessageHeaders,
          }),
        },
        saveToSentItems: true,
      };

      // If this is a reply, use the reply endpoint instead of sendMail
      let result;
      if (emailData.replyToMessageId) {
        console.log('Using reply endpoint for message:', emailData.replyToMessageId);
        
        // Use the /reply endpoint which automatically handles threading
        result = await this.graphClient
          .api(`/me/messages/${emailData.replyToMessageId}/reply`)
          .post({
            message: {
              toRecipients: emailData.to.map(email => ({
                emailAddress: {
                  address: email,
                },
              })),
            },
            comment: emailData.body,
          });
      } else {
        // Regular send for new emails
        result = await this.graphClient
          .api('/me/sendMail')
          .post(message);
      }

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // First try silent authentication
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const silentResult = await this.msalInstance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read', 'https://graph.microsoft.com/Mail.Read'],
            account: accounts[0],
          });
          
          if (silentResult.accessToken) {
            this.account = accounts[0];
            return await this.initialize();
          }
        } catch (silentError) {
          console.log('Silent auth failed, trying popup:', silentError);
        }
      }

      // Fallback to popup if silent fails
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read', 'https://graph.microsoft.com/Mail.Read'],
        prompt: 'select_account',
      });

      if (loginResponse.account) {
        this.account = loginResponse.account;
        return await this.initialize();
      }

      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.account !== null && this.graphClient !== null;
  }

  getAccountInfo(): any {
    return this.account;
  }

  async fetchRecentEmails(options?: {
    top?: number;
    filter?: string;
  }): Promise<{ success: boolean; emails?: IncomingEmail[]; error?: string }> {
    if (!this.graphClient) {
      return {
        success: false,
        error: 'Email service not initialized. Please authenticate first.',
      };
    }

    try {
      // Try to get token with Mail.Read scope
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const tokenResult = await this.msalInstance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/Mail.Read'],
            account: accounts[0],
          });
          
          // Re-initialize Graph client with new token
          this.graphClient = Client.init({
            authProvider: (done) => {
              done(null, tokenResult.accessToken);
            },
          });
        } catch (tokenError) {
          console.log('Silent token refresh failed, trying popup:', tokenError);
          
          // If silent fails, try popup for Mail.Read permission
          try {
            const popupResult = await this.msalInstance.acquireTokenPopup({
              scopes: ['https://graph.microsoft.com/Mail.Read'],
              account: accounts[0],
            });
            
            // Re-initialize Graph client with new token
            this.graphClient = Client.init({
              authProvider: (done) => {
                done(null, popupResult.accessToken);
              },
            });
          } catch (popupError) {
            console.error('Popup token acquisition failed:', popupError);
            return {
              success: false,
              error: 'Unable to get permission to read emails. Please try logging out and back in.',
            };
          }
        }
      }

      const top = options?.top || 50;
      let query = this.graphClient
        .api('/me/messages')
        .top(top)
        .select('id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,internetMessageId,conversationId,isRead,internetMessageHeaders')
        .orderby('receivedDateTime DESC');

      if (options?.filter) {
        query = query.filter(options.filter);
      }

      const response = await query.get();
      
      const emails: IncomingEmail[] = response.value.map((message: any) => {
        // Clean HTML from email body and format for better readability
        const cleanBody = (html: string): string => {
          if (!html) return '';
          
          // Remove HTML tags but preserve line breaks and structure
          let cleaned = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/\n\s*\n/g, '\n') // Remove multiple line breaks
            .trim();

          // Add visual separators for quoted content
          cleaned = cleaned
            .replace(/From:\s*([^\n]+)/g, '\n\n--- Previous Message ---\nFrom: $1')
            .replace(/Sent:\s*([^\n]+)/g, 'Sent: $1')
            .replace(/To:\s*([^\n]+)/g, 'To: $1')
            .replace(/Subject:\s*([^\n]+)/g, 'Subject: $1')
            .replace(/--- Previous Message ---\s*\n\s*From:/g, '--- Previous Message ---\nFrom:')
            .replace(/\n{3,}/g, '\n\n'); // Limit to max 2 line breaks

          return cleaned;
        };

        // Extract threading headers
        const inReplyTo = message.internetMessageHeaders?.find((h: any) => h.name === 'In-Reply-To')?.value;
        const references = message.internetMessageHeaders?.find((h: any) => h.name === 'References')?.value;
        
        console.log(`Email ${message.subject} threading info:`, {
          internetMessageId: message.internetMessageId,
          inReplyTo,
          references,
          hasHeaders: !!message.internetMessageHeaders
        });

        return {
          id: message.id,
          subject: message.subject || '(No Subject)',
          body: cleanBody(message.body?.content || ''),
          bodyPreview: message.bodyPreview || '',
          from: {
            name: message.from?.emailAddress?.name || 'Unknown',
            email: message.from?.emailAddress?.address || '',
          },
          toRecipients: (message.toRecipients || []).map((recipient: any) => ({
            name: recipient.emailAddress?.name || 'Unknown',
            email: recipient.emailAddress?.address || '',
          })),
          receivedDateTime: message.receivedDateTime,
          internetMessageId: message.internetMessageId || '',
          conversationId: message.conversationId || '',
          inReplyTo: inReplyTo || '',
          references: references || '',
          isRead: message.isRead || false,
        };
      });

      return {
        success: true,
        emails,
      };
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async searchEmailsBySubject(subjectKeyword: string): Promise<{ success: boolean; emails?: IncomingEmail[]; error?: string }> {
    return this.fetchRecentEmails({
      top: 100,
      filter: `contains(subject, '${subjectKeyword}')`,
    });
  }

  async getEmailsByConversationId(conversationId: string): Promise<{ success: boolean; emails?: IncomingEmail[]; error?: string }> {
    return this.fetchRecentEmails({
      top: 100,
      filter: `conversationId eq '${conversationId}'`,
    });
  }

  // Helper method to match incoming emails to PSH threads
  matchEmailToThread(email: IncomingEmail, threadSubject: string): boolean {
    // Remove "Re:", "RE:", "Fwd:" etc from subjects for comparison
    const cleanSubject = (subject: string) => {
      return subject.replace(/^(Re:|RE:|Fwd:|FW:)\s*/gi, '').trim().toLowerCase();
    };

    const emailSubjectClean = cleanSubject(email.subject);
    const threadSubjectClean = cleanSubject(threadSubject);

    // Check if subjects match (allowing for Re: prefix)
    return emailSubjectClean === threadSubjectClean || 
           email.subject.toLowerCase().includes(threadSubjectClean);
  }
}
