import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  fetchProfile,
  generateVerifyToken,
  saveAccount,
  type LCAccount,
  type LCProfilePayload
} from "../lib/leetcode";

type Props = {
  account: LCAccount | null;
  onAccountChange: (acc: LCAccount | null) => void;
  onSyncedProfile: (profile: LCProfilePayload) => void;
};

type Step = "idle" | "token" | "verifying" | "error";

function friendlyError(code: string): string {
  switch (code) {
    case "user_not_found": return "That username doesn't exist on LeetCode.";
    case "invalid_username": return "That username has invalid characters.";
    case "graphql_error": return "LeetCode rejected the request. Try again in a minute.";
    case "leetcode_upstream": return "LeetCode is unreachable right now. Try again shortly.";
    case "proxy_failure": return "Something went wrong on our side. Try again.";
    default: return `Error: ${code}`;
  }
}

export default function LeetCodeConnect({ account, onAccountChange, onSyncedProfile }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [username, setUsername] = useState(account?.username ?? "");
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  const isConnected = !!account?.verified;

  const lastSyncLabel = useMemo(() => {
    if (!account?.lastSyncAt) return null;
    const d = new Date(account.lastSyncAt);
    if (Number.isNaN(d.getTime())) return null;
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  }, [account?.lastSyncAt]);

  const startVerify = useCallback(() => {
    const name = username.trim();
    if (!name) {
      setError("Enter your LeetCode username first.");
      usernameRef.current?.focus();
      return;
    }
    setToken(generateVerifyToken());
    setStep("token");
    setError("");
  }, [username]);

  const copyToken = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 1500);
    } catch {}
  }, [token]);

  const runVerify = useCallback(async () => {
    if (!username.trim() || !token) return;
    setBusy(true);
    setStep("verifying");
    setError("");
    try {
      const profile = await fetchProfile(username.trim());
      if (!profile.aboutMe || !profile.aboutMe.includes(token)) {
        setError(
          "Couldn't find the verification code in your LeetCode bio. Make sure you saved your profile changes, then try again."
        );
        setStep("error");
        return;
      }
      const now = new Date().toISOString();
      const next: LCAccount = {
        username: profile.username,
        verified: true,
        verifiedAt: now,
        lastSyncAt: now
      };
      saveAccount(next);
      onAccountChange(next);
      onSyncedProfile(profile);
      setOpen(false);
      setStep("idle");
      setToken("");
    } catch (e: any) {
      setError(friendlyError(String(e?.message || e)));
      setStep("error");
    } finally {
      setBusy(false);
    }
  }, [username, token, onAccountChange, onSyncedProfile]);

  const sync = useCallback(async () => {
    if (!account?.username) return;
    setBusy(true);
    setError("");
    try {
      const profile = await fetchProfile(account.username);
      const next: LCAccount = { ...account, lastSyncAt: new Date().toISOString() };
      saveAccount(next);
      onAccountChange(next);
      onSyncedProfile(profile);
    } catch (e: any) {
      setError(friendlyError(String(e?.message || e)));
    } finally {
      setBusy(false);
    }
  }, [account, onAccountChange, onSyncedProfile]);

  const disconnect = useCallback(() => {
    saveAccount(null);
    onAccountChange(null);
    setUsername("");
    setToken("");
    setStep("idle");
    setError("");
    setOpen(false);
  }, [onAccountChange]);

  if (isConnected && !open) {
    return (
      <div className="lc-connect lc-connect-row">
        <div className="lc-connected">
          <span className="lc-status-dot" aria-hidden="true" />
          <span className="lc-connected-text">
            Connected as <strong>{account!.username}</strong>
            {lastSyncLabel && <span className="lc-sync-time"> · synced {lastSyncLabel}</span>}
          </span>
        </div>
        <div className="lc-actions">
          <button
            type="button"
            className="lc-btn lc-btn-secondary"
            onClick={sync}
            disabled={busy}
          >
            {busy ? "Syncing…" : "Sync"}
          </button>
          <button
            type="button"
            className="lc-btn lc-btn-ghost"
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
        {error && <p className="lc-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="lc-connect lc-connect-row">
        <div className="lc-cta">
          <strong>Connect your LeetCode</strong>
          <span className="lc-cta-sub">Sync your real submission history and streak.</span>
        </div>
        <button
          type="button"
          className="lc-btn lc-btn-primary"
          onClick={() => { setOpen(true); setStep("idle"); }}
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="lc-connect lc-connect-expanded">
      <div className="lc-step">
        <label className="lc-label" htmlFor="lc-username">LeetCode username</label>
        <div className="lc-username-row">
          <input
            id="lc-username"
            ref={usernameRef}
            className="lc-input"
            type="text"
            placeholder="e.g. akin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={step !== "idle" && step !== "error"}
            autoComplete="username"
          />
          {(step === "idle" || step === "error") && (
            <button
              type="button"
              className="lc-btn lc-btn-primary"
              onClick={startVerify}
              disabled={!username.trim() || busy}
            >
              Continue
            </button>
          )}
        </div>
      </div>

      {(step === "token" || step === "verifying" || (step === "error" && token)) && (
        <div className="lc-step lc-token-step">
          <p className="lc-instructions">
            <strong>Step 2.</strong> Paste this code into your LeetCode profile's <em>About me</em> section, save, then click Verify below. You can delete it from your bio immediately after.
          </p>
          <div className="lc-token-box">
            <code className="lc-token">{token}</code>
            <button
              type="button"
              className="lc-btn lc-btn-ghost lc-token-copy"
              onClick={copyToken}
            >
              {tokenCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="lc-help">
            Edit your bio here: <a href={`https://leetcode.com/${username.trim()}/`} target="_blank" rel="noreferrer">leetcode.com/{username.trim()}</a>
            {" · "}
            <a href="https://leetcode.com/edit/" target="_blank" rel="noreferrer">edit profile</a>
          </p>
          <div className="lc-verify-row">
            <button
              type="button"
              className="lc-btn lc-btn-primary"
              onClick={runVerify}
              disabled={busy}
            >
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              type="button"
              className="lc-btn lc-btn-ghost"
              onClick={() => { setOpen(false); setStep("idle"); setToken(""); setError(""); }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="lc-error" role="alert">{error}</p>}
    </div>
  );
}
