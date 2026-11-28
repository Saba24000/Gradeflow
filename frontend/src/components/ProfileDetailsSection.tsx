import React, { useEffect, useState } from "react";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  institute?: string;
  department?: string;
  bio?: string;
  avatar_url?: string;

}

interface ProfileDetailsSectionProps {
  user: UserProfile;
  token: string;
  onUserUpdated: (updatedUser: UserProfile) => void;
  notify?: (message: string) => void;
}

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "/api";

export const ProfileDetailsSection: React.FC<ProfileDetailsSectionProps> = ({
  user,
  token,
  onUserUpdated,
  notify,
}) => {
  const [name, setName] = useState(user?.name || "");
  const [institute, setInstitute] = useState(user?.institute || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setInstitute(user?.institute || "");
    setDepartment(user?.department || "");
    setBio(user?.bio || "");
    setAvatarUrl(user?.avatar_url || "");
  }, [user]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, 160, 160);
          setAvatarUrl(canvas.toDataURL("image/jpeg", 0.82));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          institute,
          department,
          bio,
          avatar_url: avatarUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update profile");
      }

      const updated: UserProfile = await res.json();
      onUserUpdated(updated);
      notify?.("Profile details saved!");
    } catch (err: any) {
      notify?.(err.message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSaveProfile} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile avatar"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #cbd5e1",
            }}
          />
        ) : (
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "#e0e7ff",
              color: "#3730a3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 24,
            }}
          >
            {(name || user?.email || "S")[0].toUpperCase()}
          </div>
        )}

        <div>
          <label
            style={{
              display: "inline-block",
              padding: "8px 14px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Upload Photo
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl("")}
              style={{
                marginLeft: 10,
                fontSize: 12,
                color: "#dc2626",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Remove
            </button>
          )}
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Optional • Auto-cropped square profile badge
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Display Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Your full name"
            required
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Institute / University (Optional)
          </label>
          <input
            value={institute}
            onChange={(e) => setInstitute(e.target.value)}
            style={inputStyle}
            placeholder="e.g., Independent University, Bangladesh"
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Department / Program (Optional)
          </label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={inputStyle}
            placeholder="e.g., Computer Science & Engineering"
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Short Bio (Optional)
          </label>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={inputStyle}
            placeholder="e.g., CSE309 Fall 2026 Student"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "10px 18px",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Profile Details"}
      </button>
    </form>
  );
};