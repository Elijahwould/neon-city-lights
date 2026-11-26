import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms · Neon City Lights" };

export default function TermsPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="brand text-4xl text-pink">Terms</h1>
      <p>Neon City Lights is an unofficial, free fan companion for the Neon City Lights tabletop game. It is not published by the game’s authors, Carbon Pink, or Wizards of the Coast.</p>
      <p>The app stores characters only in this browser’s localStorage. Nothing about your runner is uploaded to a server we operate. Create Google Sheet signs you in with Google only to make a spreadsheet in your own Drive, using the drive.file scope, and only for the file the app creates.</p>
      <p>The game text and the sheet template belong to their owners. Use the companion for your own table. Don’t present it as an official product.</p>
      <p>The app is provided as-is, without a warranty. Contact <a className="text-cyan underline" href="mailto:elijahwould1987@gmail.com">elijahwould1987@gmail.com</a> about these terms.</p>
      <p><Link className="text-cyan underline" href="/privacy/">Privacy Policy</Link></p>
    </article>
  );
}
