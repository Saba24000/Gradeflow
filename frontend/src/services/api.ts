const API_BASE = "/api";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function signupUser(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Signup failed");
  }
  return res.json();
}

export async function loginUser(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Invalid credentials");
  }
  return res.json();
}

export async function fetchAssignments() {
  const res = await fetch(`${API_BASE}/assignments/`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load assignments");
  return res.json();
}

export async function createAssignment(data: {
  title: string;
  course: string;
  due_date: string;
  status?: string;
}) {
  const res = await fetch(`${API_BASE}/assignments/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create assignment");
  return res.json();
}

export async function deleteAssignment(id: number) {
  const res = await fetch(`${API_BASE}/assignments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete assignment");
}

export async function fetchAdminStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch admin stats");
  return res.json();
}

export async function fetchAllUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update user role");
  return res.json();
}