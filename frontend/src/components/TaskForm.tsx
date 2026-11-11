import React, { useState } from 'react';
import { Assignment } from '../types/task';

interface TaskFormProps {
  onSubmit: (data: Assignment) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<Assignment>({
    title: '', course_code: '', description: '', due_date: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ title: '', course_code: '', description: '', due_date: '' });
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <input
        type="text"
        placeholder="Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Course Code"
        value={formData.course_code}
        onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />
      <input
        type="date"
        value={formData.due_date}
        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
        required
      />
      <button type="submit">Add Assignment</button>
    </form>
  );
};