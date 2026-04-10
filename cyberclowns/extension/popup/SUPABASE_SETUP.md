# Tilloff - Supabase Authentication Setup

## Overview
The Tilloff extension now includes Supabase authentication with login and registration features. Passwords are securely hashed and managed by Supabase.

## Setup Instructions

### 1. Create a Supabase Project
- Go to https://supabase.com
- Sign up or log in
- Create a new project
- Wait for the project to be provisioned
- Go to Project Settings → API

### 2. Get Your Credentials
- Copy your **Project URL** (looks like: `https://your-project.supabase.co`)
- Copy your **Anon Public Key** under the "API" section

### 3. Update auth.js
Edit `cyberclowns/extension/popup/auth.js` and replace:

```javascript
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_KEY = "YOUR_ANON_KEY";
```

With your actual Supabase credentials.

### 4. Enable Email Authentication
In Supabase Dashboard:
- Go to Authentication → Providers
- Enable "Email" provider
- Configure email settings if needed

### 5. (Optional) Customize Email Templates
In Supabase Dashboard:
- Go to Authentication → Email Templates
- Customize confirmation and reset emails

## How It Works

### Registration Flow
1. User fills out: Name, Email, Password (min 8 characters)
2. Password is hashed by Supabase using bcrypt
3. User account is created in Supabase
4. Auth token is stored in Chrome storage
5. User is logged in automatically

### Login Flow
1. User enters Email and Password
2. Supabase verifies credentials against stored hash
3. Session token is returned if valid
4. Token is stored in Chrome storage
5. User sees main dashboard

### Logout Flow
1. User clicks logout button
2. Session is cleared from Supabase
3. Chrome storage is cleared
4. User is returned to login screen

## Security Features

✅ **Password Hashing** - Supabase uses bcrypt for secure hashing
✅ **Session Management** - JWT tokens with automatic expiration
✅ **HTTPS Only** - All communication is encrypted
✅ **CORS Protection** - Supabase handles security policies

## Troubleshooting

### "Supabase not initialized"
- Check that SUPABASE_URL and SUPABASE_KEY are correct
- Verify Supabase CDN is accessible
- Check browser console for errors

### "Invalid login credentials"
- Verify email and password are correct
- Check email is confirmed (if email confirmations enabled)
- Reset password through Supabase dashboard if needed

### "Token expired"
- User will need to log in again
- Tokens expire based on your Supabase settings

## User Database Schema

Supabase automatically creates the `auth.users` table with:
- `id` - User UUID
- `email` - User email
- `encrypted_password` - Hashed password
- `email_confirmed_at` - Email verification timestamp
- `created_at` - Account creation time
- Additional user metadata fields

## Testing

1. Create a test account: testuser@example.com / password123456
2. Log in with the test account
3. Verify you see the analysis dashboard
4. Click logout and log back in with different credentials
5. Verify password hashing works (database shows encrypted_password)

## Notes

- Passwords are **never stored in plain text**
- Each user session is unique and secure
- Chrome storage is isolated per extension instance
- Users can manage accounts in Supabase dashboard

## Support

For Supabase-specific issues:
- Visit https://supabase.com/docs
- Check Supabase GitHub issues
- Contact Supabase support

For Tilloff issues:
- Check the extension console (right-click → Inspect)
- Verify auth.js configuration
- Ensure Supabase project is active
