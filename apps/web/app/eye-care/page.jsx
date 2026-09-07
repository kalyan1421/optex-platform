import Image from 'next/image';
import EyeCareForm from '@/components/eye-care/EyeCareForm';

export const metadata = {
  title: 'Eye Care | Optex Opticians',
  description:
    'Comprehensive eye care at Optex Opticians — free eye exams, records kept for life, and same-day fitting.',
};

function CheckPill({ text, textColor }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-[20px] border border-[#FFFFFF29] bg-[#FFFFFF14] px-[16px] py-[9px] backdrop-blur-md">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M11.6663 3.5L5.24967 9.91667L2.33301 7" stroke="#E53935" strokeWidth="1.16667" />
      </svg>
      <span className={`font-poppins text-[14px] font-normal leading-[100%] ${textColor}`}>
        {text}
      </span>
    </div>
  );
}

export default function EyeCarePage() {
  return (
    <div className="flex w-full flex-col bg-white">
      <section className="relative flex h-[292px] w-full items-center justify-center overflow-hidden">
        <Image
          src="/images/eyecare-hero.jpg"
          alt="Optometrist examining a customer's eyes"
          fill
          priority
          className="object-cover object-[center_55%]"
        />
        <div className="absolute inset-0 bg-[#3733338A]" />

        <div className="relative z-10 flex w-full max-w-[660px] flex-col items-center gap-[34px] px-4">
          <h1 className="font-outfit w-full max-w-[534px] text-center text-[32px] font-bold capitalize leading-[120%] tracking-[-0.01em] text-white sm:text-[40px] lg:text-[48px]">
            Tell Us About Your <span className="text-[#E53935]">Eyes</span>.
            <br />
            We&apos;ll Take It From There.
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <CheckPill text="Free comprehensive exam" textColor="text-[#F5F5F5]" />
            <CheckPill text="Records kept for life" textColor="text-[#F5F5F5]" />
            <CheckPill text="Same day fitting" textColor="text-[#DCDCF3]" />
          </div>
        </div>
      </section>

      {/* Patient Record & Booking Section */}
      <section className="flex w-full justify-center bg-[#F9F9FC] pb-24">
        {/* P-03: `min-w-0`. This is a flex item in a row container, so it
            defaults to `min-width: auto` — it refuses to shrink below its
            min-content width, which the 560px prescription table sets. The
            table's own `overflow-x-auto` wrapper could never clip while this
            ancestor was busy growing to fit it, so /eye-care laid out at 571px
            on a 375px screen and the whole page scrolled sideways. */}
        <div className="flex w-full min-w-0 max-w-[1440px] flex-col px-6 lg:px-[80px]">
          {/* Header Group */}
          <div className="mt-12 flex w-full max-w-[532px] flex-col gap-[18px] lg:mt-[80px]">
            <span className="font-poppins text-[16px] font-semibold uppercase leading-[24px] tracking-[2px] text-[#E53935]">
              Patient Record & Booking
            </span>
            <h2 className="font-outfit text-[32px] font-semibold leading-[34px] text-black">
              Your eye care record
            </h2>
          </div>

          {/* Two Column Content */}
          <div className="mt-10 flex flex-col gap-10 lg:mt-[40px] xl:flex-row xl:gap-[57px]">
            {/* Left Column (Frame 2610706) */}
            <EyeCareForm />

            {/* Right Column */}
            <div className="flex w-full flex-col xl:w-[437.37px]">
              {/* Top Frame: Why fill this in advance */}
              <div className="flex h-[288.25px] w-full flex-col gap-[14px] rounded-[20px] border border-[#DFDFDF] bg-[#F6F6F9] px-[28px] pb-[30px] pt-[29.25px]">
                {/* Heading */}
                <h4 className="font-outfit text-[15.5px] font-bold leading-[17px] tracking-[-0.16px] text-[#20225F]">
                  Why fill this in advance
                </h4>

                {/* Item 1 */}
                <div className="flex h-[62px] w-full items-center gap-[14px]">
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 17 17"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.375 8.50016L7.79167 9.91683L10.625 7.0835"
                        stroke="#2E3192"
                        strokeWidth="1.20417"
                      />
                      <path
                        d="M2.125 8.5C2.125 12.0185 4.98154 14.875 8.5 14.875C12.0185 14.875 14.875 12.0185 14.875 8.5C14.875 4.98154 12.0185 2.125 8.5 2.125C4.98154 2.125 2.125 4.98154 2.125 8.5V8.5"
                        stroke="#2E3192"
                        strokeWidth="1.20417"
                      />
                    </svg>
                  </div>
                  <div className="flex w-full flex-col justify-center gap-[5.5px]">
                    <span className="font-poppins text-[13.5px] font-semibold leading-[100%] text-[#20225F]">
                      Faster in-store visit
                    </span>
                    <span className="font-poppins text-[12.5px] font-normal leading-[100%] text-[#767791]">
                      Your optometrist reviews your file before you sit down
                    </span>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="flex h-[64px] w-full items-center gap-[14px] pt-[2px]">
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 17 17"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.95801 2.8335H12.0413C13.2149 2.8335 14.1663 3.78489 14.1663 4.9585V12.0418C14.1663 13.2154 13.2149 14.1668 12.0413 14.1668H4.95801C3.7844 14.1668 2.83301 13.2154 2.83301 12.0418V4.9585C2.83301 3.78489 3.7844 2.8335 4.95801 2.8335V2.8335"
                        stroke="#2E3192"
                        strokeWidth="1.20417"
                      />
                      <path
                        d="M5.66634 1.4165V4.24984M11.333 1.4165V4.24984M2.83301 7.08317H14.1663"
                        stroke="#2E3192"
                        strokeWidth="1.20417"
                      />
                    </svg>
                  </div>
                  <div className="flex w-full flex-col justify-center gap-[5.5px]">
                    <span className="font-poppins text-[13.5px] font-semibold leading-[100%] text-[#20225F]">
                      One record, every branch
                    </span>
                    <span className="font-poppins text-[12.5px] font-normal leading-[100%] text-[#767791]">
                      Walk into any of our 12 stores and your file is already there
                    </span>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="flex h-[44px] w-full items-center gap-[14px] pt-[2px]">
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 17 17"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 8.5C2 8.5 5 4.5 8.5 4.5C12 4.5 15 8.5 15 8.5C15 8.5 12 12.5 8.5 12.5C5 12.5 2 8.5 2 8.5Z"
                        stroke="#2E3192"
                        strokeWidth="1.20417"
                      />
                      <circle cx="8.5" cy="8.5" r="2.5" stroke="#2E3192" strokeWidth="1.20417" />
                    </svg>
                  </div>
                  <div className="flex w-full flex-col justify-center gap-[4.5px]">
                    <span className="font-poppins text-[13.5px] font-semibold leading-[100%] text-[#20225F]">
                      Frames pulled ahead
                    </span>
                    <span className="font-poppins text-[12.5px] font-normal leading-[100%] text-[#767791]">
                      Tell us your brand and we'll have a shortlist ready.
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Frame: Store hours.

                  P-08: this block used to advertise "Sunday 10:00 AM – 4:00 PM"
                  while the booking widget directly beneath it returned "No
                  times available" for every Sunday, and /contact stated "Sun:
                  Closed". Two of the three agreed, and the booking engine is
                  the one backed by actual branch schedule data, so the Sunday
                  row was the wrong one. Weekday and Saturday rows are widened
                  to the branch opening hours the slot generator uses, so the
                  advertised hours and the bookable hours describe one business.
                  Last slot is earlier than closing because an eye test needs a
                  chair for longer than the last half-hour of the day. */}
              <div className="mt-[14px] flex h-[200.25px] w-full flex-col rounded-[20px] bg-[#20225F] px-[28px] pb-[30px] pt-[29.25px]">
                <h4 className="font-outfit pb-[14px] text-[15.5px] font-bold leading-[17px] tracking-[-0.16px] text-white">
                  Store hours
                </h4>
                <div className="flex items-center justify-between border-b-[1px] border-dashed border-[#FFFFFF29] py-[9px]">
                  <span className="font-poppins text-[13px] font-normal leading-[100%] text-[#C7C8E6]">
                    Mon – Fri
                  </span>
                  <span className="font-poppins text-[13px] font-medium leading-[100%] text-white">
                    8:30 AM – 7:00 PM
                  </span>
                </div>
                <div className="flex items-center justify-between border-b-[1px] border-dashed border-[#FFFFFF29] py-[9px]">
                  <span className="font-poppins text-[13px] font-normal leading-[100%] text-[#C7C8E6]">
                    Saturday
                  </span>
                  <span className="font-poppins text-[13px] font-medium leading-[100%] text-white">
                    9:00 AM – 6:00 PM
                  </span>
                </div>
                <div className="flex items-center justify-between py-[9px]">
                  <span className="font-poppins text-[13px] font-normal leading-[100%] text-[#C7C8E6]">
                    Sunday
                  </span>
                  <span className="font-poppins text-[13px] font-medium leading-[100%] text-white">
                    Closed
                  </span>
                </div>
              </div>

              {/* Bottom Frame: Prefer to talk first? */}
              <div className="mt-[14px] flex h-[203.75px] w-full flex-col gap-[14px] rounded-[20px] bg-[#E53935] px-[28px] pb-[30px] pt-[29.25px]">
                <h4 className="font-outfit text-[15.5px] font-bold leading-[17px] tracking-[-0.16px] text-white">
                  Prefer to talk first?
                </h4>
                <p className="font-poppins text-[13px] font-normal leading-[22.1px] text-[#FFE0DE]">
                  Call our care line and an optometrist will walk you through the form.
                </p>
                <a
                  href="tel:+254700897007"
                  className="mt-auto flex h-[54.5px] w-full items-center justify-center rounded-[40px] border border-[#FFFFFFB2] transition-colors hover:bg-white/10"
                >
                  <span className="font-poppins text-center text-[14.5px] font-semibold leading-[100%] text-white">
                    Call +254 700 897 007
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
