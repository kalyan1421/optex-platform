import Image from 'next/image';

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

function CheckboxPill({ label, widthClass = 'w-fit' }) {
  return (
    <label
      className={`flex items-center gap-[10px] ${widthClass} h-[44px] cursor-pointer rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] px-[20px] py-[12px] transition-colors hover:border-[#2E3192]`}
    >
      <input
        type="checkbox"
        className="h-[19px] w-[19px] cursor-pointer rounded-[4px] border-[0.8px] border-[#E5E7EB] bg-white accent-[#2E3192]"
      />
      <span className="font-inter whitespace-nowrap text-[16px] font-normal leading-[100%] text-[#0A0A0A]">
        {label}
      </span>
    </label>
  );
}

function PrescriptionInput({ top, left, width, placeholder }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      className="font-inter absolute h-[38px] rounded-[8px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] px-[20px] text-[16px] font-normal outline-none transition-colors placeholder:text-[#0A0A0A] focus:border-[#2E3192]"
      style={{ top: `${top}px`, left: `${left}px`, width: `${width}px` }}
    />
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
        <div className="flex w-full max-w-[1440px] flex-col px-6 lg:px-[80px]">
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
            <div className="relative flex h-auto min-h-[1477px] w-full flex-col rounded-[32px] border-t-[0.8px] border-[#F3F4F6] bg-white p-6 shadow-[0px_25px_56px_-12px_rgba(0,0,0,0.25)] lg:p-10 xl:w-[786px]">
              {/* Step 01: Personal Details Header */}
              <div className="flex h-[52px] w-[207px] items-center gap-[12px]">
                {/* 01 Circle */}
                <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[26px] border-[2px] border-[#2E3192] bg-[#2E3192]">
                  <span className="font-outfit text-center text-[18px] font-extrabold leading-[100%] text-white">
                    01
                  </span>
                </div>
                {/* Title & Subtitle */}
                <div className="flex h-[44px] w-[143px] flex-col justify-center gap-[2px]">
                  <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                    Personal details
                  </span>
                  <span className="font-poppins text-[12px] font-normal leading-[21px] text-[#898989]">
                    Who we're seeing today
                  </span>
                </div>
              </div>

              {/* Form Inputs Grid */}
              <div className="mt-[40px] flex flex-col gap-[20px]">
                {/* Row 1 */}
                <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
                  {/* Full Name Container */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your name"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] px-[16px] py-[12px] text-[16px] font-normal outline-none transition-colors focus:border-[#2E3192]"
                    />
                  </div>

                  {/* Age Container */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Age
                    </label>
                    <input
                      type="text"
                      placeholder="Age"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] px-[16px] py-[12px] text-[16px] font-normal outline-none transition-colors focus:border-[#2E3192]"
                    />
                  </div>
                </div>

                {/* Row 2 */}
                <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
                  {/* Phone number Container */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Phone number
                    </label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] px-[16px] py-[12px] text-[16px] font-normal outline-none transition-colors focus:border-[#2E3192]"
                    />
                  </div>
                  {/* Email Container */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Email
                    </label>
                    <input
                      type="text"
                      placeholder="yourname@gmail.com"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] px-[16px] py-[12px] text-[16px] font-normal outline-none transition-colors placeholder:text-[#0A0A0A]/50 focus:border-[#2E3192]"
                    />
                  </div>
                </div>

                {/* Row 3 */}
                <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
                  {/* Gender Container */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Gender
                    </label>
                    <div className="relative h-[44px] w-full">
                      <select
                        defaultValue=""
                        className="font-inter h-full w-full cursor-pointer appearance-none rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-white py-[12px] pl-[16px] pr-[40px] text-[16px] font-normal text-[#0A0A0A] outline-none transition-colors focus:border-[#2E3192]"
                      >
                        <option value="" disabled hidden>
                          Select
                        </option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="others">Others</option>
                        <option value="preferred_not_to_say">Preferred Not To Say</option>
                      </select>
                      <div className="pointer-events-none absolute right-[16px] top-1/2 -translate-y-1/2 text-[#0F0F0F]">
                        <svg
                          width="14"
                          height="8"
                          viewBox="0 0 14 8"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M7.37629 7.37629C7.18876 7.56376 6.93445 7.66907 6.66929 7.66907C6.40412 7.66907 6.14982 7.56376 5.96229 7.37629L0.305288 1.71929C0.209778 1.62704 0.133596 1.5167 0.0811869 1.39469C0.0287779 1.27269 0.00119157 1.14147 3.77564e-05 1.00869C-0.00111606 0.87591 0.0241859 0.744231 0.0744668 0.621335C0.124748 0.498438 0.199001 0.386786 0.292893 0.292893C0.386786 0.199 0.498438 0.124747 0.621334 0.0744663C0.744231 0.0241854 0.87591 -0.00111606 1.00869 3.77571e-05C1.14147 0.00119157 1.27269 0.0287779 1.39469 0.0811869C1.5167 0.133596 1.62704 0.209778 1.71929 0.305288L6.66929 5.25529L11.6193 0.305288C11.8079 0.12313 12.0605 0.0223355 12.3227 0.0246139C12.5849 0.0268924 12.8357 0.132061 13.0211 0.317469C13.2065 0.502877 13.3117 0.75369 13.314 1.01589C13.3162 1.27808 13.2154 1.53069 13.0333 1.71929L7.37629 7.37629Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 02: Eye & health history */}
              <div className="mt-[40px] flex w-full flex-col gap-[34px] xl:w-[683.6px]">
                {/* 02 Header Group (Frame 2610720) */}
                <div className="flex h-[93px] w-full flex-col gap-[20px] xl:w-[381px]">
                  {/* Circle & Title */}
                  <div className="flex h-[52px] w-[342px] items-center gap-[12px]">
                    {/* 02 Circle */}
                    <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[26px] border-[2px] border-[#2E3192] bg-[#2E3192]">
                      <span className="font-outfit text-center text-[18px] font-extrabold leading-[100%] text-white">
                        02
                      </span>
                    </div>
                    {/* Title & Subtitle */}
                    <div className="flex w-[273px] flex-col justify-center gap-[2px]">
                      <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                        Eye & health history
                      </span>
                      <span className="font-poppins text-[12px] font-normal leading-[21px] text-[#898989]">
                        Helps us catch what a fresh exam might miss
                      </span>
                    </div>
                  </div>

                  {/* Question (Frame 2610714) */}
                  <div className="flex h-[21px] items-center gap-[8px]">
                    <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#161616]">
                      Do any of these apply to you ?
                    </span>
                    <span className="font-poppins text-[12px] font-normal leading-[21px] text-[#898989]">
                      (Select all that apply)
                    </span>
                  </div>
                </div>

                {/* Checkboxes Group (Frame 2610719) */}
                <div className="flex h-auto min-h-[291px] w-full flex-col gap-[16px]">
                  {/* Row 1 (Frame 2610716) */}
                  <div className="flex w-full flex-wrap items-center gap-[8px] lg:flex-nowrap xl:gap-[12px]">
                    <CheckboxPill label="Diabetes" widthClass="w-fit" />
                    <CheckboxPill label="Glaucoma" widthClass="w-fit" />
                    <CheckboxPill label="Cataracts" widthClass="w-fit" />
                    <CheckboxPill label="Previous eye surgery" widthClass="w-fit" />
                  </div>

                  {/* Row 2 (Frame 2610717) */}
                  <div className="flex w-full flex-wrap items-center gap-[12px]">
                    <CheckboxPill label="Family history of eye disease" widthClass="w-fit" />
                    <CheckboxPill label="Currently wear glasses" widthClass="w-fit" />
                  </div>

                  {/* Row 3 (Frame 2610718) */}
                  <div className="flex w-full flex-wrap items-center gap-[12px]">
                    <CheckboxPill label="Currently wear contact lenses" widthClass="w-fit" />
                    <CheckboxPill label="None of the above" widthClass="w-fit" />
                  </div>

                  {/* Past Prescriptions Notes */}
                  <div className="mt-[4px] flex w-full flex-col gap-[12px] xl:w-[684px]">
                    <span className="font-inter text-[16px] font-normal leading-[100%] text-[#0A0A0A]">
                      Past prescriptions or notes (optional)
                    </span>
                    <textarea
                      placeholder="e.g. last tested in 2024"
                      className="font-inter h-[76px] w-full resize-none rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] px-[20px] py-[12px] text-[16px] font-normal outline-none transition-colors placeholder:text-[#0A0A0A]/50 focus:border-[#2E3192]"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Step 03: Current Prescription */}
              <div className="mt-[40px] flex w-full flex-col gap-[34px] xl:w-[683.6px]">
                {/* 03 Header Group (Frame 2610709) */}
                <div className="flex h-[52px] w-auto items-center gap-[12px] lg:w-[342px]">
                  {/* 03 Circle */}
                  <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[26px] border-[2px] border-[#2E3192] bg-[#2E3192]">
                    <span className="font-outfit text-center text-[18px] font-extrabold leading-[100%] text-white">
                      03
                    </span>
                  </div>
                  {/* Title & Subtitle (Frame 2610707) */}
                  <div className="flex h-[44px] w-auto flex-col justify-center gap-[2px] lg:w-[299px]">
                    <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Current prescription
                    </span>
                    <span className="font-poppins text-[12px] font-normal leading-[21px] text-[#898989]">
                      (If known) Leave blank if you'd rather we test fresh
                    </span>
                  </div>
                </div>

                {/* Prescription Table (Group 3) */}
                <div className="relative hidden h-[170px] w-full overflow-hidden rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] md:block xl:w-[684px]">
                  {/* Table Header (Frame 2610722) */}
                  <div className="absolute left-0 top-0 h-[53px] w-full border-b-[1px] border-[#E3E3E6] bg-[#F5F5FF]">
                    <span className="font-poppins absolute left-[27px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Eye
                    </span>
                    <span className="font-poppins absolute left-[208px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      SPH
                    </span>
                    <span className="font-poppins absolute left-[302px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      CYL
                    </span>
                    <span className="font-poppins absolute left-[395px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      AXIS
                    </span>
                    <span className="font-poppins absolute left-[495px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      ADD
                    </span>
                    <span className="font-poppins absolute left-[593px] top-[16px] text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      PD(MM)
                    </span>
                  </div>

                  {/* Right (OD) Row */}
                  <div className="absolute left-[20px] top-[71px] flex items-center gap-[8px]">
                    <div className="h-[12px] w-[12px] rounded-full bg-[#E53935]"></div>
                    <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#E53935]">
                      Right (OD)
                    </span>
                  </div>
                  <PrescriptionInput top={63} left={186} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={283} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={388} width={51.6} placeholder="0" />
                  <PrescriptionInput top={63} left={475} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={588} width={61.6} placeholder="32" />

                  {/* Left (OS) Row */}
                  <div className="absolute left-[20px] top-[130px] flex items-center gap-[8px]">
                    <div className="h-[12px] w-[12px] rounded-full bg-[#E53935]"></div>
                    <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#E53935]">
                      LEFT (OS)
                    </span>
                  </div>
                  <PrescriptionInput top={122} left={186} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={283} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={388} width={51.6} placeholder="0" />
                  <PrescriptionInput top={122} left={475} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={588} width={61.6} placeholder="32" />
                </div>
              </div>

              {/* Step 04: Preferred Appointment */}
              <div className="mt-[40px] flex w-full flex-col gap-[33px] xl:w-[706px]">
                {/* 04 Header Group */}
                <div className="flex h-[52px] w-auto items-center gap-[12px] lg:w-[342px]">
                  {/* 04 Circle */}
                  <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[26px] border-[2px] border-[#2E3192] bg-[#2E3192]">
                    <span className="font-outfit text-center text-[18px] font-extrabold leading-[100%] text-white">
                      04
                    </span>
                  </div>
                  {/* Title & Subtitle (Frame 2610707) */}
                  <div className="flex h-[44px] w-auto flex-col justify-center gap-[2px] lg:w-[222px]">
                    <span className="font-poppins whitespace-nowrap text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Preferred appointment
                    </span>
                    <span className="font-poppins whitespace-nowrap text-[12px] font-normal leading-[21px] text-[#898989]">
                      We’ll confirm by SMS within the hours
                    </span>
                  </div>
                </div>

                {/* Form Group (Frame 2610727) */}
                <div className="flex w-full flex-col items-center gap-[20px] md:h-[73px] md:flex-row md:gap-[40px]">
                  {/* Preferred Date */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Preferred date
                    </label>
                    <input
                      type="date"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-transparent px-[16px] py-[12px] text-[16px] font-normal text-[#0A0A0A]/50 outline-none transition-colors focus:border-[#2E3192]"
                    />
                  </div>

                  {/* Preferred Time */}
                  <div className="flex h-[73px] w-full flex-col gap-[8px] md:w-[333px]">
                    <label className="font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]">
                      Preferred time
                    </label>
                    <input
                      type="time"
                      className="font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-transparent px-[16px] py-[12px] text-[16px] font-normal text-[#0A0A0A]/50 outline-none transition-colors focus:border-[#2E3192]"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button className="mt-[40px] flex h-[54px] w-full items-center justify-center rounded-full bg-[#B51A13] transition-colors hover:bg-[#8e140f]">
                  <span className="font-poppins text-center text-[20.25px] font-semibold leading-[30.38px] text-white">
                    Submit my eye record
                  </span>
                </button>
              </div>
            </div>

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

              {/* Middle Frame: Store hours */}
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
                    10:00 AM – 4:00 PM
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
                <button className="mt-auto flex h-[54.5px] w-full items-center justify-center rounded-[40px] border border-[#FFFFFFB2] transition-colors hover:bg-white/10">
                  <span className="font-poppins text-center text-[14.5px] font-semibold leading-[100%] text-white">
                    Call +91 98765 43210
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
