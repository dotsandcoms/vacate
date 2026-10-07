export function invitationError(error: { code?: string; status?: number; message?: string } | null) {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === 'email_address_not_authorized' || /email address.*not authorized/i.test(message)) {
    return 'Invitation email is restricted by Supabase. Configure custom SMTP in Supabase Authentication → Email before inviting staff.';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error?.status === 429) {
    return 'The invitation email limit has been reached. Wait before retrying, or check the email rate limits in Supabase Authentication.';
  }
  if (code === 'email_exists' || code === 'user_already_exists') {
    return 'This email already has an account. Refresh User access and check the existing user before retrying.';
  }
  if (/smtp|sending.*email|send.*email/i.test(message)) {
    return 'Supabase could not deliver the invitation. Check the SMTP settings and Auth logs in Supabase, then try again.';
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return 'Supabase rejected the invitation details. Check the work email and try again.';
  }
  return `Invitation failed${code ? ` (${code})` : ''}. Check Supabase Auth logs for the delivery error before retrying.`;
}
