"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { User, Lock, Shield, Mail } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type Tab = "account" | "password" | "otp" | "smtp";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const { data: session, update } = useSession();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpSecret, setOtpSecret] = useState("");
  const [otpQrCode, setOtpQrCode] = useState("");
  const [otpVerifyCode, setOtpVerifyCode] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpEncryption, setSmtpEncryption] = useState("TLS");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (session?.user) {
      const user = session.user as any;
      setUsername(user.username || "");
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setOtpEnabled(user.otpEnabled || false);
    }
  }, [session]);

  useEffect(() => {
    // Fetch SMTP settings
    const fetchSmtpSettings = async () => {
      try {
        const response = await fetch("/api/settings/smtp");
        if (response.ok) {
          const data = await response.json();
          if (data.smtp) {
            setSmtpHost(data.smtp.host || "");
            setSmtpPort(String(data.smtp.port || 587));
            setSmtpUsername(data.smtp.username || "");
            setSmtpPassword(data.smtp.password || "");
            setSmtpEncryption(data.smtp.encryption || "TLS");
            setSmtpFromName(data.smtp.fromName || "");
            setSmtpFromEmail(data.smtp.fromEmail || "");
            setSmtpEnabled(data.smtp.enabled || false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch SMTP settings:", error);
      }
    };

    fetchSmtpSettings();
  }, []);

  const tabs = [
    { id: "account" as Tab, label: "Account", icon: User },
    { id: "password" as Tab, label: "Password", icon: Lock },
    { id: "otp" as Tab, label: "OTP", icon: Shield },
    { id: "smtp" as Tab, label: "SMTP", icon: Mail },
  ];

  const handleSaveAccount = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update account");
      }

      // Update local state immediately for responsive UI
      if (data.user) {
        if (data.user.displayName !== undefined) {
          setDisplayName(data.user.displayName || "");
        }
        if (data.user.email !== undefined) {
          setEmail(data.user.email || "");
        }
      }

      // Trigger session refresh by calling update with a dummy object
      // This forces NextAuth to re-run the JWT callback with trigger='update'
      await update({
        displayName: data.user.displayName,
        email: data.user.email,
      });

      setMessage({ type: "success", text: "Account updated successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to update account" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setIsLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setMessage({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to change password" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupOtp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/otp/setup", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to setup OTP");
      }

      setOtpSecret(data.secret);
      setOtpQrCode(data.qrCode);
      setMessage({ type: "success", text: "Scan the QR code with your authenticator app" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to setup OTP" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableOtp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/otp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpVerifyCode, secret: otpSecret }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to enable OTP");
      }

      // Clear setup state
      setOtpSecret("");
      setOtpQrCode("");
      setOtpVerifyCode("");

      // Trigger session refresh first
      await update({
        otpEnabled: true,
      });

      // Update local state after session refresh
      setOtpEnabled(true);

      setMessage({ type: "success", text: "OTP enabled successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to enable OTP" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableOtp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/otp/disable", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disable OTP");
      }

      // Trigger session refresh first
      await update({
        otpEnabled: false,
      });

      // Update local state after session refresh
      setOtpEnabled(false);

      setMessage({ type: "success", text: "OTP disabled successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to disable OTP" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: parseInt(smtpPort),
          username: smtpUsername,
          password: smtpPassword,
          encryption: smtpEncryption,
          fromName: smtpFromName,
          fromEmail: smtpFromEmail,
          enabled: smtpEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save SMTP settings");
      }

      setMessage({ type: "success", text: "SMTP settings saved successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save SMTP settings" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/smtp/test", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send test email");
      }

      setMessage({ type: "success", text: "Test email sent successfully! Check your inbox." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to send test email" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Settings
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage your application settings and preferences.
              </p>
            </div>

            <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-300"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
            {message && (
              <div
                className={cn(
                  "mb-6 rounded-lg p-4",
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                    : "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100"
                )}
              >
                {message.text}
              </div>
            )}

            {activeTab === "account" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Account Settings
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Manage your account information and preferences.
                </p>

                <div className="mt-8 space-y-6">
                  <div>
                    <label
                      htmlFor="username"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      readOnly
                      disabled
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-gray-500 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Username cannot be changed and is used for login
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="displayName"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Display Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-32 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                        Not Verified
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAccount}
                    disabled={isLoading}
                    className="rounded-lg bg-gray-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    {isLoading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "password" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Password Settings
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Change your account password.
                </p>

                <div className="mt-8 space-y-6">
                  <div>
                    <label
                      htmlFor="current-password"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={isLoading}
                    className="rounded-lg bg-gray-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    {isLoading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "otp" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Two-Factor Authentication (OTP)
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Add an extra layer of security to your account.
                </p>

                <div className="mt-8 space-y-6">
                  {!otpEnabled && !otpQrCode && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Enable Two-Factor Authentication
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Two-factor authentication adds an extra layer of security to your account. You'll need to enter a code from your authenticator app when signing in.
                      </p>
                      <button
                        onClick={handleSetupOtp}
                        disabled={isLoading}
                        className="mt-4 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? "Setting up..." : "Setup OTP"}
                      </button>
                    </div>
                  )}

                  {!otpEnabled && otpQrCode && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Scan QR Code
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
                        <div className="flex flex-col items-center">
                          <img src={otpQrCode} alt="OTP QR Code" className="rounded-lg border border-gray-200 dark:border-gray-700" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Or enter this key manually:
                          </p>
                          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                            <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white">
                              {otpSecret}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(otpSecret);
                                setMessage({ type: "success", text: "Secret key copied to clipboard!" });
                                setTimeout(() => setMessage(null), 2000);
                              }}
                              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                              title="Copy to clipboard"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Choose "Enter a setup key" in your authenticator app and paste this code
                          </p>
                        </div>
                      </div>
                      <div className="mt-6">
                        <label
                          htmlFor="verify-code"
                          className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                        >
                          Verification Code
                        </label>
                        <input
                          type="text"
                          id="verify-code"
                          value={otpVerifyCode}
                          onChange={(e) => setOtpVerifyCode(e.target.value)}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Enter the 6-digit code from your authenticator app to verify
                        </p>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={handleEnableOtp}
                          disabled={isLoading || otpVerifyCode.length !== 6}
                          className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isLoading ? "Verifying..." : "Verify & Enable"}
                        </button>
                        <button
                          onClick={() => {
                            setOtpQrCode("");
                            setOtpSecret("");
                            setOtpVerifyCode("");
                          }}
                          disabled={isLoading}
                          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {otpEnabled && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                            Two-Factor Authentication is Enabled
                          </h3>
                          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                            Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when signing in.
                          </p>
                          <button
                            onClick={handleDisableOtp}
                            disabled={isLoading}
                            className="mt-4 rounded-lg bg-red-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? "Disabling..." : "Disable OTP"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "smtp" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  SMTP Settings
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Configure SMTP server for sending emails.
                </p>

                <div className="mt-8 space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="smtp-host"
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        id="smtp-host"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="smtp-port"
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        id="smtp-port"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="smtp-encryption"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Encryption
                    </label>
                    <select
                      id="smtp-encryption"
                      value={smtpEncryption}
                      onChange={(e) => setSmtpEncryption(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    >
                      <option value="TLS">TLS</option>
                      <option value="SSL">SSL</option>
                      <option value="NONE">None</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="smtp-username"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      id="smtp-username"
                      name="smtp-username"
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="your-email@gmail.com"
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="smtp-password"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      id="smtp-password"
                      name="smtp-password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="smtp-from-name"
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        From Name
                      </label>
                      <input
                        type="text"
                        id="smtp-from-name"
                        value={smtpFromName}
                        onChange={(e) => setSmtpFromName(e.target.value)}
                        placeholder="NetPlug Dashboard"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="smtp-from-email"
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        From Email
                      </label>
                      <input
                        type="email"
                        id="smtp-from-email"
                        value={smtpFromEmail}
                        onChange={(e) => setSmtpFromEmail(e.target.value)}
                        placeholder="noreply@example.com"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <input
                      type="checkbox"
                      id="smtp-enabled"
                      checked={smtpEnabled}
                      onChange={(e) => setSmtpEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label
                      htmlFor="smtp-enabled"
                      className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Enable SMTP for sending emails
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveSmtp}
                      disabled={isLoading}
                      className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? "Saving..." : "Save Settings"}
                    </button>
                    <button
                      onClick={handleTestSmtp}
                      disabled={isLoading || !smtpHost || !smtpUsername}
                      className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {isLoading ? "Testing..." : "Send Test Email"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
