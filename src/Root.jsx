import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import Login from "./Login.jsx";
import App from "./App.jsx";

// Auth gate: the session persists on the device, so this is rarely seen.
export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="app" />;
  if (!session) return <Login />;
  return <App session={session} />;
}
