"use client";

import { useState } from "react";
import { Button, Input } from "./ui";

const TOPICS = ["ORDERS", "SIZING", "WHOLESALE", "PRESS"];

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const sendDisabled = !(name.trim() && email.trim() && message.trim()) || submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendDisabled) return;
    setError(null);
    setSubmitting(true);
    const prefix = [topic ? `Topic: ${topic}` : null, subject ? `Subject: ${subject}` : null]
      .filter(Boolean)
      .join("\n");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message: prefix ? `${prefix}\n\n${message}` : message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not send message");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ border: "1px solid var(--accent-default)", padding: "var(--space-8)" }}>
        <h2 className="aa-display-h2">MESSAGE SENT</h2>
        <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
          We answer within two working days, Cairo time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="aa-cart-grid">
        <Input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {TOPICS.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={topic === t ? "primary" : "secondary"}
            onClick={() => setTopic(topic === t ? null : t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <textarea
        required
        placeholder="Tell us what you need..."
        rows={7}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="aa-input"
        style={{ resize: "none" }}
      />
      <Button type="submit" variant="primary" size="lg" disabled={sendDisabled} style={{ alignSelf: "flex-start" }}>
        {submitting ? "SENDING…" : "SEND MESSAGE"}
      </Button>
      {error && <p className="aa-caption" style={{ color: "var(--graphic-red)" }}>{error}</p>}
    </form>
  );
}
