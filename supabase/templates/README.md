# Supabase email templates

Paste each file into Supabase → Authentication → Emails → Templates.

| Template | File | Subject |
|---|---|---|
| Confirm signup | confirm-signup.html | Confirm your email for Skillit |
| Magic link | magic-link.html | Your Skillit sign-in code |
| Reset password | reset-password.html | Reset your Skillit password |
| Change email address | change-email.html | Confirm your new email |
| Invite user | invite.html | You're invited to Skillit |
| Reauthentication | reauthentication.html | Your Skillit code |

The magic-link template shows the 6-digit code (`{{ .Token }}`) because the app signs in with a code, not a link.
