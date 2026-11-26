import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy · Neon City Lights" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="brand text-4xl text-pink">Privacy Policy</h1>
      <p>Neon City Lights is a fan companion that runs in your browser. It does not have an account system and it does not send your character to a server we operate.</p>
      <h2 className="brand text-2xl text-cyan">Characters stay on this device</h2>
      <p>Runners, drafts, and sheet notes are stored only in this browser’s localStorage. Clearing the site data, or using another browser, removes them. Export a JSON file if you want a copy.</p>
      <h2 className="brand text-2xl text-cyan">Google sign-in</h2>
      <p>
        Create Google Sheet uses Google Identity Services with the public client for this app. The only permission requested is
        {" "}<code>https://www.googleapis.com/auth/drive.file</code>. That scope lets the app create a spreadsheet in your own Google Drive and edit that file. It does not let the app read the rest of your Drive.
      </p>
      <p>The sign-in happens between your browser and Google. The character values written into the new sheet go directly from your browser to Google’s Sheets API. They are not sent to any Neon City Lights server.</p>
      <h2 className="brand text-2xl text-cyan">Contact</h2>
      <p>Questions about this policy: <a className="text-cyan underline" href="mailto:elijahwould1987@gmail.com">elijahwould1987@gmail.com</a>.</p>
      <p><Link className="text-cyan underline" href="/terms/">Terms</Link></p>
    </article>
  );
}
