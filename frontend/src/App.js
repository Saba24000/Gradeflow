import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getAssignments, createAssignment, deleteAssignment } from './services/api';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
export default function App() {
    const [assignments, setAssignments] = useState([]);
    useEffect(() => {
        getAssignments().then(setAssignments).catch(console.error);
    }, []);
    const handleCreate = async (data) => {
        const newItem = await createAssignment(data);
        setAssignments((prev) => [...prev, newItem]);
    };
    const handleDelete = async (id) => {
        await deleteAssignment(id);
        setAssignments((prev) => prev.filter((item) => item.id !== id));
    };
    return (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h1", { children: "GradeFlow MVP" }), _jsx(TaskForm, { onSubmit: handleCreate }), _jsx(TaskList, { assignments: assignments, onDelete: handleDelete })] }));
}
