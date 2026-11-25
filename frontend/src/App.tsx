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
  const [memberPerms, setMemberPerms] = useState<string[]>(["create"]);
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
    a.download = `gradeflow_${resource}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // AUTH SCREEN
  if (!user) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "system-ui, sans-serif", padding: 24, border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h1 style={{ marginBottom: 4 }}>GradeFlow</h1>
        <h2 style={{ marginTop: 0, color: "#334155" }}>
          {authMode === "signup" ? "Create Account" : "Sign In"}
        </h2>

        {authError && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: 8, marginBottom: 14, fontSize: 14 }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {authMode === "signup" && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: 11, borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            {loading ? "Please wait..." : authMode === "signup" ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          {authMode === "signup" ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === "signup" ? "login" : "signup");
              setAuthError("");
            }}
            style={{ background: "none", border: "none", color: "#2563eb", textDecoration: "underline", cursor: "pointer", padding: 0 }}
          >
            {authMode === "signup" ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }

  // MAIN PORTAL
  return (
    <div style={{ maxWidth: 1050, margin: "24px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <strong style={{ fontSize: 22 }}>GradeFlow</strong>
          <span style={{ marginLeft: 12, fontSize: 13, background: user.role === "admin" ? "#fef3c7" : "#e0f2fe", padding: "3px 8px", borderRadius: 999 }}>
            {user.email} ({user.role})
          </span>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setActiveTab("assignments")} style={{ fontWeight: activeTab === "assignments" ? 700 : 400 }}>Assignments</button>
          <button onClick={() => setActiveTab("groups")} style={{ fontWeight: activeTab === "groups" ? 700 : 400 }}>Groups</button>
          <button onClick={() => setActiveTab("profile")} style={{ fontWeight: activeTab === "profile" ? 700 : 400 }}>Profile & Sessions</button>
          {user.role === "admin" && (
            <button onClick={() => setActiveTab("admin")} style={{ fontWeight: activeTab === "admin" ? 700 : 400, background: "#1e293b", color: "#fff" }}>
              Admin Dashboard
            </button>
          )}
          <button onClick={handleLogout} style={{ color: "#dc2626" }}>Logout</button>
        </nav>
      </header>

      {toast && (
        <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#065f46", padding: 10, borderRadius: 8, marginBottom: 16 }}>
          {toast}
        </div>
      )}

      {/* ASSIGNMENTS TAB */}
      {activeTab === "assignments" && (
        <div>
          <h3>{editingId ? "Edit Assignment" : "New Assignment"}</h3>
          <form onSubmit={handleSaveAssignment} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input placeholder="Course Code (e.g. CSE309)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">Personal (Only Me)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>Group: {g.name}</option>
              ))}
            </select>
            <button type="submit">{editingId ? "Update" : "Add Assignment"}</button>
          </form>

          <h3>Assignments ({assignments.length})</h3>
          <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th>Title</th>
                <th>Course</th>
                <th>Due Date</th>
                <th>Scope</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td><strong>{a.title}</strong><div style={{ fontSize: 12, color: "#64748b" }}>{a.description}</div></td>
                  <td>{a.course_code}</td>
                  <td>{a.due_date}</td>
                  <td>{a.group_id ? `Group #${a.group_id}` : "Personal"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      setEditingId(a.id);
                      setTitle(a.title);
                      setCourseCode(a.course_code);
                      setDescription(a.description);
                      setDueDate(a.due_date);
                      setSelectedGroupId(a.group_id ? String(a.group_id) : "");
                    }}>Edit</button>
                    <button onClick={() => handleDeleteAssignment(a.id)} style={{ color: "#dc2626" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GROUPS & PERMISSIONS TAB */}
      {activeTab === "groups" && (
        <div>
          <h3>Create Shared Group</h3>
          <form onSubmit={handleCreateGroup} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
            <input placeholder="Description" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            <button type="submit">Create Group</button>
          </form>

          {groups.map((g) => (
            <div key={g.id} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>{g.name}</strong> — <span style={{ color: "#64748b" }}>{g.description}</span>
                </div>
                {g.owner_id === user.id && (
                  <button onClick={() => setActiveGroupId(activeGroupId === g.id ? null : g.id)}>
                    Manage Members
                  </button>
                )}
              </div>

              <div style={{ marginTop: 8, fontSize: 13 }}>
                Members:{" "}
                {g.members.length === 0
                  ? "None yet"
                  : g.members.map((m) => `${m.email} [${m.permissions.join(", ")}]`).join(" | ")}
              </div>

              {activeGroupId === g.id && (
                <form onSubmit={(e) => handleAddMember(e, g.id)} style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input type="email" placeholder="Member email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required />
                  {["create", "update", "assign"].map((perm) => (
                    <label key={perm} style={{ fontSize: 13 }}>
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
                      />{" "}
                      {perm}
                    </label>
                  ))}
                  <button type="submit">Save Permissions</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PROFILE & SESSIONS TAB */}
      {activeTab === "profile" && (
        <div style={{ display: "grid", gap: 24 }}>
          <form onSubmit={handleUpdateProfile} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label>Display Name:</label>
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
            <button type="submit">Save Name</button>
          </form>

          <form onSubmit={handleChangePassword} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <input type="password" placeholder="New password (min 6)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            <button type="submit">Change Password</button>
          </form>

          <div>
            <h3>Active Refresh Sessions</h3>
            {sessions.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #e2e8f0" }}>
                <span>IP: {s.ip_address} — {s.user_agent}</span>
                <button onClick={async () => { await apiFetch(`/auth/sessions/${s.id}`, { method: "DELETE" }); loadSessions(); }}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN DASHBOARD TAB */}
      {activeTab === "admin" && user.role === "admin" && (
        <div style={{ display: "grid", gap: 24 }}>
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              <div style={{ padding: 12, background: "#f1f5f9", borderRadius: 8 }}>Users: <strong>{stats.total_users}</strong></div>
              <div style={{ padding: 12, background: "#f1f5f9", borderRadius: 8 }}>Banned: <strong>{stats.banned_users}</strong></div>
              <div style={{ padding: 12, background: "#f1f5f9", borderRadius: 8 }}>Records: <strong>{stats.total_records}</strong></div>
              <div style={{ padding: 12, background: "#f1f5f9", borderRadius: 8 }}>Groups: <strong>{stats.total_groups}</strong></div>
              <div style={{ padding: 12, background: "#f1f5f9", borderRadius: 8 }}>New (7d): <strong>{stats.new_users_7d}</strong></div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => downloadCsv("users")}>Export Users CSV</button>
            <button onClick={() => downloadCsv("records")}>Export Records CSV</button>
            <button onClick={() => downloadCsv("activity")}>Export Activity CSV</button>
          </div>

          <div>
            <h3>User Management</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              <button onClick={loadAdminData}>Search</button>
              {selectedUserIds.length > 0 && (
                <>
                  <button onClick={async () => { await apiFetch("/admin/users/bulk-ban", { method: "POST", body: JSON.stringify({ ids: selectedUserIds }) }); setSelectedUserIds([]); loadAdminData(); }}>
                    Bulk Ban ({selectedUserIds.length})
                  </button>
                  <button onClick={async () => { await apiFetch("/admin/users/bulk-unban", { method: "POST", body: JSON.stringify({ ids: selectedUserIds }) }); setSelectedUserIds([]); loadAdminData(); }}>
                    Bulk Unban
                  </button>
                </>
              )}
            </div>

            <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th>Select</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td>
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
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.is_banned ? `Banned (${u.ban_reason})` : "Active"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {u.id !== user.id && (
                        <button onClick={async () => {
                          await apiFetch(`/admin/users/${u.id}/role`, {
                            method: "PATCH",
                            body: JSON.stringify({ role: u.role === "admin" ? "user" : "admin" }),
                          });
                          loadAdminData();
                        }}>
                          Toggle Role
                        </button>
                      )}
                      {u.role !== "admin" && (
                        u.is_banned ? (
                          <button onClick={async () => { await apiFetch(`/admin/users/${u.id}/unban`, { method: "POST" }); loadAdminData(); }}>Unban</button>
                        ) : (
                          <button onClick={async () => { await apiFetch(`/admin/users/${u.id}/ban`, { method: "POST", body: JSON.stringify({ reason: "Admin ban" }) }); loadAdminData(); }}>Ban</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {securityData && (
            <div>
              <h3>Security & Failed Logins</h3>
              <p>Failed by IP: {JSON.stringify(securityData.failed_by_ip)}</p>
              <p>Failed by Account: {JSON.stringify(securityData.failed_by_account)}</p>
            </div>
          )}

          <div>
            <h3>Audit Logs (Recent)</h3>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8 }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <strong>[{log.event_type}]</strong> {log.user_email} — {log.detail} (IP: {log.ip_address})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;