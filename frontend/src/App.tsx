import React, { useEffect, useState } from "react";
import {
  apiFetch,
  Assignment,
  clearAuthSession,
  getStoredTokens,
  Group,
  saveAuthSession,
  User,
} from "./services/api";

type Tab = "assignments" | "groups" | "profile" | "admin";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#0f172a",
    paddingBottom: 48,
  },
  authWrap: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1d4ed8 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  authCard: {
    width: "100%",
    maxWidth: 420,
    background: "#ffffff",
    borderRadius: 16,
    padding: "36px 32px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
  },
  navbar: {
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  navInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  container: {
    maxWidth: 1120,
    margin: "28px auto",
    padding: "0 24px",
  },
  card: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    marginBottom: 24,
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    width: "100%",
    boxSizing: "border-box",
  },
  primaryBtn: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
};

export function App() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [toast, setToast] = useState("");

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPerms, setMemberPerms] = useState<string[]>(["create", "update"]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);

  // Profile & Sessions state
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);

  // Admin state
  const [stats, setStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityData, setSecurityData] = useState<any>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      loadCoreData();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === "profile") loadSessions();
    if (user?.role === "admin" && activeTab === "admin") loadAdminData();
  }, [activeTab, user]);

  async function loadCoreData() {
    try {
      const [aData, gData] = await Promise.all([
        apiFetch<Assignment[]>("/assignments"),
        apiFetch<Group[]>("/groups"),
      ]);
      setAssignments(aData);
      setGroups(gData);
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function loadSessions() {
    try {
      const data = await apiFetch<any[]>("/auth/sessions");
      setSessions(data);
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function loadAdminData() {
    try {
      const [s, u, logs, sec] = await Promise.all([
        apiFetch("/admin/stats"),
        apiFetch(`/admin/users?search=${encodeURIComponent(userSearch)}`),
        apiFetch("/admin/audit-logs"),
        apiFetch("/admin/security"),
      ]);
      setStats(s);
      setAdminUsers(u.items || []);
      setAuditLogs(logs);
      setSecurityData(sec);
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    try {
      const endpoint = authMode === "signup" ? "/auth/signup" : "/auth/login";
      const body =
        authMode === "signup"
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };

      const data = await apiFetch<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      saveAuthSession(data.access_token, data.refresh_token, data.user);
      setUser(data.user);
      setPassword("");
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    setAuthError("");
    setLoading(true);
    try {
      const data = await apiFetch<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/auth/guest", { method: "POST" });

      saveAuthSession(data.access_token, data.refresh_token, data.user);
      setUser(data.user);
      notify("Welcome! Exploring GradeFlow in Guest Demo Mode.");
    } catch (err: any) {
      setAuthError(err.message || "Could not start guest demo");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { refreshToken } = getStoredTokens();
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore logout network error
    }
    clearAuthSession();
    setUser(null);
  }

  async function handleSaveAssignment(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        title,
        course_code: courseCode,
        description,
        due_date: dueDate,
        status: "pending",
        group_id: selectedGroupId ? Number(selectedGroupId) : null,
      };
      if (editingId) {
        await apiFetch(`/assignments/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notify("Assignment updated");
      } else {
        await apiFetch("/assignments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notify("Assignment created");
      }
      setTitle("");
      setCourseCode("");
      setDescription("");
      setDueDate("");
      setSelectedGroupId("");
      setEditingId(null);
      loadCoreData();
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleDeleteAssignment(id: number) {
    try {
      await apiFetch(`/assignments/${id}`, { method: "DELETE" });
      notify("Assignment deleted");
      loadCoreData();
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, description: groupDesc }),
      });
      setGroupName("");
      setGroupDesc("");
      notify("Group created");
      loadCoreData();
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleAddMember(e: React.FormEvent, groupId: number) {
    e.preventDefault();
    try {
      await apiFetch(`/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail, permissions: memberPerms }),
      });
      setMemberEmail("");
      notify("Member permissions saved");
      loadCoreData();
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = await apiFetch<User>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: profileName }),
      });
      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      notify("Profile updated");
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      notify("Password changed successfully");
    } catch (err: any) {
      notify(err.message);
    }
  }

  async function downloadCsv(resource: "users" | "records" | "activity") {
    const { accessToken } = getStoredTokens();
    const res = await fetch(`/api/admin/export/${resource}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) {
      notify("CSV export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradeflow-${resource}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // AUTH SCREEN
  if (!user) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#fff",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              G
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>GradeFlow</h1>
          </div>
          <p style={{ marginTop: 4, marginBottom: 22, color: "#64748b", fontSize: 14 }}>
            {authMode === "signup"
              ? "Create your student workspace to organize courses & study groups."
              : "Sign in to manage coursework, deadlines, and collaborative groups."}
          </p>

          {authError && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: "grid", gap: 12 }}>
            {authMode === "signup" && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={styles.input}
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.primaryBtn, padding: "12px 18px", marginTop: 4 }}
            >
              {loading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Log In"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGuestLogin}
            style={{
              width: "100%",
              padding: "11px 16px",
              borderRadius: 8,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Explore as Guest (Sample Courses Included)
          </button>

          <p style={{ marginTop: 20, marginBottom: 0, fontSize: 14, textAlign: "center", color: "#475569" }}>
            {authMode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "signup" ? "login" : "signup");
                setAuthError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {authMode === "signup" ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const isGuest = user.email === "guest@gradeflow.app";

  // MAIN PORTAL
  return (
    <div style={styles.page}>
      <header style={styles.navbar}>
        <div style={styles.navInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                color: "#fff",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              G
            </div>
            <strong style={{ fontSize: 20, letterSpacing: "-0.02em" }}>GradeFlow</strong>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: isGuest ? "#fef3c7" : "#eff6ff",
                color: isGuest ? "#92400e" : "#1d4ed8",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {user.email} ({isGuest ? "guest demo" : user.role})
            </span>
          </div>

          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["assignments", "groups", "profile"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: activeTab === tab ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: activeTab === tab ? "#2563eb" : "#ffffff",
                  color: activeTab === tab ? "#ffffff" : "#334155",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab === "profile" ? "Profile & Sessions" : tab}
              </button>
            ))}
            {user.role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: activeTab === "admin" ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                  background: activeTab === "admin" ? "#4f46e5" : "#ffffff",
                  color: activeTab === "admin" ? "#ffffff" : "#334155",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Admin Dashboard
              </button>
            )}
            <button onClick={handleLogout} style={styles.dangerBtn}>
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main style={styles.container}>
        {isGuest && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              padding: "12px 16px",
              borderRadius: 10,
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              fontSize: 13,
            }}
          >
            <span>
              <strong>Guest Demo Mode:</strong> Pre-loaded with sample CSE assignments so anyone can try adding,
              editing, or organizing coursework immediately.
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: "#92400e",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create Personal Account
            </button>
          </div>
        )}

        {toast && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: "12px 16px",
              borderRadius: 10,
              marginBottom: 20,
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            {toast}
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === "assignments" && (
          <>
            <div style={styles.card}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 17 }}>
                {editingId ? "Edit Assignment" : "New Assignment"}
              </h3>
              <form
                onSubmit={handleSaveAssignment}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <input
                  placeholder="Assignment Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={styles.input}
                />
                <input
                  placeholder="Course Code (e.g. CSE309)"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  style={styles.input}
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  style={styles.input}
                />
                <input
                  placeholder="Notes / Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.input}
                />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Personal (Only Me)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Group: {g.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" style={{ ...styles.primaryBtn, flex: 1 }}>
                    {editingId ? "Update" : "Add Assignment"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setTitle("");
                        setCourseCode("");
                        setDescription("");
                        setDueDate("");
                        setSelectedGroupId("");
                      }}
                      style={styles.secondaryBtn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>Course Assignments ({assignments.length})</h3>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Title & Details</th>
                      <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Course</th>
                      <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Due Date</th>
                      <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Visibility</th>
                      <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                          No assignments yet. Add your first course task above!
                        </td>
                      </tr>
                    ) : (
                      assignments.map((a) => (
                        <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px" }}>
                            <strong style={{ display: "block", color: "#0f172a" }}>{a.title}</strong>
                            {a.description && (
                              <span style={{ fontSize: 12, color: "#64748b" }}>{a.description}</span>
                            )}
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "#eef2ff",
                                color: "#4338ca",
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              {a.course_code}
                            </span>
                          </td>
                          <td style={{ padding: "14px", color: "#334155" }}>{a.due_date}</td>
                          <td style={{ padding: "14px" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: a.group_id ? "#ecfdf5" : "#f1f5f9",
                                color: a.group_id ? "#047857" : "#475569",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {a.group_id ? `Group #${a.group_id}` : "Personal"}
                            </span>
                          </td>
                          <td style={{ padding: "14px" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => {
                                  setEditingId(a.id);
                                  setTitle(a.title);
                                  setCourseCode(a.course_code);
                                  setDescription(a.description || "");
                                  setDueDate(a.due_date);
                                  setSelectedGroupId(a.group_id ? String(a.group_id) : "");
                                }}
                                style={styles.secondaryBtn}
                              >
                                Edit
                              </button>
                              <button onClick={() => handleDeleteAssignment(a.id)} style={styles.dangerBtn}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* GROUPS & PERMISSIONS TAB */}
        {activeTab === "groups" && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Create Shared Study Group</h3>
            <form
              onSubmit={handleCreateGroup}
              style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}
            >
              <input
                placeholder="Group Name (e.g. CSE309 Project Team)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                style={{ ...styles.input, flex: 1, minWidth: 200 }}
              />
              <input
                placeholder="Description"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                style={{ ...styles.input, flex: 2, minWidth: 220 }}
              />
              <button type="submit" style={styles.primaryBtn}>
                Create Group
              </button>
            </form>

            {groups.map((g) => (
              <div
                key={g.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 14,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{g.name}</strong>
                    {g.description && (
                      <span style={{ color: "#64748b", marginLeft: 8, fontSize: 13 }}>— {g.description}</span>
                    )}
                  </div>
                  {g.owner_id === user.id && (
                    <button
                      onClick={() => setActiveGroupId(activeGroupId === g.id ? null : g.id)}
                      style={styles.secondaryBtn}
                    >
                      Manage Members
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                  Members:{" "}
                  {g.members.length === 0
                    ? "Only owner"
                    : g.members.map((m) => `${m.email} [${m.permissions.join(", ")}]`).join(" | ")}
                </div>

                {activeGroupId === g.id && (
                  <form
                    onSubmit={(e) => handleAddMember(e, g.id)}
                    style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                  >
                    <input
                      type="email"
                      placeholder="Member email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      required
                      style={{ ...styles.input, maxWidth: 240 }}
                    />
                    {(["create", "update", "assign"] as const).map((perm) => (
                      <label key={perm} style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={memberPerms.includes(perm)}
                          onChange={(e) =>
                            setMemberPerms(
                              e.target.checked
                                ? [...memberPerms, perm]
                                : memberPerms.filter((p) => p !== perm)
                            )
                          }
                        />
                        {perm}
                      </label>
                    ))}
                    <button type="submit" style={styles.primaryBtn}>
                      Save Permissions
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PROFILE & SESSIONS TAB */}
        {activeTab === "profile" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={styles.card}>
              <h3 style={{ marginTop: 0 }}>Account Profile</h3>
              <form onSubmit={handleUpdateProfile} style={{ display: "flex", gap: 10, maxWidth: 460 }}>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  style={styles.input}
                />
                <button type="submit" style={styles.primaryBtn}>
                  Save Name
                </button>
              </form>

              {!isGuest && (
                <>
                  <h4 style={{ marginTop: 24, marginBottom: 10 }}>Change Password</h4>
                  <form onSubmit={handleChangePassword} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="password"
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      style={{ ...styles.input, maxWidth: 220 }}
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ ...styles.input, maxWidth: 220 }}
                    />
                    <button type="submit" style={styles.primaryBtn}>
                      Update Password
                    </button>
                  </form>
                </>
              )}
            </div>

            <div style={styles.card}>
              <h3 style={{ marginTop: 0 }}>Active Refresh Sessions</h3>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <span>
                    <strong>IP:</strong> {s.ip_address} — {s.user_agent}
                  </span>
                  <button
                    onClick={async () => {
                      await apiFetch(`/auth/sessions/${s.id}`, { method: "DELETE" });
                      loadSessions();
                    }}
                    style={styles.dangerBtn}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD TAB */}
        {activeTab === "admin" && user.role === "admin" && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Admin Governance & Analytics</h3>
            {stats && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 10 }}>Users: {stats.total_users}</div>
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 10 }}>
                  Active: {stats.active_users}
                </div>
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 10 }}>
                  Banned: {stats.banned_users}
                </div>
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 10 }}>
                  Records: {stats.total_records}
                </div>
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 10 }}>
                  Sessions: {stats.active_sessions}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => downloadCsv("users")} style={styles.secondaryBtn}>
                Export Users CSV
              </button>
              <button onClick={() => downloadCsv("records")} style={styles.secondaryBtn}>
                Export Records CSV
              </button>
              <button onClick={() => downloadCsv("activity")} style={styles.secondaryBtn}>
                Export Activity CSV
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ ...styles.input, maxWidth: 260 }}
              />
              <button onClick={loadAdminData} style={styles.primaryBtn}>
                Search
              </button>
              {selectedUserIds.length > 0 && (
                <>
                  <button
                    onClick={async () => {
                      await apiFetch("/admin/users/bulk-ban", {
                        method: "POST",
                        body: JSON.stringify({ user_ids: selectedUserIds, is_banned: true }),
                      });
                      setSelectedUserIds([]);
                      loadAdminData();
                    }}
                    style={styles.dangerBtn}
                  >
                    Bulk Ban ({selectedUserIds.length})
                  </button>
                  <button
                    onClick={async () => {
                      await apiFetch("/admin/users/bulk-ban", {
                        method: "POST",
                        body: JSON.stringify({ user_ids: selectedUserIds, is_banned: false }),
                      });
                      setSelectedUserIds([]);
                      loadAdminData();
                    }}
                    style={styles.secondaryBtn}
                  >
                    Bulk Unban
                  </button>
                </>
              )}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Select</th>
                  <th style={{ padding: 10 }}>Email</th>
                  <th style={{ padding: 10 }}>Role</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 10 }}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={(e) =>
                          setSelectedUserIds(
                            e.target.checked
                              ? [...selectedUserIds, u.id]
                              : selectedUserIds.filter((id) => id !== u.id)
                          )
                        }
                      />
                    </td>
                    <td style={{ padding: 10 }}>{u.email}</td>
                    <td style={{ padding: 10 }}>{u.role}</td>
                    <td style={{ padding: 10 }}>{u.is_banned ? "Banned" : "Active"}</td>
                    <td style={{ padding: 10, display: "flex", gap: 6 }}>
                      {u.id !== user.id && (
                        <button
                          onClick={async () => {
                            await apiFetch(`/admin/users/${u.id}/role`, {
                              method: "PATCH",
                              body: JSON.stringify({ role: u.role === "admin" ? "user" : "admin" }),
                            });
                            loadAdminData();
                          }}
                          style={styles.secondaryBtn}
                        >
                          Toggle Role
                        </button>
                      )}
                      {u.role !== "admin" && (
                        <button
                          onClick={async () => {
                            await apiFetch(`/admin/users/${u.id}/ban`, {
                              method: "PATCH",
                              body: JSON.stringify({ is_banned: !u.is_banned }),
                            });
                            loadAdminData();
                          }}
                          style={styles.dangerBtn}
                        >
                          {u.is_banned ? "Unban" : "Ban"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;