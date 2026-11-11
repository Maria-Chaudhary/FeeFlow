
import { useEffect, useState, type FormEvent } from "react";
import {
  ShieldCheck, Users, Search, Plus, LogOut, LayoutDashboard,
  GraduationCap, Wallet, Building2, Eye, EyeOff, RefreshCw,
  CheckCircle2, AlertCircle, KeyRound, X, Copy, UserCircle,
  FileUp, ClipboardList, Menu, LockKeyhole
} from "lucide-react";
import api from "./lib/api";

type UserProfile = {
  id: string;
  username: string;
  email: string | null;
  is_active: boolean;
  must_change_password: boolean;
  roles: string[];
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: UserProfile;
};

type AdminUser = UserProfile;

type CreatedUser = AdminUser & {
  temporary_password: string;
};

type StudentProfile = {
  id: string;
  registration_no: string;
  full_name: string;
  is_active: boolean;
};

type Screen = "login" | "change-password" | "dashboard";

const getError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { detail?: string } } }
    ).response;
    return response?.data?.detail || "Something went wrong.";
  }
  return "Unable to connect to FeeFlow server.";
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [user, setUser] = useState<UserProfile | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [role, setRole] = useState("student");
  const [newUsername, setNewUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);

  const [studentProfile, setStudentProfile] =
    useState<StudentProfile | null>(null);

  const [loading, setLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isStudent = user?.roles.includes("student") ?? false;

  // Restore session after refresh.
  useEffect(() => {
    const token = sessionStorage.getItem("feeflow_token");
    if (!token) return;

    let cancelled = false;

    api.get<UserProfile>("/auth/me")
      .then((response) => {
        if (cancelled) return;

        const profile = response.data;
        const allowed =
          profile.roles.includes("student") ||
          profile.roles.includes("super_admin");

        if (!allowed) {
          sessionStorage.removeItem("feeflow_token");
          setError("Your account does not have access to this portal.");
          return;
        }

        setUser(profile);
        setScreen(
          profile.must_change_password ? "change-password" : "dashboard"
        );
      })
      .catch(() => {
        sessionStorage.removeItem("feeflow_token");
        if (!cancelled) setScreen("login");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the correct data for the signed-in role.
  useEffect(() => {
    if (screen !== "dashboard" || !user) return;

    if (user.roles.includes("super_admin")) {
      loadUsers();
    } else if (user.roles.includes("student")) {
      loadStudentProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, user?.id]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const form = new URLSearchParams();
      form.append("username", username.trim());
      form.append("password", password);
      form.append("grant_type", "password");

      const response = await api.post<LoginResponse>("/auth/login", form, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const result = response.data;
      const allowed =
        result.user.roles.includes("super_admin") ||
        result.user.roles.includes("student");

      if (!allowed) {
        setError("Access denied. Your account has no portal access yet.");
        return;
      }

      sessionStorage.setItem("feeflow_token", result.access_token);
      setUser(result.user);
      setPassword("");

      setScreen(
        result.user.must_change_password ? "change-password" : "dashboard"
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 12) {
      setError("New password must contain at least 12 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (user) {
        setUser({ ...user, must_change_password: false });
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
      setScreen("dashboard");
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (search = "") => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<AdminUser[]>("/admin/users", {
        params: { search: search || undefined, limit: 100 },
      });
      setUsers(response.data);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStudentProfile = async () => {
    setStudentLoading(true);
    setError("");

    try {
      const response = await api.get<StudentProfile>("/student/profile");
      setStudentProfile(response.data);
    } catch (err) {
      setError(getError(err));
    } finally {
      setStudentLoading(false);
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreatedUser(null);
    setLoading(true);

    const payload: Record<string, string | null> = {
      username: newUsername.trim(),
      email: email.trim() || null,
      role,
    };

    if (role === "student") {
      payload.full_name = fullName.trim();
      payload.registration_no = registrationNo.trim();
    }

    try {
      const response = await api.post<CreatedUser>("/admin/users", payload);
      setCreatedUser(response.data);
      setNewUsername("");
      setEmail("");
      setFullName("");
      setRegistrationNo("");
      await loadUsers(searchTerm);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (selectedUser: AdminUser) => {
    const action = selectedUser.is_active ? "deactivate" : "activate";

    if (!window.confirm(`Are you sure you want to ${action} this account?`)) {
      return;
    }

    setError("");

    try {
      await api.patch(`/admin/users/${selectedUser.id}/status`, {
        is_active: !selectedUser.is_active,
      });
      await loadUsers(searchTerm);
    } catch (err) {
      setError(getError(err));
    }
  };

  const logout = () => {
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) return;

    sessionStorage.removeItem("feeflow_token");
    setUser(null);
    setStudentProfile(null);
    setUsers([]);
    setCreatedUser(null);
    setScreen("login");
    setMessage("");
    setError("");
    setUsername("");
    setPassword("");
  };

  const copyTemporaryPassword = async () => {
    if (!createdUser) return;

    try {
      await navigator.clipboard.writeText(createdUser.temporary_password);
      setMessage("Temporary password copied.");
    } catch {
      setError("Could not copy the password. Please copy it manually.");
    }
  };

  const totalStudents = users.filter((item) =>
    item.roles.includes("student")
  ).length;

  const totalFinance = users.filter((item) =>
    item.roles.includes("finance")
  ).length;

  const totalDepartment = users.filter((item) =>
    item.roles.includes("department")
  ).length;

  // LOGIN
  if (screen === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/40">
              <ShieldCheck size={34} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              MUST FeeFlow
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              University Fee Management System
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Welcome Back
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in using your university-provided account.
            </p>

            {error && (
              <div className="mt-5 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={login} className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
              <LockKeyhole size={14} />
              Authorized university accounts only
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            FeeFlow · Secure University Portal
          </p>
        </div>
      </div>
    );
  }

  // FORCED PASSWORD CHANGE
  if (screen === "change-password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <KeyRound size={28} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Change Your Password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your account requires a new password before you can continue
            to FeeFlow.
          </p>

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={changePassword} className="mt-6 space-y-4">
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Temporary/current password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              required
              minLength={12}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (at least 12 characters)"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              required
              minLength={12}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
            <button
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

          <button
            onClick={logout}
            className="mt-4 w-full text-sm text-slate-500 hover:text-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // STUDENT DASHBOARD
  if (isStudent) {
    const displayName = studentProfile?.full_name || user?.username || "Student";

    return (
      <div className="min-h-screen bg-slate-50 md:flex">
        <aside className="flex w-full flex-col bg-slate-950 text-white md:fixed md:inset-y-0 md:left-0 md:w-64">
          <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
            <div className="rounded-xl bg-blue-600 p-2">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold">FeeFlow</h1>
              <p className="text-xs text-slate-400">Student Portal</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col md:px-4 md:py-7">
            <div className="flex shrink-0 items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium">
              <LayoutDashboard size={18} />
              Overview
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
              <ClipboardList size={18} />
              My Challans
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
              <Wallet size={18} />
              Payments
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
              <UserCircle size={18} />
              My Profile
            </div>
          </nav>

          <div className="hidden border-t border-slate-800 p-4 md:block">
            <p className="truncate px-2 text-sm font-semibold">{displayName}</p>
            <p className="px-2 text-xs text-slate-400">Student Account</p>
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-slate-800"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 md:ml-64">
          <header className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-9">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Student Portal</h2>
              <p className="text-xs text-slate-500">
                MUST FeeFlow Management System
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-40 truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">Student</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <LogOut size={17} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-9">
            <div className="mb-7 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 p-6 text-white shadow-sm sm:p-8">
              <p className="text-sm font-medium text-blue-200">
                MUST STUDENT PORTAL
              </p>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                Welcome, {displayName}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
                Manage your fee challans and payment records from one
                secure university portal.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Student Information
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your university account details
                  </p>
                </div>
                <button
                  onClick={loadStudentProfile}
                  disabled={studentLoading}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={studentLoading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>

              {studentLoading && !studentProfile ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading your profile...
                </div>
              ) : studentProfile ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Full Name
                    </p>
                    <p className="mt-2 break-words font-semibold text-slate-900">
                      {studentProfile.full_name}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Registration Number
                    </p>
                    <p className="mt-2 break-words font-semibold text-slate-900">
                      {studentProfile.registration_no}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Account Status
                    </p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      studentProfile.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {studentProfile.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  Your student profile could not be loaded. Please contact
                  university administration.
                </p>
              )}
            </section>

            <div className="mb-7 grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FileUp size={23} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Upload Fee Challan
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Submit the PDF challan generated through the official
                  MUST challan portal.
                </p>
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <FileUp className="mx-auto text-slate-400" size={26} />
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Challan submission
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Secure PDF upload will be enabled after its backend
                    endpoint is implemented.
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Coming next
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <Wallet size={23} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Payment Records
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View submitted payments, verification progress, and
                  confirmed fee transactions.
                </p>
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Payment history
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Payment records will appear here once the
                    payment-history API is connected.
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Coming next
                  </span>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-blue-700">
                  <ShieldCheck size={21} />
                </div>
                <div>
                  <h3 className="font-bold text-blue-950">
                    Important Information
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-blue-900">
                    Uploading a challan does not mean that your fee has
                    been paid. Payment confirmation will only appear after
                    authorized university finance staff verify the payment.
                  </p>
                </div>
              </div>
            </section>

            <footer className="py-8 text-center text-xs text-slate-400">
              MUST FeeFlow · Student Portal
            </footer>
          </div>
        </main>
      </div>
    );
  }

  // SUPER ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="flex w-full flex-col bg-slate-950 text-white md:fixed md:inset-y-0 md:left-0 md:w-64">
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="rounded-xl bg-blue-600 p-2">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold">FeeFlow</h1>
            <p className="text-xs text-slate-400">Admin Portal</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col md:px-4 md:py-7">
          <div className="flex shrink-0 items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium">
            <LayoutDashboard size={19} />
            Dashboard
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
            <Users size={19} />
            User Management
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
            <GraduationCap size={19} />
            Students
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
            <Building2 size={19} />
            Departments
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400">
            <Wallet size={19} />
            Finance
          </div>
        </nav>

        <div className="hidden border-t border-slate-800 p-4 md:block">
          <p className="truncate px-2 text-sm font-semibold">
            {user?.username}
          </p>
          <p className="px-2 text-xs text-slate-400">Super Administrator</p>
          <button
            onClick={logout}
            className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:ml-64">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-9">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Administration
            </h2>
            <p className="text-xs text-slate-500">
              MUST FeeFlow Management System
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {user?.username}
              </p>
              <p className="text-xs text-slate-500">Super Admin</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              {user?.username?.charAt(0).toUpperCase() || "A"}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 md:hidden"
              aria-label="Sign out"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-9">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard Overview
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage university accounts and access.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setCreatedUser(null);
                setError("");
                setMessage("");
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {showCreateForm ? <X size={18} /> : <Plus size={18} />}
              {showCreateForm ? "Close Form" : "Create New User"}
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Accounts", value: users.length, icon: Users },
              { label: "Students", value: totalStudents, icon: GraduationCap },
              { label: "Departments", value: totalDepartment, icon: Building2 },
              { label: "Finance Staff", value: totalFinance, icon: Wallet },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Icon size={21} />
                    </div>
                  </div>
                  <p className="mt-4 text-3xl font-bold text-slate-900">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          {showCreateForm && (
            <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-lg font-bold text-slate-900">
                Create University Account
              </h3>
              <p className="mb-6 text-sm text-slate-500">
                Create an account and assign its access role.
              </p>

              <form onSubmit={createUser}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Username *
                    </label>
                    <input
                      required
                      minLength={3}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. student123"
                      className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Account Role *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                    >
                      <option value="student">Student</option>
                      <option value="department">Department</option>
                      <option value="finance">Finance</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  {role === "student" && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Student Full Name *
                        </label>
                        <input
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Student full name"
                          className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Registration Number *
                        </label>
                        <input
                          required
                          value={registrationNo}
                          onChange={(e) => setRegistrationNo(e.target.value)}
                          placeholder="University registration number"
                          className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  disabled={loading}
                  className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create Account"}
                </button>
              </form>

              {createdUser && (
                <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
                  <div className="flex items-center gap-2 font-semibold text-green-800">
                    <CheckCircle2 size={20} />
                    Account created successfully
                  </div>
                  <p className="mt-3 text-sm text-green-900">
                    Username: <strong>{createdUser.username}</strong>
                  </p>
                  <p className="mt-2 text-sm text-green-900">
                    Temporary password:
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <code className="break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-900">
                      {createdUser.temporary_password}
                    </code>
                    <button
                      type="button"
                      onClick={copyTemporaryPassword}
                      className="flex items-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm text-green-800 hover:bg-green-100"
                    >
                      <Copy size={16} />
                      Copy
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-green-800">
                    Share this password securely. The user must change it
                    at first login.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-bold text-slate-900">User Management</h3>
                <p className="mt-1 text-xs text-slate-500">
                  View and manage registered accounts.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 sm:w-64">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadUsers(searchTerm);
                    }}
                    placeholder="Search users..."
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => loadUsers(searchTerm)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                  aria-label="Refresh users"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Username</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {item.username}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {item.email || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {item.roles.map((itemRole) => (
                            <span
                              key={itemRole}
                              className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              {itemRole.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}>
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleUserStatus(item)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            item.is_active
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
              Showing {users.length} account(s) in this result.
            </div>
          </section>

          <footer className="py-8 text-center text-xs text-slate-400">
            MUST FeeFlow · Administration Portal
          </footer>
        </div>
      </main>
    </div>
  );
}
