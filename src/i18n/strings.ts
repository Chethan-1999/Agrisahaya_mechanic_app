export type LanguageCode = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ml';

export const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ml', label: 'മലയാളം' },
];

/**
 * Covers the technician-facing journey (auth, dashboard, jobs, profile
 * requests) — the surface that actually needs non-English support. The
 * admin console stays in English; see Blueprint §04/§14.
 *
 * hi (Hindi) has been checked carefully. kn/ta/te/ml (Kannada, Tamil,
 * Telugu, Malayalam) are a solid first pass but have NOT been reviewed by a
 * native speaker — flagged as an open item in the Blueprint. Get a native
 * speaker to read through these before relying on them with real
 * technicians, especially the agricultural/technical terms.
 */
export type StringKey =
  | 'technicianLogin'
  | 'technicianSignup'
  | 'technicianAccess'
  | 'back'
  | 'mobileNumber'
  | 'otp'
  | 'sendOtp'
  | 'verifyButton'
  | 'submitButton'
  | 'codeSentBySms'
  | 'enterValidPhone'
  | 'sendCodeFirst'
  | 'phoneVerifiedCompleteProfile'
  | 'registeredMessage'
  | 'pendingHeading'
  | 'rejectedHeading'
  | 'inactiveHeading'
  | 'pendingBody'
  | 'rejectedBody'
  | 'inactiveBody'
  | 'supportLabel'
  | 'welcome'
  | 'jobsNav'
  | 'profileNav'
  | 'requestChangeNav'
  | 'announcementsNav'
  | 'announcementsTitle'
  | 'noAnnouncementsYet'
  | 'logout'
  | 'logoutConfirm'
  | 'jobsTitle'
  | 'noJobsYet'
  | 'task'
  | 'farmerLabel'
  | 'farmerPhoneLabel'
  | 'descriptionLabel'
  | 'statusLabel'
  | 'accept'
  | 'decline'
  | 'markComplete'
  | 'declineConfirm'
  | 'jobAcceptedToast'
  | 'jobDeclinedToast'
  | 'jobCompletedToast'
  | 'statusPending'
  | 'statusAccepted'
  | 'statusCompleted'
  | 'statusCancelled'
  | 'statusDeclined'
  | 'statusOpen'
  | 'fullName'
  | 'village'
  | 'district'
  | 'state'
  | 'pincode'
  | 'address'
  | 'landmarkOptional'
  | 'age'
  | 'experience'
  | 'requestChangeTitle'
  | 'requestChangeHint'
  | 'reasonForChange'
  | 'submitRequestButton'
  | 'requestSubmittedToast'
  | 'giveReasonError'
  | 'changeAtLeastOneError'
  | 'changesUsedLabel'
  | 'changesCapReachedError'
  | 'languageLabel';

const en: Record<StringKey, string> = {
  technicianLogin: 'Technician Login',
  technicianSignup: 'Technician Sign Up',
  technicianAccess: 'Technician Access',
  back: 'Back',
  mobileNumber: 'Mobile Number',
  otp: 'OTP',
  sendOtp: 'Send OTP',
  verifyButton: 'Verify',
  submitButton: 'Submit',
  codeSentBySms: 'Code sent by SMS.',
  enterValidPhone: 'Enter a valid 10 digit phone number.',
  sendCodeFirst: 'Send yourself a code first.',
  phoneVerifiedCompleteProfile: 'Phone verified. Complete your profile to finish registering.',
  registeredMessage: 'Registered — you will be notified once an admin verifies your account.',
  pendingHeading: 'Account pending approval',
  rejectedHeading: 'Account not approved',
  inactiveHeading: 'Account deactivated',
  pendingBody: "You'll be notified in the app once your payment and details are verified by admin.",
  rejectedBody: 'Your registration was not approved. Contact support for details.',
  inactiveBody: 'Your account has been deactivated. Contact support to reactivate it.',
  supportLabel: 'Support',
  welcome: 'Welcome',
  jobsNav: 'Jobs',
  profileNav: 'Profile',
  requestChangeNav: 'Request Change',
  announcementsNav: 'Announcements',
  announcementsTitle: 'Announcements',
  noAnnouncementsYet: 'No announcements yet.',
  logout: 'Logout',
  logoutConfirm: 'Logout from technician account?',
  jobsTitle: 'Jobs',
  noJobsYet: 'No jobs yet.',
  task: 'Task',
  farmerLabel: 'Farmer',
  farmerPhoneLabel: 'Farmer Phone',
  descriptionLabel: 'Description',
  statusLabel: 'Status',
  accept: 'Accept',
  decline: 'Decline',
  markComplete: 'Mark Complete',
  declineConfirm: 'Decline this job? Admin will reassign it to someone else.',
  jobAcceptedToast: 'Job accepted.',
  jobDeclinedToast: 'Job declined.',
  jobCompletedToast: 'Job marked complete.',
  statusPending: 'Pending',
  statusAccepted: 'Accepted',
  statusCompleted: 'Completed',
  statusCancelled: 'Cancelled',
  statusDeclined: 'Declined',
  statusOpen: 'Open',
  fullName: 'Full Name',
  village: 'Village',
  district: 'District',
  state: 'State',
  pincode: 'Pincode',
  address: 'Address',
  landmarkOptional: 'Landmark (optional)',
  age: 'Age',
  experience: 'Years of Experience',
  requestChangeTitle: 'Request a Profile Change',
  requestChangeHint: 'Edit the fields you want changed, then explain why. Admin reviews it before it takes effect.',
  reasonForChange: 'Reason for this change',
  submitRequestButton: 'Submit Request',
  requestSubmittedToast: 'Request submitted — you will be notified once it is reviewed.',
  giveReasonError: 'Tell admin why you are requesting this change.',
  changeAtLeastOneError: 'Change at least one field first.',
  changesUsedLabel: 'Changes used',
  changesCapReachedError: "You've used all your allowed profile-change requests.",
  languageLabel: 'Language',
};

const hi: Record<StringKey, string> = {
  technicianLogin: 'टेक्नीशियन लॉगिन',
  technicianSignup: 'टेक्नीशियन साइन अप',
  technicianAccess: 'टेक्नीशियन एक्सेस',
  back: 'वापस',
  mobileNumber: 'मोबाइल नंबर',
  otp: 'ओटीपी',
  sendOtp: 'ओटीपी भेजें',
  verifyButton: 'सत्यापित करें',
  submitButton: 'सबमिट करें',
  codeSentBySms: 'कोड एसएमएस से भेज दिया गया है।',
  enterValidPhone: 'सही 10 अंकों का मोबाइल नंबर डालें।',
  sendCodeFirst: 'पहले खुद को कोड भेजें।',
  phoneVerifiedCompleteProfile: 'मोबाइल नंबर सत्यापित हो गया। रजिस्ट्रेशन पूरा करने के लिए प्रोफाइल भरें।',
  registeredMessage: 'रजिस्ट्रेशन हो गया — एडमिन के खाता सत्यापित करने पर आपको सूचना मिलेगी।',
  pendingHeading: 'खाता स्वीकृति के इंतज़ार में',
  rejectedHeading: 'खाता स्वीकृत नहीं हुआ',
  inactiveHeading: 'खाता निष्क्रिय कर दिया गया है',
  pendingBody: 'एडमिन द्वारा भुगतान और जानकारी सत्यापित होने पर ऐप में सूचना मिलेगी।',
  rejectedBody: 'आपका रजिस्ट्रेशन स्वीकृत नहीं हुआ। जानकारी के लिए सहायता से संपर्क करें।',
  inactiveBody: 'आपका खाता निष्क्रिय कर दिया गया है। दोबारा चालू करने के लिए सहायता से संपर्क करें।',
  supportLabel: 'सहायता',
  welcome: 'स्वागत है',
  jobsNav: 'जॉब्स',
  profileNav: 'प्रोफाइल',
  requestChangeNav: 'बदलाव का अनुरोध',
  announcementsNav: 'घोषणाएं',
  announcementsTitle: 'घोषणाएं',
  noAnnouncementsYet: 'अभी तक कोई घोषणा नहीं है।',
  logout: 'लॉगआउट',
  logoutConfirm: 'टेक्नीशियन खाते से लॉगआउट करें?',
  jobsTitle: 'जॉब्स',
  noJobsYet: 'अभी तक कोई जॉब नहीं है।',
  task: 'कार्य',
  farmerLabel: 'किसान',
  farmerPhoneLabel: 'किसान का फ़ोन नंबर',
  descriptionLabel: 'विवरण',
  statusLabel: 'स्थिति',
  accept: 'स्वीकार करें',
  decline: 'अस्वीकार करें',
  markComplete: 'पूर्ण के रूप में चिह्नित करें',
  declineConfirm: 'इस जॉब को अस्वीकार करें? एडमिन इसे किसी और को सौंप देंगे।',
  jobAcceptedToast: 'जॉब स्वीकार कर लिया गया।',
  jobDeclinedToast: 'जॉब अस्वीकार कर दिया गया।',
  jobCompletedToast: 'जॉब पूर्ण के रूप में चिह्नित किया गया।',
  statusPending: 'लंबित',
  statusAccepted: 'स्वीकृत',
  statusCompleted: 'पूर्ण',
  statusCancelled: 'रद्द',
  statusDeclined: 'अस्वीकृत',
  statusOpen: 'खुला',
  fullName: 'पूरा नाम',
  village: 'गांव',
  district: 'जिला',
  state: 'राज्य',
  pincode: 'पिनकोड',
  address: 'पता',
  landmarkOptional: 'लैंडमार्क (वैकल्पिक)',
  age: 'उम्र',
  experience: 'अनुभव (वर्षों में)',
  requestChangeTitle: 'प्रोफाइल में बदलाव का अनुरोध करें',
  requestChangeHint: 'जो जानकारी बदलनी है उसे भरें, फिर कारण बताएं। एडमिन के स्वीकृत करने के बाद ही यह लागू होगा।',
  reasonForChange: 'इस बदलाव का कारण',
  submitRequestButton: 'अनुरोध भेजें',
  requestSubmittedToast: 'अनुरोध भेज दिया गया — समीक्षा होने पर आपको सूचना मिलेगी।',
  giveReasonError: 'एडमिन को बताएं कि आप यह बदलाव क्यों चाहते हैं।',
  changeAtLeastOneError: 'पहले कम से कम एक जानकारी बदलें।',
  changesUsedLabel: 'उपयोग किए गए बदलाव',
  changesCapReachedError: 'आपने अपने सभी स्वीकृत प्रोफाइल-बदलाव अनुरोध उपयोग कर लिए हैं।',
  languageLabel: 'भाषा',
};

const kn: Record<StringKey, string> = {
  technicianLogin: 'ಟೆಕ್ನಿಷಿಯನ್ ಲಾಗಿನ್',
  technicianSignup: 'ಟೆಕ್ನಿಷಿಯನ್ ಸೈನ್ ಅಪ್',
  technicianAccess: 'ಟೆಕ್ನಿಷಿಯನ್ ಪ್ರವೇಶ',
  back: 'ಹಿಂದೆ',
  mobileNumber: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
  otp: 'ಒಟಿಪಿ',
  sendOtp: 'ಒಟಿಪಿ ಕಳುಹಿಸಿ',
  verifyButton: 'ಪರಿಶೀಲಿಸಿ',
  submitButton: 'ಸಲ್ಲಿಸಿ',
  codeSentBySms: 'ಕೋಡ್ ಅನ್ನು ಎಸ್‌ಎಂಎಸ್ ಮೂಲಕ ಕಳುಹಿಸಲಾಗಿದೆ.',
  enterValidPhone: 'ಸರಿಯಾದ 10 ಅಂಕಿಗಳ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.',
  sendCodeFirst: 'ಮೊದಲು ನಿಮಗೆ ಕೋಡ್ ಕಳುಹಿಸಿ.',
  phoneVerifiedCompleteProfile: 'ಫೋನ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಲು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಭರ್ತಿ ಮಾಡಿ.',
  registeredMessage: 'ನೋಂದಣಿ ಆಗಿದೆ — ಅಡ್ಮಿನ್ ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಪರಿಶೀಲಿಸಿದ ನಂತರ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು.',
  pendingHeading: 'ಖಾತೆ ಅನುಮೋದನೆಗೆ ಬಾಕಿ ಇದೆ',
  rejectedHeading: 'ಖಾತೆ ಅನುಮೋದನೆಯಾಗಿಲ್ಲ',
  inactiveHeading: 'ಖಾತೆ ನಿಷ್ಕ್ರಿಯಗೊಂಡಿದೆ',
  pendingBody: 'ಅಡ್ಮಿನ್ ಪಾವತಿ ಮತ್ತು ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿದ ನಂತರ ಆ್ಯಪ್‌ನಲ್ಲಿ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು.',
  rejectedBody: 'ನಿಮ್ಮ ನೋಂದಣಿ ಅನುಮೋದನೆಯಾಗಿಲ್ಲ. ವಿವರಗಳಿಗಾಗಿ ಸಹಾಯವಾಣಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  inactiveBody: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ. ಮರುಸಕ್ರಿಯಗೊಳಿಸಲು ಸಹಾಯವಾಣಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  supportLabel: 'ಸಹಾಯವಾಣಿ',
  welcome: 'ಸ್ವಾಗತ',
  jobsNav: 'ಕೆಲಸಗಳು',
  profileNav: 'ಪ್ರೊಫೈಲ್',
  requestChangeNav: 'ಬದಲಾವಣೆ ಕೋರಿಕೆ',
  announcementsNav: 'ಪ್ರಕಟಣೆಗಳು',
  announcementsTitle: 'ಪ್ರಕಟಣೆಗಳು',
  noAnnouncementsYet: 'ಇನ್ನೂ ಯಾವುದೇ ಪ್ರಕಟಣೆ ಇಲ್ಲ.',
  logout: 'ಲಾಗ್ ಔಟ್',
  logoutConfirm: 'ಟೆಕ್ನಿಷಿಯನ್ ಖಾತೆಯಿಂದ ಲಾಗ್ ಔಟ್ ಮಾಡಬೇಕೇ?',
  jobsTitle: 'ಕೆಲಸಗಳು',
  noJobsYet: 'ಇನ್ನೂ ಯಾವುದೇ ಕೆಲಸ ಇಲ್ಲ.',
  task: 'ಕೆಲಸ',
  farmerLabel: 'ರೈತ',
  farmerPhoneLabel: 'ರೈತರ ಫೋನ್ ಸಂಖ್ಯೆ',
  descriptionLabel: 'ವಿವರಣೆ',
  statusLabel: 'ಸ್ಥಿತಿ',
  accept: 'ಒಪ್ಪಿಕೊಳ್ಳಿ',
  decline: 'ನಿರಾಕರಿಸಿ',
  markComplete: 'ಪೂರ್ಣಗೊಂಡಿದೆ ಎಂದು ಗುರುತಿಸಿ',
  declineConfirm: 'ಈ ಕೆಲಸವನ್ನು ನಿರಾಕರಿಸುವುದೇ? ಅಡ್ಮಿನ್ ಇದನ್ನು ಇನ್ನೊಬ್ಬರಿಗೆ ನಿಯೋಜಿಸುತ್ತಾರೆ.',
  jobAcceptedToast: 'ಕೆಲಸವನ್ನು ಒಪ್ಪಿಕೊಳ್ಳಲಾಗಿದೆ.',
  jobDeclinedToast: 'ಕೆಲಸವನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ.',
  jobCompletedToast: 'ಕೆಲಸ ಪೂರ್ಣಗೊಂಡಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ.',
  statusPending: 'ಬಾಕಿ ಇದೆ',
  statusAccepted: 'ಒಪ್ಪಿಗೆಯಾಗಿದೆ',
  statusCompleted: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
  statusCancelled: 'ರದ್ದಾಗಿದೆ',
  statusDeclined: 'ನಿರಾಕರಿಸಲಾಗಿದೆ',
  statusOpen: 'ತೆರೆದಿದೆ',
  fullName: 'ಪೂರ್ಣ ಹೆಸರು',
  village: 'ಗ್ರಾಮ',
  district: 'ಜಿಲ್ಲೆ',
  state: 'ರಾಜ್ಯ',
  pincode: 'ಪಿನ್‌ಕೋಡ್',
  address: 'ವಿಳಾಸ',
  landmarkOptional: 'ಗುರುತು ಸ್ಥಳ (ಐಚ್ಛಿಕ)',
  age: 'ವಯಸ್ಸು',
  experience: 'ಅನುಭವ (ವರ್ಷಗಳಲ್ಲಿ)',
  requestChangeTitle: 'ಪ್ರೊಫೈಲ್ ಬದಲಾವಣೆಗೆ ಕೋರಿಕೆ',
  requestChangeHint: 'ಬದಲಾಯಿಸಬೇಕಾದ ವಿವರಗಳನ್ನು ತಿದ್ದಿ, ನಂತರ ಕಾರಣ ತಿಳಿಸಿ. ಅಡ್ಮಿನ್ ಪರಿಶೀಲಿಸಿದ ನಂತರವೇ ಇದು ಜಾರಿಗೆ ಬರುತ್ತದೆ.',
  reasonForChange: 'ಈ ಬದಲಾವಣೆಗೆ ಕಾರಣ',
  submitRequestButton: 'ಕೋರಿಕೆ ಸಲ್ಲಿಸಿ',
  requestSubmittedToast: 'ಕೋರಿಕೆ ಸಲ್ಲಿಸಲಾಗಿದೆ — ಪರಿಶೀಲನೆಯಾದ ನಂತರ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು.',
  giveReasonError: 'ಈ ಬದಲಾವಣೆಯನ್ನು ಏಕೆ ಕೋರುತ್ತಿದ್ದೀರಿ ಎಂದು ಅಡ್ಮಿನ್‌ಗೆ ತಿಳಿಸಿ.',
  changeAtLeastOneError: 'ಮೊದಲು ಕನಿಷ್ಠ ಒಂದು ವಿವರವನ್ನು ಬದಲಾಯಿಸಿ.',
  changesUsedLabel: 'ಬಳಸಿದ ಬದಲಾವಣೆಗಳು',
  changesCapReachedError: 'ನೀವು ಅನುಮತಿಸಲಾದ ಎಲ್ಲಾ ಪ್ರೊಫೈಲ್-ಬದಲಾವಣೆ ಕೋರಿಕೆಗಳನ್ನು ಬಳಸಿದ್ದೀರಿ.',
  languageLabel: 'ಭಾಷೆ',
};

const ta: Record<StringKey, string> = {
  technicianLogin: 'டெக்னீஷியன் லாகின்',
  technicianSignup: 'டெக்னீஷியன் பதிவு',
  technicianAccess: 'டெக்னீஷியன் அணுகல்',
  back: 'பின்செல்',
  mobileNumber: 'மொபைல் எண்',
  otp: 'ஓடிபி',
  sendOtp: 'ஓடிபி அனுப்பு',
  verifyButton: 'சரிபார்க்க',
  submitButton: 'சமர்ப்பி',
  codeSentBySms: 'குறியீடு எஸ்எம்எஸ் மூலம் அனுப்பப்பட்டது.',
  enterValidPhone: 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.',
  sendCodeFirst: 'முதலில் உங்களுக்கு குறியீடு அனுப்புங்கள்.',
  phoneVerifiedCompleteProfile: 'மொபைல் எண் சரிபார்க்கப்பட்டது. பதிவை முடிக்க உங்கள் விவரங்களை நிரப்பவும்.',
  registeredMessage: 'பதிவு முடிந்தது — நிர்வாகி உங்கள் கணக்கை சரிபார்த்தவுடன் உங்களுக்கு தெரிவிக்கப்படும்.',
  pendingHeading: 'கணக்கு ஒப்புதலுக்காக காத்திருக்கிறது',
  rejectedHeading: 'கணக்கு ஏற்கப்படவில்லை',
  inactiveHeading: 'கணக்கு முடக்கப்பட்டது',
  pendingBody: 'நிர்வாகி பணம் மற்றும் விவரங்களை சரிபார்த்தவுடன் ஆப்பில் உங்களுக்கு தெரிவிக்கப்படும்.',
  rejectedBody: 'உங்கள் பதிவு ஏற்கப்படவில்லை. விவரங்களுக்கு உதவி மையத்தை தொடர்பு கொள்ளவும்.',
  inactiveBody: 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. மீண்டும் இயக்க உதவி மையத்தை தொடர்பு கொள்ளவும்.',
  supportLabel: 'உதவி மையம்',
  welcome: 'வரவேற்பு',
  jobsNav: 'வேலைகள்',
  profileNav: 'சுயவிவரம்',
  requestChangeNav: 'மாற்றம் கோரிக்கை',
  announcementsNav: 'அறிவிப்புகள்',
  announcementsTitle: 'அறிவிப்புகள்',
  noAnnouncementsYet: 'இதுவரை அறிவிப்புகள் இல்லை.',
  logout: 'லாக் அவுட்',
  logoutConfirm: 'டெக்னீஷியன் கணக்கிலிருந்து லாக் அவுட் செய்யவா?',
  jobsTitle: 'வேலைகள்',
  noJobsYet: 'இதுவரை வேலைகள் இல்லை.',
  task: 'பணி',
  farmerLabel: 'விவசாயி',
  farmerPhoneLabel: 'விவசாயியின் தொலைபேசி எண்',
  descriptionLabel: 'விவரம்',
  statusLabel: 'நிலை',
  accept: 'ஏற்றுக்கொள்',
  decline: 'நிராகரி',
  markComplete: 'முடிந்தது என குறி',
  declineConfirm: 'இந்த வேலையை நிராகரிக்கவா? நிர்வாகி இதை வேறொருவருக்கு ஒதுக்குவார்.',
  jobAcceptedToast: 'வேலை ஏற்றுக்கொள்ளப்பட்டது.',
  jobDeclinedToast: 'வேலை நிராகரிக்கப்பட்டது.',
  jobCompletedToast: 'வேலை முடிந்தது என குறிக்கப்பட்டது.',
  statusPending: 'நிலுவையில்',
  statusAccepted: 'ஏற்கப்பட்டது',
  statusCompleted: 'முடிந்தது',
  statusCancelled: 'ரத்து செய்யப்பட்டது',
  statusDeclined: 'நிராகரிக்கப்பட்டது',
  statusOpen: 'திறந்துள்ளது',
  fullName: 'முழுப் பெயர்',
  village: 'கிராமம்',
  district: 'மாவட்டம்',
  state: 'மாநிலம்',
  pincode: 'அஞ்சல் குறியீடு',
  address: 'முகவரி',
  landmarkOptional: 'அடையாளக் குறி (விருப்பம்)',
  age: 'வயது',
  experience: 'அனுபவம் (ஆண்டுகளில்)',
  requestChangeTitle: 'சுயவிவர மாற்றத்திற்கு கோரிக்கை',
  requestChangeHint: 'மாற்ற வேண்டிய விவரங்களை திருத்தி, பின்னர் காரணத்தை விளக்கவும். நிர்வாகி பரிசீலித்த பின்னரே இது நடைமுறைக்கு வரும்.',
  reasonForChange: 'இந்த மாற்றத்திற்கான காரணம்',
  submitRequestButton: 'கோரிக்கையை சமர்ப்பி',
  requestSubmittedToast: 'கோரிக்கை சமர்ப்பிக்கப்பட்டது — பரிசீலிக்கப்பட்டவுடன் உங்களுக்கு தெரிவிக்கப்படும்.',
  giveReasonError: 'இந்த மாற்றத்தை ஏன் கோருகிறீர்கள் என்பதை நிர்வாகிக்கு தெரிவிக்கவும்.',
  changeAtLeastOneError: 'முதலில் குறைந்தது ஒரு விவரத்தையாவது மாற்றவும்.',
  changesUsedLabel: 'பயன்படுத்திய மாற்றங்கள்',
  changesCapReachedError: 'அனுமதிக்கப்பட்ட அனைத்து சுயவிவர மாற்ற கோரிக்கைகளையும் நீங்கள் பயன்படுத்திவிட்டீர்கள்.',
  languageLabel: 'மொழி',
};

const te: Record<StringKey, string> = {
  technicianLogin: 'టెక్నీషియన్ లాగిన్',
  technicianSignup: 'టెక్నీషియన్ సైన్ అప్',
  technicianAccess: 'టెక్నీషియన్ యాక్సెస్',
  back: 'వెనక్కి',
  mobileNumber: 'మొబైల్ నంబర్',
  otp: 'ఓటీపీ',
  sendOtp: 'ఓటీపీ పంపండి',
  verifyButton: 'ధృవీకరించండి',
  submitButton: 'సమర్పించండి',
  codeSentBySms: 'కోడ్ ఎస్ఎంఎస్ ద్వారా పంపబడింది.',
  enterValidPhone: 'సరైన 10 అంకెల ఫోన్ నంబర్ నమోదు చేయండి.',
  sendCodeFirst: 'ముందుగా మీకు కోడ్ పంపండి.',
  phoneVerifiedCompleteProfile: 'ఫోన్ నంబర్ ధృవీకరించబడింది. నమోదును పూర్తి చేయడానికి మీ ప్రొఫైల్ నింపండి.',
  registeredMessage: 'నమోదు పూర్తయింది — అడ్మిన్ మీ ఖాతాను ధృవీకరించిన తర్వాత మీకు తెలియజేయబడుతుంది.',
  pendingHeading: 'ఖాతా ఆమోదం కోసం వేచి ఉంది',
  rejectedHeading: 'ఖాతా ఆమోదించబడలేదు',
  inactiveHeading: 'ఖాతా నిష్క్రియం చేయబడింది',
  pendingBody: 'అడ్మిన్ చెల్లింపు మరియు వివరాలను ధృవీకరించిన తర్వాత యాప్‌లో మీకు తెలియజేయబడుతుంది.',
  rejectedBody: 'మీ నమోదు ఆమోదించబడలేదు. వివరాల కోసం సహాయ కేంద్రాన్ని సంప్రదించండి.',
  inactiveBody: 'మీ ఖాతా నిష్క్రియం చేయబడింది. మళ్లీ సక్రియం చేయడానికి సహాయ కేంద్రాన్ని సంప్రదించండి.',
  supportLabel: 'సహాయ కేంద్రం',
  welcome: 'స్వాగతం',
  jobsNav: 'పనులు',
  profileNav: 'ప్రొఫైల్',
  requestChangeNav: 'మార్పు అభ్యర్థన',
  announcementsNav: 'ప్రకటనలు',
  announcementsTitle: 'ప్రకటనలు',
  noAnnouncementsYet: 'ఇంకా ప్రకటనలు లేవు.',
  logout: 'లాగ్ అవుట్',
  logoutConfirm: 'టెక్నీషియన్ ఖాతా నుండి లాగ్ అవుట్ చేయాలా?',
  jobsTitle: 'పనులు',
  noJobsYet: 'ఇంకా పనులు లేవు.',
  task: 'పని',
  farmerLabel: 'రైతు',
  farmerPhoneLabel: 'రైతు ఫోన్ నంబర్',
  descriptionLabel: 'వివరణ',
  statusLabel: 'స్థితి',
  accept: 'అంగీకరించండి',
  decline: 'తిరస్కరించండి',
  markComplete: 'పూర్తయినట్లు గుర్తించండి',
  declineConfirm: 'ఈ పనిని తిరస్కరించాలా? అడ్మిన్ దీన్ని మరొకరికి కేటాయిస్తారు.',
  jobAcceptedToast: 'పని అంగీకరించబడింది.',
  jobDeclinedToast: 'పని తిరస్కరించబడింది.',
  jobCompletedToast: 'పని పూర్తయినట్లు గుర్తించబడింది.',
  statusPending: 'పెండింగ్‌లో ఉంది',
  statusAccepted: 'అంగీకరించబడింది',
  statusCompleted: 'పూర్తయింది',
  statusCancelled: 'రద్దు చేయబడింది',
  statusDeclined: 'తిరస్కరించబడింది',
  statusOpen: 'తెరిచి ఉంది',
  fullName: 'పూర్తి పేరు',
  village: 'గ్రామం',
  district: 'జిల్లా',
  state: 'రాష్ట్రం',
  pincode: 'పిన్‌కోడ్',
  address: 'చిరునామా',
  landmarkOptional: 'గుర్తింపు స్థలం (ఐచ్ఛికం)',
  age: 'వయస్సు',
  experience: 'అనుభవం (సంవత్సరాలలో)',
  requestChangeTitle: 'ప్రొఫైల్ మార్పు కోసం అభ్యర్థన',
  requestChangeHint: 'మార్చాల్సిన వివరాలను సవరించి, తర్వాత కారణం చెప్పండి. అడ్మిన్ సమీక్షించిన తర్వాతే ఇది అమలులోకి వస్తుంది.',
  reasonForChange: 'ఈ మార్పుకు కారణం',
  submitRequestButton: 'అభ్యర్థన సమర్పించండి',
  requestSubmittedToast: 'అభ్యర్థన సమర్పించబడింది — సమీక్షించిన తర్వాత మీకు తెలియజేయబడుతుంది.',
  giveReasonError: 'మీరు ఈ మార్పును ఎందుకు అభ్యర్థిస్తున్నారో అడ్మిన్‌కు తెలియజేయండి.',
  changeAtLeastOneError: 'ముందుగా కనీసం ఒక వివరాన్ని మార్చండి.',
  changesUsedLabel: 'ఉపయోగించిన మార్పులు',
  changesCapReachedError: 'మీరు అనుమతించిన అన్ని ప్రొఫైల్-మార్పు అభ్యర్థనలను ఉపయోగించారు.',
  languageLabel: 'భాష',
};

const ml: Record<StringKey, string> = {
  technicianLogin: 'ടെക്നീഷ്യൻ ലോഗിൻ',
  technicianSignup: 'ടെക്നീഷ്യൻ സൈൻ അപ്പ്',
  technicianAccess: 'ടെക്നീഷ്യൻ ആക്സസ്',
  back: 'തിരികെ',
  mobileNumber: 'മൊബൈൽ നമ്പർ',
  otp: 'ഒടിപി',
  sendOtp: 'ഒടിപി അയയ്ക്കുക',
  verifyButton: 'പരിശോധിക്കുക',
  submitButton: 'സമർപ്പിക്കുക',
  codeSentBySms: 'കോഡ് എസ്എംഎസ് വഴി അയച്ചു.',
  enterValidPhone: 'ശരിയായ 10 അക്ക ഫോൺ നമ്പർ നൽകുക.',
  sendCodeFirst: 'ആദ്യം നിങ്ങൾക്ക് ഒരു കോഡ് അയയ്ക്കുക.',
  phoneVerifiedCompleteProfile: 'ഫോൺ നമ്പർ പരിശോധിച്ചു. രജിസ്ട്രേഷൻ പൂർത്തിയാക്കാൻ നിങ്ങളുടെ പ്രൊഫൈൽ പൂരിപ്പിക്കുക.',
  registeredMessage: 'രജിസ്ട്രേഷൻ പൂർത്തിയായി — അഡ്മിൻ നിങ്ങളുടെ അക്കൗണ്ട് പരിശോധിച്ച ശേഷം അറിയിക്കും.',
  pendingHeading: 'അക്കൗണ്ട് അംഗീകാരത്തിനായി കാത്തിരിക്കുന്നു',
  rejectedHeading: 'അക്കൗണ്ട് അംഗീകരിച്ചില്ല',
  inactiveHeading: 'അക്കൗണ്ട് നിർജ്ജീവമാക്കി',
  pendingBody: 'അഡ്മിൻ പേയ്‌മെന്റും വിവരങ്ങളും പരിശോധിച്ച ശേഷം ആപ്പിൽ നിങ്ങളെ അറിയിക്കും.',
  rejectedBody: 'നിങ്ങളുടെ രജിസ്ട്രേഷൻ അംഗീകരിച്ചില്ല. വിവരങ്ങൾക്ക് സപ്പോർട്ടുമായി ബന്ധപ്പെടുക.',
  inactiveBody: 'നിങ്ങളുടെ അക്കൗണ്ട് നിർജ്ജീവമാക്കിയിരിക്കുന്നു. വീണ്ടും സജീവമാക്കാൻ സപ്പോർട്ടുമായി ബന്ധപ്പെടുക.',
  supportLabel: 'സപ്പോർട്ട്',
  welcome: 'സ്വാഗതം',
  jobsNav: 'ജോലികൾ',
  profileNav: 'പ്രൊഫൈൽ',
  requestChangeNav: 'മാറ്റത്തിനുള്ള അഭ്യർത്ഥന',
  announcementsNav: 'അറിയിപ്പുകൾ',
  announcementsTitle: 'അറിയിപ്പുകൾ',
  noAnnouncementsYet: 'ഇതുവരെ അറിയിപ്പുകൾ ഇല്ല.',
  logout: 'ലോഗ് ഔട്ട്',
  logoutConfirm: 'ടെക്നീഷ്യൻ അക്കൗണ്ടിൽ നിന്ന് ലോഗ് ഔട്ട് ചെയ്യണോ?',
  jobsTitle: 'ജോലികൾ',
  noJobsYet: 'ഇതുവരെ ജോലികൾ ഇല്ല.',
  task: 'ജോലി',
  farmerLabel: 'കർഷകൻ',
  farmerPhoneLabel: 'കർഷകന്റെ ഫോൺ നമ്പർ',
  descriptionLabel: 'വിവരണം',
  statusLabel: 'നില',
  accept: 'സ്വീകരിക്കുക',
  decline: 'നിരസിക്കുക',
  markComplete: 'പൂർത്തിയായി എന്ന് അടയാളപ്പെടുത്തുക',
  declineConfirm: 'ഈ ജോലി നിരസിക്കണോ? അഡ്മിൻ ഇത് മറ്റൊരാൾക്ക് നൽകും.',
  jobAcceptedToast: 'ജോലി സ്വീകരിച്ചു.',
  jobDeclinedToast: 'ജോലി നിരസിച്ചു.',
  jobCompletedToast: 'ജോലി പൂർത്തിയായി എന്ന് അടയാളപ്പെടുത്തി.',
  statusPending: 'തീർപ്പാക്കാത്തത്',
  statusAccepted: 'സ്വീകരിച്ചു',
  statusCompleted: 'പൂർത്തിയായി',
  statusCancelled: 'റദ്ദാക്കി',
  statusDeclined: 'നിരസിച്ചു',
  statusOpen: 'തുറന്നത്',
  fullName: 'മുഴുവൻ പേര്',
  village: 'ഗ്രാമം',
  district: 'ജില്ല',
  state: 'സംസ്ഥാനം',
  pincode: 'പിൻകോഡ്',
  address: 'വിലാസം',
  landmarkOptional: 'ലാൻഡ്‌മാർക്ക് (ഐച്ഛികം)',
  age: 'പ്രായം',
  experience: 'പരിചയം (വർഷങ്ങളിൽ)',
  requestChangeTitle: 'പ്രൊഫൈൽ മാറ്റത്തിനുള്ള അഭ്യർത്ഥന',
  requestChangeHint: 'മാറ്റേണ്ട വിവരങ്ങൾ തിരുത്തി, കാരണം വിശദീകരിക്കുക. അഡ്മിൻ പരിശോധിച്ച ശേഷം മാത്രമേ ഇത് പ്രാബല്യത്തിൽ വരൂ.',
  reasonForChange: 'ഈ മാറ്റത്തിനുള്ള കാരണം',
  submitRequestButton: 'അഭ്യർത്ഥന സമർപ്പിക്കുക',
  requestSubmittedToast: 'അഭ്യർത്ഥന സമർപ്പിച്ചു — അവലോകനം ചെയ്ത ശേഷം നിങ്ങളെ അറിയിക്കും.',
  giveReasonError: 'ഈ മാറ്റം എന്തിനാണ് അഭ്യർത്ഥിക്കുന്നതെന്ന് അഡ്മിനെ അറിയിക്കുക.',
  changeAtLeastOneError: 'ആദ്യം ഒരു വിവരമെങ്കിലും മാറ്റുക.',
  changesUsedLabel: 'ഉപയോഗിച്ച മാറ്റങ്ങൾ',
  changesCapReachedError: 'നിങ്ങൾക്ക് അനുവദനീയമായ എല്ലാ പ്രൊഫൈൽ-മാറ്റ അഭ്യർത്ഥനകളും ഉപയോഗിച്ചു കഴിഞ്ഞു.',
  languageLabel: 'ഭാഷ',
};

export const strings: Record<LanguageCode, Record<StringKey, string>> = { en, hi, kn, ta, te, ml };
