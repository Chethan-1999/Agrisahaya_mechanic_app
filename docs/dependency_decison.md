You are working on an Android-only mobile application built with Capacitor.

Before installing any dependency, modifying project configuration, or generating native Android code, follow these rules strictly.

## 1. Inspect first

Inspect the existing project before making changes. Identify:

- Frontend framework and version
- Package manager
- Node.js version
- Capacitor version
- Existing dependencies
- Lockfile
- capacitor.config file
- Android project configuration
- minSdkVersion
- targetSdkVersion
- compileSdkVersion
- Java/JDK version
- Gradle version
- Android Gradle Plugin version
- Existing native plugins and permissions

Do not assume the project is empty. Do not overwrite existing configuration without inspection.

## 2. Define the requirement

Before proposing a dependency, clearly state:

1. What exact feature requires it?
2. Can existing code solve the problem?
3. Can a browser API or Capacitor core API solve it?
4. Why is this dependency necessary?
5. What alternatives were considered?
6. What are the compatibility requirements?
7. What are the security, privacy, license, performance, and maintenance risks?
8. How will the feature be tested?

Do not install a package merely because it is popular, recommended by an LLM, or the latest version.

## 3. Dependency compatibility

For every proposed dependency, verify compatibility with:

- Frontend framework
- TypeScript version
- Node.js version
- Package manager
- Bundler
- Capacitor major version
- Android API levels
- minSdkVersion
- targetSdkVersion
- compileSdkVersion
- Java/JDK
- Gradle
- Android Gradle Plugin
- AndroidX
- Existing dependencies
- Existing native plugins

If compatibility cannot be verified, do not install the dependency. State what information is missing.

## 4. Version selection

Choose the latest stable version that is compatible with the existing project.

Do not blindly choose the newest version.

Do not upgrade unrelated dependencies.

Do not upgrade Capacitor major versions only to install one package unless the upgrade is explicitly approved.

Do not use --force, --legacy-peer-deps, or similar flags to hide compatibility problems.

Preserve the lockfile and explain any version pinning or overrides.

## 5. Security and privacy

Before installing a dependency, check:

- Known vulnerabilities
- License
- Maintenance status
- Data collection
- Third-party network requests
- Telemetry
- Analytics
- Ads
- Sensitive permissions
- Native code
- Credential storage
- File, camera, microphone, location, or device access

Do not add a dependency that collects or transmits user data without explicitly documenting it.

Never place private API keys, database passwords, or other secrets in frontend code or bundled app assets.

## 6. Android and Play Store impact

For every native plugin, verify:

- Required permissions
- Manifest changes
- Activities, services, receivers, or providers
- Android API requirements
- Background execution behavior
- Foreground service requirements
- Notification behavior
- Storage behavior
- Play Store declarations
- Release-build compatibility

The app must meet the current Google Play target API requirement.

## 7. Architecture

Before implementing a feature, decide:

- Frontend responsibility
- Capacitor responsibility
- Native Android responsibility
- Backend responsibility
- Local storage strategy
- Remote storage strategy
- Source of truth
- Offline behavior
- Authentication
- Error handling
- App restart behavior

Do not introduce a database, state-management library, networking library, or utility library unless the actual requirements justify it.

## 8. Testing

After adding a dependency or changing configuration:

- Build the app
- Test the primary feature
- Test permission denial
- Test offline behavior
- Test app restart
- Test background/foreground transitions
- Test Android Back behavior
- Test on supported Android versions
- Test a release build
- Check Logcat for crashes and warnings

Do not claim success without actually verifying the relevant build or test.

## 9. Change management

Make the smallest necessary change.

Do not refactor unrelated code.

Do not replace existing libraries without comparing trade-offs.

Do not change package name, signing configuration, Android minimum SDK, Capacitor major version, or production API configuration without explicit approval.

Before installing a dependency, provide a short dependency decision report in this format:

Dependency:
Purpose:
Why needed:
Existing alternative:
Compatible version:
Compatibility risks:
Security/privacy risks:
License:
Maintenance status:
Native Android changes:
Play Store impact:
Testing plan:
Decision: Install / Do not install / Need approval

If any important compatibility or security information is unknown, stop and ask for clarification instead of guessing.