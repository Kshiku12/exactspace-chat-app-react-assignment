import React, { useState } from "react";
import {
  Lock,
  Mail,
  User,
  BadgeCheck,
  Building2,
  Briefcase,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  COMPANY_DEPARTMENTS,
  COMPANY_OFFICES,
  AVATAR_COLORS,
} from "../data/constants";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login fields
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Registration fields (Company Employee Onboarding)
  const [regForm, setRegForm] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    department: COMPANY_DEPARTMENTS[0],
    designation: "Software Engineer",
    officeLocation: COMPANY_OFFICES[0],
    phone: "",
    about: "Building real-time industrial intelligence at ExactSpace",
    avatarColor: AVATAR_COLORS[0],
    password: "",
    confirmPassword: "",
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Sign in failed");
      }
      onAuthenticated(data.employee, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!regForm.fullName.trim() || !regForm.email.trim()) {
      setError("Please enter your Full Name and Company Work Email.");
      return;
    }
    if (regForm.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Registration failed");
      }
      onAuthenticated(data.employee, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wa-auth-page">
      {/* Top Emerald Header Band */}
      <div className="wa-auth-top-band">
        <div className="wa-auth-brand-bar">
          <div className="wa-brand-left">
            <div className="wa-brand-logo">EX</div>
            <div>
              <span className="wa-brand-title">EXACTSPACE WORKSPACE</span>
              <span className="wa-brand-sub">
                Internal Engineering &amp; Operations Communication Portal
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="wa-auth-card-wrapper">
        <div className="wa-auth-card">
          {/* Left Info Column */}
          <div className="wa-auth-info-col">
            <div className="wa-info-top">
              <span className="wa-kicker">EXACTSPACE CONNECT</span>
              <h2>
                {mode === "login"
                  ? "Sign in with your company credentials"
                  : "Register your employee workspace account"}
              </h2>
              <p>
                Real-time communication across Bengaluru HQ and Poland Office
                engineering channels. Share technical documents, architecture
                diagrams, and collaborate with your team.
              </p>

              <div className="wa-feature-checklist">
                <div className="wa-check-row">
                  <CheckCircle2 size={16} />
                  <span>
                    Real-time WebSocket (Socket.io) Publish / Subscribe Channels
                  </span>
                </div>
                <div className="wa-check-row">
                  <CheckCircle2 size={16} />
                  <span>
                    Direct &amp; Channel Messaging with Team Members
                  </span>
                </div>
                <div className="wa-check-row">
                  <CheckCircle2 size={16} />
                  <span>
                    PDF, Image &amp; Code File Sharing with Inline Previews
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="wa-auth-form-col">
            <div className="wa-auth-tabs">
              <button
                type="button"
                className={`wa-auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Employee Sign In
              </button>
              <button
                type="button"
                className={`wa-auth-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Employee Registration
              </button>
            </div>

            {error && (
              <div className="wa-auth-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="wa-login-form">
                <div className="wa-field-group">
                  <label>Company Work Email or Employee ID</label>
                  <div className="wa-input-with-icon">
                    <Mail size={16} />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. kshitij@exactspace.co or EXS-2026-001"
                      required
                    />
                  </div>
                </div>

                <div className="wa-field-group">
                  <label>Password</label>
                  <div className="wa-input-with-icon">
                    <Lock size={16} />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="wa-submit-btn"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                <p className="wa-switch-prompt">
                  Don&apos;t have an employee account yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                  >
                    Register here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="wa-register-form">
                <div className="wa-form-row-2">
                  <div className="wa-field-group">
                    <label>Full Name *</label>
                    <div className="wa-input-with-icon">
                      <User size={15} />
                      <input
                        type="text"
                        placeholder="Kumar Kshitij"
                        value={regForm.fullName}
                        onChange={(e) =>
                          setRegForm({ ...regForm, fullName: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="wa-field-group">
                    <label>Employee ID / Badge No.</label>
                    <div className="wa-input-with-icon">
                      <BadgeCheck size={15} />
                      <input
                        type="text"
                        placeholder="EXS-2026-042"
                        value={regForm.employeeId}
                        onChange={(e) =>
                          setRegForm({ ...regForm, employeeId: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="wa-form-row-2">
                  <div className="wa-field-group">
                    <label>Company Work Email *</label>
                    <div className="wa-input-with-icon">
                      <Mail size={15} />
                      <input
                        type="email"
                        placeholder="kshitij@exactspace.co"
                        value={regForm.email}
                        onChange={(e) =>
                          setRegForm({ ...regForm, email: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="wa-field-group">
                    <label>Phone Number</label>
                    <div className="wa-input-with-icon">
                      <Phone size={15} />
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={regForm.phone}
                        onChange={(e) =>
                          setRegForm({ ...regForm, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="wa-form-row-2">
                  <div className="wa-field-group">
                    <label>Department *</label>
                    <div className="wa-input-with-icon">
                      <Building2 size={15} />
                      <select
                        value={regForm.department}
                        onChange={(e) =>
                          setRegForm({ ...regForm, department: e.target.value })
                        }
                      >
                        {COMPANY_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="wa-field-group">
                    <label>Designation / Role *</label>
                    <div className="wa-input-with-icon">
                      <Briefcase size={15} />
                      <input
                        type="text"
                        placeholder="Software Engineer"
                        value={regForm.designation}
                        onChange={(e) =>
                          setRegForm({
                            ...regForm,
                            designation: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="wa-form-row-2">
                  <div className="wa-field-group">
                    <label>Office Location *</label>
                    <div className="wa-input-with-icon">
                      <MapPin size={15} />
                      <select
                        value={regForm.officeLocation}
                        onChange={(e) =>
                          setRegForm({
                            ...regForm,
                            officeLocation: e.target.value,
                          })
                        }
                      >
                        {COMPANY_OFFICES.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="wa-field-group">
                    <label>Avatar Color</label>
                    <div className="wa-color-swatches">
                      {AVATAR_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          className={`wa-color-dot ${
                            regForm.avatarColor === col ? "selected" : ""
                          }`}
                          style={{ backgroundColor: col }}
                          onClick={() =>
                            setRegForm({ ...regForm, avatarColor: col })
                          }
                          aria-label={`Select color ${col}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wa-form-row-2">
                  <div className="wa-field-group">
                    <label>Password *</label>
                    <div className="wa-input-with-icon">
                      <Lock size={15} />
                      <input
                        type="password"
                        placeholder="Min 6 characters"
                        value={regForm.password}
                        onChange={(e) =>
                          setRegForm({ ...regForm, password: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="wa-field-group">
                    <label>Confirm Password *</label>
                    <div className="wa-input-with-icon">
                      <Lock size={15} />
                      <input
                        type="password"
                        placeholder="Repeat password"
                        value={regForm.confirmPassword}
                        onChange={(e) =>
                          setRegForm({
                            ...regForm,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="wa-submit-btn"
                  disabled={loading}
                >
                  {loading ? "Registering..." : "Create Account"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
