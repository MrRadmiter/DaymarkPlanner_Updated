import { useEffect, useMemo, useState } from "react";
import { Button, Field, Icon, TextArea } from "./components/ui";

type Priority = "High" | "Medium" | "Low";

type CategoryItem = {
  id: string;
  name: string;
  color: string;
};

type Entry = {
  id: number;
  title: string;
  date?: string;
  start?: string;
  end?: string;
  category: string;
  priority: Priority;
  notes?: string;
  done: boolean;
};

type User = {
  username: string;
  token: string;
};

const API_URL = "https://daymarkplanner-updated.onrender.com/";

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "study", name: "Study", color: "#5d79a6" },
{ id: "personal", name: "Personal", color: "#a66e8b" },
{ id: "health", name: "Health", color: "#65916f" },
];

const getTodayString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatFullDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

function loadEntries(): Entry[] {
  try {
    const value = localStorage.getItem("daymark.entries");
    return value ? (JSON.parse(value) as Entry[]) : [];
  } catch {
    return [];
  }
}

function loadCategories(): CategoryItem[] {
  try {
    const value = localStorage.getItem("daymark.categories");
    if (value) {
      const parsed = JSON.parse(value) as CategoryItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CATEGORIES;
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function sortEntries(a: Entry, b: Entry): number {
  const hasDateA = Boolean(a.date && a.date.trim());
  const hasDateB = Boolean(b.date && b.date.trim());

  if (hasDateA && !hasDateB) return -1;
  if (!hasDateA && hasDateB) return 1;

  if (hasDateA && hasDateB && a.date !== b.date) {
    return a.date!.localeCompare(b.date!);
  }

  const hasTimeA = Boolean(a.start && a.start.trim());
  const hasTimeB = Boolean(b.start && b.start.trim());

  if (hasTimeA && !hasTimeB) return -1;
  if (!hasTimeA && hasTimeB) return 1;

  if (hasTimeA && hasTimeB && a.start !== b.start) {
    return a.start!.localeCompare(b.start!);
  }

  return a.id - b.id;
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [categories, setCategories] = useState<CategoryItem[]>(loadCategories);
  const [activeView, setActiveView] = useState<"Day" | "Week" | "Month" | "NoDate" | "All" | "Settings">("Day");
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("daymark.theme") === "dark");

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("daymark.user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const todayStr = useMemo(() => getTodayString(), []);

  useEffect(() => {
    localStorage.setItem("daymark.entries", JSON.stringify(entries));
  }, [entries]);

  // 1. Автоматическая загрузка актуальных задач с сервера при запуске приложения
  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: user.token,
      },
      body: JSON.stringify({}), // Пустой запрос возвращает данные с сервера без перезаписи
    })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && Array.isArray(data.entries)) {
        setEntries(data.entries);
      }
    })
    .catch(() => {}); // Тихо игнорируем, если бэкенд выключен
  }, [user]);

  // 2. Автоматическая отправка на сервер через 1 секунду после любого изменения задач
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetch(`${API_URL}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user.token,
        },
        body: JSON.stringify({ entries }),
      }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, [entries, user]);

  useEffect(() => {
    localStorage.setItem("daymark.categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("daymark.theme", dark ? "dark" : "light");
  }, [dark]);

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) {
      map[c.name] = c.color;
    }
    return map;
  }, [categories]);

  const selectedDayEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
                                     [entries, selectedDate]
  );

  const noDateEntries = useMemo(
    () => entries.filter((entry) => !entry.date || !entry.date.trim()),
                                [entries]
  );

  const filtered = useMemo(() => {
    const base =
    activeView === "All"
    ? entries
    : activeView === "NoDate"
    ? noDateEntries
    : selectedDayEntries;

    return base
    .filter((entry) => categoryFilter === "All" || entry.category === categoryFilter)
    .filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()))
    .slice()
    .sort(sortEntries);
  }, [activeView, entries, noDateEntries, selectedDayEntries, categoryFilter, query]);

  const completed = selectedDayEntries.filter((entry) => entry.done).length;
  const percent = selectedDayEntries.length ? Math.round((completed / selectedDayEntries.length) * 100) : 0;

  const changeDayOffset = (offset: number) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + offset);
    setSelectedDate(getTodayString(d));
  };

  const openNew = (defaultDate?: string) => {
    setEditing(null);
    if (defaultDate) {
      setSelectedDate(defaultDate);
    }
    setEditorOpen(true);
  };

  const saveEntry = (entry: Entry) => {
    setEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      return exists ? current.map((item) => (item.id === entry.id ? entry : item)) : [...current, entry];
    });
    setEditorOpen(false);
  };

  const exportJson = () => {
    downloadFile("daymark-backup.json", JSON.stringify(entries, null, 2), "application/json");
  };

  const exportIcs = () => {
    const events = entries
    .filter((entry) => entry.date && entry.date.trim())
    .map((entry) => {
      const timePart = entry.start && entry.start.trim() ? `T${entry.start.replace(":", "")}00` : "T090000";
      return `BEGIN:VEVENT\nUID:${entry.id}@daymark.local\nDTSTART:${entry.date!.replaceAll("-", "")}${timePart}\nSUMMARY:${entry.title}\nEND:VEVENT`;
    })
    .join("\n");
    downloadFile("daymark-schedule.ics", `BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`, "text/calendar");
  };

  const isListView = activeView === "Day" || activeView === "All" || activeView === "NoDate";

  return (
    <div className="app-shell">
    <aside className="sidebar">
    <div className="brand">
    <div className="brand-mark"><Icon name="check" /></div>
    <div className="brand-name">daymark</div>
    </div>

    <nav className="nav-stack" aria-label="Main navigation">
    <Button variant={activeView === "Day" ? "nav-active" : "nav"} onClick={() => setActiveView("Day")} icon="sun">Day</Button>
    <Button variant={activeView === "Week" ? "nav-active" : "nav"} onClick={() => setActiveView("Week")} icon="calendar">Week</Button>
    <Button variant={activeView === "Month" ? "nav-active" : "nav"} onClick={() => setActiveView("Month")} icon="calendar">Calendar</Button>
    <Button variant={activeView === "NoDate" ? "nav-active" : "nav"} onClick={() => setActiveView("NoDate")} icon="clock">No Deadline</Button>
    <Button variant={activeView === "All" ? "nav-active" : "nav"} onClick={() => setActiveView("All")} icon="search">All Tasks</Button>
    </nav>

    <div className="sidebar-bottom">
    <Button
    variant={activeView === "Settings" ? "nav-active" : "nav"}
    onClick={() => setActiveView("Settings")}
    icon="settings"
    >
    Settings
    </Button>
    </div>
    </aside>

    <main className="main">
    <header className="mobile-header">
    <div className="brand">
    <div className="brand-mark"><Icon name="check" /></div>
    <div className="brand-name">daymark</div>
    </div>
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <Button variant="icon" label="No Deadline" onClick={() => setActiveView("NoDate")} icon="clock" />
    <Button variant="icon" label="Settings" onClick={() => setActiveView("Settings")} icon="settings" />
    </div>
    </header>

    {isListView ? (
      <>
      <section className="page-heading">
      <div>
      <div className="eyebrow">
      {activeView === "All"
        ? "ALL TASKS"
        : activeView === "NoDate"
        ? "BACKLOG / NO DEADLINE"
        : selectedDate === todayStr
        ? "TODAY"
        : "SELECTED DATE"}
        </div>
        <div className="page-title">
        {activeView === "All"
          ? "All Entries Overview"
          : activeView === "NoDate"
          ? "Tasks Without Deadline"
          : formatFullDate(selectedDate)}
          </div>
          <div className="page-subtitle">
          {activeView === "All"
            ? `Total entries: ${entries.length}`
            : activeView === "NoDate"
            ? `Unscheduled tasks: ${noDateEntries.length}`
            : "Daily schedule and progress."}
            </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {activeView === "Day" && (
              <>
              <Button variant="secondary" onClick={() => changeDayOffset(-1)}>← Prev</Button>
              <Button variant="secondary" onClick={() => setSelectedDate(todayStr)}>Today</Button>
              <Button variant="secondary" onClick={() => changeDayOffset(1)}>Next →</Button>
              </>
            )}
            <Button
            variant="primary"
            onClick={() => openNew(activeView === "NoDate" ? "" : selectedDate)}
            icon="plus"
            >
            New entry
            </Button>
            </div>
            </section>

            {activeView === "Day" && (
              <section className="progress-card">
              <div className="progress-top">
              <div>
              <div className="card-label">DAILY PROGRESS</div>
              <div className="progress-copy">
              <strong>{completed}</strong> of {selectedDayEntries.length} entries complete
              </div>
              </div>
              <div className="progress-percent">{percent}%</div>
              </div>
              <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
              </section>
            )}

            <section className="toolbar">
            <Field
            className="search-field"
            aria-label="Search entries"
            placeholder="Filter tasks..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leadingIcon="search"
            />
            <div className="filter-group" aria-label="Filter by category" style={{ overflowX: "auto" }}>
            <Button
            variant={categoryFilter === "All" ? "filter-active" : "filter"}
            onClick={() => setCategoryFilter("All")}
            >
            All
            </Button>
            {categories.map((item) => (
              <Button
              key={item.id}
              variant={categoryFilter === item.name ? "filter-active" : "filter"}
              onClick={() => setCategoryFilter(item.name)}
              >
              <span
              className="category-dot"
              style={{ backgroundColor: item.color }}
              />
              {item.name}
              </Button>
            ))}
            </div>
            </section>

            <section className="timeline">
            {filtered.length ? (
              filtered.map((entry) => {
                const hasDate = Boolean(entry.date && entry.date.trim());
                const hasTime = Boolean(entry.start && entry.start.trim());
                const dotColor = categoryColorMap[entry.category] || "var(--muted)";

                return (
                  <article className={`entry ${entry.done ? "entry-done" : ""}`} key={entry.id}>
                  <div className="entry-time" style={{ width: activeView === "All" ? "76px" : "58px" }}>
                  <span>{hasTime ? entry.start : "No time"}</span>
                  {hasTime && entry.end && <small>{entry.end}</small>}
                  {(activeView === "All" || activeView === "NoDate") && (
                    <small style={{ fontWeight: hasDate ? "600" : "400" }}>
                    {hasDate ? entry.date : "No date"}
                    </small>
                  )}
                  </div>
                  <Button
                  variant={entry.done ? "check-active" : "check"}
                  label={entry.done ? `Mark ${entry.title} incomplete` : `Mark ${entry.title} complete`}
                  icon="check"
                  onClick={() =>
                    setEntries((current) =>
                    current.map((item) => (item.id === entry.id ? { ...item, done: !item.done } : item))
                    )
                  }
                  />
                  <div className="entry-body" onClick={() => { setEditing(entry); setEditorOpen(true); }}>
                  <div className="entry-title">{entry.title}</div>
                  <div className="entry-meta">
                  <span className="category-dot" style={{ backgroundColor: dotColor }} />
                  {entry.category}
                  {entry.notes && <><span className="meta-separator" />{entry.notes}</>}
                  </div>
                  </div>
                  <div className={`priority priority-${entry.priority.toLowerCase()}`}>{entry.priority}</div>
                  <Button
                  variant="more"
                  label={`Edit ${entry.title}`}
                  icon="chevron"
                  onClick={() => { setEditing(entry); setEditorOpen(true); }}
                  />
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
              <div className="empty-icon"><Icon name="search" /></div>
              <div className="empty-title">No entries found</div>
              <div className="empty-copy">No tasks match the current filter or date.</div>
              </div>
            )}
            </section>
            </>
    ) : activeView === "Week" ? (
      <WeekView
      entries={entries}
      weekOffset={selectedWeekOffset}
      onWeekOffsetChange={setSelectedWeekOffset}
      onSelectDate={(date) => { setSelectedDate(date); setActiveView("Day"); }}
      onExportJson={exportJson}
      onExportIcs={exportIcs}
      />
    ) : activeView === "Month" ? (
      <MonthCalendarView
      entries={entries}
      monthDate={calendarMonth}
      onMonthChange={setCalendarMonth}
      onSelectDate={(date) => { setSelectedDate(date); setActiveView("Day"); }}
      onNewTask={(date) => openNew(date)}
      />
    ) : (
      <SettingsView
      dark={dark}
      setDark={setDark}
      user={user}
      setUser={setUser}
      entries={entries}
      setEntries={setEntries}
      categories={categories}
      setCategories={setCategories}
      setCategoryFilter={setCategoryFilter}
      />
    )}
    </main>

    <nav className="mobile-nav" aria-label="Mobile navigation">
    <Button variant={activeView === "Day" ? "mobile-active" : "mobile"} icon="sun" onClick={() => setActiveView("Day")}>Day</Button>
    <Button variant={activeView === "Week" ? "mobile-active" : "mobile"} icon="calendar" onClick={() => setActiveView("Week")}>Week</Button>
    <Button variant={activeView === "Month" ? "mobile-active" : "mobile"} icon="calendar" onClick={() => setActiveView("Month")}>Month</Button>
    <Button variant={activeView === "NoDate" ? "mobile-active" : "mobile"} icon="clock" onClick={() => setActiveView("NoDate")}>Backlog</Button>
    <Button variant={activeView === "All" ? "mobile-active" : "mobile"} icon="search" onClick={() => setActiveView("All")}>All</Button>
    </nav>

    {editorOpen && (
      <EntryEditor
      entry={editing}
      defaultDate={activeView === "NoDate" ? "" : selectedDate}
      categories={categories}
      onClose={() => setEditorOpen(false)}
      onSave={saveEntry}
      onDelete={
        editing
        ? () => {
          setEntries((current) => current.filter((entry) => entry.id !== editing.id));
          setEditorOpen(false);
        }
        : undefined
      }
      />
    )}
    </div>
  );
}

function SettingsView({
  dark,
  setDark,
  user,
  setUser,
  entries,
  setEntries,
  categories,
  setCategories,
  setCategoryFilter,
}: {
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  entries: Entry[];
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  categories: CategoryItem[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryItem[]>>;
  setCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#315c47");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatColor, setEditingCatColor] = useState("");

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    const newItem: CategoryItem = {
      id: `${Date.now()}`,
      name: trimmed,
      color: newCatColor,
    };
    setCategories((prev) => [...prev, newItem]);
    setNewCatName("");
  };

  const startEditCategory = (cat: CategoryItem) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatColor(cat.color);
  };

  const saveEditCategory = (cat: CategoryItem) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) return;
    const oldName = cat.name;
    setCategories((prev) =>
    prev.map((c) => (c.id === cat.id ? { ...c, name: trimmed, color: editingCatColor } : c))
    );
    if (oldName !== trimmed) {
      setEntries((prev) =>
      prev.map((e) => (e.category === oldName ? { ...e, category: trimmed } : e))
      );
      setCategoryFilter((prev) => (prev === oldName ? trimmed : prev));
    }
    setEditingCatId(null);
  };

  const deleteCategory = (cat: CategoryItem) => {
    if (categories.length <= 1) return;
    const remaining = categories.filter((c) => c.id !== cat.id);
    const fallbackName = remaining[0].name;
    setCategories(remaining);
    setEntries((prev) =>
    prev.map((e) => (e.category === cat.name ? { ...e, category: fallbackName } : e))
    );
    setCategoryFilter((prev) => (prev === cat.name ? "All" : prev));
  };

  const handleAuth = async (action: "login" | "register") => {
    if (!username.trim() || !password.trim()) {
      setMsg("Please enter username and password.");
      return;
    }
    setLoading(true);
    setMsg("Connecting to server...");
    try {
      const res = await fetch(`${API_URL}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        const u = { username: data.username, token: data.token };
        setUser(u);
        localStorage.setItem("daymark.user", JSON.stringify(u));
        setMsg(`Successfully ${action === "login" ? "logged in" : "registered"}!`);
      } else {
        setMsg(`Error: ${data.error || "Operation failed"}`);
      }
    } catch {
      setMsg("Server connection error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    setLoading(true);
    setMsg("Syncing data with server...");
    try {
      const res = await fetch(`${API_URL}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: user.token,
        },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.entries)) {
          setEntries(data.entries);
        }
        setMsg("Synced successfully across devices!");
      } else {
        setMsg(`Sync failed: ${data.error}`);
      }
    } catch {
      setMsg("Offline mode active. Your changes are safely stored locally in your browser.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("daymark.user");
    setMsg("Logged out successfully.");
  };

  return (
    <>
    <section className="page-heading">
    <div>
    <div className="eyebrow">PREFERENCES & ACCOUNT</div>
    <div className="page-title">Settings</div>
    <div className="page-subtitle">Manage account, appearance, and categories.</div>
    </div>
    </section>

    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "640px" }}>
    {/* 1. Account / Login */}
    <div className="progress-card">
    <div style={{ fontWeight: "700", fontSize: "16px", marginBottom: "8px" }}>Account & Synchronization</div>
    <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
    Daymark operates offline-first using browser local storage. Log in to synchronize your tasks across multiple devices.
    </div>

    {user ? (
      <div>
      <div style={{ marginBottom: "16px", fontSize: "15px" }}>
      Signed in as: <strong>{user.username}</strong>
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <Button variant="primary" onClick={handleSync} disabled={loading}>
      {loading ? "Syncing..." : "Sync Data Now"}
      </Button>
      <Button variant="danger" onClick={handleLogout}>
      Log Out
      </Button>
      </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Field
      label="Username"
      placeholder="Enter your username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      />
      <Field
      label="Password"
      type="password"
      placeholder="Enter your password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      />
      <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
      <Button variant="primary" onClick={() => handleAuth("login")} disabled={loading}>
      {loading ? "Processing..." : "Login"}
      </Button>
      <Button variant="secondary" onClick={() => handleAuth("register")} disabled={loading}>
      Register Account
      </Button>
      </div>
      </div>
    )}

    {msg && (
      <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--brand)", fontWeight: "600" }}>
      {msg}
      </div>
    )}
    </div>

    {/* 2. Appearance */}
    <div className="progress-card">
    <div style={{ fontWeight: "700", fontSize: "16px", marginBottom: "8px" }}>Appearance</div>
    <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
    Choose between light and dark themes for your workspace.
    </div>
    <Button variant="secondary" onClick={() => setDark((v) => !v)} icon={dark ? "sun" : "moon"}>
    {dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    </Button>
    </div>

    {/* 3. Categories (Last with scroll) */}
    <div className="progress-card">
    <div style={{ fontWeight: "700", fontSize: "16px", marginBottom: "8px" }}>Categories</div>
    <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
    Create, rename, recolor, or remove task categories.
    </div>

    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <input
    type="color"
    className="cat-color-input"
    value={newCatColor}
    onChange={(e) => setNewCatColor(e.target.value)}
    aria-label="Category color"
    />
    <input
    type="text"
    placeholder="New category name..."
    value={newCatName}
    onChange={(e) => setNewCatName(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
    />
    <Button variant="primary" icon="plus" onClick={handleAddCategory} disabled={!newCatName.trim()}>
    Add
    </Button>
    </div>

    <div className="cat-manager-list" style={{ maxHeight: "250px", overflowY: "auto" }}>
    {categories.map((cat) => (
      <div className="cat-manager-item" key={cat.id}>
      {editingCatId === cat.id ? (
        <>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1 }}>
        <input
        type="color"
        className="cat-color-input"
        value={editingCatColor}
        onChange={(e) => setEditingCatColor(e.target.value)}
        />
        <input
        type="text"
        value={editingCatName}
        onChange={(e) => setEditingCatName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && saveEditCategory(cat)}
        />
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
        <Button variant="icon" icon="check" label="Save" onClick={() => saveEditCategory(cat)} />
        <Button variant="icon" icon="close" label="Cancel" onClick={() => setEditingCatId(null)} />
        </div>
        </>
      ) : (
        <>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
        className="category-dot"
        style={{ backgroundColor: cat.color, width: "10px", height: "10px" }}
        />
        <span style={{ fontWeight: "600", fontSize: "14px" }}>{cat.name}</span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
        <Button variant="icon" icon="edit" label="Edit category" onClick={() => startEditCategory(cat)} />
        {categories.length > 1 && (
          <Button variant="icon" icon="trash" label="Delete category" onClick={() => deleteCategory(cat)} />
        )}
        </div>
        </>
      )}
      </div>
    ))}
    </div>
    </div>
    </div>
    </>
  );
}

function WeekView({
  entries,
  weekOffset,
  onWeekOffsetChange,
  onSelectDate,
  onExportJson,
  onExportIcs,
}: {
  entries: Entry[];
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  onSelectDate: (dateStr: string) => void;
  onExportJson: () => void;
  onExportIcs: () => void;
}) {
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const monday = useMemo(() => getStartOfWeek(baseDate), [baseDate]);

  const weekDays = useMemo(() => {
    const days = [];
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayStr = getTodayString();
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = getTodayString(d);
      const dayEntries = entries.filter((e) => e.date === dateStr);
      days.push({
        name: names[i],
        dateNum: d.getDate(),
                fullDateStr: dateStr,
                total: dayEntries.length,
                completed: dayEntries.filter((e) => e.done).length,
                isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [entries, monday]);

  const totalWeekly = useMemo(() => weekDays.reduce((acc, d) => acc + d.total, 0), [weekDays]);
  const completedWeekly = useMemo(() => weekDays.reduce((acc, d) => acc + d.completed, 0), [weekDays]);
  const weeklyPercent = totalWeekly ? Math.round((completedWeekly / totalWeekly) * 100) : 0;
  const maxDailyTasks = useMemo(() => Math.max(...weekDays.map((d) => d.total), 1), [weekDays]);

  const sunday = useMemo(() => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + 6);
    return d;
  }, [monday]);

  const rangeLabel = `${monday.getDate()} ${monday.toLocaleDateString("en-US", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("en-US", { month: "short" })} ${sunday.getFullYear()}`;

  return (
    <>
    <section className="page-heading">
    <div>
    <div className="eyebrow">WEEKLY OVERVIEW</div>
    <div className="page-title">{rangeLabel}</div>
    <div className="page-subtitle">Tasks scheduled for this week.</div>
    </div>
    <div className="export-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
    <Button variant="secondary" onClick={() => onWeekOffsetChange(weekOffset - 1)}>← Prev</Button>
    <Button variant="secondary" onClick={() => onWeekOffsetChange(0)}>This Week</Button>
    <Button variant="secondary" onClick={() => onWeekOffsetChange(weekOffset + 1)}>Next →</Button>
    <Button variant="secondary" icon="download" onClick={onExportJson}>JSON</Button>
    <Button variant="primary" icon="calendar" onClick={onExportIcs}>.ics</Button>
    </div>
    </section>

    <section className="week-summary">
    <div>
    <div className="card-label">WEEKLY LOAD</div>
    <div className="summary-number">{totalWeekly}</div>
    <div className="summary-caption">total tasks</div>
    </div>
    <div className="summary-divider" />
    <div>
    <div className="card-label">COMPLETED</div>
    <div className="summary-number">{completedWeekly}</div>
    <div className="summary-caption">{weeklyPercent}% completion rate</div>
    </div>
    <div className="week-bars">
    {weekDays.map((day) => (
      <div
      className="day-column"
      key={day.fullDateStr}
      style={{ cursor: "pointer" }}
      onClick={() => onSelectDate(day.fullDateStr)}
      >
      <div className="bar-track">
      <div
      className="bar-fill"
      style={{ height: `${(day.total / maxDailyTasks) * 100}%` }}
      />
      </div>
      <span>{day.name}</span>
      <strong className={day.isToday ? "today-date" : ""}>{day.dateNum}</strong>
      </div>
    ))}
    </div>
    </section>
    </>
  );
}

function MonthCalendarView({
  entries,
  monthDate,
  onMonthChange,
  onSelectDate,
  onNewTask,
}: {
  entries: Entry[];
  monthDate: Date;
  onMonthChange: (d: Date) => void;
  onSelectDate: (dateStr: string) => void;
  onNewTask: (dateStr: string) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const todayStr = getTodayString();

  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const changeMonth = (offset: number) => {
    onMonthChange(new Date(year, month + offset, 1));
  };

  const calendarGrid = useMemo(() => {
    const grid = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      grid.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = getTodayString(dateObj);
      const dayTasks = entries.filter((e) => e.date === dateStr);
      grid.push({
        dayNum: d,
        dateStr,
        tasks: dayTasks,
        isToday: dateStr === todayStr,
      });
    }
    return grid;
  }, [year, month, startingDayOfWeek, daysInMonth, entries, todayStr]);

  return (
    <>
    <section className="page-heading">
    <div>
    <div className="eyebrow">MONTHLY CALENDAR</div>
    <div className="page-title">{monthLabel}</div>
    <div className="page-subtitle">Navigate through months to inspect planned activities.</div>
    </div>
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
    <Button variant="secondary" onClick={() => changeMonth(-1)}>← Prev</Button>
    <Button variant="secondary" onClick={() => onMonthChange(new Date())}>Current</Button>
    <Button variant="secondary" onClick={() => changeMonth(1)}>Next →</Button>
    </div>
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginTop: "16px", overflowX: "auto" }}>
    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
      <div key={dayName} style={{ fontWeight: "bold", textAlign: "center", padding: "4px", opacity: 0.7, fontSize: "12px" }}>
      {dayName}
      </div>
    ))}

    {calendarGrid.map((cell, index) =>
      cell ? (
        <div
        key={cell.dateStr}
        style={{
          border: "1px solid var(--border-color, #334155)",
              borderRadius: "8px",
              padding: "4px",
              minHeight: "65px",
              backgroundColor: cell.isToday ? "rgba(59, 130, 246, 0.1)" : "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
        }}
        onClick={() => onSelectDate(cell.dateStr)}
        >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ color: cell.isToday ? "#3b82f6" : "inherit", fontSize: "13px" }}>{cell.dayNum}</strong>
        <Button
        variant="icon"
        icon="plus"
        label="Add task"
        onClick={(e) => {
          e.stopPropagation();
          onNewTask(cell.dateStr);
        }}
        />
        </div>
        <div>
        {cell.tasks.length > 0 && (
          <div style={{ fontSize: "10px", marginTop: "2px" }}>
          <span style={{ fontWeight: "bold", color: "#3b82f6" }}>{cell.tasks.length} task(s)</span>
          </div>
        )}
        </div>
        </div>
      ) : (
        <div key={`empty-${index}`} style={{ padding: "4px" }} />
      )
    )}
    </section>
    </>
  );
}

function EntryEditor({
  entry,
  defaultDate,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  entry: Entry | null;
  defaultDate: string;
  categories: CategoryItem[];
  onClose: () => void;
  onSave: (entry: Entry) => void;
  onDelete?: () => void;
}) {
  const initialHasDate = entry ? Boolean(entry.date && entry.date.trim()) : Boolean(defaultDate);
  const initialHasTime = entry ? Boolean(entry.start && entry.start.trim()) : true;

  const [hasDate, setHasDate] = useState<boolean>(initialHasDate);
  const [hasTime, setHasTime] = useState<boolean>(initialHasTime);
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);

  const defaultCategoryName = categories[0]?.name || "Study";

  const [form, setForm] = useState<Entry>(
    entry ?? {
      id: Date.now(),
                                          title: "",
                                          date: defaultDate || getTodayString(),
                                          start: "09:00",
                                          end: "10:00",
                                          category: defaultCategoryName,
                                          priority: "Medium",
                                          notes: "",
                                          done: false,
    }
  );

  const update = <K extends keyof Entry>(key: K, value: Entry[K]) =>
  setForm((current) => ({ ...current, [key]: value }));

  const handleToggleDate = (checked: boolean) => {
    setHasDate(checked);
    if (checked && !form.date) {
      update("date", defaultDate || getTodayString());
    }
  };

  const handleToggleTime = (checked: boolean) => {
    setHasTime(checked);
    if (checked && !form.start) {
      update("start", "09:00");
      update("end", "10:00");
    }
  };

  const handleSave = () => {
    const cleaned: Entry = {
      ...form,
      date: hasDate ? (form.date || getTodayString()) : undefined,
      start: hasTime ? (form.start || "09:00") : undefined,
      end: hasTime ? form.end : undefined,
    };
    onSave(cleaned);
  };

  const visibleCategories = showAllCategories ? categories : categories.slice(0, 3);
  const hasMoreCategories = categories.length > 3;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
    <section
    className="modal"
    role="dialog"
    aria-modal="true"
    aria-label={entry ? "Edit entry" : "New entry"}
    onMouseDown={(event) => event.stopPropagation()}
    >
    <div className="modal-header">
    <div>
    <div className="eyebrow">{entry ? "EDIT ENTRY" : "NEW ENTRY"}</div>
    <div className="modal-title">{entry ? "Edit task details" : "Create new task"}</div>
    </div>
    <Button variant="icon" label="Close" icon="close" onClick={onClose} />
    </div>
    <div className="form-stack">
    <Field
    label="Title"
    value={form.title}
    placeholder="Task title..."
    autoFocus
    onChange={(event) => update("title", event.target.value)}
    />

    <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
    <label className="toggle-label">
    <input
    type="checkbox"
    checked={hasDate}
    onChange={(e) => handleToggleDate(e.target.checked)}
    />
    Set due date
    </label>
    <label className="toggle-label">
    <input
    type="checkbox"
    checked={hasTime}
    onChange={(e) => handleToggleTime(e.target.checked)}
    />
    Set time
    </label>
    </div>

    {(hasDate || hasTime) && (
      <div className="form-grid">
      {hasDate && (
        <Field
        label="Date"
        type="date"
        value={form.date || ""}
        onChange={(event) => update("date", event.target.value)}
        />
      )}
      {hasTime && (
        <>
        <Field
        label="Start time"
        type="time"
        value={form.start || ""}
        onChange={(event) => update("start", event.target.value)}
        />
        <Field
        label="End time"
        type="time"
        value={form.end || ""}
        onChange={(event) => update("end", event.target.value)}
        />
        </>
      )}
      </div>
    )}

    <div className="form-grid two">
    <div className="choice-field">
    <div className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span>Category</span>
    {hasMoreCategories && (
      <button
      type="button"
      onClick={() => setShowAllCategories(!showAllCategories)}
      style={{ background: "none", border: "none", color: "var(--brand)", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}
      >
      {showAllCategories ? "Show less" : `+${categories.length - 3} more`}
      </button>
    )}
    </div>
    <div className="segmented-wrap">
    {visibleCategories.map((item) => (
      <Button
      key={item.id}
      variant={form.category === item.name ? "segment-active" : "segment"}
      onClick={() => update("category", item.name)}
      >
      <span className="category-dot" style={{ backgroundColor: item.color }} />
      {item.name}
      </Button>
    ))}
    </div>
    </div>
    <div className="choice-field">
    <div className="field-label">Priority</div>
    <div className="segmented">
    {(["High", "Medium", "Low"] as Priority[]).map((item) => (
      <Button
      key={item}
      variant={form.priority === item ? "segment-active" : "segment"}
      onClick={() => update("priority", item)}
      >
      {item}
      </Button>
    ))}
    </div>
    </div>
    </div>
    <TextArea
    label="Notes"
    value={form.notes ?? ""}
    placeholder="Additional details..."
    onChange={(event) => update("notes", event.target.value)}
    />
    </div>
    <div className="modal-footer">
    {onDelete ? <Button variant="danger" icon="trash" onClick={onDelete}>Delete</Button> : <span />}
    <div className="footer-actions">
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="primary" icon="check" disabled={!form.title.trim()} onClick={handleSave}>Save entry</Button>
    </div>
    </div>
    </section>
    </div>
  );
}
