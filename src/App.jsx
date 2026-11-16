import { useEffect, useState } from "react";
import {ToastHost, TopBar, Modal} from "./components/Chrome.jsx";
import { sessionUser, subscribeAuth } from "./lib/store.js";
import { go } from "./lib/helpers.js";

export { go };
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Chat from "./pages/Chat.jsx";
import Profile from "./pages/Profile.jsx";
import About from "./pages/About.jsx";

function useHash() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function Redirect({ to }) {
  useEffect(() => { window.location.replace(`#${to}`); }, [to]);
  return null;
}

export default function App() {
  const hash = useHash();
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => subscribeAuth(() => setAuthReady(true)), []);
  const route = (hash.split("?")[0] || "#/").replace(/^#\/?/, "");
  const query = new URLSearchParams(hash.split("?")[1] || "");
  const logged = authReady && !!sessionUser();

  if (!authReady) {
    return (
      <>
        <ToastHost />
        <div className="boot-loading">📓 NOTEBOOK LAB<br /><span>cloud se utha raha hoon… ☁️</span></div>
      </>
    );
  }

  let page = null;
  if (route === "login") {
    page = logged ? <Redirect to="/" /> : <Login />;
  } else if (route === "about") {
    page = <About />;
  } else if (route === "profile") {
    page = logged ? <Profile /> : <Redirect to="login" />;
  } else if (route === "chat") {
    page = logged ? <Chat bookId={query.get("nb")} /> : <Redirect to="login" />;
  } else {
    page = logged ? <Home /> : <Redirect to="login" />;
  }

  return (
    <>
      <ToastHost />
      <TopBar />
      {page}
    </>
  );
}

export { Modal };
