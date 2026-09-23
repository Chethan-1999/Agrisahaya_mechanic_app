.PHONY: web sync apk local-phone prod-phone admin admin-prod emulator emulator-reset wait-emulator doctor install launch run local stop-emulator logs clean \
	sync-admin apk-admin install-admin launch-admin run-admin logs-admin clean-admin local-phone-admin local-admin prod-phone-admin

# Override any of these on the command line, e.g. `make run AVD_NAME=Pixel_7`
AVD_NAME     ?= Pixel_6
APP_ID       ?= com.agrisahaya.mechanic
APP_ID_ADMIN ?= com.agrisahaya.admin
BOOT_TIMEOUT ?= 90
BOOT_RETRIES ?= 3
APK_LABEL    ?= $(shell date +%Y%m%d-%H%M%S)

JAVA_HOME    ?= /Applications/Android Studio.app/Contents/jbr/Contents/Home
ANDROID_HOME ?= $(HOME)/Library/Android/sdk
export JAVA_HOME

ADB      := $(ANDROID_HOME)/platform-tools/adb
EMULATOR := $(ANDROID_HOME)/emulator/emulator
EMU_LOG  := /tmp/agrisahaya-emulator.log

## Run the web app in Docker (http://localhost:5173)
web:
	docker compose up --build

## Build the web assets and copy them into the native Android project (mechanic app)
sync:
	npm run build
	npx cap sync android

## Same as `sync`, but for the admin app (separate appId, native project in android-admin/)
sync-admin:
	npm run build
	CAP_APP=admin npx cap sync android

## Boot the Android emulator in the background if it isn't already running.
## -no-snapshot forces a clean cold boot every time: the crash mode we've hit
## before is the emulator booting fine, saving a snapshot, then silently dying
## on the *next* snapshot restore — skipping snapshots entirely removes that
## failure mode instead of trying to detect it after the fact.
emulator:
	@$(ADB) start-server >/dev/null 2>&1
	@if $(ADB) devices | tail -n +2 | grep -q "device$$"; then \
		echo "An emulator/device is already running."; \
	else \
		echo "Booting emulator '$(AVD_NAME)' (clean boot, no snapshot)..."; \
		nohup $(EMULATOR) -avd $(AVD_NAME) -no-snapshot -no-boot-anim > $(EMU_LOG) 2>&1 & \
	fi

## Force-kill any running/wedged emulator and boot fresh with a wiped data
## partition. Use this directly if the emulator is stuck in a bad state that
## wait-emulator's own retries couldn't clear.
emulator-reset:
	@echo "Killing any running emulator..."
	@$(ADB) emu kill >/dev/null 2>&1 || true
	@pkill -f "emulator.*-avd $(AVD_NAME)" >/dev/null 2>&1 || true
	@sleep 2
	@echo "Booting emulator '$(AVD_NAME)' with a wiped data partition..."
	@nohup $(EMULATOR) -avd $(AVD_NAME) -no-snapshot -wipe-data -no-boot-anim > $(EMU_LOG) 2>&1 &

## Block until a device is fully booted. Self-healing: if boot doesn't finish
## within BOOT_TIMEOUT seconds, or the emulator process disappears mid-boot,
## it's killed and retried with a wiped data partition — up to BOOT_RETRIES
## times — instead of hanging forever or leaving a half-booted emulator behind.
wait-emulator: emulator
	@attempt=1; \
	while [ $$attempt -le $(BOOT_RETRIES) ]; do \
		echo "Waiting for boot (attempt $$attempt/$(BOOT_RETRIES), timeout $(BOOT_TIMEOUT)s)..."; \
		$(ADB) wait-for-device; \
		waited=0; \
		while [ "$$($(ADB) shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do \
			if ! $(ADB) devices | tail -n +2 | grep -q "device$$"; then \
				echo "Emulator process disappeared mid-boot."; \
				break; \
			fi; \
			if [ $$waited -ge $(BOOT_TIMEOUT) ]; then \
				echo "Boot timed out after $(BOOT_TIMEOUT)s."; \
				break; \
			fi; \
			sleep 2; waited=$$((waited + 2)); \
		done; \
		if [ "$$($(ADB) shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then \
			echo "Emulator ready."; \
			exit 0; \
		fi; \
		attempt=$$((attempt + 1)); \
		if [ $$attempt -le $(BOOT_RETRIES) ]; then \
			echo "Recovering: killing emulator and retrying with a wiped data partition..."; \
			$(ADB) emu kill >/dev/null 2>&1 || true; \
			pkill -f "emulator.*-avd $(AVD_NAME)" >/dev/null 2>&1 || true; \
			sleep 3; \
			nohup $(EMULATOR) -avd $(AVD_NAME) -no-snapshot -wipe-data -no-boot-anim > $(EMU_LOG) 2>&1 & \
		fi; \
	done; \
	echo "Emulator failed to boot after $(BOOT_RETRIES) attempts. See $(EMU_LOG)."; \
	exit 1

## Report the current state of adb/the emulator/the AVD without changing anything
doctor:
	@echo "AVDs available:"; "$(EMULATOR)" -list-avds || true
	@echo "\nadb devices:"; $(ADB) devices
	@echo "\nEmulator log tail ($(EMU_LOG)):"; tail -n 20 $(EMU_LOG) 2>/dev/null || echo "(no log yet)"

## Build the debug APK and install it on the running emulator/device (mechanic app)
install: sync wait-emulator
	cd android && ./gradlew installDebug

## Same as `install`, but for the admin app
install-admin: sync-admin wait-emulator
	cd android-admin && ./gradlew installDebug

## Build a debug APK for sharing with external testers (no emulator needed).
## Debug-signed, so it installs on any device with "install unknown apps" enabled.
## Output: dist/agrisahaya-<label>.apk, where <label> defaults to a timestamp so
## every run gets a new file. Override with `make apk APK_LABEL=v2`.
apk: sync
	cd android && ./gradlew assembleDebug
	@mkdir -p dist
	cp android/app/build/outputs/apk/debug/app-debug.apk dist/agrisahaya-$(APK_LABEL).apk
	@echo "APK ready: dist/agrisahaya-$(APK_LABEL).apk"

## Same as `apk`, but for the admin app. Output: dist/agrisahaya-admin-<label>.apk
apk-admin: sync-admin
	cd android-admin && ./gradlew assembleDebug
	@mkdir -p dist
	cp android-admin/app/build/outputs/apk/debug/app-debug.apk dist/agrisahaya-admin-$(APK_LABEL).apk
	@echo "APK ready: dist/agrisahaya-admin-$(APK_LABEL).apk"

## Build a phone APK that talks to Firebase emulators on THIS laptop (over the shared
## network/hotspot), then run the emulators here so their logs stream in this terminal.
## Install dist/agrisahaya-local-*.apk on the phone. Rebuild if the laptop's IP changes.
local-phone:
	npm run dev:local -- --apk

## Admin app in the AVD emulator + a mechanic phone APK (dist/agrisahaya-local-*.apk),
## both against the same local Firebase emulators. Phone must share the laptop's network.
local-phone-admin:
	npm run dev:local -- --app admin --phone-apk mechanic

## Same as `local-phone-admin`, but both builds talk to PRODUCTION Firebase (the project in .env):
## admin app in the AVD + a mechanic phone APK (dist/agrisahaya-prod-*.apk). No emulators, no LAN IP;
## the phone works on any network. Exits once the admin app is running.
prod-phone-admin:
	npm run dev:local -- --app admin --phone-apk mechanic --prod

## PRODUCTION: deploy the backend to the Firebase project named in .env, then build a
## phone APK against that same project. Nothing here touches the local emulators.
##   1. deploys Cloud Functions + Firestore rules/indexes to VITE_FIREBASE_PROJECT_ID
##   2. builds the web assets with .env (emulator host forced empty, push enabled unless
##      .env says otherwise), syncs to Android, assembles the APK
## Output: dist/agrisahaya-prod-<label>.apk. Requires `firebase login` and android/app/google-services.json.
PROD_PROJECT = $(shell sed -n 's/^VITE_FIREBASE_PROJECT_ID=\(.*\)/\1/p' .env | tr -d '"\r ')
prod-phone:
	@test -n "$(PROD_PROJECT)" || { echo "VITE_FIREBASE_PROJECT_ID missing in .env"; exit 1; }
	@echo "==> Deploying backend to Firebase project '$(PROD_PROJECT)' (from .env)"
	cd functions && npm install && npm run build
	npx firebase-tools deploy --only functions,firestore --project $(PROD_PROJECT)
	@echo "==> Building production APK against '$(PROD_PROJECT)'"
	VITE_FIREBASE_EMULATOR_HOST= npm run build
	npx cap sync android
	cd android && ./gradlew assembleDebug
	@mkdir -p dist
	cp android/app/build/outputs/apk/debug/app-debug.apk dist/agrisahaya-prod-$(APK_LABEL).apk
	@echo "Production APK ready: dist/agrisahaya-prod-$(APK_LABEL).apk"

## Create the admin in the RUNNING local emulators (one time; it's then saved in emulator-data/).
## Usage: make admin ADMIN_EMAIL=agrisahay@gmail.com ADMIN_PASSWORD='...' [ADMIN_NAME=Admin]
ADMIN_NAME ?= Admin
FIREBASE_PROJECT := $(shell sed -n 's/.*"default": *"\(.*\)".*/\1/p' .firebaserc)
admin:
	@test -n "$(ADMIN_EMAIL)" -a -n "$(ADMIN_PASSWORD)" || { echo "Usage: make admin ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...]"; exit 1; }
	cd functions && FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 GCLOUD_PROJECT=$(FIREBASE_PROJECT) npm run create-admin -- "$(ADMIN_EMAIL)" "$(ADMIN_PASSWORD)" "$(ADMIN_NAME)"

## Create the admin in the PRODUCTION Firebase project from .env (project id = VITE_FIREBASE_PROJECT_ID).
## Needs GOOGLE_APPLICATION_CREDENTIALS (service account key) in functions/.env.
## Usage: make admin-prod ADMIN_EMAIL=... ADMIN_PASSWORD='...' [ADMIN_NAME=Admin]
admin-prod:
	@test -n "$(ADMIN_EMAIL)" -a -n "$(ADMIN_PASSWORD)" || { echo "Usage: make admin-prod ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...]"; exit 1; }
	@test -n "$(PROD_PROJECT)" || { echo "VITE_FIREBASE_PROJECT_ID missing in .env"; exit 1; }
	@echo "Creating admin in PRODUCTION project '$(PROD_PROJECT)'"
	cd functions && env -u FIRESTORE_EMULATOR_HOST -u FIREBASE_AUTH_EMULATOR_HOST GCLOUD_PROJECT=$(PROD_PROJECT) npm run create-admin -- "$(ADMIN_EMAIL)" "$(ADMIN_PASSWORD)" "$(ADMIN_NAME)"

## Launch the installed app (mechanic app)
launch:
	$(ADB) shell am start -n $(APP_ID)/.MainActivity

## Same as `launch`, but for the admin app
launch-admin:
	$(ADB) shell am start -n $(APP_ID_ADMIN)/.MainActivity

## Full flow: build, sync, boot emulator, install, launch (mechanic app)
run: install launch

## Same as `run`, but for the admin app
run-admin: install-admin launch-admin

## Test against Firebase running on THIS laptop instead of production: builds with
## the local emulator host baked in, boots the AVD emulator, installs + launches
## the app, VERIFIES it's still running a few seconds later (not just that install
## succeeded), also saves an installable APK to dist/, then starts the real
## Firebase Emulator Suite so the running app is exercised against real local
## Auth/Firestore/Functions endpoints, not mocks. Same command on Windows:
## `npm run dev:local`.
local:
	npm run dev:local

## Same as `local`, but for the admin app. Output: dist/agrisahaya-admin-local-*.apk
local-admin:
	npm run dev:local -- --app admin

## Stream app logs from the running emulator/device (mechanic app)
logs:
	$(ADB) logcat --pid=$$($(ADB) shell pidof $(APP_ID))

## Same as `logs`, but for the admin app
logs-admin:
	$(ADB) logcat --pid=$$($(ADB) shell pidof $(APP_ID_ADMIN))

## Stop the running emulator
stop-emulator:
	$(ADB) emu kill || true

## Clean native Android build output (mechanic app)
clean:
	cd android && ./gradlew clean

## Same as `clean`, but for the admin app
clean-admin:
	cd android-admin && ./gradlew clean
