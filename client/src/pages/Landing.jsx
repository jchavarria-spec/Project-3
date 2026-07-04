import { Link } from 'react-router-dom';

const features = [
  { emoji: '📅', title: 'Today at a glance', text: 'Open the app and instantly see today’s jobs, who’s assigned, and what’s next — right from your phone in the truck.' },
  { emoji: '🌐', title: 'Online booking page', text: 'Customers request appointments from your own booking link, 24/7, without calling. You confirm with one tap.' },
  { emoji: '🔔', title: 'Automatic reminders', text: 'SMS and email reminders go out before every appointment, so no-shows stop eating your day.' },
  { emoji: '⭐', title: 'More 5-star reviews', text: 'When you mark a job complete, customers automatically get a text with your Google and Yelp review links.' },
  { emoji: '👥', title: 'Customer history', text: 'Every customer’s jobs, notes, and lifetime value in one place. Know the house before you knock.' },
  { emoji: '🧑‍🔧', title: 'Team scheduling', text: 'Assign jobs to techs with color-coded calendars. Everyone knows where to be.' },
];

const plans = [
  {
    name: 'Solo',
    price: 29,
    popular: false,
    items: ['1 user', 'Unlimited jobs & customers', 'Online booking page', 'Email reminders', 'Review requests'],
  },
  {
    name: 'Crew',
    price: 79,
    popular: true,
    items: ['Up to 5 team members', 'Everything in Solo', 'SMS + email reminders', 'Technician assignment', 'Priority support'],
  },
  {
    name: 'Company',
    price: 149,
    popular: false,
    items: ['Unlimited team members', 'Everything in Crew', 'Custom branding', 'Phone support'],
  },
];

export default function Landing() {
  return (
    <div>
      <nav className="landing-nav">
        <div className="logo">🔧 FieldBook</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/login" className="btn btn-secondary btn-sm">Sign in</Link>
          <Link to="/register" className="btn btn-sm">Start free</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>Scheduling that works as hard as you do.</h1>
        <p>
          FieldBook is the booking, reminders, and review engine for plumbers, HVAC techs, electricians,
          and cleaners. Set up in under 10 minutes — no tech skills needed.
        </p>
        <div className="cta-row">
          <Link to="/register" className="btn btn-lg">Start your free trial</Link>
          <a href="#pricing" className="btn btn-secondary btn-lg">See pricing</a>
        </div>
      </section>

      <section className="feature-grid">
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <div className="emoji">{f.emoji}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <h2 className="section-title" id="pricing">Simple pricing. No contracts.</h2>
      <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 6 }}>14-day free trial on every plan. Cancel anytime.</p>
      <section className="pricing-grid">
        {plans.map((p) => (
          <div className={`price-card ${p.popular ? 'popular' : ''}`} key={p.name}>
            {p.popular && <div className="pop-badge">Most popular</div>}
            <h3>{p.name}</h3>
            <div className="amount">${p.price}</div>
            <div className="per">per month</div>
            <ul>
              {p.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <Link to="/register" className="btn btn-block">Start free trial</Link>
          </div>
        ))}
      </section>

      <footer className="landing-footer">© {new Date().getFullYear()} FieldBook. Built for the trades.</footer>
    </div>
  );
}
