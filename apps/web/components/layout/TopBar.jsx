const MailIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const PhoneIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5.5A1.5 1.5 0 014.5 4h1.372c.37 0 .693.254.77.617l.862 3.965a.75.75 0 01-.22.718l-1.3 1.17a13.02 13.02 0 005.547 5.547l1.17-1.3a.75.75 0 01.718-.22l3.965.862c.363.077.617.4.617.77V19.5A1.5 1.5 0 0119.5 21C10.44 21 3 13.56 3 4.5V5.5z"
    />
  </svg>
);

export default function TopBar() {
  return (
    <div className="bg-brand-blue py-2">
      <div className="site-container flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <div className="flex min-w-0 items-center gap-2">
          <MailIcon />
          <a
            href="mailto:optexopticians@gmail.com"
            className="top-bar-text break-all sm:break-normal"
          >
            optexopticians@gmail.com
          </a>
        </div>
        <div className="hidden md:block">
          <p className="top-bar-text uppercase tracking-wide">
            offer on 25th december for christmas collection
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <PhoneIcon />
          <a href="tel:+254700000000" className="top-bar-text font-semibold">
            +254 700 000 000
          </a>
        </div>
      </div>
    </div>
  );
}
