const selections = { location: null, time: null, mood: null };

// API 키: secret.js 우선, 없으면 localStorage
function getApiKey() {
  if (typeof GROQ_API_KEY !== "undefined" && GROQ_API_KEY) return GROQ_API_KEY;
  return localStorage.getItem("groq_api_key") || null;
}

function saveApiKey() {
  const val = document.getElementById("api-key-input").value.trim();
  if (!val) { alert("API 키를 입력해주세요."); return; }
  localStorage.setItem("groq_api_key", val);
  document.getElementById("api-modal").style.display = "none";
}

// 페이지 로드 시 키 없으면 모달 표시
function showApiModal() {
  const m = document.getElementById("api-modal");
  m.style.display = "flex";
}

window.addEventListener("DOMContentLoaded", () => {
  if (!getApiKey()) showApiModal();
});

const SYSTEM_PROMPT = `당신은 세상에서 가장 창의적이고 황당한 챌린지를 만드는 AI입니다.
모든 출력은 반드시 한국어로만 작성하세요. 한자, 일본어, 중국어, 러시아어 등 다른 언어 문자를 절대 사용하지 마세요.
사용자의 현재 환경을 보고, 그 환경에서 실제로 수행 가능하지만 매우 엉뚱하고, 이상하고, 예상치 못한 도전과제를 생성하세요.
챌린지는 반드시:
- 현재 환경의 사물/상황을 적극 활용해야 합니다
- 혼자서 지금 당장 할 수 있어야 합니다
- 남에게 피해를 주지 않아야 합니다
- 웃기거나 황당하거나 기발해야 합니다
- 너무 뻔하거나 평범하면 안 됩니다 (ex: "운동하기", "물 마시기" 같은 것은 절대 금지)
반드시 다음 형식의 JSON만 출력하고 다른 텍스트는 절대 없어야 합니다.
difficulty는 반드시 "쉬움", "보통", "어려움", "정신력 필요" 중 정확히 하나만 쓰세요.
vibe는 반드시 "웃김", "황당함", "기발함", "미스터리", "도전적" 중 정확히 하나만 쓰세요. 절대 합치거나 변형하지 마세요.
{
  "title": "챌린지 제목 (짧고 임팩트 있게, 15자 이내)",
  "icon": "챌린지를 표현하는 이모지 1개",
  "description": "챌린지 배경 설명 및 왜 이 챌린지를 해야 하는지 (2-3문장, 유머러스하게)",
  "steps": ["수행 단계1", "수행 단계2", "수행 단계3"],
  "reward": "챌린지 완료 시 얻는 황당한 보상/칭호",
  "duration": "예상 소요 시간 (예: 3분, 30초, 1시간)",
  "difficulty": "쉬움",
  "vibe": "황당함",
  "warning": "챌린지 전 주의사항 (황당하게, 없으면 빈 문자열)"
}`;

function toggleTag(btn, group) {
  const prev = document.querySelector(`#${group}-tags .tag.active`);
  if (prev && prev !== btn) prev.classList.remove("active");
  btn.classList.toggle("active");
  selections[group] = btn.classList.contains("active") ? btn.textContent.trim() : null;
}

async function generateChallenge() {
  const GROQ_KEY = getApiKey();
  if (!GROQ_KEY) {
    showApiModal();
    return;
  }

  const surroundings = document.getElementById("surroundings").value.trim();
  const parts = [
    selections.location && `장소: ${selections.location}`,
    selections.time     && `시간대: ${selections.time}`,
    selections.mood     && `기분: ${selections.mood}`,
    surroundings        && `주변 사물: ${surroundings}`,
  ].filter(Boolean);

  if (parts.length === 0) {
    alert("최소 하나 이상 선택하거나 입력해주세요!");
    return;
  }

  const userMsg = `현재 상황:\n${parts.join("\n")}\n\n이 환경에서 할 수 있는 가장 이상하고 황당한 챌린지를 만들어주세요.`;

  const genBtn = document.getElementById("gen-btn");
  genBtn.disabled = true;

  show("result-card");
  show("loading");
  hide("result");
  document.getElementById("result-btns").classList.add("hidden");

  try {
    const res = await fetch(
      `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
          temperature: 0.9,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("응답이 비어 있습니다.");

    renderChallenge(JSON.parse(text));
  } catch (e) {
    renderError(e.message);
  } finally {
    hide("loading");
    genBtn.disabled = false;
  }
}

const DIFF_VALUES = ["쉬움", "보통", "어려움", "정신력 필요"];
const VIBE_VALUES = ["웃김", "황당함", "기발함", "미스터리", "도전적"];

// 한자·일본어·러시아어 등 이상한 문자 제거
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[぀-ヿ㐀-䶿一-鿿豈-﫿Ѐ-ӿ]/g, "").trim();
}

function normalize(val, allowed, fallback) {
  if (allowed.includes(val)) return val;
  const found = allowed.find(v => val.includes(v));
  return found || fallback;
}

function diffTag(d) {
  const map = { "쉬움": "tag-easy", "보통": "tag-funny", "어려움": "tag-hard", "정신력 필요": "tag-hard" };
  return `<span class="mini-tag ${map[d] || 'tag-funny'}">${d}</span>`;
}
function vibeTag(v) {
  const map = { "웃김": "tag-funny", "황당함": "tag-weird", "기발함": "tag-easy", "미스터리": "tag-weird", "도전적": "tag-hard" };
  return `<span class="mini-tag ${map[v] || 'tag-weird'}">${v}</span>`;
}

function renderChallenge(c) {
  c.difficulty = normalize(c.difficulty, DIFF_VALUES, "보통");
  c.vibe = normalize(c.vibe, VIBE_VALUES, "황당함");
  c.title       = sanitize(c.title);
  c.description = sanitize(c.description);
  c.reward      = sanitize(c.reward);
  c.warning     = sanitize(c.warning);
  c.duration    = sanitize(c.duration);
  if (Array.isArray(c.steps)) c.steps = c.steps.map(sanitize);
  const el = document.getElementById("result");
  const stepsHtml = c.steps.map((s, i) =>
    `<li><div class="step-num">${i+1}</div><span>${s}</span></li>`
  ).join("");

  el.innerHTML = `
    <div class="challenge-header">
      <div class="challenge-icon">${c.icon}</div>
      <div class="challenge-title-block">
        <h3>${c.title}</h3>
        <div class="tags-row">
          ${diffTag(c.difficulty)}
          ${vibeTag(c.vibe)}
        </div>
      </div>
    </div>

    <div class="section-title">📋 챌린지 소개</div>
    <div class="description-box">${c.description}</div>

    <div class="section-title">🚀 수행 방법</div>
    <ul class="steps-list">${stepsHtml}</ul>

    <div class="meta-row">
      <div class="meta-item"><span>⏱ 예상 시간</span>${c.duration}</div>
      <div class="meta-item"><span>💪 난이도</span>${c.difficulty}</div>
      <div class="meta-item"><span>✨ 분위기</span>${c.vibe}</div>
    </div>

    <div class="section-title">🏆 완료 보상</div>
    <div class="reward-box">🎖️ ${c.reward}</div>

    ${c.warning ? `<div class="warning-box">⚠️ 주의: ${c.warning}</div>` : ""}
  `;

  show("result");
  document.getElementById("result-btns").classList.remove("hidden");
}

function renderError(msg) {
  const el = document.getElementById("result");
  el.innerHTML = `
    <div style="text-align:center;padding:2rem;color:#f87171">
      <div style="font-size:2rem;margin-bottom:0.5rem">💥</div>
      <p>오류 발생: ${msg}</p>
    </div>`;
  show("result");
  document.getElementById("result-btns").classList.remove("hidden");
}

function resetAll() {
  document.querySelectorAll(".tag.active").forEach(t => t.classList.remove("active"));
  Object.keys(selections).forEach(k => selections[k] = null);
  document.getElementById("surroundings").value = "";
  hide("result-card");
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
