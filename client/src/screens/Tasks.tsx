import { useEffect, useState } from "preact/hooks";
import type { I18n, Interest, StudentProfile } from "../../../shared/types.ts";
import { pick, t } from "../../../shared/i18n/strings.ts";
import { enqueue, updateActive } from "../store.ts";
import { INTEREST_ICON, Option, Speak } from "../ui.tsx";
import { speak } from "../voice.ts";

// Show, don't tell: short picture tasks that work offline. A student who gets
// both right has *demonstrated* the skill, which outranks a declared interest and
// earns a signed SkillDemonstration credential once the phone syncs.

interface Q { prompt: I18n; options: { icon: string; label?: I18n }[]; answer: number }
interface Task { id: Interest; title: I18n; questions: Q[] }

const TASKS: Task[] = [
  {
    id: "hands_on",
    title: { en: "Circuit puzzle", hi: "सर्किट पहेली", ta: "மின்சுற்றுப் புதிர்", kn: "ಸರ್ಕ್ಯೂಟ್ ಒಗಟು" },
    questions: [
      {
        prompt: { en: "The switch is closed. Will the bulb light up?", hi: "स्विच बंद (ऑन) है। क्या बल्ब जलेगा?", ta: "சுவிட்ச் இயக்கத்தில் உள்ளது. விளக்கு எரியுமா?", kn: "ಸ್ವಿಚ್ ಆನ್ ಆಗಿದೆ. ಬಲ್ಬ್ ಉರಿಯುತ್ತದೆಯೇ?" },
        options: [{ icon: "💡", label: { en: "Yes, it lights", hi: "हाँ, जलेगा", ta: "ஆம், எரியும்", kn: "ಹೌದು, ಉರಿಯುತ್ತದೆ" } }, { icon: "⚫", label: { en: "No", hi: "नहीं", ta: "இல்லை", kn: "ಇಲ್ಲ" } }],
        answer: 0,
      },
      {
        prompt: { en: "Which tool tightens a screw?", hi: "पेंच कसने के लिए कौन सा औज़ार?", ta: "திருகாணியை இறுக்க எந்தக் கருவி?", kn: "ಸ್ಕ್ರೂ ಬಿಗಿಗೊಳಿಸಲು ಯಾವ ಉಪಕರಣ?" },
        options: [{ icon: "🔨" }, { icon: "🪛" }, { icon: "✂️" }, { icon: "🧹" }],
        answer: 1,
      },
    ],
  },
  {
    id: "numbers",
    title: { en: "Shop counter", hi: "दुकान का हिसाब", ta: "கடைக் கணக்கு", kn: "ಅಂಗಡಿ ಲೆಕ್ಕ" },
    questions: [
      {
        prompt: { en: "A pen costs 12 rupees. You give 50. How much change?", hi: "पेन 12 रुपये का है। आपने 50 दिए। कितने वापस मिलेंगे?", ta: "பேனா 12 ரூபாய். நீங்கள் 50 கொடுத்தீர்கள். மீதி எவ்வளவு?", kn: "ಪೆನ್ 12 ರೂಪಾಯಿ. ನೀವು 50 ಕೊಟ್ಟಿರಿ. ಚಿಲ್ಲರೆ ಎಷ್ಟು?" },
        options: [{ icon: "₹28" }, { icon: "₹38" }, { icon: "₹42" }, { icon: "₹48" }],
        answer: 1,
      },
      {
        prompt: { en: "Rice is 40 rupees a kilo. How much for 3 kilos?", hi: "चावल 40 रुपये किलो है। 3 किलो कितने का?", ta: "அரிசி கிலோ 40 ரூபாய். 3 கிலோ எவ்வளவு?", kn: "ಅಕ್ಕಿ ಕೆಜಿಗೆ 40 ರೂಪಾಯಿ. 3 ಕೆಜಿಗೆ ಎಷ್ಟು?" },
        options: [{ icon: "₹100" }, { icon: "₹43" }, { icon: "₹120" }, { icon: "₹140" }],
        answer: 2,
      },
    ],
  },
  {
    id: "creative",
    title: { en: "Pattern eye", hi: "पैटर्न पहचानें", ta: "வடிவம் கண்டுபிடி", kn: "ಮಾದರಿ ಗುರುತಿಸಿ" },
    questions: [
      {
        prompt: { en: "What comes next? 🔺 🔵 🔺 🔵 🔺 ...", hi: "आगे क्या आएगा? 🔺 🔵 🔺 🔵 🔺 ...", ta: "அடுத்து என்ன? 🔺 🔵 🔺 🔵 🔺 ...", kn: "ಮುಂದೆ ಏನು? 🔺 🔵 🔺 🔵 🔺 ..." },
        options: [{ icon: "🔺" }, { icon: "🔵" }, { icon: "⬛" }, { icon: "⭐" }],
        answer: 1,
      },
      {
        prompt: { en: "Mix blue and yellow paint. What colour do you get?", hi: "नीला और पीला रंग मिलाएँ। कौन सा रंग बनेगा?", ta: "நீலமும் மஞ்சளும் கலந்தால் என்ன நிறம்?", kn: "ನೀಲಿ ಮತ್ತು ಹಳದಿ ಬೆರೆಸಿದರೆ ಯಾವ ಬಣ್ಣ?" },
        options: [{ icon: "🟥" }, { icon: "🟪" }, { icon: "🟩" }, { icon: "🟧" }],
        answer: 2,
      },
    ],
  },
  {
    id: "caring",
    title: { en: "First aid", hi: "प्राथमिक उपचार", ta: "முதலுதவி", kn: "ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ" },
    questions: [
      {
        prompt: { en: "A friend cuts their hand and it is bleeding. What first?", hi: "दोस्त का हाथ कट गया और खून बह रहा है। पहले क्या करें?", ta: "நண்பரின் கை வெட்டி இரத்தம் வருகிறது. முதலில் என்ன?", kn: "ಸ್ನೇಹಿತನ ಕೈ ಕೊಯ್ದು ರಕ್ತ ಬರುತ್ತಿದೆ. ಮೊದಲು ಏನು?" },
        options: [
          { icon: "🩹", label: { en: "Press a clean cloth on it", hi: "साफ़ कपड़े से दबाएँ", ta: "சுத்தமான துணியால் அழுத்து", kn: "ಸ್ವಚ್ಛ ಬಟ್ಟೆಯಿಂದ ಒತ್ತಿ" } },
          { icon: "🧂", label: { en: "Put salt on it", hi: "नमक लगाएँ", ta: "உப்பு போடு", kn: "ಉಪ್ಪು ಹಾಕಿ" } },
          { icon: "🏃", label: { en: "Leave it", hi: "छोड़ दें", ta: "விட்டுவிடு", kn: "ಬಿಟ್ಟುಬಿಡಿ" } },
        ],
        answer: 0,
      },
      {
        prompt: { en: "An old person feels dizzy in the sun. What helps?", hi: "धूप में किसी बुज़ुर्ग को चक्कर आ रहा है। क्या करें?", ta: "வெயிலில் முதியவருக்கு தலைசுற்றுகிறது. என்ன செய்வது?", kn: "ಬಿಸಿಲಿನಲ್ಲಿ ವೃದ್ಧರಿಗೆ ತಲೆಸುತ್ತು. ಏನು ಮಾಡಬೇಕು?" },
        options: [
          { icon: "🌳", label: { en: "Shade and water", hi: "छाँव और पानी", ta: "நிழல் மற்றும் தண்ணீர்", kn: "ನೆರಳು ಮತ್ತು ನೀರು" } },
          { icon: "☕", label: { en: "Hot tea", hi: "गर्म चाय", ta: "சூடான டீ", kn: "ಬಿಸಿ ಚಹಾ" } },
          { icon: "🚶", label: { en: "Make them walk", hi: "चलवाएँ", ta: "நடக்க வை", kn: "ನಡೆಸಿ" } },
        ],
        answer: 0,
      },
    ],
  },
];

export function Tasks({ p, onDone }: { p: StudentProfile; onDone: () => void }) {
  const lang = p.lang;
  const [task, setTask] = useState<Task | null>(null);
  const [qi, setQi] = useState(0);
  const [right, setRight] = useState(0);
  const [feedback, setFeedback] = useState<"" | "ok" | "no">("");

  const q = task?.questions[qi];
  useEffect(() => { if (q) speak(pick(lang, q.prompt), lang); }, [task, qi]);

  if (!task || !q) {
    return (
      <div>
        <div class="row"><h1 class="grow">{t(lang, "q.task")}</h1><Speak text={t(lang, "q.task")} lang={lang} /></div>
        <div class="options">
          {TASKS.map((tk) => {
            const done = p.demonstrated.find((d) => d.task === tk.id);
            return (
              <Option key={tk.id} icon={INTEREST_ICON[tk.id]} onClick={() => { setTask(tk); setQi(0); setRight(0); }}>
                {pick(lang, tk.title)} {done ? `✓ ${Math.round(done.score * 100)}%` : ""}
              </Option>
            );
          })}
        </div>
        <button class="btn block" onClick={onDone}>{t(lang, "next")}</button>
      </div>
    );
  }

  const choose = (i: number) => {
    const ok = i === q.answer;
    const total = right + (ok ? 1 : 0);
    setFeedback(ok ? "ok" : "no");
    setTimeout(() => {
      setFeedback("");
      if (qi + 1 < task.questions.length) {
        setRight(total);
        setQi(qi + 1);
        return;
      }
      const score = total / task.questions.length;
      const others = p.demonstrated.filter((d) => d.task !== task.id);
      updateActive({ demonstrated: [...others, { task: task.id, score, at: new Date().toISOString() }] });
      enqueue("task_result", { studentId: p.id, task: task.id, score, label: task.title.en });
      setTask(null);
    }, 700);
  };

  return (
    <div>
      <p class="small muted">{pick(lang, task.title)} · {qi + 1}/{task.questions.length}</p>
      <div class="row"><h1 class="grow">{pick(lang, q.prompt)}</h1><Speak text={pick(lang, q.prompt)} lang={lang} /></div>
      {task.id === "hands_on" && qi === 0 && <Circuit />}
      <div class={`options ${q.options.some((o) => o.label) ? "one" : ""}`}>
        {q.options.map((o, i) => (
          <Option key={i} icon={o.icon} onClick={() => choose(i)}>{o.label ? pick(lang, o.label) : ""}</Option>
        ))}
      </div>
      {feedback && <p class="verdict" style={`text-align:center;color:var(--${feedback === "ok" ? "yes" : "wait"})`}>{feedback === "ok" ? "✓" : "↻"}</p>}
    </div>
  );
}

function Circuit() {
  return (
    <svg viewBox="0 0 220 120" style="width:100%;max-width:320px;display:block;margin:0 auto" role="img" aria-label="battery, closed switch and bulb in one loop">
      <rect x="20" y="45" width="34" height="30" rx="4" fill="#f2a541" stroke="currentColor" stroke-width="2" />
      <text x="37" y="65" text-anchor="middle" font-size="14" fill="#2b1a00">+ −</text>
      <path d="M37 45 V20 H110 M140 20 H190 V48 M190 78 V100 H37 V75" fill="none" stroke="currentColor" stroke-width="3" />
      <line x1="110" y1="20" x2="140" y2="20" stroke="currentColor" stroke-width="3" />
      <circle cx="110" cy="20" r="4" fill="currentColor" /><circle cx="140" cy="20" r="4" fill="currentColor" />
      <circle cx="190" cy="63" r="15" fill="#fff6c7" stroke="currentColor" stroke-width="2" />
      <path d="M184 63 l4 -6 l4 6 l4 -6" fill="none" stroke="currentColor" stroke-width="1.6" />
    </svg>
  );
}
