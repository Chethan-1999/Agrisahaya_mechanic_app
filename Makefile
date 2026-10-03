.PHONY: web sync icons icons-admin apk local-phone local-apks prod-apks prod-aabs upload-key deploy-prod admin admin-prod emulator emulator-reset wait-emulator doctor install launch run local stop-emulator logs clean \
	sync-admin apk-admin install-admin launch-admin run-admin logs-admin clean-admin local-phone-admin local-admin \
	settings-show settings-set settings-seed settings-pull call sms-test \
	backend-up backend-down backend-restart backend-reset logs-functions logs-functions-prod

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

## Both web apps in a browser against the local backend (start it first: make backend-up):
## http://localhost:5173 (mechanic) and http://localhost:5173/admin/
web:
	VITE_FIREBASE_EMULATOR_HOST=localhost npm run dev

## ── Local backend (Docker) ─────────────────────────────────────────────────────────────────────
## Auth + Firestore + Functions emulators in one container (docker-compose.yml). Functions rebuild on
## save; emulator-data/ is restored on start and saved every 30s and on stop. `make local` uses it too.
## Emulator UI: http://localhost:4000

## Start the local backend in the background and wait until every emulator answers
backend-up:
	docker compose up --detach --build --wait backend

## Stop it (saves emulator-data/ first)
backend-down:
	docker compose stop backend

backend-restart: backend-down backend-up

## Stop it and start again from EMPTY data (emulator-data/ is kept as emulator-data.bak/)
backend-reset: backend-down
	rm -rf emulator-data.bak && mv emulator-data emulator-data.bak 2>/dev/null || true
	$(MAKE) backend-up

## Follow the local Cloud Functions logs (and the rest of the emulators') live
logs-functions:
	docker compose logs --follow --tail=100 backend

## Follow the PRODUCTION Cloud Functions logs live (project from .env). Needs the Google Cloud CLI.
logs-functions-prod:
	@command -v gcloud >/dev/null || { \
		echo "Needs the Google Cloud CLI: brew install --cask google-cloud-sdk, then: gcloud auth login"; \
		echo "Until then, recent (not live) logs: npx firebase-tools functions:log --project $(PROD_PROJECT)"; exit 1; }
	gcloud beta logging tail 'resource.type="cloud_run_revision"' --project $(PROD_PROJECT) \
		--format='value(timestamp,resource.labels.service_name,severity,textPayload,jsonPayload.message)'

## Build the web assets and copy them into the native Android project (mechanic app)
sync: icons
	npm run build
	npx cap sync android

## Same as `sync`, but for the admin app (separate appId, native project in android-admin/)
sync-admin: icons-admin
	npm run build
	CAP_APP=admin npx cap sync android

## Write the launcher icons from assets/ into the (gitignored) native project — mechanic / admin
icons:
	npx capacitor-assets generate --android --assetPath assets --androidProject android

icons-admin:
	npx capacitor-assets generate --android --assetPath assets --androidProject android-admin

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

## LOCAL, production-like: pull the PRODUCTION business settings into .env.pulled (settings-pull), then build two
## phone APKs — mechanic (dist/agrisahaya-local-*.apk) and admin (dist/agrisahaya-admin-local-*.apk) — against the
## Docker backend on THIS laptop, which it (re)starts with those settings and follows the logs of. Test new features
## here without touching production data. Phone must share the laptop's network; rebuild if its IP changes.
## Change a value later: edit .env.pulled (or re-pull), then `make backend-restart` — no APK rebuild needed.
## SKIP_PULL=1 keeps the existing .env.pulled (e.g. offline, or no service account key).
local-apks:
	@if [ -n "$(SKIP_PULL)" ]; then echo "SKIP_PULL set — keeping the current .env.pulled"; else $(MAKE) settings-pull; fi
	npm run dev:local -- --apk --phone-apk admin

## PRODUCTION: build two phone APKs — mechanic (dist/agrisahaya-prod-*.apk) and admin
## (dist/agrisahaya-admin-prod-*.apk) — against the Firebase project in .env. Nothing runs in the
## AVD and no emulators start; the APKs work on any network. Does NOT deploy — see deploy-prod.
## Requires google-services.json in both android/app/ and android-admin/app/.
prod-apks:
	npm run dev:local -- --apk --phone-apk admin --prod

## PRODUCTION: build Google Play bundles of both apps — release-signed with the upload key — against the
## Firebase project in .env. Each run writes release/agrisahaya-mechanic-<stamp>-v<code>.aab and
## release/agrisahaya-admin-<stamp>-v<code>.aab, and replaces that app's files in release/latest/ (.aab, -mapping.txt, -VERSION.txt).
## versionCode goes up automatically every run; override with VERSION_CODE=... / VERSION_NAME=...
## Needs `make upload-key` once. Does NOT deploy — see deploy-prod.
## AAB_APP=mechanic (or admin) builds just that app's bundle.
prod-aabs:
	npm run dev:local -- --aab $(if $(AAB_APP),--app $(AAB_APP))

## One-time: create the Play upload key (keys/upload-keystore.jks + keys/upload-keystore.properties,
## both gitignored) that prod-aabs signs with. Refuses to overwrite an existing key. Back both files up.
upload-key:
	npm run dev:local -- --create-upload-key

## PRODUCTION: deploy Cloud Functions + Firestore rules/indexes to the project in .env
## (VITE_FIREBASE_PROJECT_ID). Requires `firebase login`.
PROD_PROJECT = $(shell sed -n 's/^VITE_FIREBASE_PROJECT_ID=\(.*\)/\1/p' .env | tr -d '"\r ')
deploy-prod:
	@test -n "$(PROD_PROJECT)" || { echo "VITE_FIREBASE_PROJECT_ID missing in .env"; exit 1; }
	@echo "==> Deploying backend to Firebase project '$(PROD_PROJECT)' (from .env)"
	cd functions && npm install && npm run build
	npx firebase-tools deploy --only functions,firestore --project $(PROD_PROJECT)

## Create the admin in the RUNNING local emulators (one time; it's then saved in emulator-data/).
## Usage: make admin ADMIN_EMAIL=agrisahay@gmail.com ADMIN_PASSWORD='...' [ADMIN_NAME=Admin]
ADMIN_NAME ?= Admin
FIREBASE_PROJECT := $(shell sed -n 's/.*"default": *"\(.*\)".*/\1/p' .firebaserc)
admin:
	@test -n "$(ADMIN_EMAIL)" -a -n "$(ADMIN_PASSWORD)" || { echo "Usage: make admin ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...]"; exit 1; }
	cd functions && FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 GCLOUD_PROJECT=$(FIREBASE_PROJECT) npm run create-admin -- "$(ADMIN_EMAIL)" "$(ADMIN_PASSWORD)" "$(ADMIN_NAME)"

## Create the admin in the PRODUCTION Firebase project from .env (project id = VITE_FIREBASE_PROJECT_ID).
## Needs GOOGLE_APPLICATION_CREDENTIALS (service account key) in functions/.env.scripts.
## Usage: make admin-prod ADMIN_EMAIL=... ADMIN_PASSWORD='...' [ADMIN_NAME=Admin]
admin-prod:
	@test -n "$(ADMIN_EMAIL)" -a -n "$(ADMIN_PASSWORD)" || { echo "Usage: make admin-prod ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...]"; exit 1; }
	@test -n "$(PROD_PROJECT)" || { echo "VITE_FIREBASE_PROJECT_ID missing in .env"; exit 1; }
	@echo "Creating admin in PRODUCTION project '$(PROD_PROJECT)'"
	cd functions && env -u FIRESTORE_EMULATOR_HOST -u FIREBASE_AUTH_EMULATOR_HOST GCLOUD_PROJECT=$(PROD_PROJECT) npm run create-admin -- "$(ADMIN_EMAIL)" "$(ADMIN_PASSWORD)" "$(ADMIN_NAME)"

## Call a Cloud Function in the LOCAL emulators without signing in, using the fixed local auth header
## (LOCAL_AUTH_TOKEN / LOCAL_AUTH_UID in functions/.env.local — runs as the local admin by default).
## Usage: make call FN=createJob DATA='{"farmerName":"Ravi",...}' [AS_UID=<uid>] [PHONE=+919000011101]
## (AS_UID acts as that user; PHONE makes them phone-verified, which completeSignup needs.)
call:
	@test -n "$(FN)" || { echo "Usage: make call FN=<function> [DATA='<json>'] [AS_UID=<uid>] [PHONE=<+91...>]"; exit 1; }
	@token=$$(sed -n 's/^LOCAL_AUTH_TOKEN=//p' functions/.env.local); \
	test -n "$$token" || { echo "Set LOCAL_AUTH_TOKEN in functions/.env.local (see functions/.env.local.example)"; exit 1; }; \
	set -- -H "X-Local-Auth: $$token"; \
	if [ -n "$$AS_UID" ]; then set -- "$$@" -H "X-Local-Uid: $$AS_UID"; fi; \
	if [ -n "$$PHONE" ]; then set -- "$$@" -H "X-Local-Phone: $$PHONE"; fi; \
	data="$$DATA"; [ -n "$$data" ] || data='{}'; \
	printf '{"data": %s}' "$$data" | curl -sS -X POST "http://localhost:5001/$(FIREBASE_PROJECT)/asia-south1/$(FN)" \
		-H 'Content-Type: application/json' "$$@" --data-binary @-; echo

## Send one test SMS through the SMS Gateway for Android phone, straight to its cloud relay (no functions involved),
## with the credentials in functions/.secret.local. Checks the gateway phone is online and sending.
## Usage: make sms-test PHONE=+91XXXXXXXXXX [TEXT='...']
sms-test:
	@test -n "$(PHONE)" || { echo "Usage: make sms-test PHONE=+91XXXXXXXXXX [TEXT='...']"; exit 1; }
	@user=$$(sed -n 's/^SMS_GATE_USERNAME=//p' functions/.secret.local 2>/dev/null); \
	pass=$$(sed -n 's/^SMS_GATE_PASSWORD=//p' functions/.secret.local 2>/dev/null); \
	test -n "$$user" -a -n "$$pass" || { echo "Set SMS_GATE_USERNAME/SMS_GATE_PASSWORD in functions/.secret.local (see functions/.secret.local.example)"; exit 1; }; \
	text="$${TEXT:-AgriSahaya SMS test}"; \
	node -e 'console.log(JSON.stringify({ textMessage: { text: process.argv[1] }, phoneNumbers: [process.argv[2]] }))' "$$text" "$(PHONE)" \
		| curl -sS -X POST -u "$$user:$$pass" -H 'Content-Type: application/json' --data-binary @- https://api.sms-gate.app/3rdparty/v1/messages; echo

## PRODUCTION business settings (Firestore config/app; keys and defaults in functions/src/shared/settings.ts).
## Local testing uses SETTING_* in .env instead. Needs the service account key in functions/.env.scripts.
## Usage: make settings-show | make settings-set KEY=otpMaxSendsPerHour VALUE=4 | make settings-seed
SETTINGS_ENV = env -u FIRESTORE_EMULATOR_HOST -u FIREBASE_AUTH_EMULATOR_HOST GCLOUD_PROJECT=$(PROD_PROJECT)
settings-show:
	cd functions && $(SETTINGS_ENV) npm run --silent settings -- show

settings-set:
	@test -n "$(KEY)" -a -n "$(VALUE)" || { echo "Usage: make settings-set KEY=<setting> VALUE=<value>"; exit 1; }
	cd functions && $(SETTINGS_ENV) npm run --silent settings -- set "$(KEY)" "$(VALUE)"

## Writes every setting that isn't set yet with its default (never overwrites one that is).
settings-seed:
	cd functions && $(SETTINGS_ENV) npm run --silent settings -- seed

## Copy the PRODUCTION settings into .env.pulled (repo root), which the local Docker backend loads after .env.
## Re-running refreshes the generated block and keeps any lines you added below it. Apply: make backend-restart.
## Go back to plain .env settings locally: delete .env.pulled, then make backend-restart.
settings-pull:
	cd functions && $(SETTINGS_ENV) npm run --silent settings -- pull

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
