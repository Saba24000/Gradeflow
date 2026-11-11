import { Assignment } from '../types/task';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function getAssignments(): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE_URL}/api/assignments`);
  if (!res.ok) throw new Error('Failed to fetch assignments');
  return res.json();
}

export async function createAssignment(data: Assignment): Promise<Assignment> {
  const res = await fetch(`${API_BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create assignment');
  return res.json();
}

export async function deleteAssignment(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/assignments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete assignment');
}