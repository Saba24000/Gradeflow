import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const TaskForm = ({ onSubmit }) => {
    const [formData, setFormData] = useState({
        title: '', course_code: '', description: '', due_date: ''
    });
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
        setFormData({ title: '', course_code: '', description: '', due_date: '' });
    };
    return (_jsxs("form", { onSubmit: handleSubmit, style: { marginBottom: '20px' }, children: [_jsx("input", { type: "text", placeholder: "Title", value: formData.title, onChange: (e) => setFormData({ ...formData, title: e.target.value }), required: true }), _jsx("input", { type: "text", placeholder: "Course Code", value: formData.course_code, onChange: (e) => setFormData({ ...formData, course_code: e.target.value }), required: true }), _jsx("input", { type: "text", placeholder: "Description", value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }) }), _jsx("input", { type: "date", value: formData.due_date, onChange: (e) => setFormData({ ...formData, due_date: e.target.value }), required: true }), _jsx("button", { type: "submit", children: "Add Assignment" })] }));
};
