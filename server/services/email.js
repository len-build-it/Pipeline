import nodemailer from 'nodemailer';

// In-memory capture of sent emails for local inspection and testing
const capturedEmails = [];

let mockFailure = false;

export function setSimulateEmailFailure(shouldFail) {
  mockFailure = !!shouldFail;
}

export function getCapturedEmails() {
  return [...capturedEmails];
}

export function clearCapturedEmails() {
  capturedEmails.length = 0;
}

/**
 * Send an invitation email.
 * Uses local transport / in-memory capture.
 * If recipient contains 'fail' or mockFailure is true, throws an error to simulate delivery failure.
 */
export async function sendInvitationEmail({ to, organizationName, role, inviteUrl }) {
  if (mockFailure || to.toLowerCase().includes('fail')) {
    const err = new Error('SMTP delivery connection failed: recipient mailbox rejected.');
    err.code = 'EDELIVERY';
    throw err;
  }

  const emailRecord = {
    id: 'eml-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    to,
    from: 'no-reply@pipeline-orgs.local',
    subject: `Invitation to join ${organizationName} on Pipeline`,
    organizationName,
    role,
    inviteUrl,
    sentAt: new Date().toISOString(),
  };

  capturedEmails.push(emailRecord);

  return {
    success: true,
    messageId: emailRecord.id,
  };
}
