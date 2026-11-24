import React, { useEffect, useState } from "react";
import {
  createAssignment,
  deleteAssignment,
  fetchAdminStats,
  fetchAllUsers,
  fetchAssignments,
  loginUser,
  signupUser,
  updateUserRole,
} from "./services/api";

interface Assignment {
  id: number;
  title: string;
  course: string;
  due_date: string;
  status: string;
  owner_id: number;
}

interface UserItem {
  id: number;
  email: string;
  role: "user" | "admin";
  is_active: boolean;
}

interface AdminStats {
  total_users: number;
  total_assignments: number;
  admin_count: number;
  regular_user_count: number;
}

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [role, setRole] = useState<string | null>(localStorage.getItem("role"));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem("email"));

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [activeTab, setActiveTab] = useState<"assignments" | "admin">("assignments");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("Pending");

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    if (token) {
      loadAssignments();
      if (role === "admin") {
        loadAdminData();
      }
    }
  }, [token, role]);

  async function loadAssignments() {
    try {
      const data = await fetchAssignments();
      setAssignments(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAdminData() {
    try {
      const [statsData, usersData] = await Promise.all([
        fetchAdminStats(),
        fetchAllUsers(),
      ]);
      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    try {
      if (isSignup) {
        await signupUser(email, password);
        setAuthMessage("Account created! Please log in.");
        setIsSignup(false);
        setPassword("");
      } else {
        const data = await loginUser(email, password);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("email", email);
        setToken(data.access_token);
        setRole(data.role);
        setUserEmail(email);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    setToken(null);
    setRole(null);
    setUserEmail(null);
    setAssignments([]);
    setActiveTab("assignments");
  }

  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !course || !dueDate) return;
    try {
      await createAssignment({ title, course, due_date: dueDate, status });
      setTitle("");
      setCourse("");
      setDueDate("");
      setStatus("Pending");
      loadAssignments();
      if (role === "admin") loadAdminData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAssignment(id);
      loadAssignments();
      if (role === "admin") loadAdminData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRoleToggle(user: UserItem) {
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      await updateUserRole(user.id, newRole);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: "400px", margin: "60px auto", fontFamily: "sans-serif" }}>
        <h1>GradeFlow</h1>
        <h2>{isSignup ? "Create Account" : "Sign In"}</h2>
        {authError && <p style={{ color: "red" }}>{authError}</p>}
        {authMessage && <p style={{ color: "green" }}>{authMessage}</p>}

        <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "8px" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "8px" }}
          />
          <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>
            {isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p style={{ marginTop: "16px" }}>
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setAuthError("");
              setAuthMessage("");
            }}
            style={{ background: "none", border: "none", color: "blue", cursor: "pointer", textDecoration: "underline" }}
          >
            {isSignup ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "12px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>GradeFlow</h1>
          <small>
            Logged in as <strong>{userEmail}</strong> ({role?.toUpperCase()})
          </small>
        </div>

        <nav style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setActiveTab("assignments")}
            style={{ fontWeight: activeTab === "assignments" ? "bold" : "normal", padding: "6px 12px" }}
          >
            My Assignments
          </button>

          {role === "admin" && (
            <button
              onClick={() => {
                setActiveTab("admin");
                loadAdminData();
              }}
              style={{ fontWeight: activeTab === "admin" ? "bold" : "normal", padding: "6px 12px" }}
            >
              Admin Dashboard
            </button>
          )}

          <button onClick={handleLogout} style={{ padding: "6px 12px", backgroundColor: "#f44336", color: "white", border: "none", cursor: "pointer" }}>
            Logout
          </button>
        </nav>
      </header>

      {activeTab === "assignments" && (
        <div>
          <h2>{role === "admin" ? "All System Assignments (Admin View)" : "My Assignments"}</h2>

          <form onSubmit={handleAddAssignment} style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Assignment Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ padding: "8px" }}
            />
            <input
              type="text"
              placeholder="Course (e.g., CSE309)"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
              style={{ padding: "8px" }}
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              style={{ padding: "8px" }}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px" }}>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <button type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>
              Add Assignment
            </button>
          </form>

          {assignments.length === 0 ? (
            <p>No assignments found.</p>
          ) : (
            <table border={1} cellPadding={8} style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  {role === "admin" && <th>Owner ID</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.course}</td>
                    <td>{item.due_date}</td>
                    <td>{item.status}</td>
                    {role === "admin" && <td>{item.owner_id}</td>}
                    <td>
                      <button onClick={() => handleDelete(item.id)} style={{ color: "red", cursor: "pointer" }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "admin" && role === "admin" && (
        <div>
          <h2>Admin System Overview</h2>

          {stats && (
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
              <div style={{ border: "1px solid #ccc", padding: "16px", flex: 1 }}>
                <h3>Total Users</h3>
                <p style={{ fontSize: "24px", margin: 0 }}>{stats.total_users}</p>
              </div>
              <div style={{ border: "1px solid #ccc", padding: "16px", flex: 1 }}>
                <h3>Total Assignments</h3>
                <p style={{ fontSize: "24px", margin: 0 }}>{stats.total_assignments}</p>
              </div>
              <div style={{ border: "1px solid #ccc", padding: "16px", flex: 1 }}>
                <h3>Admins / Regular Users</h3>
                <p style={{ fontSize: "24px", margin: 0 }}>
                  {stats.admin_count} / {stats.regular_user_count}
                </p>
              </div>
            </div>
          )}

          <h3>User Management (RBAC)</h3>
          <table border={1} cellPadding={8} style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>
                    <strong>{u.role}</strong>
                  </td>
                  <td>
                    <button onClick={() => handleRoleToggle(u)} style={{ cursor: "pointer" }}>
                      Switch to {u.role === "admin" ? "user" : "admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;