import type { Lang } from "../types.ts";

// UI and engine strings. Short sentences: everything here may be read aloud by TTS.
// Adding a language = adding a column here + an entry in LANGS. No code changes.
export const LANGS: { code: Lang; label: string; speech: string }[] = [
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
  { code: "kn", label: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "en", label: "English", speech: "en-IN" },
];

type Row = { en: string; hi: string; ta: string; kn: string };

const S = {
  "app.tagline": { en: "Your voice guide from learning to earning", hi: "पढ़ाई से कमाई तक, आपकी आवाज़ में", ta: "படிப்பிலிருந்து வருமானம் வரை, உங்கள் குரலில்", kn: "ಓದಿನಿಂದ ಗಳಿಕೆಯವರೆಗೆ, ನಿಮ್ಮ ಧ್ವನಿಯಲ್ಲಿ" },
  "lang.choose": { en: "Choose your language", hi: "अपनी भाषा चुनें", ta: "உங்கள் மொழியைத் தேர்ந்தெடுங்கள்", kn: "ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ" },
  "who.title": { en: "Who is using the phone?", hi: "फ़ोन कौन चला रहा है?", ta: "யார் கைபேசியைப் பயன்படுத்துகிறார்?", kn: "ಫೋನ್ ಯಾರು ಬಳಸುತ್ತಿದ್ದಾರೆ?" },
  "who.new": { en: "I am new", hi: "मैं नया/नई हूँ", ta: "நான் புதியவர்", kn: "ನಾನು ಹೊಸಬ" },
  "who.facilitator": { en: "Teacher / facilitator", hi: "शिक्षक / सहायक", ta: "ஆசிரியர் / வழிகாட்டி", kn: "ಶಿಕ್ಷಕ / ಮಾರ್ಗದರ್ಶಿ" },
  "pin.enter": { en: "Enter your 4-digit PIN", hi: "अपना 4 अंकों का PIN डालें", ta: "உங்கள் 4 இலக்க PIN-ஐ உள்ளிடுங்கள்", kn: "ನಿಮ್ಮ 4 ಅಂಕಿಯ PIN ನಮೂದಿಸಿ" },
  "pin.set": { en: "Make a 4-digit PIN so only you can open your space", hi: "4 अंकों का PIN बनाएँ, ताकि आपकी जगह सिर्फ़ आप खोल सकें", ta: "உங்கள் இடத்தை நீங்கள் மட்டும் திறக்க 4 இலக்க PIN அமையுங்கள்", kn: "ನಿಮ್ಮ ಜಾಗ ನೀವು ಮಾತ್ರ ತೆರೆಯಲು 4 ಅಂಕಿಯ PIN ಮಾಡಿ" },
  "pin.wrong": { en: "That PIN is not right. Try again.", hi: "PIN सही नहीं है। फिर कोशिश करें।", ta: "PIN சரியில்லை. மீண்டும் முயலுங்கள்.", kn: "PIN ಸರಿಯಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." },
  "mic.tap": { en: "Tap and speak", hi: "दबाएँ और बोलें", ta: "தட்டிப் பேசுங்கள்", kn: "ಒತ್ತಿ ಮಾತನಾಡಿ" },
  "mic.listening": { en: "Listening...", hi: "सुन रहे हैं...", ta: "கேட்கிறோம்...", kn: "ಕೇಳುತ್ತಿದ್ದೇವೆ..." },
  "mic.unsupported": { en: "Voice input is not available on this phone. Tap the answers instead.", hi: "इस फ़ोन पर आवाज़ से जवाब नहीं हो सकता। जवाब पर टैप करें।", ta: "இந்தக் கைபேசியில் குரல் உள்ளீடு இல்லை. பதிலைத் தட்டுங்கள்.", kn: "ಈ ಫೋನ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಇಲ್ಲ. ಉತ್ತರ ಒತ್ತಿ." },
  "or.type": { en: "or type here", hi: "या यहाँ लिखें", ta: "அல்லது இங்கே எழுதுங்கள்", kn: "ಅಥವಾ ಇಲ್ಲಿ ಬರೆಯಿರಿ" },
  "send": { en: "Send", hi: "भेजें", ta: "அனுப்பு", kn: "ಕಳುಹಿಸಿ" },
  "next": { en: "Next", hi: "आगे", ta: "அடுத்து", kn: "ಮುಂದೆ" },
  "back": { en: "Back", hi: "पीछे", ta: "பின்", kn: "ಹಿಂದೆ" },
  "yes": { en: "Yes", hi: "हाँ", ta: "ஆம்", kn: "ಹೌದು" },
  "no": { en: "No", hi: "नहीं", ta: "இல்லை", kn: "ಇಲ್ಲ" },
  "skip": { en: "Skip", hi: "छोड़ें", ta: "தவிர்", kn: "ಬಿಡಿ" },
  "dontknow": { en: "I don't know", hi: "पता नहीं", ta: "தெரியாது", kn: "ಗೊತ್ತಿಲ್ಲ" },
  "listen": { en: "Listen", hi: "सुनें", ta: "கேளுங்கள்", kn: "ಕೇಳಿ" },
  "offline": { en: "Offline - still working", hi: "ऑफ़लाइन - फिर भी चल रहा है", ta: "இணையம் இல்லை - இன்னும் இயங்குகிறது", kn: "ಆಫ್‌ಲೈನ್ - ಆದರೂ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ" },
  "online": { en: "Online", hi: "ऑनलाइन", ta: "இணைப்பில்", kn: "ಆನ್‌ಲೈನ್" },
  "sync.pending": { en: "{n} changes waiting to sync", hi: "{n} बदलाव सिंक होने बाकी", ta: "{n} மாற்றங்கள் ஒத்திசைக்கக் காத்திருக்கின்றன", kn: "{n} ಬದಲಾವಣೆ ಸಿಂಕ್‌ಗೆ ಕಾಯುತ್ತಿವೆ" },
  "sync.done": { en: "All saved", hi: "सब सुरक्षित", ta: "அனைத்தும் சேமிக்கப்பட்டது", kn: "ಎಲ್ಲಾ ಉಳಿಸಲಾಗಿದೆ" },

  "tab.discover": { en: "Discover", hi: "खोजें", ta: "கண்டறி", kn: "ಅನ್ವೇಷಿಸಿ" },
  "tab.path": { en: "My path", hi: "मेरा रास्ता", ta: "என் பாதை", kn: "ನನ್ನ ದಾರಿ" },
  "tab.money": { en: "Money for me", hi: "मेरे लिए पैसा", ta: "எனக்கான உதவி", kn: "ನನಗೆ ಹಣ" },
  "tab.check": { en: "Check offer", hi: "ऑफ़र जाँचें", ta: "வேலை வாய்ப்பைச் சரிபார்", kn: "ಆಫರ್ ಪರಿಶೀಲಿಸಿ" },
  "tab.family": { en: "Family", hi: "परिवार", ta: "குடும்பம்", kn: "ಕುಟುಂಬ" },
  "tab.passport": { en: "My proof", hi: "मेरा प्रमाण", ta: "என் சான்று", kn: "ನನ್ನ ಪುರಾವೆ" },

  "discover.hello": { en: "Hello! I am Hunar Setu. Let us find what you are good at. You can speak or tap.", hi: "नमस्ते! मैं हुनर सेतु हूँ। चलिए पता करें कि आप किसमें अच्छे हैं। आप बोल सकते हैं या टैप कर सकते हैं।", ta: "வணக்கம்! நான் ஹுனர் சேது. நீங்கள் எதில் சிறந்தவர் என்று கண்டுபிடிப்போம். பேசலாம் அல்லது தட்டலாம்.", kn: "ನಮಸ್ಕಾರ! ನಾನು ಹುನರ್ ಸೇತು. ನೀವು ಯಾವುದರಲ್ಲಿ ಚೆನ್ನಾಗಿದ್ದೀರಿ ಎಂದು ಕಂಡುಹಿಡಿಯೋಣ. ಮಾತನಾಡಿ ಅಥವಾ ಒತ್ತಿ." },
  "discover.mode.ai": { en: "Talking with the AI guide", hi: "AI गाइड से बात", ta: "AI வழிகாட்டியுடன் உரையாடல்", kn: "AI ಮಾರ್ಗದರ್ಶಿಯೊಂದಿಗೆ ಮಾತು" },
  "discover.mode.offline": { en: "Guided questions (works offline)", hi: "सवाल-जवाब (बिना इंटरनेट भी)", ta: "வழிகாட்டும் கேள்விகள் (இணையமின்றியும்)", kn: "ಮಾರ್ಗದರ್ಶಿ ಪ್ರಶ್ನೆಗಳು (ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ)" },
  "discover.done": { en: "Here are routes that fit you. Tap one to see your path.", hi: "ये रास्ते आपके लिए सही हैं। अपना रास्ता देखने के लिए एक पर टैप करें।", ta: "இவை உங்களுக்குப் பொருத்தமான பாதைகள். ஒன்றைத் தட்டி உங்கள் பாதையைப் பாருங்கள்.", kn: "ಇವು ನಿಮಗೆ ಹೊಂದುವ ದಾರಿಗಳು. ಒಂದನ್ನು ಒತ್ತಿ ನಿಮ್ಮ ದಾರಿ ನೋಡಿ." },
  "discover.restart": { en: "Start again", hi: "फिर से शुरू करें", ta: "மீண்டும் தொடங்கு", kn: "ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ" },
  "discover.wider": { en: "New for you", hi: "आपके लिए नया", ta: "உங்களுக்குப் புதியது", kn: "ನಿಮಗೆ ಹೊಸದು" },

  "q.name": { en: "What is your name?", hi: "आपका नाम क्या है?", ta: "உங்கள் பெயர் என்ன?", kn: "ನಿಮ್ಮ ಹೆಸರೇನು?" },
  "q.age": { en: "How old are you?", hi: "आपकी उम्र कितनी है?", ta: "உங்கள் வயது என்ன?", kn: "ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು?" },
  "q.gender": { en: "Are you a girl or a boy?", hi: "आप लड़की हैं या लड़का?", ta: "நீங்கள் பெண்ணா ஆணா?", kn: "ನೀವು ಹುಡುಗಿಯೇ ಹುಡುಗನೇ?" },
  "q.education": { en: "Which class have you passed or are in now?", hi: "आप कौन सी कक्षा में हैं या पास की है?", ta: "எந்த வகுப்பில் இருக்கிறீர்கள் அல்லது தேர்ச்சி பெற்றீர்கள்?", kn: "ಯಾವ ತರಗತಿಯಲ್ಲಿದ್ದೀರಿ ಅಥವಾ ಪಾಸ್ ಆಗಿದ್ದೀರಿ?" },
  "q.studying": { en: "Are you still studying?", hi: "क्या आप अभी पढ़ रहे हैं?", ta: "இன்னும் படிக்கிறீர்களா?", kn: "ಇನ್ನೂ ಓದುತ್ತಿದ್ದೀರಾ?" },
  "q.marks": { en: "About how many marks out of 100 did you get last year?", hi: "पिछले साल 100 में से लगभग कितने अंक आए?", ta: "கடந்த ஆண்டு 100க்கு சுமார் எத்தனை மதிப்பெண்?", kn: "ಕಳೆದ ವರ್ಷ 100ಕ್ಕೆ ಸುಮಾರು ಎಷ್ಟು ಅಂಕ?" },
  "q.state": { en: "Which state do you live in?", hi: "आप किस राज्य में रहते हैं?", ta: "எந்த மாநிலத்தில் வசிக்கிறீர்கள்?", kn: "ಯಾವ ರಾಜ್ಯದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?" },
  "q.interests": { en: "What do you enjoy? Pick all you like.", hi: "आपको क्या करना अच्छा लगता है? जितने चाहें चुनें।", ta: "உங்களுக்கு எது பிடிக்கும்? பிடித்தவை அனைத்தையும் தேர்ந்தெடுங்கள்.", kn: "ನಿಮಗೆ ಏನು ಇಷ್ಟ? ಇಷ್ಟವಾದ ಎಲ್ಲವನ್ನೂ ಆಯ್ಕೆಮಾಡಿ." },
  "q.category": { en: "Which category is your family?", hi: "आपके परिवार की श्रेणी क्या है?", ta: "உங்கள் குடும்பத்தின் பிரிவு என்ன?", kn: "ನಿಮ್ಮ ಕುಟುಂಬದ ವರ್ಗ ಯಾವುದು?" },
  "q.income": { en: "About how much does your family earn in a year?", hi: "आपका परिवार साल में लगभग कितना कमाता है?", ta: "உங்கள் குடும்பம் ஆண்டுக்கு சுமார் எவ்வளவு சம்பாதிக்கிறது?", kn: "ನಿಮ್ಮ ಕುಟುಂಬ ವರ್ಷಕ್ಕೆ ಸುಮಾರು ಎಷ್ಟು ಗಳಿಸುತ್ತದೆ?" },
  "q.relocate": { en: "Can you move to another town for training or work?", hi: "क्या आप ट्रेनिंग या काम के लिए दूसरे शहर जा सकते हैं?", ta: "பயிற்சி அல்லது வேலைக்காக வேறு ஊருக்குச் செல்ல முடியுமா?", kn: "ತರಬೇತಿ ಅಥವಾ ಕೆಲಸಕ್ಕಾಗಿ ಬೇರೆ ಊರಿಗೆ ಹೋಗಬಹುದೇ?" },
  "q.docs": { en: "Which of these do you already have?", hi: "इनमें से आपके पास क्या-क्या है?", ta: "இவற்றில் உங்களிடம் எவை உள்ளன?", kn: "ಇವುಗಳಲ್ಲಿ ನಿಮ್ಮ ಬಳಿ ಯಾವುವು ಇವೆ?" },
  "q.task": { en: "Quick task: show us what you can do!", hi: "छोटा काम: दिखाइए आप क्या कर सकते हैं!", ta: "சிறு பணி: உங்களால் என்ன செய்ய முடியும் என்று காட்டுங்கள்!", kn: "ಸಣ್ಣ ಕೆಲಸ: ನೀವು ಏನು ಮಾಡಬಲ್ಲಿರಿ ತೋರಿಸಿ!" },

  "g.female": { en: "Girl", hi: "लड़की", ta: "பெண்", kn: "ಹುಡುಗಿ" },
  "g.male": { en: "Boy", hi: "लड़का", ta: "ஆண்", kn: "ಹುಡುಗ" },
  "g.other": { en: "Other", hi: "अन्य", ta: "மற்றவை", kn: "ಇತರೆ" },

  "i.hands_on": { en: "Fixing and building things", hi: "चीज़ें ठीक करना, बनाना", ta: "பொருட்களை சரிசெய்தல், உருவாக்குதல்", kn: "ವಸ್ತುಗಳನ್ನು ಸರಿಪಡಿಸುವುದು, ಕಟ್ಟುವುದು" },
  "i.nature": { en: "Farms, animals, outdoors", hi: "खेत, पशु, बाहर का काम", ta: "வயல், கால்நடை, வெளிப்புறம்", kn: "ಹೊಲ, ಪ್ರಾಣಿ, ಹೊರಾಂಗಣ" },
  "i.caring": { en: "Helping sick people", hi: "बीमारों की मदद", ta: "நோயாளிகளுக்கு உதவுதல்", kn: "ರೋಗಿಗಳಿಗೆ ಸಹಾಯ" },
  "i.numbers": { en: "Money, selling, business", hi: "पैसा, बेचना, व्यापार", ta: "பணம், விற்பனை, வணிகம்", kn: "ಹಣ, ಮಾರಾಟ, ವ್ಯಾಪಾರ" },
  "i.creative": { en: "Drawing, sewing, crafts", hi: "चित्र, सिलाई, हस्तकला", ta: "வரைதல், தையல், கைவினை", kn: "ಚಿತ್ರ, ಹೊಲಿಗೆ, ಕರಕುಶಲ" },
  "i.talking": { en: "Talking and teaching", hi: "बात करना, पढ़ाना", ta: "பேசுதல், கற்பித்தல்", kn: "ಮಾತನಾಡುವುದು, ಕಲಿಸುವುದು" },
  "i.computers": { en: "Phones and computers", hi: "फ़ोन और कंप्यूटर", ta: "கைபேசி, கணினி", kn: "ಫೋನ್ ಮತ್ತು ಕಂಪ್ಯೂಟರ್" },
  "i.uniform": { en: "Uniform, sports, discipline", hi: "वर्दी, खेल, अनुशासन", ta: "சீருடை, விளையாட்டு, ஒழுக்கம்", kn: "ಸಮವಸ್ತ್ರ, ಕ್ರೀಡೆ, ಶಿಸ್ತು" },
  "i.cooking": { en: "Cooking and food", hi: "खाना बनाना", ta: "சமையல், உணவு", kn: "ಅಡುಗೆ, ಆಹಾರ" },

  "e.class8": { en: "Class 8", hi: "कक्षा 8", ta: "8ஆம் வகுப்பு", kn: "8ನೇ ತರಗತಿ" },
  "e.class9": { en: "Class 9", hi: "कक्षा 9", ta: "9ஆம் வகுப்பு", kn: "9ನೇ ತರಗತಿ" },
  "e.class10": { en: "Class 10", hi: "कक्षा 10", ta: "10ஆம் வகுப்பு", kn: "10ನೇ ತರಗತಿ" },
  "e.class11": { en: "Class 11", hi: "कक्षा 11", ta: "11ஆம் வகுப்பு", kn: "11ನೇ ತರಗತಿ" },
  "e.class12": { en: "Class 12", hi: "कक्षा 12", ta: "12ஆம் வகுப்பு", kn: "12ನೇ ತರಗತಿ" },
  "e.iti": { en: "ITI", hi: "ITI", ta: "ITI", kn: "ITI" },
  "e.diploma": { en: "Diploma", hi: "डिप्लोमा", ta: "டிப்ளமோ", kn: "ಡಿಪ್ಲೊಮಾ" },
  "e.ug": { en: "College degree", hi: "कॉलेज डिग्री", ta: "கல்லூரிப் பட்டம்", kn: "ಕಾಲೇಜು ಪದವಿ" },
  "e.pg": { en: "Postgraduate", hi: "स्नातकोत्तर", ta: "முதுநிலை", kn: "ಸ್ನಾತಕೋತ್ತರ" },

  "inc.1": { en: "Below 1 lakh", hi: "1 लाख से कम", ta: "1 லட்சத்துக்குக் குறைவு", kn: "1 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ" },
  "inc.2": { en: "1 to 2.5 lakh", hi: "1 से 2.5 लाख", ta: "1 முதல் 2.5 லட்சம்", kn: "1 ರಿಂದ 2.5 ಲಕ್ಷ" },
  "inc.3": { en: "2.5 to 4.5 lakh", hi: "2.5 से 4.5 लाख", ta: "2.5 முதல் 4.5 லட்சம்", kn: "2.5 ರಿಂದ 4.5 ಲಕ್ಷ" },
  "inc.4": { en: "4.5 to 8 lakh", hi: "4.5 से 8 लाख", ta: "4.5 முதல் 8 லட்சம்", kn: "4.5 ರಿಂದ 8 ಲಕ್ಷ" },
  "inc.5": { en: "Above 8 lakh", hi: "8 लाख से ज़्यादा", ta: "8 லட்சத்துக்கு மேல்", kn: "8 ಲಕ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು" },

  "path.title": { en: "Your path to", hi: "आपका रास्ता:", ta: "உங்கள் பாதை:", kn: "ನಿಮ್ಮ ದಾರಿ:" },
  "path.thisweek": { en: "Do this week", hi: "इस हफ़्ते करें", ta: "இந்த வாரம் செய்யுங்கள்", kn: "ಈ ವಾರ ಮಾಡಿ" },
  "path.steps": { en: "Steps", hi: "कदम", ta: "படிகள்", kn: "ಹಂತಗಳು" },
  "path.exams": { en: "Exams to prepare for", hi: "तैयारी के लिए परीक्षाएँ", ta: "தயாராக வேண்டிய தேர்வுகள்", kn: "ತಯಾರಾಗಬೇಕಾದ ಪರೀಕ್ಷೆಗಳು" },
  "path.opps": { en: "Openings near you", hi: "आपके पास के मौके", ta: "உங்கள் அருகில் வாய்ப்புகள்", kn: "ನಿಮ್ಮ ಹತ್ತಿರದ ಅವಕಾಶಗಳು" },
  "path.source": { en: "Source", hi: "स्रोत", ta: "ஆதாரம்", kn: "ಮೂಲ" },
  "learn.title": { en: "Learn from your teacher", hi: "अपने शिक्षक से सीखें", ta: "உங்கள் ஆசிரியரிடம் கற்றுக்கொள்ளுங்கள்", kn: "ನಿಮ್ಮ ಶಿಕ್ಷಕರಿಂದ ಕಲಿಯಿರಿ" },
  "learn.lessons": { en: "{n} lessons", hi: "{n} पाठ", ta: "{n} பாடங்கள்", kn: "{n} ಪಾಠಗಳು" },
  "learn.free": { en: "Free", hi: "मुफ़्त", ta: "இலவசம்", kn: "ಉಚಿತ" },
  "learn.per_module": { en: "₹{n} for this module", hi: "इस मॉड्यूल के ₹{n}", ta: "இந்தப் பாடத்திற்கு ₹{n}", kn: "ಈ ಮಾಡ್ಯೂಲ್‌ಗೆ ₹{n}" },
  "learn.subscription": { en: "₹{n} a month", hi: "₹{n} महीना", ta: "மாதம் ₹{n}", kn: "ತಿಂಗಳಿಗೆ ₹{n}" },
  "learn.start": { en: "Start learning", hi: "सीखना शुरू करें", ta: "கற்கத் தொடங்கு", kn: "ಕಲಿಯಲು ಪ್ರಾರಂಭಿಸಿ" },
  "learn.done": { en: "I finished this", hi: "मैंने पूरा कर लिया", ta: "நான் முடித்துவிட்டேன்", kn: "ನಾನು ಮುಗಿಸಿದೆ" },
  "learn.waiting": { en: "Finished. Your teacher will certify it.", hi: "पूरा हुआ। आपके शिक्षक इसे प्रमाणित करेंगे।", ta: "முடிந்தது. உங்கள் ஆசிரியர் இதைச் சான்றளிப்பார்.", kn: "ಮುಗಿದಿದೆ. ನಿಮ್ಮ ಶಿಕ್ಷಕರು ಇದನ್ನು ಪ್ರಮಾಣೀಕರಿಸುತ್ತಾರೆ." },
  "learn.certified": { en: "Certified. It is in My proof.", hi: "प्रमाणित। यह 'मेरा प्रमाण' में है।", ta: "சான்றளிக்கப்பட்டது. இது 'என் சான்று'-இல் உள்ளது.", kn: "ಪ್ರಮಾಣೀಕರಿಸಲಾಗಿದೆ. ಇದು 'ನನ್ನ ಪುರಾವೆ'ಯಲ್ಲಿದೆ." },
  "path.pick": { en: "First pick a route in Discover.", hi: "पहले 'खोजें' में एक रास्ता चुनें।", ta: "முதலில் 'கண்டறி'யில் ஒரு பாதையைத் தேர்ந்தெடுங்கள்.", kn: "ಮೊದಲು 'ಅನ್ವೇಷಿಸಿ'ಯಲ್ಲಿ ಒಂದು ದಾರಿ ಆಯ್ಕೆಮಾಡಿ." },
  "path.ask": { en: "Ask for this", hi: "इसके लिए अनुरोध करें", ta: "இதற்கு விண்ணப்பி", kn: "ಇದಕ್ಕೆ ವಿನಂತಿಸಿ" },
  "path.asked": { en: "Request sent to your facilitator", hi: "आपके सहायक को अनुरोध भेजा गया", ta: "உங்கள் வழிகாட்டிக்கு கோரிக்கை அனுப்பப்பட்டது", kn: "ನಿಮ್ಮ ಮಾರ್ಗದರ್ಶಿಗೆ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ" },

  "money.yes": { en: "You can apply now", hi: "आप अभी आवेदन कर सकते हैं", ta: "இப்போதே விண்ணப்பிக்கலாம்", kn: "ಈಗಲೇ ಅರ್ಜಿ ಹಾಕಬಹುದು" },
  "money.notyet": { en: "Not yet - one step away", hi: "अभी नहीं - बस एक कदम दूर", ta: "இன்னும் இல்லை - ஒரு படி தூரம்", kn: "ಇನ್ನೂ ಇಲ್ಲ - ಒಂದೇ ಹೆಜ್ಜೆ ದೂರ" },
  "money.no": { en: "Not for you right now", hi: "अभी आपके लिए नहीं", ta: "இப்போது உங்களுக்கு இல்லை", kn: "ಈಗ ನಿಮಗಲ್ಲ" },
  "money.unknown": { en: "Need a little more information", hi: "थोड़ी और जानकारी चाहिए", ta: "இன்னும் கொஞ்சம் தகவல் தேவை", kn: "ಇನ್ನೂ ಸ್ವಲ್ಪ ಮಾಹಿತಿ ಬೇಕು" },
  "money.autopilot": { en: "Paperwork plan", hi: "कागज़ात की योजना", ta: "ஆவணத் திட்டம்", kn: "ದಾಖಲೆ ಯೋಜನೆ" },
  "money.startnow": { en: "Start now - takes about {d} days", hi: "अभी शुरू करें - लगभग {d} दिन लगते हैं", ta: "இப்போதே தொடங்குங்கள் - சுமார் {d} நாட்கள் ஆகும்", kn: "ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ - ಸುಮಾರು {d} ದಿನ ಬೇಕು" },
  "money.digilocker": { en: "Already in DigiLocker? Fetch it.", hi: "डिजिलॉकर में है? वहाँ से लें।", ta: "டிஜிலாக்கரில் உள்ளதா? அங்கிருந்து எடுங்கள்.", kn: "ಡಿಜಿಲಾಕರ್‌ನಲ್ಲಿದೆಯೇ? ಅಲ್ಲಿಂದ ಪಡೆಯಿರಿ." },
  "money.dbt": { en: "Bank check: is your Aadhaar linked for DBT? Without it, money can bounce even after approval.", hi: "बैंक जाँच: क्या आपका आधार DBT के लिए जुड़ा है? इसके बिना मंज़ूरी के बाद भी पैसा लौट सकता है।", ta: "வங்கிச் சரிபார்ப்பு: DBT-க்கு ஆதார் இணைக்கப்பட்டுள்ளதா? இல்லையெனில் ஒப்புதலுக்குப் பின்னும் பணம் திரும்பலாம்.", kn: "ಬ್ಯಾಂಕ್ ಪರಿಶೀಲನೆ: DBTಗೆ ಆಧಾರ್ ಜೋಡಣೆ ಆಗಿದೆಯೇ? ಇಲ್ಲದಿದ್ದರೆ ಮಂಜೂರಾದ ಹಣವೂ ವಾಪಸ್ ಹೋಗಬಹುದು." },
  "money.total": { en: "Up to ₹{v} a year you can claim", hi: "आप साल में ₹{v} तक पा सकते हैं", ta: "ஆண்டுக்கு ₹{v} வரை பெறலாம்", kn: "ವರ್ಷಕ್ಕೆ ₹{v} ವರೆಗೆ ಪಡೆಯಬಹುದು" },
  "money.alsofits": { en: "Instead, this fits you today:", hi: "इसकी जगह, यह आज ही आपके लिए सही है:", ta: "அதற்குப் பதிலாக, இது இன்றே உங்களுக்குப் பொருந்தும்:", kn: "ಬದಲಿಗೆ, ಇದು ಇಂದೇ ನಿಮಗೆ ಹೊಂದುತ್ತದೆ:" },

  "r.age": { en: "Age must be {range}", hi: "उम्र {range} होनी चाहिए", ta: "வயது {range} இருக்க வேண்டும்", kn: "ವಯಸ್ಸು {range} ಇರಬೇಕು" },
  "r.education": { en: "Only for students in {list}", hi: "सिर्फ़ {list} के छात्रों के लिए", ta: "{list} மாணவர்களுக்கு மட்டும்", kn: "{list} ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಮಾತ್ರ" },
  "r.inEducation.true": { en: "Only for students who are still studying", hi: "सिर्फ़ पढ़ाई कर रहे छात्रों के लिए", ta: "இப்போது படிப்பவர்களுக்கு மட்டும்", kn: "ಈಗ ಓದುತ್ತಿರುವವರಿಗೆ ಮಾತ್ರ" },
  "r.inEducation.false": { en: "Only for those not in full-time study", hi: "सिर्फ़ उनके लिए जो पूर्णकालिक पढ़ाई में नहीं हैं", ta: "முழுநேரப் படிப்பில் இல்லாதவர்களுக்கு மட்டும்", kn: "ಪೂರ್ಣಾವಧಿ ಓದಿನಲ್ಲಿ ಇಲ್ಲದವರಿಗೆ ಮಾತ್ರ" },
  "r.category": { en: "Only for {list} students", hi: "सिर्फ़ {list} छात्रों के लिए", ta: "{list} மாணவர்களுக்கு மட்டும்", kn: "{list} ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಮಾತ್ರ" },
  "r.minority": { en: "Only for minority-community students", hi: "सिर्फ़ अल्पसंख्यक छात्रों के लिए", ta: "சிறுபான்மை மாணவர்களுக்கு மட்டும்", kn: "ಅಲ್ಪಸಂಖ್ಯಾತ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಮಾತ್ರ" },
  "r.gender": { en: "Only for {list}", hi: "सिर्फ़ {list} के लिए", ta: "{list} மட்டும்", kn: "{list} ಮಾತ್ರ" },
  "r.incomeMax": { en: "Family income must be up to ₹{v} a year", hi: "परिवार की सालाना आय ₹{v} तक होनी चाहिए", ta: "குடும்ப ஆண்டு வருமானம் ₹{v} வரை இருக்க வேண்டும்", kn: "ಕುಟುಂಬದ ವಾರ್ಷಿಕ ಆದಾಯ ₹{v} ವರೆಗೆ ಇರಬೇಕು" },
  "r.marksMin": { en: "Needs at least {v}% marks", hi: "कम से कम {v}% अंक चाहिए", ta: "குறைந்தது {v}% மதிப்பெண் தேவை", kn: "ಕನಿಷ್ಠ {v}% ಅಂಕ ಬೇಕು" },
  "r.disabilityMin": { en: "For students with {v}% or more disability", hi: "{v}% या अधिक दिव्यांगता वाले छात्रों के लिए", ta: "{v}% அல்லது அதற்கு மேல் மாற்றுத்திறன் உள்ளவர்களுக்கு", kn: "{v}% ಅಥವಾ ಹೆಚ್ಚು ಅಂಗವೈಕಲ್ಯ ಇರುವವರಿಗೆ" },
  "r.state": { en: "Only for residents of {list}", hi: "सिर्फ़ {list} के निवासियों के लिए", ta: "{list} வசிப்பவர்களுக்கு மட்டும்", kn: "{list} ನಿವಾಸಿಗಳಿಗೆ ಮಾತ್ರ" },
  "r.noGovtEmployeeInFamily": { en: "No family member may hold a government job", hi: "परिवार में कोई सरकारी नौकरी में न हो", ta: "குடும்பத்தில் யாரும் அரசு வேலையில் இருக்கக்கூடாது", kn: "ಕುಟುಂಬದಲ್ಲಿ ಯಾರೂ ಸರ್ಕಾರಿ ನೌಕರಿಯಲ್ಲಿ ಇರಬಾರದು" },
  "r.doc": { en: "You still need: {doc}", hi: "अभी चाहिए: {doc}", ta: "இன்னும் தேவை: {doc}", kn: "ಇನ್ನೂ ಬೇಕು: {doc}" },
  "r.unknown": { en: "Tell us: {what}", hi: "बताइए: {what}", ta: "சொல்லுங்கள்: {what}", kn: "ತಿಳಿಸಿ: {what}" },

  "check.title": { en: "Is this offer safe?", hi: "क्या यह ऑफ़र सुरक्षित है?", ta: "இந்த வாய்ப்பு பாதுகாப்பானதா?", kn: "ಈ ಆಫರ್ ಸುರಕ್ಷಿತವೇ?" },
  "check.hint": { en: "Speak, paste or type the job message you got", hi: "जो नौकरी का संदेश मिला, उसे बोलें, पेस्ट करें या लिखें", ta: "உங்களுக்கு வந்த வேலைச் செய்தியைப் பேசுங்கள் அல்லது ஒட்டுங்கள்", kn: "ನಿಮಗೆ ಬಂದ ಕೆಲಸದ ಸಂದೇಶವನ್ನು ಹೇಳಿ ಅಥವಾ ಅಂಟಿಸಿ" },
  "check.run": { en: "Check it", hi: "जाँचें", ta: "சரிபார்", kn: "ಪರಿಶೀಲಿಸಿ" },
  "check.danger": { en: "Danger - do not go", hi: "ख़तरा - मत जाइए", ta: "ஆபத்து - செல்லாதீர்கள்", kn: "ಅಪಾಯ - ಹೋಗಬೇಡಿ" },
  "check.caution": { en: "Be careful - check more", hi: "सावधान - और जाँच करें", ta: "கவனம் - மேலும் சரிபாருங்கள்", kn: "ಎಚ್ಚರಿಕೆ - ಇನ್ನಷ್ಟು ಪರಿಶೀಲಿಸಿ" },
  "check.ok": { en: "No warning signs found", hi: "कोई ख़तरे का संकेत नहीं मिला", ta: "எச்சரிக்கை அறிகுறி இல்லை", kn: "ಯಾವುದೇ ಎಚ್ಚರಿಕೆ ಚಿಹ್ನೆ ಇಲ್ಲ" },
  "check.verified": { en: "This employer is verified on the Hunar Setu network", hi: "यह कंपनी हुनर सेतु नेटवर्क पर सत्यापित है", ta: "இந்த நிறுவனம் ஹுனர் சேது வலையில் சரிபார்க்கப்பட்டது", kn: "ಈ ಕಂಪನಿ ಹುನರ್ ಸೇತು ಜಾಲದಲ್ಲಿ ಪರಿಶೀಲಿತ" },
  "check.report": { en: "Report as scam - warn other villages", hi: "धोखा बताएँ - दूसरे गाँवों को चेताएँ", ta: "மோசடி எனப் புகாரளி - மற்ற கிராமங்களை எச்சரி", kn: "ವಂಚನೆ ಎಂದು ವರದಿ ಮಾಡಿ - ಇತರ ಹಳ್ಳಿಗಳಿಗೆ ಎಚ್ಚರಿಸಿ" },
  "check.reported": { en: "Thank you. Every village on the network will be warned.", hi: "धन्यवाद। नेटवर्क के हर गाँव को चेतावनी मिलेगी।", ta: "நன்றி. வலையமைப்பில் உள்ள ஒவ்வொரு கிராமமும் எச்சரிக்கப்படும்.", kn: "ಧನ್ಯವಾದ. ಜಾಲದ ಪ್ರತಿ ಹಳ್ಳಿಗೂ ಎಚ್ಚರಿಕೆ ಹೋಗುತ್ತದೆ." },
  "check.community": { en: "Reported as a scam by {n} people on the network", hi: "नेटवर्क पर {n} लोगों ने इसे धोखा बताया है", ta: "வலையமைப்பில் {n} பேர் மோசடி எனப் புகாரளித்துள்ளனர்", kn: "ಜಾಲದಲ್ಲಿ {n} ಜನ ವಂಚನೆ ಎಂದು ವರದಿ ಮಾಡಿದ್ದಾರೆ" },
  "check.helpline": { en: "Overseas job help: MEA helpline 1800-11-3090. Cyber fraud: call 1930.", hi: "विदेश नौकरी मदद: MEA हेल्पलाइन 1800-11-3090। साइबर धोखा: 1930 पर कॉल करें।", ta: "வெளிநாட்டு வேலை உதவி: MEA 1800-11-3090. சைபர் மோசடி: 1930 அழைக்கவும்.", kn: "ವಿದೇಶ ಉದ್ಯೋಗ ಸಹಾಯ: MEA 1800-11-3090. ಸೈಬರ್ ವಂಚನೆ: 1930ಗೆ ಕರೆ ಮಾಡಿ." },

  "family.title": { en: "Decide together", hi: "मिलकर फ़ैसला करें", ta: "சேர்ந்து முடிவெடுங்கள்", kn: "ಒಟ್ಟಿಗೆ ನಿರ್ಧರಿಸಿ" },
  "family.net": { en: "Money left each month", hi: "हर महीने बचने वाला पैसा", ta: "ஒவ்வொரு மாதமும் மிஞ்சும் பணம்", kn: "ಪ್ರತಿ ತಿಂಗಳು ಉಳಿಯುವ ಹಣ" },
  "family.stipend": { en: "Stipend / salary", hi: "वजीफ़ा / वेतन", ta: "உதவித்தொகை / சம்பளம்", kn: "ಸ್ಟೈಪೆಂಡ್ / ಸಂಬಳ" },
  "family.support": { en: "Government support", hi: "सरकारी मदद", ta: "அரசு உதவி", kn: "ಸರ್ಕಾರಿ ನೆರವು" },
  "family.rent": { en: "Room rent", hi: "कमरे का किराया", ta: "அறை வாடகை", kn: "ಕೊಠಡಿ ಬಾಡಿಗೆ" },
  "family.food": { en: "Food", hi: "खाना", ta: "உணவு", kn: "ಊಟ" },
  "family.travel": { en: "Travel home", hi: "घर आने-जाने का किराया", ta: "வீட்டுக்குப் பயணம்", kn: "ಮನೆಗೆ ಪ್ರಯಾಣ" },
  "family.safety": { en: "Safety", hi: "सुरक्षा", ta: "பாதுகாப்பு", kn: "ಸುರಕ್ಷತೆ" },
  "family.hostel": { en: "Hostel provided", hi: "हॉस्टल मिलता है", ta: "விடுதி வசதி உண்டு", kn: "ಹಾಸ್ಟೆಲ್ ಇದೆ" },
  "family.women": { en: "Women work here", hi: "यहाँ महिलाएँ काम करती हैं", ta: "இங்கு பெண்கள் பணிபுரிகின்றனர்", kn: "ಇಲ್ಲಿ ಮಹಿಳೆಯರು ಕೆಲಸ ಮಾಡುತ್ತಾರೆ" },
  "family.epf": { en: "Registered with EPF (real, formal job)", hi: "EPF में पंजीकृत (असली, औपचारिक नौकरी)", ta: "EPF-ல் பதிவு (உண்மையான முறையான வேலை)", kn: "EPFನಲ್ಲಿ ನೋಂದಣಿ (ನಿಜವಾದ ಔಪಚಾರಿಕ ಕೆಲಸ)" },
  "family.together": { en: "{n} others from your area are joining - go together", hi: "आपके इलाके से {n} और लोग जा रहे हैं - साथ जाएँ", ta: "உங்கள் பகுதியிலிருந்து மேலும் {n} பேர் சேர்கிறார்கள் - சேர்ந்து செல்லுங்கள்", kn: "ನಿಮ್ಮ ಪ್ರದೇಶದಿಂದ ಇನ್ನೂ {n} ಜನ ಸೇರುತ್ತಿದ್ದಾರೆ - ಒಟ್ಟಿಗೆ ಹೋಗಿ" },
  "family.explain": { en: "Play for parents", hi: "माता-पिता को सुनाएँ", ta: "பெற்றோருக்கு ஒலிக்கச் செய்", kn: "ಪೋಷಕರಿಗೆ ಕೇಳಿಸಿ" },
  "family.pick": { en: "Pick an opening to compare", hi: "तुलना के लिए एक मौका चुनें", ta: "ஒப்பிட ஒரு வாய்ப்பைத் தேர்ந்தெடுங்கள்", kn: "ಹೋಲಿಸಲು ಒಂದು ಅವಕಾಶ ಆಯ್ಕೆಮಾಡಿ" },

  "passport.title": { en: "Talent Passport", hi: "टैलेंट पासपोर्ट", ta: "திறமை கடவுச்சீட்டு", kn: "ಪ್ರತಿಭಾ ಪಾಸ್‌ಪೋರ್ಟ್" },
  "passport.empty": { en: "No proofs yet. Finish a task or get endorsed by your facilitator.", hi: "अभी कोई प्रमाण नहीं। कोई काम पूरा करें या अपने सहायक से अनुशंसा लें।", ta: "இன்னும் சான்று இல்லை. ஒரு பணியை முடியுங்கள் அல்லது வழிகாட்டியின் பரிந்துரை பெறுங்கள்.", kn: "ಇನ್ನೂ ಪುರಾವೆ ಇಲ್ಲ. ಒಂದು ಕೆಲಸ ಮುಗಿಸಿ ಅಥವಾ ಮಾರ್ಗದರ್ಶಿಯ ಶಿಫಾರಸು ಪಡೆಯಿರಿ." },
  "passport.verify": { en: "Anyone can scan this to check it is real", hi: "कोई भी इसे स्कैन करके असली होने की जाँच कर सकता है", ta: "யார் வேண்டுமானாலும் ஸ்கேன் செய்து உண்மையா எனச் சரிபார்க்கலாம்", kn: "ಯಾರಾದರೂ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ನಿಜವೇ ಎಂದು ಪರಿಶೀಲಿಸಬಹುದು" },

  "consent.title": { en: "Your data, your choice", hi: "आपका डेटा, आपकी मर्ज़ी", ta: "உங்கள் தரவு, உங்கள் விருப்பம்", kn: "ನಿಮ್ಮ ಡೇಟಾ, ನಿಮ್ಮ ಆಯ್ಕೆ" },
  "consent.body": { en: "Your answers stay on this phone and your facilitator's hub. We share them only when you say so. No ads, no tracking. If you are under 18, a parent must agree.", hi: "आपके जवाब इसी फ़ोन और सहायक के हब पर रहते हैं। आपकी अनुमति से ही साझा होंगे। कोई विज्ञापन नहीं, कोई ट्रैकिंग नहीं। 18 से कम उम्र है तो माता-पिता की सहमति ज़रूरी है।", ta: "உங்கள் பதில்கள் இந்தக் கைபேசியிலும் வழிகாட்டியின் மையத்திலும் மட்டும். நீங்கள் சொன்னால் மட்டுமே பகிரப்படும். விளம்பரம் இல்லை, கண்காணிப்பு இல்லை. 18 வயதுக்குக் கீழ் என்றால் பெற்றோர் ஒப்புதல் தேவை.", kn: "ನಿಮ್ಮ ಉತ್ತರಗಳು ಈ ಫೋನ್ ಮತ್ತು ಮಾರ್ಗದರ್ಶಿಯ ಹಬ್‌ನಲ್ಲಿ ಮಾತ್ರ. ನೀವು ಹೇಳಿದಾಗ ಮಾತ್ರ ಹಂಚಲಾಗುತ್ತದೆ. ಜಾಹೀರಾತು ಇಲ್ಲ, ಟ್ರ್ಯಾಕಿಂಗ್ ಇಲ್ಲ. 18ಕ್ಕಿಂತ ಕಡಿಮೆ ವಯಸ್ಸಾದರೆ ಪೋಷಕರ ಒಪ್ಪಿಗೆ ಬೇಕು." },
  "consent.agree": { en: "I agree", hi: "मैं सहमत हूँ", ta: "நான் ஒப்புக்கொள்கிறேன்", kn: "ನಾನು ಒಪ್ಪುತ್ತೇನೆ" },
  "consent.guardian": { en: "Parent / guardian agrees", hi: "माता-पिता / अभिभावक सहमत हैं", ta: "பெற்றோர் / பாதுகாவலர் ஒப்புக்கொள்கிறார்", kn: "ಪೋಷಕರು / ಪಾಲಕರು ಒಪ್ಪುತ್ತಾರೆ" },
} satisfies Record<string, Row>;

export type StringKey = keyof typeof S;

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = S[key][lang] ?? S[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function pick(lang: Lang, v: { en: string } & Partial<Record<Lang, string>>): string {
  return v[lang] ?? v.en;
}

export function rupees(n: number): string {
  return n.toLocaleString("en-IN");
}
