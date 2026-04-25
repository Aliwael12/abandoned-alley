import ContactForm from "@/components/ContactForm";
import { Mail, MapPin } from "lucide-react";
import { InstagramIcon } from "@/components/Socials";

export const metadata = { title: "Contact — Abandoned Alley" };

export default function ContactPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-14">
      <div className="flex flex-col items-center gap-3 mb-12">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Reach out
        </p>
        <h2 className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-[0.18em] uppercase">
          Contact
        </h2>
        <div className="w-12 h-px bg-white/30" />
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="flex flex-col gap-6 glass rounded-2xl p-7">
          <div>
            <h3 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
              Studio
            </h3>
            <p className="text-white/60 mt-2 leading-relaxed">
              Drop us a line for collaborations, press, or wholesale. We answer
              within 48 hours.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            <li className="flex items-center gap-3 text-sm text-white/80">
              <Mail size={16} className="text-white/50" /> studio@abandonedalley.example
            </li>
            <li className="flex items-center gap-3 text-sm text-white/80">
              <MapPin size={16} className="text-white/50" /> Casablanca / Online
            </li>
            <li className="flex items-center gap-3 text-sm text-white/80">
              <InstagramIcon size={16} className="text-white/50" />
              <a
                href="https://instagram.com/abandonedalley"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                @abandonedalley
              </a>
            </li>
          </ul>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
