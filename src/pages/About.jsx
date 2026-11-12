export default function About() {
  return (
    <main className="screen">
      <section className="about">
        <h2 className="section-title">HOW IT WORKS ⚙️</h2>
        <div className="about-grid">
          <div className="about-card" style={{ "--c": "var(--yellow)" }}><span>1</span><b>ASK</b><p>Create a notebook, then type any question or topic in the chat. Answers come exam-ready — definition, numbered points, example, conclusion.</p></div>
          <div className="about-card" style={{ "--c": "var(--pink)" }}><span>2</span><b>ATTACH 📎</b><p>Got a PDF? Attach it — the bot reads it and gives you a crisp, exam-ready summary.</p></div>
          <div className="about-card" style={{ "--c": "var(--cyan)" }}><span>3</span><b>QUIZ 💥</b><p>Every reply gets a ❓ QUIZ chip — 5 questions on the same content, with 🔄 NEW QUIZ retry to practise again.</p></div>
          <div className="about-card" style={{ "--c": "var(--green)" }}><span>4</span><b>STUDY → TEST</b><p>Read the summary, listen on repeat, take the quiz on the same content. 💥</p></div>
        </div>
        <p className="about-foot">Runs on Gemini — all content generated live. 💥</p>
      </section>
    </main>
  );
}
