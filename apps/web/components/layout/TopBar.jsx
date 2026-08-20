const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 8.608V16.75C22 17.9926 21.0104 19 19.75 19H4.25C2.98959 19 2 17.9926 2 16.75V8.608L11.652 13.6919C11.8726 13.8065 12.1274 13.8065 12.348 13.6919L22 8.608ZM19.75 5C20.9338 5 21.8939 5.91897 21.9896 7.07895L12 12.1765L2.01038 7.07895C2.10615 5.91897 3.06618 5 4.25 5H19.75Z"
      fill="white"
    />
  </svg>
);

const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.62 10.79C8.06 13.62 10.38 15.93 13.21 17.38L15.41 15.18C15.68 14.91 16.08 14.82 16.43 14.94C17.55 15.31 18.76 15.51 20 15.51C20.55 15.51 21 15.96 21 16.51V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z"
      fill="white"
    />
  </svg>
);

export default function TopBar() {
  return (
    <div className="flex h-9 w-full items-center justify-center bg-[#2E3192] px-4 sm:px-6 lg:px-[100px]">
      <div className="flex h-6 w-full max-w-[1240px] flex-row items-center justify-center gap-3 lg:justify-between">
        {/* Left: Email — desktop/laptop only, no room for it below lg */}
        <div className="hidden flex-shrink-0 flex-row items-center gap-2 lg:flex lg:w-[197px]">
          <MailIcon />
          <a
            href="mailto:optexopticals@gmail.com"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '100%',
              letterSpacing: '0%',
              color: '#FFFFFF',
              textDecoration: 'none',
            }}
          >
            optexopticals@gmail.com
          </a>
        </div>

        {/* Center: Offer Text */}
        <span
          className="min-w-0 flex-1 truncate text-center"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            fontSize: '12px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: '#FFFFFF',
          }}
        >
          offer on 25th december for christmas collection
        </span>

        {/* Right: Phone — hidden on mobile, room's too tight alongside the offer text */}
        <div
          className="hidden flex-shrink-0 flex-row items-center gap-2 whitespace-nowrap sm:flex"
          style={{ justifyContent: 'flex-end' }}
        >
          <PhoneIcon />
          <a
            href="tel:+254700897007"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: '100%',
              letterSpacing: '0%',
              color: '#FFFFFF',
              textDecoration: 'none',
            }}
          >
            +254 700 897 007
          </a>
        </div>
      </div>
    </div>
  );
}
