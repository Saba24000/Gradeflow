import { useEffect, useState } from 'react';
import { Assignment } from './types/task';
import { getAssignments, createAssignment, deleteAssignment } from './services/api';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';

export default function App() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    getAssignments().then(setAssignments).catch(console.error);
  }, []);

  const handleCreate = async (data: Assignment) => {
    const newItem = await createAssignment(data);
    setAssignments((prev) => [...prev, newItem]);
  };

  const handleDelete = async (id: number) => {
    await deleteAssignment(id);
    setAssignments((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>GradeFlow MVP</h1>
      <TaskForm onSubmit={handleCreate} />
      <TaskList assignments={assignments} onDelete={handleDelete} />
    </div>
  );
}