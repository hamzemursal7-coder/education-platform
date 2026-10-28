import { useState, type FormEvent } from "react";
import {
  Camera,
  Check,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { api, type SessionUser } from "../lib/api";
import { AdminAvatar } from "./AdminAvatar";

export function ProfileModal({
  user,
  onClose,
  onUserUpdated,
}: {
  user: SessionUser;
  onClose: () => void;
  onUserUpdated: (user: SessionUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photoUrl || null);

  // Password fields
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo size must be less than 5 MB.");
      return;
    }

    setError("");
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/auth/profile/photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to upload photo.");
      }

      const data = await res.json();
      setPhotoUrl(data.photoUrl);
      onUserUpdated({ ...user, photoUrl: data.photoUrl });
      setSuccess("Profile photo updated successfully.");
    } catch (err: any) {
      setError(err?.message || "An error occurred while uploading photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoRemove() {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    setError("");
    setUploadingPhoto(true);

    try {
      await api("/api/v1/auth/profile/photo", { method: "DELETE" });
      setPhotoUrl(null);
      onUserUpdated({ ...user, photoUrl: null });
      setSuccess("Profile photo removed.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (changePassword) {
      if (!currentPassword) {
        setError("Please enter your current password.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await api<{ ok: boolean; user: Partial<SessionUser> }>("/api/v1/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          ...(changePassword ? { currentPassword, newPassword } : {}),
        }),
      });

      const updated: SessionUser = {
        ...user,
        firstName: res.user.firstName || firstName,
        lastName: res.user.lastName || lastName,
        phone: res.user.phone || phone,
        photoUrl: res.user.photoUrl ?? photoUrl,
      };

      onUserUpdated(updated);
      setSuccess("Profile updated successfully.");
      if (changePassword) {
        setChangePassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-md shadow-blue-500/20">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Profile Settings</h3>
              <p className="text-xs text-slate-500">
                Update your photo, personal details, or password.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-5 rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
            <div className="relative group">
              <AdminAvatar photoUrl={photoUrl} name={`${firstName} ${lastName}`} size="xl" />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/50 backdrop-blur-xs">
                  <RefreshCw className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div className="text-sm font-bold text-slate-900">Profile Photo</div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">
                  <Camera className="h-3.5 w-3.5" />
                  <span>{photoUrl ? "Change Photo" : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#2563eb] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#2563eb] focus:outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Email Address</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{user.email}</span>
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Phone Number</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus-within:border-[#2563eb]">
                <Phone className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+252..."
                  className="w-full font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Change Password Collapsible Section */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Password Security</span>
              </div>
              <button
                type="button"
                onClick={() => setChangePassword(!changePassword)}
                className="text-xs font-bold text-[#2563eb] hover:underline"
              >
                {changePassword ? "Cancel" : "Change Password"}
              </button>
            </div>

            {changePassword && (
              <div className="space-y-3 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password *</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
