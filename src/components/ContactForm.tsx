"use client";

import { Send } from "lucide-react";
import { useState } from "react";

export default function ContactForm() {
  const [done, setDone] = useState(false);
  const [data, setData] = useState({ name: "", email: "", message: "" });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="glass rounded-2xl p-7 flex flex-col gap-4"
    >
      <h3 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Send a message
      </h3>
      <input
        required
        placeholder="Name"
        value={data.name}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={data.email}
        onChange={(e) => setData({ ...data, email: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
      />
      <textarea
        required
        placeholder="Tell us what you need..."
        rows={5}
        value={data.message}
        onChange={(e) => setData({ ...data, message: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md p-4 outline-none focus:border-white/40 transition resize-none"
      />
      <button
        type="submit"
        className="self-start inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-white/90 transition"
      >
        Send <Send size={14} />
      </button>
      {done && (
        <p className="text-xs text-white/60">
          Thanks — we&apos;ll get back to you soon.
        </p>
      )}
    </form>
  );
}
