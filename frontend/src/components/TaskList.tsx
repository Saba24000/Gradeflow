import React from 'react';
import { Assignment } from '../types/task';

interface TaskListProps {
  assignments: Assignment[];
  onDelete: (id: number) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ assignments, onDelete }) => (
  <div>
    {assignments.map((item) => (
      <div key={item.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
        <h3>{item.title} ({item.course_code})</h3>
        <p>{item.description}</p>
        <p><strong>Due:</strong> {item.due_date}</p>
        <button onClick={() => item.id && onDelete(item.id)}>Delete</button>
      </div>
    ))}
  </div>
);