# Attendly

A faithful, working implementation of the **Attendly** (CATaskKit) HR & attendance
designs from the Claude Design handoff bundle — rebuilt as a real **React + Vite +
TypeScript** app.

It covers all four product surfaces from the bundle:

| Route | Surface | Notes |
|-------|---------|-------|
| `/` | Landing hub | Links to every surface |
| `/login` → `/app` | **Employee mobile app** | Login, Home, Attendance, Approvals (manager), Leave, Profile, check-in/out, apply-leave, toasts — rendered inside an iOS phone frame |
| `/admin` | **Admin dashboard** | Dashboard, Leave Approvals, Employees, Attendance MIS, Payroll, Holidays, Settings |
| `/onboarding` | **Client onboarding** | 8-step setup wizard with progress saved to `localStorage` |
| `/reports` | **HR data & export** | Editable database (full CRUD) + live multi-sheet Excel (`.xlsx`) export |

## Run it

```bash
npm install
npm run dev      # start the dev server (Vite)
npm run build    # typecheck + production build
npm run preview  # preview the production build
```

Then open the printed local URL. Routing uses a hash router, so every surface is
shareable as `…/#/admin`, `…/#/onboarding`, etc.

## Run on Android

The app is packaged as a native Android app with **Capacitor** — it wraps the
Vite web build in an Android WebView shell. The native project lives in
`android/` and the app id is `com.cataskkit.attendly`. The hash router, status-bar
styling, Android hardware **back button** handling, and safe-area / no-zoom
viewport are all wired up (`src/native.ts`, `capacitor.config.ts`).

### One-time prerequisites
- **Android Studio** (includes the Android SDK + platform-tools), or a standalone
  Android SDK with `ANDROID_HOME`/`ANDROID_SDK_ROOT` set.
- **JDK 17** (Android Studio ships one; Gradle here targets JDK 17).

### Build & run

```bash
npm install

# Build the web app and copy it into the native project, then open Android Studio:
npm run android:open
#   → in Android Studio: pick a device/emulator and press Run.

# …or run straight onto a connected device / running emulator from the CLI:
npm run android:run

# …or build a debug APK without the IDE:
npm run android:sync
cd android && ./gradlew assembleDebug
#   → APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Any time you change web code, re-run `npm run android:sync` (it does
`vite build` + `cap sync android`) to push the new build into the native project.

### Mobile notes
- The **employee app** is the mobile-first surface — it renders full-screen on
  phones (the desktop iOS frame is dropped below 460px) and is the primary
  Android experience.
- The **admin / onboarding / reports** consoles are desktop-oriented HR tools;
  they run on Android and scroll, but are best used on a tablet or larger screen.

## How this maps to the design bundle

The prototypes were React-via-Babel-CDN files with design-tool scaffolding
(a `TweaksPanel` theme switcher, an `IOSDevice` frame, a `ChromeWindow` browser
chrome). That scaffolding is **not** part of the product, so it was dropped; the
employee app keeps a lightweight iOS frame (`src/components/PhoneFrame.tsx`) for
context on desktop and goes full-bleed on mobile. The default theme tokens
(accent, light/soft style) are baked in from the prototype defaults.

### Source layout

```
src/
  Landing.tsx              hub page
  components/PhoneFrame.tsx iOS device frame
  employee/                Employee app — theme, ui primitives, login, screens, overlays
  admin/                   Admin dashboard — ui kit + charts, screens, settings, shell
  onboarding/              Onboarding wizard — kit, 8 steps, shell
  reports/                 HR data export — DB layer, xlsx export, page + CRUD modal
```

Styling is faithful to the prototypes: theme is driven by CSS custom properties
applied per surface, with inline styles matching the originals' dimensions,
colors and layout. The reports surface keeps its class-based CSS scoped under
`.reports-root`.

## Notes

- The product runs in demo mode until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided.
- With Supabase configured and the migrations applied, auth, onboarding, admin data, employee attendance, leave, holidays, profile details, approvals, and Excel export use the live database.
- See `SETUP.md` for the database setup steps.