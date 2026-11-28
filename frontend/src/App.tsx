import React, { useEffect, useState } from "react";
import { ProfileDetailsSection } from "./components/ProfileDetailsSection";
import {
  apiFetch,
  Assignment,
  clearAuthSession,
  getStoredTokens,
  Group,
  saveAuthSession,
  User,   
} from "./services/api";

type ViewPage =
  | "student-dashboard"
  | "student-groups"
  | "student-profile"
  | "admin-dashboard"
  | "admin-users"
  | "admin-security";

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

  // Role-based default landing page
  const [activePage, setActivePage] = useState<ViewPage>(() => {
    const raw = localStorage.getItem("user");
    const parsed: User | null = raw ? JSON.parse(raw) : null;
    return parsed?.role === "admin" ? "admin-dashboard" : "student-dashboard";
  });

  const [toast, setToast] = useState("");

  // Assignments state + search/filter
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [attachedFileName, setAttachedFileName] = useState("");
const [attachedFileData, setAttachedFileData] = useState("");

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
      setActivePage(user.role === "admin" ? "admin-dashboard" : "student-dashboard");
      loadCoreData();
      if (user.role === "admin") {
        loadAdminData();
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && activePage === "student-profile") loadSessions();
    if (user?.role === "admin" && activePage.startsWith("admin-")) loadAdminData();
  }, [activePage, user]);

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

  // Export assignments to Word (.doc)
  function exportAsDoc(items: Assignment[], filename = "GradeFlow-Assignments.doc") {
    if (items.length === 0) {
      notify("No assignments to export");
      return;
    }
    const rowsHtml = items
      .map(
        (a) => `
        <div style="border:1px solid #cbd5e1; padding:14px; margin-bottom:14px; border-radius:6px;">
          <h3 style="margin:0 0 6px 0; color:#1e3a8a;">[${a.course_code}] ${a.title}</h3>
          <p style="margin:0 0 6px 0; font-size:13px; color:#475569;"><strong>Due Date:</strong> ${a.due_date}</p>
          <p style="margin:0; font-size:14px; color:#0f172a;">${a.description || "No additional notes provided."}</p>
        </div>`
      )
      .join("");

    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>GradeFlow Course Assignments</title></head>
        <body style="font-family: Calibri, Arial, sans-serif; padding: 24px;">
          <h1 style="color:#0f172a; border-bottom:2px solid #2563eb; padding-bottom:8px;">GradeFlow — Course Assignment Sheet</h1>
          <p style="color:#64748b; font-size:13px;">Generated on ${new Date().toLocaleDateString()}</p>
          ${rowsHtml}
        </body>
      </html>`;

    const blob = new Blob(["\ufeff", docHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded ${filename}`);
  }

  // Export assignments to PDF print view
  function exportAsPdf(items: Assignment[]) {
    if (items.length === 0) {
      notify("No assignments to export");
      return;
    }
    const printWin = window.open("", "_blank", "width=850,height=700");
    if (!printWin) {
      notify("Please allow pop-ups to generate the PDF");
      return;
    }
    const cardsHtml = items
      .map(
        (a) => `
        <div class="item">
          <div class="meta"><span class="badge">${a.course_code}</span> <span>Due: ${a.due_date}</span></div>
          <h2>${a.title}</h2>
          <p>${a.description || "No additional notes provided."}</p>
        </div>`
      )
      .join("");

    printWin.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>GradeFlow — Course Assignments PDF</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 36px; }
            h1 { margin: 0 0 4px 0; font-size: 24px; color: #1e3a8a; }
            .sub { color: #64748b; font-size: 13px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            .item { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; page-break-inside: avoid; }
            .meta { display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 6px; }
            .badge { background: #eef2ff; color: #3730a3; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
            h2 { margin: 4px 0 8px 0; font-size: 17px; }
            p { margin: 0; font-size: 14px; color: #334155; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>GradeFlow — Course Assignments</h1>
          <div class="sub">Exported ${items.length} assignment(s) • ${new Date().toLocaleDateString()}</div>
          ${cardsHtml}
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
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
      notify("Entered Public Resource Library (Guest Mode)");
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
        file_name: attachedFileName,
      file_data: attachedFileData,
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
      setAttachedFileName("");
    setAttachedFileData("");
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

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    width: "100%",
    boxSizing: "border-box",
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 14,
    padding: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    marginBottom: 24,
  };

  // ==========================================
  // 1. SPLIT-SCREEN SAAS LOGIN / LANDING PAGE
  // ==========================================
  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Left Hero Branding Panel */}
        <div
          style={{
            background: "linear-gradient(145deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)",
            color: "#ffffff",
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 20,
                }}
              >
                G
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>GradeFlow</span>
            </div>

            <h1 style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 800, marginBottom: 16 }}>
              Role-Based Academic & Coursework Portal
            </h1>
            <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.6, maxWidth: 460 }}>
              Dedicated workspaces for Students, Study Groups, and System Administrators—built with JWT rotation,
              scoped group permissions, and instant document export.
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 32, maxWidth: 440 }}>
              {[
                { title: "Student Dashboard", desc: "Manage course deadlines, private tasks, and study groups." },
                { title: "Admin Governance Console", desc: "Monitor platform metrics, audit logs, and user access." },
                { title: "Guest Resource Library", desc: "Search sample CSE assignments and export Word/PDF sheets." },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 12,
                    padding: "12px 16px",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 14, marginBottom: 2 }}>{item.title}</strong>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 32 }}>
            CSE309 Web Application Security • Role-Based Access Control Architecture
          </p>
        </div>

        {/* Right Auth Card Panel */}
        <div
          style={{
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 410,
              background: "#ffffff",
              borderRadius: 16,
              padding: "36px 32px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              {authMode === "signup" ? "Create Student Account" : "Sign In to Workspace"}
            </h2>
            <p style={{ marginTop: 0, marginBottom: 22, color: "#64748b", fontSize: 14 }}>
              You will be automatically directed to your role dashboard.
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
                  style={inputStyle}
                />
              )}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "12px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                {loading ? "Authenticating..." : authMode === "signup" ? "Create Account" : "Sign In"}
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
              Browse Guest Resource Library (No Account)
            </button>

            <p style={{ marginTop: 20, marginBottom: 0, fontSize: 14, textAlign: "center", color: "#475569" }}>
              {authMode === "signup" ? "Already registered? " : "New to GradeFlow? "}
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
                {authMode === "signup" ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ROLE-BASED WORKSPACE SHELL (SIDEBAR + MAIN)
  // ==========================================
  const isAdmin = user.role === "admin";
  const isGuest = user.email === "demo@gradeflow.app" || user.email === "guest@gradeflow.app";

  const uniqueCourses = Array.from(new Set(assignments.map((a) => a.course_code)));
  const filteredAssignments = assignments.filter((a) => {
    const matchesCourse = courseFilter === "ALL" || a.course_code === courseFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.course_code.toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q);
    return matchesCourse && matchesSearch;
  });

  // Sidebar menu items tailored per role
  const navItems: { id: ViewPage; label: string; section: string }[] = isAdmin
    ? [
        { id: "admin-dashboard", label: "Admin Overview", section: "GOVERNANCE" },
        { id: "admin-users", label: "User & Role Control", section: "GOVERNANCE" },
        { id: "admin-security", label: "Audit & Security Logs", section: "GOVERNANCE" },
        { id: "student-dashboard", label: "Coursework View", section: "ACADEMIC" },
        { id: "student-groups", label: "Study Groups", section: "ACADEMIC" },
        { id: "student-profile", label: "My Profile & Sessions", section: "ACCOUNT" },
      ]
    : isGuest
    ? [
        { id: "student-dashboard", label: "Course Library", section: "GUEST ACCESS" },
        { id: "student-groups", label: "Sample Study Groups", section: "GUEST ACCESS" },
      ]
    : [
        { id: "student-dashboard", label: "Student Dashboard", section: "WORKSPACE" },
        { id: "student-groups", label: "Study Groups & RBAC", section: "WORKSPACE" },
        { id: "student-profile", label: "Profile & Sessions", section: "ACCOUNT" },
      ];

  const pageTitles: Record<ViewPage, { title: string; subtitle: string }> = {
    "admin-dashboard": {
      title: "Admin Governance Dashboard",
      subtitle: "System-wide analytics, user status metrics, and compliance exports.",
    },
    "admin-users": {
      title: "User & Role Management",
      subtitle: "Promote administrators, suspend compromised accounts, and filter directory.",
    },
    "admin-security": {
      title: "Security & Audit Trail",
      subtitle: "Real-time authentication logs, failed login tracking, and IP monitoring.",
    },
    "student-dashboard": {
      title: isGuest ? "Public Course Resource Library" : "Student Coursework Dashboard",
      subtitle: isGuest
        ? "Search starter CSE assignments and export Word (.doc) or PDF study guides."
        : "Track upcoming course deadlines, manage scoped group tasks, and export sheets.",
    },
    "student-groups": {
      title: isGuest ? "Sample Study Groups" : "Study Groups & Scoped Permissions",
      subtitle: "Collaborate with teammates using granular create, update, and assign permissions.",
    },
    "student-profile": {
      title: "Student Profile & Active Sessions",
      subtitle: "Manage your display name, password, and active JWT refresh tokens.",
    },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f1f5f9",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* LEFT SIDEBAR NAVIGATION (Role-Themed) */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: isAdmin ? "#0f172a" : "#ffffff",
          color: isAdmin ? "#f8fafc" : "#0f172a",
          borderRight: isAdmin ? "1px solid #1e293b" : "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px 16px",
        }}
      >
        <div>
          {/* Brand Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 24 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isAdmin
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "linear-gradient(135deg, #2563eb, #3b82f6)",
                color: "#fff",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
              }}
            >
              G
            </div>
            <div>
              <strong style={{ display: "block", fontSize: 18, letterSpacing: "-0.02em" }}>GradeFlow</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: isAdmin ? "#a5b4fc" : isGuest ? "#b45309" : "#2563eb",
                }}
              >
                {isAdmin ? "Admin Portal" : isGuest ? "Guest Library" : "Student Portal"}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "grid", gap: 4 }}>
            {navItems.map((item, idx) => {
              const showSection = idx === 0 || navItems[idx - 1].section !== item.section;
              const isActive = activePage === item.id;
              return (
                <React.Fragment key={item.id}>
                  {showSection && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: isAdmin ? "#64748b" : "#94a3b8",
                        padding: "14px 10px 4px 10px",
                      }}
                    >
                      {item.section}
                    </div>
                  )}
                  <button
                    onClick={() => setActivePage(item.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 9,
                      border: "none",
                      background: isActive
                        ? isAdmin
                          ? "#4f46e5"
                          : "#eff6ff"
                        : "transparent",
                      color: isActive
                        ? isAdmin
                          ? "#ffffff"
                          : "#1d4ed8"
                        : isAdmin
                        ? "#cbd5e1"
                        : "#475569",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Logout Card */}
        <div
          style={{
            background: isAdmin ? "#1e293b" : "#f8fafc",
            border: isAdmin ? "1px solid #334155" : "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{user.name || "User"}</div>
          <div
            style={{
              fontSize: 12,
              color: isAdmin ? "#94a3b8" : "#64748b",
              marginBottom: 12,
              wordBreak: "break-all",
            }}
          >
            {user.email}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: isAdmin ? "1px solid #475569" : "1px solid #fecaca",
              background: isAdmin ? "#0f172a" : "#fef2f2",
              color: isAdmin ? "#f87171" : "#dc2626",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {isGuest ? "Exit Guest & Sign Up" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top Workspace Header */}
        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            padding: "20px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              {pageTitles[activePage].title}
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
              {pageTitles[activePage].subtitle}
            </p>
          </div>

          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: isAdmin ? "#eef2ff" : isGuest ? "#fef3c7" : "#ecfdf5",
              color: isAdmin ? "#4338ca" : isGuest ? "#92400e" : "#047857",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Role: {isGuest ? "Guest (Read-Only)" : user.role}
          </span>
        </header>

        <main style={{ maxWidth: 1080, margin: "24px auto", padding: "0 32px 48px 32px" }}>
          {toast && (
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 20,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {toast}
            </div>
          )}

          {isGuest && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                padding: "14px 18px",
                borderRadius: 12,
                marginBottom: 22,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                fontSize: 13,
              }}
            >
              <span>
                <strong>Guest Mode Active:</strong> Search pre-loaded CSE assignments and export Word (.doc) or PDF
                sheets. Create a free student account to add, edit, or delete your own coursework.
              </span>
              <button
                onClick={() => {
                  handleLogout();
                  setAuthMode("signup");
                }}
                style={{
                  background: "#92400e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Create Student Account
              </button>
            </div>
          )}

          {/* ==========================================
              PAGE: STUDENT DASHBOARD / GUEST LIBRARY
             ========================================== */}
          {activePage === "student-dashboard" && (
            <>
              {/* Role-Specific KPI Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={{ ...cardStyle, marginBottom: 0, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>TOTAL ASSIGNMENTS</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {assignments.length}
                  </div>
                </div>
                <div style={{ ...cardStyle, marginBottom: 0, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>ACTIVE COURSES</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>
                    {uniqueCourses.length}
                  </div>
                </div>
                <div style={{ ...cardStyle, marginBottom: 0, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>STUDY GROUPS</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#059669", marginTop: 4 }}>
                    {groups.length}
                  </div>
                </div>
              </div>

              {/* Create / Edit Assignment Form (Hidden for Guest) */}
              {!isGuest && (
                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
                    {editingId ? "Edit Assignment" : "Add New Course Assignment"}
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
                      style={inputStyle}
                    />
                    <input
                      placeholder="Course Code (e.g. CSE309)"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      required
                      style={inputStyle}
                    />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      style={inputStyle}
                    />
                    <input
                      placeholder="Notes / Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={inputStyle}
                    />
                    <select
                      value={selectedGroupId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          const quickName = window.prompt("Enter new study group name (e.g. CSE309 Team):");
                          if (quickName && quickName.trim()) {
                            apiFetch<Group>("/groups", {
                              method: "POST",
                              body: JSON.stringify({ name: quickName.trim(), description: "" }),
                            })
                              .then((created) => {
                                loadCoreData();
                                setSelectedGroupId(String(created.id));
                                notify(`Group "${created.name}" created & selected`);
                              })
                              .catch((err: any) => notify(err.message));
                          }
                          return;
                        }
                        setSelectedGroupId(e.target.value);
                      }}
                      style={inputStyle}
                    >
                      <optgroup label="Private Visibility">
                        <option value="">Personal (Only Me)</option>
                      </optgroup>
                      <optgroup label="Shared Study Groups">
                        {(Array.isArray(groups) ? groups : []).map((g) => (
                          <option key={g.id} value={g.id}>
                            Group: {g.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Quick Action">
                        <option value="__new__">+ Create New Group...</option>
                      </optgroup>
                    </select>
                    
<label
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px dashed #94a3b8",
    background: "#f8fafc",
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    cursor: "pointer",
  }}
>
  📎 {attachedFileName ? attachedFileName : "Attach PDF (max 3MB)"}
  <input
    type="file"
    accept="application/pdf,.pdf"
    style={{ display: "none" }}
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        notify("Please select a PDF under 3 MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFileName(file.name);
        setAttachedFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }}
  />
</label>
<div style={{ display: "flex", gap: 8 }}></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {editingId ? "Update" : "Add Task"}
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
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Search, Filter & Assignments Table */}
              <div style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    Assignments ({filteredAssignments.length}
                    {filteredAssignments.length !== assignments.length ? ` of ${assignments.length}` : ""})
                  </h3>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => exportAsDoc(filteredAssignments, "GradeFlow-All-Courses.doc")}
                      style={{
                        padding: "8px 13px",
                        borderRadius: 8,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Download All (.DOC)
                    </button>
                    <button
                      type="button"
                      onClick={() => exportAsPdf(filteredAssignments)}
                      style={{
                        padding: "8px 13px",
                        borderRadius: 8,
                        border: "1px solid #ddd6fe",
                        background: "#f5f3ff",
                        color: "#6d28d9",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Save All as PDF
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 2fr) minmax(160px, 1fr)",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <input
                    type="search"
                    placeholder="Search by title, course code (e.g. CSE309), or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={inputStyle}
                  />
                  <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={inputStyle}>
                    <option value="ALL">All Courses ({assignments.length})</option>
                    {uniqueCourses.map((code) => (
                      <option key={code} value={code}>
                        Course: {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Title & Details</th>
                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Course</th>
                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Due Date</th>
                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>Scope</th>
                        <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
                          {isGuest ? "Export" : "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                            No assignments match your current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAssignments.map((a) => (
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
                                  fontWeight: 700,
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
                                {a.group_id ? `Group #${a.group_id}` : isGuest ? "Public Sample" : "Personal"}
                              </span>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => exportAsDoc([a], `${a.course_code}-${a.title.slice(0, 20)}.doc`)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 7,
                                    border: "1px solid #bfdbfe",
                                    background: "#eff6ff",
                                    color: "#1d4ed8",
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  .DOC
                                </button>
                                <button
                                  type="button"
                                  onClick={() => exportAsPdf([a])}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 7,
                                    border: "1px solid #ddd6fe",
                                    background: "#f5f3ff",
                                    color: "#6d28d9",
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  PDF
                                </button>
                                {!isGuest && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingId(a.id);
                                        setTitle(a.title);
                                        setCourseCode(a.course_code);
                                        setDescription(a.description || "");
                                        setDueDate(a.due_date);
                                        setSelectedGroupId(a.group_id ? String(a.group_id) : "");
                                      }}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 7,
                                        border: "1px solid #cbd5e1",
                                        background: "#fff",
                                        color: "#334155",
                                        fontWeight: 600,
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAssignment(a.id)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 7,
                                        border: "1px solid #fecaca",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        fontWeight: 600,
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
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

          {/* ==========================================
              PAGE: STUDY GROUPS & SCOPED PERMISSIONS
             ========================================== */}
          {activePage === "student-groups" && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>{isGuest ? "Sample Study Groups" : "Create Shared Study Group"}</h3>
              {!isGuest && (
                <form
                  onSubmit={handleCreateGroup}
                  style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}
                >
                  <input
                    placeholder="Group Name (e.g. CSE309 Project Team)"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                  />
                  <input
                    placeholder="Description"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    style={{ ...inputStyle, flex: 2, minWidth: 220 }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Create Group
                  </button>
                </form>
              )}

              {(Array.isArray(groups) ? groups : []).map((g) => (
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
                    {!isGuest && g.owner_id === user.id && (
                      <button
                        onClick={() => setActiveGroupId(activeGroupId === g.id ? null : g.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
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

                  {!isGuest && activeGroupId === g.id && (
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
                        style={{ ...inputStyle, maxWidth: 240 }}
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
                      <button
                        type="submit"
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Save Permissions
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ==========================================
              PAGE: PROFILE & ACTIVE SESSIONS
             ========================================== */}
          {!isGuest && activePage === "student-profile" && (
            <div style={{ display: "grid", gap: 20 }}>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Account Profile</h3>
                {user && (
  <ProfileDetailsSection
    user={user}
    token={localStorage.getItem("access_token") || localStorage.getItem("token") || ""}
    onUserUpdated={(updated) => setUser(updated)}
    notify={notify}
  />
)}

                <h4 style={{ marginTop: 24, marginBottom: 10 }}>Change Password</h4>
                <form onSubmit={handleChangePassword} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{ ...inputStyle, maxWidth: 220 }}
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ ...inputStyle, maxWidth: 220 }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Update Password
                  </button>
                </form>
              </div>

              <div style={cardStyle}>
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
                      style={{
                        padding: "6px 12px",
                        borderRadius: 7,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==========================================
              ADMIN PAGES (OVERVIEW, USERS, SECURITY)
             ========================================== */}
          {isAdmin && activePage === "admin-dashboard" && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Platform Metrics & Compliance Exports</h3>
              {stats && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 14,
                    marginBottom: 24,
                  }}
                >
                  {[
                    { label: "Total Users", value: stats.total_users, color: "#0f172a" },
                    { label: "Active Users", value: stats.active_users, color: "#059669" },
                    { label: "Suspended Users", value: stats.banned_users, color: "#dc2626" },
                    { label: "Course Records", value: stats.total_records, color: "#2563eb" },
                    { label: "Active Sessions", value: stats.active_sessions, color: "#4f46e5" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      style={{
                        padding: 18,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{kpi.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ marginBottom: 10 }}>Export Governance Reports (CSV)</h4>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(["users", "records", "activity"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => downloadCsv(type)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    Export {type} CSV
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAdmin && activePage === "admin-users" && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Directory & Role Access Control</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input
                  placeholder="Search users by email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 280 }}
                />
                <button
                  onClick={loadAdminData}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#4f46e5",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
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
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
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
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Bulk Unban
                    </button>
                  </>
                )}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: 12 }}>Select</th>
                      <th style={{ padding: 12 }}>Email</th>
                      <th style={{ padding: 12 }}>Role</th>
                      <th style={{ padding: 12 }}>Status</th>
                      <th style={{ padding: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 12 }}>
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
                        <td style={{ padding: 12 }}>{u.email}</td>
                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: 999,
                              background: u.role === "admin" ? "#eef2ff" : "#f1f5f9",
                              color: u.role === "admin" ? "#4338ca" : "#475569",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>{u.is_banned ? "Suspended" : "Active"}</td>
                        <td style={{ padding: 12, display: "flex", gap: 6 }}>
                          {u.id !== user.id && (
                            <button
                              onClick={async () => {
                                await apiFetch(`/admin/users/${u.id}/role`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ role: u.role === "admin" ? "user" : "admin" }),
                                });
                                loadAdminData();
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 7,
                                border: "1px solid #cbd5e1",
                                background: "#fff",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
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
                              style={{
                                padding: "6px 10px",
                                borderRadius: 7,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#dc2626",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
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
            </div>
          )}

          {isAdmin && activePage === "admin-security" && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>Recent Audit Events</h3>
              <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 8 }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#f8fafc",
                      fontSize: 13,
                    }}
                  >
                    <strong>{log.event_type}</strong> — {log.user_email || "System"} ({log.detail})
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;