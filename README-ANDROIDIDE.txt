DHS PARTNER — ANDROID / GITHUB BUILD PROJECT

WHAT IS INCLUDED
- Standard Android Gradle project (AGP 8.6.1 / Gradle 8.7 / Java 17).
- Supplied DHS house + wrench + paintbrush icon installed as the Android launcher icon and web/PWA icons.
- Existing DHS Partner WebView UI, Firebase Auth/Firestore/Storage, maps, billing and work-flow kept intact.
- Native background booking monitor so the partner can remain online while the app is not the visible screen.
- New-booking notification channel with loud custom sound + strong vibration.
- Full-screen booking alert Activity intended to wake/show over the lock screen when Android permits full-screen alerts.
- Accept / Reject buttons in the full-screen booking alert. Native REST write updates partnerJobs and bookings.
- Persistent “DHS Partner • You're online” foreground notification while the partner is online.
- Boot receiver to restore the monitor when the device restarts if the partner was still marked online.
- GitHub Actions workflow: .github/workflows/android.yml

IMPORTANT NOTIFICATION BEHAVIOUR
Android controls some background/lock-screen behaviour. On Android 14/15, the user must allow notifications and, where the device requires it, allow full-screen notifications for DHS Partner. The app opens that setting after a successful login. Do Not Disturb, muted notification channels, battery restrictions, or OEM background-kill settings can still suppress sound/vibration.

HOW THE BACKGROUND BOOKING ALERT WORKS
When the partner taps Online, the native foreground service polls the existing Firebase Firestore partnerJobs collection while online. It uses the same Firebase project already present in the supplied app, so a separate google-services.json is not required for this monitor. The partner's password is stored only in an Android Keystore-encrypted local preference so the service can refresh Firebase authentication after the app is no longer visible.

FIRESTORE RULES REQUIREMENT
The existing Firebase rules must allow an authenticated partner to read the partnerJobs collection and update the booking/partnerJobs documents that the web app already updates. If the rules are stricter than the supplied app's existing Firestore usage, the native background monitor cannot see or update those documents until the rules are adjusted on the Firebase side.

GITHUB BUILD
1. Create/open a GitHub repository.
2. Upload the CONTENTS of this folder (build.gradle, settings.gradle, app/, .github/, etc.). Do not upload the outer ZIP as the only repository file.
3. Push to main or master.
4. Open GitHub -> Actions -> “DHS Partner Android APK”.
5. After the run succeeds, open the workflow run -> Artifacts -> DHS-Partner-debug-apk.
6. Download the artifact ZIP, extract it, and install app-debug.apk on the partner phone.

ANDROIDIDE
1. Extract this ZIP.
2. Open the extracted folder as a Gradle project.
3. If AndroidIDE asks for a Gradle version, use Gradle 8.7 and JDK 17.
4. Sync the project.
5. Build/Run -> Assemble Debug.
6. APK: app/build/outputs/apk/debug/app-debug.apk

FIRST PHONE SETUP
- Allow Notifications.
- Allow Location and any other permissions the existing app requests.
- When Android shows the full-screen notification access setting, allow DHS Partner if you want the booking alert to wake/show over the lock screen.
- Log in once after installing this updated build so the native monitor receives the partner credentials.
- Tap Online. Keep the partner online; the foreground “You're online” notification will remain visible while the booking monitor is active.

BACKEND NOTE
The project keeps the Firebase configuration already contained in the supplied DHS Partner app. No Firebase credentials or Firestore rules are changed by this package.
