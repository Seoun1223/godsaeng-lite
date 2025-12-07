// ================== 기본 설정 ==================
let confirmedSleepStart = "23:00";
let confirmedSleepEnd = "07:00";

const totalMinutes = 24 * 60;

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const m = ((minutes % totalMinutes) + totalMinutes) % totalMinutes;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

// ================== 초기화 ==================
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("generate-schedule-btn")
    .addEventListener("click", generateSchedule);
  document
    .getElementById("confirm-sleep-btn")
    .addEventListener("click", confirmSleepTime);

  initClockFace();
});

// 24시간 시계판(눈금 + 숫자) 만들기
function initClockFace() {
  const chart = document.getElementById("timeline-chart");
  chart.innerHTML = "";

  // 시계판: 0~23시 눈금 & 숫자
  for (let h = 0; h < 24; h++) {
    const angle = (h / 24) * 360;

    // 눈금
    const tick = document.createElement("div");
    tick.className = "clock-tick" + (h % 6 === 0 ? " major" : "");
    tick.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    chart.appendChild(tick);

    // 숫자 (0~23)
    const number = document.createElement("div");
    number.className = "clock-number";
    number.textContent = h;
    number.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-115px) rotate(${-angle}deg)`;
    chart.appendChild(number);
  }

  // 중앙 텍스트
  const center = document.createElement("div");
  center.className = "clock-center";
  center.textContent = "오늘 일정";
  chart.appendChild(center);
}

// ================== UI 동작 ==================
function confirmSleepTime() {
  const startInput = document.getElementById("sleep-start");
  const endInput = document.getElementById("sleep-end");
  const btn = document.getElementById("confirm-sleep-btn");

  confirmedSleepStart = startInput.value;
  confirmedSleepEnd = endInput.value;

  startInput.disabled = true;
  endInput.disabled = true;
  btn.textContent = "확정됨";
  btn.classList.add("confirmed");

  alert(`수면 시간 (${confirmedSleepStart} ~ ${confirmedSleepEnd})이 확정되었습니다.`);
}

function addScheduleToList() {
  const list = document.getElementById("fixed-schedule-list");
  const startInput = document.getElementById("new-schedule-start");
  const endInput = document.getElementById("new-schedule-end");
  const titleInput = document.getElementById("new-schedule-title");

  if (!titleInput.value || !startInput.value || !endInput.value) {
    alert("모든 고정 스케줄 항목을 입력해주세요.");
    return;
  }

  const row = document.createElement("div");
  row.className = "schedule-item item-row";
  row.innerHTML = `
    <span data-type="start">${startInput.value}</span> ~
    <span data-type="end">${endInput.value}</span>
    <span data-type="title">${titleInput.value}</span>
    <button class="remove-button" type="button" onclick="this.parentNode.remove()">삭제</button>
  `;
  list.appendChild(row);

  titleInput.value = "";
  startInput.value = "09:00";
  endInput.value = "10:00";
}

function addTodoToList() {
  const list = document.getElementById("todo-list-items");
  const titleInput = document.getElementById("new-todo-title");
  const durationInput = document.getElementById("new-todo-duration");
  const duration = parseInt(durationInput.value, 10);

  if (!titleInput.value || duration <= 0) {
    alert("할 일 제목과 유효한 소요 시간(분)을 입력해주세요.");
    return;
  }

  const row = document.createElement("div");
  row.className = "todo-item item-row";
  row.innerHTML = `
    <span data-type="title">${titleInput.value}</span>
    <span data-type="duration" data-duration="${duration}">${duration}분</span>
    <button class="remove-button" type="button" onclick="this.parentNode.remove()">삭제</button>
  `;
  list.appendChild(row);

  titleInput.value = "";
  durationInput.value = "30";
}

// ================== 일정 생성 ==================
function generateSchedule() {
  const { fixedSchedules, todos } = collectInputData();

  if (
    fixedSchedules.length === 0 &&
    todos.length === 0 &&
    !document.getElementById("confirm-sleep-btn").classList.contains("confirmed")
  ) {
    alert("일정을 생성하려면 수면 시간을 확정하고, 고정 스케줄이나 할 일을 최소 하나 입력해주세요.");
    return;
  }

  const { slots, schedule } = initializeTimeSlotsAndSchedule(
    confirmedSleepStart,
    confirmedSleepEnd,
    fixedSchedules
  );

  const mealResult = assignMeals({ slots, schedule });
  const finalResult = assignTodos(mealResult.slots, todos, mealResult.schedule);

  displayResults(finalResult.schedule, finalResult.slots);
}

function collectInputData() {
  const fixedSchedules = Array.from(
    document.querySelectorAll("#fixed-schedule-list .item-row")
  ).map((row) => ({
    start: row.querySelector('[data-type="start"]').textContent,
    end: row.querySelector('[data-type="end"]').textContent,
    title: row.querySelector('[data-type="title"]').textContent,
  }));

  const todos = Array.from(
    document.querySelectorAll("#todo-list-items .item-row")
  ).map((row) => {
    const durationSpan = row.querySelector('[data-type="duration"]');
    return {
      title: row.querySelector('[data-type="title"]').textContent,
      duration: parseInt(durationSpan.getAttribute("data-duration"), 10),
    };
  });

  return { fixedSchedules, todos };
}

// ================== 시간 슬롯 채우기 ==================
function initializeTimeSlotsAndSchedule(sleepStart, sleepEnd, fixedSchedules) {
  const slots = new Array(totalMinutes).fill(0); // 0: free, 1: sleep, 2: fixed, 3: meal, 4: todo
  const schedule = [];

  let startMin = timeToMinutes(sleepStart);
  let endMin = timeToMinutes(sleepEnd);

  // 수면 (자정 넘김 처리)
  if (startMin > endMin) {
    for (let i = startMin; i < totalMinutes; i++) slots[i] = 1;
    for (let i = 0; i < endMin; i++) slots[i] = 1;
  } else {
    for (let i = startMin; i < endMin; i++) slots[i] = 1;
  }
  const sleepDuration = (totalMinutes - startMin + endMin) % totalMinutes;
  schedule.push({
    start: sleepStart,
    end: sleepEnd,
    title: "수면",
    type: "sleep",
    duration: sleepDuration,
  });

  // 고정 스케줄
  fixedSchedules.forEach((item) => {
    const s = timeToMinutes(item.start);
    const e = timeToMinutes(item.end);
    if (s >= e) {
      for (let i = s; i < totalMinutes; i++) slots[i] = 2;
      for (let i = 0; i < e; i++) slots[i] = 2;
    } else {
      for (let i = s; i < e; i++) slots[i] = 2;
    }
    const duration = (e - s + totalMinutes) % totalMinutes;
    schedule.push({
      start: item.start,
      end: item.end,
      title: item.title,
      type: "fixed",
      duration,
    });
  });

  return { slots, schedule };
}

function assignSlot(slots, startMin, duration, type, title, schedule) {
  for (let i = startMin; i < startMin + duration && i < slots.length; i++) {
    slots[i] = type;
  }
  schedule.push({
    start: minutesToTime(startMin),
    end: minutesToTime(startMin + duration),
    title,
    type: typeNumberToString(type),
    duration,
  });
}

function typeNumberToString(num) {
  switch (num) {
    case 1:
      return "sleep";
    case 2:
      return "fixed";
    case 3:
      return "meal";
    case 4:
      return "todo";
    default:
      return "unknown";
  }
}

function checkAvailability(slots, startMin, duration) {
  for (let i = startMin; i < startMin + duration && i < slots.length; i++) {
    if (slots[i] !== 0) return false;
  }
  return true;
}

// ================== 식사 배정 (점심: 11~14 / 저녁: 17~20) ==================
function assignMeals({ slots, schedule }) {
  const MEAL_DURATION = 30;

  // 점심 11:00~14:00 (660~840) 중 30분
  // 우선 12:00~13:00 (720~780) 근처 먼저 탐색
  let lunchAssigned = false;
  for (let startMin = 720; startMin <= 780; startMin++) {
    if (
      startMin >= 660 &&
      startMin <= 840 - MEAL_DURATION &&
      checkAvailability(slots, startMin, MEAL_DURATION)
    ) {
      assignSlot(slots, startMin, MEAL_DURATION, 3, "점심 식사", schedule);
      lunchAssigned = true;
      break;
    }
  }
  if (!lunchAssigned) {
    for (let startMin = 660; startMin <= 840 - MEAL_DURATION; startMin++) {
      if (checkAvailability(slots, startMin, MEAL_DURATION)) {
        assignSlot(slots, startMin, MEAL_DURATION, 3, "점심 식사", schedule);
        break;
      }
    }
  }

  // 저녁 17:00~20:00 (1020~1200) 중 30분
  // 우선 18:00~19:00 (1080~1140) 근처 먼저 탐색
  let dinnerAssigned = false;
  for (let startMin = 1080; startMin <= 1140; startMin++) {
    if (
      startMin >= 1020 &&
      startMin <= 1200 - MEAL_DURATION &&
      checkAvailability(slots, startMin, MEAL_DURATION)
    ) {
      assignSlot(slots, startMin, MEAL_DURATION, 3, "저녁 식사", schedule);
      dinnerAssigned = true;
      break;
    }
  }
  if (!dinnerAssigned) {
    for (let startMin = 1020; startMin <= 1200 - MEAL_DURATION; startMin++) {
      if (checkAvailability(slots, startMin, MEAL_DURATION)) {
        assignSlot(slots, startMin, MEAL_DURATION, 3, "저녁 식사", schedule);
        break;
      }
    }
  }

  return { slots, schedule };
}

function assignTodos(slots, todos, schedule) {
  todos.sort((a, b) => b.duration - a.duration);
  todos.forEach((todo) => {
    const d = todo.duration;
    let assigned = false;
    for (let startMin = 0; startMin < slots.length; startMin++) {
      if (checkAvailability(slots, startMin, d)) {
        assignSlot(slots, startMin, d, 4, todo.title, schedule);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      console.warn(
        `[알림] '${todo.title}' (${d}분)를 배정할 충분한 시간이 없습니다.`
      );
    }
  });

  schedule.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return { slots, schedule };
}

// ================== 시각화 ==================
function colorForTypeFromSlotValue(slotValue) {
  // 여기서 slotValue는 0~4 숫자다.
  switch (slotValue) {
    case 1:
      return "var(--sleep-color)";
    case 2:
      return "var(--fixed-color)";
    case 3:
      return "var(--meal-color)";
    case 4:
      return "var(--todo-color)";
    case 0:
    default:
      return "var(--free-color)";
  }
}

// 슬롯 배열(분 단위)로 conic-gradient 문자열 생성
function buildGradientFromSlots(slots) {
  if (!slots || slots.length === 0) {
    return "conic-gradient(var(--free-color) 0deg 360deg)";
  }

  let gradient = "conic-gradient(";
  let currentType = slots[0];
  let startIndex = 0;

  for (let i = 1; i <= totalMinutes; i++) {
    const t = i < totalMinutes ? slots[i] : currentType;
    if (t !== currentType || i === totalMinutes) {
      const startAngle = (startIndex / totalMinutes) * 360;
      const endAngle = (i / totalMinutes) * 360;
      gradient += `${colorForTypeFromSlotValue(
        currentType
      )} ${startAngle}deg ${endAngle}deg, `;
      currentType = t;
      startIndex = i;
    }
  }

  gradient = gradient.slice(0, -2) + ")";
  return gradient;
}

function displayResults(finalSchedule, slots) {
  const resultSection = document.querySelector(".result-section");
  const detailList = document.getElementById("detail-schedule-list");
  const chart = document.getElementById("timeline-chart");

  resultSection.classList.remove("hidden");
  detailList.innerHTML = "";

  // 상세 일정
  finalSchedule.forEach((item) => {
    const div = document.createElement("div");
    let icon = "";
    let tagText = "";

    switch (item.type) {
      case "sleep":
        icon = "😴";
        tagText = "수면";
        break;
      case "fixed":
        icon = "🗓️";
        tagText = "고정";
        break;
      case "meal":
        icon = "🍴";
        tagText = "식사";
        break;
      case "todo":
        icon = "📝";
        tagText = "할 일";
        break;
      default:
        icon = "❓";
        tagText = "기타";
    }

    div.className = `schedule-item ${item.type}-item`;
    div.innerHTML = `
      <span class="icon">${icon}</span>
      <span class="time">${item.start} ~ ${item.end}</span>
      <span class="title">${item.title}</span>
      <span class="tag ${item.type}-tag">${tagText}</span>
    `;
    detailList.appendChild(div);
  });

  // 시계판 다시 그리기(눈금 + 숫자)
  initClockFace();

  // 배경에 원형 그라디언트(링) 입히기
  const gradient = buildGradientFromSlots(slots);
  chart.style.backgroundImage = gradient;

  // 중앙 텍스트: 가장 이른 일정 시작 시각
  const center = chart.querySelector(".clock-center");
  if (center) {
    if (finalSchedule.length > 0) {
      const first = [...finalSchedule].sort(
        (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
      )[0];
      center.textContent = first.start;
    } else {
      center.textContent = "오늘 일정";
    }
  }
}


