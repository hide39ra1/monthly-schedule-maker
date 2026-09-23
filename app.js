(() => {
  const STORAGE_KEY = "brass-calendar-v1";
  const categoryLabels = { practice: "演奏練習", event: "本番・行事等", restricted: "入校制限" };
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const $ = (id) => document.getElementById(id);
  const initial = new Date();
  const state = {
    year: initial.getFullYear(), month: initial.getMonth(), view: "calendar",
    settings: { showSunday: true, showSaturday: true, showHolidayNames: true, showEmpty: true },
    clubName: "吹奏楽部 活動予定表", footerNote: "※予定は変更になる場合があります。最新の連絡を確認してください。", events: []
  };

  function dateKey(date) {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function escapeHtml(value = "") { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
  function normalizeCategory(category) {
    if (category === "rehearsal" || category === "ensemble" || category === "practice") return "practice";
    if (category === "performance" || category === "event") return "event";
    if (category === "off" || category === "restricted") return "restricted";
    return "practice";
  }
  function nthMonday(year, month, nth) {
    const first = new Date(year, month, 1); return 1 + ((8 - first.getDay()) % 7) + (nth - 1) * 7;
  }
  function equinoxDay(year, spring) {
    return Math.floor((spring ? 20.8431 : 23.2488) + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  function japaneseHolidays(year) {
    const holidays = new Map();
    const add = (month, day, name) => holidays.set(dateKey(new Date(year, month - 1, day)), name);
    add(1, 1, "元日"); add(1, nthMonday(year, 0, 2), "成人の日"); add(2, 11, "建国記念の日"); add(2, 23, "天皇誕生日");
    add(3, equinoxDay(year, true), "春分の日"); add(4, 29, "昭和の日"); add(5, 3, "憲法記念日"); add(5, 4, "みどりの日"); add(5, 5, "こどもの日");
    add(7, nthMonday(year, 6, 3), "海の日"); add(8, 11, "山の日"); add(9, nthMonday(year, 8, 3), "敬老の日"); add(9, equinoxDay(year, false), "秋分の日");
    add(10, nthMonday(year, 9, 2), "スポーツの日"); add(11, 3, "文化の日"); add(11, 23, "勤労感謝の日");
    const originals = [...holidays.entries()];
    originals.forEach(([key]) => {
      const date = new Date(`${key}T00:00:00`); if (date.getDay() !== 0) return;
      do { date.setDate(date.getDate() + 1); } while (holidays.has(dateKey(date)));
      holidays.set(dateKey(date), "振替休日");
    });
    for (let day = 2; day < 365; day++) {
      const date = new Date(year, 0, day); const key = dateKey(date); if (holidays.has(key) || date.getDay() === 0) continue;
      const before = new Date(date); before.setDate(date.getDate() - 1); const after = new Date(date); after.setDate(date.getDate() + 1);
      if (holidays.has(dateKey(before)) && holidays.has(dateKey(after))) holidays.set(key, "国民の休日");
    }
    return holidays;
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === "object") Object.assign(state, saved, { settings: { ...state.settings, ...(saved.settings || {}) } });
      const shared = new URLSearchParams(location.hash.slice(1)).get("data");
      if (shared) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(shared))));
        if (Array.isArray(decoded.events)) {
          state.events = decoded.events; state.year = decoded.year; state.month = decoded.month;
          state.clubName = decoded.clubName || state.clubName; state.footerNote = decoded.footerNote || state.footerNote;
          toast("共有された予定表を読み込みました");
        }
      }
      state.events = state.events.map(event => ({ ...event, category: normalizeCategory(event.category) }));
    } catch (error) { console.warn("保存データを読み込めませんでした", error); }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("updatedAt").textContent = `更新：${new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  }
  function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200); }
  function parseClubName() {
    const name = state.clubName.trim() || "吹奏楽部 活動予定表";
    const marker = name.lastIndexOf(" ");
    $("printSchool").textContent = marker > 0 ? name.slice(0, marker) : "吹奏楽部";
    $("printTitle").textContent = marker > 0 ? name.slice(marker + 1) : name;
  }
  function visibleDays() { return dayLabels.map((label, index) => ({ label, index })).filter(d => state.settings.showSunday || d.index !== 0).filter(d => state.settings.showSaturday || d.index !== 6); }
  function render() {
    $("clubName").value = state.clubName; $("footerNote").textContent = state.footerNote;
    $("showSunday").checked = state.settings.showSunday; $("showSaturday").checked = state.settings.showSaturday; $("showHolidayNames").checked = state.settings.showHolidayNames; $("showEmpty").checked = state.settings.showEmpty;
    const monthText = `${state.year}年 ${state.month + 1}月`;
    $("monthLabel").textContent = monthText; $("paperMonth").textContent = monthText; $("monthPicker").value = `${state.year}-${String(state.month + 1).padStart(2, "0")}`;
    parseClubName(); renderCalendar(); renderList(); document.body.classList.toggle("list-mode", state.view === "list");
    $("calendarView").hidden = state.view !== "calendar"; $("listView").hidden = state.view !== "list";
    document.querySelectorAll("[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));
    save();
  }
  function eventsFor(key) { return state.events.filter(event => event.date === key).sort((a,b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99")); }
  function renderCalendar() {
    const holidays = japaneseHolidays(state.year);
    const days = visibleDays(); const grid = $("calendarView"); grid.innerHTML = ""; grid.className = "calendar-view calendar-grid"; grid.style.setProperty("--columns", days.length);
    days.forEach(day => { const el = document.createElement("div"); el.className = `weekday ${day.index === 0 ? "sun" : day.index === 6 ? "sat" : ""}`; el.textContent = `${day.label}曜日`; grid.append(el); });
    const first = new Date(state.year, state.month, 1); const start = new Date(first); start.setDate(1 - first.getDay());
    const last = new Date(state.year, state.month + 1, 0); const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
    const cursor = new Date(start); const today = dateKey(new Date());
    while (cursor <= end) {
      if (days.some(day => day.index === cursor.getDay())) {
        const key = dateKey(cursor); const dayEvents = eventsFor(key); const cell = document.createElement("div");
        const holidayName = holidays.get(key); const dayClass = holidayName || cursor.getDay() === 0 ? "holiday" : cursor.getDay() === 6 ? "saturday" : "";
        cell.className = `day-cell ${dayClass} ${cursor.getMonth() !== state.month ? "outside" : ""} ${key === today ? "today" : ""}`;
        cell.innerHTML = `<div class="day-number"><span>${cursor.getDate()}${holidayName && state.settings.showHolidayNames ? ` <small>${escapeHtml(holidayName)}</small>` : ""}</span><button class="add-mini" aria-label="${key}に予定を追加">＋</button></div>`;
        cell.querySelector(".add-mini").addEventListener("click", () => openDialog(key));
        dayEvents.forEach(event => {
          const chip = document.createElement("button"); chip.className = `event-chip ${event.category}`;
          chip.textContent = `${event.startTime ? event.startTime + " " : ""}${event.title}`; chip.title = [event.title, event.place, event.note].filter(Boolean).join(" / ");
          chip.addEventListener("click", () => openDialog(key, event.id)); cell.append(chip);
        }); grid.append(cell);
      } cursor.setDate(cursor.getDate() + 1);
    }
  }
  function renderList() {
    const holidays = japaneseHolidays(state.year); const list = $("listView"); list.innerHTML = '<div class="list-row header"><div>日付</div><div>開始–終了</div><div>予定</div><div>場所</div><div>備考</div></div>';
    const lastDay = new Date(state.year, state.month + 1, 0).getDate(); let shown = 0;
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(state.year, state.month, day); const dow = date.getDay(); const key = dateKey(date); const events = eventsFor(key);
      if ((!state.settings.showSunday && dow === 0) || (!state.settings.showSaturday && dow === 6) || (!state.settings.showEmpty && events.length === 0)) continue;
      const rows = events.length ? events : [{ id: null, title: "", startTime: "", endTime: "", place: "", note: "", category: "practice" }];
      rows.forEach((event, index) => {
        const holidayName = holidays.get(key); const dayClass = holidayName || dow === 0 ? "holiday" : dow === 6 ? "saturday" : "";
        const row = document.createElement("div"); row.className = `list-row ${dayClass}`;
        const title = event.id ? `<button class="list-title-button">${escapeHtml(event.title)}</button>` : "";
        row.innerHTML = `<div class="list-date">${index === 0 ? `${day}<small>${dayLabels[dow]}曜日</small>${holidayName && state.settings.showHolidayNames ? `<span class="holiday-name">${escapeHtml(holidayName)}</span>` : ""}` : ""}</div><div>${escapeHtml([event.startTime, event.endTime].filter(Boolean).join("–"))}</div><div>${title}</div><div>${escapeHtml(event.place)}</div><div>${escapeHtml(event.note)}</div>`;
        if (event.id) row.querySelector("button").addEventListener("click", () => openDialog(key, event.id));
        list.append(row); shown++;
      });
    }
    if (!shown) list.insertAdjacentHTML("beforeend", '<div class="empty-state">この月の予定はまだありません。</div>');
  }
  function openDialog(date = dateKey(new Date(state.year, state.month, 1)), id = null) {
    const event = state.events.find(item => item.id === id);
    $("eventForm").reset(); $("eventId").value = event?.id || ""; $("eventDate").value = event?.date || date; $("eventTitle").value = event?.title || "";
    $("eventCategory").value = normalizeCategory(event?.category); $("startTime").value = event?.startTime || ""; $("endTime").value = event?.endTime || ""; $("eventPlace").value = event?.place || ""; $("eventNote").value = event?.note || "";
    $("dialogTitle").textContent = event ? "予定を編集" : "予定を追加"; $("deleteEventButton").hidden = !event; $("eventDialog").showModal(); setTimeout(() => $("eventTitle").focus(), 50);
  }
  function saveEvent() {
    const data = { id: $("eventId").value || uid(), date: $("eventDate").value, category: $("eventCategory").value, title: $("eventTitle").value.trim(), startTime: $("startTime").value, endTime: $("endTime").value, place: $("eventPlace").value.trim(), note: $("eventNote").value.trim() };
    const index = state.events.findIndex(item => item.id === data.id); if (index >= 0) state.events[index] = data; else state.events.push(data);
    const selected = new Date(`${data.date}T00:00:00`); state.year = selected.getFullYear(); state.month = selected.getMonth(); $("eventDialog").close(); render(); toast(index >= 0 ? "予定を更新しました" : "予定を追加しました");
  }
  function deleteEvent() { const id = $("eventId").value; state.events = state.events.filter(item => item.id !== id); $("eventDialog").close(); render(); toast("予定を削除しました"); }
  function exportData() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `活動予定表-${state.year}-${String(state.month + 1).padStart(2,"0")}.json`; link.click(); URL.revokeObjectURL(url); toast("データを書き出しました"); }
  function importData(file) { const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.events)) throw new Error(); Object.assign(state, data, { settings: { ...state.settings, ...(data.settings || {}) } }); state.events = state.events.map(event => ({ ...event, category: normalizeCategory(event.category) })); render(); toast("データを読み込みました"); } catch { alert("このファイルは読み込めませんでした。"); } }; reader.readAsText(file); }
  async function share() {
    const monthEvents = state.events.filter(e => { const d = new Date(`${e.date}T00:00:00`); return d.getFullYear() === state.year && d.getMonth() === state.month; });
    const payload = { year: state.year, month: state.month, clubName: state.clubName, footerNote: state.footerNote, events: monthEvents };
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); const url = `${location.origin}${location.pathname}#data=${encodeURIComponent(data)}`;
    try { await navigator.clipboard.writeText(url); toast("共有リンクをコピーしました"); } catch { prompt("このリンクをコピーしてください", url); }
  }
  function printSchedule() {
    let style = $("printPageStyle"); if (!style) { style = document.createElement("style"); style.id = "printPageStyle"; document.head.append(style); }
    style.textContent = `@page { size: A4 ${state.view === "list" ? "portrait" : "landscape"}; margin: 9mm; }`;
    window.print();
  }
  function bind() {
    $("prevMonth").onclick = () => { state.month--; if (state.month < 0) { state.month = 11; state.year--; } render(); };
    $("nextMonth").onclick = () => { state.month++; if (state.month > 11) { state.month = 0; state.year++; } render(); };
    $("todayButton").onclick = () => { const now = new Date(); state.year = now.getFullYear(); state.month = now.getMonth(); render(); };
    $("monthLabel").onclick = () => { try { $("monthPicker").showPicker(); } catch { $("monthPicker").click(); } };
    $("monthPicker").onchange = (e) => { const [year, month] = e.target.value.split("-").map(Number); state.year = year; state.month = month - 1; render(); };
    $("addEventButton").onclick = () => openDialog(); $("printButton").onclick = printSchedule; $("shareButton").onclick = share;
    document.querySelectorAll("[data-view]").forEach(btn => btn.onclick = () => { state.view = btn.dataset.view; render(); });
    ["showSunday","showSaturday","showHolidayNames","showEmpty"].forEach(id => $(id).onchange = e => { state.settings[id] = e.target.checked; render(); });
    $("clubName").oninput = e => { state.clubName = e.target.value; parseClubName(); save(); };
    $("footerNote").oninput = e => { state.footerNote = e.target.textContent; save(); };
    $("closeDialog").onclick = $("cancelButton").onclick = () => $("eventDialog").close();
    $("eventForm").addEventListener("submit", e => { e.preventDefault(); saveEvent(); }); $("deleteEventButton").onclick = deleteEvent;
    $("exportButton").onclick = exportData; $("importInput").onchange = e => e.target.files[0] && importData(e.target.files[0]);
    $("clearButton").onclick = () => { if (confirm("すべての予定を削除しますか？この操作は元に戻せません。")) { state.events = []; render(); toast("予定をすべて削除しました"); } };
  }
  function registerWebMcp() {
    const context = document.modelContext; if (!context?.registerTool) return;
    context.registerTool({ name: "list_calendar_events", title: "活動予定を確認", description: "選択中の月の活動予定を一覧で返します。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => ({ year: state.year, month: state.month + 1, events: state.events.filter(e => e.date.startsWith(`${state.year}-${String(state.month + 1).padStart(2,"0")}`)) }) });
    context.registerTool({ name: "create_calendar_event", title: "活動予定を追加", description: "吹奏楽部の活動予定を追加し、画面と端末保存データを更新します。", inputSchema: { type: "object", properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, title: { type: "string", minLength: 1 }, category: { type: "string", enum: ["practice","event","restricted"] }, startTime: { type: "string" }, endTime: { type: "string" }, place: { type: "string" }, note: { type: "string" } }, required: ["date","title","category"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async input => { if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !input.title?.trim() || !categoryLabels[input.category]) throw new Error("入力内容が正しくありません"); const event = { id: uid(), date: input.date, title: input.title.trim(), category: input.category, startTime: input.startTime || "", endTime: input.endTime || "", place: input.place || "", note: input.note || "" }; state.events.push(event); render(); return { created: true, event }; } });
  }
  load(); bind(); render(); registerWebMcp();
})();
