import Image from 'next/image';

export const metadata = {
  title: 'Eye Care | Optex Opticians',
  description: 'Comprehensive eye care at Optex Opticians — free eye exams, records kept for life, and same-day fitting.',
};

function CheckPill({ text, textColor }) {
  return (
    <div className="flex items-center gap-2 rounded-[20px] border border-[#FFFFFF29] bg-[#FFFFFF14] backdrop-blur-md py-[9px] px-[16px] whitespace-nowrap">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.6663 3.5L5.24967 9.91667L2.33301 7" stroke="#E53935" strokeWidth="1.16667" />
      </svg>
      <span className={`font-poppins font-normal text-[14px] leading-[100%] ${textColor}`}>
        {text}
      </span>
    </div>
  );
}

function CheckboxPill({ label, widthClass = "w-fit" }) {
  return (
    <label className={`flex items-center gap-[10px] ${widthClass} h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] py-[12px] px-[20px] transition-colors hover:border-[#2E3192] cursor-pointer`}>
      <input type="checkbox" className="w-[19px] h-[19px] rounded-[4px] border-[0.8px] border-[#E5E7EB] bg-white accent-[#2E3192] cursor-pointer" />
      <span className="font-inter font-normal text-[16px] leading-[100%] text-[#0A0A0A] whitespace-nowrap">{label}</span>
    </label>
  );
}

function PrescriptionInput({ top, left, width, placeholder }) {
  return (
    <input 
      type="text"
      placeholder={placeholder}
      className="absolute h-[38px] rounded-[8px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] px-[20px] font-inter font-normal text-[16px] outline-none focus:border-[#2E3192] transition-colors placeholder:text-[#0A0A0A]"
      style={{ top: `${top}px`, left: `${left}px`, width: `${width}px` }}
    />
  );
}

export default function EyeCarePage() {
  return (
    <div className="w-full flex flex-col bg-white">
      <section className="relative w-full h-[292px] flex items-center justify-center overflow-hidden">
        <Image
          src="/images/eyecare-hero.jpg"
          alt="Optometrist examining a customer's eyes"
          fill
          priority
          className="object-cover object-[center_55%]"
        />
        <div className="absolute inset-0 bg-[#3733338A]" />

        <div className="relative z-10 flex flex-col items-center gap-[34px] w-full max-w-[660px] px-4">
          <h1 className="w-full max-w-[534px] text-center font-outfit font-bold text-[32px] sm:text-[40px] lg:text-[48px] leading-[120%] tracking-[-0.01em] capitalize text-white">
            Tell Us About Your <span className="text-[#E53935]">Eyes</span>.
            <br />
            We&apos;ll Take It From There.
          </h1>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <CheckPill text="Free comprehensive exam" textColor="text-[#F5F5F5]" />
            <CheckPill text="Records kept for life" textColor="text-[#F5F5F5]" />
            <CheckPill text="Same day fitting" textColor="text-[#DCDCF3]" />
          </div>
        </div>
      </section>

      {/* Patient Record & Booking Section */}
      <section className="w-full bg-[#F9F9FC] flex justify-center pb-24">
        <div className="w-full max-w-[1440px] px-6 lg:px-[80px] flex flex-col">
          
          {/* Header Group */}
          <div className="flex flex-col gap-[18px] mt-12 lg:mt-[80px] w-full max-w-[532px]">
            <span className="font-poppins font-semibold text-[16px] leading-[24px] tracking-[2px] text-[#E53935] uppercase">
              Patient Record & Booking
            </span>
            <h2 className="font-outfit font-semibold text-[32px] leading-[34px] text-black">
              Your eye care record
            </h2>
          </div>

          {/* Two Column Content */}
          <div className="flex flex-col xl:flex-row gap-10 xl:gap-[57px] mt-10 lg:mt-[40px]">
            
            {/* Left Column (Frame 2610706) */}
            <div className="w-full xl:w-[786px] h-auto min-h-[1477px] rounded-[32px] border-t-[0.8px] border-[#F3F4F6] bg-white shadow-[0px_25px_56px_-12px_rgba(0,0,0,0.25)] flex flex-col p-6 lg:p-10 relative">
              
              {/* Step 01: Personal Details Header */}
              <div className="flex items-center gap-[12px] w-[207px] h-[52px]">
                {/* 01 Circle */}
                <div className="w-[52px] h-[52px] rounded-[26px] bg-[#2E3192] border-[2px] border-[#2E3192] flex items-center justify-center flex-shrink-0">
                  <span className="font-outfit font-extrabold text-[18px] leading-[100%] text-white text-center">
                    01
                  </span>
                </div>
                {/* Title & Subtitle */}
                <div className="flex flex-col gap-[2px] w-[143px] h-[44px] justify-center">
                  <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">
                    Personal details
                  </span>
                  <span className="font-poppins font-normal text-[12px] leading-[21px] text-[#898989]">
                    Who we're seeing today
                  </span>
                </div>
              </div>

              {/* Form Inputs Grid */}
              <div className="flex flex-col gap-[20px] mt-[40px]">
                
                {/* Row 1 */}
                <div className="flex flex-col md:flex-row gap-[20px] md:gap-[40px]">
                  
                  {/* Full Name Container */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Full Name
                    </label>
                    <input 
                      type="text" 
                      placeholder="Enter your name" 
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] outline-none focus:border-[#2E3192] transition-colors"
                    />
                  </div>

                  {/* Age Container */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Age
                    </label>
                    <input 
                      type="text" 
                      placeholder="Age" 
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] outline-none focus:border-[#2E3192] transition-colors"
                    />
                  </div>
                </div>

                {/* Row 2 */}
                <div className="flex flex-col md:flex-row gap-[20px] md:gap-[40px]">
                  
                  {/* Phone number Container */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Phone number
                    </label>
                    <input 
                      type="text" 
                      placeholder="Phone number" 
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] outline-none focus:border-[#2E3192] transition-colors"
                    />
                  </div>
                  {/* Email Container */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Email
                    </label>
                    <input 
                      type="text" 
                      placeholder="yourname@gmail.com" 
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] placeholder:text-[#0A0A0A]/50 outline-none focus:border-[#2E3192] transition-colors"
                    />
                  </div>
                </div>

                {/* Row 3 */}
                <div className="flex flex-col md:flex-row gap-[20px] md:gap-[40px]">
                  
                  {/* Gender Container */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Gender
                    </label>
                    <div className="relative w-full h-[44px]">
                      <select 
                        defaultValue="" 
                        className="w-full h-full rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] pl-[16px] pr-[40px] font-inter font-normal text-[16px] text-[#0A0A0A] bg-white outline-none focus:border-[#2E3192] transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" disabled hidden>Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="others">Others</option>
                        <option value="preferred_not_to_say">Preferred Not To Say</option>
                      </select>
                      <div className="absolute right-[16px] top-1/2 -translate-y-1/2 pointer-events-none text-[#0F0F0F]">
                        <svg width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M7.37629 7.37629C7.18876 7.56376 6.93445 7.66907 6.66929 7.66907C6.40412 7.66907 6.14982 7.56376 5.96229 7.37629L0.305288 1.71929C0.209778 1.62704 0.133596 1.5167 0.0811869 1.39469C0.0287779 1.27269 0.00119157 1.14147 3.77564e-05 1.00869C-0.00111606 0.87591 0.0241859 0.744231 0.0744668 0.621335C0.124748 0.498438 0.199001 0.386786 0.292893 0.292893C0.386786 0.199 0.498438 0.124747 0.621334 0.0744663C0.744231 0.0241854 0.87591 -0.00111606 1.00869 3.77571e-05C1.14147 0.00119157 1.27269 0.0287779 1.39469 0.0811869C1.5167 0.133596 1.62704 0.209778 1.71929 0.305288L6.66929 5.25529L11.6193 0.305288C11.8079 0.12313 12.0605 0.0223355 12.3227 0.0246139C12.5849 0.0268924 12.8357 0.132061 13.0211 0.317469C13.2065 0.502877 13.3117 0.75369 13.314 1.01589C13.3162 1.27808 13.2154 1.53069 13.0333 1.71929L7.37629 7.37629Z" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Step 02: Eye & health history */}
              <div className="flex flex-col gap-[34px] mt-[40px] w-full xl:w-[683.6px]">
                
                {/* 02 Header Group (Frame 2610720) */}
                <div className="flex flex-col gap-[20px] w-full xl:w-[381px] h-[93px]">
                  
                  {/* Circle & Title */}
                  <div className="flex items-center gap-[12px] w-[342px] h-[52px]">
                    {/* 02 Circle */}
                    <div className="w-[52px] h-[52px] rounded-[26px] bg-[#2E3192] border-[2px] border-[#2E3192] flex items-center justify-center flex-shrink-0">
                      <span className="font-outfit font-extrabold text-[18px] leading-[100%] text-white text-center">
                        02
                      </span>
                    </div>
                    {/* Title & Subtitle */}
                    <div className="flex flex-col gap-[2px] w-[273px] justify-center">
                      <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">
                        Eye & health history
                      </span>
                      <span className="font-poppins font-normal text-[12px] leading-[21px] text-[#898989]">
                        Helps us catch what a fresh exam might miss
                      </span>
                    </div>
                  </div>

                  {/* Question (Frame 2610714) */}
                  <div className="flex items-center gap-[8px] h-[21px]">
                    <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#161616]">
                      Do any of these apply to you ?
                    </span>
                    <span className="font-poppins font-normal text-[12px] leading-[21px] text-[#898989]">
                      (Select all that apply)
                    </span>
                  </div>

                </div>

                {/* Checkboxes Group (Frame 2610719) */}
                <div className="flex flex-col gap-[16px] w-full h-auto min-h-[291px]">
                  
                  {/* Row 1 (Frame 2610716) */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-[8px] xl:gap-[12px] w-full">
                    <CheckboxPill label="Diabetes" widthClass="w-fit" />
                    <CheckboxPill label="Glaucoma" widthClass="w-fit" />
                    <CheckboxPill label="Cataracts" widthClass="w-fit" />
                    <CheckboxPill label="Previous eye surgery" widthClass="w-fit" />
                  </div>

                  {/* Row 2 (Frame 2610717) */}
                  <div className="flex flex-wrap items-center gap-[12px] w-full">
                    <CheckboxPill label="Family history of eye disease" widthClass="w-fit" />
                    <CheckboxPill label="Currently wear glasses" widthClass="w-fit" />
                  </div>

                  {/* Row 3 (Frame 2610718) */}
                  <div className="flex flex-wrap items-center gap-[12px] w-full">
                    <CheckboxPill label="Currently wear contact lenses" widthClass="w-fit" />
                    <CheckboxPill label="None of the above" widthClass="w-fit" />
                  </div>

                  {/* Past Prescriptions Notes */}
                  <div className="flex flex-col gap-[12px] w-full xl:w-[684px] mt-[4px]">
                    <span className="font-inter font-normal text-[16px] leading-[100%] text-[#0A0A0A]">
                      Past prescriptions or notes (optional)
                    </span>
                    <textarea 
                      placeholder="e.g. last tested in 2024"
                      className="w-full h-[76px] rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] py-[12px] px-[20px] font-inter font-normal text-[16px] placeholder:text-[#0A0A0A]/50 outline-none focus:border-[#2E3192] transition-colors resize-none"
                    ></textarea>
                  </div>

                </div>

              </div>

              {/* Step 03: Current Prescription */}
              <div className="flex flex-col gap-[34px] mt-[40px] w-full xl:w-[683.6px]">
                {/* 03 Header Group (Frame 2610709) */}
                <div className="flex items-center gap-[12px] w-auto lg:w-[342px] h-[52px]">
                  {/* 03 Circle */}
                  <div className="w-[52px] h-[52px] rounded-[26px] bg-[#2E3192] border-[2px] border-[#2E3192] flex items-center justify-center flex-shrink-0">
                    <span className="font-outfit font-extrabold text-[18px] leading-[100%] text-white text-center">
                      03
                    </span>
                  </div>
                  {/* Title & Subtitle (Frame 2610707) */}
                  <div className="flex flex-col gap-[2px] w-auto lg:w-[299px] h-[44px] justify-center">
                    <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">
                      Current prescription
                    </span>
                    <span className="font-poppins font-normal text-[12px] leading-[21px] text-[#898989]">
                      (If known) Leave blank if you'd rather we test fresh
                    </span>
                  </div>
                </div>

                {/* Prescription Table (Group 3) */}
                <div className="relative w-full xl:w-[684px] h-[170px] rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] overflow-hidden hidden md:block">
                  
                  {/* Table Header (Frame 2610722) */}
                  <div className="absolute top-0 left-0 w-full h-[53px] bg-[#F5F5FF] border-b-[1px] border-[#E3E3E6]">
                    <span className="absolute top-[16px] left-[27px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">Eye</span>
                    <span className="absolute top-[16px] left-[208px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">SPH</span>
                    <span className="absolute top-[16px] left-[302px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">CYL</span>
                    <span className="absolute top-[16px] left-[395px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">AXIS</span>
                    <span className="absolute top-[16px] left-[495px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">ADD</span>
                    <span className="absolute top-[16px] left-[593px] font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F]">PD(MM)</span>
                  </div>

                  {/* Right (OD) Row */}
                  <div className="absolute top-[71px] left-[20px] flex items-center gap-[8px]">
                    <div className="w-[12px] h-[12px] rounded-full bg-[#E53935]"></div>
                    <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#E53935]">Right (OD)</span>
                  </div>
                  <PrescriptionInput top={63} left={186} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={283} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={388} width={51.6} placeholder="0" />
                  <PrescriptionInput top={63} left={475} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={63} left={588} width={61.6} placeholder="32" />

                  {/* Left (OS) Row */}
                  <div className="absolute top-[130px] left-[20px] flex items-center gap-[8px]">
                    <div className="w-[12px] h-[12px] rounded-full bg-[#E53935]"></div>
                    <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#E53935]">LEFT (OS)</span>
                  </div>
                  <PrescriptionInput top={122} left={186} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={283} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={388} width={51.6} placeholder="0" />
                  <PrescriptionInput top={122} left={475} width={75.6} placeholder="0.00" />
                  <PrescriptionInput top={122} left={588} width={61.6} placeholder="32" />

                </div>
              </div>

              {/* Step 04: Preferred Appointment */}
              <div className="flex flex-col gap-[33px] mt-[40px] w-full xl:w-[706px]">
                
                {/* 04 Header Group */}
                <div className="flex items-center gap-[12px] w-auto lg:w-[342px] h-[52px]">
                  {/* 04 Circle */}
                  <div className="w-[52px] h-[52px] rounded-[26px] bg-[#2E3192] border-[2px] border-[#2E3192] flex items-center justify-center flex-shrink-0">
                    <span className="font-outfit font-extrabold text-[18px] leading-[100%] text-white text-center">
                      04
                    </span>
                  </div>
                  {/* Title & Subtitle (Frame 2610707) */}
                  <div className="flex flex-col gap-[2px] w-auto lg:w-[222px] h-[44px] justify-center">
                    <span className="font-poppins font-semibold text-[16px] leading-[21px] text-[#0F0F0F] whitespace-nowrap">
                      Preferred appointment
                    </span>
                    <span className="font-poppins font-normal text-[12px] leading-[21px] text-[#898989] whitespace-nowrap">
                      We’ll confirm by SMS within the hours
                    </span>
                  </div>
                </div>

                {/* Form Group (Frame 2610727) */}
                <div className="flex flex-col md:flex-row items-center gap-[20px] md:gap-[40px] w-full md:h-[73px]">
                  
                  {/* Preferred Date */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Preferred date
                    </label>
                    <input 
                      type="date"
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] text-[#0A0A0A]/50 outline-none focus:border-[#2E3192] transition-colors bg-transparent"
                    />
                  </div>

                  {/* Preferred Time */}
                  <div className="flex flex-col gap-[8px] w-full md:w-[333px] h-[73px]">
                    <label className="font-poppins font-semibold text-[14px] leading-[21px] text-[#0F0F0F]">
                      Preferred time
                    </label>
                    <input 
                      type="time"
                      className="w-full h-[44px] rounded-[14px] border-[0.8px] border-[#E5E7EB] py-[12px] px-[16px] font-inter font-normal text-[16px] text-[#0A0A0A]/50 outline-none focus:border-[#2E3192] transition-colors bg-transparent"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button className="flex items-center justify-center w-full h-[54px] rounded-full bg-[#B51A13] mt-[40px] hover:bg-[#8e140f] transition-colors">
                  <span className="font-poppins font-semibold text-[20.25px] leading-[30.38px] text-white text-center">
                    Submit my eye record
                  </span>
                </button>

              </div>

            </div>

            {/* Right Column */}
            <div className="w-full xl:w-[437.37px] flex flex-col">
              
              {/* Top Frame: Why fill this in advance */}
              <div className="w-full h-[288.25px] rounded-[20px] border border-[#DFDFDF] bg-[#F6F6F9] pt-[29.25px] px-[28px] pb-[30px] flex flex-col gap-[14px]">
                
                {/* Heading */}
                <h4 className="font-outfit font-bold text-[15.5px] leading-[17px] tracking-[-0.16px] text-[#20225F]">
                  Why fill this in advance
                </h4>

                {/* Item 1 */}
                <div className="flex items-center gap-[14px] w-full h-[62px]">
                  <div className="flex-shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-[10px] bg-white">
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.375 8.50016L7.79167 9.91683L10.625 7.0835" stroke="#2E3192" strokeWidth="1.20417"/>
                      <path d="M2.125 8.5C2.125 12.0185 4.98154 14.875 8.5 14.875C12.0185 14.875 14.875 12.0185 14.875 8.5C14.875 4.98154 12.0185 2.125 8.5 2.125C4.98154 2.125 2.125 4.98154 2.125 8.5V8.5" stroke="#2E3192" strokeWidth="1.20417"/>
                    </svg>
                  </div>
                  <div className="flex flex-col justify-center gap-[5.5px] w-full">
                    <span className="font-poppins font-semibold text-[13.5px] leading-[100%] text-[#20225F]">Faster in-store visit</span>
                    <span className="font-poppins font-normal text-[12.5px] leading-[100%] text-[#767791]">Your optometrist reviews your file before you sit down</span>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="flex items-center gap-[14px] w-full h-[64px] pt-[2px]">
                  <div className="flex-shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-[10px] bg-white">
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.95801 2.8335H12.0413C13.2149 2.8335 14.1663 3.78489 14.1663 4.9585V12.0418C14.1663 13.2154 13.2149 14.1668 12.0413 14.1668H4.95801C3.7844 14.1668 2.83301 13.2154 2.83301 12.0418V4.9585C2.83301 3.78489 3.7844 2.8335 4.95801 2.8335V2.8335" stroke="#2E3192" strokeWidth="1.20417"/>
                      <path d="M5.66634 1.4165V4.24984M11.333 1.4165V4.24984M2.83301 7.08317H14.1663" stroke="#2E3192" strokeWidth="1.20417"/>
                    </svg>
                  </div>
                  <div className="flex flex-col justify-center gap-[5.5px] w-full">
                    <span className="font-poppins font-semibold text-[13.5px] leading-[100%] text-[#20225F]">One record, every branch</span>
                    <span className="font-poppins font-normal text-[12.5px] leading-[100%] text-[#767791]">Walk into any of our 12 stores and your file is already there</span>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="flex items-center gap-[14px] w-full h-[44px] pt-[2px]">
                  <div className="flex-shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-[10px] bg-white">
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 8.5C2 8.5 5 4.5 8.5 4.5C12 4.5 15 8.5 15 8.5C15 8.5 12 12.5 8.5 12.5C5 12.5 2 8.5 2 8.5Z" stroke="#2E3192" strokeWidth="1.20417"/>
                      <circle cx="8.5" cy="8.5" r="2.5" stroke="#2E3192" strokeWidth="1.20417"/>
                    </svg>
                  </div>
                  <div className="flex flex-col justify-center gap-[4.5px] w-full">
                    <span className="font-poppins font-semibold text-[13.5px] leading-[100%] text-[#20225F]">Frames pulled ahead</span>
                    <span className="font-poppins font-normal text-[12.5px] leading-[100%] text-[#767791]">Tell us your brand and we'll have a shortlist ready.</span>
                  </div>
                </div>

              </div>

              {/* Middle Frame: Store hours */}
              <div className="w-full h-[200.25px] rounded-[20px] bg-[#20225F] pt-[29.25px] px-[28px] pb-[30px] flex flex-col mt-[14px]">
                <h4 className="font-outfit font-bold text-[15.5px] leading-[17px] tracking-[-0.16px] text-white pb-[14px]">
                  Store hours
                </h4>
                <div className="flex items-center justify-between py-[9px] border-b-[1px] border-dashed border-[#FFFFFF29]">
                  <span className="font-poppins font-normal text-[13px] leading-[100%] text-[#C7C8E6]">Mon – Fri</span>
                  <span className="font-poppins font-medium text-[13px] leading-[100%] text-white">8:30 AM – 7:00 PM</span>
                </div>
                <div className="flex items-center justify-between py-[9px] border-b-[1px] border-dashed border-[#FFFFFF29]">
                  <span className="font-poppins font-normal text-[13px] leading-[100%] text-[#C7C8E6]">Saturday</span>
                  <span className="font-poppins font-medium text-[13px] leading-[100%] text-white">9:00 AM – 6:00 PM</span>
                </div>
                <div className="flex items-center justify-between py-[9px]">
                  <span className="font-poppins font-normal text-[13px] leading-[100%] text-[#C7C8E6]">Sunday</span>
                  <span className="font-poppins font-medium text-[13px] leading-[100%] text-white">10:00 AM – 4:00 PM</span>
                </div>
              </div>

              {/* Bottom Frame: Prefer to talk first? */}
              <div className="w-full h-[203.75px] rounded-[20px] bg-[#E53935] pt-[29.25px] px-[28px] pb-[30px] flex flex-col gap-[14px] mt-[14px]">
                <h4 className="font-outfit font-bold text-[15.5px] leading-[17px] tracking-[-0.16px] text-white">
                  Prefer to talk first?
                </h4>
                <p className="font-poppins font-normal text-[13px] leading-[22.1px] text-[#FFE0DE]">
                  Call our care line and an optometrist will walk you through the form.
                </p>
                <button className="w-full h-[54.5px] rounded-[40px] border border-[#FFFFFFB2] flex items-center justify-center transition-colors hover:bg-white/10 mt-auto">
                  <span className="font-poppins font-semibold text-[14.5px] leading-[100%] text-white text-center">
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
