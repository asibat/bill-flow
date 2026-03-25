Use a real Vercel preview deploy, not localhost.

  Deploy

  1. Log in:

  vercel login

  2. Pull or set env vars in Vercel.
     Minimum for phone testing:

  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - NEXT_PUBLIC_APP_URL
  - CRON_SECRET
  - EXTRACTION_PROVIDER
  - GEMINI_API_KEY or ANTHROPIC_API_KEY
  - NEXT_PUBLIC_VAPID_PUBLIC_KEY
  - VAPID_PRIVATE_KEY
  - VAPID_SUBJECT

  3. Create a preview deploy:

  vercel

  4. After deploy finishes, set:

  - NEXT_PUBLIC_APP_URL=https://<preview-url>.vercel.app

  Then redeploy:

  vercel --prod=false

  Or just run vercel again.

  Test on your phone

  1. Open the preview URL on your phone.
  2. Sign up / log in.
  3. Go to Settings.
  4. Enable push notifications.
  5. Tap Send Test Push.
  6. Add the site to your home screen:

  - iPhone Safari: Share -> Add to Home Screen
  - Android Chrome: menu -> Install app

  7. Open the installed app and test again from Settings.

  What to test

  - Login works
  - Dashboard loads
  - Add bill works
  - Settings save
  - Install on Phone prompt appears where supported
  - Push permission prompt appears
  - Test push is delivered
  - Reminder emails still work after deploy

  Important caveats

  - Push notifications need:
      - HTTPS
      - VAPID keys configured
      - a supported browser
  - iPhone push works only when the app is added to the home screen and opened from there.
  - Preview URLs can change, so push testing is more stable on production or a fixed custom domain.

  Recommended path

  1. Do one preview deploy and test the app flow on your phone.
  2. If push works, deploy production:

  vercel --prod

  3. Update NEXT_PUBLIC_APP_URL to the production URL.
  4. Re-test push from the installed production app.
