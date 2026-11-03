import React, { useState, useEffect } from 'react';

interface Assignment {
  id: number;
  title: string;
  description: string;
  course: string;
  due_date: string;
  total_points: number;
}

const API_BASE_URL = 'http://127.0.0.1:8000/api/assignments';

export default function App() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course: '',
    due_date: '',
    total_points: 100,
  });

  const fetchAssignments = async () => {
    try {
      const res = await fetch(API_BASE_URL);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleViewSingle = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAssignment(data);
      }
    } catch (err) {
      console.error('Failed to fetch assignment details:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'total_points' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      try {
        const res = await fetch(`${API_BASE_URL}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          setEditingId(null);
          resetForm();
          fetchAssignments();
        }
      } catch (err) {
        console.error('Error updating assignment:', err);
      }
    } else {
      try {
        const res = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          resetForm();
          fetchAssignments();
        }
      } catch (err) {
        console.error('Error creating assignment:', err);
      }
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingId(assignment.id);
    setFormData({
      title: assignment.title,
      description: assignment.description,
      course: assignment.course,
      due_date: assignment.due_date,
      total_points: assignment.total_points,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedAssignment?.id === id) setSelectedAssignment(null);
        fetchAssignments();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', course: '', due_date: '', total_points: 100 });
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🎓 GradeFlow — Assignment Management MVP</h1>

      {/* --- FORM (CREATE / UPDATE) --- */}
      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>{editingId !== null ? '✏️ Edit Assignment' : '➕ Add New Assignment'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px' }}>
          <input
            type="text"
            name="title"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            required
            style={{ padding: '8px' }}
          />
          <input
            type="text"
            name="course"
            placeholder="Course Code (e.g. CSE327)"
            value={formData.course}
            onChange={handleChange}
            required
            style={{ padding: '8px' }}
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            required
            style={{ padding: '8px', minHeight: '60px' }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
              required
              style={{ padding: '8px', flex: 1 }}
            />
            <input
              type="number"
              name="total_points"
              placeholder="Points"
              value={formData.total_points}
              onChange={handleChange}
              required
              style={{ padding: '8px', width: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" style={{ padding: '10px 15px', cursor: 'pointer', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
              {editingId !== null ? 'Update Assignment' : 'Create Assignment'}
            </button>
            {editingId !== null && (
              <button type="button" onClick={resetForm} style={{ padding: '10px 15px', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* --- READ LIST --- */}
      <h2>📋 All Assignments</h2>
      <div style={{ display: 'grid', gap: '10px' }}>
        {assignments.length === 0 ? (
          <p>No assignments found.</p>
        ) : (
          assignments.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                padding: '15px',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{item.title} <small style={{ color: '#666' }}>({item.course})</small></h3>
                <p style={{ margin: 0, color: '#444' }}>Due: {item.due_date} | Points: {item.total_points}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleViewSingle(item.id)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
                  View Single
                </button>
                <button onClick={() => handleEdit(item)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px', cursor: 'pointer', background: '#e00', color: '#fff', border: 'none', borderRadius: '4px' }}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- READ SINGLE MODAL / VIEW --- */}
      {selectedAssignment && (
        <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #0070f3', borderRadius: '8px', background: '#e6f0ff' }}>
          <h3>🔍 Single View Detail (ID: {selectedAssignment.id})</h3>
          <p><strong>Title:</strong> {selectedAssignment.title}</p>
          <p><strong>Course:</strong> {selectedAssignment.course}</p>
          <p><strong>Description:</strong> {selectedAssignment.description}</p>
          <p><strong>Due Date:</strong> {selectedAssignment.due_date}</p>
          <p><strong>Total Points:</strong> {selectedAssignment.total_points}</p>
          <button onClick={() => setSelectedAssignment(null)} style={{ padding: '6px 12px', cursor: 'pointer' }}>Close Detail</button>
        </div>
      )}
    </div>
  );
} 